import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { getRelatedCategories } from "@/lib/landings/queries";
import { fetchCategoriesTree, categoryHref, type CategoryNode } from "@/lib/categories";

interface Props {
  /** Slug landing-page (`/landing/{slug}`). */
  landingSlug: string;
}

/**
 * Server component — рендерит секцию «Купить материалы» / «Из чего делаем»
 * на landing pages. Если linked categories нет — `null`.
 *
 * Pavel'ов `getRelatedCategories` возвращает category id/slug/name/count, но
 * **без parent chain** — нужно для построения 2-level catalog URL
 * (`/catalog/{parent}/{child}`). Решаем через `fetchCategoriesTree()`
 * (cached, 1 раз per request) — строим map `id → CategoryNode + parents[]`.
 *
 * Используется в `app/landing/[slug]/page.tsx` (между LandingFAQ и
 * LandingCTABlock — pre-conversion-block для пользователей которые хотят
 * сами купить материалы).
 */

interface CategoryWithChain {
  node: CategoryNode;
  parents: CategoryNode[];
}

/** Walk tree, collect все nodes индексированных по id с parent chain. */
function buildIdMap(
  tree: CategoryNode[],
  parents: CategoryNode[] = [],
  map: Map<string, CategoryWithChain> = new Map(),
): Map<string, CategoryWithChain> {
  for (const node of tree) {
    map.set(node.id, { node, parents });
    const children = node.children ?? [];
    if (children.length) {
      buildIdMap(children, [...parents, node], map);
    }
  }
  return map;
}

export default async function RelatedCategoriesSection({ landingSlug }: Props) {
  const related = await getRelatedCategories(landingSlug);
  if (related.length === 0) return null;

  const tree = await fetchCategoriesTree();
  const idMap = buildIdMap(tree);

  return (
    <section className="my-12 py-10 bg-card/30 border-y border-border">
      <div className="container-main">
        <div className="mb-6 flex items-start gap-3">
          <span className="text-3xl">📦</span>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Из чего делаем
            </h2>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              Используем эти материалы — посмотрите цены и наличие в каталоге,
              если хотите купить и сделать самостоятельно.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {related.map((cat) => {
            const chain = idMap.get(cat.id);
            const href = chain
              ? categoryHref(chain.node, chain.parents)
              : `/catalog/${cat.slug}`;
            return (
              <Link
                key={cat.id}
                href={href}
                className="group bg-card border border-border rounded-lg p-4 hover:border-gold/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-2 mb-2">
                  <Package
                    size={16}
                    className="text-gold/60 mt-0.5 flex-shrink-0"
                  />
                  <h3 className="font-semibold text-sm text-foreground leading-snug group-hover:text-gold transition-colors">
                    {cat.displayLabel}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {cat.productCount > 0
                    ? `${cat.productCount.toLocaleString("ru-RU")} ${pluralizeProducts(cat.productCount)} в каталоге`
                    : "Уточняйте наличие у менеджера"}
                </p>
                <div className="flex items-center gap-1 text-gold text-xs font-medium">
                  В каталог
                  <ArrowRight
                    size={12}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** RU plural: 1 позиция / 2-4 позиции / 5+ позиций. */
function pluralizeProducts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "позиций";
  if (mod10 === 1) return "позиция";
  if (mod10 >= 2 && mod10 <= 4) return "позиции";
  return "позиций";
}
