-- =====================================================================
-- Grupo Cruz · Control presupuestal por obra
-- 0001 · Núcleo: tipos y tablas
-- =====================================================================
create extension if not exists pgcrypto;

create type public.app_role as enum (
  'gerente_general', 'gerente_proyectos', 'residente', 'administrador', 'contabilidad', 'almacen'
);
create type public.project_status as enum ('preparacion', 'ejecucion', 'paralizada', 'cancelada', 'cerrada');
create type public.expense_status as enum (
  'borrador', 'declarado', 'observado', 'aprobado', 'pagado_parcial', 'pagado', 'anulado'
);
-- FT factura · BV boleta · RH recibo por honorarios · TK ticket · PL planilla · OT otros
create type public.doc_type as enum ('FT', 'BV', 'RH', 'TK', 'PL', 'OT');
create type public.labor_category as enum ('capataz', 'operario', 'oficial', 'peon');

-- ---------------------------------------------------------------------
-- Holding, empresas y usuarios
-- ---------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  legal_name text,
  ruc text,
  tagline text,
  logo_key text,
  accent_color text not null default '#035AA6',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  position text,
  dni text,
  is_holding_admin boolean not null default false,
  avatar_color text,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  all_projects boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

-- ---------------------------------------------------------------------
-- Obras
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  short_name text,
  client_name text,
  client_ruc text,
  project_type text not null default 'edificacion',
  location text,
  address text,
  region text,
  manager_id uuid references public.profiles (id),
  admin_id uuid references public.profiles (id),
  resident_id uuid references public.profiles (id),
  start_date date,
  end_date date,
  extended_end_date date,
  currency text not null default 'PEN',
  exchange_rate numeric(8, 4) not null default 3.75,
  contract_amount numeric(14, 2) not null default 0,
  alert_threshold int not null default 80,
  lat double precision,
  lng double precision,
  geofence_radius int not null default 300,
  status public.project_status not null default 'preparacion',
  template_of uuid references public.projects (id),
  closed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  doc_kind text not null, -- contrato | orden_servicio_cliente | carta_fianza | poliza | otro
  title text not null,
  number text,
  amount numeric(14, 2),
  issue_date date,
  expiry_date date,
  file_path text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  sort int not null default 0,
  start_date date,
  end_date date,
  color text,
  unique (project_id, code)
);

-- WBS / centro de costo jerárquico (hasta 3 niveles). El presupuesto vive en las hojas.
create table public.wbs_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_id uuid references public.wbs_nodes (id) on delete cascade,
  code text not null,
  name text not null,
  level smallint not null default 1 check (level between 1 and 3),
  phase_id uuid references public.phases (id) on delete set null,
  cost_type text, -- mano_obra | alquileres | materiales | servicios | seguridad | transporte | gastos_generales | contingencias
  budget numeric(14, 2) not null default 0,
  margin numeric(14, 2) not null default 0,
  is_leaf boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, code)
);

