"use client";

import { useState } from "react";
import { Phone, Send, CheckCircle2, Loader2 } from "lucide-react";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
} from "@/lib/contact";
import type { LandingConfig } from "@/lib/landings";

interface Props {
  slug: string;
  title: string;
  subtitle?: string;
  formFields: LandingConfig["cta"]["formFields"];
}

const FIELD_LABELS: Record<LandingConfig["cta"]["formFields"][number], { label: string; placeholder: string; type: string; required: boolean }> = {
  name: { label: "Ваше имя", placeholder: "Иван", type: "text", required: false },
  phone: { label: "Телефон", placeholder: "+7 (___) ___-__-__", type: "tel", required: true },
  email: { label: "Email", placeholder: "you@example.com", type: "email", required: false },
  message: { label: "Комментарий", placeholder: "Опишите задачу — размеры, сроки, бюджет", type: "textarea", required: false },
  attachment: { label: "Файл/чертёж", placeholder: "", type: "file", required: false },
};

/**
 * Lead form — client component, отправляет POST в `/api/landings/submit-lead`.
 *
 * После успеха показывает confirmation. CRM lead создаётся через stub
 * endpoint (m003 stage); реальный `createCrmLead` — m004+ когда Pavel
 * deploy'ит #c014 helper.
 */
export default function LandingCTABlock({ slug, title, subtitle, formFields }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "loading") return;

    setState("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, string> = { slug };
    for (const f of formFields) {
      const v = fd.get(f);
      if (typeof v === "string") payload[f] = v;
    }

    try {
      const res = await fetch("/api/landings/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Не удалось отправить заявку");
    }
  };

  if (state === "success") {
    return (
      <section id="cta-form" className="bg-gradient-to-br from-card to-muted border-y border-border py-16 md:py-20">
        <div className="container-main max-w-2xl text-center space-y-4">
          <CheckCircle2 size={56} className="text-gold mx-auto" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Заявка принята — позвоним в течение 30 минут
          </h2>
          <p className="text-muted-foreground">
            Если срочно —{" "}
            <a href={`tel:${CONTACT_PHONE_TEL}`} className="text-gold font-semibold hover:underline">
              {CONTACT_PHONE_DISPLAY}
            </a>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="cta-form" className="bg-gradient-to-br from-card to-muted border-y border-border py-12 md:py-20">
      <div className="container-main max-w-2xl">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-center">
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground text-center mb-8 max-w-xl mx-auto">
            {subtitle}
          </p>
        )}

        <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl p-6 md:p-8 space-y-4">
          {formFields.map((f) => {
            const meta = FIELD_LABELS[f];
            return (
              <label key={f} className="block">
                <span className="block text-sm text-muted-foreground mb-1.5">
                  {meta.label}
                  {meta.required && <span className="text-gold ml-1">*</span>}
                </span>
                {meta.type === "textarea" ? (
                  <textarea
                    name={f}
                    placeholder={meta.placeholder}
                    required={meta.required}
                    rows={3}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-foreground focus:border-gold focus:outline-none transition-colors resize-y"
                  />
                ) : (
                  <input
                    name={f}
                    type={meta.type}
                    placeholder={meta.placeholder}
                    required={meta.required}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-foreground focus:border-gold focus:outline-none transition-colors"
                  />
                )}
              </label>
            );
          })}

          {state === "error" && (
            <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error || "Не удалось отправить заявку. Попробуйте снова или позвоните."}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={state === "loading"}
              data-metrika-goal={`lead_submit_landing_${slug}`}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:opacity-60 text-black font-bold px-6 py-3.5 rounded-lg transition-all"
            >
              {state === "loading" ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Отправляем…
                </>
              ) : (
                <>
                  <Send size={18} />
                  Отправить заявку
                </>
              )}
            </button>
            <a
              href={`tel:${CONTACT_PHONE_TEL}`}
              data-metrika-goal={`phone_click_landing_${slug}_cta`}
              className="inline-flex items-center justify-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 font-semibold px-5 py-3.5 rounded-lg transition-all"
            >
              <Phone size={18} className="text-gold" />
              Позвонить
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}
