"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowLeft, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

interface ExistingApp {
  id: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  company_name: string;
}

interface Props {
  userEmail: string;
  existingApplication: ExistingApp | null;
}

const LEGAL_FORMS = [
  { value: "OOO", label: "ООО" },
  { value: "IP", label: "ИП" },
  { value: "AO", label: "АО" },
  { value: "PAO", label: "ПАО" },
  { value: "other", label: "Другое" },
];

const REGIONS = [
  { code: "MO", name: "Москва и МО" },
  { code: "SPB", name: "Санкт-Петербург и ЛО" },
  { code: "CFO", name: "Центральный ФО" },
  { code: "PFO", name: "Приволжский ФО" },
  { code: "UFO", name: "Уральский ФО" },
  { code: "SFO", name: "Сибирский ФО" },
  { code: "DFO", name: "Дальневосточный ФО" },
  { code: "SZFO", name: "Северо-Западный ФО" },
  { code: "YUFO", name: "Южный ФО" },
  { code: "SKFO", name: "Северо-Кавказский ФО" },
  { code: "ALL_RU", name: "Вся Россия" },
];

const PRODUCT_CATEGORIES = [
  { slug: "sortovoy-prokat", name: "Сортовой прокат" },
  { slug: "listovoy-prokat", name: "Листовой прокат" },
  { slug: "trubnyy-prokat", name: "Трубный прокат" },
  { slug: "fasonnyy-prokat", name: "Фасонный прокат" },
  { slug: "spetsstal", name: "Спецсталь" },
  { slug: "tsvetmet", name: "Цветные металлы" },
  { slug: "krepezh", name: "Крепёж" },
  { slug: "metizy", name: "Метизы" },
];

const STEPS = [
  { id: 1, name: "Компания" },
  { id: 2, name: "Адрес и банк" },
  { id: 3, name: "Контакты" },
  { id: 4, name: "Регионы и категории" },
  { id: 5, name: "Подтверждение" },
];

