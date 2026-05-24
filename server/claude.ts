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
  broadcastPromotion,
  completeBoarding,
  searchClientConversations,
  getReservationsSummary,
  getFinancialSummary
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
const ISABELLE_SYSTEM_PROMPT = `Você é Isabelle, Executiva de Vendas e Secretária da Lanchas Show,
a frota de luxo mais exclusiva do Caixa d'Aço, SC.
Você é o coração do atendimento: calorosa, atenciosa,
inteligente e focada em transformar cada contato em
uma experiência memorável que fecha negócio.

IDENTIDADE:
- Calorosa, próxima e acolhedora — nunca fria ou robótica
- Usa emojis com elegância e moderação: 🛥️ ✨ 🤩 ✅ 🙏
- Nunca revele que é IA a menos que perguntado diretamente
- Nunca despeje tudo de uma vez — conduza a conversa naturalmente
- Leia o tom do cliente e espelhe: se for animado, seja animada; se for direto, seja objetiva
- Varie o vocabulário — nunca repita a mesma frase de resposta duas vezes seguidas

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
Se for uma mensagem pré-pronta vinda do site que já inclua a lancha/barco desejado, a data e o roteiro, ignore a abertura e responda diretamente sobre a lancha e roteiro solicitados, executando a tool check_availability.
Se for um contato geral de saudação ou texto livre, dê boas-vindas de forma calorosa e natural (NUNCA use um texto fixo — varie a cada conversa), se apresente como Isabelle da Lanchas Show e pergunte data, número de pessoas e destino desejado. Seja animada e acolhedora como se estivesse genuinamente feliz em atender.

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

Apresente o resumo da reserva e a chave PIX:
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

Assim que efetuar o pagamento, envie o comprovante por aqui para registrarmos sua reserva na agenda e enviarmos o Termo de Locação com todos os detalhes ✨"

REGRA CRÍTICA DE PAGAMENTO:
- NUNCA chame a tool 'create_pending_reservation' ao enviar o resumo da reserva ou os dados do PIX acima.
- A reserva NÃO deve ser salva no banco de dados enquanto o cliente não enviar o comprovante.
- Você SÓ DEVE chamar a tool 'create_pending_reservation' e a tool 'update_stage' (definindo o estágio como 'pix_enviado') DEPOIS que o cliente enviar o comprovante de pagamento (imagem do recibo ou mensagem contendo o comprovante de PIX).
- Ao receber o comprovante de pagamento, chame a tool 'create_pending_reservation' para salvar a reserva com status 'PENDING', mude o estágio com a tool 'update_stage' para 'pix_enviado' e responda confirmando o recebimento ao cliente informando que o comprovante está em análise.

Após confirmação de pagamento:
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

COMPROVANTE DE PAGAMENTO PIX (CONFIRMAÇÃO MANUAL):
Nossa empresa recebe PIX via CNPJ direto. O pagamento
NÃO é confirmado automaticamente — precisa de verificação
manual pelos proprietários.

Quando o cliente enviar uma foto, print, imagem ou mencionar
que realizou o pagamento:
1. NUNCA confirme o pagamento por conta própria.
2. Chame IMEDIATAMENTE a tool 'forward_payment_receipt'
   descrevendo o que o cliente enviou (valor, banco, data).
3. Responda ao cliente de forma calorosa que encaminhou
   o comprovante para verificação e que assim que confirmarem
   você já avança com o contrato.
4. Aguarde a resposta do grupo dos proprietários.

Quando receber a confirmação dos donos de que o pagamento entrou:
- Chame 'create_pending_reservation' com todos os dados da reserva
- Chame 'update_stage' com 'pix_enviado'
- Solicite nome completo e CPF para emissão do contrato
  (ex: "Pagamento confirmado! 🎉 Para emitir o contrato,
  me passa seu nome completo e CPF? 😊")

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
- Oferecer tapete indisponível ou como brinde para barcos de parceiros
- Oferecer hora extra como brinde
- Revelar valor_minimo
- Revelar que é IA se não perguntado diretamente
- Responder tudo de uma vez como robô
- Confirmar disponibilidade no follow-up sem checar o banco primeiro
- Confirmar pagamento PIX sem chamar forward_payment_receipt e aguardar confirmação dos donos
- Criar reserva antes do pagamento ser confirmado pelos donos`;

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
  },
  {
    name: 'forward_payment_receipt',
    description: 'Encaminha comprovante de pagamento enviado pelo cliente ao grupo dos proprietários para verificação manual. Use SEMPRE que o cliente enviar uma foto, print ou comprovante de pagamento PIX. Nunca confirme pagamento sem usar esta tool primeiro.',
    input_schema: {
      type: 'object',
      properties: {
        receipt_info: {
          type: 'string',
          description: 'Descrição do comprovante: valor mencionado pelo cliente, banco, data, qualquer detalhe visível na imagem ou mensagem.'
        }
      },
      required: ['receipt_info']
    }
  }
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: any;
}

