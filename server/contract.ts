import puppeteer from 'puppeteer';
import { supabaseAdmin } from './supabase';
import { simulateTypingAndSend } from './evolution';

/**
 * Generates a PDF contract from the database HTML template, uploads it to Supabase Storage,
 * creates a DocuSeal submission, updates the reservation status to PENDING_CONTRACT ("em_contrato"),
 * and sends both the contract PDF and DocuSeal signing links to the customer via WhatsApp.
 */
export async function generateAndSendContract(reservationId: string): Promise<void> {
  console.log(`[Contract] Starting contract generation for reservation: ${reservationId}`);

  try {
    // 1. Fetch reservation, customer and boat data
    const { data: res, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('*, customers(*), boats(*)')
      .eq('id', reservationId)
      .single();

    if (resError || !res) {
      throw new Error(resError?.message || 'Reserva não encontrada.');
    }

    const customer = res.customers;
    const boat = res.boats;

    if (!customer || !boat) {
      throw new Error('Dados do cliente ou do barco ausentes na reserva.');
    }

    // 2. Fetch contract template from database
    const { data: templateData, error: templateError } = await supabaseAdmin
      .from('contratos_template')
      .select('html_content')
      .eq('id', 'default')
      .maybeSingle();

    if (templateError) throw templateError;

    let htmlTemplate = templateData?.html_content || '';
    if (!htmlTemplate) {
      throw new Error('Nenhum template de contrato encontrado na tabela contratos_template.');
    }

    // 3. Prepare variables
    const dateObj = new Date(res.start_date);
    // Formatting date as DD/MM/YYYY
    const dataPasseio = dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) || '';
    const name = customer.full_name || '';
    const cpf = customer.document_cpf || 'Não informado';
    const lancha = boat.name || '';
    const roteiro = `${res.boarding_point || 'Embarque'} → ${res.destination || 'Caixa d\'Aço'}`;
    
    const totalVal = Number(res.total_reservation_value || res.total_price || 0);
    const valorTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal);
    const valorEntrada = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal * 0.5);
    const valorRestante = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal * 0.5);

    let extras = 'Nenhum extra contratado';
    if (res.floating_mat_status === 'paid') {
      extras = `Tapete flutuante pago (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.floating_mat_value || 300)})`;
    } else if (res.floating_mat_status === 'courtesy') {
      extras = 'Tapete flutuante cortesia (Brinde)';
    }

    // Replace variables in template
    const contractHtml = htmlTemplate
      .replace(/\{\{nome_cliente\}\}/g, name)
      .replace(/\{\{cpf_cliente\}\}/g, cpf)
      .replace(/\{\{data_passeio\}\}/g, dataPasseio)
      .replace(/\{\{lancha\}\}/g, lancha)
      .replace(/\{\{roteiro\}\}/g, roteiro)
      .replace(/\{\{valor_total\}\}/g, valorTotal)
      .replace(/\{\{valor_entrada\}\}/g, valorEntrada)
      .replace(/\{\{valor_restante\}\}/g, valorRestante)
      .replace(/\{\{extras\}\}/g, extras);

    // 4. Generate PDF using Puppeteer
    console.log('[Contract] Generating PDF file...');
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(contractHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
    });
    await browser.close();

    // 5. Upload PDF to Supabase Storage bucket 'contracts'
    const fileName = `${reservationId}.pdf`;
    console.log(`[Contract] Uploading PDF to Supabase Storage: ${fileName}`);
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('contracts')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from('contracts')
      .getPublicUrl(fileName);

    const pdfUrl = publicUrlData?.publicUrl || '';
    console.log(`[Contract] PDF successfully uploaded. URL: ${pdfUrl}`);

    // Update reservation with PDF url and change status to PENDING_CONTRACT
    await supabaseAdmin
      .from('reservations')
      .update({
        contract_link_url: pdfUrl,
        status: 'PENDING_CONTRACT'
      })
      .eq('id', reservationId);

    // 6. Send contract to DocuSeal API
    const docuSealApiKey = process.env.DOCUSEAL_API_KEY;
    if (!docuSealApiKey) {
      console.warn('[Warning] DOCUSEAL_API_KEY não configurada. Ignorando envio para DocuSeal.');
      
      const whatsappMessageNoDocuseal = `Perfeito! Termo de Efetivação gerado com sucesso 🤩

Acesse o contrato em PDF: ${pdfUrl}

Após ler, confirme com a mensagem:
'Confirmo ciência e concordância com o Termo de Efetivação da Locação da Lanchas Show.'`;

      await simulateTypingAndSend(customer.phone, whatsappMessageNoDocuseal);
      
      // Save outbound IA message
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
          content: whatsappMessageNoDocuseal
        });
      }
      return;
    }

    console.log('[Contract] Submitting contract to DocuSeal API...');
    const pdfBase64 = pdfBuffer.toString('base64');
    
    // Submitter email fallback: DocuSeal requires a valid email structure
    const fallbackEmail = customer.email || `${customer.phone.replace(/\D/g, '')}@lanchasshow.com.br`;

    const docuSealResponse = await fetch('https://api.docuseal.com/submissions/pdf', {
      method: 'POST',
      headers: {
        'X-Auth-Token': docuSealApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file: pdfBase64,
        name: `Contrato de Locação - ${name}`,
        send_email: false, // We will deliver the link manually via WhatsApp
        submitters: [
          {
            name: name,
            email: fallbackEmail,
            phone: customer.phone,
            role: 'Locatário'
          }
        ]
      })
    });

    if (!docuSealResponse.ok) {
      const errText = await docuSealResponse.text();
      throw new Error(`DocuSeal API responded with ${docuSealResponse.status}: ${errText}`);
    }

    const docuSealData = await docuSealResponse.json();
    // DocuSeal returns submitters array or object
    const submitter = Array.isArray(docuSealData) 
      ? docuSealData[0] 
      : (docuSealData.submitters?.[0] || docuSealData);
      
    const signingUrl = submitter.url || '';
    const submissionId = String(submitter.submission_id || docuSealData.id || '');

    console.log(`[Contract] DocuSeal signature request created. Submission ID: ${submissionId} | Signing URL: ${signingUrl}`);

    // Update reservation with DocuSeal submission ID
    await supabaseAdmin
      .from('reservations')
      .update({
        docuseal_submission_id: submissionId
      })
      .eq('id', reservationId);

    // Save outbound IA message
    const whatsappMessage = `Perfeito! Termo de Efetivação gerado com sucesso 🤩

Acesse o contrato em PDF: ${pdfUrl}

Para assinar digitalmente de forma rápida, acesse o link seguro do DocuSeal:
${signingUrl}

Após ler e assinar, por favor confirme com a mensagem:
'Confirmo ciência e concordância com o Termo de Efetivação da Locação da Lanchas Show.'`;

    await simulateTypingAndSend(customer.phone, whatsappMessage);

    // Register IA message in DB
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
        content: whatsappMessage
      });
    }

  } catch (error: any) {
    console.error('[Contract] Error in generateAndSendContract:', error);
  }
}
