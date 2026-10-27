-- =====================================================================
-- 0003 · Seguridad multiempresa: RLS por empresa, obra y rol + Storage
-- =====================================================================

create or replace function public.is_holding_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_holding_admin from public.profiles where id = auth.uid() and active), false)
$$;

create or replace function public.is_company_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_holding_admin()
      or exists (select 1 from public.company_members where company_id = cid and user_id = auth.uid())
$$;

create or replace function public.company_role(cid uuid) returns public.app_role
language sql stable security definer set search_path = public as $$
  select case when public.is_holding_admin() then 'gerente_general'::public.app_role
              else (select role from public.company_members where company_id = cid and user_id = auth.uid()) end
$$;

create or replace function public.can_access_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_holding_admin() or exists (
    select 1 from public.projects p
    join public.company_members cm on cm.company_id = p.company_id and cm.user_id = auth.uid()
    where p.id = pid
      and (cm.all_projects or exists (
        select 1 from public.project_members pm where pm.project_id = pid and pm.user_id = auth.uid()))
  )
$$;

create or replace function public.project_role(pid uuid) returns public.app_role
language sql stable security definer set search_path = public as $$
  select public.company_role((select company_id from public.projects where id = pid))
$$;

create or replace function public.has_project_role(pid uuid, roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_access_project(pid) and public.project_role(pid) = any (roles)
$$;

create or replace function public.has_company_role(cid uuid, roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_company_member(cid) and public.company_role(cid) = any (roles)
$$;

-- Una obra cerrada queda en solo lectura
create or replace function public.project_writable(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status <> 'cerrada' from public.projects where id = pid), false)
$$;

-- ---------------------------------------------------------------------
-- Activar RLS en todas las tablas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Empresas: visibles para todo usuario autenticado (el selector muestra las bloqueadas)
create policy companies_read on public.companies for select to authenticated using (true);
create policy companies_admin on public.companies for all to authenticated
  using (public.is_holding_admin()) with check (public.is_holding_admin());

-- Perfiles: el propio, los de empresas compartidas y todos para Gerencia General
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_holding_admin() or exists (
    select 1 from public.company_members a join public.company_members b on a.company_id = b.company_id
    where a.user_id = auth.uid() and b.user_id = profiles.id)
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_holding_admin())
  with check (id = auth.uid() or public.is_holding_admin());

create policy members_read on public.company_members for select to authenticated
  using (user_id = auth.uid() or public.is_company_member(company_id));
create policy members_admin on public.company_members for all to authenticated
  using (public.is_holding_admin()) with check (public.is_holding_admin());

create policy project_members_read on public.project_members for select to authenticated
  using (public.can_access_project(project_id));
create policy project_members_admin on public.project_members for all to authenticated
  using (public.is_holding_admin()) with check (public.is_holding_admin());

-- Obras
create policy projects_read on public.projects for select to authenticated
  using (public.can_access_project(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.has_company_role(company_id, '{gerente_general,gerente_proyectos}'));
create policy projects_update on public.projects for update to authenticated
  using (public.has_project_role(id, '{gerente_general,gerente_proyectos}'))
  with check (public.has_project_role(id, '{gerente_general,gerente_proyectos}'));

-- Helper para políticas estándar por obra
create or replace function pg_temp.project_policies(tbl text, write_roles text) returns void
language plpgsql as $$
begin
  execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.can_access_project(project_id))', tbl);
  execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.has_project_role(project_id, %2$L) and public.project_writable(project_id))', tbl, write_roles);
  execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.has_project_role(project_id, %2$L) and public.project_writable(project_id)) with check (public.has_project_role(project_id, %2$L))', tbl, write_roles);
  execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.has_project_role(project_id, %2$L) and public.project_writable(project_id))', tbl, write_roles);
end $$;

select pg_temp.project_policies('project_documents', '{gerente_general,gerente_proyectos,administrador}');
select pg_temp.project_policies('phases', '{gerente_general,gerente_proyectos}');
select pg_temp.project_policies('wbs_nodes', '{gerente_general,gerente_proyectos}');
select pg_temp.project_policies('labor_projections', '{gerente_general,gerente_proyectos}');
select pg_temp.project_policies('period_closures', '{gerente_general,gerente_proyectos}');
select pg_temp.project_policies('orders', '{gerente_general,gerente_proyectos,residente,administrador,almacen}');
select pg_temp.project_policies('expenses', '{gerente_general,gerente_proyectos,residente,administrador,contabilidad}');
select pg_temp.project_policies('payments', '{contabilidad}');
select pg_temp.project_policies('payrolls', '{contabilidad,administrador,gerente_proyectos}');
select pg_temp.project_policies('cash_boxes', '{gerente_general,gerente_proyectos,contabilidad}');
select pg_temp.project_policies('cash_movements', '{contabilidad,administrador,gerente_proyectos}');
select pg_temp.project_policies('fund_requests', '{gerente_general,gerente_proyectos,residente,administrador,contabilidad}');
select pg_temp.project_policies('valuations', '{gerente_general,gerente_proyectos,contabilidad}');
select pg_temp.project_policies('collections', '{contabilidad}');
select pg_temp.project_policies('stock_movements', '{administrador,almacen,gerente_proyectos}');
select pg_temp.project_policies('equipment_assignments', '{administrador,almacen,gerente_proyectos}');

