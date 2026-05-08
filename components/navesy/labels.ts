/**
 * Russian display labels для navesy product attributes.
 * Source: ТЗ #031 LAW navesy-ui-separate-from-metalloprokat.
 */

export const ROOF_SHAPE_LABELS: Record<string, string> = {
  arochny: "Арочный",
  dvuskatny: "Двускатный",
  odnoskatny: "Односкатный",
  poluarchny: "Полуарочный",
  chetyrehskatny: "Четырёхскатный",
  ploskiy: "Плоский",
  konsolny: "Консольный",
};

export const ROOF_MATERIAL_LABELS: Record<string, string> = {
  polikarbonat: "Поликарбонат",
  profnastil: "Профнастил",
  metallocherepitsa: "Металлочерепица",
};

export const REINFORCEMENT_LABELS: Record<string, string> = {
  bez_fermy: "без фермы",
  parnaya_ferma: "парная ферма",
  treugolnaya_ferma: "треугольная ферма",
  arochnaya_ferma: "арочная ферма",
  gorizontalnaya_ferma: "горизонтальная ферма",
};

export function reinforcementLabel(key: string | null | undefined): string {
  if (!key) return "";
  return REINFORCEMENT_LABELS[key] ?? key;
}

export function roofShapeLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return ROOF_SHAPE_LABELS[key] ?? key;
}

export function roofMaterialLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return ROOF_MATERIAL_LABELS[key] ?? key;
}
