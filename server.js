import 'dotenv/config';
import express from 'express';
import { readFileSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const {
  WHATSAPP_TOKEN,        // token de acesso da Meta (System User Token)
  WHATSAPP_PHONE_ID,     // ID do número de telefone (Phone Number ID)
  VERIFY_TOKEN,          // token que você escolhe, usado na verificação do webhook
  PORT = 3000,
} = process.env;

// Memória de conversa simples em RAM, por número de telefone do cliente.
// Em produção, troque por um banco de dados (Redis, Postgres, etc.).
const conversations = new Map();

// Catálogo carregado de catalogo.json — edite esse arquivo para adicionar,
// remover ou mudar preço de produtos, sem precisar mexer neste código.
const catalogo = JSON.parse(readFileSync('./catalogo.json', 'utf-8'));

const listaCatalogo = catalogo
  .map((item) => `- ${item.produto} — R$ ${item.preco.toFixed(2).replace('.', ',')}`)
  .join('\n');

const SYSTEM_PROMPT = `Você é o assistente virtual da LG Bebidas, especializada em venda e entrega de bebidas.

## Seu papel
- Atender clientes pelo WhatsApp de forma rápida, simpática e objetiva.
- Ajudar a montar pedidos, tirar dúvidas sobre produtos, preços e prazos de entrega.
- Nunca inventar informações de estoque, preço ou prazo — sempre confirmar com os dados fornecidos aqui.

## Tom de voz
- Informal, mas profissional. Trate o cliente por "você".
- Frases curtas, direto ao ponto (é WhatsApp, não e-mail).
- Use emojis com moderação (🍺 🥤 🚚), sem exagerar.

## Horário de atendimento e entregas
- Funcionamos das 07:00 às 19:30.
- Fora desse horário, informe: "Nosso horário de entrega é das 07h às 19h30. Posso já deixar seu pedido anotado para a primeira entrega do dia!"

## Catálogo
${listaCatalogo}
- Use apenas os produtos e preços acima. Se o cliente pedir algo fora da lista, informe educadamente que não temos esse item no momento. Se o cliente pedir algo fora da lista, informe educadamente que não temos esse item no momento.

## Área e taxa de entrega
- Atendemos toda a região de Cristalina.
- Taxa de entrega: R$ 10,00 (some ao valor total do pedido).
- Se o cliente pedir entrega fora de Cristalina, informe que não atendemos a região.

## Fluxo de pedido
1. Cumprimente e pergunte o que o cliente deseja.
2. Confirme produto(s), quantidade e endereço de entrega.
3. Calcule o valor total: (produtos) + R$10,00 de entrega.
4. Repita o pedido completo (itens, valores, endereço, taxa e total) para confirmação antes de fechar.
5. Pergunte a forma de pagamento: PIX, débito, crédito ou dinheiro.
   - Se for PIX, informe a chave: 61998762760.
   - Se for dinheiro, pergunte se precisa de troco e para qual valor.
6. Após confirmação, informe o prazo estimado de entrega (dentro da janela das 07h às 19h30).

## Regras importantes
- Se o cliente pedir para falar com um atendente humano, ou a dúvida for complexa (reclamação, problema com entrega, negociação especial), encaminhe dizendo: "Vou te transferir para um de nossos atendentes, só um momento."
- Nunca dê descontos ou condições especiais sem autorização prévia definida aqui.

## Encerramento
- Agradeça e confirme se pode ajudar em mais alguma coisa antes de encerrar a conversa.
- Ao finalizar o atendimento, use como despedida: "Muito obrigado pela preferência. LG Bebidas construindo bons momentos 🍻"`;

// 1) Verificação do webhook (a Meta chama isso uma vez, ao configurar)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado com sucesso.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2) Recebimento de mensagens
app.post('/webhook', async (req, res) => {
  // Responde 200 imediatamente para a Meta não reenviar o evento
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return; // pode ser evento de status (entregue/lido), ignoramos

    const from = message.from; // número do cliente
    const text = message.text?.body;

    if (!text) return; // por enquanto só tratamos mensagens de texto

    const reply = await getAgentReply(from, text);

    // LOG TEMPORÁRIO — remova depois que o WhatsApp estiver configurado
    console.log('\n📩 Mensagem recebida:', text);
    console.log('🤖 Resposta do agente:', reply, '\n');

    await sendWhatsAppMessage(from, reply);
  } catch (err) {
    console.error('Erro ao processar mensagem:', err);
  }
});

async function getAgentReply(from, userText) {
  const history = conversations.get(from) || [];
  history.push({ role: 'user', content: userText });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: history,
  });

  const replyText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  history.push({ role: 'assistant', content: replyText });

  // Mantém só as últimas 20 mensagens para não estourar o contexto
  conversations.set(from, history.slice(-20));

  return replyText;
}

async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('Erro ao enviar mensagem no WhatsApp:', errBody);
  }
}

app.listen(PORT, () => {
  console.log(`Servidor do agente LG Bebidas rodando na porta ${PORT}`);
});
