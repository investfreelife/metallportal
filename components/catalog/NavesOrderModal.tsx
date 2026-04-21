"use client";
import { useState } from "react";
import { X, ArrowRight, ArrowLeft, Check } from "lucide-react";

const TIME_SLOTS = [
  "9:00–9:30", "9:30–10:00", "10:00–10:30", "10:30–11:00", "11:00–11:30",
  "11:30–12:00", "12:00–12:30", "12:30–13:00", "13:00–13:30", "13:30–14:00",
  "14:00–14:30", "14:30–15:00", "15:00–15:30", "15:30–16:00", "16:00–16:30",
  "16:30–17:00", "17:00–17:30", "17:30–18:00", "18:00–18:30",
];

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAYS_RU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

interface Props {
  productName: string;
  price: number;
  area: number;
  onClose: () => void;
}

type Step = "date" | "time" | "contact" | "done";

export default function NavesOrderModal({ productName, price, area, onClose }: Props) {
  const today = new Date();
  const [step, setStep] = useState<Step>("date");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return d < t;
  };

  const formatDate = (d: Date) =>
    `${d.getDate()} ${MONTHS_RU[d.getMonth()].toLowerCase()}, ${DAYS_RU[d.getDay() === 0 ? 6 : d.getDay()-1]}`;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, comment, type: "callback",
          date: selectedDate ? formatDate(selectedDate) : "",
          time: selectedTime,
          product: productName,
          area, price,
        }),
      });
      if (typeof window !== "undefined" && (window as Window & { mpTrack?: (t: string, d: object) => void }).mpTrack) {
        (window as Window & { mpTrack?: (t: string, d: object) => void }).mpTrack!("form_submit", { contact_name: name, contact_phone: phone });
      }
    } catch {}
    setStep("done");
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-border transition-colors"
        >
          <X size={16} className="text-muted-foreground" />
        </button>

        {/* STEP: DATE */}
        {step === "date" && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-1">Когда удобно связаться?</h2>
            <p className="text-sm text-muted-foreground mb-5">Выберите дату — мы свяжемся в выбранное время</p>

            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <ArrowLeft size={16} />
              </button>
              <span className="font-semibold text-foreground">{MONTHS_RU[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_RU.map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const d = new Date(viewYear, viewMonth, day);
                const disabled = isDisabled(day);
                const sel = selectedDate?.toDateString() === d.toDateString();
                return (
                  <button
                    key={day}
                    disabled={disabled}
                    onClick={() => setSelectedDate(d)}
                    className={`w-full aspect-square rounded-full text-sm font-medium transition-all flex items-center justify-center
                      ${sel ? "bg-gold text-black" : disabled ? "text-muted-foreground/30 cursor-not-allowed" : "hover:bg-muted text-foreground"}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <button
              disabled={!selectedDate}
              onClick={() => setStep("time")}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all"
            >
              Далее <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* STEP: TIME */}
        {step === "time" && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-1">Выберите время</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {selectedDate ? formatDate(selectedDate) : ""} — выберите удобный интервал
            </p>

            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {TIME_SLOTS.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTime(t)}
                  className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                    selectedTime === t
                      ? "bg-gold text-black border-gold"
                      : "bg-card border-border hover:border-gold text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("date")}
                className="flex items-center gap-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-gold transition-all text-sm"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                disabled={!selectedTime}
                onClick={() => setStep("contact")}
                className="flex-1 flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all"
              >
                Далее <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP: CONTACT */}
        {step === "contact" && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-1">Оставьте контактные данные</h2>
            <p className="text-sm text-muted-foreground mb-1">
              {selectedDate ? formatDate(selectedDate) : ""}, {selectedTime}
            </p>
            <p className="text-xs text-muted-foreground mb-5">Мы перезвоним и рассчитаем итоговую стоимость</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Имя *</label>
                <input
                  type="text"
                  placeholder="Ваше имя"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Телефон *</label>
                <input
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Комментарий</label>
                <textarea
                  placeholder="Уточните пожелания по проекту..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground outline-none focus:border-gold transition-colors resize-none"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3 mb-5">
              Нажимая кнопку, вы соглашаетесь с{" "}
              <a href="/privacy" className="text-gold hover:underline">политикой конфиденциальности</a>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("time")}
                className="flex items-center gap-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-gold transition-all text-sm"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                disabled={!name || !phone || submitting}
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all"
              >
                {submitting ? "Отправляем..." : "Отправить заявку"} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP: DONE */}
        {step === "done" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-gold" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {name ? `${name}, благодарим` : "Благодарим"} за ваше обращение!
            </h2>
            <p className="text-muted-foreground text-sm mb-2">
              Ваша заявка принята. Мы готовы предоставить всю необходимую информацию.
            </p>
            {selectedDate && selectedTime && (
              <p className="text-sm text-foreground font-medium mb-6">
                Наши специалисты свяжутся с вами {formatDate(selectedDate)} в {selectedTime}
              </p>
            )}
            <button
              onClick={onClose}
              className="w-full bg-gold hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-all"
            >
              Вернуться на страницу
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
