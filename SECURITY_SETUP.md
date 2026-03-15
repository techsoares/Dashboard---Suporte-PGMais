# Configuração de Segurança - PGMais Dashboard

## 🚨 **ATENÇÃO: PASSOS CRÍTICOS DE SEGURANÇA**

Este documento contém as instruções para configurar corretamente o ambiente de produção com segurança reforçada.

## 🔐 **1. Geração de Segredos Seguros**

### JWT Secret (Backend)
```bash
# Gere um segredo JWT forte (mínimo 64 caracteres)
python -c "import secrets; print(secrets.token_hex(64))"
```

### Refresh Secret (Backend & Frontend)
```bash
# Gere um segredo para refresh de cache (32 caracteres)
python -c "import secrets; print(secrets.token_hex(32))"
```

## 📧 **2. Configuração de Credenciais**

### JIRA Credentials
1. **JIRA_EMAIL**: Seu email corporativo @pgmais.com.br
2. **JIRA_TOKEN**: 
   - Acesse: https://id.atlassian.com/manage-profile/security/api-tokens
   - Crie um novo token
   - Copie e cole no arquivo `.env`

### OpenRouter API Key (Opcional)
1. **OPENROUTER_API_KEY**:
   - Cadastre-se em: https://openrouter.ai/
   - Gere sua chave API
   - Copie e cole no arquivo `.env`

## 🛡️ **3. Configuração de Segurança**

### Backend (.env)
```bash
# Atualize com os valores gerados
JWT_SECRET=seu_segredo_jwt_gerado_aqui
REFRESH_SECRET=seu_segredo_refresh_gerado_aqui

# Configure credenciais reais
JIRA_EMAIL=seu-email@pgmais.com.br
JIRA_TOKEN=seu-token-jira-aqui
OPENROUTER_API_KEY=sua-chave-openrouter-aqui
```

### Frontend (.env)
```bash
# Configure a URL do backend
VITE_API_URL=https://seu-backend.com.br

# Use o mesmo segredo do backend
VITE_REFRESH_SECRET=seu_segredo_refresh_gerado_aqui
```

## 🔒 **4. Segurança Adicional**

### .gitignore
- ✅ **Já configurado** para proteger arquivos sensíveis
- ✅ **Nunca commit** arquivos `.env` para o repositório

### Variáveis de Ambiente
- **Desenvolvimento**: Use arquivos `.env.local`
- **Produção**: Configure variáveis no ambiente do servidor
- **CI/CD**: Use secrets do pipeline

## 🚀 **5. Deploy Seguro**

### Antes do Deploy
1. ✅ Remova todos os arquivos `.env` do repositório
2. ✅ Configure variáveis de ambiente no servidor
3. ✅ Atualize o `.gitignore` se necessário
4. ✅ Teste a aplicação sem arquivos `.env`

### No Servidor
```bash
# Configure variáveis de ambiente
export JIRA_EMAIL="seu-email@pgmais.com.br"
export JIRA_TOKEN="seu-token-aqui"
export JWT_SECRET="seu-segredo-jwt"
export REFRESH_SECRET="seu-segredo-refresh"
export OPENROUTER_API_KEY="sua-chave-api"
```

## 📋 **6. Checklist de Segurança**

- [ ] **Segredos gerados** com força criptográfica
- [ ] **Credenciais JIRA** configuradas corretamente
- [ ] **OpenRouter API Key** configurada (opcional)
- [ ] **Arquivos .env** removidos do repositório
- [ ] **.gitignore** atualizado e testado
- [ ] **Variáveis de ambiente** configuradas no servidor
- [ ] **Testes de segurança** realizados
- [ ] **Documentação** atualizada

## ⚠️ **7. Monitoramento de Segurança**

### Logs de Segurança
- Monitorar tentativas de login suspeitas
- Verificar acesso a endpoints críticos
- Auditar mudanças em configurações

### Alertas
- Configure alertas para:
  - Múltiplas tentativas de login falhas
  - Acesso a endpoints de administração
  - Alterações em arquivos de configuração

## 🆘 **8. Em Caso de Vazamento**

### Se credenciais forem expostas:
1. **Imediatamente** gere novos tokens e segredos
2. **Revogue** tokens antigos
3. **Atualize** todas as instâncias
4. **Audite** logs de acesso
5. **Comunique** equipe de segurança

### Contatos de Segurança
- **Equipe de TI**: ti@pgmais.com.br
- **Segurança da Informação**: si@pgmais.com.br

---

## 📞 **Suporte**

Para dúvidas sobre configuração de segurança:
- **Email**: devops@pgmais.com.br
- **Slack**: #devops-security
- **Documentação**: [Wiki Interna](https://wiki.pgmais.com/security)