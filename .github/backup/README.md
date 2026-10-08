# Backup de AuxilioLegal

Todas las noches (02:37, hora de Mendoza) el workflow `Backup nocturno a Drive` guarda en Google Drive, carpeta **AuxilioLegal-Backups**:

| Carpeta | Contenido | Retención |
| --- | --- | --- |
| `base/diario/AAAA-MM-DD.tar.gz.age` | Volcado completo de la base (roles, esquema, datos) | 30 días |
| `base/mensual/AAAA-MM.tar.gz.age` | Copia del día 1 de cada mes | 12 meses |
| `archivos/<bucket>/<ruta>.age` | Cada foto o documento, cifrado por separado | Sin borrado (si se elimina en Supabase, el respaldo queda) |

Todo se cifra con **age**. GitHub solo tiene la clave **pública**: con ella se cifra, pero no se puede descifrar. La clave **privada** la guarda el responsable fuera de línea (gestor de contraseñas y copia impresa). **Si se pierde la clave privada, los backups no se pueden recuperar.**

## Configuración (una sola vez)

En GitHub → Settings → Secrets and variables → Actions:

| Tipo | Nombre | De dónde sale |
| --- | --- | --- |
| Variable | `AGE_RECIPIENT` | Clave pública `age1…` (ver abajo) |
| Secret | `SUPABASE_DB_URL` | Supabase → Connect → **Session pooler**, con la contraseña de la base |
| Secret | `SUPABASE_S3_KEY_ID` | Supabase → Storage → Settings → S3 Access Keys → New access key |
| Secret | `SUPABASE_S3_SECRET` | La clave secreta de ese mismo acceso |
| Secret | `RCLONE_DRIVE_TOKEN` | Salida de `rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlLmZpbGUifQ"` (el JSON entre llaves) |
| Secret (opcional) | `NTFY_TOPIC` | Tópico de ntfy para recibir el aviso si el backup falla |

Generar el par de claves (en la computadora propia, no en un servidor):

```bash
age-keygen -o auxiliolegal-backup.key
# Muestra "Public key: age1..."  → eso va en AGE_RECIPIENT
# El archivo auxiliolegal-backup.key es la clave PRIVADA: guardarlo en el gestor de contraseñas e imprimirlo.
```

## Restaurar

1. Descargar de Drive la carpeta o los archivos necesarios.
2. Descifrar la base:

```bash
age -d -i auxiliolegal-backup.key base/diario/2026-10-09.tar.gz.age | tar -xz
cd db && sha256sum -c SHA256SUMS
```

3. Cargar en un proyecto **nuevo** de Supabase (nunca sobre producción sin antes probar):

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "<cadena de conexión del proyecto nuevo>"
```

4. Descifrar los archivos y subirlos al bucket del proyecto nuevo, manteniendo la misma ruta:

```bash
find archivos -name '*.age' | while read -r f; do
  age -d -i auxiliolegal-backup.key "$f" > "${f%.age}"
done
# luego: rclone copy archivos/siniestros <remoto-s3-nuevo>:siniestros
```

## Simulacro trimestral

Cada tres meses: restaurar el último backup en un proyecto de prueba, abrir el panel apuntando a ese proyecto y verificar que un caso muestre sus fotos. Anotar la fecha del simulacro.