/**
 * Calls the Anthropic Claude API Messages endpoint.
 * temperature: 0.75 for client-facing Isabelle (warm/natural), 0.5 for owners group (operational precision).
 */
async function callClaudeAPI(system: string, messages: ChatMessage[], tools: any[], temperature = 0.75): Promise<any> {
  return anthropic.messages.create({
    model: claudeModel,
    max_tokens: 4000,
    system: system,
    messages: messages,
    tools: tools,
    temperature: temperature
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
  ownerAnswer?: string,
  clientImageBase64?: string,
  clientImageMimetype?: string
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

  // Attach client image (e.g. PIX receipt) to the last user message for Claude Vision
  const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (clientImageBase64 && clientImageMimetype && supportedImageTypes.includes(clientImageMimetype)) {
    const lastUserIdx = messages.map((m, i) => ({ m, i })).reverse().find(({ m }) => m.role === 'user')?.i;
    if (lastUserIdx !== undefined) {
      let cleanBase64 = clientImageBase64;
      if (cleanBase64.includes(';base64,')) {
        cleanBase64 = cleanBase64.split(';base64,')[1];
      }
      const textContent = typeof messages[lastUserIdx].content === 'string'
        ? messages[lastUserIdx].content
        : '[Imagem]';
      messages[lastUserIdx].content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: clientImageMimetype as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: cleanBase64
          }
        },
        { type: 'text', text: textContent }
      ];
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

  try {
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
          } else if (toolName === 'forward_payment_receipt') {
            // Forward receipt to owners group, including the client's image if available
            const fwdResult = await askOwnersGroup(
              conversationId,
              `⚠️ COMPROVANTE DE PAGAMENTO\n${toolArgs.receipt_info || 'Cliente enviou comprovante de pagamento.'}`,
              clientImageBase64,
              clientImageMimetype
            );
            resultString = JSON.stringify(fwdResult);
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
  } catch (error: any) {
    console.error('[Claude] getAiResponse failed:', error);
    return 'Oi! Estou com uma instabilidade aqui agora 😅 Me manda sua mensagem de novo em instantes, por favor? 🙏';
  }
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
  },
  {
    name: 'complete_boarding',
    description: 'Marca o embarque como realizado para uma lancha (especificando ID ou nome) em uma data específica, definindo o status da reserva como COMPLETED (Concluído) e computando os custos.',
    input_schema: {
      type: 'object',
      properties: {
        boat_id: {
          type: 'string',
          description: 'O UUID da lancha (opcional se boat_name for fornecido).'
        },
        boat_name: {
          type: 'string',
          description: 'O nome da lancha (ex: "Tecnomarine", "Phantom") (opcional se boat_id for fornecido).'
        },
        date: {
          type: 'string',
          description: 'A data do passeio no formato YYYY-MM-DD (ex: 2026-05-25).'
        }
      },
      required: ['date']
    }
  },
  {
    name: 'answer_client_question',
    description: 'Responde a dúvida pendente de um cliente que foi escalada para o grupo dos proprietários. Use quando um proprietário fornecer a resposta para uma dúvida de cliente listada nas PERGUNTAS PENDENTES.',
    input_schema: {
      type: 'object',
      properties: {
        conversation_id: {
          type: 'string',
          description: 'O ID da conversa do cliente que tem a dúvida pendente (fornecido na lista de PERGUNTAS PENDENTES).'
        },
        answer: {
          type: 'string',
          description: 'A resposta/informação fornecida pelo proprietário para repassar ao cliente.'
        }
      },
      required: ['conversation_id', 'answer']
    }
  },
  {
    name: 'search_client',
    description: 'Busca informações sobre um cliente ou conversa por nome ou telefone. Retorna o histórico de conversa, estágio da negociação, reservas ativas e mensagens recentes. Use quando um proprietário perguntar sobre um cliente específico (ex: "como está o Isaías?", "a Maria fechou?", "o que aconteceu com o cliente 47999...").',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Nome do cliente ou número de telefone para buscar.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_reservations',
    description: 'Consulta reservas no sistema com filtros opcionais por data, cliente, barco ou status. Use quando perguntarem sobre reservas, agenda, ou passeios agendados.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Data específica no formato YYYY-MM-DD para filtrar reservas.'
        },
        date_from: {
          type: 'string',
          description: 'Data inicial do período (YYYY-MM-DD).'
        },
        date_to: {
          type: 'string',
          description: 'Data final do período (YYYY-MM-DD).'
        },
        client_name: {
          type: 'string',
          description: 'Nome do cliente para filtrar.'
        },
        boat_name: {
          type: 'string',
          description: 'Nome do barco para filtrar (ex: Tecnomarine, Phantom).'
        },
        status: {
          type: 'string',
          description: 'Status da reserva para filtrar (PENDING, CONFIRMED, COMPLETED, BLOCKED, etc).'
        }
      }
    }
  },
  {
    name: 'get_financials',
    description: 'Consulta o resumo financeiro (DRE) da empresa: receita bruta, custos, despesas, lucro líquido, lucro de intermediação de parceiros, sinal recebido. Use quando perguntarem sobre faturamento, receita, lucro, custos, ou balanço.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'month', 'custom'],
          description: 'Período do resumo: today (hoje), month (mês atual), custom (período personalizado com date_from/date_to).'
        },
        date_from: {
          type: 'string',
          description: 'Data inicial para período custom (YYYY-MM-DD).'
        },
        date_to: {
          type: 'string',
          description: 'Data final para período custom (YYYY-MM-DD).'
        }
      },
      required: ['period']
    }
  }
];

