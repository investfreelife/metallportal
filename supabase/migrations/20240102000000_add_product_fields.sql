-- Add filter fields to products
alter table products add column if not exists steel_grade text;
alter table products add column if not exists diameter numeric(8,2);
alter table products add column if not exists thickness numeric(8,2);
alter table products add column if not exists length numeric(8,2);
alter table products add column if not exists coating text;
alter table products add column if not exists weight_per_meter numeric(8,4);
alter table products add column if not exists min_order numeric(12,2) not null default 1;

-- Add location fields to suppliers
alter table suppliers add column if not exists region text;
alter table suppliers add column if not exists city text;
