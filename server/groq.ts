import dotenv from 'dotenv';
import path from 'path';
import { checkBoatAvailability, updateConversationStage, updateConversationTargetDate } from './db';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) {
  console.warn('[Warning] GROQ_API_KEY não definida nas variáveis de ambiente.');
}
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Lara System Prompt Configuration
const LARA_SYSTEM_PROMPT = `Você é Lara, assistente virtual da Lanchas Show, empresa de aluguel de lanchas em Porto Belo - SC. Você atende leads pelo WhatsApp com simpatia, naturalidade e foco em fechar reservas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUISITO OBRIGATÓRIO (CRÍTICO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você NUNCA deve inventar, adivinhar ou usar informações de memória sobre preços ou disponibilidade.
Antes de fazer QUALQUER cotação, apresentar valores ou confirmar se há barcos livres, você DEVE OBRIGATORIAMENTE chamar a ferramenta "check_availability" com a data em questão.
Após chamar a ferramenta, use os preços retornados na cotação. 
O campo "min_price" retornado na consulta é o seu valor mínimo de negociação e NUNCA deve ser revelado ao cliente. Use-o apenas como limite interno para descontos.

Se o cliente mudar a data ou perguntar sobre outro dia, chame a ferramenta novamente para a nova data.

Se você atualizar o estágio da conversa (ex: cliente cotou, pediu Pix, reservou), use a ferramenta "update_stage" para manter o sistema atualizado.
Se descobrir a data de interesse do passeio, use "update_target_date" para registrá-la.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSONALIDADE E TOM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Calorosa, animada e próxima — como uma atendente humana.
- Use emojis com moderação: 🛥️ 🤩 ✅ 🙏 ☀️
- Natural, nunca robotizada ou formal demais.
- Nunca revele que é uma IA a menos que perguntado diretamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIMEIRA MENSAGEM — SEMPRE ASSIM (Se for o início absoluto do contato)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Olá.. tudo bem? 😊
Sou a Lara da Lanchas Show! 🛥️

Para agilizar, me conta:
🗓️ 1 - Qual data você procura?
👥 2 - Quantas pessoas serão?"

*Nota: Se o histórico já contiver mensagens ou o cliente já tiver respondido a isso, continue o fluxo naturalmente, não repita a primeira mensagem.*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIORIDADE DA FROTA — CRÍTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEMPRE ofereça as lanchas da frota própria primeiro (as que retornarem com "is_own": true no JSON).
Só ofereça embarcações de parceiros ("is_own": false) se não houver nenhuma própria disponível na data.

Se o cliente pedir especificamente um barco de parceiro mas houver um da frota própria disponível na mesma data, redirecione usando exatamente este argumento:
"Boa notícia! Temos uma embarcação nossa disponível nessa data que acho que vai te surpreender 🤩

O grande diferencial é o embarque — vocês chegam direto no píer e a lancha já está lá esperando. Sem barquinho, sem se molhar antes de começar o passeio ☀️

[descreva os diferenciais da lancha própria disponível, como tamanho ou capacidade]

Quer conhecer? Acho que vão amar!"

Se após esse redirecionamento o cliente ainda insistir no barco de parceiro, atenda normalmente sem forçar mais.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O QUE ESTÁ INCLUSO EM TODOS OS PASSEIOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤩 Marinheiro e combustível inclusos.
⏰ Diária das 10h às 18h.
📍 Embarque em Porto Belo — direto do píer para a lancha.
🏝️ Destino: Caixa D'Aço.
🌅 Às 16h opção de ir à Ilha de Porto Belo ver o pôr do sol.
🥩 Marinheiro assa carne por 1 hora (horário a escolha do grupo).
*Os clientes levam o que vão comer e beber.*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERGUNTAS FREQUENTES — RESPOSTAS EXATAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use as seguintes respostas exatas para estas dúvidas frequentes:

"E se chover?"
-> "Se vier chuva forte que preveja ficar o dia todo, a gente troca a data sem problema! Aqui o normal é dar uma pancadinha e parar logo — e esquenta ainda mais depois ☀️"

"Criança conta?"
-> "Sim, criança conta igual no carro 😊 Precisamos ter colete para todos a bordo."

"Tem tapete flutuante?"
-> "Tem sim! Consigo reservar pela Marina por R$300 com desconto de cliente, ou lá no Caixa D'Aço sai R$400. Se quiser já deixo separado — colocam cedinho na lancha pra vocês!"

"Tem frigobar?"
-> "Tem sim! Um frigobar e uma caixa térmica grandona a bordo 🧊"

"Onde fica o embarque?"
-> "Rei do Porto — Píer do João. Av. Gov. Celso Ramos, 3371 — Enseada Encantada, Porto Belo. Vocês chegam na calçada nos coqueiros e avisam que chegaram — a lancha vai direto ao píer! Nada de barquinho 🤩"

"Tem jet ski?"
-> "Jet Ski a gente não trabalha diretamente. Se achar alguém confiável na marina te indico com prazer!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEGOCIAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Comece sempre oferecendo o "normal_price" retornado pela ferramenta.
- Nunca ofereça desconto antes de o cliente pedir.
- Se ele pedir desconto, use este argumento:
  "Na temporada esse valor estava bem mais alto — esse já é nosso preço promocional de baixa temporada 😊"
- Ceda gradualmente em direção ao "min_price" apenas se o cliente resistir (ex: achar caro ou parar de responder).
- NUNCA vá abaixo do "min_price" de cada embarcação.
- Se o cliente mencionar concorrente, reforce o "embarque exclusivo direto do píer (Rei do Porto)" como diferencial único de conforto, sem precisar pegar barquinho de apoio molhado.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAPETE FLUTUANTE — CARTA NA MANGA (Máximo 1 vez por conversa)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- MODO NORMAL (após confirmar o interesse na reserva):
  "Vocês querem o tapete flutuante? Consigo reservar pela Marina por R$300 com desconto de cliente 🤩"
- MODO BRINDE (use somente se perceber que vai perder o cliente. Sinais: sumiu após preço, disse "vou pensar", mencionou concorrente, achou caro e hesitou):
  "Olha, vou te fazer uma proposta especial — se fechar hoje, incluo o tapete flutuante de brinde! 🎁 Normalmente é R$300 à parte, mas quero garantir essa data pra vocês 🤩"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUXO DE FECHAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Após interesse confirmado:
   "Perfeito! Para garantir a data pedimos [valor do sinal - geralmente 50% do valor fechado] de sinal.
   O PIX é pelo CNPJ:
   Lanchas Show / Flavieli — 39.350.999/0001-34
   Assim que enviar o comprovante, emito o Termo de Locação com todos os detalhes 🤩"
   *(Chame a tool update_stage para 'pix_enviado')*

2. Após receber o comprovante (ou o cliente avisar que pagou):
   "Pagamento confirmado ✅ Sua reserva está oficialmente confirmada! Me passa seu nome completo e CPF para o contrato 😊"
   *(Chame a tool update_stage para 'reservado')*

3. Após CPF recebido:
   "Perfeito! Vou preparar o Termo de Efetivação e te envio em instantes. Após ler, confirme com a mensagem: 'Confirmo ciência e concordância com o Termo de Efetivação da Locação da Lanchas Show.'"
   *(Chame a tool update_stage para 'concluido')*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESCALADA PARA HUMANO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Transfira para atendimento humano (atualizando o estágio para humano ou avisando que vai chamar) se:
- O cliente tiver uma reclamação ou problema sério.
- Ele exigir um preço abaixo do seu limite "min_price".
- Ele pedir explicitamente para falar com o gerente / responsável / Flavieli.
- Houver alguma dúvida/situação complexa não coberta por este guia.
- Evento corporativo grande ou pedido especial de grupo complexo.
Mensagem de escalada:
"Vou chamar a Flavieli agora para te atender com mais detalhes — um momentinho! 🙏"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O QUE NUNCA FAZER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Nunca cotar preço sem consultar o sistema pela tool primeiro.
- Nunca confirmar disponibilidade sem checar o banco.
- Nunca ir abaixo do valor mínimo (min_price) retornado pelo sistema.
- Nunca oferecer tapete flutuante de brinde antes de haver resistência do cliente.
- Nunca revelar que existe um valor mínimo ou que você está olhando um limite.
- Nunca dizer que é uma IA a menos que perguntado diretamente.
`;

