"use client";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Comprime una imagen en el navegador (ahorra datos en obra): máx. 1600 px, JPEG 0.72. */
export async function compressImage(file: File, max = 1600, quality = 0.72): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  return blob && blob.size < file.size ? blob : file;
}

export type Geo = { lat: number; lng: number; accuracy: number } | null;

/** Ubicación GPS actual (evidencia de la foto). Devuelve null si el usuario no la concede. */
export function currentPosition(timeout = 8000): Promise<Geo> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    );
  });
}

/**
 * Sube una evidencia al bucket privado `evidencias` en {company}/{project}/{folder}/{uuid}.ext
 * (las políticas de Storage exigen que el usuario pertenezca a la empresa).
 */
export async function uploadEvidence(file: File | Blob, opts: { companyId: string; projectId: string; folder: string; name?: string }) {
  const sb = supabaseBrowser();
  const blob = file instanceof File ? await compressImage(file) : file;
  const ext = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
  const path = `${opts.companyId}/${opts.projectId}/${opts.folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("evidencias").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
  return { path, size: blob.size, mime: blob.type || "image/jpeg", name: file instanceof File ? file.name : opts.name ?? path.split("/").pop()! };
}
