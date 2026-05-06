/**
 * Formats `products.dimensions` JSONB column в human-readable string.
 *
 * Контекст: Pavel'ова migration #c006 поменяла `dimensions` с TEXT на JSONB.
 * Frontend компоненты до этого fix'а рендерили объект напрямую через
 * `{product.dimensions}` → React Error #31 ("Objects are not valid as a React
 * child"). Теперь все renderers идут через эти helpers.
 *
 * Структура объекта зависит от категории продукта (см. patterns ниже).
 * Поля могут отсутствовать частично — функция handles graceful fallback.
 */

type DimensionsRecord = {
  // Лист / профнастил
  thickness_mm?: number | string;
  width_mm?: number | string;
  length_mm?: number | string;
  useful_width_mm?: number | string;
  // Круг / шестигранник
  diameter_mm?: number | string;
  size_mm?: number | string;
  // Труба
  dn_mm?: number | string;
  wall_thickness_mm?: number | string;
  // Suffix metadata
  surface_finish?: string;
  coating_outer?: string;
  manufacturer?: string;
  country_origin?: string;
  // Остальные поля игнорируем (extensible without breaking)
  [k: string]: unknown;
};

function asRecord(dims: unknown): DimensionsRecord | null {
  if (!dims || typeof dims !== "object" || Array.isArray(dims)) return null;
  return dims as DimensionsRecord;
}

/**
 * Полный формат с suffix-метаданными (surface, coating, manufacturer, country).
 * Используется в детальных таблицах (`SpecsTable`, `ProductTabs`).
 *
 * Пример output: `4×1500×6000 мм · 2B · ЧМК · Россия`
 */
export function formatDimensions(dims: unknown): string {
  const d = asRecord(dims);
  if (!d) return "";

  const parts: string[] = [];

  // Pattern 1: Лист / профнастил (thickness × width × length)
  if (d.thickness_mm != null && d.width_mm != null && d.length_mm != null) {
    parts.push(`${d.thickness_mm}×${d.width_mm}×${d.length_mm} мм`);
  } else if (d.thickness_mm != null && d.useful_width_mm != null) {
    // Профнастил: useful_width × thickness [× length]
    if (d.length_mm != null) {
      parts.push(`${d.thickness_mm}×${d.useful_width_mm}×${d.length_mm} мм`);
    } else {
      parts.push(`${d.thickness_mm}×${d.useful_width_mm} мм (длина под заказ)`);
    }
  }
  // Pattern 2: Круг (diameter)
  else if (d.diameter_mm != null) {
    if (d.length_mm != null) {
      parts.push(`Ø${d.diameter_mm}×${d.length_mm} мм`);
    } else {
      parts.push(`Ø${d.diameter_mm} мм`);
    }
  }
  // Pattern 3: Труба (DN × wall)
  else if (d.dn_mm != null && d.wall_thickness_mm != null) {
    let s = `DN${d.dn_mm}×${d.wall_thickness_mm} мм`;
    if (d.length_mm != null) s += ` (${d.length_mm} мм)`;
    parts.push(s);
  }
  // Pattern 4: Шестигранник (size_mm)
  else if (d.size_mm != null) {
    parts.push(`${d.size_mm} мм`);
  }

  // Suffix: surface finish + coating + manufacturer + country (если заполнены)
  if (d.surface_finish) parts.push(String(d.surface_finish));
  if (d.coating_outer) parts.push(String(d.coating_outer));
  if (d.manufacturer) parts.push(`(${d.manufacturer})`);
  if (d.country_origin) parts.push(String(d.country_origin));

  return parts.join(" · ") || "Размер уточняется";
}

/**
 * Compact формат без suffix — только базовые dimensions (без единиц «мм»
 * там, где это узнаваемо из контекста). Используется в table rows и card
 * thumbnails где места мало.
 *
 * Пример output: `4×1500×6000` или `Ø32×3000` или `DN50×3.5`
 */
export function formatDimensionsCompact(dims: unknown): string {
  const d = asRecord(dims);
  if (!d) return "";

  if (d.thickness_mm != null && d.width_mm != null && d.length_mm != null) {
    return `${d.thickness_mm}×${d.width_mm}×${d.length_mm}`;
  }
  if (d.thickness_mm != null && d.useful_width_mm != null) {
    return d.length_mm != null
      ? `${d.thickness_mm}×${d.useful_width_mm}×${d.length_mm}`
      : `${d.thickness_mm}×${d.useful_width_mm}`;
  }
  if (d.diameter_mm != null) {
    return d.length_mm != null
      ? `Ø${d.diameter_mm}×${d.length_mm}`
      : `Ø${d.diameter_mm}`;
  }
  if (d.dn_mm != null && d.wall_thickness_mm != null) {
    return `DN${d.dn_mm}×${d.wall_thickness_mm}`;
  }
  if (d.size_mm != null) return String(d.size_mm);

  return "";
}
