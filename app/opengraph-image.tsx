import { ImageResponse } from "next/og";

/**
 * Default OG image для всего сайта (1200×630 PNG).
 *
 * Next.js автоматически распознаёт `app/opengraph-image.tsx` и подставляет
 * как `og:image` для всех маршрутов, у которых не задан собственный.
 *
 * Cyrillic-поддержка: `next/og` ImageResponse по умолчанию использует
 * системный `system-ui`, который не имеет cyrillic glyphs на Vercel
 * runtime → буквы Х/А/Я отрисуются tofu. Подгружаем Inter Cyrillic
 * через Google Fonts CSS API → достаём .woff2 → преобразуем в font data.
 *
 * Если runtime fetch к Google Fonts упадёт (offline build / CSP) — Next
 * автоматически fall back'нет на статичный `public/og.png` (см. в репо).
 */

export const runtime = "edge";
export const alt = "Харланметалл — металлопрокат и металлоконструкции с доставкой по России";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Достаём Inter 800 (cyrillic). Google Fonts CSS API возвращает CSS с @font-face,
// внутри которого `src: url(...)` указывает на actual .woff/.woff2/.ttf.
// Парсим первый url(...) и фетчим бинарник.
async function loadFont(weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&display=swap&subset=cyrillic`,
    {
      headers: {
        // User-Agent современного браузера → Google отдаёт woff2 (меньше) вместо ttf.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      },
    }
  ).then((r) => r.text());

  const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)/);
  if (!match) throw new Error("OG font url not found in Google Fonts CSS");

  return await fetch(match[1]).then((r) => r.arrayBuffer());
}

export default async function OG() {
  let interBold: ArrayBuffer | null = null;
  try {
    interBold = await loadFont(800);
  } catch {
    // Если font fetch упал — рендерим без custom font (system-ui).
    // Кириллица может оказаться кракозябрами, но image сгенерится.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a1a 100%)",
          color: "#ffffff",
          padding: "80px",
          fontFamily: interBold ? "Inter" : "system-ui, sans-serif",
        }}
      >
        {/* Logo block: ХМ */}
        <div style={{ display: "flex", marginBottom: 40 }}>
          <div
            style={{
              width: 110,
              height: 110,
              background: "#FACC15",
              color: "#000000",
              fontSize: 72,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: interBold ? "Inter" : "Georgia, serif",
            }}
          >
            Х
          </div>
          <div
            style={{
              width: 110,
              height: 110,
              background: "#ffffff",
              color: "#000000",
              fontSize: 72,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: interBold ? "Inter" : "Georgia, serif",
            }}
          >
            М
          </div>
        </div>

        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            textAlign: "center",
            lineHeight: 1.05,
          }}
        >
          ХАРЛАНМЕТАЛЛ
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: "#FACC15",
            marginTop: 16,
            letterSpacing: "0.05em",
          }}
        >
          МЕТАЛЛОПРОКАТ · КОНСТРУКЦИИ
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#cbd5e1",
            marginTop: 36,
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          1500+ позиций · 50+ поставщиков · доставка по всей России
        </div>
      </div>
    ),
    {
      ...size,
      fonts: interBold
        ? [
            { name: "Inter", data: interBold, weight: 800, style: "normal" },
          ]
        : undefined,
    }
  );
}
