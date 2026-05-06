import { ImageResponse } from "next/og";

/**
 * Favicon (32×32) — буква Х на золотом фоне (brand mark).
 * Next.js auto-generates `<link rel="icon">` для всех страниц.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 24,
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
