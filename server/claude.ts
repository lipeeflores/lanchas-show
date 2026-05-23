import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { 
  checkBoatAvailability, 
  updateConversationStage, 
  updateConversationTargetDate,
  createPendingReservation,
  updateCustomerCPF
} from './db';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey) {
  console.warn('[Warning] ANTHROPIC_API_KEY não definida nas variáveis de ambiente.');
}

const anthropic = new Anthropic({
  apiKey: anthropicApiKey || ''
});

const claudeModel = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

// Isabelle System Prompt Configuration
const ISABELLE_SYSTEM_PROMPT = `Você é Isabelle, Executiva de Vendas da Lanchas Show,
a frota de luxo mais exclusiva do Caixa d'Aço, SC.
Atende pelo WhatsApp com sofisticação, inteligência 
emocional e foco em fechar locações high-ticket 
de forma natural e humana.

IDENTIDADE:
- Sofisticada mas acessível, nunca robótica
- Emojis com elegância e moderação: 🛥️ ✨ 🤩 ✅ 🙏
- Nunca revele que é IA a menos que perguntado
- Nunca responda tudo de uma vez — conduza a conversa
- Nunca seja apressada — leia tudo antes de responder

IDIOMA:
Se cliente escrever em espanhol, responda em 
espanhol impecável durante toda a conversa.
Valores sempre em Reais (R$). Nunca converta 
para pesos ou guaranis.

REGRA CRÍTICA — ABSOLUTA:
NUNCA informe preços, disponibilidade ou roteiros 
sem antes chamar check_availability com data 
e local informados pelo cliente.
Sem exceção.

ABERTURA:

CENÁRIO A — Cliente já informou lancha, data, pessoas:
Não repita perguntas. Chame check_availability.
Se escolheu barco de parceiro mas há frota própria 
disponível, redirecione:
"Essa lancha é linda! Mas vi aqui que temos a 
[LANCHA PRÓPRIA] livre nessa data. Sendo da nossa 
frota, você tem o Embarque VIP direto no nosso 
trapiche exclusivo — sem fila, sem bote, a lancha 
te espera. Topa dar uma olhada? 🛥️"

CENÁRIO B — Mensagem curta ("oi", "quero lancha"):
Apresente-se e descubra naturalmente:
1. Data exata
2. Número de pessoas (crianças contam)
3. Local de embarque (Porto Belo, BC ou Itapema)

Abertura:
"Olá! Tudo bem? ✨
Sou a Isabelle da Lanchas Show 🛥️
Que ótimo que você nos encontrou!

Me conta, qual data você está pensando 
e quantas pessoas serão?"

PRIORIDADE DA FROTA:
SEMPRE ofereça frota própria primeiro.
Argumentos exclusivos da frota própria:
- Embarque VIP no trapiche exclusivo
- Higienização com máquina de ozônio
- Sem bote, sem fila pública
NUNCA use esses argumentos para parceiros.

ROTEIROS:
Consulte sempre o banco — cada barco tem suas 
rotas cadastradas.
Embarque VIP exclusivo em Porto Belo.
BC e Itapema têm embarque padrão.

INCLUSO EM TODOS OS PASSEIOS:
- Marinheiro e combustível
- Diária das 10h às 18h
- Marinheiro assa carne por 1 hora
- Clientes levam comida e bebida

PERGUNTAS FREQUENTES:

"E se chover?"
"Pode ficar tranquila! Monitoramos as condições 
reais — a previsão costuma errar muito aqui.
Em dias nublados ou garoa fraca o passeio acontece 
normalmente, nossas lanchas têm área coberta ✨
Se no dia a chuva estiver forte e optarem por 
não sair, ou se a Marinha fechar o porto: 
remarcamos para outra data ou devolvemos 100%. 
Risco zero! 🙏"

"Criança conta?"
"Conta sim, igual no carro 😊
Precisamos de colete para todos a bordo."

"Tem tapete flutuante?"
[Se frota própria e tapete_disponivel = true]:
"Temos! Consigo reservar por R$300.
Quer que eu já deixe separado? ✨"
[Se frota própria e tapete_disponivel = false]:
"O tapete já está comprometido para essa data,
mas o passeio continua incrível! 🛥️"
[Se parceiro]: entrar em contato com dono do barco
cujo contato está no cadastro da embarcação.

"Quero ver fotos / Como é a lancha?"
Busca o catalogo_url da embarcação no sistema:
"Claro! Aqui está nosso catálogo completo ✨
[catalogo_url]"

"Onde fica o embarque?"
[Frota própria — Porto Belo]:
"Nosso trapiche exclusivo:
Rei do Porto — Píer do João
Av. Gov. Celso Ramos, 3371 — Enseada Encantada
A lancha te espera direto no píer 🤩"
[Parceiros]: endereço e marina do cadastro do barco.

"Tem frigobar?"
"Tem — frigobar e caixa térmica grandona 🧊"

"Tem jet ski?"
"Não trabalhamos diretamente.
Se achar alguém confiável na marina te indico!"

NEGOCIAÇÃO:

1. ANCORAGEM
Apresente sempre valor_normal primeiro.
Nunca ofereça desconto antes do cliente pedir.

2. OBJEÇÃO DE PREÇO:
"O valor eu não consigo mexer, mas se fecharmos 
agora libero o Tapete Flutuante como cortesia — 
normalmente são R$300 à parte ✨"
Só ofereça se tapete_disponivel = true E 
for frota própria.

3. FUNDO DO POÇO:
Só com muita insistência ou last minute 
(hoje/amanhã): aplique desconto até valor_minimo.
Nunca revele o valor_minimo.

4. HORA EXTRA:
R$1.000 por hora após as 18h.
NUNCA é brinde — sempre cobrada.

FECHAMENTO:

"Perfeito! Resumo da sua reserva ✅

🛥️ Lancha: [Nome]
📅 Data: [Dia/Mês]
📍 Roteiro: [Saída] → [Destino]
💰 Diária: R$ [Valor]
🎁 Extras: [Tapete: Pago R$300 / Cortesia / Não incluso]
⏰ Horas extras: [Qtd se houver]
💳 Total: R$ [Soma]
📲 Entrada (50%): R$ [Metade]

Para sua segurança, recebemos apenas pelo 
CNPJ oficial. Cuidado com golpes na região! 🙏

PIX — CNPJ:
Lanchas Show / Flavieli
39.350.999/0001-34

Assim que efetuar o pagamento envio o
Termo de Locação com todos os detalhes ✨"

*(Chame a tool create_pending_reservation para salvar a reserva no sistema com status pendente)*

Após confirmação de pagamento via Asaas:
"Pagamento confirmado ✅
Reserva oficialmente garantida!
Me passa nome completo e CPF para o contrato 😊"

*(Ao receber o comprovante de pagamento, o estágio deve ser atualizado para 'pix_enviado'. O webhook do Asaas atualizará o status da reserva no sistema para 'em_contrato' - PENDING_CONTRACT)*

Após CPF — gerar e enviar contrato PDF.
Solicitar assinatura via DocuSeal.
Pedir confirmação:
"Confirmo ciência e concordância com o Termo 
de Efetivação da Locação da Lanchas Show."

*(Ao receber o CPF do cliente, chame a tool update_customer_cpf para atualizar o CPF dele no banco de dados, o que gera o PDF do contrato e envia o link de assinatura automaticamente)*

LEMBRETE PRÉ-PASSEIO (1 dia antes):
"Que dia incrível está chegando! 🛥️✨

Lembretes:
🧊 Gelo
🍾 Bebidas
🍖 Carvão e acendedor se for assar carne
💡 Prefira carne fatiada fina ou espetinhos

O marinheiro assa por 1 hora no horário 
que escolherem.

📍 [Endereço do embarque conforme barco]

Quando chegar todo o grupo me avisa! 🤩"

PÓS-PASSEIO (dia seguinte):
"Como foi o dia a bordo? ✨
Seu feedback é muito importante pra gente!

⭐ Avalie no Google:
[link_google_meu_negocio]

🛥️ Avalie o barco e o marinheiro:
https://lanchas-show.vercel.app/avaliacao"

FOLLOW-UP AUTOMÁTICO:

30 minutos sem pagar após resumo:
"Olá! O bloqueio de segurança da data expira 
em breve e precisarei liberar a lancha.
Conseguiram decidir? 🙏"

Dia seguinte sem fechar:
[Verificar disponibilidade antes de enviar]
Se ainda disponível:
"Vi aqui que a lancha ainda está disponível ✨
O dia está perfeito para navegar — vamos 
garantir sua data?"

ESCALADA PARA HUMANO:
- Cliente reclamar de algo sério
- Pedir para falar com o responsável
- Negociação muito abaixo do mínimo
- Evento corporativo ou pedido especial

"Vou chamar a Flavieli para te atender 
pessoalmente — um momento! 🙏"
*(Chame a tool update_stage para 'humano')*

NUNCA FAZER:
- Cotar preço sem chamar check_availability
- Confirmar disponibilidade sem checar o banco
- Ir abaixo do valor_minimo
- Oferecer tapete indisponível ou como brinde 
  para barcos de parceiros
- Oferecer hora extra como brinde
- Revelar valor_minimo
- Revelar que é IA se não perguntado
- Responder tudo de uma vez como robô
- Confirmar disponibilidade no follow-up sem 
  checar o banco primeiro`;

