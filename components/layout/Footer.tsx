import Link from "next/link";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { fetchCategoriesTree, categoryHref } from "@/lib/categories";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  CONTACT_EMAIL,
} from "@/lib/contact";

// Сколько root-категорий показывает блок "Продукция" в Footer'е. Меньше
// чем в Header (5) — оставшиеся уезжают на /catalog. Если в БД < 5
// активных root'ов — покажем сколько есть, без падения.
const FOOTER_PRODUCTS_LIMIT = 5;

export default async function Footer() {
  const tree = await fetchCategoriesTree();
  const topCategories = tree.slice(0, FOOTER_PRODUCTS_LIMIT);

  return (
    <footer className="bg-card border-t border-gold/20">
      <div className="max-w-[1440px] mx-auto px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex flex-shrink-0">
                <div className="w-10 h-10 flex items-center justify-center bg-gold">
                  <span className="text-black font-black text-xl leading-none" style={{ fontFamily: 'Georgia, serif' }}>Х</span>
                </div>
                <div className="w-10 h-10 flex items-center justify-center bg-foreground">
                  <span className="text-background font-black text-xl leading-none" style={{ fontFamily: 'Georgia, serif' }}>М</span>
                </div>
              </div>
              <div className="leading-tight">
                <p className="text-foreground font-bold text-xl tracking-wide leading-none">Харланметалл</p>
                <p className="text-gold font-semibold text-sm tracking-widest leading-none mt-0.5">МЕТАЛЛОПРОКАТ · КОНСТРУКЦИИ</p>
              </div>
            </div>
            <p className="text-foreground/60 text-sm leading-relaxed">
              Премиальный B2B портал металлопродукции, соединяющий проверенных
              поставщиков с серьёзными покупателями.
            </p>
          </div>

          {/* Contacts (NAP) — phone + email + address + hours
              Источник истины: lib/contact.ts. Адрес дублируется с /contacts
              (placeholder, ждёт уточнения от Сергея). */}
          <div>
            <h4 className="text-foreground uppercase tracking-widest mb-4 text-sm">
              Контакты
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={`tel:${CONTACT_PHONE_TEL}`}
                  className="flex items-center gap-2 text-foreground hover:text-gold transition-colors"
                >
                  <Phone size={16} className="text-gold flex-shrink-0" />
                  <span className="font-bold">{CONTACT_PHONE_DISPLAY}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="flex items-center gap-2 text-foreground/80 hover:text-gold transition-colors"
                >
                  <Mail size={16} className="text-gold flex-shrink-0" />
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li className="flex items-start gap-2 text-foreground/80">
                <MapPin size={16} className="text-gold mt-0.5 flex-shrink-0" />
                <span>Москва — самовывоз по согласованию, доставка по РФ</span>
              </li>
              <li className="flex items-start gap-2 text-foreground/80">
                <Clock size={16} className="text-gold mt-0.5 flex-shrink-0" />
                {/* TASK_054 (audit SEV-2): синхронизация с /contacts —
                    там было Пн-Пт + Сб, в Footer только Пн-Пт. */}
                <span>Пн–Пт 9:00–18:00, Сб 10:00–15:00 МСК</span>
              </li>
            </ul>
          </div>

          {/* Products — data-driven из таблицы categories (W2-1) */}
          <div>
            <h4 className="text-foreground uppercase tracking-widest mb-4 text-sm">
              Продукция
            </h4>
            <ul className="space-y-2">
              {topCategories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={categoryHref(cat)}
                    className="text-sm text-foreground/60 hover:text-gold transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/catalog"
                  className="text-sm text-gold/80 hover:text-gold transition-colors"
                >
                  Весь каталог →
                </Link>
              </li>
            </ul>
          </div>

          {/* Company — fix href="#"; "Вакансии" удалены (страницы нет) */}
          <div>
            <h4 className="text-foreground uppercase tracking-widest mb-4 text-sm">
              Компания
            </h4>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-sm text-foreground/60 hover:text-gold transition-colors">О нас</Link></li>
              <li><Link href="/supplier" className="text-sm text-foreground/60 hover:text-gold transition-colors">Наши поставщики</Link></li>
              <li><Link href="/contacts" className="text-sm text-foreground/60 hover:text-gold transition-colors">Контакты</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-foreground uppercase tracking-widest mb-4 text-sm">
              Правовая информация
            </h4>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm text-foreground/60 hover:text-gold transition-colors">Политика конфиденциальности</Link></li>
              <li><Link href="/oferta" className="text-sm text-foreground/60 hover:text-gold transition-colors">Публичная оферта</Link></li>
              <li><Link href="/privacy#7" className="text-sm text-foreground/60 hover:text-gold transition-colors">Политика cookies</Link></li>
              <li><Link href="/privacy" className="text-sm text-foreground/60 hover:text-gold transition-colors">152-ФЗ</Link></li>
            </ul>
          </div>
        </div>

        {/* TASK_054 (audit 2026-06-18 SEV-1): юр.реквизиты для B2B-доверия.
            Снабженец без ИНН/ОГРН не заводит контрагента.
            Значения из env LEGAL_*; если не заданы — «реквизиты по запросу»
            (НЕ выдумываем — Сергей должен задать в Vercel env):
              LEGAL_NAME    = ООО «Харланметалл» (или ИП ФИО)
              LEGAL_INN     = 7700000000
              LEGAL_OGRN    = 1170000000000  (или ОГРНИП)
              LEGAL_KPP     = 770000000      (для ИП — пусто, не задавать)
              LEGAL_ADDRESS = 117000, Москва, ул. ..., д. ...           */}
        {(process.env.LEGAL_INN || process.env.LEGAL_NAME) ? (
          <div className="pt-8 border-t border-gold/10 text-xs text-foreground/60 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 mb-4">
            {process.env.LEGAL_NAME && <div><span className="text-foreground/40">Юр.лицо:</span> {process.env.LEGAL_NAME}</div>}
            {process.env.LEGAL_INN && <div><span className="text-foreground/40">ИНН:</span> {process.env.LEGAL_INN}</div>}
            {process.env.LEGAL_OGRN && <div><span className="text-foreground/40">ОГРН/ОГРНИП:</span> {process.env.LEGAL_OGRN}</div>}
            {process.env.LEGAL_KPP && <div><span className="text-foreground/40">КПП:</span> {process.env.LEGAL_KPP}</div>}
            {process.env.LEGAL_ADDRESS && <div className="md:col-span-2"><span className="text-foreground/40">Адрес:</span> {process.env.LEGAL_ADDRESS}</div>}
          </div>
        ) : (
          <div className="pt-8 border-t border-gold/10 text-xs text-foreground/60 mb-4">
            ИНН / ОГРН / КПП / адрес склада — высылаем по запросу в{" "}
            <Link href="/contacts" className="text-gold hover:underline">Контакты</Link> или{" "}
            <a href="https://t.me/harlansteel" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">Telegram</a>.
          </div>
        )}

        {/* Bottom — Telegram реальный (@harlansteel, см. /contacts);
            VK / YouTube handles нет, ссылки убраны вместо href="#". */}
        <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-foreground/40 text-sm">
            © {new Date().getFullYear()} Харланметалл. Все права защищены.
          </p>
          <div className="flex gap-6">
            <a
              href="https://t.me/harlansteel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/40 hover:text-gold transition-colors text-sm uppercase tracking-wider"
            >
              Telegram
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
