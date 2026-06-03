import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Car, MapPin, Users, Wallet, Send, BarChart2 } from 'lucide-react'

/**
 * Taksopark dashboard — minimal first cut per Sergey directive 2026-06-03
 * «новая фирма! новый дашборд!». Industry = 'taxi' (tenants.industry).
 *
 * Phase 1 (now): KPI cards с placeholder данными + быстрые ссылки на
 * tenant-relevant разделы. Видна tenant name из session.
 * Phase 2 (потом): добавить drivers/cars/trips/payouts таблицы +
 * реальную aggregate-логику.
 */
interface Props {
  tenantId: string
  tenantName?: string
}

export default async function TaxiDashboard({ tenantId, tenantName }: Props) {
  const supabase = await createClient()

  // Sergey уже завёл channels для Столицы (1819 telegram групп для приёма заявок).
  // Покажем сразу как «канал заявок».
  const { count: channelsCount } = await supabase
    .from('channels')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('type', 'telegram_channel')

  // Заглушки — таблиц drivers/cars/trips/payouts ещё нет, добавим
  // отдельной миграцией. Пока показываем 0 с tooltip'ом.
  const stats = {
    drivers: 0,
    cars: 0,
    tripsToday: 0,
    revenueToday: 0,
    channels: channelsCount ?? 0,
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          {tenantName ?? 'Таксопарк'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Дашборд таксопарка — операционные показатели за сегодня
        </p>
      </header>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={<Users size={18} />}
          label="Водители"
          value={stats.drivers.toString()}
          sub="активных"
          href="/drivers"
        />
        <KpiCard
          icon={<Car size={18} />}
          label="Машины"
          value={stats.cars.toString()}
          sub="в парке"
          href="/cars"
        />
        <KpiCard
          icon={<MapPin size={18} />}
          label="Поездки"
          value={stats.tripsToday.toString()}
          sub="сегодня"
          href="/trips"
        />
        <KpiCard
          icon={<Wallet size={18} />}
          label="Доход"
          value={stats.revenueToday.toLocaleString('ru-RU') + ' ₽'}
          sub="сегодня"
          href="/payouts"
          accent
        />
        <KpiCard
          icon={<Send size={18} />}
          label="Каналы"
          value={stats.channels.toLocaleString('ru-RU')}
          sub="Telegram"
          href="/channels"
        />
      </div>

      {/* Coming-soon notice */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🚧</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Phase 1 — minimum viable
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Это первый кат дашборда таксопарка. Sergey directive 2026-06-03 —
              сделать Столицу как отдельный продукт, отличный от Металлпортала.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Сейчас на месте: <b>industry-aware routing</b> (sidebar показывает
              разделы такспарка), <b>tenant branding</b> ({tenantName}),
              <b> /api/me</b> возвращает industry, <b>multitenant data isolation</b>
              (твои 1819 Telegram каналов уже видны в разделе «Каналы»).
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Phase 2 (следующий PR) — schema для drivers/cars/trips/payouts,
              реальные числа в карточках, операционный workflow (приём заявки →
              назначение водителя → завершение → выплата).
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link
                href="/channels"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Send size={14} />
                Управление Telegram каналами
              </Link>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-lg transition-colors"
              >
                <BarChart2 size={14} />
                Настройки
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  href,
  accent = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  href: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group rounded-xl p-4 border transition-all hover:shadow-md ${
        accent
          ? 'bg-yellow-50 border-yellow-300 hover:border-yellow-400'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent ? 'text-yellow-700' : 'text-gray-900'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </Link>
  )
}