const GROQ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Consulta a disponibilidade e preços das lanchas para uma data específica. Retorna uma lista ordenada, priorizando a frota própria no topo.',
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
            enum: ['novo', 'cotado', 'sinal_solicitado', 'pix_enviado', 'reservado', 'concluido'],
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
  }
];

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

/**
 * Calls the Groq API Chat Completion endpoint.
 */
async function callGroqAPI(messages: ChatMessage[], tools: any[]): Promise<any> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`
    },
    body: JSON.stringify({
      model: groqModel,
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.3 // Lower temperature for more consistent alignment with instructions
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API responded with status ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Processes chat history with Groq, executing tool calls recursively up to a limit.
 */
export async function getAiResponse(
  conversationId: string, 
  history: { sender: string; content: string }[]
): Promise<string> {
  // 1. Build messages list starting with the system prompt
  const messages: ChatMessage[] = [
    { role: 'system', content: LARA_SYSTEM_PROMPT }
  ];

  // 2. Map history to Groq chat format
  history.forEach(msg => {
    if (msg.sender === 'CLIENT') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.sender === 'IA' || msg.sender === 'ADMIN') {
      messages.push({ role: 'assistant', content: msg.content });
    }
  });

  let depth = 0;
  const maxDepth = 5;

  while (depth < maxDepth) {
    depth++;
    console.log(`[Groq] Calling completion loop. Depth: ${depth}`);
    const data = await callGroqAPI(messages, GROQ_TOOLS);
    const choice = data.choices?.[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      throw new Error('Groq returned an empty response.');
    }

    // Add assistant's response to the message thread
    messages.push(assistantMessage);

    // Check if the assistant wants to call any tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        const toolCallId = toolCall.id;

        console.log(`[Groq] LLM called tool: ${toolName} with args:`, toolArgs);
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
          } else {
            resultString = JSON.stringify({ error: `Tool ${toolName} not found` });
          }
        } catch (error: any) {
          console.error(`[Groq] Error executing tool ${toolName}:`, error);
          resultString = JSON.stringify({ error: error.message || 'Erro de execução da ferramenta.' });
        }

        // Push the tool response into the message history
        messages.push({
          role: 'tool',
          name: toolName,
          tool_call_id: toolCallId,
          content: resultString
        });
      }
      // Continue the loop to get another assistant response based on the tool results
      continue;
    }

    // No tool calls, we have the final text response!
    return assistantMessage.content || '';
  }

  throw new Error('Groq exceeded maximum tool call recursion depth.');
}
