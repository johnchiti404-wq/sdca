export const UNIT_WEIGHT_KG = { bag: 10, pack: 1 };

export const DEFAULT_ITEM_KG: Record<string, number> = {
  food: 0.5,
  clothes: 0.6,
  hardware: 2,
  market: 1,
  small_shop: 0.5,
};

export function parseUnitToKg(unit: string | undefined | null, fallbackKg: number): number {
  const fallback = Number.isFinite(fallbackKg) && fallbackKg >= 0 ? fallbackKg : 0;
  const text = (unit ?? '').trim().toLowerCase();
  if (!text) return fallback;

  let index = 0;
  let numberText = '';
  let decimalSeen = false;
  while (index < text.length) {
    const char = text[index];
    if (char >= '0' && char <= '9') {
      numberText += char;
      index += 1;
    } else if (char === '.' && !decimalSeen) {
      decimalSeen = true;
      numberText += char;
      index += 1;
    } else {
      break;
    }
  }

  const rawUnit = text.slice(index).trim();
  const implicitNumber = rawUnit === 'bag' || rawUnit === 'bags' || rawUnit === 'pack' || rawUnit === 'packs' ? 1 : null;
  const amount = numberText ? Number(numberText) : implicitNumber;
  if (amount === null || !Number.isFinite(amount) || amount < 0) return fallback;

  let result: number;
  switch (rawUnit) {
    case 'kg': case 'kgs': case 'l': case 'litre': case 'liter': case 'ltr': result = amount; break;
    case 'g': case 'gram': case 'grams': case 'ml': result = amount / 1000; break;
    case 'bag': case 'bags': result = amount * UNIT_WEIGHT_KG.bag; break;
    case 'pack': case 'packs': result = amount * UNIT_WEIGHT_KG.pack; break;
    default: return fallback;
  }

  return Number.isFinite(result) && result >= 0 ? Math.round(result * 1000) / 1000 : fallback;
}
