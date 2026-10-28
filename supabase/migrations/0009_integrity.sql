-- =====================================================================
-- 0009 · Integridad: los ciclos de estado se validan en la base de datos (no solo en los botones),
-- la caja de obra salda sus comprobantes, la importación de presupuesto es atómica y el cierre de
-- periodo cubre todo lo que mueve cifras de un mes cerrado.
--
-- Las reglas aplican a escrituras directas de un usuario (incluidas llamadas a la API con su sesión).
-- Las escrituras que hacen los propios triggers (p. ej. el estado de pago que actualiza un pago) y las
-- del rol de servicio (seed, cron) no pasan por estas validaciones.
-- =====================================================================

create or replace function public.direct_write() returns boolean
language sql stable as $$
  select auth.uid() is not null and pg_trigger_depth() <= 1
$$;

create or replace function public.in_closed_period(pid uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select d is not null and exists (
    select 1 from public.period_closures c where c.project_id = pid and d between c.period_start and c.period_end)
$$;

-- ---------------------------------------------------------------------
-- Comprobantes
-- ---------------------------------------------------------------------
create or replace function public.expense_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.app_role;
  approver boolean;
  fin_changed boolean;
begin
  if not public.direct_write() then return new; end if;
  r := public.project_role(new.project_id);
  approver := r in ('gerente_general', 'gerente_proyectos');

  if tg_op = 'INSERT' then
    -- Contabilidad registra aprobados los comprobantes centrales (Lima) y sus planillas
    if new.status = 'aprobado' and (approver or r = 'contabilidad') then
      new.approved_by := auth.uid();
      new.approved_at := coalesce(new.approved_at, now());
    elsif new.status not in ('borrador', 'declarado') then
      raise exception 'ESTADO_NO_PERMITIDO: un comprobante nuevo se registra como borrador o declarado';
    end if;
    return new;
  end if;

  if old.status = 'anulado' then
    raise exception 'COMPROBANTE_BLOQUEADO: el comprobante está anulado y no se modifica';
  end if;

  fin_changed := old.total is distinct from new.total or old.currency is distinct from new.currency
    or old.exchange_rate is distinct from new.exchange_rate or old.tax_condition is distinct from new.tax_condition
    or old.retention_pct is distinct from new.retention_pct or old.doc_type is distinct from new.doc_type
    or old.wbs_id is distinct from new.wbs_id or old.phase_id is distinct from new.phase_id
    or old.issue_date is distinct from new.issue_date or old.project_id is distinct from new.project_id
    or old.order_id is distinct from new.order_id or old.supplier_id is distinct from new.supplier_id;

  if fin_changed and old.status in ('aprobado', 'pagado_parcial', 'pagado') then
    raise exception 'COMPROBANTE_BLOQUEADO: un comprobante aprobado no cambia montos ni clasificación. Si tiene un error, Gerencia lo anula y se registra de nuevo';
  end if;
  if fin_changed and (public.in_closed_period(old.project_id, old.issue_date) or public.in_closed_period(new.project_id, new.issue_date)) then
    raise exception 'PERIODO_CERRADO: el comprobante pertenece a un periodo cerrado; Gerencia General debe reabrir el periodo para corregirlo';
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'borrador', 'declarado' then
        if old.status not in ('borrador', 'declarado', 'observado') then
          raise exception 'COMPROBANTE_BLOQUEADO: el comprobante ya fue aprobado; no vuelve a declararse';
        end if;
      when 'aprobado' then
        if not approver then raise exception 'ESTADO_NO_PERMITIDO: solo Gerencia aprueba comprobantes'; end if;
        if old.status <> 'declarado' then raise exception 'ESTADO_NO_PERMITIDO: solo se aprueba un comprobante declarado (está %)', old.status; end if;
        new.approved_by := auth.uid();
        new.approved_at := now();
      when 'observado' then
        if not approver then raise exception 'ESTADO_NO_PERMITIDO: solo Gerencia observa comprobantes'; end if;
        if old.status not in ('declarado', 'aprobado') then raise exception 'ESTADO_NO_PERMITIDO: un comprobante % no se observa', old.status; end if;
      when 'anulado' then
        if exists (select 1 from public.cash_movements m where m.expense_id = new.id) then
          raise exception 'ESTADO_NO_PERMITIDO: el comprobante está rendido en la caja de obra y no se anula';
        end if;
        if old.status in ('pagado_parcial', 'pagado') then
          raise exception 'ESTADO_NO_PERMITIDO: tiene pagos registrados; Contabilidad debe anularlos antes';
        end if;
        if old.status = 'aprobado' and not approver then
          raise exception 'ESTADO_NO_PERMITIDO: un comprobante aprobado solo lo anula Gerencia';
        end if;
        if public.in_closed_period(old.project_id, old.issue_date) then
          raise exception 'PERIODO_CERRADO: el comprobante pertenece a un periodo cerrado; Gerencia General debe reabrirlo para anularlo';
        end if;
        new.voided_by := auth.uid();
        new.voided_at := coalesce(new.voided_at, now());
      else
        raise exception 'ESTADO_NO_PERMITIDO: el estado de pago lo actualiza el registro de pagos de Contabilidad';
    end case;
  end if;
  return new;
end $$;

drop trigger if exists expenses_guard on public.expenses;
create trigger expenses_guard before insert or update on public.expenses
  for each row execute function public.expense_guard();

-- Distribución por WBS: solo mientras el comprobante se puede corregir
create or replace function public.allocation_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare e public.expenses;
begin
  if not public.direct_write() then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.expense_id <> old.expense_id then
    raise exception 'COMPROBANTE_BLOQUEADO: una distribución no cambia de comprobante';
  end if;
  select * into e from public.expenses where id = coalesce(new.expense_id, old.expense_id);
  if e.status not in ('borrador', 'declarado', 'observado') then
    raise exception 'COMPROBANTE_BLOQUEADO: la distribución de un comprobante % no se modifica', e.status;
  end if;
  if not public.project_writable(e.project_id) then
    raise exception 'OBRA_CERRADA: la obra está cerrada (solo lectura)';
  end if;
  if public.in_closed_period(e.project_id, e.issue_date) then
    raise exception 'PERIODO_CERRADO: el comprobante pertenece a un periodo cerrado';
  end if;
  if tg_op <> 'DELETE' and not exists (
    select 1 from public.wbs_nodes w where w.id = new.wbs_id and w.project_id = e.project_id and w.is_leaf) then
    raise exception 'COMPROBANTE_BLOQUEADO: la distribución usa partidas de último nivel de la misma obra';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists expense_allocations_guard on public.expense_allocations;
create trigger expense_allocations_guard before insert or update or delete on public.expense_allocations
  for each row execute function public.allocation_guard();

-- ---------------------------------------------------------------------
-- Pagos: no se editan ni se borran; solo se anulan (y no en un periodo cerrado)
-- ---------------------------------------------------------------------
create or replace function public.payment_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.direct_write() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    raise exception 'PAGO_NO_PERMITIDO: los pagos no se eliminan; se anulan indicando el motivo';
  end if;
  if tg_op = 'INSERT' then
    if public.in_closed_period(new.project_id, new.paid_at) then
      raise exception 'PERIODO_CERRADO: la fecha de pago % pertenece a un periodo cerrado', new.paid_at;
    end if;
    return new;
  end if;
  if new.expense_id <> old.expense_id or new.amount_pen <> old.amount_pen or new.paid_at <> old.paid_at
     or new.method <> old.method or new.project_id is distinct from old.project_id then
    raise exception 'PAGO_NO_PERMITIDO: un pago registrado no se modifica; anúlalo y registra uno nuevo';
  end if;
  if old.voided and not new.voided then
    raise exception 'PAGO_NO_PERMITIDO: un pago anulado no se reactiva';
  end if;
  if new.voided and not old.voided then
    if old.method = 'caja' then
      raise exception 'PAGO_NO_PERMITIDO: el pago con caja proviene de una rendición y no se anula desde Pagos';
    end if;
    if public.in_closed_period(old.project_id, old.paid_at) then
      raise exception 'PERIODO_CERRADO: el pago pertenece a un periodo cerrado';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists payments_guard on public.payments;
create trigger payments_guard before insert or update or delete on public.payments
  for each row execute function public.payment_guard();

-- ---------------------------------------------------------------------
-- Órdenes de servicio / compra
-- ---------------------------------------------------------------------
create or replace function public.order_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare approver boolean;
begin
  if not public.direct_write() then return new; end if;
  approver := public.project_role(new.project_id) in ('gerente_general', 'gerente_proyectos');
  if tg_op = 'INSERT' then
    if new.status = 'aprobada' and approver then
      new.approved_by := auth.uid();
      new.approved_at := coalesce(new.approved_at, now());
    elsif new.status <> 'solicitada' then
      raise exception 'ESTADO_NO_PERMITIDO: la orden se registra como solicitada; Gerencia la aprueba';
    end if;
    return new;
  end if;
  if not approver then
    raise exception 'ESTADO_NO_PERMITIDO: solo Gerencia aprueba, cierra o anula órdenes';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'solicitada' and new.status in ('aprobada', 'rechazada', 'anulada'))
         or (old.status = 'aprobada' and new.status in ('cerrada', 'anulada'))) then
      raise exception 'ESTADO_NO_PERMITIDO: una orden % no pasa a %', old.status, new.status;
    end if;
    if new.status = 'aprobada' then
      new.approved_by := auth.uid();
      new.approved_at := now();
    end if;
    if new.status = 'anulada' and exists (select 1 from public.expenses e where e.order_id = new.id and e.status <> 'anulado') then
      raise exception 'ESTADO_NO_PERMITIDO: la orden tiene comprobantes asociados y no se anula';
    end if;
  end if;
  if old.status <> 'solicitada' and (new.total is distinct from old.total or new.currency is distinct from old.currency
     or new.exchange_rate is distinct from old.exchange_rate or new.includes_igv is distinct from old.includes_igv
     or new.wbs_id is distinct from old.wbs_id or new.supplier_id is distinct from old.supplier_id) then
    raise exception 'ESTADO_NO_PERMITIDO: una orden emitida no cambia su monto, proveedor ni partida';
  end if;
  return new;
