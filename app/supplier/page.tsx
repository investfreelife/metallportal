import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export const metadata = {
  title: "Стать поставщиком — МЕТАЛЛПОРТАЛ",
  description:
    "Зарегистрируйтесь как поставщик металлопродукции и получите доступ к тысячам покупателей.",
};

const benefits = [
  {
    title: "Тысячи покупателей",
    description: "Доступ к крупнейшей базе B2B и B2C покупателей металлопродукции в России.",
  },
  {
    title: "Удобная панель управления",
    description: "Управляйте заказами, ценами и остатками в одном личном кабинете.",
  },
  {
    title: "Быстрые выплаты",
    description: "Получайте оплату в течение 3 рабочих дней после подтверждения доставки.",
  },
  {
    title: "Маркетинг и продвижение",
    description: "Ваша продукция будет продвигаться среди целевой аудитории покупателей.",
  },
];

export default function SupplierPage() {
  return (
    <section className="py-12">
      <div className="container-main">
        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Станьте поставщиком на{" "}
            <span className="text-gold">МЕТАЛЛПОРТАЛ</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Присоединяйтесь к более чем 1 200 поставщикам и расширьте свой рынок
            сбыта.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {benefits.map((b) => (
            <div key={b.title} className="card-surface">
              <h3 className="text-lg font-semibold text-gold mb-2">
                {b.title}
              </h3>
              <p className="text-gray-400 text-sm">{b.description}</p>
            </div>
          ))}
        </div>

        {/* Registration Form */}
        <div className="max-w-lg mx-auto card-surface">
          <h2 className="text-xl font-semibold mb-6">Заявка на регистрацию</h2>
          <form className="space-y-4">
            <Input label="Название компании" placeholder="ООО «Пример»" />
            <Input label="ИНН" placeholder="1234567890" />
            <Input label="Контактное лицо" placeholder="Иванов Иван Иванович" />
            <Input label="Телефон" placeholder="+7 (999) 123-45-67" type="tel" />
            <Input label="Email" placeholder="info@example.com" type="email" />
            <Button className="w-full mt-2">Отправить заявку</Button>
          </form>
        </div>
      </div>
    </section>
  );
}
