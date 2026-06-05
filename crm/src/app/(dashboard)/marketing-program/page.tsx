import { redirect } from 'next/navigation';

/**
 * /marketing-program — устарел.
 *
 * Task 062: единая страница /marketing с под-вкладками вместо 4 разных
 * страниц. Старые ссылки/закладки редиректим, чтобы 404 не было.
 * Контент этой страницы доступен под-вкладкой «📐 Стратегия» в /marketing.
 */
export default function MarketingProgramDeprecatedPage() {
  redirect('/marketing');
}
