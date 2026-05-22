import { supabaseAdmin } from './supabase';

export type PricingTier = 'low_season' | 'high_season' | 'weekend_holiday';

/**
 * Determines the pricing tier for a given date.
 */
export async function getPricingTierForDate(dateStr: string): Promise<PricingTier> {
  const date = new Date(dateStr + 'T12:00:00'); // Noon to avoid timezone issues
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const year = date.getFullYear();
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
  const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const { data: settings } = await supabaseAdmin
    .from('global_settings')
    .select('key, value');

  const settingsMap: Record<string, any> = {};
  (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

  const highSeasonStart = (settingsMap['high_season_start'] || '12-15') as string; // MM-DD
  const highSeasonEnd = (settingsMap['high_season_end'] || '02-28') as string;     // MM-DD
  const customHolidays: string[] = (settingsMap['custom_holidays'] || []) as string[];

  // Helper for High Season
  const isDateInHighSeason = (d: string, start: string, end: string) => {
    if (start <= end) {
      return d >= start && d <= end;
    } else {
      return d >= start || d <= end;
    }
  };

  // 1. High Season
  if (isDateInHighSeason(mmdd, highSeasonStart, highSeasonEnd)) {
    return 'high_season';
  }

  // 2. Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'weekend_holiday';
  }

  // 3. Custom Holidays
  if (customHolidays.includes(isoDate) || customHolidays.includes(mmdd)) {
    return 'weekend_holiday';
  }

  // 4. National Holidays (BrasilAPI)
  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    if (res.ok) {
      const holidays: any[] = await res.json();
      if (holidays.some(h => h.date === isoDate)) {
        return 'weekend_holiday';
      }
    }
  } catch (err) {
    console.warn('[DB Helper] Error fetching BrasilAPI holidays:', err);
  }

  return 'low_season';
}

/**
 * Checks boat availability and rates for a given date.
 * Guarantees that own boats (owner_type = 'OWN') are sorted first in the list.
 */
export async function checkBoatAvailability(dateStr: string) {
  try {
    const pricingTier = await getPricingTierForDate(dateStr);

    // Fetch active reservations on this date (exclude CANCELLED and NO_SHOW)
    const { data: reservations } = await supabaseAdmin
      .from('reservations')
      .select('boat_id, start_date, end_date')
      .not('status', 'in', '("CANCELLED","NO_SHOW")');

    const bookedBoatIds = new Set<string>();
    if (reservations) {
      reservations.forEach(res => {
        const resStart = res.start_date ? res.start_date.substring(0, 10) : '';
        const resEnd = res.end_date ? res.end_date.substring(0, 10) : '';
        if (dateStr >= resStart && dateStr <= resEnd) {
          bookedBoatIds.add(res.boat_id);
        }
      });
    }

    // Fetch all available boats
    const { data: boats, error: boatsError } = await supabaseAdmin
      .from('boats')
      .select('*')
      .eq('status', 'AVAILABLE');

    if (boatsError || !boats) {
      throw new Error(boatsError?.message || 'Error fetching boats');
    }

    // Filter out booked boats and map their seasonal prices
    const availableBoats = boats
      .filter(boat => !bookedBoatIds.has(boat.id))
      .map(boat => {
        let normalPrice = Number(boat.daily_rate) || 0;
        let minPrice = Number(boat.daily_rate) || 0;

        if (pricingTier === 'high_season') {
          normalPrice = Number(boat.price_high_season) || normalPrice;
          minPrice = Number(boat.min_price_high_season) || normalPrice;
        } else if (pricingTier === 'weekend_holiday') {
          normalPrice = Number(boat.price_weekend_holiday) || normalPrice;
          minPrice = Number(boat.min_price_weekend_holiday) || normalPrice;
        } else {
          normalPrice = Number(boat.price_low_season) || normalPrice;
          minPrice = Number(boat.min_price_low_season) || normalPrice;
        }

        const isOwn = boat.owner_type === 'OWN';

        return {
          id: boat.id,
          name: boat.name,
          capacity: boat.capacity,
          size: boat.size,
          owner_type: boat.owner_type,
          is_own: isOwn,
          normal_price: normalPrice,
          min_price: minPrice, // INTERNAL USE ONLY
          has_floating_mat: boat.has_floating_mat,
          floating_mat_price: Number(boat.floating_mat_price) || 0
        };
      });

    // ORDER BY is_own DESC (OWN fleet comes first)
    availableBoats.sort((a, b) => {
      if (a.is_own && !b.is_own) return -1;
      if (!a.is_own && b.is_own) return 1;
      return 0;
    });

    return {
      date: dateStr,
      pricing_tier: pricingTier,
      available_boats: availableBoats
    };
  } catch (error: any) {
    console.error(`[DB Helper] Error checking boat availability:`, error);
    return { error: error.message || 'Erro desconhecido ao consultar barcos.' };
  }
}

/**
 * Updates the stage of a conversation.
 */
export async function updateConversationStage(conversationId: string, stage: string) {
  try {
    const { error } = await supabaseAdmin
      .from('ia_conversations')
      .update({ stage: stage })
      .eq('id', conversationId);

    if (error) throw error;
    console.log(`[DB Helper] Conversation ${conversationId} stage updated to: ${stage}`);
    return { success: true, stage };
  } catch (error: any) {
    console.error(`[DB Helper] Error updating conversation stage:`, error);
    return { error: error.message || 'Erro ao atualizar estágio.' };
  }
}

/**
 * Updates the target date of interest for a conversation.
 */
export async function updateConversationTargetDate(conversationId: string, dateStr: string) {
  try {
    const { error } = await supabaseAdmin
      .from('ia_conversations')
      .update({ target_date: dateStr })
      .eq('id', conversationId);

    if (error) throw error;
    console.log(`[DB Helper] Conversation ${conversationId} target_date updated to: ${dateStr}`);
    return { success: true, target_date: dateStr };
  } catch (error: any) {
    console.error(`[DB Helper] Error updating conversation target_date:`, error);
    return { error: error.message || 'Erro ao atualizar data de interesse.' };
  }
}
