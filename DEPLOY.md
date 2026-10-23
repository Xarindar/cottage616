# Cottage 616 deployment

The live site is `https://www.cottage616.com`, built from `Xarindar/cottage616`
`main` on Railway. Push this checkout to the `xarindar` remote; `origin` belongs
to the stopped former installation.

Railway project: `e72b421f-abca-48d4-aa39-c805456d9d13`, production environment:
`536cb800-6976-4af2-b85a-2c11ea508636`, website service:
`8b990358-9340-48ea-a240-a6b805bd4f1e`. Railpack serves the committed HTML with
Caddy. Run `python scripts/tools/build-site.py` and commit its generated
`Caddyfile` whenever templates or `deploy/asset-redirects.json` change. It keeps
retired media URLs working with 308 redirects and preserves query strings.

Verify Railway reports a successful deployment of the expected main commit,
then check the public pages and a moved asset URL. Rebuilding requires no local
environment files, private assets, or development database.

## Legacy subpath hosting

The former host served this repo at `https://xarindar.com/cottage616`.

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
- `deploy/asset-redirects.json`
  Previous asset, stylesheet, and script URLs mapped to the reorganized files. The server sends direct 308 redirects and preserves query strings.
- `deploy/apply-root-changes.sh`
  Helper script that creates `cottage616-server.service`, updates the tunnel config, validates it, and restarts the relevant services.

## Apply the routing changes

```bash
cd /home/abe/Cottage616
bash deploy/apply-root-changes.sh
```

That script escalates with `sudo`, creates the systemd service, backs up the live Cloudflare Tunnel config, inserts the `/cottage616` rule if it is missing, validates the tunnel config, and restarts `cloudflared`.

After deploying the asset reorganization, restart `cottage616-server.service` so the running server loads the redirect map. Deploy the map and renamed files together. Other static hosts must import the same redirects into their own routing configuration to preserve old public URLs.

## Verification

```bash
curl -si http://127.0.0.1:8083/cottage616/
curl -si http://127.0.0.1:8083/cottage616/the-hive.html
curl -si http://127.0.0.1:8083/cottage616/vendors.html
curl -si http://127.0.0.1:8083/cottage616/booking.html
curl -si https://xarindar.com/cottage616/
curl -si https://xarindar.com/cottage616/the-hive.html
curl -si https://xarindar.com/cottage616/vendors.html
curl -si https://xarindar.com/cottage616/booking.html
```
