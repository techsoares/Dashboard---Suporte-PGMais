# PGMais Dashboard

Dashboard de acompanhamento de times integrado ao Jira Cloud com análise de dados, filtros avançados e múltiplas visualizações.

Exibe issues ativas por desenvolvedor, backlog geral, KPIs em tempo real, análise com IA, visão de produtos e kanban.

---

## 🎯 Funcionalidades

- **Dashboard Principal**: Visão geral com KPIs, devs e backlog
- **Filtros Avançados**: Filtrar por Account, Produto, Responsável e Tipo de Item
- **IA Insights**: Análise automática e chat interativo sobre os dados
- **Visão Produto**: Ranking de produtos com gráfico radar de eficiência
- **Kanban**: Visualização de colunas por status do Jira
- **Cache Inteligente**: 5 minutos de cache com invalidação por filtros
- **Dados Mock**: Funciona sem credenciais Jira para testes

---

## 📋 Pré-requisitos

- Python 3.11+
- Node.js 18+
- Token de API do Jira Cloud (opcional para testes com dados mock)

---

## 🚀 Quickstart Local

### ⚡ Automático (Recomendado)

**Linux/Mac:**
```bash
git clone https://github.com/techsoares/Dashboards-pgmais.git
cd Dashboards-pgmais
chmod +x setup.sh
./setup.sh
```

**Windows:**
```bash
git clone https://github.com/techsoares/Dashboards-pgmais.git
cd Dashboards-pgmais
setup.bat
```

### 🔧 Manual

### 1️⃣ Clonar e acessar

```bash
git clone https://github.com/techsoares/Dashboards-pgmais.git
cd Dashboards-pgmais
```

### 2️⃣ Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv .venv

# Ativar (Unix/Mac)
source .venv/bin/activate
# Ativar (Windows)
# .venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Configurar credenciais (opcional - funciona com dados mock sem isso)
cp .env.example .env
# Editar .env com suas credenciais Jira

# Rodar
python main.py
```

Backend rodará em: **http://localhost:8000**  
Swagger Docs: **http://localhost:8000/docs**

### 3️⃣ Frontend (novo terminal)

```bash
cd frontend

# Instalar dependências
npm install

# Rodar dev server
npm run dev
```

Frontend rodará em: **http://localhost:5173**

---

## 🔧 Estrutura

```
Dashboards-pgmais/
├── backend/
│   ├── main.py              # App FastAPI + rotas
│   ├── jira_client.py       # Cliente do Jira Cloud
│   ├── models.py            # Pydantic models
│   ├── cache.py             # Cache em memória
│   ├── mock_data.py         # Dados mock para desenvolvimento
│   ├── requirements.txt      # Dependências Python
│   └── .env.example         # Template de variáveis de ambiente
│
└── frontend/
    ├── src/
    │   ├── App.jsx          # Componente principal com rotas
    │   ├── App.css          # Estilos globais
    │   └── components/
    │       ├── KpiBar.jsx            # KPIs em cards
    │       ├── DevGrid.jsx           # Grid de desenvolvedores
    │       ├── BacklogPanel.jsx      # Painel de backlog
    │       ├── FiltersView.jsx       # Tela de filtros
    │       ├── AIInsightsView.jsx    # IA com análise
    │       ├── ProductView.jsx       # Ranking de produtos
    │       └── KanbanView.jsx        # Visão kanban
    ├── package.json
    ├── vite.config.js
    └── .env.local           # Config local (não versionado)
```

---

## 📡 API Endpoints

| Método | Rota            | Descrição                                    | Filters        |
|--------|-----------------|----------------------------------------------|----------------|
| GET    | `/api/health`   | Status do serviço                            | N/A            |
| GET    | `/api/dashboard`| Dados consolidados (cache 5min)              | account, product, assignee, issue_type |
| POST   | `/api/refresh`  | Força atualização (requer X-Refresh-Secret)  | N/A            |

**Exemplo de requisição com filtros:**
```bash
curl "http://localhost:8000/api/dashboard?account=PGMais&product=MIDWAY"
```

---

## 🔐 Segurança

- ✅ Credenciais Jira ficam **apenas no backend**
- ✅ `.env` está no `.gitignore` (nunca é versionado)
- ✅ CORS configurado com regex para localhost e tunnels
- ✅ Erros internos não são expostos
- ✅ Cache com TTL de 5 minutos

---

## 🛠 Desenvolvimento

### Estrutura de Código

- **Backend**: FastAPI middleware-based, logging estruturado, cache genérico
- **Frontend**: React hooks, componentes funcionais, CSS-in-JS com variáveis CSS
- **Comunicação**: Fetch API direct, sem axios/libraries

### Build & Deploy

**Frontend:**
```bash
cd frontend
npm run build   # Output: dist/
npm run dev     # Dev server com HMR
```

**Backend:**
```bash
python main.py  # Dev com reload automático
```

---

## 🚀 Deployment

### Produção

1. **Backend** (Docker ou servidor):
   - Configurar `.env` com credenciais Jira reais
   - Usar `gunicorn` ou similar: `gunicorn -w 4 -b 0.0.0.0:8000 main:app`
   - CORS: Adicionar domínios reais em `ALLOWED_ORIGINS`

2. **Frontend** (CDN ou servidor estático):
   - Build: `npm run build`
   - Servir `dist/` em HTTP/HTTPS
   - `.env.local` configurar `VITE_API_URL` para API em produção

---

## 📝 Licença

Propriedade de PGMais Tecnologia
