import { supabase } from "./supabase";

export type SiteSettings = Record<string, string>;

export async function getSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error || !data) return getDefaultSettings();
  return Object.fromEntries(data.map((r: any) => [r.key, r.value ?? ""]));
}

export async function updateSiteSetting(key: string, value: string): Promise<void> {
  await (supabase.from("site_settings") as any)
    .upsert({ key, value, updated_at: new Date().toISOString() });
}

export function getDefaultSettings(): SiteSettings {
  return {
    site_name: "МеталлПортал",
    phone: "+7 (495) 925-11-55",
    telegram: "@metallportal",
    hero_title: "Металлопрокат и Металлоконструкции",
    hero_subtitle: "Прямые поставки от производителей",
    trust_bar_1: "1500+ позиций",
    trust_bar_2: "50+ поставщиков",
    trust_bar_3: "Доставка за 3 дня",
    trust_bar_4: "Документы: УПД, счёт-фактура",
  };
}
