const mockProducts = [
  { id: "1", name: "Арматура А500С ø12 мм", price: "42 500 ₽/т", supplier: "МеталлГрупп", stock: "В наличии" },
  { id: "2", name: "Труба профильная 60×40×3", price: "58 200 ₽/т", supplier: "ТрубСталь", stock: "В наличии" },
  { id: "3", name: "Лист г/к 8 мм Ст3", price: "47 900 ₽/т", supplier: "СтальИнвест", stock: "Под заказ" },
  { id: "4", name: "Швеллер 16П", price: "52 100 ₽/т", supplier: "ПромМеталл", stock: "В наличии" },
  { id: "5", name: "Балка 20Б1", price: "55 000 ₽/т", supplier: "МеталлГрупп", stock: "В наличии" },
];

export default function ProductTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-surface-border text-sm text-gray-400">
            <th className="pb-3 pr-6">Наименование</th>
            <th className="pb-3 pr-6">Цена</th>
            <th className="pb-3 pr-6">Поставщик</th>
            <th className="pb-3">Наличие</th>
          </tr>
        </thead>
        <tbody>
          {mockProducts.map((p) => (
            <tr
              key={p.id}
              className="border-b border-surface-border hover:bg-surface-light transition-colors cursor-pointer"
            >
              <td className="py-4 pr-6 font-medium">{p.name}</td>
              <td className="py-4 pr-6 text-gold font-semibold">{p.price}</td>
              <td className="py-4 pr-6 text-gray-400">{p.supplier}</td>
              <td className="py-4">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    p.stock === "В наличии"
                      ? "bg-green-900/30 text-green-400"
                      : "bg-red-900/30 text-red-400"
                  }`}
                >
                  {p.stock}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
