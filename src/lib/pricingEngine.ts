import { supabase } from './supabase';

export type PricingTier = 'low_season' | 'high_season' | 'weekend_holiday';

interface PricingResult {
  date: string;
  tier: PricingTier;
  reason: string;
}

/**
 * Determines the pricing tier for a given date.
 * 
 * Priority order:
 *   1. Is the date inside the configured High Season range? → high_season
 *   2. Is the date a Saturday or Sunday? → weekend_holiday
 *   3. Is the date a national holiday (BrasilAPI) or custom holiday? → weekend_holiday
 *   4. Otherwise → low_season
 */
export async function getPricingTier(dateStr: string): Promise<PricingResult> {
  const date = new Date(dateStr + 'T12:00:00'); // Noon to avoid timezone issues
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const year = date.getFullYear();
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
  const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // 1. Fetch global settings from Supabase
  const { data: settings } = await supabase
    .from('global_settings')
    .select('key, value');

  const settingsMap: Record<string, any> = {};
  (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

  const highSeasonStart = (settingsMap['high_season_start'] || '12-15') as string; // MM-DD
  const highSeasonEnd = (settingsMap['high_season_end'] || '02-28') as string;     // MM-DD
  const customHolidays: string[] = (settingsMap['custom_holidays'] || []) as string[];

  // Check 1: High Season
  if (isDateInHighSeason(mmdd, highSeasonStart, highSeasonEnd)) {
    return { date: isoDate, tier: 'high_season', reason: `Dentro da Alta Temporada (${highSeasonStart} a ${highSeasonEnd})` };
  }

  // Check 2: Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { date: isoDate, tier: 'weekend_holiday', reason: dayOfWeek === 0 ? 'Domingo' : 'Sábado' };
  }

  // Check 3: Custom holidays from DB
  if (customHolidays.includes(isoDate) || customHolidays.includes(mmdd)) {
    return { date: isoDate, tier: 'weekend_holiday', reason: 'Feriado/Data especial customizada' };
  }

  // Check 4: National holidays via BrasilAPI
  try {
    const nationalHolidays = await fetchNationalHolidays(year);
    const match = nationalHolidays.find(h => h.date === isoDate);
    if (match) {
      return { date: isoDate, tier: 'weekend_holiday', reason: `Feriado Nacional: ${match.name}` };
    }
  } catch {
    // If API fails, continue — not critical
    console.warn('BrasilAPI unavailable, skipping national holiday check.');
  }

  // Default: Low Season
  return { date: isoDate, tier: 'low_season', reason: 'Dia de semana em baixa temporada' };
}

/**
 * Checks if a MM-DD date falls within a high season range.
 * Handles wrap-around (e.g., Dec 15 → Feb 28).
 */
function isDateInHighSeason(mmdd: string, startMMDD: string, endMMDD: string): boolean {
  if (startMMDD <= endMMDD) {
    // Same year range (e.g., 06-01 to 08-31)
    return mmdd >= startMMDD && mmdd <= endMMDD;
  } else {
    // Wraps around year boundary (e.g., 12-15 to 02-28)
    return mmdd >= startMMDD || mmdd <= endMMDD;
  }
}

interface NationalHoliday {
  date: string;
  name: string;
  type: string;
}

let holidayCache: { year: number; data: NationalHoliday[] } | null = null;

async function fetchNationalHolidays(year: number): Promise<NationalHoliday[]> {
  if (holidayCache && holidayCache.year === year) {
    return holidayCache.data;
  }
  const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
  if (!res.ok) throw new Error('BrasilAPI request failed');
  const data: NationalHoliday[] = await res.json();
  holidayCache = { year, data };
  return data;
}

/**
 * Fetches the suggested price based on the pricing tier and the boat's route configuration.
 */
export async function getRoutePriceSuggestion(
  boatId: string, 
  dateStr: string, 
  embarkation: string, 
  destination: string
): Promise<{ suggestedPrice: number; tier: PricingTier; reason: string }> {
  const tierResult = await getPricingTier(dateStr);
  const tier = tierResult.tier;

  const { data: routePricing, error } = await supabase
    .from('boat_routes_pricing')
    .select('*')
    .eq('boat_id', boatId)
    .eq('embarkation_point', embarkation)
    .eq('destination_point', destination)
    .maybeSingle();

  if (error || !routePricing) {
    return { suggestedPrice: 0, tier, reason: `Rota não encontrada no tarifário. (${tierResult.reason})` };
  }

  let suggestedPrice = 0;
  if (tier === 'high_season') {
    suggestedPrice = Number(routePricing.price_high_season);
  } else if (tier === 'weekend_holiday') {
    suggestedPrice = Number(routePricing.price_weekend_holiday);
  } else {
    suggestedPrice = Number(routePricing.price_low_season);
  }

  return { 
    suggestedPrice: suggestedPrice || 0, 
    tier, 
    reason: `Calculado baseado em: ${tierResult.reason}` 
  };
}