end $$;

drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before insert or update on public.orders
  for each row execute function public.order_guard();

-- ---------------------------------------------------------------------
-- Solicitudes de fondos: solicita → aprueba Gerencia → deposita Contabilidad → rinde la obra
-- ---------------------------------------------------------------------
create or replace function public.fund_request_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.app_role;
begin
  if not public.direct_write() then return new; end if;
  r := public.project_role(new.project_id);
  if tg_op = 'INSERT' then
    if new.status <> 'pendiente' then
      raise exception 'ESTADO_NO_PERMITIDO: la solicitud de fondos se registra pendiente de aprobación';
    end if;
    new.requested_by := auth.uid();
    return new;
  end if;
  if new.amount is distinct from old.amount or new.box_id is distinct from old.box_id or new.project_id is distinct from old.project_id then
    raise exception 'ESTADO_NO_PERMITIDO: la solicitud no cambia su monto ni su caja';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'pendiente' and new.status in ('aprobada', 'rechazada') then
      if r not in ('gerente_general', 'gerente_proyectos') then
        raise exception 'ESTADO_NO_PERMITIDO: solo Gerencia aprueba solicitudes de fondos';
      end if;
      new.approved_by := auth.uid();
      new.approved_at := now();
    elsif old.status = 'aprobada' and new.status = 'depositada' then
      if r <> 'contabilidad' then raise exception 'ESTADO_NO_PERMITIDO: solo Contabilidad registra depósitos'; end if;
      new.deposited_by := auth.uid();
    elsif old.status = 'depositada' and new.status = 'rendida' then
      if r not in ('administrador', 'gerente_proyectos', 'contabilidad', 'residente') then
        raise exception 'ESTADO_NO_PERMITIDO: tu rol no registra rendiciones';
      end if;
    else
      raise exception 'ESTADO_NO_PERMITIDO: una solicitud % no pasa a %', old.status, new.status;
    end if;
  elsif old.status in ('depositada', 'rendida') and (new.deposit_operation is distinct from old.deposit_operation
        or new.deposited_at is distinct from old.deposited_at or new.rendered_amount is distinct from old.rendered_amount) then
    raise exception 'ESTADO_NO_PERMITIDO: el depósito o la rendición ya fueron registrados';
  end if;
  return new;
