-- 0007 · El residente también rinde la caja de obra (solicita fondos y registra sus egresos)
drop policy cash_movements_insert on public.cash_movements;
drop policy cash_movements_update on public.cash_movements;
create policy cash_movements_insert on public.cash_movements for insert to authenticated
  with check (public.has_project_role(project_id, '{contabilidad,administrador,gerente_proyectos,residente}') and public.project_writable(project_id));
create policy cash_movements_update on public.cash_movements for update to authenticated
  using (public.has_project_role(project_id, '{contabilidad,administrador,gerente_proyectos,residente}') and public.project_writable(project_id))
  with check (public.has_project_role(project_id, '{contabilidad,administrador,gerente_proyectos,residente}'));