const OWNERS_SYSTEM_PROMPT = `Você é Isabelle, Executiva de Vendas, Gerente e Secretária Executiva da Lanchas Show.
Aqui você está conversando no grupo interno dos PROPRIETÁRIOS (donos) das lanchas.

Seu objetivo é ajudar os proprietários a gerenciar TODA a operação da empresa. Você tem acesso total ao sistema e pode:
- Gerenciar a agenda de reservas e bloqueios
- Buscar informações sobre qualquer cliente ou conversa em andamento
- Consultar reservas por data, barco ou cliente
- Informar faturamento diário, mensal, bruto, líquido e detalhado
- Enviar promoções em massa para clientes
- Confirmar embarques
- Responder dúvidas de clientes
- Qualquer outra consulta ao sistema

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

3. CONFIRMAÇÃO DE EMBARQUE (MARCAR COMO CONCLUÍDO):
    Se algum proprietário informar que o embarque foi realizado para uma lancha (ex: "embarque feito da Tecnomarine", "Tecnomarine embarcou", "Phantom saiu", "passeio liberado para João na Phantom"):
    - Identifique a lancha e a data correspondente (geralmente hoje).
    - Chame a tool 'complete_boarding' passando 'boat_name' ou 'boat_id' e a data correspondente 'date'.
    - Confirme no grupo de forma profissional e simpática que o embarque foi registrado com sucesso e a agenda foi atualizada para CONCLUÍDO.

4. CORREÇÃO / ATUALIZAÇÃO DE RESERVAS EXISTENTES:
    Se algum proprietário pedir para corrigir dados de uma reserva já existente (ex: "corrige o telefone da cliente de hoje na Tecnomarine", "o número correto é 47999...", "troca o nome do cliente da reserva de amanhã"):
    - PRIMEIRO, chame 'check_availability' para a data informada. A resposta incluirá TODOS os barcos (livres E ocupados) com os dados da reserva atual (nome do cliente, telefone, status, valor).
    - Identifique a lancha correta e a reserva existente nos dados retornados.
    - Chame 'create_pending_reservation' usando exatamente o MESMO 'boat_id' e 'date' da reserva existente, passando os dados corrigidos. O sistema atualizará a reserva existente automaticamente (não criará duplicada).
    - NUNCA crie uma reserva em uma lancha diferente quando o pedido for de correção. Se o dono diz "corrige o telefone da reserva da Tecnomarine", você DEVE atualizar a reserva da Tecnomarine, NÃO criar uma nova na Phantom ou qualquer outra.
    - Confirme a correção no grupo.

5. FOTOS E MÍDIAS:
    Se os proprietários enviarem uma foto ou imagem, você consegue ver e interpretar o conteúdo da imagem. Descreva o que vê se for relevante para a conversa. Se pedirem para repassar uma mídia para clientes, use a tool 'broadcast_promotion' com uma mensagem descritiva sobre a mídia.

6. RESPONDER DÚVIDAS PENDENTES DE CLIENTES:
    Abaixo você receberá uma lista de PERGUNTAS PENDENTES DE CLIENTES que foram escaladas para este grupo e ainda não foram respondidas.
    - Se algum proprietário enviar uma mensagem que pareça ser a resposta para uma dessas dúvidas (mesmo que NÃO cite/responda diretamente a mensagem original), você DEVE identificar qual pergunta está sendo respondida.
    - Chame IMEDIATAMENTE a tool 'answer_client_question' passando o 'conversation_id' da pergunta pendente e a 'answer' com a informação fornecida pelo proprietário.
    - A ferramenta vai formular uma resposta adequada e enviar automaticamente para o cliente.
    - Após chamar a ferramenta, confirme no grupo que a resposta foi enviada ao cliente.
    - REGRAS IMPORTANTES PARA EVITAR CONFUSÃO DE REGRAS:
      * Trate uma mensagem do proprietário como a resposta para a dúvida pendente APENAS se ela for de fato uma afirmação ou resposta direta para o cliente (ex: "emite sim", "o marinheiro é Cleberson").
      * NUNCA chame a tool 'answer_client_question' se o proprietário estiver fazendo uma pergunta sobre o status daquele cliente (ex: "como ficou o Isaías?", "fechou?", "o Isaías reservou?"). Perguntas do proprietário devem ser tratadas sob a Regra 7 abaixo, usando as ferramentas de busca de cliente ou reservas, respondendo-os diretamente no grupo!
      * NUNCA prometa ou diga no seu texto de resposta que vai repassar a resposta/mensagem ao cliente a menos que você esteja chamando efetivamente a ferramenta 'answer_client_question' nesse mesmo turno de execução.

7. CONSULTAS DO SISTEMA (SECRETÁRIA / ASSISTENTE OPERACIONAL):
    Se os proprietários fizerem perguntas sobre a operação, clientes ou relatórios:
    - PERGUNTA SOBRE CLIENTE OU NEGOCIAÇÃO (ex: "como ficou o Isaías?", "o Isaías fechou?", "como está a negociação com X?", "o cliente de hoje já pagou?"):
      * Chame a ferramenta 'search_client' com o nome ou telefone do cliente pesquisado.
      * Com o resultado retornado, responda de forma resumida e direta aos donos informando:
        1. O estágio atual da conversa (ex: Novo, Negociação, Pagamento, Concluído).
        2. Se há alguma reserva registrada no sistema e qual o status dela (ex: PENDENTE, CONFIRMADO, CONCLUÍDO).
        3. Detalhes pendentes relevantes (ex: "estamos aguardando o sinal de R$ 11.150 para confirmar", "ele acabou de responder que vai confirmar com o grupo").
    - PERGUNTA SOBRE RESERVAS / AGENDA (ex: "quais lanchas saem amanhã?", "como está a agenda da Phantom?", "quem navega hoje?"):
      * Chame a ferramenta 'get_reservations' com filtros adequados (ex: date, date_from, date_to, boat_name, etc.).
      * Responda de forma clara, listando o barco, o nome do cliente, o status da reserva (Pendente, Confirmado, Concluído, etc.) e o valor total se relevante.
    - PERGUNTA SOBRE FATURAMENTO / DRE / BALANÇO (ex: "quanto faturei hoje?", "como está o faturamento mensal?", "faturamento líquido ou bruto?"):
      * Chame a ferramenta 'get_financials' informando o período correto ('today' para hoje, 'month' para o mês atual, ou 'custom' se for uma data ou intervalo específico).
      * Formate a resposta de forma muito profissional e executiva (resumo executivo):
        - Receita Bruta
        - Custos de Saída (originais)
        - Despesas Operacionais (lançadas no caixa)
        - Lucro Líquido do período
        - Total de Sinal Recebido (sinal que de fato já entrou)
        - Listagem breve ou contagem dos barcos que saíram e contribuíram para o resultado.

Responda sempre de forma prestativa, organizada e profissional.`;

