"""Small read-only availability check, scheduled every third UTC day."""

import base64
import json
import os
import sys
from datetime import date, datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ANCHOR = date(2026, 11, 27)


def should_query(event, today):
    days = (today - ANCHOR).days
    return event != "schedule" or (days >= 0 and days % 3 == 0)


def make_request(base_url, public_key):
    parts = urlsplit(base_url)
    if parts.scheme != "https" or not parts.hostname or parts.path not in ("", "/") or parts.query or parts.fragment or parts.username:
        raise ValueError("VITE_SUPABASE_URL debe ser la URL HTTPS del proyecto.")
    headers = {"apikey": public_key, "Accept": "application/json", "Cache-Control": "no-cache"}
    if not public_key.startswith("sb_publishable_"):
        try:
            payload = public_key.split(".")[1]
            claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        except (ValueError, IndexError, UnicodeDecodeError):
            raise ValueError("Configura una clave publica publishable o anon valida.") from None
        if not isinstance(claims, dict) or claims.get("role") != "anon":
            raise ValueError("Esta tarea solo admite claves publicas; no uses service_role.")
        headers["Authorization"] = f"Bearer {public_key}"
    return Request(base_url.rstrip("/") + "/rest/v1/wheels?select=id&limit=1", headers=headers, method="GET")


def main():
    if not should_query(os.environ.get("EVENT_NAME", "manual"), datetime.now(timezone.utc).date()):
        print("Hoy no corresponde consulta: intervalo de tres dias. No se contacta Supabase.")
        return 0
    try:
        request = make_request(os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_PUBLIC_KEY", ""))
        with urlopen(request, timeout=30) as response:
            rows = json.loads(response.read(4096))
            if not isinstance(rows, list) or len(rows) > 1 or any(not isinstance(row, dict) or "id" not in row for row in rows):
                raise ValueError("Respuesta inesperada de la consulta de lectura.")
        print("Supabase respondio correctamente a la consulta de solo lectura. No se modificaron datos.")
        return 0
    except HTTPError as error:
        print(f"Consulta fallida: HTTP {error.code}. Revisa la disponibilidad y los permisos del proyecto.", file=sys.stderr)
    except URLError:
        print("No se pudo conectar con Supabase dentro del tiempo previsto.", file=sys.stderr)
    except (ValueError, TimeoutError):
        print("Comprueba la URL, la clave publica y la respuesta del proyecto. No uses claves privadas.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
