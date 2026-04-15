import Filters from "@/components/catalog/Filters";
import ProductTable from "@/components/catalog/ProductTable";

export const metadata = {
  title: "Каталог — МЕТАЛЛПОРТАЛ",
  description: "Каталог металлопродукции: арматура, трубы, листовой прокат и другие позиции.",
};

export default function CatalogPage() {
  return (
    <section className="py-12">
      <div className="container-main">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Каталог продукции</h1>
        <p className="text-gray-400 mb-10">
          Найдите необходимую металлопродукцию от проверенных поставщиков
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          <aside>
            <Filters />
          </aside>
          <div>
            <ProductTable />
          </div>
        </div>
      </div>
    </section>
  );
}
