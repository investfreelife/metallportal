import { redirect } from 'next/navigation';

/**
 * /marketing-plan — устарел.
 *
 * Task 062: единая страница /marketing с под-вкладками вместо 4 разных
 * страниц. Контент перенесён в под-вкладку «📐 Стратегия» / каналы.
 */
export default function MarketingPlanDeprecatedPage() {
  redirect('/marketing');
}
