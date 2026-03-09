# PGMais Dashboard

Dashboard de acompanhamento de times integrado ao Jira Cloud.
Exibe issues ativas por desenvolvedor, backlog geral e KPIs em tempo real.

---

## Estrutura do projeto

```
pgmais-dashboard/
├── backend/          # API FastAPI (proxy + cache do Jira)
└── frontend/         # SPA React + Vite
```

---

## Pré-requisitos

- Python 3.11+
- Node.js 18+
- Token de API do Jira Cloud

---

## Configuração

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Preencha o `.env`:

```env
JIRA_EMAIL=seu-email@empresa.com.br
JIRA_TOKEN=seu-token-aqui
JIRA_BASE_URL=https://sua-empresa.atlassian.net
JIRA_PROJECT=XX
REFRESH_SECRET=    # gere com: python -c "import secrets; print(secrets.token_hex(32))"
```

> O token do Jira é gerado em: **Perfil Jira → Segurança → Criar e gerenciar tokens de API**

### 2. Frontend

```bash
cd frontend
npm install
```

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Em desenvolvimento local, o `.env` pode ficar vazio — o frontend aponta automaticamente para `http://localhost:8000`.

---

## Rodando localmente

### Backend

```bash
cd backend
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python main.py
```

API disponível em `http://localhost:8000`
Documentação: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm run dev
```

Dashboard disponível em `http://localhost:5173`

---

## Endpoints da API

| Método | Rota            | Descrição                              |
|--------|-----------------|----------------------------------------|
| GET    | `/api/health`   | Status do serviço e cache              |
| GET    | `/api/dashboard`| Dados consolidados (cache de 5 min)    |
| POST   | `/api/refresh`  | Força atualização imediata do cache    |

O endpoint `/api/refresh` requer o header `X-Refresh-Secret` quando `REFRESH_SECRET` estiver configurado.

---

## Segurança

- Credenciais do Jira ficam **apenas no backend**, nunca chegam ao frontend
- O arquivo `.env` está no `.gitignore` e nunca é versionado
- CORS restrito às origens configuradas
- Erros internos não são expostos nas respostas da API

---

## Tecnologias

**Backend:** Python · FastAPI · httpx · Pydantic
**Frontend:** React · Vite · CSS customizado (brand PGMais)
**Integração:** Jira Cloud REST API v3
