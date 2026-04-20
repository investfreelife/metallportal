export type MetalType =
  | "armatura" | "krug" | "kvadrat" | "shestigr"
  | "truba_round" | "truba_profile"
  | "balka" | "shveller" | "ugolok" | "polosa" | "list";

export interface MetalDims {
  d?: number;
  D?: number;
  t?: number;
  a?: number;
  b?: number;
  size?: number;
}

const ARMATURA: Record<number, number> = {
  6:0.222, 8:0.395, 10:0.617, 12:0.888, 14:1.208, 16:1.578,
  18:1.998, 20:2.466, 22:2.984, 25:3.853, 28:4.834, 32:6.313,
  36:7.990, 40:9.865,
};
const BALKA: Record<number, number> = {
  10:9.46, 12:11.50, 14:13.70, 16:15.90, 18:18.40, 20:21.00,
  22:24.00, 24:27.30, 27:31.50, 30:36.50, 33:42.20, 36:48.60,
  40:57.00, 45:66.50, 50:78.50, 55:91.00, 60:108.00,
};
const SHVELLER: Record<number, number> = {
  5:4.84, 6.5:5.90, 8:7.05, 10:8.59, 12:10.40, 14:12.30,
  16:14.20, 18:16.30, 20:18.40, 22:21.00, 24:24.00, 27:27.70,
  30:31.80, 33:36.50, 36:41.90, 40:48.30,
};

export function weightPerMeter(type: MetalType, dims: MetalDims): number {
  const r = (v: number) => Math.round(v * 1000) / 1000;
  switch (type) {
    case "armatura": {
      const d = dims.d ?? 0;
      return ARMATURA[d] ?? r(Math.PI / 4 * d * d * 7.85e-3);
    }
    case "krug":
      return r(Math.PI / 4 * (dims.d ?? 0) ** 2 * 7.85e-3);
    case "kvadrat":
      return r((dims.d ?? 0) ** 2 * 7.85e-3);
    case "shestigr":
      return r(Math.sqrt(3) / 2 * (dims.d ?? 0) ** 2 * 7.85e-3);
    case "truba_round": {
      const D = dims.D ?? 0, t = dims.t ?? 0;
      return r((D - t) * t * 0.024661);
    }
    case "truba_profile": {
      const a = dims.a ?? 0, b = dims.b ?? 0, t = dims.t ?? 0;
      return r(2 * t * (a + b - 2 * t) * 7.85e-3);
    }
    case "balka":
      return BALKA[dims.size ?? 0] ?? 0;
    case "shveller":
      return SHVELLER[dims.size ?? 0] ?? 0;
    case "ugolok": {
      const a = dims.a ?? 0, t = dims.t ?? 0;
      return r((2 * a - t) * t * 7.85e-3);
    }
    case "polosa": {
      const a = dims.a ?? 0, b = dims.b ?? 0;
      return r(a * b * 7.85e-3);
    }
    case "list": {
      const t = dims.t ?? 0;
      return r(t * 7.85);
    }
    default:
      return 0;
  }
}

export function searchQuery(type: MetalType, dims: MetalDims): string {
  switch (type) {
    case "armatura": return `арматура ${dims.d}`;
    case "krug": return `круг ${dims.d}`;
    case "kvadrat": return `квадрат ${dims.d}`;
    case "shestigr": return `шестигранник ${dims.d}`;
    case "truba_round": return `труба ${dims.D}`;
    case "truba_profile": return `труба профильная ${dims.a}x${dims.b}x${dims.t}`;
    case "balka": return `балка ${dims.size}`;
    case "shveller": return `швеллер ${dims.size}`;
    case "ugolok": return `уголок ${dims.a}x${dims.t}`;
    case "polosa": return `полоса ${dims.a}x${dims.b}`;
    case "list": return `лист ${dims.t}`;
    default: return "";
  }
}

export const ARMATURA_DIAMETERS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40];
export const BALKA_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33, 36, 40, 45, 50, 55, 60];
export const SHVELLER_SIZES = [5, 6.5, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33, 36, 40];
