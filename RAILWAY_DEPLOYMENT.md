# Guia de Implantação no Railway - Sistema Lanchas Show

Este guia descreve o passo a passo para colocar a **Evolution API**, o **Redis**, o **PostgreSQL** e o **Backend Express** online no **Railway**, integrando-os com o frontend na **Vercel**.

---

## 1. Criar o Projeto no Railway

1. Acesse o painel do [Railway](https://railway.app/).
2. Clique em **"New Project"** -> **"Empty Project"**.
3. Dê um nome para o seu projeto (ex: `Lanchas Show WhatsApp`).

---

## 2. Adicionar os Serviços de Banco de Dados

### A. Adicionar PostgreSQL
1. Dentro do projeto no Railway, clique em **"New"** -> **"Database"** -> **"Add PostgreSQL"**.
2. Aguarde a criação.

### B. Adicionar Redis
1. Clique em **"New"** -> **"Database"** -> **"Add Redis"**.
2. Aguarde a criação.

---

## 3. Implantar a Evolution API (WhatsApp)

1. No Railway, clique em **"New"** -> **"Deploy from Docker Image"**.
2. Digite a imagem oficial: `evoapicloud/evolution-api:latest` e confirme.
3. Aguarde o serviço ser criado. Vá em **Settings** do serviço da Evolution API, role até **"Domains"** e clique em **"Generate Domain"** (ex: `https://lanchas-show-evolution.up.railway.app`).
4. Vá na aba **Variables** e adicione as seguintes variáveis de ambiente:

```env
PORT=8080
SERVER_URL=https://<SUA_URL_DA_EVOLUTION_API_GERADA_NO_RAILWAY>

# Autenticação
AUTHENTICATION_TYPE=apikey
AUTHENTICATION_API_KEY=<SUA_EVOLUTION_API_KEY>

# Webhook Global apontando para o seu backend Express (veja passo 4 para a URL)
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_GLOBAL_URL=https://<SUA_URL_DO_BACKEND_EXPRESS_GERADA_NO_RAILWAY>/api/whatsapp/webhook
WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false

# Eventos
WEBHOOK_EVENTS_APPLICATION_STARTUP=true
WEBHOOK_EVENTS_QRCODE_UPDATED=true
WEBHOOK_EVENTS_MESSAGES_SET=true
WEBHOOK_EVENTS_MESSAGES_UPSERT=true
WEBHOOK_EVENTS_MESSAGES_UPDATE=true
WEBHOOK_EVENTS_SEND_MESSAGE=true
WEBHOOK_EVENTS_CONNECTION_ACTIVE=true

# Conexão com o Postgres (Selecione a variável do Railway DATABASE_URL)
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=${{Postgres.DATABASE_URL}}
DATABASE_CONNECTION_CLIENT_NAME=lanchas_show
DATABASE_SAVE_DATA_CHATS=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_HISTORIC=false
DATABASE_SAVE_DATA_LABELS=false

# Cache Local no Volume da Evolution API
REDIS_ENABLED=true
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true
CACHE_REDIS_URI=${{Redis.REDIS_URL}}
```

*Nota: As variáveis `${{Postgres.DATABASE_URL}}` e `${{Redis.REDIS_URL}}` são referências automáticas fornecidas pelo Railway aos seus respectivos bancos recém-criados.*

---

## 4. Implantar o Servidor Backend (Express)

1. No Railway, clique em **"New"** -> **"GitHub Repo"**.
2. Conecte sua conta do GitHub e selecione o repositório `lipeeflores/lanchas-show` (ou o nome do seu repositório).
3. Vá em **Settings** do serviço do Backend, role até **"Domains"** e gere o domínio público (ex: `https://lanchas-show-backend.up.railway.app`).
4. Vá em **Variables** e adicione as variáveis de ambiente necessárias para o Express rodar:

```env
PORT=3001
VITE_SUPABASE_URL=<SEU_SUPABASE_URL_DO_ARQUIVO_.ENV>
VITE_SUPABASE_ANON_KEY=<SEU_SUPABASE_ANON_KEY_DO_ARQUIVO_.ENV>
SUPABASE_SERVICE_ROLE_KEY=<SEU_SUPABASE_SERVICE_ROLE_KEY_DO_ARQUIVO_.ENV>
GROQ_API_KEY=<SEU_GROQ_API_KEY_DO_ARQUIVO_.ENV>

# Conexão do backend com a Evolution API
EVOLUTION_API_URL=https://<SUA_URL_DA_EVOLUTION_API_GERADA_NO_PASSO_3>
EVOLUTION_API_KEY=<SUA_EVOLUTION_API_KEY>
EVOLUTION_INSTANCE_NAME=lanchas_show
```

---

## 5. Ajustar a Vercel para Apontar para o Railway

Como configuramos o frontend para usar caminhos relativos (`/api/...`), a Vercel precisa saber para onde encaminhar essas chamadas de API.

1. Abra o arquivo `vercel.json` no seu computador.
2. Altere o domínio da linha 5 para a URL real que o Railway gerou para o seu backend Express (Passo 4):
   ```json
   "destination": "https://<SUA_URL_DO_BACKEND_EXPRESS_GERADA_NO_RAILWAY>/api/:path*"
   ```
3. Salve o arquivo.
4. Execute o deploy novamente para atualizar a Vercel:
   ```bash
   npx vercel deploy --prod --yes
   ```

Pronto! Agora o frontend (Vercel), backend (Railway) e Evolution API (Railway) estarão conectados em nuvem e online 24 horas por dia.
