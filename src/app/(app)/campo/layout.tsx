import type { Metadata, Viewport } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CompanyLogo } from "@/components/brand";
import { ServiceWorkerRegister } from "@/components/ui/cfg-sw-register";
import { Avatar } from "@/components/ui/primitives";
import { getSession } from "@/lib/session";
import { ConnectionPill } from "./_components/connection-pill";

export const metadata: Metadata = { title: "App de campo", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#062A4D" };

export default async function CampoLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const home = s.memberships[0] ? `/empresa/${s.memberships[0].company.code}` : "/empresas";
  return (
    <div className="min-h-dvh bg-surface">
      <ServiceWorkerRegister />
      <header className="sticky top-0 z-30 bg-navy-900 pt-[env(safe-area-inset-top)] text-white shadow-lg shadow-navy-900/20">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href={s.isHolding ? "/empresas" : home} className="grid h-9 w-9 place-items-center rounded-xl text-white/70 hover:bg-white/10" aria-label="Volver a la plataforma web">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <CompanyLogo logoKey={s.isHolding ? "holding" : s.memberships[0]?.company.logo_key} dark className="h-8 max-w-[170px]" priority />
            <p className="sr-only">App de campo</p>
          </div>
          <ConnectionPill />
          <Avatar name={s.profile.full_name} color={s.profile.avatar_color} size={32} className="ring-white/20" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">{children}</main>
    </div>
  );
}
