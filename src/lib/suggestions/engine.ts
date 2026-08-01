import type { PackingSuggestionRule } from "@prisma/client";

export type Terrain = "flat" | "hilly" | "mountainous";

export interface SuggestionContext {
  likelyRain: boolean;
  coldNights: boolean;
  hotDays: boolean;
  terrain: Terrain;
  countries: string[];
}

export interface SuggestedItem {
  itemName: string;
  categoryName: string;
  reason: string;
}

const MOUNTAINOUS_GAIN_PER_KM = 20;
const HILLY_GAIN_PER_KM = 10;

export function classifyTerrain(elevationGainM: number | null, totalDistanceKm: number): Terrain {
  if (!elevationGainM || totalDistanceKm <= 0) return "flat";
  const gainPerKm = elevationGainM / totalDistanceKm;
  if (gainPerKm >= MOUNTAINOUS_GAIN_PER_KM) return "mountainous";
  if (gainPerKm >= HILLY_GAIN_PER_KM) return "hilly";
  return "flat";
}

/** Evaluates each rule's conditionType against the computed context flags —
 * the rules themselves are just data (seeded, DB-editable); this is the only
 * place that interprets what a condition actually means. */
export function matchRules(
  rules: PackingSuggestionRule[],
  ctx: SuggestionContext,
): SuggestedItem[] {
  const matched: SuggestedItem[] = [];

  for (const rule of rules) {
    let hit = false;
    switch (rule.conditionType) {
      case "weather_rain":
        hit = ctx.likelyRain;
        break;
      case "weather_cold":
        hit = ctx.coldNights;
        break;
      case "weather_hot":
        hit = ctx.hotDays;
        break;
      case "terrain_hilly":
        hit = ctx.terrain === "hilly" || ctx.terrain === "mountainous";
        break;
      case "terrain_mountainous":
        hit = ctx.terrain === "mountainous";
        break;
      case "country":
        hit = !!rule.conditionValue && ctx.countries.includes(rule.conditionValue);
        break;
    }

    if (hit) {
      matched.push({ itemName: rule.itemName, categoryName: rule.categoryName, reason: rule.reason });
    }
  }

  return matched;
}
