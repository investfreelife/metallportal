import { ImageResponse } from "next/og";

/**
 * Apple touch icon (180×180) — для iOS home-screen и macOS Safari pinned tabs.
 * Next.js auto-generates `<link rel="apple-touch-icon">`.
 *
 * Стиль такой же как favicon (`app/icon.tsx`) — Х на золотом, увеличенный.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FACC15",
          color: "#000000",
          fontSize: 130,
          fontWeight: 900,
          fontFamily: "Georgia, serif",
        }}
      >
        Х
      </div>
    ),
    { ...size }
  );
}
