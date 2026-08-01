import "server-only";

export interface WeatherSummary {
  avgMinC: number;
  avgMaxC: number;
  likelyRain: boolean;
  coldNights: boolean;
  hotDays: boolean;
  source: "forecast" | "historical-average";
}

// Open-Meteo's forecast model covers roughly this many days ahead; beyond
// that we fall back to actual weather from the same calendar dates a year
// ago as a "what's typical for this time of year" proxy — not a real
// forecast, but a reasonable stand-in for trips planned months out.
const FORECAST_HORIZON_DAYS = 15;
const MAX_SAMPLE_DAYS = 14;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function summarize(
  mins: number[],
  maxes: number[],
  likelyRain: boolean,
  source: WeatherSummary["source"],
): WeatherSummary {
  const avgMinC = average(mins);
  const avgMaxC = average(maxes);
  return {
    avgMinC: Math.round(avgMinC * 10) / 10,
    avgMaxC: Math.round(avgMaxC * 10) / 10,
    likelyRain,
    coldNights: avgMinC < 5,
    hotDays: avgMaxC > 28,
    source,
  };
}

async function getForecast(
  lat: number,
  lon: number,
  startDate: Date,
  numDays: number,
): Promise<WeatherSummary> {
  const endDate = new Date(startDate.getTime() + (numDays - 1) * 86_400_000);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  url.searchParams.set("start_date", isoDate(startDate));
  url.searchParams.set("end_date", isoDate(endDate));
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast request failed (${res.status})`);
  }
  const data = await res.json();
  const maxes: number[] = data.daily.temperature_2m_max;
  const mins: number[] = data.daily.temperature_2m_min;
  const precipProb: number[] = data.daily.precipitation_probability_max;

  return summarize(mins, maxes, precipProb.some((p) => p >= 50), "forecast");
}

async function getHistoricalAverage(
  lat: number,
  lon: number,
  referenceDate: Date,
  numDays: number,
): Promise<WeatherSummary> {
  const year = referenceDate.getUTCFullYear() - 1;
  const start = new Date(
    Date.UTC(year, referenceDate.getUTCMonth(), referenceDate.getUTCDate()),
  );
  const end = new Date(start.getTime() + (numDays - 1) * 86_400_000);

  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum",
  );
  url.searchParams.set("start_date", isoDate(start));
  url.searchParams.set("end_date", isoDate(end));
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo archive request failed (${res.status})`);
  }
  const data = await res.json();
  const maxes: number[] = data.daily.temperature_2m_max;
  const mins: number[] = data.daily.temperature_2m_min;
  const precip: number[] = data.daily.precipitation_sum;

  const rainyDayFraction = precip.filter((p) => p > 1).length / precip.length;
  return summarize(mins, maxes, rainyDayFraction >= 0.3, "historical-average");
}

/**
 * Weather summary for a trip's date range at one location (the route's start
 * point — a whole-route single-location approximation, fine for a packing
 * checklist). Uses the real forecast when the trip starts soon enough, and
 * last year's actual weather on the same calendar dates otherwise.
 */
export async function getWeatherSummary(
  lat: number,
  lon: number,
  referenceDate: Date,
  numDays: number,
): Promise<WeatherSummary> {
  const clampedDays = Math.min(Math.max(numDays, 1), MAX_SAMPLE_DAYS);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const daysUntil = Math.round((referenceDate.getTime() - today.getTime()) / 86_400_000);

  if (daysUntil >= 0 && daysUntil <= FORECAST_HORIZON_DAYS) {
    return getForecast(lat, lon, referenceDate, clampedDays);
  }
  return getHistoricalAverage(lat, lon, referenceDate, clampedDays);
}
