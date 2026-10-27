-- =====================================================================
-- 0002 · Lógica de negocio: cálculos, correlativos, validaciones,
-- auditoría, vistas de control presupuestal y alertas
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfil automático al crear un usuario de Auth
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, position, phone, dni, avatar_color, is_holding_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'position',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'dni',
    new.raw_user_meta_data ->> 'avatar_color',
    coalesce((new.raw_user_meta_data ->> 'is_holding_admin')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Semana de obra (relativa al inicio del proyecto)
-- ---------------------------------------------------------------------
create or replace function public.project_week(p_project uuid, p_date date) returns int
language sql stable as $$
  select greatest(1, ((p_date - coalesce(start_date, p_date)) / 7) + 1)::int
  from public.projects where id = p_project
$$;

-- ---------------------------------------------------------------------
-- Comprobantes: IGV, tipo de cambio, fondo de garantía, correlativo
-- ---------------------------------------------------------------------
create or replace function public.expense_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tc numeric;
  closed boolean;
  invoiced numeric;
  order_base numeric;
begin
  if new.currency = 'USD' then
    tc := coalesce(nullif(new.exchange_rate, 0), 3.75);
  else
    tc := 1;
    new.exchange_rate := 1;
  end if;

  -- IGV: solo la factura gravada separa base e IGV (crédito fiscal). Boletas, recibos
  -- por honorarios, tickets y planillas se cargan por su importe total.
  if new.doc_type = 'FT' and new.tax_condition = 'gravado' then
    new.subtotal := round(new.total / 1.18, 2);
    new.igv := new.total - new.subtotal;
  else
    new.subtotal := new.total;
    new.igv := 0;
  end if;

  new.total_pen := round(new.total * tc, 2);
  new.cost_pen := round(new.subtotal * tc, 2);
  new.retention_pen := round(new.total_pen * coalesce(new.retention_pct, 0) / 100, 2);
  new.payable_pen := new.total_pen - new.retention_pen;
  new.updated_at := now();

  if new.week is null then
    new.week := public.project_week(new.project_id, new.issue_date);
  end if;

  if tg_op = 'INSERT' then
    if new.seq is null then
      select coalesce(max(seq), 0) + 1 into new.seq from public.expenses where project_id = new.project_id;
    end if;
    if new.status <> 'borrador' and new.declared_at is null then
      new.declared_at := now();
    end if;
  end if;

  -- Periodo cerrado
  if new.status <> 'anulado' then
    select exists (
      select 1 from public.period_closures c
      where c.project_id = new.project_id and new.issue_date between c.period_start and c.period_end
    ) into closed;
    if closed and (tg_op = 'INSERT' or old.total is distinct from new.total or old.issue_date is distinct from new.issue_date
                   or old.wbs_id is distinct from new.wbs_id) then
      raise exception 'PERIODO_CERRADO: el periodo del % está cerrado; solicite autorización a Gerencia', new.issue_date;
    end if;
  end if;

  -- Factura que excede el saldo de su O/S u O/C
  if new.order_id is not null and new.status <> 'anulado' and not new.order_override then
    select subtotal_pen into order_base from public.orders where id = new.order_id;
    select coalesce(sum(cost_pen), 0) into invoiced from public.expenses
      where order_id = new.order_id and status <> 'anulado' and id <> new.id;
    if invoiced + new.cost_pen > order_base + 0.5 then
      raise exception 'ORDEN_EXCEDIDA: el comprobante (S/ %) excede el saldo de la orden (S/ %)',
        new.cost_pen, greatest(order_base - invoiced, 0);
    end if;
  end if;

  return new;
end $$;

create trigger expenses_before_write before insert or update on public.expenses
  for each row execute function public.expense_before_write();

-- Asignación por defecto al WBS principal; si hay una sola, se mantiene sincronizada
create or replace function public.expense_sync_allocation() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.wbs_id is null then return null; end if;
  select count(*) into n from public.expense_allocations where expense_id = new.id;
  if n = 0 then
    insert into public.expense_allocations (expense_id, wbs_id, amount_pen) values (new.id, new.wbs_id, new.cost_pen);
  elsif n = 1 and (tg_op = 'UPDATE' and (old.cost_pen is distinct from new.cost_pen or old.wbs_id is distinct from new.wbs_id)) then
    update public.expense_allocations set amount_pen = new.cost_pen, wbs_id = new.wbs_id where expense_id = new.id;
  end if;
  return null;
end $$;

create trigger expenses_after_write after insert or update on public.expenses
  for each row execute function public.expense_sync_allocation();

-- ---------------------------------------------------------------------
-- Pagos / amortizaciones
-- ---------------------------------------------------------------------
create or replace function public.payment_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e public.expenses;
  already numeric;
begin
  select * into e from public.expenses where id = new.expense_id;
  if e.id is null then raise exception 'Comprobante no encontrado'; end if;
  if e.status not in ('aprobado', 'pagado_parcial') then
    raise exception 'PAGO_NO_PERMITIDO: el comprobante está en estado % y requiere aprobación previa', e.status;
  end if;
  select coalesce(sum(amount_pen), 0) into already from public.payments where expense_id = e.id and not voided;
  if already + new.amount_pen > e.payable_pen + 0.01 then
    raise exception 'PAGO_EXCEDIDO: la suma de amortizaciones (S/ %) supera el monto a pagar (S/ %)',
      already + new.amount_pen, e.payable_pen;
  end if;
  new.company_id := e.company_id;
  new.project_id := e.project_id;
  new.percentage := case when e.payable_pen > 0 then round(new.amount_pen / e.payable_pen * 100, 2) else 100 end;
  return new;
end $$;

create trigger payments_before_insert before insert on public.payments
  for each row execute function public.payment_before_insert();

create or replace function public.payment_refresh_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  eid uuid := coalesce(new.expense_id, old.expense_id);
  paid numeric;
  payable numeric;
  st public.expense_status;
begin
  select coalesce(sum(amount_pen), 0) into paid from public.payments where expense_id = eid and not voided;
  select payable_pen, status into payable, st from public.expenses where id = eid;
  if st in ('anulado', 'borrador', 'declarado', 'observado') then return null; end if;
  update public.expenses set status = case
      when paid >= payable - 0.01 and payable > 0 then 'pagado'::public.expense_status
      when paid > 0 then 'pagado_parcial'::public.expense_status
      else 'aprobado'::public.expense_status end
    where id = eid;
  return null;
end $$;

create trigger payments_after_change after insert or update or delete on public.payments
  for each row execute function public.payment_refresh_status();

-- ---------------------------------------------------------------------
-- Órdenes: correlativo OS-0001 / OC-0001 por obra y montos
-- ---------------------------------------------------------------------
create or replace function public.order_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare tc numeric;
begin
  tc := case when new.currency = 'USD' then coalesce(nullif(new.exchange_rate, 0), 3.75) else 1 end;
  if new.includes_igv then
    new.subtotal := round(new.total / 1.18, 2);
    new.igv := new.total - new.subtotal;
  else
    new.subtotal := new.total;
    new.igv := 0;
  end if;
  new.subtotal_pen := round(new.subtotal * tc, 2);
  if tg_op = 'INSERT' and new.seq is null then
    select coalesce(max(seq), 0) + 1 into new.seq from public.orders
      where project_id = new.project_id and order_type = new.order_type;
  end if;
  if new.number is null then
    new.number := new.order_type || '-' || lpad(new.seq::text, 4, '0');
  end if;
  return new;
end $$;

create trigger orders_before_write before insert or update on public.orders
  for each row execute function public.order_before_write();

create or replace function public.fund_request_seq() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.seq is null then
    select coalesce(max(seq), 0) + 1 into new.seq from public.fund_requests where project_id = new.project_id;
  end if;
  return new;
end $$;

create trigger fund_requests_seq before insert on public.fund_requests
  for each row execute function public.fund_request_seq();

-- ---------------------------------------------------------------------
-- Almacén: costo promedio y validación de stock
-- ---------------------------------------------------------------------
create or replace function public.stock_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  stock numeric;
  avg_cost numeric;
begin
  select coalesce(sum(case when movement_type = 'salida' then -quantity else quantity end), 0)
    into stock from public.stock_movements
    where project_id = new.project_id and material_id = new.material_id;

  if new.movement_type = 'salida' then
    if new.quantity > stock + 0.0001 then
      raise exception 'STOCK_INSUFICIENTE: stock disponible % y se intenta retirar %', stock, new.quantity;
    end if;
    select case when sum(quantity) > 0 then sum(total_cost) / sum(quantity) else 0 end into avg_cost
      from public.stock_movements
      where project_id = new.project_id and material_id = new.material_id and movement_type = 'ingreso';
    new.unit_cost := round(coalesce(avg_cost, 0), 4);
  end if;
  new.total_cost := round(abs(new.quantity) * new.unit_cost, 2);
  return new;
end $$;

create trigger stock_before_insert before insert on public.stock_movements
  for each row execute function public.stock_before_insert();

-- ---------------------------------------------------------------------
-- Presupuesto: un nodo con hijos deja de ser hoja
-- ---------------------------------------------------------------------
create or replace function public.wbs_mark_parent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is not null then
    update public.wbs_nodes set is_leaf = false where id = new.parent_id and is_leaf;
  end if;
  return null;
end $$;

create trigger wbs_after_insert after insert on public.wbs_nodes
  for each row execute function public.wbs_mark_parent();

-- Cambio de presupuesto versionado
create or replace function public.apply_budget_change(
  p_wbs uuid, p_type text, p_amount numeric, p_reason text
) returns public.budget_changes
language plpgsql security invoker set search_path = public as $$
declare
  w public.wbs_nodes;
  r public.budget_changes;
begin
  select * into w from public.wbs_nodes where id = p_wbs;
  if w.id is null then raise exception 'WBS no encontrado'; end if;
  if not w.is_leaf then raise exception 'Solo se modifica el presupuesto de un WBS de último nivel'; end if;
  if w.budget + p_amount < 0 then raise exception 'El presupuesto no puede quedar negativo'; end if;
  update public.wbs_nodes set budget = budget + p_amount where id = p_wbs;
  insert into public.budget_changes (project_id, wbs_id, change_type, amount, previous_budget, new_budget, reason, created_by)
    values (w.project_id, p_wbs, p_type, p_amount, w.budget, w.budget + p_amount, p_reason, auth.uid())
    returning * into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Auditoría inalterable
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  cid uuid;
  pid uuid;
  actor uuid;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  cid := nullif(rec ->> 'company_id', '')::uuid;
  pid := case when tg_table_name = 'projects' then (rec ->> 'id')::uuid else nullif(rec ->> 'project_id', '')::uuid end;
  if cid is null and pid is not null then
    select company_id into cid from public.projects where id = pid;
  end if;
  actor := coalesce(
    auth.uid(),
    nullif(rec ->> 'approved_by', '')::uuid,
    nullif(rec ->> 'registered_by', '')::uuid,
    nullif(rec ->> 'created_by', '')::uuid,
    nullif(rec ->> 'requested_by', '')::uuid,
    nullif(rec ->> 'delivered_by', '')::uuid
  );
  insert into public.audit_log (company_id, project_id, table_name, record_id, action, old_data, new_data, changed_by)
  values (
    cid, pid, tg_table_name, rec ->> 'id', tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    actor
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'projects', 'wbs_nodes', 'budget_changes', 'expenses', 'payments', 'orders', 'fund_requests',
    'stock_movements', 'payrolls', 'valuations', 'collections', 'equipment_assignments',
    'company_members', 'period_closures', 'project_documents'
  ] loop
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Vistas de control (respetan RLS del usuario que consulta)
-- ---------------------------------------------------------------------
create view public.v_expense_paid with (security_invoker = true) as
select
  e.id as expense_id,
  e.project_id,
  coalesce(sum(p.amount_pen) filter (where not p.voided), 0)::numeric(14, 2) as paid_pen,
  count(p.id) filter (where not p.voided) as payments_count,
  max(p.paid_at) filter (where not p.voided) as last_paid_at
from public.expenses e
left join public.payments p on p.expense_id = e.id
group by e.id;

create view public.v_wbs_stats with (security_invoker = true) as
with alloc as (
  select
    a.wbs_id, e.status, e.origin, a.amount_pen,
    case when e.payable_pen > 0 then least(coalesce(vp.paid_pen, 0) / e.payable_pen, 1) else 0 end as ratio
  from public.expense_allocations a
  join public.expenses e on e.id = a.expense_id
  left join public.v_expense_paid vp on vp.expense_id = e.id
  where e.status not in ('borrador', 'anulado')
), agg as (
  select
    wbs_id,
    sum(amount_pen) filter (where origin <> 'lima') as declared,
    sum(amount_pen) as registered,
    sum(amount_pen) filter (where status in ('aprobado', 'pagado_parcial', 'pagado')) as approved,
    sum(amount_pen) filter (where status in ('declarado', 'observado')) as pending_approval,
    sum(amount_pen * ratio) as paid,
    count(*) as docs
  from alloc group by wbs_id
), inv as (
  select order_id, sum(cost_pen) as invoiced
  from public.expenses where status <> 'anulado' and order_id is not null group by order_id
), comm as (
  select o.wbs_id, sum(greatest(o.subtotal_pen - coalesce(inv.invoiced, 0), 0)) as committed
  from public.orders o left join inv on inv.order_id = o.id
  where o.status = 'aprobada' and o.wbs_id is not null
  group by o.wbs_id
)
select
  w.id as wbs_id, w.project_id, w.parent_id, w.code, w.name, w.level, w.phase_id, w.cost_type,
  w.budget, w.margin, w.is_leaf, w.sort,
  coalesce(a.declared, 0)::numeric(14, 2) as declared,
  coalesce(a.registered, 0)::numeric(14, 2) as registered,
  coalesce(a.approved, 0)::numeric(14, 2) as approved,
  coalesce(a.pending_approval, 0)::numeric(14, 2) as pending_approval,
  coalesce(a.paid, 0)::numeric(14, 2) as paid,
  coalesce(a.docs, 0)::int as docs,
  coalesce(c.committed, 0)::numeric(14, 2) as committed
from public.wbs_nodes w
left join agg a on a.wbs_id = w.id
left join comm c on c.wbs_id = w.id;

create view public.v_order_balance with (security_invoker = true) as
select
  o.id as order_id, o.project_id,
  coalesce(sum(e.cost_pen) filter (where e.status <> 'anulado'), 0)::numeric(14, 2) as invoiced_pen,
  coalesce(sum(vp.paid_pen * case when e.payable_pen > 0 then e.cost_pen / e.payable_pen else 0 end)
    filter (where e.status <> 'anulado'), 0)::numeric(14, 2) as paid_pen,
  count(e.id) filter (where e.status <> 'anulado') as invoices
from public.orders o
left join public.expenses e on e.order_id = o.id
left join public.v_expense_paid vp on vp.expense_id = e.id
group by o.id;

create view public.v_stock with (security_invoker = true) as
select
  sm.project_id, sm.material_id,
  sum(case when sm.movement_type = 'salida' then -sm.quantity else sm.quantity end)::numeric(14, 3) as stock,
  coalesce(sum(sm.quantity) filter (where sm.movement_type = 'ingreso'), 0)::numeric(14, 3) as qty_in,
  coalesce(sum(sm.total_cost) filter (where sm.movement_type = 'ingreso'), 0)::numeric(14, 2) as cost_in,
  coalesce(sum(sm.quantity) filter (where sm.movement_type = 'salida'), 0)::numeric(14, 3) as qty_out,
  coalesce(sum(sm.total_cost) filter (where sm.movement_type = 'salida'), 0)::numeric(14, 2) as cost_out,
  max(sm.moved_at) as last_movement
from public.stock_movements sm
group by sm.project_id, sm.material_id;

create view public.v_cash_box_balance with (security_invoker = true) as
select
  b.id as box_id, b.project_id,
  coalesce(sum(m.amount) filter (where m.movement_type = 'ingreso'), 0)::numeric(14, 2) as income,
  coalesce(sum(m.amount) filter (where m.movement_type = 'egreso'), 0)::numeric(14, 2) as outcome,
  (coalesce(sum(m.amount) filter (where m.movement_type = 'ingreso'), 0)
   - coalesce(sum(m.amount) filter (where m.movement_type = 'egreso'), 0))::numeric(14, 2) as balance
from public.cash_boxes b
left join public.cash_movements m on m.box_id = b.id
group by b.id;

-- ---------------------------------------------------------------------
-- Alertas automáticas por obra
-- ---------------------------------------------------------------------
create or replace function public.upsert_alert(
  p_company uuid, p_project uuid, p_type text, p_severity text, p_title text, p_message text,
  p_entity_type text, p_entity uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.alerts where project_id is not distinct from p_project and alert_type = p_type
             and entity_id is not distinct from p_entity and not resolved) then
    update public.alerts set message = p_message, severity = p_severity, title = p_title
      where project_id is not distinct from p_project and alert_type = p_type
        and entity_id is not distinct from p_entity and not resolved;
  else
    insert into public.alerts (company_id, project_id, alert_type, severity, title, message, entity_type, entity_id)
      values (p_company, p_project, p_type, p_severity, p_title, p_message, p_entity_type, p_entity);
  end if;
end $$;

create or replace function public.refresh_project_alerts(p_project uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
  r record;
  pct numeric;
  elapsed numeric;
  n int := 0;
  fin date;
begin
  select * into p from public.projects where id = p_project;
  if p.id is null then return 0; end if;
  if auth.uid() is not null and not public.can_access_project(p_project) then
    raise exception 'Sin acceso a la obra';
  end if;

  fin := coalesce(p.extended_end_date, p.end_date);
  elapsed := case when p.start_date is null or fin is null or fin <= p.start_date then 0
              else least(greatest((current_date - p.start_date)::numeric / (fin - p.start_date), 0), 1) end;

  for r in
    select s.*, (select string_agg(x.name, ' › ') from public.wbs_nodes x where x.id = s.parent_id) as parent_name
    from public.v_wbs_stats s where s.project_id = p_project and s.is_leaf and s.budget > 0
  loop
    pct := r.paid / r.budget;
    if pct >= 1 then
      perform public.upsert_alert(p.company_id, p.id, 'sobrecosto', 'danger',
        r.code || ' · ' || r.name || ' excedió su presupuesto',
        format('Pagado S/ %s de S/ %s proyectados (%s%%). Sobrecosto de S/ %s.',
          to_char(r.paid, 'FM999G999G990D00'), to_char(r.budget, 'FM999G999G990D00'), round(pct * 100, 1),
          to_char(r.paid - r.budget, 'FM999G999G990D00')), 'wbs', r.wbs_id);
      update public.alerts set resolved = true, resolved_at = now()
        where entity_id = r.wbs_id and alert_type = 'consumo_80' and not resolved;
      n := n + 1;
    elsif pct * 100 >= p.alert_threshold then
      perform public.upsert_alert(p.company_id, p.id, 'consumo_80', 'warning',
        r.code || ' · ' || r.name || ' llegó al ' || round(pct * 100) || '%',
        format('Saldo disponible S/ %s de S/ %s proyectados.',
          to_char(r.budget - r.paid, 'FM999G999G990D00'), to_char(r.budget, 'FM999G999G990D00')), 'wbs', r.wbs_id);
      n := n + 1;
    else
      update public.alerts set resolved = true, resolved_at = now()
        where entity_id = r.wbs_id and alert_type in ('consumo_80', 'sobrecosto') and not resolved;
    end if;

    if p.status = 'ejecucion' and pct >= 0.25 and pct < 1 and pct > elapsed + 0.15 then
      perform public.upsert_alert(p.company_id, p.id, 'ritmo', 'info',
        r.code || ' gasta más rápido que el plazo',
        format('Consumido %s%% con %s%% del plazo transcurrido.', round(pct * 100), round(elapsed * 100)), 'wbs', r.wbs_id);
      n := n + 1;
    end if;

    if r.paid > r.declared + 1 and r.declared > 0 then
      perform public.upsert_alert(p.company_id, p.id, 'diferencia', 'warning',
        r.code || ' · Revisar diferencias Obra vs. Contabilidad',
        format('Contabilidad pagó S/ %s más de lo declarado por la obra.', to_char(r.paid - r.declared, 'FM999G999G990D00')),
        'wbs', r.wbs_id);
      n := n + 1;
    end if;
  end loop;

  -- Documentos de obra por vencer (30 días)
  for r in select * from public.project_documents
           where project_id = p_project and expiry_date is not null and expiry_date <= current_date + 30
  loop
    perform public.upsert_alert(p.company_id, p.id, 'documento',
      case when r.expiry_date < current_date then 'danger' else 'warning' end,
      r.title || case when r.expiry_date < current_date then ' vencida' else ' por vencer' end,
      format('Vence el %s.', to_char(r.expiry_date, 'DD/MM/YYYY')), 'document', r.id);
    n := n + 1;
  end loop;

  -- Comprobantes aprobados por vencer o vencidos sin pagar
  update public.alerts a set resolved = true, resolved_at = now()
    from public.expenses e
    where a.entity_id = e.id and a.alert_type = 'vencimiento' and not a.resolved
      and a.project_id = p_project and e.status in ('pagado', 'anulado');
  for r in
    select e.id, e.series, e.doc_number, e.due_date, e.payable_pen - coalesce(vp.paid_pen, 0) as balance, s.name as supplier
    from public.expenses e
    left join public.v_expense_paid vp on vp.expense_id = e.id
    left join public.suppliers s on s.id = e.supplier_id
    where e.project_id = p_project and e.status in ('aprobado', 'pagado_parcial')
      and e.due_date is not null and e.due_date <= current_date + 5
  loop
    perform public.upsert_alert(p.company_id, p.id, 'vencimiento',
      case when r.due_date < current_date then 'danger' else 'warning' end,
      coalesce(r.supplier, 'Proveedor') || ' · ' || coalesce(r.series || '-', '') || coalesce(r.doc_number, ''),
      format('Saldo S/ %s %s el %s.', to_char(r.balance, 'FM999G999G990D00'),
        case when r.due_date < current_date then 'vencido' else 'vence' end, to_char(r.due_date, 'DD/MM/YYYY')),
      'expense', r.id);
    n := n + 1;
  end loop;

  -- Stock bajo el mínimo
  for r in
    select m.id, m.name, m.unit, m.min_stock, v.stock from public.v_stock v
    join public.materials m on m.id = v.material_id
    where v.project_id = p_project and m.min_stock > 0 and v.stock < m.min_stock
  loop
    perform public.upsert_alert(p.company_id, p.id, 'stock', 'info',
      r.name || ' bajo stock mínimo',
      format('Stock %s %s (mínimo %s).', round(r.stock, 2), r.unit, round(r.min_stock, 2)), 'material', r.id);
    n := n + 1;
  end loop;

  return n;
end $$;
