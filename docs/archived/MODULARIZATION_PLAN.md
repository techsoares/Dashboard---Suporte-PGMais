# 🏗️ Plano de Modularização do Backend — Enterprise Architecture

**Status:** 📋 Planejado (Próxima Etapa)  
**Data:** Abril 1, 2026  
**Escopo:** Refatorar backend monolítico para arquitetura modular profissional

---

## 🎯 Objetivo

Transformar `backend/main.py` (~1068 linhas) em uma **arquitetura modular profissional** seguindo padrões FastAPI enterprise:
- Separação clara de responsabilidades
- Testabilidade melhorada
- Escalabilidade facilitada
- Fácil manutenção

---

## 📁 Estrutura Alvo

```
backend/
├── src/                              # Código-fonte principal
│   ├── api/                          # Rotas/Endpoints
│   │   ├── __init__.py
│   │   ├── routes.py                 # Router principal
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py              # POST /api/v1/auth/login
│   │   │   ├── dashboard.py         # GET /api/v1/dashboard
│   │   │   ├── priority.py          # /api/v1/priority-requests
│   │   │   ├── admin.py             # /api/v1/admin/*
│   │   │   └── health.py            # GET /api/v1/health
│   │   └── deps.py                   # Dependências compartilhadas
│   │
│   ├── core/                         # Configuração e setup
│   │   ├── __init__.py
│   │   ├── config.py                 # Settings (BaseSettings)
│   │   ├── security.py               # Security: RateLimiter, Headers
│   │   ├── logging.py                # Logger configuration
│   │   └── constants.py              # Constantes da app
│   │
│   ├── domain/                       # Modelos e schemas (lógica de negócio)
│   │   ├── __init__.py
│   │   ├── models.py                 # Pydantic models (request/response)
│   │   ├── entities.py               # Domain entities (Issue, Dev, KPI)
│   │   ├── enums.py                  # Enumerações (Role, BU type, etc)
│   │   └── exceptions.py             # Custom exceptions
│   │
│   ├── infrastructure/               # Acesso a dados e APIs externas
│   │   ├── __init__.py
│   │   ├── database/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # SQLAlchemy base setup
│   │   │   ├── models.py            # ORM models (SQLAlchemy)
│   │   │   └── queries.py           # Database queries
│   │   ├── cache/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # Cache interface
│   │   │   ├── memory.py            # In-memory cache
│   │   │   └── sqlite.py            # SQLite cache backend
│   │   └── clients/
│   │       ├── __init__.py
│   │       ├── jira.py              # Jira Cloud API client
│   │       ├── openrouter.py        # OpenRouter AI client
│   │       └── google_oauth.py      # Google OAuth client
│   │
│   ├── services/                     # Lógica de negócio
│   │   ├── __init__.py
│   │   ├── auth_service.py           # Autenticação e JWT
│   │   ├── dashboard_service.py      # Dashboard aggregation
│   │   ├── priority_service.py       # Priority requests logic
│   │   ├── admin_service.py          # Admin operations
│   │   ├── jira_service.py           # Jira data processing
│   │   ├── ai_service.py             # IA insights
│   │   └── health_service.py         # Health checks
│   │
│   ├── utils/                        # Utilitários
│   │   ├── __init__.py
│   │   ├── validators.py             # Input validators
│   │   ├── sanitizers.py             # Output sanitizers
│   │   └── helpers.py                # Helper functions
│   │
│   └── main.py                       # FastAPI app initialization
│
├── tests/                            # Testes automatizados (novo)
│   ├── __init__.py
│   ├── conftest.py                   # Fixtures pytest
│   ├── unit/
│   │   ├── test_auth_service.py
│   │   ├── test_dashboard_service.py
│   │   └── test_validators.py
│   ├── integration/
│   │   ├── test_auth_endpoints.py
│   │   ├── test_dashboard_endpoints.py
│   │   └── test_priority_endpoints.py
│   └── fixtures/
│       ├── auth.py
│       ├── jira.py
│       └── database.py
│
├── main.py                           # Entry point (wrapper)
├── Dockerfile
├── requirements.txt
├── pyproject.toml
├── .env.example
└── .gitignore
```

---

