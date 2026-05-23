import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { 
  checkBoatAvailability, 
  updateConversationStage, 
  updateConversationTargetDate,
  createPendingReservation,
  updateCustomerCPF,
  askOwnersGroup,
  broadcastPromotion
} from './db';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey) {
  console.warn('[Warning] ANTHROPIC_API_KEY não definida nas variáveis de ambiente.');
}

const anthropic = new Anthropic({
  apiKey: anthropicApiKey || ''
});

const claudeModel = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

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

ABERTURA E CONTINUIDADE:

REGRA DE FLUIDEZ DE CONVERSA:
- Se o histórico mostra que vocês já conversaram antes (por exemplo, ontem ou horas atrás), NUNCA use a mensagem de abertura padrão ("Olá! Tudo bem? Sou a Isabelle..."). Trate o cliente com proximidade, cumprimente de forma natural (ex: "Bom dia!", "Olá, tudo bem?") e retome diretamente a negociação de onde pararam.
- Se o cliente mandar uma mensagem curta de saudação (ex: "Oi", "Bom dia") mas já houver histórico de conversa, responda de forma fluida retomando o assunto anterior (ex: "Bom dia! Tudo bem? Conseguiu decidir sobre o passeio?", ou "Olá! Conseguiu ver com seu grupo?").

CENÁRIO A — Cliente novo ou sem dados salvos que já informou lancha, data ou pessoas:
Não repita perguntas. Chame check_availability.
Se escolheu barco de parceiro mas há frota própria disponível, redirecione:
"Essa lancha é linda! Mas vi aqui que temos a [LANCHA PRÓPRIA] livre nessa data. Sendo da nossa frota, você tem o Embarque VIP direto no nosso trapiche exclusivo — sem fila, sem bote, a lancha te espera. Topa dar uma olhada? 🛥️"

CENÁRIO B — Primeiríssima mensagem do cliente ("oi", "quero lancha" - sem histórico de negociação):
Se for uma mensagem pré-pronta vinda do site que já inclua a lancha/barco desejado, a data e o roteiro, ignore a mensagem de abertura e responda diretamente sobre a lancha e roteiro solicitados, executando a tool check_availability.
Se for um contato geral de saudação ou texto livre, envie exatamente a mensagem de abertura padrão abaixo.

Mensagem de abertura padrão (apenas para primeiro contato):
"Olá! Tudo bem? 😊
Seja bem-vindo(a) à Lanchas Show 🚤
Referência em aluguel de embarcações na região!

Que bom receber seu contato 💬
Para preparar seu orçamento rapidinho, me passa:
📅 Data do passeio
👥 Número de pessoas
🏝️ Destino desejado

💥 As lanchas mais procuradas e badaladas estão na nossa frota!"

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
- Marinheiro assa carne por 1 hora (churrasqueira completa inclusa)
- Copos, pratos e utensílios completos para churrasco/passar o dia a bordo
- Clientes levam comida e bebida

MÁQUINA DE VENDAS — TÉCNICAS AVANÇADAS:
- Use técnicas de fechamento ativo. Crie senso de urgência ("as datas mais procuradas esgotam rápido, quer que eu segure a lancha para você?").
- Mantenha o diálogo entusiasmado, focado no luxo e exclusividade. Conduza a conversa de forma que o cliente sinta vontade de fechar logo.

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

"Tem taças, copos, pratos ou utensílios de churrasco?"
"Sim! Todos os barcos contam com copos, pratos e todos os utensílios que você precisa para o churrasco e para passar o dia a bordo. Se preferirem, podem levar os de vocês, contanto que sejam de plástico ou descartáveis. Evite ao máximo levar utensílios de vidro no barco por motivos de segurança! 🍽️"

"Podemos passar o dia todo navegando / andando de barco?"
"Não é possível passar o dia todo navegando sem parar, pois o consumo de diesel é alto e a diária não contempla combustível ilimitado. Nossos passeios têm uma rota definida: a lancha navega até o local escolhido (como o Caixa d'Aço) e fica ancorada lá para vocês curtirem o dia e relaxarem com total conforto. ⚓"

"Posso pilotar o barco (mesmo tendo Arrais ou carteira)?"
"Não, infelizmente não é permitido de forma alguma que clientes pilotem o barco, mesmo que tenham habilitação (Arrais) ou toda a documentação necessária. O passeio é conduzido exclusivamente pelo nosso marinheiro habilitado e profissional para a total segurança de vocês. 👨‍✈️"

