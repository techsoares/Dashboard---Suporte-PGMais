# 🎯 PGMais Dashboard

**Gerenciador de equipes integrado com Jira Cloud** — FastAPI + React 19 + PostgreSQL + Kubernetes

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org)
[![React 19](https://img.shields.io/badge/React-19-61dafb)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com)
[![Kubernetes Ready](https://img.shields.io/badge/Kubernetes-Ready-326ce5)](https://kubernetes.io)
[![Security](https://img.shields.io/badge/Security-Enterprise-red)](#segurança)

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Quickstart](#quickstart)
- [Instalação Completa](#instalação-completa)
- [API Documentation](#api-documentation)
- [Segurança](#segurança)
- [Deployment](#deployment)
- [Desenvolvimento](#desenvolvimento)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🚀 Visão Geral

**PGMais Dashboard** é uma plataforma web de gerenciamento de equipes conectada a Jira Cloud, permitindo:

✅ **Dashboard Unificado** — Visualize issues ativas, concluídas e prioridades em tempo real  
✅ **Múltiplas Views** — Kanban, Timeline, Produto, Priorização com filtros avançados  
✅ **Priorização Dinâmica** — Deprioritize issues com motivos auditados  
✅ **IA Insights** — Análise automática de throughput e aging com Claude Sonnet (OpenRouter)  
✅ **Autenticação Segura** — JWT local + Google OAuth2, rate limiting, bcrypt  
✅ **Enterprise-Ready** — Docker multi-stage hardened, K8s NetworkPolicies, compliance-focused

**Casos de uso:**
- Gerenciar workflows de desenvolvimento
- Acompanhar KPIs (throughput, velocity, aging)
- Priorizar issues em tempo real
- Auditar ações (quem deprioritizou e por quê)

---

## 🏗️ Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                     PGMais Dashboard                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   [Frontend]              [Backend]              [External]  │
│   React 19 SPA   ←────→   FastAPI         ←────→  Jira      │
│   - DashboardHome          - REST API            Cloud      │
│   - KanbanView             - Auth (JWT)          API        │
│   - ProductView            - Cache               OpenRouter │
│   - TimelineView           - Rate Limiting       (IA)       │
│   - etc. (8 views)         - Logging                        │
│                                                              │
│       ↓                         ↓                            │
│   localStorage          PostgreSQL / SQLite                  │
│   (JWT + refresh)       (prod / dev)                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Mais detalhes:** Veja [docs/architecture.md](docs/architecture.md)

---

## 🏃 Quickstart (5 minutos)

### Pré-requisitos
- **Python 3.11+** e **Node.js 18+**
- **Git**
- **Credenciais Jira Cloud** (email + token)

### 1. Clone e Setup Inicial

```bash
git clone https://github.com/pgmais/dashboard.git
cd dashboard
./scripts/setup-dev.sh
```

### 2. Configure Variáveis

```bash
# Backend
cd backend
cp .env.example .env
# Edite .env com suas credenciais:
# - JIRA_EMAIL=seu-email@pgmais.dev
# - JIRA_TOKEN=seu-token-api-jira
# - JWT_SECRET=gere-um-aleatório-32-bytes
# - GOOGLE_CLIENT_ID=seu-google-id (opcional)
```

### 3. Inicie os Serviços

```bash
# Terminal 1 — Backend
cd backend
source .venv/bin/activate  # ou: . .venv/Scripts/activate (Windows)
python main.py
# Backend running on http://localhost:8000

# Terminal 2 — Frontend
cd frontend
npm run dev
# Frontend running on http://localhost:5173
```

### 4. Login

Acesse http://localhost:5173 e faça login com:
- Email registrado no `.env` (ADMIN_EMAIL)
- Senha correspondente ao `ADMIN_PASSWORD_HASH` (salted bcrypt)

Ou use **Google OAuth** (se configurado).

---

## 📦 Instalação Completa

### Opção 1: Docker Compose (Recommended for Dev)

```bash
# Build images
docker-compose build

# Crie arquivo de secrets (não comita!)
mkdir -p secrets
echo "sua_senha_postgres" > secrets/postgres_password.txt

# Inicie
docker-compose up -d

# Acesse
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
# Postgres: localhost:5432
```

**Parar:**
```bash
docker-compose down -v  # -v remove volumes
```

### Opção 2: Local (Desenvolvimento avançado)

**Pré-requisitos:** PostgreSQL 16+ instalado e rodando

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Crie arquivo .env
cp .env.example .env
# Edite com suas credenciais

# Inicie backend (Uvicorn)
python main.py

# Frontend (em outro terminal)
cd frontend
npm ci  # install usando package-lock
npm run dev
```

### Opção 3: Kubernetes (Produção)

**Pré-requisitos:** `kubectl` configurado, cluster K8s disponível

```bash
# 1. Build e push de imagens
docker build -f backend/Dockerfile -t seu-registro/pgmais-backend:latest backend/
docker push seu-registro/pgmais-backend:latest

# 2. Crie secrets
./scripts/generate-secrets.sh --env backend/.env --namespace pgmais

# 3. Deploy (development)
kubectl apply -k k8s/overlays/development/

# 3. Deploy (production)
kubectl apply -k k8s/overlays/production/

# 4. Verifique
kubectl get pods -n pgmais
kubectl logs -n pgmais -l app=pgmais-backend

# 5. Acesse via Ingress (configure seu hostname)
curl https://api.pgmais.example.com/api/health
```

**Limpeza:**
```bash
kubectl delete -k k8s/overlays/production/
```

---

## 📚 API Documentation

### Base URL

```
Development:  http://localhost:8000
Production:   https://api.pgmais.example.com
```

### Authentication

Todos os endpoints exceto `/api/auth/login` requerem **JWT Bearer Token**:

```http
GET /api/dashboard
Authorization: Bearer <access_token>
```

### Core Endpoints

#### 1. **Health Check** (sem auth)

```http
GET /api/health

Response (200 OK):
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-04-01T12:00:00Z"
}
```

#### 2. **Login** (sem auth)

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@pgmais.dev",
  "password": "senha_segura"
}

Response (200 OK):
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "refresh_token_value",
  "token_type": "bearer",
  "expires_in": 28800
}
```

#### 3. **Get Dashboard** (com JWT)

```http
GET /api/dashboard
Authorization: Bearer <access_token>

Response (200 OK):
{
  "devs": [
    {
      "name": "João Silva",
      "email": "joao@pgmais.dev",
      "active_issues": 5,
      "done_this_week": 3,
      "done_last_week": 8,
      "bu": "Operacional"
    }
  ],
  "backlog": [...],
  "done_issues": [...],
  "kpis": {
    "total_throughput": 42,
    "weekly_average": 10.5,
    "aging_analysis": {...}
  },
  "timestamp": "2026-04-01T12:00:00Z",
  "cached": true,
  "cache_ttl_seconds": 300
}
```

#### 4. **Deprioritize Issue** (Gestao/Admin)

```http
POST /api/priority-requests/deprioritize
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "issue_key": "ON-123",
  "deprioritization_reason": "Issue foi resolvida em paralelo"
}

Response (200 OK):
{
  "status": "deprioritized",
  "issue_key": "ON-123",
  "removed": 1,
  "reason": "Issue foi resolvida em paralelo"
}
```

---

## 🔐 Segurança

### Overview

✅ **Non-root Docker** — Roda com UID 1000  
✅ **Distroless Image** — Sem shell, sem curl/wget  
✅ **Secrets Management** — Via env vars ou K8s Secrets  
✅ **Rate Limiting** — 100 req/min, 15 login/15min  
✅ **Input Validation** — Pydantic + regex  
✅ **JWT Auth** — HS256, 8h TTL  
✅ **HTTPS/TLS** — Obrigatório em produção  
✅ **NetworkPolicy** — Deny-all por padrão, whitelist explícito  
✅ **OWASP Compliance** — Top 10 mitigado

### How to Report Security Issues

**NÃO crie issues públicas!**

📧 Envie para: `security@pgmais.dev`  
Inclua:
- Descrição clara da vulnerabilidade
- Passos para reproduzir
- Impacto estimado

**Prazo de resposta:** 48 horas  
**Divulgação:** Aguarde 90 dias após patch

**Veja [docs/security.md](docs/security.md) para mais detalhes.**

---

## 🚀 Deployment

### Manual Deploy Checklist

- [ ] Todos os testes passam localmente
- [ ] `.env` e `secrets/` foram removidos (gitignored)
- [ ] `pip-audit` não encontra vulnerabilidades
- [ ] Dockerfile build bem-sucedido
- [ ] Docker image roda sem erros
- [ ] K8s manifests validam com `kubectl apply --dry-run=client`
- [ ] Backup do banco de dados feito
- [ ] HTTPS/TLS configurado
- [ ] DNS apontando para Ingress

---

## 🛠️ Desenvolvimento

### Project Structure

```
Dashboards-pgmais/
├── backend/
│   ├── src/              (em breve: modularização)
│   ├── tests/            (em breve: pytest)
│   ├── Dockerfile        (multi-stage, distroless)
│   ├── main.py           (~1068 lines)
│   ├── auth.py, cache.py, database.py, jira_client.py, ...
│   ├── requirements.txt   (versões exatas, locked)
│   └── pyproject.toml     (PEP 518 compliant)
│
├── frontend/
│   ├── src/
│   │   ├── components/    (8 views)
│   │   └── styles/
│   └── vite.config.js
│
├── k8s/
│   ├── base/             (manifests base)
│   └── overlays/
│       ├── development/
│       └── production/
│
├── scripts/
│   ├── healthcheck.sh
│   ├── setup-dev.sh
│   └── generate-secrets.sh
│
├── docs/
│   ├── architecture.md
│   ├── security.md
│   └── manual_tecnico.html
│
└── docker-compose.yml
```

---

## 🐛 Troubleshooting

Veja [docs/security.md#troubleshooting](docs/security.md) para soluções comuns.

---

## 👥 Contributing

- **Code Standards:** PEP 8 (black + ruff), ESLint
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`)
- **Security:** Reporte privado para security@pgmais.dev

---

## 📞 Contato & Suporte

- **Email:** team@pgmais.dev
- **Docs:** [GitHub Wiki](https://github.com/pgmais/dashboard/wiki)
- **Issues:** [GitHub Issues](https://github.com/pgmais/dashboard/issues)
- **Security:** security@pgmais.dev

---

## 📄 Licença

MIT License — Uso interno PGMais

---

**Mantido com ❤️ pelo PGMais Team**  
**Última atualização:** Abril 2026
