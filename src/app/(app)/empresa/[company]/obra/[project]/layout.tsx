import { getProjectContext } from "@/lib/session";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  // Valida acceso a la obra (RLS + membresía). Si no tiene acceso, notFound/redirect.
  await getProjectContext(company, project);
  return children;
}
