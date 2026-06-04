-- Sergey directive 2026-06-04: «вкладка Стратегия с согласованием по шагам».
-- Добавляем колонку note text для комментария «поправить» на каждом шаге
-- стратегии и на каждом A/B-варианте кампании.
--
-- marketing_strategy.note  — что поправить в шаге (когда status='revise')
-- ad_variants.note         — что поправить в варианте (когда status='revise')

alter table public.marketing_strategy
  add column if not exists note text;

alter table public.ad_variants
  add column if not exists note text;
