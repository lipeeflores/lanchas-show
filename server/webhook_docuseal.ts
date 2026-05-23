import { Request, Response } from 'express';
import { supabaseAdmin } from './supabase';
import { sendWhatsAppMessage } from './evolution';

/**
 * Webhook handler for DocuSeal.
 * Triggers when a document signature is completed.
 */
export async function handleDocusealWebhook(req: Request, res: Response): Promise<void> {
  const body = req.body;
  const event = body.event || '';
  
  // DocuSeal completed signature event is 'form.completed' or similar submission event
  const submission = body.submission || {};
  const submissionId = String(submission.id || body.id || '');

  console.log(`[DocuSeal Webhook] Received event: ${event} | Submission ID: ${submissionId}`);

  if (event === 'form.completed' && submissionId) {
    try {
      // 1. Fetch reservation by DocuSeal submission ID
      const { data: reservation, error: fetchError } = await supabaseAdmin
        .from('reservations')
        .select('*, customers(*), boats(*)')
        .eq('docuseal_submission_id', submissionId)
        .maybeSingle();

      if (fetchError || !reservation) {
        console.error(`[DocuSeal Webhook] Error fetching reservation for submission ID ${submissionId}:`, fetchError);
        res.status(200).json({ status: 'error', reason: 'Reservation not found' });
        return;
      }

      // Check if it's already confirmed
      if (reservation.status === 'CONFIRMED') {
        console.log(`[DocuSeal Webhook] Reservation ${reservation.id} is already CONFIRMED. Skipping.`);
        res.status(200).json({ status: 'ignored', reason: 'Already confirmed' });
        return;
      }

      console.log(`[DocuSeal Webhook] Confirming reservation ${reservation.id} as signed.`);

      // 2. Update reservation status to CONFIRMED
      const { error: updateError } = await supabaseAdmin
        .from('reservations')
        .update({
          status: 'CONFIRMED'
        })
        .eq('id', reservation.id);

      if (updateError) throw updateError;

      const customer = reservation.customers;
      const boat = reservation.boats;

      if (customer) {
        // 3. Send WhatsApp confirmation message
        const confirmationMessage = `Contrato assinado com sucesso! ✅
Sua reserva está oficialmente confirmada!

Desejamos um excelente passeio a bordo! 🛥️✨`;

        await sendWhatsAppMessage(customer.phone, confirmationMessage);

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

          // Set the stage of the conversation to 'reservado'
          await supabaseAdmin
            .from('ia_conversations')
            .update({ stage: 'reservado' })
            .eq('id', conv.id);
        }
      }

      // 5. Create a system alert in system_alerts table for the dashboard
      const boatName = boat?.name || 'Lancha';
      const clientName = customer?.full_name || 'Cliente';
      await supabaseAdmin.from('system_alerts').insert({
        type: 'INFO',
        message: `[CONTRATO] Contrato assinado! Reserva da lancha ${boatName} CONFIRMADA. Cliente: ${clientName}.`,
        is_read: false
      });

      console.log(`[DocuSeal Webhook] Reservation ${reservation.id} successfully updated to CONFIRMED.`);

    } catch (error) {
      console.error(`[DocuSeal Webhook] Error processing signature webhook for submission ID ${submissionId}:`, error);
    }
  }

  // Acknowledge webhook
  res.status(200).json({ status: 'received' });
}