create table public.budget_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  wbs_id uuid references public.wbs_nodes (id) on delete cascade,
  change_type text not null, -- importacion | adicional | deductivo | reasignacion | ajuste
  amount numeric(14, 2) not null,
  previous_budget numeric(14, 2),
  new_budget numeric(14, 2),
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Proveedores, órdenes y comprobantes
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  ruc text not null,
  name text not null,
  kind text not null default 'proveedor', -- proveedor | subcontratista | trabajador | entidad
  phone text,
  email text,
  address text,
  bank text,
  account_number text,
  created_at timestamptz not null default now(),
  unique (company_id, ruc)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  order_type text not null check (order_type in ('OS', 'OC')),
  number text,
  seq int,
  supplier_id uuid references public.suppliers (id),
  wbs_id uuid references public.wbs_nodes (id),
  phase_id uuid references public.phases (id),
  title text not null,
  description text,
  currency text not null default 'PEN',
  exchange_rate numeric(8, 4) not null default 1,
  includes_igv boolean not null default true,
  subtotal numeric(14, 2) not null default 0,
  igv numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  subtotal_pen numeric(14, 2) not null default 0,
  billing_frequency text not null default 'unica', -- unica | semanal | quincenal | mensual
  start_date date,
  end_date date,
  status text not null default 'solicitada', -- solicitada | aprobada | rechazada | cerrada | anulada
  requested_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  material_id uuid,
  description text not null,
  unit text,
  quantity numeric(14, 3) not null default 1,
  unit_price numeric(14, 4) not null default 0,
  total numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  seq int,
  wbs_id uuid references public.wbs_nodes (id),
  phase_id uuid references public.phases (id),
  supplier_id uuid references public.suppliers (id),
  category text, -- tipo de gasto: PLANILLA STAFF, ALQUILER EQUIPOS, TRANSPORTE, COMPRAS PROVEEDORES…
  description text not null,
  doc_type public.doc_type not null default 'FT',
  series text,
  doc_number text,
  issue_date date not null default current_date,
  reception_date date,
  due_date date,
  week int,
  currency text not null default 'PEN' check (currency in ('PEN', 'USD')),
  exchange_rate numeric(8, 4) not null default 1,
  tax_condition text not null default 'gravado', -- gravado | no_gravado | exonerado
  total numeric(14, 2) not null check (total >= 0), -- en moneda de origen
  subtotal numeric(14, 2),
  igv numeric(14, 2),
  total_pen numeric(14, 2),
  cost_pen numeric(14, 2), -- monto que se carga al presupuesto (sin IGV cuando hay crédito fiscal)
  retention_pct numeric(5, 2) not null default 0, -- fondo de garantía
  retention_pen numeric(14, 2),
  payable_pen numeric(14, 2),
  order_id uuid references public.orders (id),
  order_override boolean not null default false,
  exceeds_budget boolean not null default false,
  origin text not null default 'obra', -- obra | campo | lima
  status public.expense_status not null default 'declarado',
  created_by uuid references public.profiles (id),
  declared_at timestamptz,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  observation text,
  voided_by uuid references public.profiles (id),
  voided_at timestamptz,
  void_reason text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index expenses_unique_document
  on public.expenses (company_id, supplier_id, doc_type, coalesce(series, ''), doc_number)
  where status <> 'anulado' and doc_number is not null and doc_type <> 'PL';

create table public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  wbs_id uuid not null references public.wbs_nodes (id),
  amount_pen numeric(14, 2) not null,
  description text
);

create table public.expense_files (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  file_path text not null,
  file_name text,
  mime text,
  size_bytes int,
  lat double precision,
  lng double precision,
  captured_at timestamptz,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  expense_id uuid not null references public.expenses (id) on delete cascade,
  paid_at date not null default current_date,
  amount_pen numeric(14, 2) not null check (amount_pen > 0),
  percentage numeric(6, 2),
  method text not null default 'transferencia', -- transferencia | cheque | efectivo | detraccion | caja
  bank text,
  operation_number text,
  notes text,
  registered_by uuid references public.profiles (id),
  voided boolean not null default false,
  void_reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Mano de obra (registro de costo)
-- ---------------------------------------------------------------------
create table public.labor_projections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid references public.phases (id) on delete cascade,
  category public.labor_category not null,
  amount numeric(14, 2) not null default 0,
  workers int,
  unique (project_id, phase_id, category)
);

create table public.payrolls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  payroll_type text not null default 'obreros', -- obreros | staff | cts | gratificacion | liquidacion
  week int,
  period_label text not null,
  period_start date,
  period_end date,
  phase_id uuid references public.phases (id),
  wbs_id uuid references public.wbs_nodes (id),
  total numeric(14, 2) not null default 0,
  expense_id uuid references public.expenses (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.payrolls (id) on delete cascade,
  category text not null, -- capataz | operario | oficial | peon | staff
  workers int not null default 0,
  days numeric(6, 2),
  amount numeric(14, 2) not null default 0
);

