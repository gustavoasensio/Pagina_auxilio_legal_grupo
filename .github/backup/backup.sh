#!/usr/bin/env bash
# Backup nocturno de AuxilioLegal: base de datos + archivos de Storage, cifrados con age, a Google Drive.
#
# Solo se usa la CLAVE PÚBLICA de age: quien tenga acceso a GitHub o a Drive ve archivos ilegibles.
# La clave privada (para restaurar) la guarda GUS fuera de línea.
#
# Variables de entorno:
#   AGE_RECIPIENT   clave pública age (age1...)                         [obligatoria]
#   SUPABASE_DB_URL cadena de conexión "Session pooler" de Supabase     [obligatoria salvo SKIP_DB=1]
#   SRC_REMOTE      remoto rclone de Storage (por defecto "sb:")        [S3 de Supabase]
#   DEST            destino rclone (por defecto "gd:AuxilioLegal-Backups")
#   SKIP_DB=1       omite la base (solo para pruebas)
#   DIAS_DIARIOS    retención de copias diarias (por defecto 30)
#   DIAS_MENSUALES  retención de copias mensuales (por defecto 370)
set -Eeuo pipefail

: "${AGE_RECIPIENT:?Falta AGE_RECIPIENT (clave pública age)}"
SRC_REMOTE="${SRC_REMOTE:-sb:}"
DEST="${DEST:-gd:AuxilioLegal-Backups}"
DIAS_DIARIOS="${DIAS_DIARIOS:-30}"
DIAS_MENSUALES="${DIAS_MENSUALES:-370}"
FECHA="$(TZ=America/Argentina/Mendoza date +%F)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log(){ printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

# ---------- 1. Base de datos ----------
if [[ "${SKIP_DB:-0}" != "1" ]]; then
  : "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL}"
  log "Volcando la base (roles, esquema y datos)"
  mkdir -p "$TMP/db"
  supabase db dump --db-url "$SUPABASE_DB_URL" -f "$TMP/db/roles.sql" --role-only
  supabase db dump --db-url "$SUPABASE_DB_URL" -f "$TMP/db/schema.sql"
  supabase db dump --db-url "$SUPABASE_DB_URL" -f "$TMP/db/data.sql" --use-copy --data-only \
    -x "storage.buckets_vectors" -x "storage.vector_indexes"

  # Controles mínimos: que el volcado no esté vacío y contenga las tablas clave.
  for t in siniestros_web seguimientos pas_links; do
    grep -q "public.\"\?$t\"\?" "$TMP/db/schema.sql" || { log "ERROR: el esquema no contiene $t"; exit 1; }
  done
  [[ -s "$TMP/db/data.sql" ]] || { log "ERROR: data.sql vacío"; exit 1; }

  ( cd "$TMP/db" && sha256sum roles.sql schema.sql data.sql > SHA256SUMS )
  tar -C "$TMP" -czf - db | age -r "$AGE_RECIPIENT" > "$TMP/base.tar.gz.age"
  rclone copyto "$TMP/base.tar.gz.age" "$DEST/base/diario/$FECHA.tar.gz.age"
  log "Base subida: base/diario/$FECHA.tar.gz.age ($(du -h "$TMP/base.tar.gz.age" | cut -f1))"

  if [[ "$(TZ=America/Argentina/Mendoza date +%d)" == "01" ]]; then
    rclone copyto "$TMP/base.tar.gz.age" "$DEST/base/mensual/${FECHA:0:7}.tar.gz.age"
    log "Copia mensual guardada"
  fi

  limpiar(){ rclone lsf "$1" >/dev/null 2>&1 && rclone delete --min-age "$2" "$1"; return 0; }
  limpiar "$DEST/base/diario" "${DIAS_DIARIOS}d"
  limpiar "$DEST/base/mensual" "${DIAS_MENSUALES}d"
fi

# ---------- 2. Archivos (fotos y documentos) ----------
# Copia incremental: solo sube lo que todavía no está en Drive. Nunca borra en Drive,
# así un archivo eliminado por error en Supabase sigue respaldado.
log "Buscando archivos nuevos en Storage"
nuevos=0
# Si falla el listado de Storage, el backup tiene que fallar (no "respaldar nada" en silencio).
rclone lsf --dirs-only "$SRC_REMOTE" > "$TMP/buckets.txt"
[[ -s "$TMP/buckets.txt" ]] || { log "ERROR: no se encontraron buckets en Storage"; exit 1; }
while IFS= read -r bucket; do
  bucket="${bucket%/}"
  [[ -z "$bucket" ]] && continue
  rclone lsf -R --files-only "$SRC_REMOTE$bucket" | LC_ALL=C sort > "$TMP/origen.txt"
  if rclone lsf "$DEST/archivos/$bucket" >/dev/null 2>&1; then
    rclone lsf -R --files-only "$DEST/archivos/$bucket" | sed 's/\.age$//' | LC_ALL=C sort > "$TMP/respaldados.txt"
  else
    : > "$TMP/respaldados.txt"   # primera corrida para este bucket
  fi
  LC_ALL=C comm -23 "$TMP/origen.txt" "$TMP/respaldados.txt" > "$TMP/pendientes.txt"
  while IFS= read -r p; do
    [[ -z "$p" ]] && continue
    rclone cat "$SRC_REMOTE$bucket/$p" | age -r "$AGE_RECIPIENT" | rclone rcat "$DEST/archivos/$bucket/$p.age"
    nuevos=$((nuevos+1))
  done < "$TMP/pendientes.txt"
  log "Bucket $bucket: $(wc -l < "$TMP/origen.txt") archivos en origen, $(wc -l < "$TMP/pendientes.txt") nuevos respaldados"
done < "$TMP/buckets.txt"

log "Listo. Archivos nuevos respaldados: $nuevos"
