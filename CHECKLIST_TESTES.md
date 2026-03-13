# ✅ Checklist de Testes - Melhorias UX/UI

## 🎯 Testes de Navegação

### Pills de Navegação
- [ ] Clicar em "Dashboard" leva ao dashboard
- [ ] Hover em "Análise" mostra submenu com Gestão, IA, Produto
- [ ] Clicar em "Gestão" navega para Management View
- [ ] Clicar em "IA Insights" navega para AI View
- [ ] Clicar em "Produto" navega para Product View
- [ ] Hover em "Visualização" mostra submenu com Kanban, Priorização
- [ ] Clicar em "Kanban" navega para Kanban View
- [ ] Clicar em "Priorização" navega para Prioritization View
- [ ] Clicar em "⚙️" (Admin) navega para Admin View
- [ ] Clicar novamente em "⚙️" volta para Dashboard

### Submenus
- [ ] Submenus aparecem ao hover
- [ ] Submenus desaparecem ao sair do hover
- [ ] Submenus aparecem ao focus (Tab)
- [ ] Submenus desaparecem ao ESC

---

## ⌨️ Testes de Atalhos de Teclado

### Ctrl+K / Cmd+K
- [ ] Pressionar Ctrl+K foca no input de busca
- [ ] Pressionar Cmd+K (Mac) foca no input de busca
- [ ] Placeholder menciona "(Ctrl+K)"
- [ ] Funciona em qualquer página

### ESC
- [ ] ESC fecha dropdown aberto
- [ ] ESC fecha backlog drawer
- [ ] ESC não interfere com outras ações

### Tab
- [ ] Tab navega entre pills
- [ ] Tab navega entre filtros
- [ ] Tab navega entre botões
- [ ] Ordem de tab é lógica

---

## 🎨 Testes de Acessibilidade

### ARIA Labels
- [ ] Botão "☀️" tem aria-label "Ativar modo claro"
- [ ] Botão "🌙" tem aria-label "Ativar modo resumo"
- [ ] Botão "↻" tem aria-label "Atualizar dados agora"
- [ ] Botão "⚙️" tem aria-label "Abrir painel admin"
- [ ] Botão "✕" tem aria-label "Limpar busca"
- [ ] Filtros têm aria-label descritivo

### ARIA Live
- [ ] Notificações aparecem com role="alert"
- [ ] Contador de backlog atualiza com aria-live
- [ ] Status de filtros atualiza com aria-live

### ARIA Expanded
- [ ] Dropdowns têm aria-expanded="true/false"
- [ ] Backlog drawer tem aria-expanded="true/false"

### Roles
- [ ] Seção de filtros tem role="region"
- [ ] Notificações têm role="alert"
- [ ] DevCard tem role="article"
- [ ] BacklogPanel tem role="complementary"

---

## 🔍 Testes de Filtros

### Status Visual
- [ ] Quando filtro é aplicado, aparece "🔵 Dados filtrados"
- [ ] Badge mostra cor azul clara
- [ ] Botão "✕ limpar tudo" aparece quando há filtros
- [ ] Contador de filtros atualiza corretamente

### Funcionalidade
- [ ] Filtro por BU funciona
- [ ] Filtro por Responsável funciona
- [ ] Filtro por Account funciona
- [ ] Filtro por Produto funciona
- [ ] Filtro por Tipo funciona
- [ ] Filtro por Status funciona
- [ ] Busca por chave funciona
- [ ] Busca por summary funciona
- [ ] Busca por pessoa funciona

### Interação
- [ ] ESC fecha dropdown de filtro
- [ ] Clicar fora fecha dropdown
- [ ] Múltiplas seleções funcionam
- [ ] Limpar filtro individual funciona
- [ ] "Limpar tudo" reseta todos os filtros

---

## 📱 Testes de Responsividade

### Desktop (>1024px)
- [ ] Pills em linha horizontal
- [ ] Submenus ao hover
- [ ] Timestamp visível
- [ ] Filtros em linha
- [ ] Backlog drawer vertical

### Tablet (768px-1024px)
- [ ] Pills se reorganizam
- [ ] Submenus funcionam ao hover/focus
- [ ] Filtros em linha com wrap
- [ ] Backlog drawer vertical