export default function SupplierRegisterClient({ userEmail, existingApplication }: Props) {
  const router = useRouter();

  // If already submitted — show status banner
  if (existingApplication) {
    return <ExistingApplicationView app={existingApplication} />;
  }

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [legalForm, setLegalForm] = useState("OOO");
  const [inn, setInn] = useState("");
  const [ogrn, setOgrn] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bik, setBik] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState(userEmail);
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [documentsUrl, setDocumentsUrl] = useState("");

  const toggleRegion = (code: string) =>
    setRegions((prev) => (prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]));
  const toggleCategory = (slug: string) =>
    setCategories((prev) => (prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]));

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!companyName.trim()) return "Введите название компании";
      if (!inn.trim() || !/^\d{10}$|^\d{12}$/.test(inn)) return "ИНН должен быть 10 или 12 цифр";
    }
    if (s === 2) {
      if (!legalAddress.trim()) return "Введите юридический адрес";
    }
    if (s === 3) {
      if (!contactName.trim()) return "Введите имя контактного лица";
      if (!contactPhone.trim()) return "Введите телефон";
      if (!contactEmail.trim() || !contactEmail.includes("@")) return "Введите корректный email";
    }
    if (s === 4) {
      if (regions.length === 0) return "Выберите хотя бы один регион поставок";
      if (categories.length === 0) return "Выберите хотя бы одну категорию товаров";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  function prev() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    // Final validation
    for (let s = 1; s <= 4; s++) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        setError(err);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/supplier/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          legal_form: legalForm,
          inn: inn.trim(),
          ogrn: ogrn.trim() || null,
          legal_address: legalAddress.trim(),
          bank_name: bankName.trim() || null,
          bank_account: bankAccount.trim() || null,
          bik: bik.trim() || null,
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          contact_email: contactEmail.trim(),
          regions_served: regions,
          product_categories_planned: categories,
          documents_url: documentsUrl.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Ошибка отправки заявки");
      }

      // Success — refresh страницы → server component покажет banner с pending status
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Не удалось отправить заявку");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <h1 className="text-3xl font-black mb-2">Регистрация поставщика</h1>
      <p className="text-muted-foreground mb-8">
        Заполните заявку — модератор рассмотрит её в течение 1-2 рабочих дней.
      </p>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-shrink-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s.id
                  ? "bg-gold text-black"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {step > s.id ? <CheckCircle2 size={16} /> : s.id}
            </div>
            <span
              className={`ml-2 text-xs whitespace-nowrap ${
                step >= s.id ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {s.name}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-2 ${step > s.id ? "bg-gold" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Form sections */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-5">
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold">Шаг 1: Компания</h2>
            <FormField label="Название компании *">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder='ООО "Металлторг"'
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Форма собственности *">
              <select
                value={legalForm}
                onChange={(e) => setLegalForm(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2"
              >
                {LEGAL_FORMS.map((lf) => (
                  <option key={lf.value} value={lf.value}>
                    {lf.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="ИНН *" hint="10 цифр для ООО, 12 для ИП">
              <input
                type="text"
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/\D/g, ""))}
                placeholder="7700000000"
                maxLength={12}
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
            <FormField label="ОГРН/ОГРНИП" hint="13 цифр для ООО, 15 для ИП (необязательно)">
              <input
                type="text"
                value={ogrn}
                onChange={(e) => setOgrn(e.target.value.replace(/\D/g, ""))}
                placeholder="1037700000000"
                maxLength={15}
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-bold">Шаг 2: Адрес и банковские реквизиты</h2>
            <FormField label="Юридический адрес *">
              <textarea
                value={legalAddress}
                onChange={(e) => setLegalAddress(e.target.value)}
                placeholder="123456, г. Москва, ул. Примерная, д. 1, оф. 100"
                rows={2}
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Название банка">
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="ПАО Сбербанк"
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Расчётный счёт" hint="20 цифр">
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))}
                placeholder="40702810000000000000"
                maxLength={20}
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
            <FormField label="БИК банка" hint="9 цифр">
              <input
                type="text"
                value={bik}
                onChange={(e) => setBik(e.target.value.replace(/\D/g, ""))}
                placeholder="044525225"
                maxLength={9}
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-bold">Шаг 3: Контакты</h2>
            <FormField label="Контактное лицо *">
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Телефон *">
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Email *" hint="Используется для уведомления о решении">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="info@example.com"
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-lg font-bold">Шаг 4: Регионы и категории</h2>
            <FormField label="Регионы поставок *">
              <div className="grid grid-cols-2 gap-2">
                {REGIONS.map((r) => (
                  <label
                    key={r.code}
                    className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                      regions.includes(r.code)
                        ? "bg-gold/10 border-gold/40 text-foreground"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={regions.includes(r.code)}
                      onChange={() => toggleRegion(r.code)}
                      className="accent-gold"
                    />
                    <span className="text-sm">{r.name}</span>
                  </label>
                ))}
              </div>
            </FormField>
            <FormField label="Категории товаров *" hint="Можно выбрать несколько">
              <div className="grid grid-cols-2 gap-2">
                {PRODUCT_CATEGORIES.map((c) => (
                  <label
                    key={c.slug}
                    className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                      categories.includes(c.slug)
                        ? "bg-gold/10 border-gold/40 text-foreground"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={categories.includes(c.slug)}
                      onChange={() => toggleCategory(c.slug)}
                      className="accent-gold"
                    />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
              </div>
            </FormField>
            <FormField
              label="Ссылка на документы"
              hint="Опционально: ссылка на Google Drive / Яндекс.Диск с уставом, выпиской ЕГРЮЛ, банк-реквизитами"
            >
              <input
                type="url"
                value={documentsUrl}
                onChange={(e) => setDocumentsUrl(e.target.value)}
                placeholder="https://disk.yandex.ru/..."
                className="w-full bg-background border border-border rounded px-3 py-2"
              />
            </FormField>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="text-lg font-bold">Шаг 5: Подтверждение</h2>
            <div className="bg-background border border-border rounded p-4 space-y-2 text-sm">
              <Row label="Компания" value={`${LEGAL_FORMS.find((l) => l.value === legalForm)?.label} ${companyName}`} />
              <Row label="ИНН" value={inn} />
              {ogrn && <Row label="ОГРН" value={ogrn} />}
              <Row label="Адрес" value={legalAddress} />
              {bankName && <Row label="Банк" value={`${bankName} (БИК ${bik || "—"})`} />}
              {bankAccount && <Row label="Расчётный счёт" value={bankAccount} />}
              <Row label="Контакт" value={contactName} />
              <Row label="Телефон" value={contactPhone} />
              <Row label="Email" value={contactEmail} />
              <Row label="Регионы" value={regions.map((r) => REGIONS.find((rg) => rg.code === r)?.name).filter(Boolean).join(", ")} />
              <Row label="Категории" value={categories.map((c) => PRODUCT_CATEGORIES.find((pc) => pc.slug === c)?.name).filter(Boolean).join(", ")} />
              {documentsUrl && <Row label="Документы" value={documentsUrl} />}
            </div>
            <p className="text-xs text-muted-foreground">
              Нажимая «Отправить заявку», вы соглашаетесь с обработкой персональных данных в рамках{" "}
              <Link href="/privacy" className="text-gold hover:underline">
                политики конфиденциальности
              </Link>
              .
            </p>
          </>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={prev}
          disabled={step === 1 || submitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={16} /> Назад
        </button>
        {step < STEPS.length ? (
          <button
            onClick={next}
            className="inline-flex items-center gap-2 px-5 py-2 rounded bg-gold text-black font-bold hover:bg-yellow-400 transition-colors"
          >
            Далее <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2 rounded bg-gold text-black font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {submitting ? "Отправка..." : "Отправить заявку"}
          </button>
        )}
      </div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-32 flex-shrink-0">{label}:</span>
      <span className="text-foreground break-words">{value || "—"}</span>
    </div>
  );
}

function ExistingApplicationView({ app }: { app: ExistingApp }) {
  const created = new Date(app.created_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (app.status === "pending") {
    return (
      <div>
        <h1 className="text-3xl font-black mb-2">Заявка на рассмотрении</h1>
        <p className="text-muted-foreground mb-8">
          Спасибо! Ваша заявка от <strong className="text-foreground">{created}</strong> отправлена модератору.
        </p>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-5">
          <h2 className="font-bold text-amber-500 mb-2">⏳ Статус: на рассмотрении</h2>
          <p className="text-sm text-foreground mb-3">
            Модератор Харланметалл проверит ваши данные и документы в течение 1-2 рабочих дней.
            Уведомление о решении придёт на email <strong>{app.company_name && "(в заявке)"}</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            Заявка №{app.id.slice(0, 8)}
          </p>
        </div>
      </div>
    );
  }

  if (app.status === "rejected") {
    return (
      <div>
        <h1 className="text-3xl font-black mb-2">Заявка отклонена</h1>
        <p className="text-muted-foreground mb-8">Заявка от {created}</p>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-5 mb-5">
          <h2 className="font-bold text-red-500 mb-2">❌ Заявка отклонена</h2>
          {app.rejection_reason && (
            <p className="text-sm text-foreground">
              <strong>Причина:</strong> {app.rejection_reason}
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Если данные были введены некорректно — свяжитесь с поддержкой:{" "}
          <a href="mailto:info@harlansteel.ru" className="text-gold hover:underline">
            info@harlansteel.ru
          </a>
        </p>
      </div>
    );
  }

  // approved — should already be redirected by parent
  return (
    <div>
      <h1 className="text-3xl font-black mb-2">Заявка одобрена</h1>
      <Link href="/supplier/dashboard" className="text-gold hover:underline">
        Перейти в личный кабинет →
      </Link>
    </div>
  );
}