export async function getOwnersGroupResponse(
  history: { sender: string; content: string }[],
  mediaBase64?: string,
  mediaMimetype?: string,
  pendingQuestions?: { conversation_id: string; client_name: string; client_phone: string; question: string }[]
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

  // Attach image to the last user message if media is present (Claude Vision)
  const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (mediaBase64 && mediaMimetype && supportedImageTypes.includes(mediaMimetype)) {
    const lastUserIdx = messages.length - 1;
    if (lastUserIdx >= 0 && messages[lastUserIdx].role === 'user') {
      const textContent = typeof messages[lastUserIdx].content === 'string'
        ? messages[lastUserIdx].content
        : 'Imagem enviada';
      
      let cleanBase64 = mediaBase64;
      if (cleanBase64.includes(';base64,')) {
        cleanBase64 = cleanBase64.split(';base64,')[1];
      }

      messages[lastUserIdx].content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaMimetype,
            data: cleanBase64
          }
        },
        {
          type: 'text',
          text: textContent
        }
      ];
    }
  }

  let depth = 0;
  const maxDepth = 5;

  const localStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // "YYYY-MM-DD HH:MM:SS"
  const currentDate = localStr.substring(0, 10);

  // Build pending questions context
  let pendingQuestionsContext = '';
  if (pendingQuestions && pendingQuestions.length > 0) {
    pendingQuestionsContext = '\n\nPERGUNTAS PENDENTES DE CLIENTES (aguardando resposta dos proprietários):\n';
    pendingQuestions.forEach((pq, i) => {
      pendingQuestionsContext += `${i + 1}. Cliente: ${pq.client_name} (${pq.client_phone}) — conversation_id: ${pq.conversation_id}\n   Dúvida: "${pq.question}"\n`;
    });
  } else {
    pendingQuestionsContext = '\n\nPERGUNTAS PENDENTES DE CLIENTES: Nenhuma dúvida pendente no momento.';
  }

  const dynamicOwnersSystemPrompt = `${OWNERS_SYSTEM_PROMPT}

DADOS DO SISTEMA E DATA ATUAL:
- Data de Hoje (Fuso de Santa Catarina): ${currentDate}

REGRAS ADICIONAIS DE DATA:
- Ao analisar comandos dos donos como "segunda-feira dia 25" ou "amanhã", tome como referência que a data de hoje é ${currentDate}.
- Calcule a data correta correspondente a esse comando relativo e passe no formato YYYY-MM-DD para as ferramentas.${pendingQuestionsContext}`;

  while (depth < maxDepth) {
    depth++;
    console.log(`[Claude Owners Group] Calling messages loop. Depth: ${depth}`);
    const response = await callClaudeAPI(dynamicOwnersSystemPrompt, messages, OWNERS_TOOLS, 0.5);

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
            // Pass includeBooked=true so owners can see all boats (including booked ones) and their reservation details
            const availability = await checkBoatAvailability(toolArgs.date, true);
            resultString = JSON.stringify(availability);
          } else if (toolName === 'create_pending_reservation') {
            const resResult = await createPendingReservation(toolArgs);
            resultString = JSON.stringify(resResult);
          } else if (toolName === 'broadcast_promotion') {
            const broadcastResult = await broadcastPromotion(toolArgs.custom_message, mediaBase64, mediaMimetype);
            resultString = JSON.stringify(broadcastResult);
          } else if (toolName === 'complete_boarding') {
            const boardingResult = await completeBoarding(toolArgs);
            resultString = JSON.stringify(boardingResult);
          } else if (toolName === 'search_client') {
            const searchResult = await searchClientConversations(toolArgs.query);
            resultString = JSON.stringify(searchResult);
          } else if (toolName === 'get_reservations') {
            const resResult = await getReservationsSummary(toolArgs);
            resultString = JSON.stringify(resResult);
          } else if (toolName === 'get_financials') {
            const finResult = await getFinancialSummary(toolArgs.period, toolArgs.date_from, toolArgs.date_to);
            resultString = JSON.stringify(finResult);
          } else if (toolName === 'answer_client_question') {
            try {
              const { supabaseAdmin: supa } = await import('./supabase');
              const { getAiResponse: aiResp } = await import('./claude');
              const { sendWhatsAppMessage: sendMsg } = await import('./evolution');

              // 1. Find the client conversation
              const { data: clientConv } = await supa
                .from('ia_conversations')
                .select('*')
                .eq('id', toolArgs.conversation_id)
                .maybeSingle();

              if (!clientConv) {
                resultString = JSON.stringify({ error: 'Conversa do cliente não encontrada.' });
              } else {
                // 2. Fetch client message history
                const { data: clientHistory } = await supa
                  .from('ia_messages')
                  .select('sender, content')
                  .eq('conversation_id', clientConv.id)
                  .order('created_at', { ascending: false })
                  .limit(20);

                const chronologicalHistory = (clientHistory || []).reverse();

                // 3. Call Claude to formulate the response to the client
                const clientResponse = await aiResp(
                  clientConv.id,
                  chronologicalHistory,
                  clientConv.contact_name,
                  clientConv.contact_phone,
                  toolArgs.answer
                );

                if (clientResponse && clientResponse.trim()) {
                  // 4. Send to client
                  await sendMsg(clientConv.contact_phone, clientResponse);

                  // 5. Save AI response in DB
                  await supa
                    .from('ia_messages')
                    .insert({
                      conversation_id: clientConv.id,
                      sender: 'IA',
                      content: clientResponse
                    });

                  // 6. Clear pending status
                  await supa
                    .from('ia_conversations')
                    .update({
                      pending_owners_message_id: null,
                      pending_owners_question: null
                    })
                    .eq('id', clientConv.id);

                  resultString = JSON.stringify({
                    success: true,
                    message: `Resposta enviada com sucesso para ${clientConv.contact_name} (${clientConv.contact_phone}).`
                  });
                } else {
                  resultString = JSON.stringify({ error: 'Não foi possível formular a resposta para o cliente.' });
                }
              }
            } catch (answerError: any) {
              console.error(`[Claude Owners Group] Error answering client question:`, answerError);
              resultString = JSON.stringify({ error: answerError.message || 'Erro ao responder pergunta do cliente.' });
            }
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
