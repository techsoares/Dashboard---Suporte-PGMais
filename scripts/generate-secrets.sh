#!/bin/bash
#
# Generate Kubernetes Secrets from environment files
# Converte variáveis de .env em K8s Secret manifests
#
# Exemplo de uso:
#   ./generate-secrets.sh --env backend/.env --namespace pgmais
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
ENV_FILE=""
NAMESPACE="pgmais"
OUTPUT_FILE="pgmais-secrets.yaml"

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        --env)
            ENV_FILE="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        *)
            log_error "Argumento desconhecido: $1"
            exit 1
            ;;
    esac
done

if [ -z "$ENV_FILE" ]; then
    log_error "Uso: $0 --env <arquivo> [--namespace <ns>] [--output <arquivo>]"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    log_error "Arquivo não encontrado: $ENV_FILE"
    exit 1
fi

log_info "Gerando Secret K8s a partir de: $ENV_FILE"
log_info "Namespace: $NAMESPACE"

# Criar secret YAML
cat > "$OUTPUT_FILE" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: pgmais-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
EOF

# Ler cada linha do .env e adicionar ao secret
while IFS='=' read -r key value; do
    # Ignorar linhas vazias e comentários
    [[ -z "$key" ]] && continue
    [[ "$key" =~ ^# ]] && continue

    # Remover espaços em branco
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)

    # Converter para chave K8s segura (lowercase, hífens em vez de underscores)
    secret_key=$(echo "$key" | tr '[:upper:]_' '[:lower:]-')

    # Adicionar ao arquivo
    echo "  $secret_key: \"$value\"" >> "$OUTPUT_FILE"
    log_info "  Adicionado: $secret_key"
done < "$ENV_FILE"

log_info ""
log_info "Secret gerado em: $OUTPUT_FILE"
log_info ""
log_info "Para aplicar no cluster:"
log_info "  kubectl apply -f $OUTPUT_FILE"
log_info ""
log_info "⚠️  ATENÇÃO:"
log_info "  - Este arquivo contém secrets em texto plano."
log_info "  - Nunca adicione ao repositório Git!"
log_info "  - Use um gerenciador de secrets em produção (Sealed Secrets, External Secrets, Vault)."
log_info "  - Adicione '$OUTPUT_FILE' ao .gitignore"