-- Presupuesto versionado: solo lectura e inserción (historial)
create policy budget_changes_read on public.budget_changes for select to authenticated
  using (public.can_access_project(project_id));
create policy budget_changes_insert on public.budget_changes for insert to authenticated
  with check (public.has_project_role(project_id, '{gerente_general,gerente_proyectos}'));

-- Tablas hijas que heredan el acceso del comprobante / orden / planilla
create policy expense_allocations_read on public.expense_allocations for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and public.can_access_project(e.project_id)));
create policy expense_allocations_write on public.expense_allocations for all to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id
    and public.has_project_role(e.project_id, '{gerente_general,gerente_proyectos,residente,administrador,contabilidad}')))
  with check (exists (select 1 from public.expenses e where e.id = expense_id
    and public.has_project_role(e.project_id, '{gerente_general,gerente_proyectos,residente,administrador,contabilidad}')));

create policy expense_files_read on public.expense_files for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and public.can_access_project(e.project_id)));
create policy expense_files_write on public.expense_files for insert to authenticated
  with check (exists (select 1 from public.expenses e where e.id = expense_id and public.can_access_project(e.project_id)));

create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.can_access_project(o.project_id)));
create policy order_items_write on public.order_items for all to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and public.has_project_role(o.project_id, '{gerente_general,gerente_proyectos,residente,administrador,almacen}')))
  with check (exists (select 1 from public.orders o where o.id = order_id
    and public.has_project_role(o.project_id, '{gerente_general,gerente_proyectos,residente,administrador,almacen}')));

create policy payroll_lines_read on public.payroll_lines for select to authenticated
  using (exists (select 1 from public.payrolls p where p.id = payroll_id and public.can_access_project(p.project_id)));
create policy payroll_lines_write on public.payroll_lines for all to authenticated
  using (exists (select 1 from public.payrolls p where p.id = payroll_id
    and public.has_project_role(p.project_id, '{contabilidad,administrador,gerente_proyectos}')))
  with check (exists (select 1 from public.payrolls p where p.id = payroll_id
    and public.has_project_role(p.project_id, '{contabilidad,administrador,gerente_proyectos}')));

-- Catálogos por empresa
create policy suppliers_read on public.suppliers for select to authenticated using (public.is_company_member(company_id));
create policy suppliers_write on public.suppliers for insert to authenticated with check (public.is_company_member(company_id));
create policy suppliers_update on public.suppliers for update to authenticated
  using (public.has_company_role(company_id, '{gerente_general,gerente_proyectos,administrador,contabilidad}'));

create policy materials_read on public.materials for select to authenticated using (public.is_company_member(company_id));
create policy materials_write on public.materials for all to authenticated
  using (public.has_company_role(company_id, '{gerente_general,gerente_proyectos,administrador,almacen}'))
  with check (public.has_company_role(company_id, '{gerente_general,gerente_proyectos,administrador,almacen}'));

create policy equipment_read on public.equipment for select to authenticated using (public.is_company_member(company_id));
create policy equipment_write on public.equipment for all to authenticated
  using (public.has_company_role(company_id, '{gerente_general,gerente_proyectos,administrador,almacen}'))
  with check (public.has_company_role(company_id, '{gerente_general,gerente_proyectos,administrador,almacen}'));

-- Asistencia: cada usuario marca la suya
create policy attendance_read on public.attendance for select to authenticated using (public.can_access_project(project_id));
create policy attendance_insert on public.attendance for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_project(project_id));

-- Alertas
create policy alerts_read on public.alerts for select to authenticated using (
  case when project_id is null then public.is_company_member(company_id) else public.can_access_project(project_id) end);
create policy alerts_update on public.alerts for update to authenticated using (
  public.has_company_role(company_id, '{gerente_general,gerente_proyectos,administrador,contabilidad}'));

-- Auditoría: solo lectura (las inserciones las hace el trigger)
create policy audit_read on public.audit_log for select to authenticated using (
  public.has_company_role(company_id, '{gerente_general,gerente_proyectos,contabilidad}')
  and (project_id is null or public.can_access_project(project_id))
);

-- ---------------------------------------------------------------------
-- Permisos de las API roles
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
revoke insert, update, delete on public.audit_log from authenticated;

-- ---------------------------------------------------------------------
-- Storage privado para comprobantes, guías, fotos, contratos y fianzas
-- Ruta: {company_id}/{project_id}/{tipo}/{archivo}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy evidencias_read on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and public.is_company_member(((storage.foldername(name))[1])::uuid));
create policy evidencias_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and public.is_company_member(((storage.foldername(name))[1])::uuid));
