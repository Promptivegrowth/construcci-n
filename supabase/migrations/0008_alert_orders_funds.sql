-- 0008 · Alertas: órdenes facturadas sobre su monto (autorización especial) y fondos depositados sin rendir
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
    select s.*, coalesce(ph.end_date < current_date, false) as phase_done
    from public.v_wbs_stats s left join public.phases ph on ph.id = s.phase_id
    where s.project_id = p_project and s.is_leaf and s.budget > 0
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
    elsif pct * 100 >= p.alert_threshold and not r.phase_done then
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

  -- Stock bajo el mínimo (una alerta agregada por obra)
  select count(*), string_agg(m.name, ', ' order by v.stock / nullif(m.min_stock, 0)) into r
    from public.v_stock v join public.materials m on m.id = v.material_id
    where v.project_id = p_project and m.min_stock > 0 and v.stock < m.min_stock * 0.5;
  update public.alerts set resolved = true, resolved_at = now()
    where project_id = p_project and alert_type = 'stock' and not resolved and entity_id is not null;
  if r.count > 0 then
    perform public.upsert_alert(p.company_id, p.id, 'stock', 'info',
      r.count || ' materiales con stock crítico',
      'Por debajo del 50% del stock mínimo: ' || left(r.string_agg, 220), 'stock', null);
    n := n + 1;
  else
    update public.alerts set resolved = true, resolved_at = now() where project_id = p_project and alert_type = 'stock' and not resolved;
  end if;

  -- Órdenes facturadas por encima de su monto (solo posible con autorización especial de Gerencia)
  update public.alerts a set resolved = true, resolved_at = now()
    from public.orders o join public.v_order_balance b on b.order_id = o.id
    where a.entity_id = o.id and a.alert_type = 'orden_excedida' and not a.resolved
      and a.project_id = p_project and (o.status = 'anulada' or b.invoiced_pen <= o.subtotal_pen + 0.5);
  for r in
    select o.id, o.number, o.title, o.subtotal_pen, b.invoiced_pen
    from public.orders o join public.v_order_balance b on b.order_id = o.id
    where o.project_id = p_project and o.status in ('aprobada', 'cerrada') and b.invoiced_pen > o.subtotal_pen + 0.5
  loop
    perform public.upsert_alert(p.company_id, p.id, 'orden_excedida', 'warning',
      coalesce(r.number, 'Orden') || ' · ' || r.title || ' facturada sobre su monto',
      format('Facturado S/ %s contra S/ %s de la orden. Exceso de S/ %s autorizado por Gerencia.',
        to_char(r.invoiced_pen, 'FM999G999G990D00'), to_char(r.subtotal_pen, 'FM999G999G990D00'),
        to_char(r.invoiced_pen - r.subtotal_pen, 'FM999G999G990D00')), 'order', r.id);
    n := n + 1;
  end loop;

  -- Fondos depositados que llevan más de 15 días sin rendir
  update public.alerts a set resolved = true, resolved_at = now()
    from public.fund_requests f
    where a.entity_id = f.id and a.alert_type = 'fondos' and not a.resolved
      and a.project_id = p_project and f.status <> 'depositada';
  for r in
    select f.id, f.seq, f.amount, f.deposited_at, (current_date - f.deposited_at::date) as days
    from public.fund_requests f
    where f.project_id = p_project and f.status = 'depositada' and f.deposited_at is not null
      and f.deposited_at::date < current_date - 15
  loop
    perform public.upsert_alert(p.company_id, p.id, 'fondos',
      case when r.days > 30 then 'danger' else 'warning' end,
      'Fondo' || coalesce(' N° ' || r.seq, '') || ' por rendir hace ' || r.days || ' días',
      format('Depositado S/ %s el %s y aún sin rendición de comprobantes.',
        to_char(r.amount, 'FM999G999G990D00'), to_char(r.deposited_at, 'DD/MM/YYYY')), 'fund', r.id);
    n := n + 1;
  end loop;

  return n;
end $$;