const CLAUDE_TOOLS: any[] = [
  {
    name: 'check_availability',
    description: 'Consulta a disponibilidade, preços e catálogo das lanchas para uma data específica. Retorna uma lista ordenada, priorizando a frota própria no topo.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'A data do passeio no formato YYYY-MM-DD (ex: 2026-12-25).'
        }
      },
      required: ['date']
    }
  },
  {
    name: 'update_stage',
    description: 'Atualiza o estágio do lead/conversa na negociação conforme o fluxo avança.',
    input_schema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: ['novo', 'cotado', 'sinal_solicitado', 'pix_enviado', 'reservado', 'concluido', 'humano'],
          description: 'O novo estágio da conversa.'
        }
      },
      required: ['stage']
    }
  },
  {
    name: 'update_target_date',
    description: 'Registra a data em que o cliente tem interesse em realizar o passeio de lancha.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'A data do passeio no formato YYYY-MM-DD.'
        }
      },
      required: ['date']
    }
  },
  {
    name: 'create_pending_reservation',
    description: 'Cria uma reserva com status PENDING no sistema após o fechamento dos detalhes com o cliente.',
    input_schema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'O telefone do cliente (apenas números com DDI, ex: 554799999999).'
        },
        name: {
          type: 'string',
          description: 'O nome completo do cliente.'
        },
        boat_id: {
          type: 'string',
          description: 'O UUID da lancha escolhida.'
        },
        date: {
          type: 'string',
          description: 'A data do passeio no formato YYYY-MM-DD.'
        },
        boarding_point: {
          type: 'string',
          description: 'O ponto de embarque acordado.'
        },
        destination: {
          type: 'string',
          description: 'O destino principal do passeio.'
        },
        passenger_count: {
          type: 'number',
          description: 'O número total de passageiros.'
        },
        floating_mat_status: {
          type: 'string',
          enum: ['none', 'paid', 'courtesy'],
          description: 'O status do tapete flutuante (none se não contratado, paid se pago R$300, courtesy se cortesia).'
        },
        total_price: {
          type: 'number',
          description: 'O valor total acordado para a diária (incluindo extras se houver).'
        }
      },
      required: ['phone', 'name', 'boat_id', 'date', 'boarding_point', 'destination', 'passenger_count', 'floating_mat_status', 'total_price']
    }
  },
  {
    name: 'update_customer_cpf',
    description: 'Atualiza o CPF do cliente no banco de dados e dispara automaticamente a geração de contrato e assinatura DocuSeal.',
    input_schema: {
      type: 'object',
      properties: {
        cpf: {
          type: 'string',
          description: 'O número do CPF do cliente (com ou sem pontuação).'
        }
      },
      required: ['cpf']
    }
  }
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: any;
}

