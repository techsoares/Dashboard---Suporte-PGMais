# Configuração do Google OAuth2 — PGMais Dashboard

Guia passo a passo para configurar o login com Google no dashboard.

---

## 1. Criar Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Clique em **Selecionar projeto** (topo da página) → **Novo Projeto**
3. Nome: `PGMais Dashboard` (ou outro de sua preferência)
4. Clique em **Criar**
5. Selecione o projeto recém-criado

## 2. Configurar a Tela de Consentimento OAuth

1. No menu lateral, vá em **APIs e serviços** → **Tela de consentimento OAuth**
2. Selecione **Interno** (se usar Google Workspace corporativo) ou **Externo**
   - **Interno**: Apenas usuários do seu domínio Google Workspace poderão logar (recomendado para @pgmais)
   - **Externo**: Qualquer conta Google pode logar (o backend ainda valida o domínio)
3. Preencha:
   - **Nome do app**: `PGMais Dashboard`
   - **Email de suporte**: seu email corporativo
   - **Domínios autorizados**: `pgmais.com.br` (e o domínio do seu servidor, se aplicável)
   - **Emails de contato do desenvolvedor**: seu email
4. Clique em **Salvar e continuar**
5. Na aba **Escopos**, adicione:
   - `email`
   - `profile`
   - `openid`
6. Clique em **Salvar e continuar** até finalizar

## 3. Criar Credenciais OAuth 2.0

1. Vá em **APIs e serviços** → **Credenciais**
2. Clique em **+ Criar credenciais** → **ID do cliente OAuth**
3. Tipo de aplicativo: **Aplicativo da Web**
4. Nome: `PGMais Dashboard Web`
5. **Origens JavaScript autorizadas** — adicione TODAS as URLs onde o frontend roda:

### Desenvolvimento (local)
```
http://localhost:5173
http://localhost:8000
```

### Produção (ajuste para seu domínio)
```
https://dashboard.pgmais.com.br
https://seu-dominio.com.br
```

6. **URIs de redirecionamento autorizados** — para o fluxo de ID Token, não é necessário adicionar URIs de redirect (o Google Sign-In usa popup). Mas se quiser, adicione:

### Desenvolvimento
```
http://localhost:5173
```

### Produção
```
https://dashboard.pgmais.com.br
```

7. Clique em **Criar**
8. O Google vai mostrar seu **Client ID** e **Client Secret** — copie ambos!

## 4. Configurar as Variáveis de Ambiente

### Backend (`backend/.env`)

Abra (ou crie) o arquivo `backend/.env` e adicione:

```env
GOOGLE_CLIENT_ID=123456789-xxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxx
```

> O `GOOGLE_CLIENT_SECRET` não é usado diretamente no fluxo de ID Token (frontend → backend), mas é boa prática mantê-lo seguro no `.env` para futuras integrações.

### Frontend (`frontend/.env`)

Crie o arquivo `frontend/.env` (se não existir) e adicione:

```env
VITE_GOOGLE_CLIENT_ID=123456789-xxxxxxxxx.apps.googleusercontent.com
```

> **IMPORTANTE**: O `VITE_GOOGLE_CLIENT_ID` no frontend é o MESMO valor do `GOOGLE_CLIENT_ID` do backend. O Client ID é público — ele aparece no JavaScript do navegador e isso é seguro por design.

## 5. Verificar o .gitignore

Confirme que os arquivos `.env` estão no `.gitignore`:

```
.env
.env.local
.env.*.local
frontend/.env
```

> ⚠️ NUNCA commite arquivos `.env` com secrets reais.

## 6. Testar

### Desenvolvimento
```bash
# Terminal 1 — Backend
cd backend
python main.py

# Terminal 2 — Frontend
cd frontend
npm run dev
```

1. Acesse `http://localhost:5173`
2. O botão "Entrar com Google" deve aparecer na tela de login
3. Clique e selecione sua conta @pgmais.com.br
4. Se tudo estiver correto, será redirecionado ao dashboard

### Troubleshooting

| Problema | Solução |
|----------|---------|
| Botão Google não aparece | Verifique se `VITE_GOOGLE_CLIENT_ID` está no `frontend/.env` e reinicie o Vite (`npm run dev`) |
| Erro "Google OAuth não configurado" | Verifique se `GOOGLE_CLIENT_ID` está no `backend/.env` e reinicie o backend |
| Erro "idpiframe_initialization_failed" | Adicione `http://localhost:5173` nas **Origens JavaScript autorizadas** no Google Console |
| Erro "popup_closed_by_user" | O usuário fechou o popup — tente novamente |
| Erro "Apenas emails @pgmais são permitidos" | A conta Google usada não é do domínio permitido |
| Erro "Token Google inválido" | O `GOOGLE_CLIENT_ID` do frontend e backend devem ser IGUAIS |

## 7. Deploy em Produção

Ao subir para produção:

1. Adicione o domínio de produção nas **Origens JavaScript autorizadas** no Google Console
2. Atualize as variáveis de ambiente no servidor:
   - Backend: `GOOGLE_CLIENT_ID` no `.env`
   - Frontend: `VITE_GOOGLE_CLIENT_ID` no build ou nas variáveis do hosting
3. O código detecta automaticamente o ambiente — não precisa alterar URLs hardcoded

### Detecção automática de ambiente

O `apiUrl.js` do frontend já detecta automaticamente se está em:
- **localhost** → usa `http://localhost:8000`
- **Produção** → deriva a URL do backend a partir do host atual

Não é necessário configurar URLs de callback hardcoded.

---

## Resumo das Variáveis

| Variável | Onde | Exemplo |
|----------|------|---------|
| `GOOGLE_CLIENT_ID` | `backend/.env` | `123456789-xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `backend/.env` | `GOCSPX-xxxxxxxx` |
| `VITE_GOOGLE_CLIENT_ID` | `frontend/.env` | Mesmo valor do `GOOGLE_CLIENT_ID` |

## Fluxo de Segurança

```
Usuário → Clica "Entrar com Google"
       → Popup do Google (autenticação acontece no Google)
       → Google retorna ID Token (JWT assinado pelo Google)
       → Frontend envia ID Token ao backend (POST /api/auth/google)
       → Backend verifica:
           ✓ Assinatura do token (via google-auth lib)
           ✓ Audience = nosso GOOGLE_CLIENT_ID
           ✓ Token não expirado
           ✓ Email verificado pelo Google
           ✓ Domínio do email é @pgmais ou @ciclo
       → Backend cria JWT próprio (8h expiry)
       → Frontend armazena JWT e redireciona ao dashboard
```

Nenhuma senha é armazenada ou trafegada. O Google cuida da autenticação. O backend apenas verifica a identidade.
