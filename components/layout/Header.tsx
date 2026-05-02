import { fetchCategoriesTree, categoryHref, type CategoryNode } from "@/lib/categories";
import HeaderClient, { type ClientNavItem } from "./HeaderClient";

/**
 * Async server component. На каждый SSR-render fetch'ит дерево категорий
 * (с 30-сек cache в lib/categories.ts), маппит в формат для HeaderClient
 * и отдаёт в client-component для интерактива (dropdown, mobile menu).
 *
 * Закрывает W2-1 — раньше тут был client component с hardcoded NAV_ITEMS
 * на 2 root-категории. После migration — все root'ы из categories table,
 * top-N выводятся в desktop-nav.
 *
 * См. WINDSURF_TASK_v2_nav_from_db.md.
 */

// Сколько root-категорий показываем в десктоп-Header'е. Полный список
// доступен через "Весь каталог →" кнопку справа. Лимит выбран чтобы
// помещалось рядом с кнопками "Калькуляторы" и "Поиск с ИИ" без overflow.
const HEADER_NAV_LIMIT = 5;

// Fallback-эмодзи для root-категорий у которых поле icon в БД пустое.
// Сохраняет визуальный ритм Header'а (раньше каждый item имел эмодзи).
const ICON_FALLBACK = "🔩";

function toClientNav(node: CategoryNode, parents: CategoryNode[] = []): ClientNavItem {
  return {
    label: node.name,
    href: categoryHref(node, parents),
    icon: node.icon ?? undefined,
    children:
      node.children.length > 0
        ? node.children.map((c) => toClientNav(c, [...parents, node]))
        : undefined,
  };
}

export default async function Header() {
  const tree = await fetchCategoriesTree();

  const navItems: ClientNavItem[] = tree.slice(0, HEADER_NAV_LIMIT).map((root) => {
    const item = toClientNav(root);
    if (!item.icon) item.icon = ICON_FALLBACK;
    return item;
  });

  return <HeaderClient navItems={navItems} />;
}
