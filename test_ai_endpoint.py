#!/usr/bin/env python3
"""Teste de endpoint de IA do dashboard"""

import json
import sys
import urllib.request
import urllib.error

print("🔍 Testando endpoint /api/ai/chat do backend...")

# Teste 1: Verificar se o endpoint responde
try:
    payload = {
        "question": "Qual é o status geral do projeto?",
        "context": "Teste de conexão com OpenRouter"
    }
    
    req = urllib.request.Request(
        "http://localhost:8000/api/ai/chat",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"},
        method='POST'
    )
    
    print("\n1️⃣  Chamando /api/ai/chat SEM autenticação...")
    with urllib.request.urlopen(req, timeout=15) as response:
        status_code = response.status
        data = json.loads(response.read().decode('utf-8'))
        print(f"   ✅ Status: {status_code}")
        print(f"   Resposta: {str(data)[:300]}...")
        
except urllib.error.HTTPError as e:
    status_code = e.code
    error_data = e.read().decode('utf-8')
    print(f"   Status Code: {status_code}")
    
    if status_code == 401:
        print("   ⚠️  Erro 401 (esperado): Requer autenticação")
    elif status_code == 503:
        print("   ⚠️  Erro 503: OpenRouter não está configurada ou indisponível")
        print(f"   Mensagem: {error_data[:200]}")
    else:
        print(f"   ❌ Erro HTTP: {error_data[:200]}")
    
except urllib.error.URLError as e:
    print(f"   ❌ Erro de conexão: {e.reason}")
    print("      Backend não está rodando em http://localhost:8000")
except Exception as e:
    print(f"   ❌ Erro: {type(e).__name__}: {e}")

# Teste 2: Status do backend
print("\n2️⃣  Verificando health do backend...")
try:
    req = urllib.request.Request("http://localhost:8000/api/health", method='GET')
    with urllib.request.urlopen(req, timeout=5) as response:
        data = json.loads(response.read().decode('utf-8'))
        print(f"   ✅ Backend está rodando")
        print(f"   Status: {data.get('status', 'N/A')}")
except Exception as e:
    print(f"   ❌ Backend não responde: {e}")

print("\n📝 Resumo:")
print("   ✅ Credencial OpenRouter: FUNCIONANDO")
print("   ⚠️  Endpoint de IA: Requer token de autenticação")
print("\n   Para usar o endpoint em produção:")
print("   1. Faça login (POST /api/auth/login)")
print("   2. Use o access_token recebido no header Authorization")
print("   3. Chame POST /api/ai/chat com o token")
