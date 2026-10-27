"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SessionOverlay } from "@/components/layout/session-overlay";
import { logoutAction } from "@/app/login/actions";

export function LogoutButton({ name }: { name: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  return (
    <>
      <SessionOverlay mode={leaving ? "out" : null} name={name} />
      <button
        onClick={async () => {
          setLeaving(true);
          await Promise.all([logoutAction(), new Promise((r) => setTimeout(r, 1200))]);
          try { sessionStorage.removeItem("gc-preloaded"); } catch {}
          router.replace("/login?salida=1");
          router.refresh();
        }}
        className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 text-white/80 transition hover:bg-white/10 hover:text-white"
        aria-label="Cerrar sesión" title="Cerrar sesión">
        <LogOut className="h-4 w-4" />
      </button>
    </>
  );
}