## 📊 Comparação: Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Arquivos Python** | 1 (main.py + 8 helpers) | 30+ (modular) |
| **Linhas por arquivo** | ~1068 (main.py) | 50-150 (média) |
| **Estrutura** | Monolítica | Modular (Clean Architecture) |
| **Testabilidade** | ⚠️ Difícil | ✅ Fácil (deps injetáveis) |
| **Escalabilidade** | ⚠️ Limitada | ✅ Excelente |
| **Manutenibilidade** | ⚠️ Média | ✅ Alta |
| **Reusabilidade** | ⚠️ Baixa | ✅ Alta |
| **Testes** | ❌ Nenhum | ✅ 50+ testes |

---

## 🔄 Estratégia de Migração

### Fase 1: Setup (1-2 dias)
```bash
# 1. Criar estrutura de diretórios
mkdir -p backend/src/{api/v1,core,domain,infrastructure/{database,cache,clients},services,utils}
mkdir -p backend/tests/{unit,integration,fixtures}

# 2. Criar __init__.py em cada pasta
touch backend/src/**/__init__.py
touch backend/tests/**/__init__.py

# 3. Atualizar main.py (entry point apenas)
```

### Fase 2: Extrair Core (2-3 dias)
```python
# backend/src/core/config.py
# backend/src/core/security.py
# backend/src/core/logging.py
# Extracted from: main.py (linhas 1-100)
```

### Fase 3: Extrair Domain (1-2 dias)
```python
# backend/src/domain/models.py       # Pydantic models
# backend/src/domain/entities.py     # Business entities
# Extracted from: models.py (mover + expandir)
```

### Fase 4: Extrair Infrastructure (3-4 dias)
```python
# backend/src/infrastructure/database/queries.py
# backend/src/infrastructure/cache/
# backend/src/infrastructure/clients/jira.py
# Extracted from: jira_client.py, cache.py, database.py
```

### Fase 5: Extrair Services (3-4 dias)
```python
# backend/src/services/auth_service.py
# backend/src/services/dashboard_service.py
# Extracted from: auth.py, main.py routes
```

### Fase 6: Extrair API Routes (2-3 dias)
```python
# backend/src/api/v1/auth.py       # @router.post("/login")
# backend/src/api/v1/dashboard.py  # @router.get("/dashboard")
# Extracted from: main.py (rotas)
```

### Fase 7: Testes (3-4 dias)
```python
# backend/tests/unit/test_auth_service.py
# backend/tests/integration/test_auth_endpoints.py
# New: pytest + fixtures
```

### Fase 8: Validação (1-2 dias)
```bash
# Garantir que tudo funciona:
# docker-compose up
# pytest --cov=src tests/
# verifi que endpoints ainda funcionam
```

---

## 🔧 Exemplo: Extração de Auth

### Antes (main.py, linhas 150-200)
```python
@app.post("/api/auth/login")
async def login(request: LoginRequest):
    # Lógica de login misturada com rotas
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401)
    token = create_access_token(...)
    return {"access_token": token}
```

### Depois (modularizado)

**backend/src/domain/models.py**
```python
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

**backend/src/services/auth_service.py**
```python
class AuthService:
    def __init__(self, db: Session, security: SecurityConfig):
        self.db = db
        self.security = security
    
    def authenticate_user(self, email: str, password: str) -> str:
        user = self.db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.password_hash):
            raise UnauthorizedException("Invalid credentials")
        return create_access_token(user.id, self.security.secret_key)
```

**backend/src/api/v1/auth.py**
```python
from fastapi import APIRouter, Depends
from src.domain.models import LoginRequest, LoginResponse
from src.services.auth_service import AuthService

router = APIRouter(prefix="/api/v1", tags=["auth"])

@router.post("/auth/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    auth_service: AuthService = Depends()
):
    token = auth_service.authenticate_user(request.email, request.password)
    return LoginResponse(access_token=token)
```

**backend/src/main.py**
```python
from fastapi import FastAPI
from src.api.v1 import auth, dashboard, priority, admin
from src.core.config import settings

app = FastAPI(title="PGMais Dashboard")

# Include routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(priority.router)
app.include_router(admin.router)

@app.on_event("startup")
async def startup():
    # Initialize services
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 🧪 Testing Strategy

