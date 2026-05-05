#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# Hubfy — Script de instalação
#
# Uso (gerado automaticamente pelo lp.hubfy.io/setup):
#   bash <(curl -fsSL https://raw.githubusercontent.com/hubfy-lite/hubfy-lite/main/scripts/install.sh) TOKEN
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Cores ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

log_ok()   { echo -e "  ${GREEN}✅ $1${RESET}"; }
log_err()  { echo -e "\n  ${RED}✗  $1${RESET}"; }
log_step() { echo -e "\n  ${CYAN}→${RESET}  ${BOLD}$1${RESET}"; }
log_warn() { echo -e "  ${YELLOW}⚠️  $1${RESET}"; }

# ── Boas-vindas ───────────────────────────────────────────────────
clear
echo ""
echo -e "  ${BOLD}${CYAN}Hubfy — Instalação${RESET}"
echo -e "  ${CYAN}────────────────────────────────────────${RESET}"
echo ""

# ── Verificar token ───────────────────────────────────────────────
TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
  log_err "Token não fornecido."
  echo ""
  echo "  Acesse https://lp.hubfy.io/setup para gerar seu token."
  echo ""
  exit 1
fi

# ── Verificar dependências ────────────────────────────────────────
for cmd in git node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    log_err "Comando '${cmd}' não encontrado."
    echo ""
    case "$cmd" in
      git)  echo "  Instale em: https://git-scm.com" ;;
      node) echo "  Instale em: https://nodejs.org (versão 18+)" ;;
      npm)  echo "  Vem junto com o Node.js" ;;
    esac
    echo ""
    exit 1
  fi
done

# ── Decodificar token ─────────────────────────────────────────────
log_step "Verificando token..."

CREDS=$(HUBFY_TOKEN="$TOKEN" node -e "
  try {
    // Suporta base64 padrão e base64url (substitui - por + e _ por /)
    const b64 = process.env.HUBFY_TOKEN.replace(/-/g, '+').replace(/_/g, '/');
    const raw = Buffer.from(b64, 'base64').toString('utf8');
    const d = JSON.parse(raw);
    if (!d.supabase_url || !d.anon_key) throw new Error('campos ausentes');
    // Usa delimitadores únicos para evitar ambiguidade com newlines dentro dos valores
    process.stdout.write(
      d.supabase_url.trim() + '|||' +
      d.anon_key.trim()     + '|||' +
      (d.pat || '').trim()
    );
  } catch(e) {
    process.stderr.write('Token inválido: ' + e.message + '\n');
    process.exit(1);
  }
" 2>&1) || {
  log_err "Token inválido ou expirado."
  echo ""
  echo "  Gere um novo em: https://lp.hubfy.io/setup"
  echo ""
  exit 1
}

SUPABASE_URL=$(echo "$CREDS" | awk -F'\\|\\|\\|' '{print $1}' | tr -d '\r\n ')
ANON_KEY=$(echo "$CREDS"     | awk -F'\\|\\|\\|' '{print $2}' | tr -d '\r\n ')
PAT=$(echo "$CREDS"          | awk -F'\\|\\|\\|' '{print $3}' | tr -d '\r\n ')

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  log_err "Não foi possível extrair as credenciais do token."
  exit 1
fi

# Valida que a anon key parece um JWT válido (começa com eyJ)
if [[ "$ANON_KEY" != eyJ* ]]; then
  log_err "Anon key inválida no token (não parece um JWT). Gere um novo token no Wizard."
  exit 1
fi

# Extrai o project ref da URL (https://REF.supabase.co → REF)
PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | cut -d'.' -f1)

log_ok "Token válido!"

# ── Clonar repositório ────────────────────────────────────────────
DEST="hubfy"

if [ -d "$DEST" ]; then
  log_warn "Pasta '${DEST}' já existe."
  echo -e "  ${YELLOW}  Deseja sobrescrever? (s/N)${RESET} \c"
  read -r CONFIRM
  if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
    echo ""
    echo "  Operação cancelada."
    exit 0
  fi
  rm -rf "$DEST"
fi

log_step "Clonando repositório..."
git clone --quiet \
  "https://github.com/hubfy-lite/hubfy-lite.git" \
  "$DEST"
log_ok "Repositório clonado!"

# ── Criar .env.local ──────────────────────────────────────────────
log_step "Criando arquivo de configuração..."

cat > "${DEST}/.env.local" <<EOF
# Gerado automaticamente por lp.hubfy.io/setup
# $(date -u +"%Y-%m-%dT%H:%M:%SZ")
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_PUBLIC_SITE_URL=http://localhost:8784
SUPABASE_PROJECT_ID=${PROJECT_REF}
EOF

log_ok ".env.local criado!"

# ── Instalar dependências ─────────────────────────────────────────
log_step "Instalando dependências (pode levar 1-2 min)..."
cd "$DEST"
npm install --silent
log_ok "Dependências instaladas!"

# ── Deploy das Edge Functions ─────────────────────────────────────
if [ -n "$PAT" ] && [ -n "$PROJECT_REF" ]; then
  log_step "Deployando edge functions (pode levar 1-2 min)..."

  # Preenche o project_id no config.toml (obrigatório pela CLI do Supabase)
  sed -i.bak "s/^project_id = \"\"/project_id = \"${PROJECT_REF}\"/" supabase/config.toml
  rm -f supabase/config.toml.bak

  SUPABASE_ACCESS_TOKEN="$PAT" \
    npx --yes supabase@latest functions deploy --project-ref "$PROJECT_REF"
  log_ok "Edge functions deployadas!"
else
  log_warn "PAT não encontrado no token — edge functions não foram deployadas."
  echo ""
  echo "  Execute manualmente:"
  echo "  npx supabase functions deploy --project-ref ${PROJECT_REF}"
fi

# ── Concluído! ────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}${GREEN}🎉 Pronto!${RESET}"
echo ""
echo -e "  ${BOLD}Próximo passo:${RESET}"
echo ""
echo -e "  ${CYAN}cd hubfy && npm run dev${RESET}"
echo ""
echo -e "  Acesse em: ${CYAN}http://localhost:8784${RESET}"
echo ""
