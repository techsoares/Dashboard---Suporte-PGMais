# 🚀 Quanto Rodar Localmente

## Passo a Passo Rápido

### 1. Terminal 1 - Backend
```bash
cd backend
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python main.py
# Aguarde: "Waiting for application startup"
# Backend: http://localhost:8000
# Docs: http://localhost:8000/docs
```

### 2. Terminal 2 - Frontend
```bash
cd frontend
npm run dev
# Dashboard: http://localhost:5173
```

---

## ✅ Funciona Sem Credenciais Jira?

**SIM!** O projeto vem com dados mock para teste.

Se quiser dados reais do Jira:
```bash
cd backend
cp .env.example .env
# Editar .env com suas credenciais
```

---

## 🐛 Troubleshooting

### Frontend não carrega
- Limpar cache: Ctrl+Shift+Delete
- Recarregar: Ctrl+F5
- Verificar console: F12 → Console

### Backend retorna erro
```bash
# Testar API
curl http://localhost:8000/api/dashboard
```

### CORS Error
- Backend CORS está configurado para localhost por padrão
- Se problema persistir, reiniciar ambos servidores

---

## 📱 Telas Disponíveis

1. **Dashboard** - Visão geral com KPIs
2. **Filtros** - Filtrar por Account/Produto/Dev/Tipo
3. **IA Insights** - Análise automática + chat
4. **Visão Produto** - Ranking com Radar
5. **Kanban** - Colunas por status

---

## 💾 Commits

Para salvar mudanças:
```bash
git add .
git commit -m "feat: descrição das mudanças"
git push
```

---

## 🚀 Next Steps

- [ ] Configurar credenciais Jira (opcional)
- [ ] Customizar cores/brand em `frontend/src/App.css`
- [ ] Adicionar novas visualizações em `frontend/src/components/`
- [ ] Estender API em `backend/main.py`

---

**Dúvidas?** Checar `README.md` para mais detalhes!
