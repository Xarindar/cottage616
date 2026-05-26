#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

REPO_ROOT="/home/abe/Cottage616"
CLOUDFLARED_CONFIG="/etc/cloudflared/config.yml"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [ ! -f "$REPO_ROOT/index.html" ]; then
  echo "Missing site file: $REPO_ROOT/index.html" >&2
  exit 1
fi

if [ ! -f "$REPO_ROOT/vendors.html" ]; then
  echo "Missing site file: $REPO_ROOT/vendors.html" >&2
  exit 1
fi

cat > /etc/systemd/system/cottage616-server.service <<'UNIT'
[Unit]
Description=Cottage 616 static file server
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/abe/Cottage616/deploy/cottage616-server.py
WorkingDirectory=/home/abe/Cottage616
User=abe
Restart=always
RestartSec=3
Environment=PORT=8083

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now cottage616-server

cp "$CLOUDFLARED_CONFIG" "${CLOUDFLARED_CONFIG}.bak.${TIMESTAMP}"

python3 - "$CLOUDFLARED_CONFIG" <<'PY'
from pathlib import Path
import re
import sys

cf = Path(sys.argv[1])
text = cf.read_text()

if "path: ^/cottage616(/.*)?$" in text:
    print("cloudflared cottage616 rule already present, skipping.")
    sys.exit(0)

rule = """\
  - hostname: xarindar.com
    path: ^/cottage616(/.*)?$
    service: http://localhost:8083
"""

lines = text.splitlines()
insert_idx = next(
    (i for i, l in enumerate(lines) if re.match(r"\s*-\s+service:\s+http_status:404\s*$", l)),
    len(lines),
)
lines[insert_idx:insert_idx] = rule.rstrip("\n").splitlines()
cf.write_text("\n".join(lines) + ("\n" if text.endswith("\n") else ""))
print("cloudflared cottage616 rule inserted.")
PY

CLOUDFLARED_BIN="$(command -v cloudflared || echo /usr/local/bin/cloudflared)"
"$CLOUDFLARED_BIN" --config "$CLOUDFLARED_CONFIG" tunnel ingress validate
systemctl restart cloudflared

echo ""
echo "Done. Test with:"
echo "  curl -si http://127.0.0.1:8083/cottage616/"
echo "  curl -si http://127.0.0.1:8083/cottage616/vendors.html"
echo "  curl -si https://xarindar.com/cottage616/"
