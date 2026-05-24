import { Request, Response } from 'express';
import { supabaseAdmin } from './supabase';
import { simulateTypingAndSend } from './evolution';

/**
 * Webhook handler for Asaas Payment Gateway.
 * Activates when a payment is received/confirmed.
 */
export async function handleAsaasWebhook(req: Request, res: Response): Promise<void> {
  const body = req.body;
  const event = body.event || '';
  const payment = body.payment || {};

  console.log(`[Asaas Webhook] Received event: ${event} | Payment ID: ${payment.id}`);

  // We are interested in payment confirmation/received events
  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    const reservationId = payment.externalReference;
    const value = payment.value;

    if (!reservationId) {
      console.warn('[Asaas Webhook] Warning: externalReference (reservationId) is missing in webhook payload.');
      res.status(200).json({ status: 'ignored', reason: 'Missing externalReference' });
      return;
    }

    try {
      // 1. Fetch reservation, customer and boat details
      const { data: reservation, error: fetchError } = await supabaseAdmin
        .from('reservations')
        .select('*, customers(*), boats(*)')
        .eq('id', reservationId)
        .single();

      if (fetchError || !reservation) {
        console.error(`[Asaas Webhook] Error fetching reservation ${reservationId}:`, fetchError);
        res.status(200).json({ status: 'error', reason: 'Reservation not found' });
        return;
      }

      // Check if it's already past PENDING status to prevent duplicate processing
      if (reservation.status !== 'PENDING') {
        console.log(`[Asaas Webhook] Reservation ${reservationId} is already in state: ${reservation.status}. Skipping.`);
        res.status(200).json({ status: 'ignored', reason: 'Already processed' });
        return;
      }

      console.log(`[Asaas Webhook] Confirming payment of R$ ${value} for reservation ${reservationId}.`);

      // 2. Update reservation status to PENDING_CONTRACT ("em_contrato") and record paid amount
      const { error: updateError } = await supabaseAdmin
        .from('reservations')
        .update({
          status: 'PENDING_CONTRACT',
          paid_amount: Number(value) || 0
        })
        .eq('id', reservationId);

      if (updateError) throw updateError;

      const customer = reservation.customers;
      const boat = reservation.boats;

      if (customer) {
        // 3. Send WhatsApp message to customer requesting CPF and Name
        const confirmationMessage = `Pagamento confirmado ✅
Reserva oficialmente garantida!

Me passa seu nome completo e CPF para o contrato 😊`;

        await simulateTypingAndSend(customer.phone, confirmationMessage);

        // 4. Save outbound message to ia_messages
        const { data: conv } = await supabaseAdmin
          .from('ia_conversations')
          .select('id')
          .eq('contact_phone', customer.phone)
          .limit(1)
          .maybeSingle();

        if (conv) {
          await supabaseAdmin.from('ia_messages').insert({
            conversation_id: conv.id,
            sender: 'IA',
            content: confirmationMessage
          });

          // Also set the stage of the conversation to 'pix_enviado' (or similar)
          await supabaseAdmin
            .from('ia_conversations')
            .update({ stage: 'pix_enviado' })
            .eq('id', conv.id);
        }
      }

      // 5. Create a system alert in system_alerts table for the dashboard
      const boatName = boat?.name || 'Lancha';
      const clientName = customer?.full_name || 'Cliente';
      await supabaseAdmin.from('system_alerts').insert({
        type: 'PIX',
        amount: Number(value) || 0,
        message: `[PAGAMENTO] Reserva da lancha ${boatName} confirmada via PIX! Cliente: ${clientName}.`,
        is_read: false
      });

      console.log(`[Asaas Webhook] Reservation ${reservationId} successfully transitioned to PENDING_CONTRACT.`);

    } catch (error) {
      console.error(`[Asaas Webhook] Error processing webhook event for reservation ${reservationId}:`, error);
    }
  }

  // Acknowledge webhook
  res.status(200).json({ status: 'received' });
}