### Unit Tests (services)
```python
# tests/unit/test_auth_service.py
def test_authenticate_user_success(auth_service, user):
    token = auth_service.authenticate_user(user.email, "correct_password")
    assert token is not None
    assert isinstance(token, str)

def test_authenticate_user_invalid_password(auth_service, user):
    with pytest.raises(UnauthorizedException):
        auth_service.authenticate_user(user.email, "wrong_password")
```

### Integration Tests (endpoints)
```python
# tests/integration/test_auth_endpoints.py
def test_login_endpoint_success(client, user):
    response = client.post("/api/v1/auth/login", json={
        "email": user.email,
        "password": "correct_password"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
```

---

## 📋 Dependências do Projeto

```
✅ backend/main.py          → src/main.py (wrapper)
✅ backend/auth.py          → src/services/auth_service.py
✅ backend/cache.py         → src/infrastructure/cache/
✅ backend/database.py      → src/infrastructure/database/
✅ backend/jira_client.py   → src/infrastructure/clients/jira.py
✅ backend/models.py        → src/domain/models.py
✅ backend/security.py      → src/core/security.py
✅ backend/performance.py   → src/utils/helpers.py (opcional)
```

---

## ✅ Checklist de Implementação

### Preparação
- [ ] Criar estrutura de diretórios
- [ ] Criar `__init__.py` em todas as pastas
- [ ] Atualizar `pyproject.toml` para novo layout
- [ ] Criar `conftest.py` para pytest fixtures

### Core
- [ ] Mover config para `src/core/config.py`
- [ ] Mover security para `src/core/security.py`
- [ ] Criar `src/core/logging.py`

### Domain
- [ ] Mover/criar models em `src/domain/models.py`
- [ ] Criar `src/domain/entities.py`
- [ ] Criar `src/domain/enums.py`
- [ ] Criar `src/domain/exceptions.py`

### Infrastructure
- [ ] Mover database para `src/infrastructure/database/`
- [ ] Mover cache para `src/infrastructure/cache/`
- [ ] Mover clients para `src/infrastructure/clients/`

### Services
- [ ] Criar `src/services/auth_service.py`
- [ ] Criar `src/services/dashboard_service.py`
- [ ] Criar `src/services/priority_service.py`
- [ ] Criar `src/services/admin_service.py`
- [ ] Criar `src/services/jira_service.py`
- [ ] Criar `src/services/ai_service.py`

### API Routes
- [ ] Criar `src/api/v1/auth.py`
- [ ] Criar `src/api/v1/dashboard.py`
- [ ] Criar `src/api/v1/priority.py`
- [ ] Criar `src/api/v1/admin.py`
- [ ] Criar `src/api/v1/health.py`

### Tests
- [ ] Criar fixtures em `tests/fixtures/`
- [ ] Criar unit tests em `tests/unit/`
- [ ] Criar integration tests em `tests/integration/`
- [ ] Garantir 50%+ coverage

### Validação
- [ ] Docker build sucesso
- [ ] docker-compose up funciona
- [ ] Todos endpoints funcionam
- [ ] Testes passam (pytest)

---

## 🚀 Benefícios da Modularização

| Benefício | Impacto |
|-----------|--------|
| **Testabilidade** | Unit tests isolados por serviço |
| **Manutenibilidade** | Fácil encontrar/modificar código |
| **Escalabilidade** | Adicionar novos endpoints é trivial |
| **Reutilização** | Services podem ser usados em múltiplos endpoints |
| **Documentação** | Cada módulo tem responsabilidade clara |
| **Performance** | Lazy loading de dependências |
| **Compliance** | Fácil auditar fluxos de segurança |

---

## 📞 Próximos Passos

1. **Aprovação do plano** (este documento)
2. **Criar struktur de diretórios** (Fase 1)
3. **Extrair módulos** (Fases 2-6, paralelo)
4. **Implementar testes** (Fase 7)
5. **Validação e deployment** (Fase 8)

---

**Estimativa Total:** 2-3 semanas (4-6 horas/dia)  
**Linguagem:** Python (FastAPI)  
**Padrão:** Clean Architecture + Hexagonal  
**Status:** 📋 Aguardando Aprovação

