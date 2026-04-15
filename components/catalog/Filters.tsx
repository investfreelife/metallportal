import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const categories = [
  "Арматура",
  "Листовой прокат",
  "Трубы",
  "Балки и швеллеры",
  "Нержавеющая сталь",
  "Цветные металлы",
];

export default function Filters() {
  return (
    <div className="bg-surface border border-surface-border rounded-xl p-5 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gold mb-3">Поиск</h3>
        <Input placeholder="Название продукции..." />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gold mb-3">Категории</h3>
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li key={cat}>
              <label className="flex items-center gap-2 text-sm text-gray-400 hover:text-foreground cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  className="rounded border-surface-border bg-background text-gold focus:ring-gold/50"
                />
                {cat}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gold mb-3">Цена, ₽/т</h3>
        <div className="flex gap-2">
          <Input placeholder="От" type="number" />
          <Input placeholder="До" type="number" />
        </div>
      </div>

      <Button variant="primary" size="sm" className="w-full">
        Применить фильтры
      </Button>
    </div>
  );
}
