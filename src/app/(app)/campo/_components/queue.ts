"use client";
import { createStore, del, get, set, values } from "idb-keyval";
import { uploadEvidence } from "@/lib/upload";
import { submitAttendance, submitFieldExpense, submitStockIn, type FieldAttendance, type FieldExpense, type FieldStockIn } from "../actions";

export type QueueKind = "gasto" | "asistencia" | "almacen";
export type QueueItem = {
  id: string;
  kind: QueueKind;
  label: string;
  amount?: number;
  createdAt: string;
  projectId: string;
  companyId: string;
  photo?: Blob | null;
  photoFolder?: string;
  payload: Record<string, unknown>;
  error?: string | null;
  attempts: number;
};

const store = typeof indexedDB !== "undefined" ? createStore("gc-campo", "cola") : undefined;
const EVENT = "gc-queue-change";
const emit = () => window.dispatchEvent(new Event(EVENT));
export const onQueueChange = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export async function listQueue(): Promise<QueueItem[]> {
  if (!store) return [];
  return ((await values(store)) as QueueItem[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function enqueue(item: Omit<QueueItem, "id" | "createdAt" | "attempts" | "error">) {
  const full: QueueItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString(), attempts: 0, error: null };
  await set(full.id, full, store);
  emit();
  return full;
}
export async function discard(id: string) {
  await del(id, store);
  emit();
}
export async function clearError(id: string) {
  const it = (await get(id, store)) as QueueItem | undefined;
  if (it) { await set(id, { ...it, error: null }, store); emit(); }
}

let running: Promise<SyncResult> | null = null;
export type SyncResult = { synced: number; failed: number; offline: boolean; messages: string[] };

/** Sincroniza la cola en orden. Se detiene si se pierde la conexión; los errores de negocio quedan marcados. */
export function syncQueue(): Promise<SyncResult> {
  if (running) return running;
  running = (async () => {
    const res: SyncResult = { synced: 0, failed: 0, offline: false, messages: [] };
    for (const item of await listQueue()) {
      if (item.error) continue;
      if (!navigator.onLine) { res.offline = true; break; }
      try {
        const payload = { ...item.payload };
        if (item.photo && !payload.photoPath) {
          const up = await uploadEvidence(item.photo, { companyId: item.companyId, projectId: item.projectId, folder: item.photoFolder ?? "campo", name: `${item.kind}.jpg` });
          payload.photoPath = up.path;
          payload.photoSize = up.size;
          await set(item.id, { ...item, payload, photo: null }, store);
        }
        const r = item.kind === "gasto" ? await submitFieldExpense(payload as FieldExpense)
          : item.kind === "asistencia" ? await submitAttendance(payload as FieldAttendance)
          : await submitStockIn(payload as FieldStockIn);
        if (r.ok) {
          await del(item.id, store);
          res.synced++;
          if (r.message) res.messages.push(r.message);
        } else {
          await set(item.id, { ...item, payload, photo: payload.photoPath ? null : item.photo, error: r.error, attempts: item.attempts + 1 }, store);
          res.failed++;
        }
      } catch {
        // Falla de red: se reintenta después sin marcar error.
        res.offline = !navigator.onLine;
        await set(item.id, { ...item, attempts: item.attempts + 1 }, store);
        break;
      }
      emit();
    }
    emit();
    return res;
  })().finally(() => { running = null; });
  return running;
}
