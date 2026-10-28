import { ArrowLeft, ShieldOff } from "lucide-react";
import { ROLE_LABEL, VIEW_LABEL, type Role, type ViewArea } from "@/lib/permissions";
import { ButtonLink, EmptyState } from "./primitives";

/** Se muestra en lugar de la página cuando el rol no puede ver esa área (aunque la URL se escriba a mano). */
export function NoAccess({ role, area, what, back, backLabel = "Volver" }: { role: Role; area?: ViewArea; what?: string; back: string; backLabel?: string }) {
  return (
    <EmptyState className="mx-auto mt-10 max-w-xl py-16" icon={<ShieldOff className="h-7 w-7" />}
      title="Sin acceso a esta sección"
      description={<>Tu rol (<b>{ROLE_LABEL[role]}</b>) no tiene acceso a {what ?? (area ? VIEW_LABEL[area] : "esta sección")}. Si lo necesitas, solicítalo a Gerencia General.</>}
      action={<ButtonLink href={back} variant="outline"><ArrowLeft className="h-4 w-4" />{backLabel}</ButtonLink>} />
  );
}
