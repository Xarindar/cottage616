# Cottage 616 deployment

This repo is intended to be served at `https://xarindar.com/cottage616`.

The live host pattern on this machine is:

1. `cloudflared`, which matches the `xarindar.com` subpath and proxies it to a local port
2. a dedicated local Python static server for that site

For Cottage 616, the routing should be:

- `https://xarindar.com/cottage616` -> redirect to `https://xarindar.com/cottage616/`
- `https://xarindar.com/cottage616/*` -> proxied by `cloudflared` to `http://127.0.0.1:8083`
- `cottage616-server.service` -> serves `/home/abe/Cottage616`

## Files in this repo

- `deploy/cloudflared-cottage616.snippet.yml`
  Cloudflare Tunnel ingress rule for the `/cottage616` path.
- `deploy/cottage616-server.py`
  Prefix-aware static file server for this repo.
- `deploy/apply-root-changes.sh`
  Helper script that creates `cottage616-server.service`, updates the tunnel config, validates it, and restarts the relevant services.

## Apply the routing changes

```bash
cd /home/abe/Cottage616
bash deploy/apply-root-changes.sh
```

That script escalates with `sudo`, creates the systemd service, backs up the live Cloudflare Tunnel config, inserts the `/cottage616` rule if it is missing, validates the tunnel config, and restarts `cloudflared`.

## Verification

```bash
curl -si http://127.0.0.1:8083/cottage616/
curl -si http://127.0.0.1:8083/cottage616/vendors.html
curl -si https://xarindar.com/cottage616/
curl -si https://xarindar.com/cottage616/vendors.html
```
