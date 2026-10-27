-- 0005 · La validación de saldo de O/S u O/C solo aplica al registrar o al cambiar monto u orden
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
  if new.order_id is not null and new.status <> 'anulado' and not new.order_override
     and (tg_op = 'INSERT' or old.order_id is distinct from new.order_id or old.total is distinct from new.total
          or old.status = 'anulado') then
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

