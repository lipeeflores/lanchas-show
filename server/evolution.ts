import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const apiKey = process.env.EVOLUTION_API_KEY || '';
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'lanchas_show';

export interface EvolutionConnectionState {
  instance: {
    instanceName: string;
    state: 'open' | 'close' | 'connecting';
  };
}

export interface QrCodeResponse {
  code?: string;
  base64?: string;
  count?: number;
}

/**
 * Ensures the instance is created in Evolution API and registers its webhook.
 */
export async function ensureInstanceCreated(): Promise<void> {
  try {
    const res = await fetch(`${apiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });
    
    if (res.ok) {
      console.log(`[Evolution] Instance '${instanceName}' checked/created successfully.`);
    } else {
      const data = await res.json().catch(() => ({}));
      // If error is 'instance already exists', it is fine
      if (data.message && data.message.includes('already exists')) {
        console.log(`[Evolution] Instance '${instanceName}' already exists.`);
      } else {
        console.warn(`[Evolution] Warning creating instance:`, data);
      }
    }

    // Configure Webhook if BACKEND_URL or RAILWAY_STATIC_URL is present
    const rawHost = process.env.BACKEND_URL || 
                    (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null);
                        
    if (rawHost) {
      // Ensure no trailing slash and correct https protocol prefix
      let backendHost = rawHost;
      if (!backendHost.startsWith('http://') && !backendHost.startsWith('https://')) {
        backendHost = `https://${backendHost}`;
      }
      if (backendHost.endsWith('/')) {
        backendHost = backendHost.slice(0, -1);
      }
      
      const webhookToken = process.env.EVOLUTION_WEBHOOK_TOKEN;
      const tokenQuery = webhookToken ? `?token=${encodeURIComponent(webhookToken)}` : '';
      const webhookUrl = `${backendHost}/api/whatsapp/webhook${tokenQuery}`;
      console.log(`[Evolution] Automatically configuring webhook to: ${webhookUrl.replace(/token=[^&]+/, 'token=***')}`);
      
      const webhookRes = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: [
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE"
            ]
          }
        })
      });
      
      if (webhookRes.ok) {
        console.log(`[Evolution] Webhook set successfully to ${webhookUrl}`);
      } else {
        const errText = await webhookRes.text();
        console.error(`[Evolution] Failed to set webhook: ${errText}`);
      }
    } else {
      console.warn(`[Evolution] Neither BACKEND_URL nor RAILWAY_STATIC_URL found in env. Webhook not set programmatically.`);
    }
  } catch (error) {
    console.error(`[Evolution] Error in ensureInstanceCreated:`, error);
  }
}

/**
 * Checks WhatsApp connection state for the instance.
 */
export async function getConnectionState(): Promise<'open' | 'close' | 'connecting' | 'unknown'> {
  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });

    if (!res.ok) return 'close';
    const data = await res.json() as EvolutionConnectionState;
    return data?.instance?.state || 'close';
  } catch (error) {
    console.error(`[Evolution] Error checking connection state:`, error);
    return 'unknown';
  }
}

/**
 * Gets the QR Code base64 string or status to display on the frontend.
 */
export async function getConnectQrCode(): Promise<QrCodeResponse | null> {
  try {
    const res = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });

    if (!res.ok) {
      console.error(`[Evolution] Connect returned status ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data as QrCodeResponse;
  } catch (error) {
    console.error(`[Evolution] Error fetching QR Code:`, error);
    return null;
  }
}

/**
 * Sends a text message to a specific WhatsApp JID or number.
 */
export async function sendWhatsAppMessage(toPhone: string, text: string): Promise<any> {
  // Format phone number (must end in @s.whatsapp.net for baileys)
  let recipient = toPhone;
  if (!recipient.includes('@')) {
    // Remove any special characters, spaces, or plus signs
    const sanitized = recipient.replace(/\D/g, '');
    recipient = `${sanitized}@s.whatsapp.net`;
  }

  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: recipient,
        text: text,
        options: {
          delay: 1500,
          presence: 'composing'
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Evolution API responded with status ${res.status}: ${errText}`);
    }

    const responseData = await res.json();
    return responseData;
  } catch (error) {
    console.error(`[Evolution] Error sending message to ${toPhone}:`, error);
    throw error;
  }
}

/**
 * Sends a media message (image, video, document, audio) to a recipient.
 */
export async function sendWhatsAppMedia(toPhone: string, base64Data: string, mimetype: string, caption?: string): Promise<any> {
  let recipient = toPhone;
  if (!recipient.includes('@')) {
    const sanitized = recipient.replace(/\D/g, '');
    recipient = `${sanitized}@s.whatsapp.net`;
  }

  let mediatype = 'document';
  if (mimetype.startsWith('image/')) mediatype = 'image';
  else if (mimetype.startsWith('video/')) mediatype = 'video';
  else if (mimetype.startsWith('audio/')) mediatype = 'audio';

  let cleanBase64 = base64Data;
  if (cleanBase64.includes(';base64,')) {
    cleanBase64 = cleanBase64.split(';base64,')[1];
  }

  const extension = mimetype.split('/')[1]?.split(';')[0] || 'bin';
  const fileName = `media_${Date.now()}.${extension}`;

  try {
    const res = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: recipient,
        mediaMessage: {
          mediatype: mediatype,
          media: cleanBase64,
          fileName: fileName,
          caption: caption || ''
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Evolution API sendMedia responded with status ${res.status}: ${errText}`);
    }

    return await res.json();
  } catch (error) {
    console.error(`[Evolution] Error sending media to ${toPhone}:`, error);
    throw error;
  }
}

/**
 * Simulates human typing: sends composing presence, waits a realistic delay, then sends the message.
 * Use this instead of sendWhatsAppMessage for all automated/scheduled messages.
 */
export async function simulateTypingAndSend(toPhone: string, text: string): Promise<void> {
  const delayMs = Math.min(Math.max(1000 + text.length * 25, 1500), 6000);
  await sendPresence(toPhone, 'composing');
  await new Promise(resolve => setTimeout(resolve, delayMs));
  await sendWhatsAppMessage(toPhone, text);
}

/**
 * Sends presence status (e.g. composing/typing) to a recipient.
 */
export async function sendPresence(toPhone: string, presence: 'composing' | 'paused'): Promise<void> {
  let recipient = toPhone;
  if (!recipient.includes('@')) {
    const sanitized = recipient.replace(/\D/g, '');
    recipient = `${sanitized}@s.whatsapp.net`;
  }

  try {
    const res = await fetch(`${apiUrl}/chat/sendPresence/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: recipient,
        presence: presence
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Evolution] sendPresence failed for ${toPhone}: ${res.status} - ${errText}`);
    }
  } catch (error) {
    console.error(`[Evolution] Error sending presence to ${toPhone}:`, error);
  }
}
