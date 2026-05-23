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

    // Check if own-fleet tapete is already reserved on this date (only 1 tapete for the entire own fleet)
    let tapeteDisponivel = true;
    const { data: activeResDetail } = await supabaseAdmin
      .from('reservations')
      .select('start_date, end_date, tapete_status, boats(owner_type)')
      .not('status', 'in', '("CANCELLED","NO_SHOW")');

    if (activeResDetail) {
      const hasBookedTapete = activeResDetail.some((res: any) => {
        const resStart = res.start_date ? res.start_date.substring(0, 10) : '';
        const resEnd = res.end_date ? res.end_date.substring(0, 10) : '';
        const isDateMatch = dateStr >= resStart && dateStr <= resEnd;
        const isOwnFleet = res.boats && res.boats.owner_type === 'OWN';
        const hasTapete = res.tapete_status === 'alugado' || res.tapete_status === 'cortesia';
        return isDateMatch && isOwnFleet && hasTapete;
      });
      if (hasBookedTapete) {
        tapeteDisponivel = false;
      }
    }

    // Fetch all available boats with partner details
    const { data: boats, error: boatsError } = await supabaseAdmin
      .from('boats')
      .select('*, partners(name, contact_phone)')
      .eq('status', 'AVAILABLE');

    if (boatsError || !boats) {
      throw new Error(boatsError?.message || 'Error fetching boats');
    }

    // Filter out booked boats
    const activeBoats = boats.filter(boat => !bookedBoatIds.has(boat.id));
    const activeBoatIds = activeBoats.map(b => b.id);

    // Fetch routes for these active boats
    let routes: any[] = [];
    if (activeBoatIds.length > 0) {
      const { data: routesData, error: routesError } = await supabaseAdmin
        .from('boat_routes_pricing')
        .select('*')
        .in('boat_id', activeBoatIds);
      if (!routesError && routesData) {
        routes = routesData;
      }
    }

    // Map boats and seasonal prices
    const availableBoats = activeBoats.map(boat => {
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

      const boatRoutes = routes
        .filter(r => r.boat_id === boat.id)
        .map(r => {
          let routeNormalPrice = 0;
          let routeMinPrice = 0;

          if (pricingTier === 'high_season') {
            routeNormalPrice = Number(r.price_high_season) || 0;
            routeMinPrice = Number(r.min_price_high_season) || 0;
          } else if (pricingTier === 'weekend_holiday') {
            routeNormalPrice = Number(r.price_weekend_holiday) || 0;
            routeMinPrice = Number(r.min_price_weekend_holiday) || 0;
          } else {
            routeNormalPrice = Number(r.price_low_season) || 0;
            routeMinPrice = Number(r.min_price_low_season) || 0;
          }

          return {
            embarkation_point: r.embarkation_point,
            destination_point: r.destination_point,
            normal_price: routeNormalPrice,
            min_price: routeMinPrice
          };
        });

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
        floating_mat_price: Number(boat.floating_mat_price) || 0,
        catalogo_url: boat.catalogo_url || null,
        partner_name: boat.partners?.name || null,
        partner_phone: boat.partners?.contact_phone || null,
        routes: boatRoutes
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
      tapete_disponivel: tapeteDisponivel,
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

/**
 * Creates a pending reservation in the system.
 */
export async function createPendingReservation(data: {
  phone: string;
  name: string;
  boat_id: string;
  date: string; // YYYY-MM-DD
  boarding_point: string;
  destination: string;
  passenger_count: number;
  floating_mat_status: 'none' | 'paid' | 'courtesy';
  total_price: number;
}) {
  try {
    // 1. Resolve or create customer
    let { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', data.phone)
      .maybeSingle();

    if (custError) throw custError;

    if (!customer) {
      const { data: newCust, error: createCustError } = await supabaseAdmin
        .from('customers')
        .insert({
          full_name: data.name,
          phone: data.phone
        })
        .select('id')
        .single();

      if (createCustError) throw createCustError;
      customer = newCust;
    }

    // Map floating_mat_status to tapete_status
    let tapeteStatus = 'disponivel';
    if (data.floating_mat_status === 'paid') {
      tapeteStatus = 'alugado';
    } else if (data.floating_mat_status === 'courtesy') {
      tapeteStatus = 'cortesia';
    }

    // Calculate dates
    const startDate = `${data.date}T10:00:00-03:00`;
    const endDate = `${data.date}T18:00:00-03:00`;

    // 2. Insert reservation
    const { data: reservation, error: resError } = await supabaseAdmin
      .from('reservations')
      .insert({
        boat_id: data.boat_id,
        customer_id: customer.id,
        start_date: startDate,
        end_date: endDate,
        status: 'PENDING',
        total_price: data.total_price,
        total_reservation_value: data.total_price,
        passenger_count: data.passenger_count,
        boarding_point: data.boarding_point,
        destination: data.destination,
        floating_mat_status: data.floating_mat_status,
        tapete_status: tapeteStatus
      })
      .select('*, boats(name)')
      .single();

    if (resError) throw resError;

    console.log(`[DB Helper] Created pending reservation for client ${data.name} on boat ${(reservation as any).boats?.name}`);
    return { success: true, reservation };
  } catch (error: any) {
    console.error(`[DB Helper] Error creating pending reservation:`, error);
    return { error: error.message || 'Erro ao criar reserva pendente.' };
  }
}

/**
 * Updates customer CPF and triggers contract generation and DocuSeal workflow.
 */
export async function updateCustomerCPF(conversationId: string, cpfStr: string) {
  try {
    // 1. Get conversation to retrieve customer_id
    const { data: conv, error: convError } = await supabaseAdmin
      .from('ia_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) {
      throw new Error(convError?.message || 'Conversa não encontrada');
    }

    let customerId = conv.customer_id;
    const phone = conv.contact_phone;

    // 2. If no customer_id on conversation, find/create customer by phone
    if (!customerId) {
      let { data: customer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (!customer) {
        const { data: newCust, error: createCustError } = await supabaseAdmin
          .from('customers')
          .insert({
            full_name: conv.contact_name,
            phone: phone
          })
          .select('id')
          .single();

        if (createCustError) throw createCustError;
        customer = newCust;
      }
      
      customerId = customer.id;

      // Update conversation with customer_id
      await supabaseAdmin
        .from('ia_conversations')
        .update({ customer_id: customerId })
        .eq('id', conversationId);
    }

    // 3. Update customer's CPF
    const { error: updateCustError } = await supabaseAdmin
      .from('customers')
      .update({ document_cpf: cpfStr })
      .eq('id', customerId);

    if (updateCustError) throw updateCustError;
    console.log(`[DB Helper] Customer ${customerId} CPF updated to: ${cpfStr}`);

    // 4. Find the latest PENDING or PENDING_CONTRACT reservation for this customer
    // to trigger the contract generation
    const { data: reservation, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('id, status')
      .eq('customer_id', customerId)
      .in('status', ['PENDING', 'PENDING_CONTRACT'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resError) throw resError;

    if (reservation) {
      console.log(`[DB Helper] Triggering contract generation for reservation: ${reservation.id}`);
      // Import dynamically to avoid circular dependency
      const { generateAndSendContract } = await import('./contract');
      // Run asynchronously so we don't block the API response
      generateAndSendContract(reservation.id).catch(err => {
        console.error(`[DB Helper] Error in generateAndSendContract background worker:`, err);
      });
    } else {
      console.warn(`[DB Helper] No pending reservation found for customer ${customerId} to generate contract.`);
    }

    return { success: true, cpf: cpfStr };
  } catch (error: any) {
    console.error(`[DB Helper] Error in updateCustomerCPF:`, error);
    return { error: error.message || 'Erro ao atualizar CPF e gerar contrato.' };
  }
}