/**
 * Calls the Anthropic Claude API Messages endpoint.
 */
async function callClaudeAPI(system: string, messages: ChatMessage[], tools: any[]): Promise<any> {
  return anthropic.messages.create({
    model: claudeModel,
    max_tokens: 4000,
    system: system,
    messages: messages,
    tools: tools,
    temperature: 0.3
  });
}

/**
 * Processes chat history with Claude, executing tool calls recursively up to a limit.
 */
export async function getAiResponse(
  conversationId: string, 
  history: { sender: string; content: string }[]
): Promise<string> {
  try {
    const res = await getClaudeResponse(conversationId, history);
    return res;
  } catch (error: any) {
    console.warn(`[Claude] Claude API failed (${error.message || error}), falling back to OpenAI gpt-4o...`);
    try {
      return await getOpenAiResponse(conversationId, history);
    } catch (openAiError: any) {
      console.error('[Claude Fallback] OpenAI fallback also failed:', openAiError.message || openAiError);
      throw error;
    }
  }
}

async function getClaudeResponse(
  conversationId: string, 
  history: { sender: string; content: string }[]
): Promise<string> {
  
  // 1. Map history to Anthropic messages format
  const messages: ChatMessage[] = [];

  history.forEach(msg => {
    if (msg.sender === 'CLIENT') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.sender === 'IA' || msg.sender === 'ADMIN') {
      messages.push({ role: 'assistant', content: msg.content });
    }
  });

  // Anthropic messages array cannot start with an assistant message, and must alternate roles.
  // Ensure the history is formatted correctly:
  if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Olá' });
  }

  let depth = 0;
  const maxDepth = 5;

  while (depth < maxDepth) {
    depth++;
    console.log(`[Claude] Calling messages loop. Depth: ${depth}`);
    const response = await callClaudeAPI(ISABELLE_SYSTEM_PROMPT, messages, CLAUDE_TOOLS);

    // Add assistant's response to the message thread
    messages.push({
      role: 'assistant',
      content: response.content
    });

    const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use');

    if (toolUseBlocks.length > 0) {
      const toolResults: any[] = [];

      for (const toolCall of toolUseBlocks) {
        const toolName = toolCall.name;
        const toolArgs = toolCall.input || {};
        const toolCallId = toolCall.id;

        console.log(`[Claude] LLM called tool: ${toolName} with args:`, toolArgs);
        let resultString = '';

        try {
          if (toolName === 'check_availability') {
            const availability = await checkBoatAvailability(toolArgs.date);
            resultString = JSON.stringify(availability);
          } else if (toolName === 'update_stage') {
            const updateResult = await updateConversationStage(conversationId, toolArgs.stage);
            resultString = JSON.stringify(updateResult);
          } else if (toolName === 'update_target_date') {
            const dateResult = await updateConversationTargetDate(conversationId, toolArgs.date);
            resultString = JSON.stringify(dateResult);
          } else if (toolName === 'create_pending_reservation') {
            const resResult = await createPendingReservation(toolArgs);
            resultString = JSON.stringify(resResult);
          } else if (toolName === 'update_customer_cpf') {
            const cpfResult = await updateCustomerCPF(conversationId, toolArgs.cpf);
            resultString = JSON.stringify(cpfResult);
          } else {
            resultString = JSON.stringify({ error: `Tool ${toolName} not found` });
          }
        } catch (error: any) {
          console.error(`[Claude] Error executing tool ${toolName}:`, error);
          resultString = JSON.stringify({ error: error.message || 'Erro de execução da ferramenta.' });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCallId,
          content: resultString
        });
      }

      // Feed tool results back to Claude as a user message content block list
      messages.push({
        role: 'user',
        content: toolResults
      });

      // Continue the loop to get another assistant response based on the tool results
      continue;
    }

    // No tool calls, extract the text response
    const textBlock = response.content.find((block: any) => block.type === 'text');
    return textBlock?.text || '';
  }

  throw new Error('Claude exceeded maximum tool call recursion depth.');
}


const OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Consulta a disponibilidade, preços e catálogo das lanchas para uma data específica. Retorna uma lista ordenada, priorizando a frota própria no topo.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'A data do passeio no formato YYYY-MM-DD (ex: 2026-12-25).'
          }
        },
        required: ['date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_stage',
      description: 'Atualiza o estágio do lead/conversa na negociação conforme o fluxo avança.',
      parameters: {
        type: 'object',
        properties: {
          stage: {
            type: 'string',
            enum: ['novo', 'cotado', 'sinal_solicitado', 'pix_enviado', 'reservado', 'concluido', 'humano'],
            description: 'O novo estágio da conversa.'
          }
        },
        required: ['stage']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_target_date',
      description: 'Registra a data em que o cliente tem interesse em realizar o passeio de lancha.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'A data do passeio no formato YYYY-MM-DD.'
          }
        },
        required: ['date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_pending_reservation',
      description: 'Cria uma reserva com status PENDING no sistema após o fechamento dos detalhes com o cliente.',
      parameters: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'O telefone do cliente (apenas números com DDI, ex: 554799999999).'
          },
          name: {
            type: 'string',
            description: 'O nome completo do cliente.'
          },
          boat_id: {
            type: 'string',
            description: 'O UUID da lancha escolhida.'
          },
          date: {
            type: 'string',
            description: 'A data do passeio no formato YYYY-MM-DD.'
          },
          boarding_point: {
            type: 'string',
            description: 'O ponto de embarque acordado.'
          },
          destination: {
            type: 'string',
            description: 'O destino principal do passeio.'
          },
          passenger_count: {
            type: 'number',
            description: 'O número total de passageiros.'
          },
          floating_mat_status: {
            type: 'string',
            enum: ['none', 'paid', 'courtesy'],
            description: 'O status do tapete flutuante (none se não contratado, paid se pago R$300, courtesy se cortesia).'
          },
          total_price: {
            type: 'number',
            description: 'O valor total acordado para a diária (incluindo extras se houver).'
          }
        },
        required: ['phone', 'name', 'boat_id', 'date', 'boarding_point', 'destination', 'passenger_count', 'floating_mat_status', 'total_price']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_customer_cpf',
      description: 'Atualiza o CPF do cliente no banco de dados e dispara automaticamente a geração de contrato e assinatura DocuSeal.',
      parameters: {
        type: 'object',
        properties: {
          cpf: {
            type: 'string',
            description: 'O número do CPF do cliente (com ou sem pontuação).'
          }
        },
        required: ['cpf']
      }
    }
  }
];