### Mobile (<640px)
- [ ] Pills em 2 linhas
- [ ] Filtros em coluna
- [ ] Backlog drawer horizontal
- [ ] Timestamp em destaque
- [ ] Botões com tamanho adequado
- [ ] Sem overflow horizontal

---

## 🌓 Testes de Tema

### Modo Escuro
- [ ] Cores corretas no dark mode
- [ ] Contraste adequado
- [ ] Pills visíveis
- [ ] Filtros visíveis
- [ ] Notificações visíveis

### Modo Claro
- [ ] Cores corretas no light mode
- [ ] Contraste melhorado
- [ ] Pills visíveis
- [ ] Filtros visíveis
- [ ] Notificações visíveis
- [ ] Amarelo ajustado para legibilidade
- [ ] Verde ajustado para legibilidade

### Toggle
- [ ] Clicar em "☀️" ativa modo claro
- [ ] Clicar em "🌙" ativa modo escuro
- [ ] Transição suave entre temas
- [ ] Tema persiste ao recarregar (se implementado)

---

## 📊 Testes de Dados

### Carregamento
- [ ] Spinner aparece ao carregar
- [ ] Dados carregam corretamente
- [ ] Erro mostra mensagem clara
- [ ] Botão "Tentar novamente" funciona

### Atualização
- [ ] Botão "↻ atualizar" funciona
- [ ] Timestamp atualiza
- [ ] Notificações de novos Jiras aparecem
- [ ] Auto-refresh a cada 5 minutos

### Filtros com Dados
- [ ] KPIs atualizam com filtros
- [ ] DevGrid atualiza com filtros
- [ ] Backlog atualiza com filtros
- [ ] Contadores atualizam

---

## 🎯 Testes de Notificações

### Aparência
- [ ] Notificação aparece no canto superior direito
- [ ] Animação de entrada suave
- [ ] Cor azul clara com borda
- [ ] Ícone "Novo Jira" visível

### Conteúdo
- [ ] Chave da issue visível
- [ ] Summary da issue visível
- [ ] Responsável visível
- [ ] Prioridade visível (se aplicável)

### Comportamento
- [ ] Notificação desaparece após 5 segundos
- [ ] Múltiplas notificações empilham
- [ ] Notificação tem role="alert"
- [ ] Leitores de tela anunciam

---

## 🔧 Testes de Performance

### Velocidade
- [ ] Busca responde em <500ms
- [ ] Filtros aplicam em <300ms
- [ ] Navegação entre views é rápida
- [ ] Sem lag ao digitar

### Memória
- [ ] Sem memory leaks ao abrir/fechar dropdowns
- [ ] Sem memory leaks ao aplicar/limpar filtros
- [ ] Sem memory leaks ao navegar entre views

---

## 🐛 Testes de Bugs Comuns

- [ ] Dropdown não fica preso aberto
- [ ] ESC não quebra navegação
- [ ] Ctrl+K não interfere com outros atalhos
- [ ] Filtros não se perdem ao navegar
- [ ] Tema não se reseta ao recarregar
- [ ] Notificações não ficam presas
- [ ] Backlog drawer fecha corretamente

---

## 📋 Checklist Final

### Antes de Deploy
- [ ] Todos os testes passaram
- [ ] Sem console errors
- [ ] Sem console warnings
- [ ] Performance aceitável
- [ ] Acessibilidade validada
- [ ] Responsividade testada
- [ ] Temas testados
- [ ] Atalhos funcionam
- [ ] Documentação atualizada

### Pós Deploy
- [ ] Monitorar erros em produção
- [ ] Coletar feedback de usuários
- [ ] Testar em navegadores reais
- [ ] Testar com leitores de tela
- [ ] Testar em dispositivos reais

---

## 📞 Contato para Issues

Se encontrar algum problema:
1. Descreva o comportamento esperado
2. Descreva o comportamento atual
3. Forneça passos para reproduzir
4. Mencione navegador e dispositivo
5. Anexe screenshot se possível

---

**Última atualização:** 2024
**Desenvolvido por:** Andressa Soares
