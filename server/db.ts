import { supabaseAdmin } from './supabase';

export type PricingTier = 'low_season' | 'high_season' | 'weekend_holiday';

/**
 * Escapes LIKE/ILIKE wildcards (% and _) and backslash in a user-provided string so it
 * can't be used to broaden the match unexpectedly. Necessary because search inputs flow
 * from free-text WhatsApp messages and tool arguments produced by the LLM.
 */
function escapeLikePattern(str: string): string {
  return String(str).replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
}

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
export async function checkBoatAvailability(dateStr: string, includeBooked = false) {
  try {
    const pricingTier = await getPricingTierForDate(dateStr);

    // Fetch active reservations on this date (exclude CANCELLED and NO_SHOW)
    const { data: reservations } = await supabaseAdmin
      .from('reservations')
      .select('id, boat_id, start_date, end_date, status, total_price, total_reservation_value, customers(full_name, phone)')
      .not('status', 'in', '("CANCELLED","NO_SHOW")');

    const bookedBoatIds = new Set<string>();
    const reservationsForDate = new Map<string, any>();
    if (reservations) {
      reservations.forEach(res => {
        const resStart = res.start_date ? res.start_date.substring(0, 10) : '';
        const resEnd = res.end_date ? res.end_date.substring(0, 10) : '';
        if (dateStr >= resStart && dateStr <= resEnd) {
          bookedBoatIds.add(res.boat_id);
          reservationsForDate.set(res.boat_id, res);
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

    // Filter out booked boats only if includeBooked is false
    const activeBoats = includeBooked ? boats : boats.filter(boat => !bookedBoatIds.has(boat.id));
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

      const reservation = reservationsForDate.get(boat.id);

      return {
        id: boat.id,
        name: boat.name,
        capacity: boat.capacity,
        size: boat.size,
        owner_type: boat.owner_type,
        is_own: isOwn,
        available: !reservation,
        current_reservation: reservation ? {
          id: reservation.id,
          status: reservation.status,
          total_price: Number(reservation.total_price) || Number(reservation.total_reservation_value) || 0,
          customer_name: reservation.customers?.full_name || null,
          customer_phone: reservation.customers?.phone || null
        } : null,
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
          base_price_closed: finalTotalPrice,
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
          base_price_closed: finalTotalPrice,
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

export async function broadcastPromotion(customMessage: string, mediaBase64?: string, mediaMimetype?: string) {
  try {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const fifteenDaysAgoStr = fifteenDaysAgo.toISOString();

    // 1. Fetch recent conversation IDs from message activity in the last 15 days
    const { data: recentMsgs, error: msgError } = await supabaseAdmin
      .from('ia_messages')
      .select('conversation_id')
      .gte('created_at', fifteenDaysAgoStr);

    if (msgError) throw msgError;

    const recentConvIds = Array.from(new Set((recentMsgs || []).map(m => m.conversation_id).filter(Boolean)));

    if (recentConvIds.length === 0) {
      return { success: true, count: 0 };
    }

    // 2. Fetch all active AI_CONTROL conversations in negotiation stages that match those IDs
    const { data: conversations, error: convError } = await supabaseAdmin
      .from('ia_conversations')
      .select('id, contact_phone')
      .eq('status', 'AI_CONTROL')
      .in('stage', ['novo', 'cotado', 'sinal_solicitado'])
      .in('id', recentConvIds);

    if (convError) throw convError;
    if (!conversations || conversations.length === 0) {
      return { success: true, count: 0 };
    }

    const { sendWhatsAppMedia, simulateTypingAndSend } = await import('./evolution');

    let count = 0;
    for (const conv of conversations) {
      try {
        if (mediaBase64 && mediaMimetype) {
          // Send media with the customMessage as caption
          await sendWhatsAppMedia(conv.contact_phone, mediaBase64, mediaMimetype, customMessage);
        } else {
          // Send text message with typing animation, so the broadcast looks like a real person texting
          await simulateTypingAndSend(conv.contact_phone, customMessage);
        }

        // Save message in ia_messages
        await supabaseAdmin
          .from('ia_messages')
          .insert({
            conversation_id: conv.id,
            sender: 'IA',
            content: mediaBase64 && mediaMimetype ? `[Mídia] ${customMessage}` : customMessage
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
 * Escalates a client's question (or payment receipt) to the owners' group.
 * Optionally forwards an image (e.g., PIX receipt) alongside the text message.
 */
export async function askOwnersGroup(
  conversationId: string,
  question: string,
  imageBase64?: string,
  imageMimetype?: string
): Promise<any> {
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

    const { sendWhatsAppMessage, sendWhatsAppMedia } = await import('./evolution');
    const response = await sendWhatsAppMessage(ownersGroupJid, messageText);

    // If an image was provided (e.g. PIX receipt), forward it to the group right after the text
    if (imageBase64 && imageMimetype) {
      try {
        const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (supportedTypes.includes(imageMimetype)) {
          const cleanBase64 = imageBase64.includes(';base64,') ? imageBase64.split(';base64,')[1] : imageBase64;
          await sendWhatsAppMedia(ownersGroupJid, cleanBase64, imageMimetype, `📎 Comprovante enviado pelo cliente ${clientName}`);
        }
      } catch (mediaErr) {
        console.warn('[DB Helper] Failed to forward receipt image to owners group:', mediaErr);
      }
    }

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
        .ilike('name', `%${escapeLikePattern(data.boat_name)}%`);

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

/**
 * Searches client conversations by name or phone number.
 * Returns conversation details, stage, status, and recent messages.
 */
export async function searchClientConversations(query: string) {
  try {
    // Search by name (ilike) or by phone (contains)
    const cleanQuery = query.replace(/\D/g, '');
    
    let conversations: any[] = [];

    // Search by name
    const { data: byName } = await supabaseAdmin
      .from('ia_conversations')
      .select('id, contact_name, contact_phone, stage, status, subject, target_date, created_at, pending_owners_question')
      .ilike('contact_name', `%${escapeLikePattern(query)}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (byName) conversations.push(...byName);

    // Also search by phone if the query has digits
    if (cleanQuery.length >= 4) {
      const { data: byPhone } = await supabaseAdmin
        .from('ia_conversations')
        .select('id, contact_name, contact_phone, stage, status, subject, target_date, created_at, pending_owners_question')
        .ilike('contact_phone', `%${escapeLikePattern(cleanQuery)}%`)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (byPhone) {
        const existingIds = new Set(conversations.map(c => c.id));
        byPhone.forEach(c => { if (!existingIds.has(c.id)) conversations.push(c); });
      }
    }

    // Exclude group conversations
    conversations = conversations.filter(c => !c.contact_phone?.endsWith('@g.us'));

    // For each conversation, fetch last 5 messages for context
    const results = [];
    for (const conv of conversations.slice(0, 5)) {
      const { data: messages } = await supabaseAdmin
        .from('ia_messages')
        .select('sender, content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Also check if there are any active reservations for this customer
      let reservationInfo = null;
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('phone', conv.contact_phone)
        .maybeSingle();
      
      if (customer) {
        const { data: reservations } = await supabaseAdmin
          .from('reservations')
          .select('id, status, start_date, total_price, total_reservation_value, paid_amount, boats(name)')
          .eq('customer_id', customer.id)
          .not('status', 'in', '("CANCELLED","NO_SHOW")')
          .order('start_date', { ascending: false })
          .limit(3);
        
        if (reservations && reservations.length > 0) {
          reservationInfo = reservations.map((r: any) => ({
            id: r.id,
            status: r.status,
            date: r.start_date?.substring(0, 10),
            boat: r.boats?.name,
            total_price: Number(r.total_price) || Number(r.total_reservation_value) || 0,
            paid_amount: Number(r.paid_amount) || 0
          }));
        }
      }

      results.push({
        conversation_id: conv.id,
        client_name: conv.contact_name,
        client_phone: conv.contact_phone,
        stage: conv.stage,
        status: conv.status,
        target_date: conv.target_date,
        pending_question: conv.pending_owners_question || null,
        reservations: reservationInfo,
        recent_messages: (messages || []).reverse().map(m => ({
          sender: m.sender,
          content: m.content?.substring(0, 200),
          time: m.created_at
        }))
      });
    }

    return { success: true, results, total_found: conversations.length };
  } catch (error: any) {
    console.error(`[DB Helper] Error searching client conversations:`, error);
    return { error: error.message || 'Erro ao buscar conversas.' };
  }
}

/**
 * Gets a summary of reservations with optional filters.
 */
export async function getReservationsSummary(filters: {
  date?: string;
  date_from?: string;
  date_to?: string;
  client_name?: string;
  boat_name?: string;
  status?: string;
}) {
  try {
    let query = supabaseAdmin
      .from('reservations')
      .select('id, status, start_date, end_date, total_price, total_reservation_value, base_price_closed, paid_amount, commission_value, boarding_point, destination, passenger_count, notes, boats(name, owner_type), customers(full_name, phone)')
      .order('start_date', { ascending: false });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status.toUpperCase());
    } else {
      query = query.not('status', 'in', '("CANCELLED","NO_SHOW")');
    }

    const { data: reservations, error } = await query.limit(50);
    if (error) throw error;

    let results = (reservations || []).map((r: any) => ({
      id: r.id,
      status: r.status,
      date: r.start_date?.substring(0, 10),
      boat: r.boats?.name,
      boat_type: r.boats?.owner_type,
      client: r.customers?.full_name,
      client_phone: r.customers?.phone,
      total_price: Number(r.total_price) || Number(r.total_reservation_value) || 0,
      paid_amount: Number(r.paid_amount) || 0,
      commission: Number(r.commission_value) || 0,
      destination: r.destination,
      passengers: r.passenger_count,
      notes: r.notes
    }));

    // Filter by date
    if (filters.date) {
      results = results.filter(r => r.date === filters.date);
    }
    if (filters.date_from) {
      results = results.filter(r => r.date && r.date >= filters.date_from!);
    }
    if (filters.date_to) {
      results = results.filter(r => r.date && r.date <= filters.date_to!);
    }

    // Filter by client name
    if (filters.client_name) {
      const search = filters.client_name.toLowerCase();
      results = results.filter(r => r.client?.toLowerCase().includes(search));
    }

    // Filter by boat name
    if (filters.boat_name) {
      const search = filters.boat_name.toLowerCase();
      results = results.filter(r => r.boat?.toLowerCase().includes(search));
    }

    const totalRevenue = results.reduce((sum, r) => sum + r.total_price, 0);
    const totalPaid = results.reduce((sum, r) => sum + r.paid_amount, 0);

    return {
      success: true,
      total_reservations: results.length,
      total_revenue: totalRevenue,
      total_paid: totalPaid,
      reservations: results.slice(0, 20)
    };
  } catch (error: any) {
    console.error(`[DB Helper] Error getting reservations summary:`, error);
    return { error: error.message || 'Erro ao buscar reservas.' };
  }
}

/**
 * Gets financial summary (DRE-style) for a given period.
 */
export async function getFinancialSummary(period: 'today' | 'month' | 'custom', dateFrom?: string, dateTo?: string) {
  try {
    const now = new Date();
    const localStr = now.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const todayStr = localStr.substring(0, 10);

    let periodStart: string;
    let periodEnd: string;

    if (period === 'today') {
      periodStart = todayStr;
      periodEnd = todayStr;
    } else if (period === 'month') {
      periodStart = todayStr.substring(0, 7) + '-01';
      periodEnd = todayStr;
    } else {
      periodStart = dateFrom || todayStr;
      periodEnd = dateTo || todayStr;
    }

    // Fetch reservations in the period
    const { data: reservations } = await supabaseAdmin
      .from('reservations')
      .select('id, status, start_date, total_price, total_reservation_value, paid_amount, commission_value, boats(name, owner_type, original_rate, partner_net_value), customers(full_name)')
      .not('status', 'in', '("CANCELLED","NO_SHOW","BLOCKED")');

    // Fetch cash transactions in the period
    const { data: transactions } = await supabaseAdmin
      .from('cash_transactions')
      .select('type, amount, description, created_at');

    let receitaBruta = 0;
    let custosSaida = 0;
    let lucroIntermediacao = 0;
    let totalSinalRecebido = 0;
    const boatBreakdown: any[] = [];

    (reservations || []).forEach((r: any) => {
      const resDate = r.start_date?.substring(0, 10);
      if (!resDate || resDate < periodStart || resDate > periodEnd) return;

      const boat = r.boats;
      if (!boat) return;

      const totalPrice = Number(r.total_price) || Number(r.total_reservation_value) || 0;
      const opCost = r.status === 'COMPLETED' ? Number(boat.original_rate || 0) : 0;
      const paid = Number(r.paid_amount) || 0;

      totalSinalRecebido += paid;

      if (boat.owner_type === 'OWN') {
        receitaBruta += totalPrice;
        custosSaida += opCost;
        boatBreakdown.push({
          boat: boat.name,
          type: 'Frota Própria',
          client: r.customers?.full_name || 'N/A',
          date: resDate,
          status: r.status,
          revenue: totalPrice,
          cost: opCost,
          profit: totalPrice - opCost,
          paid: paid
        });
      } else {
        const commission = Number(r.commission_value) || 0;
        const partnerNet = r.status === 'COMPLETED' ? Number(boat.partner_net_value || 0) : 0;
        const profit = r.status === 'COMPLETED' ? (commission > 0 ? commission : totalPrice - partnerNet) : 0;
        lucroIntermediacao += profit;
        boatBreakdown.push({
          boat: boat.name,
          type: 'Parceiro',
          client: r.customers?.full_name || 'N/A',
          date: resDate,
          status: r.status,
          revenue: totalPrice,
          cost: partnerNet,
          profit: profit,
          paid: paid
        });
      }
    });

    // Cash transaction expenses in the period
    let despesasOperacionais = 0;
    (transactions || []).filter((tx: any) => {
      const txDate = tx.created_at?.substring(0, 10);
      return tx.type === 'EXPENSE' && txDate >= periodStart && txDate <= periodEnd;
    }).forEach((tx: any) => {
      despesasOperacionais += Number(tx.amount) || 0;
    });

    const lucroLiquidoFrotaPropria = receitaBruta - custosSaida - despesasOperacionais;
    const lucroTotal = lucroLiquidoFrotaPropria + lucroIntermediacao;

    return {
      success: true,
      period: { from: periodStart, to: periodEnd },
      receita_bruta: receitaBruta,
      custos_saida_frota_propria: custosSaida,
      despesas_operacionais: despesasOperacionais,
      lucro_liquido_frota_propria: lucroLiquidoFrotaPropria,
      lucro_intermediacao_parceiros: lucroIntermediacao,
      lucro_total: lucroTotal,
      total_sinal_recebido: totalSinalRecebido,
      total_reservas_no_periodo: boatBreakdown.length,
      detalhamento: boatBreakdown
    };
  } catch (error: any) {
    console.error(`[DB Helper] Error getting financial summary:`, error);
    return { error: error.message || 'Erro ao calcular resumo financeiro.' };
  }
}
