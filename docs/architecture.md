# Arquitetura do Sistema — PGMais Dashboard

**Versão:** 1.0  
**Data:** Abril 2026  
**Ambientes:** Local, Staging, Produção (K8s)

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura de Componentes](#arquitetura-de-componentes)
3. [Fluxo de Dados](#fluxo-de-dados)
4. [Infraestrutura & Deployment](#infraestrutura--deployment)
5. [Padrões & Decisões](#padrões--decisões)

---

## Visão Geral

**PGMais Dashboard** é um sistema de gerenciamento de equipes integrado com Jira Cloud, construído com:

- **Frontend:** React 19 + Vite 7 (SPA)
- **Backend:** FastAPI + Python 3.11 (REST API)
- **Database:** SQLite (desenvolvimento), PostgreSQL (produção)
- **Cache:** In-memory + SQLite TTL (desenvolvimento)
- **Orquestração:** Kubernetes (produção)
- **IA:** OpenRouter (Claude Sonnet para insights)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PGMais Dashboard                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   [Frontend - React SPA]  ←─→  [Backend - FastAPI]  ←─→  [Jira]  │
│   - DashboardHome               - REST API               Cloud    │
│   - KanbanView                  - Auth (JWT)             API      │
│   - ProductView                 - Cache (Redis/SQLite)            │
│   - TimelineView                - Rate Limiting                    │
│   - etc.                        - Logging (Security)               │
│                                                                     │
│                              ↓                                      │
│                    [PostgreSQL / SQLite]                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquitetura de Componentes

### 1. Frontend (React SPA)

**Localização:** `frontend/src/`

```
frontend/
├── App.jsx                 # Orchestrator principal (565 linhas)
├── components/
│   ├── DashboardHome.jsx   # View principal
│   ├── KanbanView.jsx      # Kanban visual
│   ├── ProductView.jsx     # Por produto
│   ├── TimelineView.jsx    # Timeline
│   ├── AIInsightsView.jsx  # IA insights
│   └── DeprioritizeModal.jsx
├── styles/
│   ├── App.css
│   └── DeprioritizeModal.css
├── utils/
│   └── apiUrl.js           # URL resolution
└── assets/
```

**Responsabilidades:**
- Buscar dados do backend via `GET /api/dashboard`
- Gerenciar autenticação (JWT em localStorage)
- Filtrar dados client-side (useMemo)
- Pollingautomático a cada 5 minutos
- Suportar 8 views diferentes

**Tecnologias:**
- React 19 + Hooks (useState, useEffect, useMemo)
- Vite 7 (bundler, dev server)
- Fetch API nativo (sem axios)
- Sem Redux/Zustand (state management trivial)

---

### 2. Backend (FastAPI)

**Localização:** `backend/`

```
backend/
├── main.py              # ~1068 linhas, todas as rotas
├── models.py            # Pydantic models (Issue, DevSummary, KPI)
├── auth.py              # JWT + bcrypt + Google OAuth2
├── cache.py             # 3-tier: memory → SQLite → TTL
├── database.py          # SQLite init & queries
├── security.py          # RateLimiter, InputValidator, DataSanitizer
├── jira_client.py       # Jira Cloud API integration
├── performance.py       # Métricas & profiling
└── Dockerfile           # Multi-stage, distroless
```

**Arquitetura em Camadas:**

```
┌─────────────────────────────────────┐
│  HTTP Requests (REST API)           │
├─────────────────────────────────────┤
│  FastAPI + Middleware               │
│  - CORS                             │
│  - Request logging                  │
│  - Rate limiting                    │
├─────────────────────────────────────┤
│  Routes (@app.get, @app.post)       │
│  - GET /api/dashboard               │
│  - POST /api/auth/login             │
│  - POST /api/priority-requests      │
│  - etc.                             │
├─────────────────────────────────────┤
│  Services/Helpers                   │
│  - jira_client (fetch parallel)     │
│  - cache (in-memory + SQLite)       │
│  - auth (JWT validation)            │
│  - security (rate limit, validate)  │
├─────────────────────────────────────┤
│  Database                           │
│  - SQLite (dev) / PostgreSQL (prod) │
│  - Cached responses with TTL        │
├─────────────────────────────────────┤
│  External APIs                      │
│  - Jira Cloud API (REST)            │
│  - OpenRouter API (IA)              │
│  - Google OAuth2                    │
└─────────────────────────────────────┘
```

**Rotas Principais:**

| Rota | Método | Auth | Função |
|------|--------|------|--------|
| `/api/health` | GET | Nenhuma | Health check |
| `/api/dashboard` | GET | JWT | Core data (5min cache) |
| `/api/auth/login` | POST | Nenhuma | Local + Google OAuth |
| `/api/refresh` | POST | JWT | Refresh token |
| `/api/priority-requests` | GET/POST/DELETE | JWT | Gerenciar prioridades |
| `/api/admin/*` | GET/POST/PUT/DELETE | Admin | Gerenciamento admin |

---

### 3. Jira Integration

**Componente:** `jira_client.py`

**Operação:** Fetch paralelo de 4 endpoints:
1. **Active Issues:** Issues atribuídas ao usuário
2. **Done This Week:** Issues resolvidas na última semana
3. **Done Last Week:** Issues resolvidas 2 semanas atrás
4. **30-day History:** Histórico de 30 dias

**Implementação:**
```python
async def fetch_all_issues():
    tasks = [
        fetch_active_issues(),
        fetch_done_this_week(),
        fetch_done_last_week(),
        fetch_30_day_history()
    ]
    results = await asyncio.gather(*tasks)  # Paralelo!
```

**Cache:** Resposta completa cacheada por 5 minutos em:
1. In-memory (rápido, per-process)
2. SQLite (persiste entre restarts)
3. TTL automático (expira após 5min)

---

### 4. Autenticação & Autorização

**Componente:** `auth.py`

**Fluxo:**

```
┌─ Local Login
│  └─ Email + Senha → bcrypt verify → JWT (8h) + refresh token
│
├─ Google OAuth2
│  └─ Redireciona para Google → token → usuário criado
│
└─ JWT Validation
   └─ Cada requisição: Authorization: Bearer <token>
      → Backend verifica signature com JWT_SECRET
      → Extrai user_id, email, roles
      → Valida expiração
```

**Roles:**
- `user` — Acesso padrão a dashboard
- `admin` — Acesso a endpoints `/api/admin`
- `gestao` — Pode deprioritizar issues

---

### 5. Segurança em Camadas

**Componente:** `security.py`

```
┌─────────────────────────────────────┐
│  Rate Limiting (100 req/min, 15 login/15min)
├─────────────────────────────────────┤
│  Input Validation (Pydantic + regex)
│  - Jira keys: ^[A-Z]+-\d+$
│  - Emails: RFC 5322
│  - Max length checks
├─────────────────────────────────────┤
│  Output Sanitization
│  - Remove: token, password, secret, api_key
│  - Recursivo em dicts/lists
├─────────────────────────────────────┤
│  Security Headers
│  - CSP: default-src 'self'
│  - HSTS: max-age=31536000
│  - X-Frame-Options: DENY
├─────────────────────────────────────┤
│  Logging (SecurityLogger)
│  - Auth attempts
│  - Access denials
│  - Rate limit exceeded
└─────────────────────────────────────┘
```

---

## Fluxo de Dados

### Caso de Uso: Usuário faz login e vê dashboard

```
1. Frontend
   POST /api/auth/login { email, password }
   ↓
2. Backend (auth.py)
   - Valida input (email válido?)
   - Busca usuário no DB
   - Verifica senha com bcrypt
   - Gera JWT: { user_id, email, roles, exp: +8h }
   - Armazena refresh_token no DB
   - Retorna: { access_token, refresh_token }
   ↓
3. Frontend
   Armazena em localStorage
   Authorization: Bearer <access_token>
   ↓
4. GET /api/dashboard (com JWT)
   ↓
5. Backend (main.py)
   - Middleware valida JWT
   - Extrai user_id
   - Busca em cache (5min TTL)
     - Se hit: retorna cached response
     - Se miss: executa jira_client.fetch_all_issues()
       - 4 requisições paralelas ao Jira
       - Cache in-memory + SQLite
       - Retorna data consolidada
   ↓
6. Frontend
   Renderiza DashboardHome com dados
   Auto-refresh a cada 5 minutos
```

### Caso de Uso: Desprioritizar issue

```
1. Frontend (PrioritizationView.jsx)
   Usuario clica "Despriorizar tudo"
   Modal abre, usuário digita motivo
   ↓
2. POST /api/priority-requests/deprioritize
   { issue_key, deprioritization_reason }
   ↓
3. Backend (main.py)
   - Valida JWT (é gestao ou admin?)
   - Valida input (issue_key existe? motivo válido?)
   - Remove issue da priority queue
   - Armazena log em JSON (priority_requests.json)
     { issue_key, deprioritized_by, reason, timestamp }
   - Retorna: { status: "deprioritized", removed: N }
   ↓
4. Frontend
   Fecha modal
   Faz refresh do dashboard
   Exibe histórico de deprioritizações
```

---

## Infraestrutura & Deployment

### Desenvolvimento Local

```
┌──────────────────────────────────────┐
│  Docker Compose (docker-compose.yml) │
├──────────────────────────────────────┤
│  Frontend                            │
│  - Node.js + Vite dev server         │
│  - Port: 5173                        │
│  - Volume: ./frontend → /app         │
│                                      │
│  Backend                             │
│  - Python 3.11 + FastAPI             │
│  - Port: 8000                        │
│  - Volume: ./backend → /app          │
│                                      │
│  PostgreSQL                          │
│  - Port: 5432                        │
│  - Volume: pgmais_data               │
│                                      │
│  Network: pgmais-network             │
└──────────────────────────────────────┘
```

### Produção (Kubernetes)

```
┌────────────────────────────────────────────┐
│  Kubernetes Cluster                        │
├────────────────────────────────────────────┤
│  Namespace: pgmais                         │
│  ├─ Deployment: pgmais-backend (3 pods)   │
│  │  ├─ Image: distroless python3          │
│  │  ├─ Non-root user (UID 1000)           │
│  │  ├─ Resource limits: 500m CPU, 512Mi   │
│  │  ├─ Liveness probe: /api/health        │
│  │  └─ SecurityContext: restrictivo       │
│  │                                        │
│  ├─ Deployment: pgmais-frontend (2 pods)  │
│  │  ├─ Image: node:20-alpine              │
│  │  ├─ Resource limits: 200m CPU, 256Mi   │
│  │  └─ Liveness probe: GET /               │
│  │                                        │
│  ├─ Service: pgmais-backend (ClusterIP)   │
│  │  └─ Port: 80 → 8000                    │
│  │                                        │
│  ├─ Service: pgmais-frontend (ClusterIP)  │
│  │  └─ Port: 80 → 3000                    │
│  │                                        │
│  ├─ ConfigMap: pgmais-backend-config      │
│  │  └─ LOG_LEVEL, CACHE_TTL, etc.        │
│  │                                        │
│  ├─ Secret: pgmais-secrets                │
│  │  └─ JIRA_TOKEN, JWT_SECRET, etc.      │
│  │                                        │
│  ├─ NetworkPolicy: default-deny-all       │
│  │  └─ Whitelist explícito de fluxos      │
│  │                                        │
│  └─ HPA: Backend (3-10 pods)              │
│     └─ Scales on CPU 70% / Memory 80%     │
│                                        │
└────────────────────────────────────────────┘
```

**Deployment Flow:**

```
Git Push → GitHub Actions CI
├─ Build Docker image
├─ Push to registry (ECR/Docker Hub)
├─ Run tests & security scans
│
Merge to main
├─ Trigger CD pipeline
├─ kubectl apply -k k8s/overlays/production/
├─ Rolling update (maxSurge=1, maxUnavailable=0)
│
Health checks
├─ Liveness probe: GET /api/health
├─ Readiness probe: GET /api/health (30s delay)
│
Rollback (se necessário)
├─ kubectl rollout undo deployment/pgmais-backend
```

---

## Padrões & Decisões

### 1. Por que Vite? (Frontend)

| Alternativa | Vite | Webpack |
|-------------|------|---------|
| Dev Speed | ⚡ Instant HMR | Slow (recompile tudo) |
| Build Size | 📦 Pequeno | Maior |
| Config | 🎯 Minimal | Verboso |
| **Escolha** | ✅ Vite | Webpack |

### 2. Por que FastAPI? (Backend)

| Alternativa | FastAPI | Django |
|-------------|---------|--------|
| Speed | ⚡ Async nativo | Synchronous |
| Docs | 📚 Auto (Swagger) | Manual |
| Type hints | ✅ First-class | Bolted-on |
| Learning | 📖 Rápido | Longo |
| **Escolha** | ✅ FastAPI | Django |

### 3. Por que SQLite (Dev) + PostgreSQL (Prod)?

- **SQLite:** Zero config, sem processo separado, perfeito para dev local
- **PostgreSQL:** Escala em produção, suporta múltiplos workers, backups robustos

### 4. Por que Distroless?

```
Standard Python image:     Distroless:
├─ /bin/sh                 ├─ /bin/python
├─ /usr/bin/apt-get        ├─ Python stdlib
├─ /usr/bin/curl           └─ Libs (libc, etc.)
├─ /usr/bin/wget
└─ Muitos pacotes          Vantagens:
                           - 80% menor tamanho
                           - Sem shell (não pode executar commands)
                           - Sem curl/wget (não pode fazer download)
                           - Melhor para produção
```

### 5. NetworkPolicy Padrão: Deny All

```yaml
# Todos os pods começam com ZERO tráfego
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}  # Todas os pods
  policyTypes:
  - Ingress
  - Egress
  ingress: []      # Nenhum input
  egress: []       # Nenhum output

# Depois, whitelist explícito para cada fluxo:
# frontend → backend
# backend → database
# backend → jira.atlassian.net (egress)
```

**Por quê?** Princípio do menor privilégio: comece seguro, relaxe quando necessário.

---

## Próximos Passos (Roadmap)

- [ ] Modularizar backend (separar `main.py` em `routes/`, `services/`, `models/`)
- [ ] Adicionar testes automatizados (pytest + fixtures)
- [ ] GraphQL como alternativa ao REST
- [ ] WebSocket para atualizações em tempo real (vs polling)
- [ ] Hashicorp Vault para gerenciamento de secrets
- [ ] SealedSecrets no K8s (vs plain Secret manifests)

---

**Última atualização:** Abril 2026  
**Próxima revisão:** Julho 2026
