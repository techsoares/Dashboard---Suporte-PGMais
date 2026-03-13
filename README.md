# PGMais Dashboard

Dashboard de gestão de equipe integrado com Jira Cloud com autenticação JWT, gestão de unidades de negócio e priorização inteligente de chamados.

## 🚀 Início Rápido

### Pré-requisitos
- Python 3.11+
- Node.js 18+ (testado com Node 20.18)

### 1️⃣ Primeira vez - Configurar (apenas uma vez)

**Windows:**
```bash
setup.bat
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

### 2️⃣ Usar o Dashboard

**Iniciar:**
- Windows: Clique 2x em `🚀 INICIAR DASHBOARD.bat`

**Parar:**
- Windows: Clique 2x em `⛔ PARAR DASHBOARD.bat`
- Ou feche as janelas do Backend e Frontend

**Verificar:**
- Windows: Clique 2x em `VERIFICAR.bat`

> 💡 O script abre automaticamente 2 janelas (Backend + Frontend). Não precisa digitar nada!

### 🔧 Setup Manual (alternativa)

<details>
<summary>Clique para expandir</summary>

#### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
# ou
source .venv/bin/activate  # Linux/Mac

pip install -r requirements.txt

# Copiar e configurar .env
copy .env.example .env  # Windows
# ou
cp .env.example .env  # Linux/Mac

# Editar .env com suas credenciais Jira
python main.py
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

</details>

## 🌐 Acessos

- **Dashboard**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **API Health**: http://localhost:8000/api/health

## 💾 Banco de Dados

O sistema utiliza **SQLite** (`backend/pgmais.db`) para armazenamento local.
Não é necessário configurar nenhum banco de dados externo.

## 📝 Configuração

### Backend (.env)
```env
JIRA_EMAIL=seu-email@empresa.com.br
JIRA_TOKEN=seu-token-aqui
JIRA_BASE_URL=https://sua-empresa.atlassian.net
JIRA_PROJECT=XX
OPENROUTER_API_KEY=sua-chave-aqui
JWT_SECRET=sua-chave-secreta-jwt
REFRESH_SECRET=sua-chave-refresh
```

### Frontend (.env.local)
```env
# Deixe vazio para usar http://localhost:8000 automaticamente
VITE_API_URL=
VITE_REFRESH_SECRET=sua-chave-refresh
```

## 🔐 Autenticação

O sistema utiliza **autenticação JWT** com login via email corporativo.

### Login
- **Domínios permitidos**: @pgmais ou @ciclo
- **Auto-cadastro**: Usuários são criados automaticamente no primeiro login
- **Admins**: Requerem senha obrigatória configurada no painel administrativo

### Primeiro Admin
Para criar o primeiro administrador, adicione suas credenciais em `backend/auth.py`:

```python
ADMIN_CREDENTIALS = {
    "seu-email@pgmais.com.br": "SuaSenhaSegura123",
}
```

Após o primeiro login como admin, você pode gerenciar outros administradores pelo painel.

## 👥 Gestão de Usuários e BUs

### Painel Administrativo
Acesse o painel admin clicando no ícone ⚙️ no header (disponível apenas para admins).

**Funcionalidades:**
- ✅ Criar e gerenciar Unidades de Negócio (BUs)
- ✅ Vincular usuários do Jira às BUs
- ✅ Definir tipo de BU (Operacional ou Gestão)
- ✅ Visualizar usuários sem BU vinculada
- ✅ Gerenciar administradores do sistema
- ✅ Drag & drop para vincular usuários

### Tipos de BU
- **Operacional**: Equipes de desenvolvimento e suporte
- **Gestão**: Diretoria e C-Level (podem despriorizar chamados)

## 🎯 Priorização Inteligente

O sistema utiliza **IA (Claude Sonnet 4.6)** para avaliar solicitações de prioridade.

### Como funciona
1. Usuário solicita priorização de um chamado com justificativa
2. IA avalia urgência e atribui boost (0-500 pontos)
3. BUs de Gestão recebem multiplicador 1.5x (até 750 pontos)
4. Chamados são reordenados automaticamente por score

### Critérios de Avaliação
- **400-500**: Produção parada, perda financeira imediata
- **250-399**: Impacto significativo em cliente grande
- **100-249**: Impacto moderado, cliente insatisfeito
- **0-99**: Baixa urgência, sem impacto real

## 📊 Funcionalidades

### Dashboard Principal
- KPIs em tempo real (total sprint, em progresso, aguardando, concluídos, atrasados)
- Grid de desenvolvedores com issues ativas
- Backlog lateral com filtros avançados
- Notificações de novos chamados
- Modo noturno/resumo

### Análise
- **Gestão**: Dados históricos de entrega e SLA
- **IA Insights**: Análise inteligente do backlog
- **Produto**: Visão por produto/account

### Visualização
- **Kanban**: Board visual por status
- **Priorização**: Gestão de solicitações de prioridade

### Filtros
- Por BU, responsável, account, produto, tipo e status
- Busca por chave, título ou pessoa
- Filtros persistem entre visualizações

## 🛠️ Tecnologias

### Backend
- **Framework**: FastAPI + Python 3.11
- **Autenticação**: JWT (PyJWT)
- **Banco**: SQLite
- **API Externa**: Jira Cloud REST API
- **IA**: OpenRouter (Claude Sonnet 4.6)
- **Cache**: Sistema de cache em memória com TTL

### Frontend
- **Framework**: React 18 + Vite
- **Estilo**: CSS Modules com variáveis CSS
- **Estado**: React Hooks (useState, useEffect, useMemo)
- **HTTP**: Fetch API nativa
- **Autenticação**: JWT em localStorage

## 🔒 Segurança

- ✅ Autenticação JWT com tokens Bearer
- ✅ Validação de entrada em todos os endpoints
- ✅ Sanitização de dados
- ✅ Headers de segurança (CSP, X-Frame-Options, etc)
- ✅ Rate limiting em endpoints críticos
- ✅ CORS configurado para origens permitidas
- ✅ Senhas obrigatórias para administradores

## 📈 Performance

- Cache inteligente de 5 minutos para dados do dashboard
- Cache de 1 hora para dados históricos
- Paginação e lazy loading
- Filtros client-side para melhor UX
- Requisições paralelas ao Jira

## 🎨 UI/UX

- Design system baseado na identidade visual PGMais
- Modo claro e escuro
- Responsivo (desktop, tablet, mobile)
- Atalhos de teclado (Ctrl+K para busca, Esc para fechar)
- Notificações toast para novos chamados
- Drag & drop para gestão de BUs

## 📝 Logs e Monitoramento

- Logs estruturados com níveis (INFO, WARNING, ERROR)
- Arquivo `backend.log` com histórico de operações
- Endpoint `/api/health` para healthcheck
- Métricas de cache e performance

## 🤝 Contribuindo

Desenvolvido e mantido por **Andressa Soares**.

## 📄 Licença

Uso interno PGMais.
