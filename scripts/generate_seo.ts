/**
 * Generates SEO articles for 15 metal product types via OpenRouter gpt-4o-mini.
 * Saves to public/seo/{slug}.json
 *
 * Usage: npx tsx scripts/generate_seo.ts
 */
import OpenAI from "openai";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { readFileSync } from "fs";

try {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* external */ }

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const PRODUCT_TYPES = [
  { slug: "truby-vgp",          name: "Трубы водогазопроводные ВГП",        gost: "ГОСТ 3262-75",    grade: "Ст3сп" },
  { slug: "truby-profilnye",    name: "Трубы профильные квадратные",         gost: "ГОСТ 30245-2003", grade: "Ст3сп" },
  { slug: "truby-besshovnye",   name: "Трубы бесшовные",                     gost: "ГОСТ 8734-75",    grade: "Ст20" },
  { slug: "armatura-a500s",     name: "Арматура строительная А500С",         gost: "ГОСТ Р 52544",    grade: "А500С" },
  { slug: "ugolok-stalnoj",     name: "Уголок стальной равнополочный",       gost: "ГОСТ 8509-93",    grade: "Ст3сп" },
  { slug: "shveller-stalnoj",   name: "Швеллер стальной",                    gost: "ГОСТ 8240-97",    grade: "Ст3сп" },
  { slug: "balka-dvutavr",      name: "Балка двутавровая",                   gost: "ГОСТ 8239-89",    grade: "Ст3сп" },
  { slug: "list-goryachekatany",name: "Лист стальной горячекатаный",         gost: "ГОСТ 19903-2015", grade: "Ст3сп/пс" },
  { slug: "profnastil",         name: "Профнастил окрашенный",               gost: "ГОСТ 24045-2010", grade: "Оцинк+ПП" },
  { slug: "list-nerzhaveyushiy",name: "Нержавеющий лист AISI 304",           gost: "ГОСТ 7350-77",    grade: "AISI 304" },
  { slug: "alyuminievyj-prokat",name: "Алюминиевый прокат",                  gost: "ГОСТ 21631-76",   grade: "АД0, АМг2" },
  { slug: "krepezh-ankernyi",   name: "Крепёж анкерный",                     gost: "ГОСТ Р ИСО 898",  grade: "Ст.8.8" },
  { slug: "metizy",             name: "Метизы калиброванные",                gost: "ГОСТ 7798-70",    grade: "Ст.8.8" },
  { slug: "prokat-legirovannyj",name: "Качественный прокат легированный",    gost: "ГОСТ 4543-2016",  grade: "09Г2С" },
  { slug: "flantsy-stalnye",    name: "Фланцы стальные",                     gost: "ГОСТ 12820-80",   grade: "Ст20" },
];

const SYSTEM = `Ты — SEO-копирайтер для B2B металлоторговой компании. Пишешь SEO-статьи о металлопродукции на русском языке.
Стиль: профессиональный, технический, но понятный. Без "водяного" контента. Конкретные данные, ГОСТы, марки стали.
Структура статьи:
- h1: "{product} купить в Москве — цена, доставка"
- Вступление (2 абзаца): что это, основные характеристики
- h2: "Технические характеристики и ГОСТ"
- Параграф с реальными данными по ГОСТ
- h2: "Марки стали и свойства"
- Параграф о марках стали
- h2: "Как выбрать {product}"
- Практические советы
- h2: "Применение в строительстве"
- Где используется
- h2: "Цены на {product} в Москве. Доставка"
- О ценообразовании и доставке по России
Объём: 500-700 слов. LSI-ключи включай естественно.
Отвечай ТОЛЬКО JSON: { "h1": "...", "intro": "...", "sections": [{"h2": "...", "text": "..."}, ...] }`;

async function generateSeoArticle(type: typeof PRODUCT_TYPES[0]) {
  const res = await openai.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Напиши SEO-статью для: ${type.name}. ГОСТ: ${type.gost}. Марка стали: ${type.grade}.` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 2000,
  });

  const text = res.choices[0].message.content ?? "";
  return JSON.parse(text);
}

async function main() {
  mkdirSync(join(process.cwd(), "public/seo"), { recursive: true });

  let ok = 0, fail = 0;
  for (const type of PRODUCT_TYPES) {
    process.stdout.write(`  ${type.slug}... `);
    try {
      const article = await generateSeoArticle(type);
      const output = { slug: type.slug, name: type.name, gost: type.gost, grade: type.grade, ...article };
      writeFileSync(join(process.cwd(), `public/seo/${type.slug}.json`), JSON.stringify(output, null, 2));
      console.log(`✓ "${article.h1?.slice(0, 50)}..."`);
      ok++;
    } catch (e: any) {
      console.log(`✗ ${e.message.slice(0, 80)}`);
      fail++;
    }
    if (ok + fail < PRODUCT_TYPES.length) await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\nDone. OK: ${ok}  Failed: ${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
