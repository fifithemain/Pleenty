create table if not exists public.special_imports (
  id uuid primary key default gen_random_uuid(),
  retailer_name text,
  week_start date not null default (date_trunc('week', current_date)::date),
  markup_percent numeric(6,2) not null default 40 check (markup_percent >= 0 and markup_percent <= 200),
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  source_files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.special_import_items (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.special_imports(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  brand text,
  description text,
  unit text,
  catalog text not null,
  cost numeric(12,2) not null check (cost >= 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  confidence numeric(5,4),
  source_file text,
  image_bbox jsonb,
  image_url text,
  status text not null default 'pending' check (status in ('pending','approved','skipped','published')),
  featured_match boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.product_specials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  import_item_id uuid references public.special_import_items(id) on delete set null,
  week_start date not null,
  cost numeric(12,2) not null check (cost >= 0),
  special_price numeric(12,2) not null check (special_price >= 0),
  unit text,
  retailer_name text,
  status text not null default 'published' check (status in ('draft','published','cancelled')),
  created_at timestamptz not null default now(),
  unique(product_id, week_start, retailer_name)
);

create index if not exists special_imports_week_idx on public.special_imports(week_start);
create index if not exists special_import_items_import_idx on public.special_import_items(import_id);
create index if not exists special_import_items_product_idx on public.special_import_items(product_id);
create index if not exists product_specials_week_idx on public.product_specials(week_start);
create index if not exists product_specials_product_idx on public.product_specials(product_id);

alter table public.special_imports enable row level security;
alter table public.special_import_items enable row level security;
alter table public.product_specials enable row level security;

drop policy if exists "Published specials are publicly readable" on public.product_specials;
create policy "Published specials are publicly readable"
on public.product_specials for select to anon, authenticated
using (status = 'published');

insert into public.categories (name, slug, description, is_active)
values
  ('Produce','produce','Fresh fruit and vegetables',true),
  ('Pantry','pantry','Shelf-stable groceries and staples',true),
  ('Bakery','bakery','Bread, rolls and baked goods',true),
  ('Dairy','dairy','Milk, cheese, yoghurt and dairy products',true),
  ('Meat','meat','Fresh and prepared meat products',true),
  ('Frozen','frozen','Frozen food and frozen produce',true),
  ('Beverages','beverages','Soft drinks, juices, water and other beverages',true),
  ('Household','household','Cleaning and household essentials',true),
  ('Other','other','Other grocery products',true)
on conflict (slug) do update set name=excluded.name, description=excluded.description, is_active=true;

insert into storage.buckets (id, name, public)
values ('product-images','product-images',true)
on conflict (id) do update set public=true;

create or replace view public.current_published_specials as
select ps.id, ps.product_id, ps.week_start, ps.cost, ps.special_price, ps.unit, ps.retailer_name,
       p.name, p.slug, p.description, p.image_url, c.slug as catalog
from public.product_specials ps
join public.products p on p.id=ps.product_id
left join public.categories c on c.id=p.category_id
where ps.status='published';

grant select on public.current_published_specials to anon, authenticated;