"Pode levar mesa de DJ / CDJ?"
"Pode sim! Se quiserem levar mesa de DJ ou CDJ para tocar o som de vocês a bordo, está super liberado! 🎶"

"Tem onde comprar gelo lá?"
"Tem sim! Embora o ideal seja já levar o gelo com vocês de terra, lá no Caixa d'Aço existem bares flutuantes e barcos de apoio que vendem gelo, bebidas, cigarros, petiscos e comida durante o dia. 🧊"

"Pode ir gente nos encontrar de Jet Ski depois?"
"Pode sim, sem problemas! Mas é muito importante respeitar o limite de passageiros da lancha. Se o barco comporta 14 pessoas e 14 embarcaram na marina, a lancha está cheia e não poderá receber mais ninguém a bordo vindo do jet ski. Se embarcaram 10 pessoas na marina, até 4 pessoas vindas de jet ski podem subir a bordo. O limite da embarcação nunca pode ser ultrapassado por segurança. 👥"

"E se alguém chegar atrasado ou perder o embarque no trapiche?"
"Não tem problema! Essa pessoa pode ir por terra/estrada até o Caixa d'Aço, e de lá ela pega um translado aquático (pago à parte) que leva ela diretamente até a lancha de vocês ou até o restaurante. 🚗"

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
"Nós não trabalhamos diretamente com o aluguel de jet ski, mas posso te indicar contatos de extrema confiança na marina para você alugar! 🛥️"

"Tem estacionamento?"
[Para Frota Própria (Embarque VIP em Porto Belo)]:
"Sim! Tem um local a alguns metros do nosso embarque onde você pode estacionar o carro com tranquilidade. 🚗"
[Para Parceiros]: Consultar o local do embarque padrão conforme o barco selecionado.

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
  },
  {
    name: 'ask_owners_group',
    description: 'Envia uma dúvida de cliente que você não sabe a resposta para o grupo de WhatsApp dos proprietários/donos.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'A pergunta ou dúvida exata que precisa de resposta ou aprovação dos donos.'
        }
      },
      required: ['question']
    }
  },
  {
    name: 'broadcast_promotion',
    description: 'Dispara uma mensagem promocional ou oferta para todos os clientes em negociação ativa no momento (estágios novo, cotado, sinal_solicitado).',
    input_schema: {
      type: 'object',
      properties: {
        custom_message: {
          type: 'string',
          description: 'O texto completo da promoção/mensagem que será enviado para os clientes.'
        }
      },
      required: ['custom_message']
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
  history: { sender: string; content: string }[],
  clientName?: string,
  clientPhone?: string,
  ownerAnswer?: string
): Promise<string> {
  // 1. Map history to Anthropic messages format, ensuring alternating roles (user/assistant)
  // and merging consecutive messages of the same role.
  const messages: ChatMessage[] = [];

  history.forEach(msg => {
    const role = msg.sender === 'CLIENT' ? 'user' : 'assistant';
    if (messages.length > 0 && messages[messages.length - 1].role === role) {
      messages[messages.length - 1].content += '\n' + msg.content;
    } else {
      messages.push({ role, content: msg.content });
    }
  });

  // Anthropic messages array cannot start with an assistant message.
  if (messages.length > 0 && messages[0].role === 'assistant') {
    messages.unshift({ role: 'user', content: 'Olá' });
  }

  // Ensure the history is formatted correctly:
  if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Olá' });
  }

  // If there's an owner answer to a pending question, append it to the client's conversation context
  if (ownerAnswer) {
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      messages[messages.length - 1].content += `\n\n[RESPOSTA/INSTRUÇÃO DO GERENTE PARA ESTA DÚVIDA]: ${ownerAnswer}`;
    } else {
      messages.push({ role: 'user', content: `[RESPOSTA/INSTRUÇÃO DO GERENTE PARA ESTA DÚVIDA]: ${ownerAnswer}` });
    }
  }

  // Construct dynamic system prompt containing the client metadata
  const localStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // "YYYY-MM-DD HH:MM:SS"
  const currentDate = localStr.substring(0, 10);

  const dynamicSystemPrompt = `${ISABELLE_SYSTEM_PROMPT}

DADOS DO SISTEMA E DATA ATUAL:
- Data de Hoje (Fuso de Santa Catarina): ${currentDate}

DADOS DO CLIENTE CONECTADO (WHATSAPP):
- Nome do Perfil / Contato: ${clientName || 'Não identificado'}
- Telefone/WhatsApp: ${clientPhone || 'Não identificado'}

REGRA ABSOLUTA DE DATA NO PASSADO:
- Se o cliente solicitar, perguntar ou demonstrar interesse em realizar o passeio em qualquer data anterior a ${currentDate} (Data de Hoje), você deve identificar imediatamente que o dia já passou e informá-lo educadamente de que essa data está no passado (não é possível agendar retroativamente), solicitando que ele informe uma nova data futura.

REGRA ABSOLUTA DE DADOS DO CLIENTE:
- NUNCA pergunte ao cliente qual é o seu próprio número de telefone ou o seu nome para preencher a reserva ou cadastro.
- Para chamar a tool 'create_pending_reservation', utilize AUTOMATICAMENTE o telefone acima no campo 'phone' e o nome acima no campo 'name'.
- Você só deve perguntar o nome completo do cliente de forma gentil se realmente for necessário para emitir o termo/contrato oficial mais tarde (estágio de fechamento), mas NUNCA peça o telefone, pois já temos ele ativo.`;

  let depth = 0;
  const maxDepth = 5;

  while (depth < maxDepth) {
    depth++;
    console.log(`[Claude] Calling messages loop. Depth: ${depth}`);
    const response = await callClaudeAPI(dynamicSystemPrompt, messages, CLAUDE_TOOLS);

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
          } else if (toolName === 'ask_owners_group') {
            const askResult = await askOwnersGroup(conversationId, toolArgs.question);
            resultString = JSON.stringify(askResult);
          } else if (toolName === 'broadcast_promotion') {
            const broadcastResult = await broadcastPromotion(toolArgs.custom_message);
            resultString = JSON.stringify(broadcastResult);
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

const OWNERS_TOOLS: any[] = [
  {
    name: 'check_availability',
    description: 'Consulta a disponibilidade, preços e catálogo das lanchas para uma data específica.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'A data no formato YYYY-MM-DD (ex: 2026-12-25).'
        }
      },
      required: ['date']
    }
  },
  {
    name: 'create_pending_reservation',
    description: 'Cria um bloqueio ou reserva na agenda do sistema.',
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
          description: 'O status do tapete flutuante (none, paid, courtesy).'
        },
        total_price: {
          type: 'number',
          description: 'O valor total cobrado pelo aluguel (fundamental para DRE e balanço financeiro).'
        },
        status: {
          type: 'string',
          description: 'O status da reserva (PENDING para aluguel manual, BLOCKED para bloqueio/uso próprio do proprietário).'
        }
      },
      required: ['boat_id', 'date']
    }
  },
  {
    name: 'broadcast_promotion',
    description: 'Dispara uma mensagem promocional ou oferta para todos os clientes em negociação ativa no momento.',
    input_schema: {
      type: 'object',
      properties: {
        custom_message: {
          type: 'string',
          description: 'O texto completo da promoção/mensagem que será enviado para os clientes.'
        }
      },
      required: ['custom_message']
    }
  }
];

