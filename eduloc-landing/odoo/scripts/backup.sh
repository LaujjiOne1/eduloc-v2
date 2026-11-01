#!/usr/bin/env bash
# Sauvegarde Odoo : dump PostgreSQL + filestore (pièces jointes) dans ./backups/<horodatage>/.
# Usage : ./scripts/backup.sh [base]   (défaut : eduloc)
# À planifier (cron, 1×/jour minimum) puis à copier vers un stockage externe au VPS.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${1:-eduloc}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="backups/${STAMP}"
mkdir -p "$DEST"

docker compose exec -T db pg_dump -U odoo -Fc "$DB" > "${DEST}/${DB}.dump"
# Le filestore vit dans le volume odoo-data : /var/lib/odoo/filestore/<base>
docker compose exec -T odoo tar -C /var/lib/odoo -czf - "filestore/${DB}" > "${DEST}/${DB}-filestore.tar.gz" 2>/dev/null || {
  echo "Aucun filestore pour ${DB} (normal si aucune pièce jointe n'a encore été enregistrée)." >&2
  rm -f "${DEST}/${DB}-filestore.tar.gz"
}

# Un dump vide serait une fausse sécurité : on échoue bruyamment.
[ -s "${DEST}/${DB}.dump" ] || { echo "Dump vide : sauvegarde invalide." >&2; exit 1; }

find backups -mindepth 1 -maxdepth 1 -type d -mtime "+${KEEP_DAYS}" -exec rm -rf {} +
echo "Sauvegarde écrite dans ${DEST}"
