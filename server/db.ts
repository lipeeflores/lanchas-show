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
  phone?: string;
  name?: string;
  boat_id: string;
  date: string; // YYYY-MM-DD
  boarding_point?: string;
  destination?: string;
  passenger_count?: number;
  floating_mat_status?: 'none' | 'paid' | 'courtesy';
  total_price?: number;
  status?: string;
}) {
  try {
    const finalPhone = data.phone || '00000000000';
    const finalName = data.name || 'Bloqueio / Manutenção';
    const finalBoardingPoint = data.boarding_point || 'Porto Belo';
    const finalDestination = data.destination || 'Caixa d\'Aço';
    const finalPassengerCount = Number(data.passenger_count) || 1;
    const finalFloatingMat = data.floating_mat_status || 'none';
    const finalTotalPrice = Number(data.total_price) || 0;
    const finalStatus = data.status || 'PENDING';

    // 1. Resolve or create customer
    let { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', finalPhone)
      .maybeSingle();

    if (custError) throw custError;

    if (!customer) {
      const { data: newCust, error: createCustError } = await supabaseAdmin
        .from('customers')
        .insert({
          full_name: finalName,
          phone: finalPhone
        })
        .select('id')
        .single();

      if (createCustError) throw createCustError;
      customer = newCust;
    }

    // Map floating_mat_status to tapete_status
    let tapeteStatus = 'disponivel';
    if (finalFloatingMat === 'paid') {
      tapeteStatus = 'alugado';
    } else if (finalFloatingMat === 'courtesy') {
      tapeteStatus = 'cortesia';
    }

    // Calculate dates
    const startDate = `${data.date}T10:00:00-03:00`;
    const endDate = `${data.date}T18:00:00-03:00`;

    // 2. Check if there is already an existing reservation for this boat and date to avoid duplicates and allow updates
    const { data: existingRes, error: findError } = await supabaseAdmin
      .from('reservations')
      .select('id')
      .eq('boat_id', data.boat_id)
      .eq('start_date', startDate)
      .maybeSingle();

    if (findError) {
      console.warn("[DB Helper] Error finding existing reservation, proceeding to insert:", findError.message);
    }

    let reservation = null;
    let resError = null;

    if (existingRes?.id) {
      console.log(`[DB Helper] Reservation already exists (ID: ${existingRes.id}). Updating it...`);
      const { data: updatedRes, error } = await supabaseAdmin
        .from('reservations')
        .update({
          customer_id: customer.id,
          status: finalStatus,
          total_price: finalTotalPrice,
          total_reservation_value: finalTotalPrice,
          passenger_count: finalPassengerCount,
          boarding_point: finalBoardingPoint,
          destination: finalDestination,
          floating_mat_status: finalFloatingMat,
          tapete_status: tapeteStatus
        })
        .eq('id', existingRes.id)
        .select('*, boats(name)')
        .single();
      
      resError = error;
      reservation = updatedRes;
    } else {
      const { data: insertedRes, error } = await supabaseAdmin
        .from('reservations')
        .insert({
          boat_id: data.boat_id,
          customer_id: customer.id,
          start_date: startDate,
          end_date: endDate,
          status: finalStatus,
          total_price: finalTotalPrice,
          total_reservation_value: finalTotalPrice,
          passenger_count: finalPassengerCount,
          boarding_point: finalBoardingPoint,
          destination: finalDestination,
          floating_mat_status: finalFloatingMat,
          tapete_status: tapeteStatus
        })
        .select('*, boats(name)')
        .single();
      
      resError = error;
      reservation = insertedRes;
    }

    if (resError) throw resError;

    console.log(`[DB Helper] Saved reservation (${finalStatus}) for client ${finalName} on boat ${(reservation as any).boats?.name}`);
    return { success: true, reservation };
  } catch (error: any) {
    console.error(`[DB Helper] Error creating reservation:`, error);
    return { error: error.message || 'Erro ao criar reserva.' };
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

/**
 * Sends a promotional broadcast message to all active AI-controlled conversations.
 */
export async function broadcastPromotion(customMessage: string) {
  try {
    // 1. Fetch all active AI_CONTROL conversations in negotiation stages
    const { data: conversations, error: convError } = await supabaseAdmin
      .from('ia_conversations')
      .select('id, contact_phone')
      .eq('status', 'AI_CONTROL')
      .in('stage', ['novo', 'cotado', 'sinal_solicitado']);

    if (convError) throw convError;
    if (!conversations || conversations.length === 0) {
      return { success: true, count: 0 };
    }

    const { sendWhatsAppMessage } = await import('./evolution');

    let count = 0;
    for (const conv of conversations) {
      try {
        // Send message via WhatsApp
        await sendWhatsAppMessage(conv.contact_phone, customMessage);

        // Save message in ia_messages
        await supabaseAdmin
          .from('ia_messages')
          .insert({
            conversation_id: conv.id,
            sender: 'IA',
            content: customMessage
          });

        count++;
      } catch (err) {
        console.error(`[DB Helper] Failed to send broadcast to ${conv.contact_phone}:`, err);
      }
    }

    return { success: true, count };
  } catch (error: any) {
    console.error(`[DB Helper] Error broadcasting promotion:`, error);
    return { error: error.message || 'Erro ao enviar transmissão promocional.' };
  }
}

/**
 * Escalates a client's question to the owners' group, storing the message ID to map the future reply.
 */
export async function askOwnersGroup(conversationId: string, question: string): Promise<any> {
  const ownersGroupJid = process.env.OWNERS_GROUP_JID;
  if (!ownersGroupJid) {
    console.warn('[DB Helper] OWNERS_GROUP_JID is not defined in env. Cannot escalate question.');
    return { error: 'O grupo de proprietários não está configurado nas variáveis de ambiente.' };
  }

  try {
    // 1. Fetch conversation details to know the client
    const { data: conv, error: convError } = await supabaseAdmin
      .from('ia_conversations')
      .select('contact_name, contact_phone')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) throw new Error(convError?.message || 'Conversa não encontrada');

    const clientName = conv.contact_name || 'Desconhecido';
    const clientPhone = conv.contact_phone || 'Desconhecido';

    const messageText = `❓ *DÚVIDA DE CLIENTE*\n\n*Cliente:* ${clientName} (${clientPhone})\n*Dúvida:* ${question}\n\n_Para responder, responda (Marcar/Citar) esta mensagem com a resposta que deseja enviar ao cliente._`;

    const { sendWhatsAppMessage } = await import('./evolution');
    const response = await sendWhatsAppMessage(ownersGroupJid, messageText);

    const messageId = response?.key?.id || response?.messageId || '';

    if (messageId) {
      // 2. Update conversation with the pending question and the message ID
      await supabaseAdmin
        .from('ia_conversations')
        .update({
          pending_owners_message_id: messageId,
          pending_owners_question: question
        })
        .eq('id', conversationId);

      console.log(`[DB Helper] Escalated question to owners' group. Message ID: ${messageId}`);
      return { success: true, messageId };
    } else {
      console.warn('[DB Helper] Could not extract message ID from Evolution API response:', response);
      return { success: true };
    }
  } catch (error: any) {
    console.error(`[DB Helper] Error escalating question to owners' group:`, error);
    return { error: error.message || 'Erro ao enviar a pergunta ao grupo de proprietários.' };
  }
}

/**
 * Resolves a boat by ID or name, finds the active reservation for that boat on the specified date,
 * and updates its status to 'COMPLETED'.
 */
export async function completeBoarding(data: {
  boat_id?: string;
  boat_name?: string;
  date: string;
}) {
  try {
    let boatId = data.boat_id;

    // 1. Resolve boat by name if boat_id is not provided
    if (!boatId && data.boat_name) {
      const { data: boats, error: boatsError } = await supabaseAdmin
        .from('boats')
        .select('id, name')
        .ilike('name', `%${data.boat_name}%`);

      if (boatsError) throw boatsError;
      if (!boats || boats.length === 0) {
        return { success: false, error: `Nenhuma lancha encontrada com o nome "${data.boat_name}".` };
      }
      boatId = boats[0].id;
    }

    if (!boatId) {
      return { success: false, error: 'Por favor, forneça o UUID ou o nome da lancha.' };
    }

    // Calculate dates matching the day (start_date starts with the date string YYYY-MM-DD)
    const { data: resList, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('id, status, boats(name)')
      .eq('boat_id', boatId)
      .like('start_date', `${data.date}%`);

    if (resError) throw resError;
    if (!resList || resList.length === 0) {
      return { success: false, error: `Nenhuma reserva ativa encontrada para esta lancha na data ${data.date}.` };
    }

    // Filter to find reservations that are active (not BLOCKED, CANCELLED, NO_SHOW, and not already COMPLETED)
    const reservation = resList.find(r => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW');

    if (!reservation) {
      return { success: false, error: `Nenhuma reserva ativa encontrada para esta lancha na data ${data.date}.` };
    }

    const boatName = (reservation as any).boats?.name || (reservation as any).boats?.[0]?.name || '';

    if (reservation.status === 'COMPLETED') {
      return { success: true, message: `O embarque da lancha ${boatName} já constava como Concluído no sistema.`, reservation };
    }

    // 2. Update status to COMPLETED
    const { data: updatedRes, error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({ status: 'COMPLETED' })
      .eq('id', reservation.id)
      .select('*, boats(name)')
      .single();

    if (updateError) throw updateError;

    const updatedBoatName = (updatedRes as any).boats?.name || (updatedRes as any).boats?.[0]?.name || '';

    console.log(`[DB Helper] Boarding completed successfully for reservation ${reservation.id} (Boat: ${updatedBoatName})`);
    return { success: true, message: `Embarque confirmado com sucesso! O status da reserva da lancha ${updatedBoatName} foi alterado para CONCLUÍDO e os custos operacionais foram computados.`, reservation: updatedRes };

  } catch (error: any) {
    console.error(`[DB Helper] Error completing boarding:`, error);
    return { success: false, error: error.message || 'Erro interno ao registrar embarque.' };
  }
}
