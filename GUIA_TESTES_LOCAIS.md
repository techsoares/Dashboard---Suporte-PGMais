# 🧪 Guia de Testes Locais - Melhorias UX/UI

## 🚀 Como Testar as Melhorias

### 1. Preparação do Ambiente

```bash
# Clonar/atualizar o repositório
cd pgmais-dashboard

# Instalar dependências (se necessário)
cd frontend
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

O dashboard estará disponível em: **http://localhost:5173**

---

## 🎯 Testes Rápidos

### Teste 1: Navegação com Pills (2 min)
1. Abra o dashboard
2. Veja as 4 pills no header: Dashboard | Análise | Visualização | [⚙️]
3. Hover em "Análise" → veja submenu com Gestão, IA, Produto
4. Hover em "Visualização" → veja submenu com Kanban, Priorização
5. Clique em cada opção para navegar
6. Clique em "⚙️" para abrir Admin
7. Clique novamente em "⚙️" para voltar ao Dashboard

### Teste 2: Atalhos de Teclado (2 min)
1. Pressione `Ctrl+K` (ou `Cmd+K` no Mac)
2. Veja o input de busca ser focado
3. Digite uma chave de issue (ex: "PROJ-123")
4. Pressione `ESC` para limpar
5. Abra um dropdown de filtro
6. Pressione `ESC` para fechar

### Teste 3: Filtros com Status Visual (2 min)
1. Clique em "Responsável"
2. Selecione um desenvolvedor
3. Veja "🔵 Dados filtrados" aparecer
4. Veja o botão "✕ limpar tudo"
5. Clique "✕ limpar tudo"
6. Veja o status desaparecer

### Teste 4: Responsividade (3 min)
1. Abra DevTools (F12)
2. Clique em "Toggle device toolbar" (Ctrl+Shift+M)
3. Teste em diferentes tamanhos:
   - Desktop (1920px)
   - Tablet (768px)
   - Mobile (375px)
4. Veja pills se reorganizarem
5. Veja filtros em coluna em mobile

### Teste 5: Acessibilidade (2 min)
1. Pressione `Tab` repetidamente
2. Veja a navegação passar por todos os elementos
3. Veja focus rings ao redor dos botões
4. Pressione `Enter` para ativar botões focados
5. Pressione `Space` para ativar checkboxes

---

## 🔍 Testes Detalhados

### Teste de Navegação Completa

```
1. Dashboard
   ✓ Vê KPIs
   ✓ Vê DevGrid
   ✓ Vê Backlog drawer

2. Análise → Gestão
   ✓ Vê tabela de gestão
   ✓ Volta com browser back

3. Análise → IA Insights
   ✓ Vê chat com IA
   ✓ Volta com browser back

4. Análise → Produto
   ✓ Vê ranking de produtos
   ✓ Volta com browser back

5. Visualização → Kanban
   ✓ Vê colunas por status
   ✓ Volta com browser back

6. Visualização → Priorização
   ✓ Vê matriz de priorização
   ✓ Volta com browser back

7. Admin
   ✓ Vê painel admin
   ✓ Volta com ⚙️
```

### Teste de Filtros Completo

```
1. Busca
   ✓ Ctrl+K foca input
   ✓ Digita chave (ex: PROJ-123)
   ✓ Vê resultados filtrados
   ✓ ESC limpa busca

2. Filtro por BU
   ✓ Clica em "BU"
   ✓ Seleciona uma BU
   ✓ Vê "Dados filtrados"
   ✓ Vê devs filtrados
   ✓ ESC fecha dropdown

3. Filtro por Responsável
   ✓ Clica em "Responsável"
   ✓ Seleciona um dev
   ✓ Vê "Dados filtrados"
   ✓ Vê issues do dev

4. Filtro por Account
   ✓ Clica em "Account"
   ✓ Seleciona uma conta
   ✓ Vê "Dados filtrados"

5. Filtro por Produto
   ✓ Clica em "Produto"
   ✓ Seleciona um produto
   ✓ Vê "Dados filtrados"

6. Filtro por Tipo
   ✓ Clica em "Tipo"
   ✓ Seleciona um tipo
   ✓ Vê "Dados filtrados"

7. Filtro por Status
   ✓ Clica em "Status"
   ✓ Seleciona um status
   ✓ Vê "Dados filtrados"

8. Múltiplos Filtros
   ✓ Seleciona 2+ filtros
   ✓ Vê "Dados filtrados"
   ✓ Vê KPIs atualizados
   ✓ Clica "✕ limpar tudo"
   ✓ Vê tudo resetado
```

### Teste de Responsividade Detalhado

**Desktop (1920px)**
```
✓ Pills em linha
✓ Submenus ao hover
✓ Timestamp visível
✓ Filtros em linha
✓ Backlog drawer vertical
✓ Sem scroll horizontal
```

**Tablet (768px)**
```
✓ Pills em linha (com wrap)
✓ Submenus ao hover/focus
✓ Timestamp visível
✓ Filtros em linha (com wrap)
✓ Backlog drawer vertical
✓ Sem scroll horizontal
```

**Mobile (375px)**
```
✓ Pills em 2 linhas
✓ Submenus funcionam
✓ Timestamp em destaque
✓ Filtros em coluna
✓ Backlog drawer horizontal
✓ Botões com tamanho adequado
✓ Sem scroll horizontal
```

---

## 🌓 Teste de Temas

### Modo Escuro
```bash
# Padrão ao abrir
✓ Cores corretas
✓ Contraste adequado
✓ Pills visíveis
✓ Filtros visíveis
✓ Notificações visíveis
```

### Modo Claro
```bash
# Clique em ☀️
✓ Cores corretas
✓ Contraste melhorado
✓ Amarelo ajustado
✓ Verde ajustado
✓ Pills visíveis
✓ Filtros visíveis
✓ Notificações visíveis
```

### Toggle
```bash
✓ Clique em ☀️ → modo claro
✓ Clique em 🌙 → modo escuro
✓ Transição suave
✓ Tema persiste (se implementado)
```

---

## ♿ Teste de Acessibilidade

### Com Teclado
```bash
1. Pressione Tab
   ✓ Foco passa por pills
   ✓ Foco passa por filtros
   ✓ Foco passa por botões
   ✓ Ordem é lógica