-- ---------------------------------------------------------------------
-- Caja por obra y solicitudes de fondos
-- ---------------------------------------------------------------------
create table public.cash_boxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  responsible_id uuid references public.profiles (id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.fund_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  box_id uuid references public.cash_boxes (id),
  seq int,
  requested_by uuid references public.profiles (id),
  amount numeric(14, 2) not null check (amount > 0),
  reason text not null,
  needed_by date,
  status text not null default 'pendiente', -- pendiente | aprobada | rechazada | depositada | rendida
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  approval_note text,
  deposited_by uuid references public.profiles (id),
  deposited_at timestamptz,
  deposit_operation text,
  rendered_amount numeric(14, 2),
  rendered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.cash_boxes (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  movement_type text not null check (movement_type in ('ingreso', 'egreso')),
  amount numeric(14, 2) not null check (amount > 0),
  moved_at date not null default current_date,
  concept text not null,
  fund_request_id uuid references public.fund_requests (id),
  expense_id uuid references public.expenses (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Valorizaciones y cobros
-- ---------------------------------------------------------------------
create table public.valuations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  number int not null,
  period_start date,
  period_end date,
  presented_amount numeric(14, 2) not null default 0, -- sin IGV
  approved_amount numeric(14, 2),
  invoice_number text,
  invoice_date date,
  status text not null default 'presentada', -- presentada | aprobada | facturada | cobrada_parcial | cobrada | observada
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (project_id, number)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references public.valuations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  collected_at date not null default current_date,
  operation_number text,
  notes text,
  registered_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Almacén y logística
-- ---------------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  unit text not null, -- kg | und | tabla | caja | m | m3 | bolsa | gl | pza | rollo | par
  category text not null default 'materiales', -- consumibles | materiales | epp | herramientas | acero | madera | agregados
  min_stock numeric(14, 3) not null default 0,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

alter table public.order_items
  add constraint order_items_material_fk foreign key (material_id) references public.materials (id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  material_id uuid not null references public.materials (id),
  movement_type text not null check (movement_type in ('ingreso', 'salida', 'devolucion', 'ajuste')),
  moved_at date not null default current_date,
  quantity numeric(14, 3) not null,
  unit_cost numeric(14, 4) not null default 0,
  total_cost numeric(14, 2),
  supplier_id uuid references public.suppliers (id),
  order_id uuid references public.orders (id),
  expense_id uuid references public.expenses (id),
  wbs_id uuid references public.wbs_nodes (id),
  phase_id uuid references public.phases (id),
  front text,
  document_ref text,
  responsible_name text,
  photo_path text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  equipment_type text, -- vibradora | amoladora | taladro | estacion_total | nivel | mezcladora | laptop | otro
  brand text,
  model text,
  serial text,
  ownership text not null default 'propio', -- propio | alquilado
  order_id uuid references public.orders (id),
  project_id uuid references public.projects (id),
  status text not null default 'disponible', -- disponible | asignado | mantenimiento | baja
  rate_amount numeric(14, 2),
  rate_period text, -- dia | semana | mes
  notes text,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table public.equipment_assignments (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  assigned_to text not null,
  assigned_to_dni text,
  delivered_at timestamptz not null default now(),
  delivered_by uuid references public.profiles (id),
  condition_out text,
  signature_out text,
  returned_at timestamptz,
  condition_in text,
  signature_in text,
  notes text
);

-- ---------------------------------------------------------------------
-- Campo: asistencia
-- ---------------------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('entrada', 'salida')),
  marked_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  accuracy double precision,
  distance_m double precision,
  within_geofence boolean,
  photo_path text,
  notes text
);

-- ---------------------------------------------------------------------
-- Alertas, auditoría y cierres
-- ---------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  alert_type text not null, -- consumo_80 | sobrecosto | ritmo | diferencia | documento | vencimiento | orden_excedida | fondos | stock
  severity text not null default 'warning', -- info | warning | danger
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  resolved boolean not null default false,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  company_id uuid,
  project_id uuid,
  table_name text not null,
  record_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create table public.period_closures (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  label text,
  closed_by uuid references public.profiles (id),
  closed_at timestamptz not null default now()
);

-- Índices de consulta frecuente
create index on public.projects (company_id);
create index on public.wbs_nodes (project_id, parent_id);
create index on public.expenses (project_id, status);
create index on public.expenses (project_id, issue_date);
create index on public.expenses (supplier_id);
create index on public.expenses (order_id);
create index on public.expense_allocations (expense_id);
create index on public.expense_allocations (wbs_id);
create index on public.payments (expense_id);
create index on public.payments (project_id, paid_at);
create index on public.orders (project_id);
create index on public.stock_movements (project_id, material_id);
create index on public.payrolls (project_id);
create index on public.alerts (company_id, resolved);
create index on public.audit_log (project_id, changed_at desc);
create index on public.audit_log (table_name, record_id);
create index on public.attendance (project_id, marked_at desc);
create index on public.company_members (user_id);
