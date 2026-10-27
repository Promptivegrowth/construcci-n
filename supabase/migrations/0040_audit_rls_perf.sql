-- 0040 · Trazabilidad: política RLS por conjuntos (evita evaluar funciones por fila) + índice de consulta
create index if not exists audit_log_company_changed_idx on public.audit_log (company_id, changed_at desc, id desc);

create or replace function public.my_audit_companies() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.companies c where public.is_holding_admin()
  union
  select cm.company_id from public.company_members cm
  where cm.user_id = auth.uid() and cm.role in ('gerente_general', 'gerente_proyectos', 'contabilidad')
$$;

create or replace function public.my_projects() returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.projects p where public.is_holding_admin()
  union
  select p.id from public.projects p
  join public.company_members cm on cm.company_id = p.company_id and cm.user_id = auth.uid()
  where cm.all_projects or exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid())
$$;

grant execute on function public.my_audit_companies() to authenticated;
grant execute on function public.my_projects() to authenticated;

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (
  company_id in (select public.my_audit_companies())
  and (project_id is null or project_id in (select public.my_projects()))
);