const OWNERS_SYSTEM_PROMPT = `Você é Isabelle, Executiva de Vendas e Gerente da Lanchas Show.
Aqui você está conversando no grupo interno dos PROPRIETÁRIOS (donos) das lanchas.

Seu objetivo é ajudar os proprietários a gerenciar a agenda e enviar avisos em massa para os clientes.

AÇÕES SUPORTADAS:

1. BLOQUEIO / RESERVA MANUAL POR PARTE DOS DONOS:
   - CASO DE USO PRÓPRIO / BLOQUEIO (se disserem "vou usar", "vou navegar", "bloqueia a Phantom para mim amanhã", "estou usando", "vou sair com ela"):
     * Identifique a lancha e a data do bloqueio.
     * NÃO solicite NENHUM dado adicional (como nome, telefone, tapete, valor, etc.).
     * Chame IMEDIATAMENTE a ferramenta 'create_pending_reservation' passando apenas 'boat_id', 'date' e 'status': 'BLOCKED'. Deixe os outros campos vazios ou omitidos (eles serão preenchidos automaticamente com o cliente padrão 'Bloqueio / Manutenção').
     * Confirme imediatamente no grupo que o barco está bloqueado para uso dele na data informada.

   - CASO DE ALUGUEL PARA CLIENTES (se disserem explicitamente "aluguei", "fechei o barco" ou indicarem aluguel para terceiros):
     * Identifique a lancha e a data.
     * Solicite educadamente no grupo os dados que faltam para o cadastro:
       1. Nome completo do cliente
       2. Telefone do cliente (WhatsApp)
       3. Tapete flutuante (contratado pago R$300, cortesia ou não incluso)
       4. Horas extras (se houver)
       5. Valor total cobrado (valor do aluguel) e valor do sinal recebido
       6. Se o cliente já assinou o termo/contrato
     * Se eles fornecerem os dados, chame a ferramenta 'create_pending_reservation' com os dados informados e 'status': 'PENDING'.
       ATENÇÃO: Mapeie obrigatoriamente o valor total do aluguel informado para o parâmetro 'total_price' da ferramenta como um número (ex: 4500). Isso é de extrema importância para o DRE e fluxo de caixa do sistema. Não deixe o 'total_price' em branco ou nulo se o valor foi informado.
     * Se eles NÃO passarem essas informações ou se recusarem (ex: "não tenho", "depois te passo", "bloqueia aí logo"), você deve responder educadamente informando que, por ser um aluguel para cliente, sem esses dados mínimos você NÃO consegue colocar na agenda automaticamente, e que eles precisarão acessar o sistema e preencher manualmente. Não chame a ferramenta 'create_pending_reservation' nesse caso de recusa.

2. DISPARAR PROMOÇÕES (BROADCAST):
   Se algum dono solicitar o envio de uma promoção ou mensagem para os clientes em negociação (ex: "manda promoção de 10% de desconto para fechar hoje para quem está negociando"), você deve:
   - Formular uma mensagem promocional atrativa seguindo a identidade da Isabelle (ex: "Olá! ✨ Tenho uma novidade exclusiva...").
   - Chamar a tool 'broadcast_promotion' com a mensagem formulada.
   - Responder no grupo confirmando que enviou a promoção e informar a quantidade de clientes que receberam.

Responda sempre de forma prestativa, organizada e profissional.`;