end $$;

drop trigger if exists fund_requests_guard on public.fund_requests;
create trigger fund_requests_guard before insert or update on public.fund_requests
  for each row execute function public.fund_request_guard();

-- ---------------------------------------------------------------------
-- Caja de obra: todo movimiento sale de una solicitud; los egresos con comprobante lo saldan
-- ---------------------------------------------------------------------
create or replace function public.cash_movement_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.app_role;
  fr public.fund_requests;
  e public.expenses;
begin
  if not public.direct_write() then return coalesce(new, old); end if;
  if tg_op <> 'INSERT' then
    raise exception 'CAJA_BLOQUEADA: los movimientos de caja no se modifican ni se eliminan';
  end if;
  r := public.project_role(new.project_id);
  select * into fr from public.fund_requests where id = new.fund_request_id;
  if fr.id is null or fr.project_id <> new.project_id or fr.box_id is distinct from new.box_id then
    raise exception 'CAJA_BLOQUEADA: todo movimiento de caja corresponde a una solicitud de fondos de la obra';
  end if;
  if new.movement_type = 'ingreso' then
    if r <> 'contabilidad' then raise exception 'CAJA_BLOQUEADA: solo Contabilidad registra depósitos en caja'; end if;
    if fr.status <> 'depositada' then raise exception 'CAJA_BLOQUEADA: el depósito corresponde a una solicitud aprobada'; end if;
    if exists (select 1 from public.cash_movements m where m.fund_request_id = fr.id and m.movement_type = 'ingreso') then
      raise exception 'CAJA_BLOQUEADA: el depósito de la solicitud N° % ya fue registrado', fr.seq;
    end if;
    if new.amount <> fr.amount then raise exception 'CAJA_BLOQUEADA: el depósito debe ser igual al monto aprobado'; end if;
  else
    if r not in ('administrador', 'gerente_proyectos', 'contabilidad', 'residente') then
      raise exception 'CAJA_BLOQUEADA: tu rol no registra rendiciones';
    end if;
    if fr.status <> 'depositada' then raise exception 'CAJA_BLOQUEADA: solo se rinden solicitudes depositadas'; end if;
    if new.expense_id is not null then
      select * into e from public.expenses where id = new.expense_id;
      if e.id is null or e.project_id <> new.project_id then
        raise exception 'CAJA_BLOQUEADA: el comprobante no pertenece a la obra';
      end if;
      if e.status not in ('declarado', 'aprobado') then
        raise exception 'CAJA_BLOQUEADA: el comprobante % está % y no se rinde con caja', coalesce(e.series || '-', '') || coalesce(e.doc_number, 'S/N'), e.status;
      end if;
      if exists (select 1 from public.payments p where p.expense_id = e.id and not p.voided) then
        raise exception 'CAJA_BLOQUEADA: el comprobante % ya tiene pagos de Contabilidad', coalesce(e.series || '-', '') || coalesce(e.doc_number, 'S/N');
      end if;
      if exists (select 1 from public.cash_movements m where m.expense_id = e.id) then
        raise exception 'CAJA_BLOQUEADA: el comprobante % ya fue rendido', coalesce(e.series || '-', '') || coalesce(e.doc_number, 'S/N');
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists cash_movements_guard on public.cash_movements;
create trigger cash_movements_guard before insert or update or delete on public.cash_movements
  for each row execute function public.cash_movement_guard();

