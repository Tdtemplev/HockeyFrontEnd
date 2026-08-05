import type { SealedProductOut } from "@/lib/slab/types";

export type OddsUnit = "pack" | "box" | "unknown";

export interface ParsedOdds {
  perPack: number | null;
  perBox: number | null;
  unit: OddsUnit;
  raw: string;
  note?: string;
}

const FORMAT_KEYWORDS: Record<string, string[]> = {
  hobby_box: ["hobby", "epack"],
  blaster_box: ["blaster"],
  retail_box: ["retail"],
  mega_box: ["mega"],
  tin: ["tin"],
  starter: ["starter"],
  hanger: ["hanger"],
};

function parseDenom(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function productMatchesFormats(productFormat: string, formatText: string): boolean {
  const keywords = FORMAT_KEYWORDS[productFormat] ?? [];
  if (keywords.length === 0) return false;
  const normalized = formatText.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

interface OddsSegment {
  perPack: number | null;
  perBox: number | null;
  unit: OddsUnit;
  formats: string;
}

/** Split catalog odds like `1:1,440 (Hobby...), 1:2,880 (Blaster...)` into segments. */
export function parseOddsSegments(odds: string): OddsSegment[] {
  const normalized = odds.replace(/\s+/g, " ").trim();
  const segments: OddsSegment[] = [];

  const withParens =
    /1\s*:\s*([\d,]+(?:\.\d+)?)\s*\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = withParens.exec(normalized)) !== null) {
    const denom = parseDenom(match[1]);
    if (!denom) continue;
    segments.push({
      perPack: 1 / denom,
      perBox: null,
      unit: "pack",
      formats: match[2],
    });
  }

  if (segments.length === 0) {
    const trailingFormat =
      /1\s*:\s*([\d,]+(?:\.\d+)?)\s+([A-Za-z][A-Za-z\s&]+?)(?=,\s*1\s*:|$)/gi;
    while ((match = trailingFormat.exec(normalized)) !== null) {
      const denom = parseDenom(match[1]);
      if (!denom) continue;
      segments.push({
        perPack: 1 / denom,
        perBox: null,
        unit: "pack",
        formats: match[2],
      });
    }
  }

  return segments;
}

export function selectOddsForProduct(
  odds: string,
  product?: Pick<SealedProductOut, "format"> | null,
): ParsedOdds {
  const normalized = odds.toLowerCase().replace(/\s+/g, " ").trim();

  if (/1\s*(?:per|in)\s*(?:hobby\s*)?box/.test(normalized)) {
    return { perPack: null, perBox: 1, unit: "box", raw: odds };
  }

  const perBoxMatch = normalized.match(/1\s*[:/\\-]\s*([\d,]+(?:\.\d+)?)\s*boxes?/);
  if (perBoxMatch) {
    const denom = parseDenom(perBoxMatch[1]);
    return {
      perPack: null,
      perBox: denom ? 1 / denom : null,
      unit: "box",
      raw: odds,
    };
  }

  const segments = parseOddsSegments(odds);
  if (segments.length > 0 && product?.format) {
    const matched =
      segments.find((segment) => productMatchesFormats(product.format, segment.formats)) ??
      segments[0];

    return {
      perPack: matched.perPack,
      perBox: matched.perBox,
      unit: matched.unit,
      raw: odds,
      note:
        segments.length > 1
          ? `Using ${product.format.replaceAll("_", " ")} odds from catalog.`
          : undefined,
    };
  }

  if (segments.length === 1) {
    const segment = segments[0];
    return {
      perPack: segment.perPack,
      perBox: segment.perBox,
      unit: segment.unit,
      raw: odds,
    };
  }

  const perPackMatch = normalized.match(/1\s*[:/\\-]\s*([\d,]+(?:\.\d+)?)\s*packs?/);
  if (perPackMatch) {
    const denom = parseDenom(perPackMatch[1]);
    return {
      perPack: denom ? 1 / denom : null,
      perBox: null,
      unit: "pack",
      raw: odds,
    };
  }

  const ratioMatch = normalized.match(/1\s*[:/\\-]\s*([\d,]+(?:\.\d+)?)/);
  if (ratioMatch) {
    const denom = parseDenom(ratioMatch[1]);
    return {
      perPack: denom ? 1 / denom : null,
      perBox: null,
      unit: "pack",
      raw: odds,
    };
  }

  return { perPack: null, perBox: null, unit: "unknown", raw: odds };
}

