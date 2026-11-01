#!/usr/bin/env bash
# Restaure une sauvegarde dans une base NOUVELLE (refuse d'écraser une base existante).
# Usage : ./scripts/restore.sh backups/<horodatage> <base_source> <nouvelle_base>
# Exemple de bascule après sinistre : restaurer sous le nom de production sur une instance vide,
# ou restaurer sous un autre nom pour contrôler la sauvegarde avant de l'utiliser.
set -euo pipefail
cd "$(dirname "$0")/.."

[ $# -eq 3 ] || { echo "Usage : $0 <dossier_sauvegarde> <base_source> <nouvelle_base>" >&2; exit 2; }
SRC_DIR="$1"; SRC_DB="$2"; NEW_DB="$3"

exists="$(docker compose exec -T db psql -U odoo -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${NEW_DB}'")"
[ -z "$exists" ] || { echo "La base ${NEW_DB} existe déjà : choisir un autre nom (pas d'écrasement)." >&2; exit 1; }

docker compose exec -T db createdb -U odoo "$NEW_DB"
docker compose exec -T db pg_restore -U odoo -d "$NEW_DB" --no-owner < "${SRC_DIR}/${SRC_DB}.dump"

if [ -f "${SRC_DIR}/${SRC_DB}-filestore.tar.gz" ]; then
  # L'archive contient filestore/<base_source> : on la renomme vers la nouvelle base.
  docker compose exec -T odoo sh -c "mkdir -p /var/lib/odoo/filestore && tar -C /var/lib/odoo -xzf - && \
    { [ '${SRC_DB}' = '${NEW_DB}' ] || mv /var/lib/odoo/filestore/${SRC_DB} /var/lib/odoo/filestore/${NEW_DB}; }" \
    < "${SRC_DIR}/${SRC_DB}-filestore.tar.gz"
fi
echo "Base ${NEW_DB} restaurée depuis ${SRC_DIR}."
