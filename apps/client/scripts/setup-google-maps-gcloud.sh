#!/usr/bin/env bash
# Configura Google Maps Platform para o Zelo via gcloud CLI.
#
# Pré-requisitos (uma vez):
#   1. Conta Google Cloud com faturamento ativo
#   2. gcloud instalado: https://cloud.google.com/sdk/docs/install
#   3. gcloud auth login && gcloud auth application-default login
#
# Uso:
#   export GCP_PROJECT_ID=seu-projeto
#   export MAPS_REFERRERS='http://localhost:*/*,http://127.0.0.1:*/*,https://seu-dominio.com/*'
#   # opcional — IP/CIDR do servidor (Vercel etc.); omita em dev local
#   export MAPS_SERVER_ALLOWED_IPS='203.0.113.0/24'
#   ./scripts/setup-google-maps-gcloud.sh
#
# Saída: chaves no terminal + bloco sugerido para .env.local

set -euo pipefail

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Erro: '$1' não encontrado. Instale o Google Cloud SDK primeiro." >&2
    exit 1
  }
}

require gcloud
require jq

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Defina GCP_PROJECT_ID ou: gcloud config set project SEU_PROJETO" >&2
  exit 1
fi

REFERRERS="${MAPS_REFERRERS:-http://localhost:*/*,http://127.0.0.1:*/*}"
SERVER_IPS="${MAPS_SERVER_ALLOWED_IPS:-}"

echo "→ Projeto: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}" >/dev/null

APIS=(
  maps-backend.googleapis.com
  geocoding-backend.googleapis.com
  distance-matrix-backend.googleapis.com
)

echo "→ Habilitando APIs do Maps Platform..."
gcloud services enable "${APIS[@]}" --project="${PROJECT_ID}"

echo "→ Criando chave do browser (Maps JavaScript, restrita por referrer)..."
BROWSER_JSON="$(gcloud services api-keys create \
  --project="${PROJECT_ID}" \
  --display-name="Zelo — browser (Maps JS)" \
  --allowed-referrers="${REFERRERS}" \
  --api-target=service=maps-backend.googleapis.com \
  --format=json)"

BROWSER_KEY="$(echo "${BROWSER_JSON}" | jq -r '.response.keyString // .keyString // empty')"
if [[ -z "${BROWSER_KEY}" ]]; then
  echo "Não foi possível ler keyString da chave browser. Resposta:" >&2
  echo "${BROWSER_JSON}" >&2
  exit 1
fi

echo "→ Criando chave do servidor (Geocoding + Distance Matrix)..."
SERVER_ARGS=(
  services api-keys create
  --project="${PROJECT_ID}"
  --display-name="Zelo — server (Geocoding + Distance Matrix)"
  --api-target=service=geocoding-backend.googleapis.com
  --api-target=service=distance-matrix-backend.googleapis.com
)

if [[ -n "${SERVER_IPS}" ]]; then
  SERVER_ARGS+=(--allowed-ips="${SERVER_IPS}")
else
  echo "   (sem MAPS_SERVER_ALLOWED_IPS — chave server sem restrição de IP; use só em dev)"
fi

SERVER_JSON="$(gcloud "${SERVER_ARGS[@]}" --format=json)"
SERVER_KEY="$(echo "${SERVER_JSON}" | jq -r '.response.keyString // .keyString // empty')"
if [[ -z "${SERVER_KEY}" ]]; then
  echo "Não foi possível ler keyString da chave server. Resposta:" >&2
  echo "${SERVER_JSON}" >&2
  exit 1
fi

cat <<EOF

✓ APIs habilitadas e chaves criadas.

Cole no .env.local:

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${BROWSER_KEY}
GOOGLE_MAPS_API_KEY=${SERVER_KEY}

Referrers da chave browser: ${REFERRERS}
$( [[ -n "${SERVER_IPS}" ]] && echo "IPs permitidos na chave server: ${SERVER_IPS}" )

Próximos passos:
  - Produção: inclua https://seu-dominio.com/* em MAPS_REFERRERS
  - Servidor: defina MAPS_SERVER_ALLOWED_IPS com o IP de saída do host (Vercel etc.)
  - Console: https://console.cloud.google.com/google/maps-apis/overview?project=${PROJECT_ID}

EOF