export async function getOpenAiResponse(
  conversationId: string,
  history: { sender: string; content: string }[]
): Promise<string> {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  // 1. Build messages array
  const messages: any[] = [
    { role: 'system', content: ISABELLE_SYSTEM_PROMPT }
  ];

  history.forEach(msg => {
    if (msg.sender === 'CLIENT') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.sender === 'IA' || msg.sender === 'ADMIN') {
      messages.push({ role: 'assistant', content: msg.content });
    }
  });

  if (messages.length === 1) {
    messages.push({ role: 'user', content: 'Olá' });
  }

  let depth = 0;
  const maxDepth = 5;

  while (depth < maxDepth) {
    depth++;
    console.log(`[OpenAI Fallback] Calling chat completions loop. Depth: ${depth}`);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        tools: OPENAI_TOOLS,
        tool_choice: 'auto',
        temperature: 0.3
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API responded with ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const assistantMessage = data.choices[0].message;

    // Add assistant message to the thread
    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        const toolCallId = toolCall.id;

        console.log(`[OpenAI Fallback] LLM called tool: ${toolName} with args:`, toolArgs);
        let resultString = '';

        try {
          if (toolName === 'check_availability') {
            const availability = await checkBoatAvailability(toolArgs.date);
            resultString = JSON.stringify(availability);
          } else if (toolName === 'update_stage') {
            const updateResult = await updateConversationStage(conversationId, toolArgs.stage);
            resultString = JSON.stringify(updateResult);
          } else if (toolName === 'update_target_date') {
            const dateResult = await updateConversationTargetDate(conversationId, toolArgs.date);
            resultString = JSON.stringify(dateResult);
          } else if (toolName === 'create_pending_reservation') {
            const resResult = await createPendingReservation(toolArgs);
            resultString = JSON.stringify(resResult);
          } else if (toolName === 'update_customer_cpf') {
            const cpfResult = await updateCustomerCPF(conversationId, toolArgs.cpf);
            resultString = JSON.stringify(cpfResult);
          } else {
            resultString = JSON.stringify({ error: `Tool ${toolName} not found` });
          }
        } catch (error) {
          console.error(`[OpenAI Fallback] Error executing tool ${toolName}:`, error);
          resultString = JSON.stringify({ error: error.message || 'Erro de execução da ferramenta.' });
        }

        // Add tool result to thread
        messages.push({
          role: 'tool',
          tool_call_id: toolCallId,
          name: toolName,
          content: resultString
        });
      }

      // Continue the loop to let the LLM see tool results and respond
      continue;
    }

    // No tool calls, return text response
    return assistantMessage.content || '';
  }

  throw new Error('OpenAI exceeded maximum tool call recursion depth.');
}