-- Registra como pagado con caja el saldo de un comprobante rendido (si ya está aprobado)
create or replace function public.settle_cash_expense(p_expense uuid, p_date date, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  e public.expenses;
  paid numeric;
begin
  select * into e from public.expenses where id = p_expense;
  if e.id is null or e.status not in ('aprobado', 'pagado_parcial') then return; end if;
  select coalesce(sum(amount_pen), 0) into paid from public.payments where expense_id = e.id and not voided;
  if e.payable_pen - paid > 0.009 then
    insert into public.payments (expense_id, paid_at, amount_pen, method, notes, registered_by)
      values (e.id, coalesce(p_date, current_date), round(e.payable_pen - paid, 2), 'caja', p_note, auth.uid());
  end if;
end $$;
revoke all on function public.settle_cash_expense(uuid, date, text) from public, anon, authenticated;

create or replace function public.cash_movement_settle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.movement_type = 'egreso' and new.expense_id is not null then
    perform public.settle_cash_expense(new.expense_id, new.moved_at,
      'Pagado con caja de obra · rendición de la solicitud N° ' || coalesce((select seq::text from public.fund_requests where id = new.fund_request_id), '—'));
  end if;
  return null;
end $$;

drop trigger if exists cash_movements_settle on public.cash_movements;
create trigger cash_movements_settle after insert on public.cash_movements
  for each row execute function public.cash_movement_settle();

-- Un comprobante rendido que Gerencia aprueba después queda pagado con caja en ese momento
create or replace function public.expense_settle_cash() returns trigger
language plpgsql security definer set search_path = public as $$
declare d date;
begin
  if new.status = 'aprobado' and old.status is distinct from 'aprobado' then
    select max(moved_at) into d from public.cash_movements where expense_id = new.id and movement_type = 'egreso';
    if d is not null then
      perform public.settle_cash_expense(new.id, d, 'Pagado con caja de obra · rendición aprobada');
    end if;
  end if;
  return null;
end $$;

drop trigger if exists expenses_settle_cash on public.expenses;
create trigger expenses_settle_cash after update of status on public.expenses
  for each row execute function public.expense_settle_cash();

-- Depósito y rendición atómicos (con bloqueo de la solicitud: dos pestañas no duplican movimientos)
create or replace function public.deposit_fund_request(p_request uuid, p_operation text, p_date date) returns int
language plpgsql security invoker set search_path = public as $$
declare
  fr public.fund_requests;
  d date := coalesce(p_date, current_date);
begin
  select * into fr from public.fund_requests where id = p_request for update;
  if fr.id is null then raise exception 'CAJA_BLOQUEADA: solicitud no encontrada'; end if;
  if fr.status <> 'aprobada' then
    raise exception 'CAJA_BLOQUEADA: la solicitud N° % está % y no se puede depositar', fr.seq, fr.status;
  end if;
  if fr.box_id is null then raise exception 'CAJA_BLOQUEADA: la solicitud no tiene caja asociada'; end if;
  update public.fund_requests set status = 'depositada', deposited_at = (d + time '12:00') at time zone 'America/Lima',
    deposit_operation = trim(p_operation) where id = fr.id;
  insert into public.cash_movements (box_id, project_id, movement_type, amount, moved_at, concept, fund_request_id, created_by)
    values (fr.box_id, fr.project_id, 'ingreso', fr.amount, d, 'Depósito solicitud N° ' || fr.seq || ' — ' || fr.reason, fr.id, auth.uid());
  return fr.seq;
end $$;

create or replace function public.render_fund_request(p_request uuid, p_expenses uuid[], p_extras jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  fr public.fund_requests;
  e record;
  x jsonb;
  amt numeric;
  total numeric := 0;
  n int;
begin
  select * into fr from public.fund_requests where id = p_request for update;
  if fr.id is null then raise exception 'CAJA_BLOQUEADA: solicitud no encontrada'; end if;
  if fr.status <> 'depositada' then
    raise exception 'CAJA_BLOQUEADA: la solicitud N° % está % y no se puede rendir', fr.seq, fr.status;
  end if;
  select count(*) into n from public.expenses where id = any (coalesce(p_expenses, '{}')) and project_id = fr.project_id;
  if n <> coalesce(cardinality(p_expenses), 0) then
    raise exception 'CAJA_BLOQUEADA: algún comprobante no pertenece a la obra';
  end if;
  for e in select id, total_pen, issue_date, description from public.expenses where id = any (coalesce(p_expenses, '{}')) loop
    insert into public.cash_movements (box_id, project_id, movement_type, amount, moved_at, concept, expense_id, fund_request_id, created_by)
      values (fr.box_id, fr.project_id, 'egreso', e.total_pen, e.issue_date, e.description, e.id, fr.id, auth.uid());
    total := total + e.total_pen;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) loop
    amt := round(coalesce(nullif(x ->> 'amount', '')::numeric, 0), 2);
    if coalesce(trim(x ->> 'concept'), '') = '' or amt <= 0 then
      raise exception 'CAJA_BLOQUEADA: cada egreso adicional necesita concepto y un monto mayor a cero';
    end if;
    insert into public.cash_movements (box_id, project_id, movement_type, amount, moved_at, concept, fund_request_id, created_by)
      values (fr.box_id, fr.project_id, 'egreso', amt, coalesce(nullif(x ->> 'date', '')::date, current_date), trim(x ->> 'concept'), fr.id, auth.uid());
    total := total + amt;
  end loop;
  if total <= 0 then raise exception 'CAJA_BLOQUEADA: agrega al menos un comprobante o egreso a la rendición'; end if;
  if total > fr.amount * 1.2 then
    raise exception 'CAJA_BLOQUEADA: la rendición (S/ %) excede en más de 20%% el monto depositado', round(total, 2);
  end if;
  update public.fund_requests set status = 'rendida', rendered_amount = round(total, 2), rendered_at = now() where id = fr.id;
  return jsonb_build_object('seq', fr.seq, 'total', round(total, 2), 'amount', fr.amount);
end $$;

-- ---------------------------------------------------------------------
-- Valorizaciones y cobros
-- ---------------------------------------------------------------------
create or replace function public.valuation_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.direct_write() then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'presentada' then raise exception 'ESTADO_NO_PERMITIDO: la valorización se registra presentada'; end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if not ((old.status in ('presentada', 'observada') and new.status in ('aprobada', 'observada'))
         or (old.status = 'aprobada' and new.status = 'facturada')
         or (old.status in ('facturada', 'cobrada_parcial') and new.status in ('cobrada_parcial', 'cobrada'))) then
      raise exception 'ESTADO_NO_PERMITIDO: una valorización % no pasa a %', old.status, new.status;
    end if;
    if new.status in ('cobrada_parcial', 'cobrada') and public.project_role(new.project_id) <> 'contabilidad' then
      raise exception 'ESTADO_NO_PERMITIDO: solo Contabilidad registra cobros';
    end if;
  end if;
  if old.status not in ('presentada', 'observada') and new.approved_amount is distinct from old.approved_amount then
    raise exception 'ESTADO_NO_PERMITIDO: el monto aprobado no cambia después de la aprobación';
  end if;
  return new;
end $$;

drop trigger if exists valuations_guard on public.valuations;
create trigger valuations_guard before insert or update on public.valuations
  for each row execute function public.valuation_guard();

create or replace function public.collection_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.direct_write() then return coalesce(new, old); end if;
  if tg_op <> 'INSERT' then raise exception 'ESTADO_NO_PERMITIDO: los cobros registrados no se modifican'; end if;
  if not exists (select 1 from public.valuations v where v.id = new.valuation_id and v.status in ('facturada', 'cobrada_parcial')) then
    raise exception 'ESTADO_NO_PERMITIDO: solo se cobran valorizaciones facturadas';
  end if;
  if public.in_closed_period(new.project_id, new.collected_at) then
    raise exception 'PERIODO_CERRADO: la fecha del cobro % pertenece a un periodo cerrado', new.collected_at;
  end if;
  return new;
end $$;

drop trigger if exists collections_guard on public.collections;
create trigger collections_guard before insert or update or delete on public.collections
  for each row execute function public.collection_guard();

-- ---------------------------------------------------------------------
-- Almacén: los movimientos no entran a un periodo cerrado
-- ---------------------------------------------------------------------
create or replace function public.stock_period_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.direct_write() and public.in_closed_period(new.project_id, new.moved_at::date) then
    raise exception 'PERIODO_CERRADO: la fecha % pertenece a un periodo cerrado', new.moved_at::date;
  end if;
  return new;
end $$;

drop trigger if exists stock_movements_period on public.stock_movements;
create trigger stock_movements_period before insert on public.stock_movements
  for each row execute function public.stock_period_guard();

-- Solo Gerencia General reabre un periodo cerrado (igual que la pantalla)
drop policy if exists period_closures_delete on public.period_closures;
create policy period_closures_delete on public.period_closures for delete to authenticated
  using (public.has_project_role(project_id, '{gerente_general}') and public.project_writable(project_id));

-- ---------------------------------------------------------------------
-- Importación de presupuesto en una sola transacción
-- ---------------------------------------------------------------------
create or replace function public.import_budget(p_project uuid, p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  rec record;
  v_replace boolean;
  v_created int := 0;
  v_updated int := 0;
  v_sort int;
  v_id uuid;
  v_children boolean;
  v_ex public.wbs_nodes;
  v_blocked text;
begin
  if not public.has_project_role(p_project, '{gerente_general,gerente_proyectos}') then
    raise exception 'ESTADO_NO_PERMITIDO: solo Gerencia importa presupuestos';
  end if;
  if not public.project_writable(p_project) then raise exception 'OBRA_CERRADA: la obra está cerrada (solo lectura)'; end if;

  -- Fases nuevas que trae el Excel
  insert into public.phases (project_id, code, name, sort)
  select p_project, f.code, 'Fase ' || coalesce(nullif(regexp_replace(f.code, '\D', '', 'g'), ''), f.code),
         (select coalesce(max(sort), 0) from public.phases where project_id = p_project) + row_number() over (order by f.code)
  from (select distinct upper(r ->> 'phase') as code from jsonb_array_elements(p_rows) r where coalesce(r ->> 'phase', '') <> '') f
  where not exists (select 1 from public.phases ph where ph.project_id = p_project and upper(ph.code) = f.code);

  v_replace := not exists (select 1 from public.expenses where project_id = p_project)
           and not exists (select 1 from public.orders where project_id = p_project)
           and not exists (select 1 from public.stock_movements where project_id = p_project and wbs_id is not null);

  if v_replace then
    delete from public.wbs_nodes where project_id = p_project;
    v_sort := 0;
  else
    -- Subdividir una partida que ya tiene movimientos la dejaría fuera de los totales
    select string_agg(distinct w.code, ', ') into v_blocked
    from jsonb_array_elements(p_rows) r
    join public.wbs_nodes w on w.project_id = p_project and w.code = r ->> 'parent' and w.is_leaf
    where not exists (select 1 from public.wbs_nodes x where x.project_id = p_project and x.code = r ->> 'code')
      and (exists (select 1 from public.expense_allocations a where a.wbs_id = w.id)
        or exists (select 1 from public.orders o where o.wbs_id = w.id)
        or exists (select 1 from public.stock_movements s where s.wbs_id = w.id));
    if v_blocked is not null then
      raise exception 'WBS_CON_MOVIMIENTOS: las partidas % ya tienen gastos, órdenes o salidas de almacén y no se pueden subdividir. Agrega las partidas nuevas al mismo nivel o reasigna esos movimientos antes de importar', v_blocked;
    end if;
    select coalesce(max(sort), 0) into v_sort from public.wbs_nodes where project_id = p_project;
  end if;

  for rec in
    select r ->> 'code' as code, r ->> 'name' as name, nullif(r ->> 'parent', '') as parent, (r ->> 'level')::int as level,
           nullif(r ->> 'phase', '') as phase, nullif(r ->> 'costCenter', '') as cost_center, nullif(r ->> 'costType', '') as cost_type,
           round(coalesce(nullif(r ->> 'budget', '')::numeric, 0), 2) as budget, round(coalesce(nullif(r ->> 'margin', '')::numeric, 0), 2) as margin
    from jsonb_array_elements(p_rows) with ordinality as t(r, n)
    order by (r ->> 'level')::int, n
  loop
    v_children := exists (select 1 from jsonb_array_elements(p_rows) c where c ->> 'parent' = rec.code);
    select * into v_ex from public.wbs_nodes where project_id = p_project and code = rec.code;
    if v_ex.id is null then
      v_sort := v_sort + 1;
      insert into public.wbs_nodes (project_id, code, name, level, parent_id, phase_id, cost_center, cost_type, budget, margin, sort)
      values (p_project, rec.code, rec.name, rec.level,
              (select id from public.wbs_nodes where project_id = p_project and code = rec.parent),
              (select id from public.phases where project_id = p_project and upper(code) = upper(rec.phase)),
              rec.cost_center, rec.cost_type, case when v_children then 0 else rec.budget end, rec.margin, v_sort)
      returning id into v_id;
      if not v_children and rec.budget > 0 then
        insert into public.budget_changes (project_id, wbs_id, change_type, amount, previous_budget, new_budget, reason, created_by)
          values (p_project, v_id, 'importacion', rec.budget, 0, rec.budget, 'Importación del presupuesto aprobado (Excel)', auth.uid());
      end if;
      v_created := v_created + 1;
    elsif v_ex.is_leaf and not v_children and abs(rec.budget - v_ex.budget) >= 0.01 then
      perform public.apply_budget_change(v_ex.id, case when rec.budget > v_ex.budget then 'adicional' else 'deductivo' end,
        rec.budget - v_ex.budget, 'Actualización por importación de presupuesto (Excel)');
      v_updated := v_updated + 1;
    end if;
  end loop;

  perform public.refresh_project_alerts(p_project);
  return jsonb_build_object('created', v_created, 'updated', v_updated, 'replaced', v_replace);
end $$;

-- ---------------------------------------------------------------------
-- Funciones internas de alertas: no se invocan desde la API
-- ---------------------------------------------------------------------
revoke all on function public.upsert_alert(uuid, uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.refresh_project_alerts(uuid) from public, anon;
grant execute on function public.refresh_project_alerts(uuid) to authenticated, service_role;