/** @deprecated use selectOddsForProduct */
export function parseCatalogOdds(odds: string): ParsedOdds {
  return selectOddsForProduct(odds);
}

export function perBoxFromPacks(perPack: number, packsPerBox: number): number {
  if (packsPerBox <= 0) return perPack;
  return 1 - Math.pow(1 - perPack, packsPerBox);
}

export interface PullOddsInput {
  odds?: string | null;
  printRun?: number | null;
  packsPerBox?: number | null;
  cardsPerPack?: number | null;
  boxCost?: number | null;
  cardValue?: number | null;
  productFormat?: string | null;
}

export interface PullOddsResult {
  perPack: number | null;
  perBox: number | null;
  perSlot: number | null;
  oddsUnit: OddsUnit;
  boxesForHalf: number | null;
  boxesForNinety: number | null;
  expectedValuePerBox: number | null;
  breakEvenFmv: number | null;
  source: "odds" | "print_run" | "unknown";
  note?: string;
}

function boxesNeeded(probabilityPerBox: number, target: number): number | null {
  if (probabilityPerBox <= 0) return null;
  if (probabilityPerBox >= 1) return 1;
  return Math.ceil(Math.log(1 - target) / Math.log(1 - probabilityPerBox));
}

export function calculatePullOdds(input: PullOddsInput): PullOddsResult {
  const packsPerBox = input.packsPerBox ?? null;
  const cardsPerPack = input.cardsPerPack ?? null;
  let perPack: number | null = null;
  let perBox: number | null = null;
  let perSlot: number | null = null;
  let oddsUnit: OddsUnit = "unknown";
  let source: PullOddsResult["source"] = "unknown";
  let note: string | undefined;

  if (input.odds) {
    const parsed = selectOddsForProduct(
      input.odds,
      input.productFormat ? { format: input.productFormat } : null,
    );
    oddsUnit = parsed.unit;
    source = "odds";
    note = parsed.note;

    if (parsed.perBox !== null) {
      perBox = parsed.perBox;
    } else if (parsed.perPack !== null) {
      perPack = parsed.perPack;
      if (packsPerBox && packsPerBox > 0) {
        perBox = perBoxFromPacks(perPack, packsPerBox);
      } else {
        note = "Per-pack odds — select a product with pack count to estimate per box.";
      }
    } else {
      note = `Could not parse odds: "${input.odds}".`;
    }
  } else if (input.printRun) {
    source = "print_run";
    note = `Print run /${input.printRun} — using production count vs pool.`;
  } else {
    note = "No manufacturer odds for this card.";
  }

  if (perPack !== null && input.cardsPerPack && input.cardsPerPack > 0) {
    perSlot = perPack / input.cardsPerPack;
  } else if (perBox !== null && packsPerBox && input.cardsPerPack) {
    const slots = packsPerBox * input.cardsPerPack;
    if (slots > 0) perSlot = perBox / slots;
  }

  const expectedValuePerBox =
    perBox !== null && input.cardValue != null ? perBox * input.cardValue : null;

  const breakEvenFmv =
    perBox !== null && perBox > 0 && input.boxCost != null
      ? input.boxCost / perBox
      : null;

  return {
    perPack,
    perBox,
    perSlot,
    oddsUnit,
    boxesForHalf: perBox !== null ? boxesNeeded(perBox, 0.5) : null,
    boxesForNinety: perBox !== null ? boxesNeeded(perBox, 0.9) : null,
    expectedValuePerBox,
    breakEvenFmv,
    source,
    note,
  };
}

function cardsPerBox(
  packsPerBox: number | null,
  cardsPerPack: number | null,
): number | null {
  if (!packsPerBox || !cardsPerPack) return null;
  return packsPerBox * cardsPerPack;
}

// keep helper available for tests
export { cardsPerBox as slotsPerBox };

export function bestSingleCardPerBox(perBoxValues: number[]): number | null {
  const valid = perBoxValues.filter((value) => value > 0 && value <= 1);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

export function bestExpectedValuePerBox(
  entries: { perBox: number; fmv: number }[],
): number | null {
  if (entries.length === 0) return null;
  return Math.max(...entries.map((entry) => entry.perBox * entry.fmv));
}

export function formatProbability(value: number | null): string {
  if (value === null) return "—";
  if (value >= 0.999) return "99.9%+";
  if (value < 0.0001) return "<0.01%";

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: value < 0.01 ? 2 : 1,
  }).format(value);
}

export function formatBoxes(value: number | null): string {
  if (value === null) return "—";
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}