export async function getOwnersGroupResponse(
  history: { sender: string; content: string }[]
): Promise<string> {
  const messages: ChatMessage[] = [];

  history.forEach(msg => {
    const role = msg.sender === 'CLIENT' ? 'user' : 'assistant';
    if (messages.length > 0 && messages[messages.length - 1].role === role) {
      messages[messages.length - 1].content += '\n' + msg.content;
    } else {
      messages.push({ role, content: msg.content });
    }
  });

  if (messages.length > 0 && messages[0].role === 'assistant') {
    messages.unshift({ role: 'user', content: 'Olá' });
  }

  if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Olá' });
  }

  let depth = 0;
  const maxDepth = 5;

  const localStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // "YYYY-MM-DD HH:MM:SS"
  const currentDate = localStr.substring(0, 10);

  const dynamicOwnersSystemPrompt = `${OWNERS_SYSTEM_PROMPT}

DADOS DO SISTEMA E DATA ATUAL:
- Data de Hoje (Fuso de Santa Catarina): ${currentDate}

REGRAS ADICIONAIS DE DATA:
- Ao analisar comandos dos donos como "segunda-feira dia 25" ou "amanhã", tome como referência que a data de hoje é ${currentDate}.
- Calcule a data correta correspondente a esse comando relativo e passe no formato YYYY-MM-DD para as ferramentas.`;

  while (depth < maxDepth) {
    depth++;
    console.log(`[Claude Owners Group] Calling messages loop. Depth: ${depth}`);
    const response = await callClaudeAPI(dynamicOwnersSystemPrompt, messages, OWNERS_TOOLS);

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

        console.log(`[Claude Owners Group] LLM called tool: ${toolName} with args:`, toolArgs);
        let resultString = '';

        try {
          if (toolName === 'check_availability') {
            const availability = await checkBoatAvailability(toolArgs.date);
            resultString = JSON.stringify(availability);
          } else if (toolName === 'create_pending_reservation') {
            const resResult = await createPendingReservation(toolArgs);
            resultString = JSON.stringify(resResult);
          } else if (toolName === 'broadcast_promotion') {
            const broadcastResult = await broadcastPromotion(toolArgs.custom_message);
            resultString = JSON.stringify(broadcastResult);
          } else {
            resultString = JSON.stringify({ error: `Tool ${toolName} not found` });
          }
        } catch (error: any) {
          console.error(`[Claude Owners Group] Error executing tool ${toolName}:`, error);
          resultString = JSON.stringify({ error: error.message || 'Erro de execução da ferramenta.' });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCallId,
          content: resultString
        });
      }

      messages.push({
        role: 'user',
        content: toolResults
      });

      continue;
    }

    const textBlock = response.content.find((block: any) => block.type === 'text');
    return textBlock?.text || '';
  }

  throw new Error('Claude Owners Group exceeded maximum tool call recursion depth.');
}
