import { formatDimensions } from "@/lib/formatDimensions";

interface SpecsTableProps {
  product: any;
}

export default function SpecsTable({ product }: SpecsTableProps) {
  const specs = [
    { label: "Марка стали", value: product.steel_grade },
    { label: "ГОСТ", value: product.gost },
    { label: "Длина", value: product.length ? `${product.length} м` : null },
    {
      label: "Вес 1 м.п.",
      value: product.weight_per_meter
        ? `${product.weight_per_meter} кг`
        : null,
    },
    { label: "Размер", value: formatDimensions(product.dimensions) || null },
    { label: "Диаметр", value: product.diameter ? `${product.diameter} мм` : null },
    { label: "Толщина", value: product.thickness ? `${product.thickness} мм` : null },
    { label: "Покрытие", value: product.coating },
    { label: "Материал", value: product.material },
    {
      label: "Мин. партия",
      value: product.min_order
        ? `${product.min_order} ${product.unit}`
        : null,
    },
  ].filter((s) => s.value);

  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Характеристики
        </h3>
      </div>
      <table className="w-full">
        <tbody>
          {specs.map((spec, i) => (
            <tr
              key={spec.label}
              className={i % 2 === 0 ? "bg-card" : "bg-background/50"}
            >
              <td className="px-5 py-2.5 text-sm text-muted-foreground w-1/2">
                {spec.label}
              </td>
              <td className="px-5 py-2.5 text-sm font-medium text-foreground">
                {spec.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
