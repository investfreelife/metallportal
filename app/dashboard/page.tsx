import Card from "@/components/ui/Card";

export const metadata = {
  title: "Личный кабинет — МЕТАЛЛПОРТАЛ",
};

const orders = [
  { id: "ORD-001", date: "2024-12-01", total: "1 250 000 ₽", status: "Доставлен" },
  { id: "ORD-002", date: "2024-12-05", total: "830 000 ₽", status: "В пути" },
  { id: "ORD-003", date: "2024-12-10", total: "2 100 000 ₽", status: "Обработка" },
];

export default function DashboardPage() {
  return (
    <section className="py-12">
      <div className="container-main">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Личный кабинет</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <div className="text-sm text-gray-400">Заказов всего</div>
            <div className="text-2xl font-bold text-gold mt-1">24</div>
          </Card>
          <Card>
            <div className="text-sm text-gray-400">Сумма закупок</div>
            <div className="text-2xl font-bold text-gold mt-1">12.4 млн ₽</div>
          </Card>
          <Card>
            <div className="text-sm text-gray-400">Активные заявки</div>
            <div className="text-2xl font-bold text-gold mt-1">3</div>
          </Card>
          <Card>
            <div className="text-sm text-gray-400">Избранное</div>
            <div className="text-2xl font-bold text-gold mt-1">17</div>
          </Card>
        </div>

        {/* Orders Table */}
        <h2 className="text-xl font-semibold mb-4">Последние заказы</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-surface-border text-sm text-gray-400">
                <th className="pb-3 pr-6">Номер</th>
                <th className="pb-3 pr-6">Дата</th>
                <th className="pb-3 pr-6">Сумма</th>
                <th className="pb-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-surface-border hover:bg-surface-light transition-colors"
                >
                  <td className="py-4 pr-6 font-medium">{order.id}</td>
                  <td className="py-4 pr-6 text-gray-400">{order.date}</td>
                  <td className="py-4 pr-6">{order.total}</td>
                  <td className="py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface-light border border-surface-border">
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
