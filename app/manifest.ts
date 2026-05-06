import type { MetadataRoute } from "next";

/**
 * Web App Manifest — PWA / Add-to-Home-Screen / Yandex.Браузер pinning.
 *
 * Next.js auto-serves `/manifest.webmanifest` и добавляет
 * `<link rel="manifest" href="/manifest.webmanifest">` во всех `<head>`.
 *
 * Иконки берёт из `app/icon.tsx` (32×32) и `app/apple-icon.tsx` (180×180).
 * Дополнительные размеры можно добавить в массив `icons` ниже — но Next
 * автоматически serv'ит то что есть в `app/`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Харланметалл — Металлопрокат и конструкции",
    short_name: "Харланметалл",
    description:
      "Металлопрокат, трубы, арматура и готовые металлоконструкции. Прямые поставки от производителей.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#FACC15",
    lang: "ru-RU",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