2. Pressione Enter
   ✓ Ativa pills
   ✓ Abre dropdowns
   ✓ Ativa botões

3. Pressione Space
   ✓ Ativa checkboxes
   ✓ Ativa botões

4. Pressione ESC
   ✓ Fecha dropdowns
   ✓ Fecha backlog drawer
```

### Com Leitor de Tela (NVDA/JAWS)
```bash
1. Ative o leitor
2. Navegue com Tab
3. Ouça descrições dos elementos
4. Verifique:
   ✓ Pills têm aria-label
   ✓ Botões têm aria-label
   ✓ Filtros têm aria-label
   ✓ Notificações têm role="alert"
   ✓ Seções têm role="region"
```

### Com Inspetor de Acessibilidade
```bash
1. Abra DevTools
2. Vá para "Accessibility" tab
3. Verifique:
   ✓ Sem erros de contraste
   ✓ Sem elementos sem label
   ✓ Sem elementos sem role
   ✓ Sem elementos sem descrição
```

---

## 🐛 Teste de Bugs Comuns

```bash
1. Dropdown preso aberto?
   ✓ Clique fora → fecha
   ✓ Pressione ESC → fecha
   ✓ Pressione Tab → fecha

2. ESC quebra navegação?
   ✓ Pressione ESC em dropdown → fecha
   ✓ Pressione ESC em backlog → fecha
   ✓ Navegação continua funcionando

3. Ctrl+K interfere?
   ✓ Ctrl+K foca busca
   ✓ Não interfere com Ctrl+C, Ctrl+V, etc
   ✓ Funciona em qualquer página

4. Filtros se perdem?
   ✓ Aplique filtro
   ✓ Navegue para outra view
   ✓ Volte ao dashboard
   ✓ Filtros ainda estão lá

5. Tema se reseta?
   ✓ Mude para modo claro
   ✓ Recarregue a página
   ✓ Tema persiste (se implementado)

6. Notificações presas?
   ✓ Notificação aparece
   ✓ Desaparece após 5s
   ✓ Múltiplas empilham
   ✓ Sem notificações presas
```

---

## 📊 Teste de Performance

### Velocidade
```bash
1. Abra DevTools → Performance
2. Teste busca
   ✓ Responde em <500ms
3. Teste filtros
   ✓ Aplicam em <300ms
4. Teste navegação
   ✓ Rápida entre views
5. Teste digitação
   ✓ Sem lag
```

### Memória
```bash
1. Abra DevTools → Memory
2. Tire screenshot inicial
3. Abra/feche dropdowns 10x
4. Aplique/limpe filtros 10x
5. Navegue entre views 10x
6. Tire screenshot final
7. Compare: memória não deve aumentar significativamente
```

---

## 📋 Checklist de Testes Rápidos

Copie e cole para testar rapidamente:

```
NAVEGAÇÃO
☐ Pills funcionam
☐ Submenus funcionam
☐ Admin funciona
☐ Volta ao Dashboard funciona

ATALHOS
☐ Ctrl+K foca busca
☐ ESC fecha dropdown
☐ ESC fecha backlog
☐ Tab navega

FILTROS
☐ Busca funciona
☐ Filtro por BU funciona
☐ Filtro por Responsável funciona
☐ Filtro por Account funciona
☐ Filtro por Produto funciona
☐ Filtro por Tipo funciona
☐ Filtro por Status funciona
☐ "Dados filtrados" aparece
☐ "✕ limpar tudo" funciona

RESPONSIVIDADE
☐ Desktop (1920px) OK
☐ Tablet (768px) OK
☐ Mobile (375px) OK

TEMAS
☐ Modo escuro OK
☐ Modo claro OK
☐ Toggle funciona

ACESSIBILIDADE
☐ Tab navega
☐ Enter ativa
☐ ESC funciona
☐ Aria labels presentes

PERFORMANCE
☐ Sem lag
☐ Sem memory leaks
☐ Rápido
```

---

## 🎬 Gravando um Teste

Para documentar um bug ou feature:

```bash
1. Abra o dashboard
2. Abra DevTools (F12)
3. Vá para "Console"
4. Reproduza o problema
5. Tire screenshot
6. Copie o console log
7. Documente com:
   - Navegador e versão
   - Dispositivo
   - Passos para reproduzir
   - Screenshot
   - Console log
```

---

## 📞 Precisa de Ajuda?

### Documentação
- GUIA_VISUAL_MELHORIAS.md - Entender as mudanças
- MELHORIAS_UX_UI.md - Detalhes técnicos
- CHECKLIST_TESTES.md - Testes abrangentes

### Problemas Comuns
1. Pills não aparecem? → Recarregue a página
2. Atalhos não funcionam? → Verifique o navegador
3. Filtros não funcionam? → Verifique o console
4. Mobile não funciona? → Verifique o DevTools

---

**Bom teste! 🚀**
