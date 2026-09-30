[README.md](https://github.com/user-attachments/files/32835265/README.md)
# Agente WhatsApp — LG Bebidas

Backend em Node.js que recebe mensagens no WhatsApp (Meta Cloud API), gera a resposta usando a Claude API e responde automaticamente ao cliente.

## 1. Pré-requisitos

- Node.js 18+ instalado
- Uma conta na [Meta for Developers](https://developers.facebook.com/)
- Uma chave de API da Anthropic ([console.anthropic.com](https://console.anthropic.com/))

## 2. Configurar o WhatsApp Cloud API (Meta)

1. Acesse developers.facebook.com → crie um App do tipo **Business**.
2. Dentro do app, adicione o produto **WhatsApp**.
3. Na aba **API Setup** você vai encontrar:
   - Um **número de teste** (pode usar para testar antes de migrar pro número real da LG Bebidas)
   - O **Temporary Access Token** (token de acesso, válido por 24h — depois você gera um permanente)
   - O **Phone Number ID**
4. Copie esses dados para o arquivo `.env` (veja passo 4).
5. Configure o **Webhook**:
   - URL: `https://SEU_DOMINIO/webhook` (precisa ser HTTPS público — veja passo 5 sobre deploy)
   - Verify Token: invente uma senha e coloque tanto na Meta quanto no `.env` (`VERIFY_TOKEN`)
   - Inscreva-se no campo **messages**

## 3. Instalar o projeto

```bash
npm install
```

## 4. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` e preencha com os valores reais (chave da Anthropic, token do WhatsApp, Phone Number ID, verify token).

## 5. Rodar localmente (teste)

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000`. Para a Meta conseguir enviar mensagens até sua máquina, use o [ngrok](https://ngrok.com/) para expor sua porta local:

```bash
ngrok http 3000
```

Use a URL HTTPS gerada pelo ngrok (ex: `https://abcd1234.ngrok.io/webhook`) como URL do webhook na Meta.

## 6. Colocar em produção

Para rodar 24h, hospede em um servidor. Opções simples:
- [Railway](https://railway.app/)
- [Render](https://render.com/)
- Uma VPS (DigitalOcean, AWS EC2, etc.)

Depois do deploy, troque a URL do webhook na Meta pela URL final (ex: `https://lg-bebidas-agent.up.railway.app/webhook`).

## 7. Migrar do número de teste para o número real da LG Bebidas

No painel da Meta, em **WhatsApp > API Setup**, clique em "Add phone number" e siga o processo de verificação do número real. Depois disso, o `WHATSAPP_PHONE_ID` muda para o do número novo — atualize o `.env`.

## 8. Editar o comportamento do agente

Todo o "cérebro" do agente está na constante `SYSTEM_PROMPT`, dentro de `server.js`. Para mudar preços, horários, produtos ou regras, edite esse texto diretamente.

## Observações

- A memória de conversa atual fica em RAM (`Map` do JavaScript) — se o servidor reiniciar, o histórico se perde. Para produção com muitos clientes, troque por um banco (Redis, Postgres, etc.).
- Por enquanto o agente só entende mensagens de **texto**. Para tratar áudio, imagem ou botões, é preciso expandir o `server.js`.
