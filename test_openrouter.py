#!/usr/bin/env python3
"""Teste de credencial OpenRouter"""

import json
import sys
import urllib.request
import urllib.error

api_key = "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"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "HTTP-Referer": "https://pgmais-dashboard",
    "X-Title": "PGMais Dashboard"
}

payload = {
    "model": "anthropic/claude-sonnet-4.6",
    "messages": [{"role": "user", "content": "Responda em uma única frase: está funcionando?"}],
    "max_tokens": 100
}

print("🔍 Testando credencial OpenRouter...")
print(f"   API Key: {api_key[:20]}...{api_key[-10:]}")

try:
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method='POST'
    )
    
    with urllib.request.urlopen(req, timeout=15) as response:
        status_code = response.status
        data = json.loads(response.read().decode('utf-8'))
        message = data.get("choices", [{}])[0].get("message", {}).get("content", "N/A")
        print(f"   Status Code: {status_code}")
        print(f"\n✅ Credencial OpenRouter FUNCIONANDO!")
        print(f"\nResposta da IA:")
        print(f"   {message}")
        sys.exit(0)
        
except urllib.error.HTTPError as e:
    status_code = e.code
    error_data = e.read().decode('utf-8')
    print(f"\n❌ Erro HTTP: {status_code}")
    print(f"Resposta (primeiros 300 chars):")
    print(f"   {error_data[:300]}")
    
    # Tratar erros específicos
    if status_code == 401:
        print("\n⚠️  Erro de autenticação: Verifique se a chave OpenRouter é válida")
    elif status_code == 429:
        print("\n⚠️  Erro: Limite de requisições excedido (rate limit)")
    
    sys.exit(1)
except urllib.error.URLError as e:
    print(f"❌ Erro de conexão: {e.reason}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Erro: {type(e).__name__}: {e}")
    sys.exit(1)
