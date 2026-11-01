#!/usr/bin/env bash
# Sauvegarde logique de la base avant une migration de production. Dossier : ./backups (hors dépôt).
set -euo pipefail
mkdir -p backups
out="backups/eduloc-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db pg_dump -U eduloc -Fc eduloc > "$out"
test -s "$out" || { echo "Sauvegarde vide" >&2; rm -f "$out"; exit 1; }
chmod 600 "$out"
echo "Sauvegarde : $out"
