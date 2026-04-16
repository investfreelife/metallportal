import { CheckCircle } from "lucide-react";

interface SupplierPriceTableProps {
  priceItems: any[];
  unit: string;
}

export default function SupplierPriceTable({
  priceItems,
  unit,
}: SupplierPriceTableProps) {
  if (!priceItems.length) {
    return (
      <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground">
        Цены пока не указаны. Запросите индивидуальное предложение.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Предложения поставщиков
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">Поставщик</th>
              <th className="px-5 py-3 font-medium">Цена/{unit}</th>
              <th className="px-5 py-3 font-medium">Наличие</th>
              <th className="px-5 py-3 font-medium">Склад</th>
              <th className="px-5 py-3 font-medium">Срок</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {priceItems.map((item: any, index: number) => (
              <tr
                key={item.id || index}
                className="border-b border-border hover:bg-background/50 transition-colors"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {item.supplier?.company_name}
                    </span>
                    {item.supplier?.is_verified && (
                      <CheckCircle size={14} className="text-gold" />
                    )}
                  </div>
                  {item.supplier?.rating > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ★ {item.supplier.rating}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div>
                    {item.discount_price ? (
                      <>
                        <span className="text-xs text-muted-foreground line-through mr-2">
                          {Number(item.base_price).toLocaleString("ru-RU")} ₽
                        </span>
                        <span className="text-sm font-bold text-gold">
                          {Number(item.discount_price).toLocaleString("ru-RU")}{" "}
                          ₽
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-foreground">
                        {Number(item.base_price).toLocaleString("ru-RU")} ₽
                      </span>
                    )}
                  </div>
                  {item.min_quantity > 1 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      от {item.min_quantity} {unit}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
                      item.in_stock
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.in_stock
                      ? `${item.stock_quantity ? Number(item.stock_quantity).toFixed(0) + " " + unit : "Да"}`
                      : "Под заказ"}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">
                  {item.supplier?.city || item.supplier?.region || "—"}
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">
                  {item.delivery_days
                    ? `${item.delivery_days} дн.`
                    : "Уточняйте"}
                </td>
                <td className="px-5 py-3">
                  <button className="text-xs bg-gold hover:bg-gold-dark text-primary-foreground font-medium px-4 py-2 rounded transition-all">
                    Заказать
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
