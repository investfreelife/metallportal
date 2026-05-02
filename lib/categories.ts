import { createClient } from "@supabase/supabase-js";

/**
 * Categories tree helper для Header / Footer SSR.
 *
 * Закрывает W2-1: вместо hardcoded NAV_ITEMS читаем дерево категорий из
 * Supabase на каждый запрос (с in-memory cache на 30 сек чтобы не давить БД).
 *
 * См. WINDSURF_TASK_v2_nav_from_db.md и knowledge-base/lessons/011-hardcoded-vs-data-driven.md.
 */

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
  icon: string | null;
  children: CategoryNode[];
};

let cache: { tree: CategoryNode[]; expires: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 секунд — баланс между свежестью и нагрузкой на БД

type CategoryRow = Omit<CategoryNode, "children">;

/**
 * Возвращает массив root-категорий с заполненными children.
 *
 * In-memory cache живёт 30 сек. На холодный запрос — один SELECT всех
 * активных категорий (~94 строк), tree собирается в памяти. На ошибку —
 * пытается вернуть последний живой cache, иначе пустой массив (Header
 * не должен валить страницу из-за БД).
 */
export async function fetchCategoriesTree(): Promise<CategoryNode[]> {
  if (cache && cache.expires > Date.now()) {
    return cache.tree;
  }

  // Server-side fetch → service-role-key ОК (никогда не идёт в браузер).
  // Anon-key дал бы те же данные (RLS allow public read), но service-role
  // упрощает: не зависит от настроек RLS на таблице categories.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, parent_id, is_active, sort_order, icon")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    console.error("[fetchCategoriesTree]", error);
    return cache?.tree ?? [];
  }

  // Build tree.
  const byId = new Map<string, CategoryNode>(
    (data as CategoryRow[]).map((c) => [c.id, { ...c, children: [] }]),
  );
  const roots: CategoryNode[] = [];

  // Array.from вместо for-of по Map.values() — tsconfig target ниже es2015,
  // прямой итератор не пускают (TS2802). Один проход, не критично.
  for (const cat of Array.from(byId.values())) {
    if (cat.parent_id && byId.has(cat.parent_id)) {
      byId.get(cat.parent_id)!.children.push(cat);
    } else {
      roots.push(cat);
    }
  }

  // sort_order уже применён в запросе на верхнем уровне, но children
  // приходят перемешанные (всё в одном flat-наборе) — пересортируем явно.
  const sortRecursive = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const n of nodes) sortRecursive(n.children);
  };
  sortRecursive(roots);

  cache = { tree: roots, expires: Date.now() + CACHE_TTL_MS };
  return roots;
}

/**
 * Билдит URL для категории. Если parents не передан — root-уровень.
 *
 * Routes у нас 2-уровневые: /catalog/[category]/[subcategory]. Внуки
 * в URL не отражаются — продукт открывается через
 * /catalog/[category]/[subcategory]/[slug] на странице товара.
 */
export function categoryHref(
  cat: CategoryNode,
  parents?: CategoryNode[],
): string {
  if (!parents || parents.length === 0) {
    return `/catalog/${cat.slug}`;
  }
  const path = [...parents.map((p) => p.slug), cat.slug].join("/");
  return `/catalog/${path}`;
}

/**
 * Тестовый helper: сбрасывает cache. Использовать только в скриптах /
 * dev-режиме. В продакшене не вызывается.
 */
export function _resetCategoriesCache() {
  cache = null;
}
