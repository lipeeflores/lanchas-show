import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const apiKey = process.env.EVOLUTION_API_KEY || '429643a637c6883135f28a8d193d1e6';
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
      
      const webhookUrl = `${backendHost}/api/whatsapp/webhook`;
      console.log(`[Evolution] Automatically configuring webhook to: ${webhookUrl}`);
      
      const webhookRes = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE"
          ]
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
        options: {
          delay: 1500,
          presence: 'composing'
        },
        textMessage: {
          text: text
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
