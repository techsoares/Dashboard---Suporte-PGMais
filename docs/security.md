# Política de Segurança — PGMais Dashboard

**Versão:** 1.0  
**Data:** Abril 2026  
**Mantido por:** PGMais Security Team

---

## Índice

1. [Como Reportar Vulnerabilidades](#como-reportar-vulnerabilidades)
2. [Políticas de Segurança](#políticas-de-segurança)
3. [OWASP Top 10 — Status & Mitigações](#owasp-top-10--status--mitigações)
4. [Infraestrutura de Segurança](#infraestrutura-de-segurança)
5. [Gerenciamento de Secrets](#gerenciamento-de-secrets)
6. [Autenticação & Autorização](#autenticação--autorização)
7. [Verificações de Segurança](#verificações-de-segurança)

---

## Como Reportar Vulnerabilidades

### ⚠️ IMPORTANTE: NÃO crie issues públicas para vulnerabilidades!

Se encontrar uma vulnerabilidade de segurança:

1. **Envie um email para:** `security@pgmais.dev`
2. **Inclua:**
   - Descrição clara da vulnerabilidade
   - Passos para reproduzir (se aplicável)
   - Impacto estimado
   - Seu nome e contato para crédito

3. **Prazo de resposta:** 48 horas
4. **Divulgação responsável:** Aguarde 90 dias após patch antes de divulgar publicamente

**Exemplo:**
```
Assunto: [SEGURANÇA] SQL Injection em /api/dashboard

Descrição: O endpoint GET /api/dashboard é vulnerável a SQL injection através do parâmetro 'issue_key'...
Passos: 1. Faça login com user qualquer 2. Navegue para dashboard 3. Injete: ...
Impacto: Alto - permite ler dados de todos os usuários
```

---

## Políticas de Segurança

### 1. Senhas e Secrets

- ✅ **Nunca** hardcode secrets em código, git ou docker-compose.yml
- ✅ Use variáveis de ambiente via `.env` (gitignored)
- ✅ Em K8s, use Kubernetes Secrets ou Vault
- ✅ Em Docker, use Docker Secrets quando possível
- ✅ Senha de admin deve ter min 16 caracteres, incluindo números, símbolos
- ✅ Rotate secrets a cada 90 dias em produção

### 2. Controle de Acesso

- ✅ Apenas 2 níveis: `user` e `admin`
- ✅ Roles verificadas no backend (nunca confie no frontend)
- ✅ JWT com TTL de 8 horas
- ✅ Refresh tokens armazenados no backend (não no frontend)
- ✅ Deprioritização apenas por `Gestao` ou `Admin`

### 3. Dependências (Supply Chain)

- ✅ Todas as dependências Python com versão exata (`==`)
- ✅ Use `pip-audit` para verificar vulnerabilidades: `pip-audit --skip-editable`
- ✅ Atualizar dependências **mensalmente**, nunca automaticamente
- ✅ Testar updates em staging antes de produção
- ✅ Hash de integridade verificado em CI/CD (quando possível)

### 4. Comunicação (Transport Security)

- ✅ HTTPS obrigatório em produção (TLS 1.2+)
- ✅ HSTS header: `max-age=31536000; includeSubDomains`
- ✅ CSP header: restritivo, não `unsafe-inline`
- ✅ Sem informações sensíveis em logs ou URLs
- ✅ Rate limiting: 100 req/min por IP, 15 login attempts/15min

### 5. Dados Pessoais (LGPD Compliance)

- ✅ Logs de quem deprioritizou issues (auditoria)
- ✅ Acesso a dados pessoais (email do Jira) restrito a admins
- ✅ Dados em trânsito criptografados (HTTPS)
- ✅ Banco de dados em ambiente controlado (não em computador pessoal)

---

## OWASP Top 10 — Status & Mitigações

### A01: Broken Access Control

**Status:** ⚠️ Requer Validação

| Risco | Mitigação |
|-------|-----------|
| Usuário regular acessa dados de outro | `@require_role("admin")` no backend |
| Escalação de privilégio | JWT validado, roles do DB, não do frontend |

**Verificação:**
```bash
# Tente acessar /api/admin sem ser admin
curl -H "Authorization: Bearer $USER_TOKEN" http://localhost:8000/api/admin/users
# Deve retornar 403 Forbidden
```

---

### A02: Cryptographic Failures

**Status:** ✅ OK

- JWT assinado com HS256 + `JWT_SECRET` de 32+ bytes
- Senhas com bcrypt (rounds=12)
- HTTPS obrigatório em produção (TLS 1.2+)

**Verificação:**
```python
# Hash de senha testado
import bcrypt
bcrypt.checkpw(b"password", b"$2b$12$...")  # OK
```

---

### A03: Injection

**Status:** ✅ OK

- Pydantic valida todos os inputs
- SQLAlchemy com prepared statements (não raw SQL)
- Jira client sanitiza issue keys com regex

**Exemplo seguro:**
```python
# ✅ SEGURO - Pydantic valida
class IssueKey(BaseModel):
    key: str = Field(..., regex=r"^[A-Z]+-\d+$")

# ❌ INSEGURO - raw string (não fazemos isto)
query = f"SELECT * FROM issues WHERE key = '{key}'"
```

---

### A04: Insecure Design

**Status:** ⚠️ Risco: REFRESH_SECRET no Frontend

**Problema:**
- `VITE_REFRESH_SECRET` é público no bundle JS
- Qualquer um pode verificar refresh tokens

**Mitigação Recomendada:**
```diff
# FRONTEND (VITE)
- VITE_REFRESH_SECRET=abc123  ❌ Público no JS bundle
+ Não envie secrets no frontend

# BACKEND
- POST /api/refresh { token, refresh_secret }
+ POST /api/refresh { token }  ✅ Secret no header ou cookie secure
```

**Short-term (agora):**
- Documentar risco
- Usar `httpOnly` cookies para refresh tokens (se possível)

**Long-term (próximo sprint):**
- Migrar para opaque refresh tokens no backend
- Frontend não possui o secret, apenas envia o token

---

### A05: Security Misconfiguration

**Status:** ✅ OK (após hardening)

| Item | Antes | Depois |
|------|-------|--------|
| Docker roda como root | ❌ | ✅ Non-root |
| Imagem tem shell | ❌ | ✅ Distroless |
| CSP header | ❌ | ✅ Configurado |
| HSTS header | ❌ | ✅ Configurado |
| X-Frame-Options | ❌ | ✅ DENY |

---

### A06: Vulnerable Components

**Status:** ⚠️ Requer Monitoramento

**Mitigação:**
```bash
# Verificar vulnerabilidades (mensal)
pip install pip-audit
pip-audit --skip-editable

# Atualizar versões
pip install --upgrade fastapi uvicorn pydantic
pip freeze > requirements.txt
```

**Versões Atualizadas (2026-04-01):**
- fastapi: 0.115.0 (✅ sem CVEs conhecidas)
- uvicorn: 0.33.0 (✅ sem CVEs conhecidas)
- sqlalchemy: 2.0.36 (✅ sem CVEs conhecidas)

---

### A07: Authentication Failures

**Status:** ✅ OK

- Rate limiting: 15 tentativas/15min por IP
- JWT validation obrigatório
- Sesssions expiram em 8h
- Passwords com bcrypt + salt

---

### A08: Software Integrity

**Status:** ⚠️ Sem Assinatura de Artefatos

**Mitigação:**
- Todos os artifacts em CI/CD assinados (Sigstore/cosign)
- Container images assinadas com chaves do time
- Hashes de commits verificados

---

### A09: Logging Failures

**Status:** ✅ OK

- `SecurityLogger` registra: access denial, rate limit, invalid input
- Logs incluem timestamp, IP, user_id, action
- Senhas/tokens **nunca** são logadas (sanitizadas)

**Exemplo:**
```python
# ✅ Seguro
self.logger.warning(f"Deprioritization by {user_id} on {issue_key}: {reason}")

# ❌ Inseguro (não fazemos isto)
self.logger.debug(f"Token: {token}")
```

---

### A10: SSRF (Server-Side Request Forgery)

**Status:** ⚠️ Requer Validação

**Risco:**
- Jira client faz requisições para URL externa (`JIRA_BASE_URL`)
- Se um atacante controlar `JIRA_BASE_URL`, pode fazer SSRF

**Mitigação:**
```python
# ✅ Validar URL
from urllib.parse import urlparse
url = os.getenv("JIRA_BASE_URL")
parsed = urlparse(url)
assert parsed.scheme in ("http", "https"), "Schema deve ser http/https"
assert not parsed.hostname in ("localhost", "127.0.0.1"), "Não pode ser localhost"
```

---

## Infraestrutura de Segurança

### Docker (Containerização)

**Multi-stage build:**
- Stage 1: Compila dependências (com gcc, make, etc.)
- Stage 2: Runtime (distroless, sem shell)

**Non-root user:**
```dockerfile
FROM gcr.io/distroless/python3-debian12:nonroot
USER nonroot  # Roda com UID 65532
```

**Benefícios:**
- Sem shell (`/bin/sh`) no container de produção
- Sem `curl`, `wget`, `apt-get` (reduz superfície de ataque)
- Usuário non-root não pode usar `sudo`

### Kubernetes (Orquestração)

**Network Policies:**
```yaml
# Padrão: DENY ALL
# Depois: whitelist explícito de fluxos permitidos
#   - Frontend → Backend (porta 8000)
#   - Backend → Banco de dados (porta 5432)
#   - Backend → Jira Cloud API (porta 443)
```

**Security Context:**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
```

### Rate Limiting

```python
# 100 requisições por minuto por IP
api_limiter = RateLimiter(max_requests=100, window_seconds=60)

# 15 tentativas de login por 15 minutos por IP
auth_limiter = RateLimiter(max_requests=15, window_seconds=900)
```

---

## Gerenciamento de Secrets

### Localmente (Desenvolvimento)

```bash
# 1. Crie .env.local (gitignored)
echo "JIRA_EMAIL=seu-email@pgmais.dev" > backend/.env.local
echo "JIRA_TOKEN=seu-token" >> backend/.env.local
echo "JWT_SECRET=$(openssl rand -hex 32)" >> backend/.env.local

# 2. Carregue com python-dotenv
from dotenv import load_dotenv
load_dotenv(".env.local")
```

### Em Docker (Compose)

```bash
# Crie arquivo com senha
echo "sua_senha_segura" > secrets/postgres_password.txt

# Referencie no compose (se suportado):
secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
```

### Em Kubernetes (Produção)

```bash
# 1. Gere secrets a partir de .env
./scripts/generate-secrets.sh --env backend/.env --namespace pgmais

# 2. Ou crie manualmente:
kubectl create secret generic pgmais-secrets \
  --from-literal=jira-email=email@pgmais.dev \
  --from-literal=jwt-secret=$(openssl rand -hex 32) \
  -n pgmais

# 3. Reference nos Deployments:
env:
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: pgmais-secrets
        key: jwt-secret
```

### Em Produção (Vault)

```bash
# Use HashiCorp Vault ou AWS Secrets Manager
vault kv get secret/pgmais/jwt-secret
vault kv put secret/pgmais/jwt-secret value="..."
```

---

## Autenticação & Autorização

### Fluxo de Login

```
1. POST /api/auth/login { email, password }
2. Backend valida com bcrypt
3. Cria JWT com user_id, email, roles
4. Retorna access_token (8h TTL) + refresh_token (24h)
5. Frontend armazena em localStorage (não é ideal, mas é o atual)
6. Cada requisição inclui: Authorization: Bearer <access_token>
7. Backend valida JWT signature com JWT_SECRET
```

### Roles & Permissions

```python
# Dois níveis
ROLE_USER = "user"       # Pode ver dashboard, filtrar
ROLE_ADMIN = "admin"     # Pode gerenciar usuários, BUs, ranking

# No backend, cheque sempre:
@app.get("/api/admin/users")
@require_role("admin")    # Retorna 403 se não for admin
async def list_users():
    ...
```

### Token Refresh

```javascript
// Frontend: Se access_token expirou, use refresh_token
const response = await fetch(`${API_URL}/api/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: localStorage.getItem('refresh_token'),
    refresh_secret: VITE_REFRESH_SECRET  // ⚠️ Exposto no JS!
  })
});
// Retorna novo access_token
```

---

## Verificações de Segurança

### Checklist Pré-Deploy (Produção)

- [ ] Todos os secrets removidos de `docker-compose.yml` e `.env`
- [ ] `.env` e `secrets/` estão no `.gitignore`
- [ ] `docker build` executa sem warnings
- [ ] `pip-audit` não encontra vulnerabilidades
- [ ] HTTPS configurado com certificado válido
- [ ] HSTS, CSP, X-Frame-Options headers presentes
- [ ] JWT_SECRET tem 32+ bytes aleatórios
- [ ] Rate limiting testado (tentativa com força bruta falha)
- [ ] NetworkPolicy aplicada no K8s (deny-all + whitelist)
- [ ] Logs não contêm tokens/senhas

### Testes de Segurança

```bash
# 1. Scan de dependências
pip-audit --skip-editable

# 2. Scan de código (opcional, requer bandit)
pip install bandit
bandit -r backend/src

# 3. Verificação de headers
curl -I https://api.pgmais.dev/ | grep -E "(CSP|HSTS|X-Frame)"

# 4. Test de rate limiting
for i in {1..20}; do curl http://localhost:8000/api/health; done
# Deve retornar 429 Too Many Requests após 15 tentativas

# 5. Test de autorização
curl -H "Authorization: Bearer $USER_TOKEN" http://localhost:8000/api/admin/users
# Deve retornar 403 se user não for admin
```

---

## Changelog de Segurança

| Data | Mudança | Severidade |
|------|---------|-----------|
| 2026-04-01 | Dockerfile hardening (distroless, non-root) | Alto |
| 2026-04-01 | Secrets removidos de docker-compose | Crítico |
| 2026-04-01 | Versão exata de dependências (supply chain) | Alto |
| 2026-04-01 | NetworkPolicy K8s (deny-all by default) | Alto |

---

## Contatos & Recursos

- **Security Team:** security@pgmais.dev
- **Documentação:** https://github.com/pgmais/dashboard/wiki
- **Issues:** https://github.com/pgmais/dashboard/security/advisories
- **OWASP Top 10:** https://owasp.org/www-project-top-ten/

---

**Última atualização:** Abril 2026  
**Próxima revisão:** Julho 2026
