# 🎯 Setup Completo - Pronto para Rodar Local

Seu projeto **PGMais Dashboard** está 100% pronto para ser rodado em qualquer máquina local! 

---

## 📦 O Que Você Recebe

✅ **5 Novas Telas:**
- Dashboard (original melhorado)
- Filtros Avançados (Account, Produto, Responsável, Tipo)
- IA Insights (análise automática + chat)
- Visão Produto (ranking com radar)
- Kanban (colunas por status)

✅ **Backend Inteligente:**
- Dados mock integrados (funciona sem Jira)
- Cache de 5 minutos com suporte a filtros
- CORS configurado para localhost
- API bem documentada (/docs)

✅ **Frontend Moderno:**
- React com Vite (rápido!)
- Design PGMais mantido
- Detecção automática de URL (localhost)
- Responsivo e otimizado

✅ **Scripts Automáticos:**
- `setup.sh` para Linux/Mac
- `setup.bat` para Windows
- Instala tudo automaticamente

---

## 🚀 Como Usar Agora

### Opção 1: Setup Automático (⭐ Recomendado)

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

### Opção 2: Manual

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate (Windows)
pip install -r requirements.txt
python main.py

# Frontend (novo terminal)
cd frontend
npm install
npm run dev
```

---

## ✅ Verificar se Está Funcionando

### URLs
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Testes Rápidos
```bash
# Testar API
curl http://localhost:8000/api/dashboard | python -m json.tool

# Testar Frontend
curl http://localhost:5173 | head -20
```

---

## 📝 Arquivos Principais

```
├── README.md              ← Documentação completa
├── QUICKSTART.md          ← Guia rápido
├── setup.sh (Linux/Mac)   ← Script automático
├── setup.bat (Windows)    ← Script automático
├── backend/
│   ├── main.py           ← API FastAPI
│   ├── mock_data.py      ← Dados de teste
│   ├── models.py         ← Data models
│   ├── .env.example      ← Template config
│   └── requirements.txt
└── frontend/
    ├── src/App.jsx       ← Componente principal
    ├── src/components/   ← 7 novos componentes
    └── package.json
```

---

## 🔑 Credenciais Jira (Opcional)

Se quiser dados reais do Jira:

1. Gere um token em: https://id.atlassian.com/manage-profile/security/api-tokens
2. Edite `backend/.env`:
   ```env
   JIRA_EMAIL=seu-email@empresa.com.br
   JIRA_TOKEN=seu-token-aqui
   JIRA_BASE_URL=https://sua-empresa.atlassian.net
   JIRA_PROJECT=ON
   ```
3. Reinicie o backend

Sem isso, o projeto usa **dados mock automaticamente**.

---

## 🛠 Tecnologias

| Parte | Stack |
|-------|-------|
| **Backend** | Python 3.11 + FastAPI + Pydantic |
| **Frontend** | React 18 + Vite + CSS vanilla |
| **Cache** | In-memory (5min TTL) |
| **API** | Jira Cloud REST API v3 |

---

## 📊 Endpoints da API

```
GET /api/health
GET /api/dashboard?account=...&product=...&assignee=...&issue_type=...
POST /api/refresh
```

---

## 💡 Próximos Passos

1. **Customizar**: Editar cores em `frontend/src/App.css`
2. **Estender**: Adicionar novos componentes em `frontend/src/components/`
3. **Integrar**: Conectar credenciais Jira reais
4. **Deploy**: Seguir instruções em README.md seção "Deployment"

---

## 🆘 Troubleshooting

**Frontend não carrega?**
→ Limpar cache: Ctrl+Shift+Delete + Ctrl+F5

**Backend retorna erro?**
→ Reiniciar: Ctrl+C no terminal + `python main.py`

**CORS error?**
→ Backend CORS está OK para localhost, restartar navegador

**Precisa de ajuda?**
→ Ver `QUICKSTART.md` ou `README.md`

---

## 📈 Status

✅ Backend pronto
✅ Frontend pronto  
✅ Dados mock funcionando
✅ Filtros funcionando
✅ Scripts de setup prontos
✅ Documentação completa

🚀 **Pronto para usar!**

---

**Desenvolvido com ❤️ para PGMais**
