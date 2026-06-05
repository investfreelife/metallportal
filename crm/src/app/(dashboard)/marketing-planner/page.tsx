import { redirect } from 'next/navigation';

/**
 * /marketing-planner — устарел.
 *
 * Task 062: единая страница /marketing с под-вкладками вместо 4 разных
 * страниц. Календарь маркетинг-постов доступен внутри /marketing →
 * «🚀 Наш маркетинг» → каналы.
 */
export default function MarketingPlannerDeprecatedPage() {
  redirect('/marketing');
}
