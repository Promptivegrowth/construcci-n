-- 0004 · Monto contractual por fase (hoja "Faseado facturas") y fase de cada valorización (CPI por fase)
alter table public.phases add column sale_amount numeric(14, 2) not null default 0;
alter table public.valuations add column phase_id uuid references public.phases (id);
alter table public.wbs_nodes add column cost_center text;
