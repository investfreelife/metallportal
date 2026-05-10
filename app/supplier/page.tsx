import Link from "next/link";
import { CheckCircle2, TrendingUp, Users, Shield, Zap, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Стать поставщиком — Харланметалл",
  description:
    "Зарегистрируйтесь как поставщик металлопродукции на Харланметалл и получите доступ к крупнейшей B2B платформе.",
};

const benefits = [
  {
    icon: Users,
    title: "Тысячи покупателей",
    description: "Доступ к крупнейшей базе B2B/B2C покупателей металлопродукции в России.",
  },
  {
    icon: TrendingUp,
    title: "Buy Box технология",
    description: "Лучшее предложение получает ★ метку и top-1 видимость на product page.",
  },
  {
    icon: Zap,
    title: "Личный кабинет",
    description: "Управляйте офферами, ценами и остатками в реальном времени из dashboard.",
  },
  {
    icon: Shield,
    title: "Прозрачные правила",
    description: "0% комиссия первый месяц. Без скрытых платежей. Прямой контакт с покупателем.",
  },
];

const steps = [
  {
    n: "01",
    title: "Регистрация",
    description: "Заполните заявку с реквизитами компании (ИНН, ОГРН, банк, регионы поставок).",
  },
  {
    n: "02",
    title: "Проверка KYC",
    description: "Модератор Харланметалл проверяет документы за 1-2 рабочих дня.",
  },
  {
    n: "03",
    title: "Доступ",
    description: "После одобрения вы получаете доступ к /supplier/dashboard и можете публиковать офферы.",
  },
  {
    n: "04",
    title: "Продажи",
    description: "Покупатели видят ваши предложения, связываются напрямую. Buy Box победитель — на верху.",
  },
];

export default function SupplierPage({ searchParams }: { searchParams?: { error?: string } }) {
  const error = searchParams?.error;

  return (
    <div className="container-main py-12">
      {/* Error banner — if redirect from dashboard with not-registered */}
      {error === "not-registered" && (
        <div className="max-w-3xl mx-auto mb-8 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-lg p-4">
          <p className="font-bold mb-1">Вы ещё не зарегистрированы как поставщик</p>
          <p className="text-sm">
            Заполните заявку ниже — модератор рассмотрит её в течение 1-2 рабочих дней.
          </p>
        </div>
      )}

      {/* Hero */}
      <section className="text-center mb-16 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-black mb-5">
          Продавайте металл через{" "}
          <span className="text-gold">Харланметалл</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Крупнейшая B2B платформа металлопроката в России. Buy Box технология, прозрачные правила,
          0% комиссия первый месяц. Регистрация занимает 5 минут.
        </p>
        <Link
          href="/supplier/register"
          className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-8 py-4 rounded-lg transition-all text-lg"
        >
          Начать регистрацию
          <ArrowRight size={20} />
        </Link>
        <p className="text-xs text-muted-foreground mt-3">
          Уже зарегистрированы? <Link href="/login?redirect=/supplier/dashboard" className="text-gold hover:underline">Войти в кабинет</Link>
        </p>
      </section>

      {/* Benefits */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Почему Харланметалл</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {benefits.map((b) => (
            <div key={b.title} className="bg-card border border-border rounded-lg p-6 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gold/10 text-gold flex items-center justify-center">
                <b.icon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Как стать поставщиком</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {steps.map((s) => (
            <div key={s.n} className="bg-card border border-border rounded-lg p-5">
              <div className="text-3xl font-black text-gold/30 mb-2">{s.n}</div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="mb-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">Кто может стать поставщиком</h2>
        <ul className="space-y-3">
          {[
            "ООО, ИП, АО — любая форма собственности с регистрацией в РФ",
            "Производители и официальные дистрибьюторы металлопроката",
            "Действующая лицензия (если категория требует — например, нержавеющая сталь по ТУ)",
            "Опыт работы от 6 месяцев (для новых компаний — индивидуальное рассмотрение)",
            "Возможность отгрузки от 1 тонны (минимальный заказ настраивается)",
          ].map((item, i) => (
            <li key={i} className="flex gap-3 items-start">
              <CheckCircle2 size={20} className="text-gold flex-shrink-0 mt-0.5" />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Final CTA */}
      <section className="text-center max-w-2xl mx-auto bg-card border border-border rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-3">Готовы начать?</h2>
        <p className="text-muted-foreground mb-5">
          Регистрация займёт 5 минут. После заполнения заявку рассмотрит модератор за 1-2 рабочих дня.
        </p>
        <Link
          href="/supplier/register"
          className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-all"
        >
          Начать регистрацию
          <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
