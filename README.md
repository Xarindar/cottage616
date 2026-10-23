# Cottage 616

Static pages for Cottage 616, The Hive, vendors, and booking.

```text
index.html                  Cottage 616 homepage
the-hive.html               The Hive
vendors.html                Vendor directory
booking.html                Booking flow
assets/                     Business-first image and asset library
scripts/
├── site.js                 Shared navigation and interactions
├── booking/                app.js, assets.js, and config.js
├── integrations/showrunner/ Business information and hero content
└── tools/                  Asset library and verification tools
styles/
├── tokens.css              Shared website design values
├── site.css                Shared site styles
├── components/             Shared buttons
├── pages/                  Hive, vendors, and booking styles
├── themes/                 Booking theme tokens
└── tools/                  Asset library styles
deploy/                     Static server, routing, and asset redirects
templates/                  Shared header and footer source
```

- [Asset folders and naming](assets/README.md)
- [Visual asset index](assets/index.html)
- [Shared button rules](BUTTONS.md)
- [Design system and shared markup](DESIGN.md)
- [Deployment](DEPLOY.md)

## Local preview

```shell
python deploy/cottage616-server.py
```

The default address is `http://127.0.0.1:8083/cottage616/`. Set the `PORT` environment variable to use another port. The asset index is at `/cottage616/assets/index.html`.

## Build and check shared markup and assets

```shell
python scripts/tools/build-site.py
python scripts/tools/build-asset-index.py
python scripts/tools/check-assets.py
python scripts/tools/build-site.py --check
python -m unittest discover -s test -p "*_test.py"
node --test test/*.test.mjs
```

Edit shared headers and footers in `templates/`, then regenerate and commit the
public HTML. The `--check` command fails if those generated regions drift.
Rebuild and commit the asset catalog after adding or moving media.
The site generator also updates Railway's Caddy configuration from the asset
redirect map; commit `Caddyfile` with any redirect changes.

Page URLs remain at the repository root. Stylesheet URLs resolve relative to the stylesheet's folder; asset strings used by browser scripts resolve relative to the HTML page.
