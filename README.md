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

## Booking integration

The Cottage and Hive profiles share Showrunner's catalog, package pricing,
per-unit extras, availability, intake forms and Booking Terms & Conditions.
The browser sends service and requirements revisions with the selected package,
extras, answers and acceptance. Showrunner validates and prices the booking.
Photography marketing consent stays specific to Jazzr.
The catalog's site-specific `packageFields` list controls which package
allowances appear; Cottage uses an empty list and keeps general package features.
Hourly bookings ask the customer for hours/minutes before loading time slots.
Hourly extras use the same length; Showrunner validates and prices the booking.

`scripts/booking/booking-rules.js` and `booking-terms.js` are distribution copies
of the shared Showrunner browser helpers. `app.js` follows Jazzr's upgraded flow
with Cottage profile navigation and service-image framing preserved. Keep the
helpers synchronized when updating the shared booking contract, and bump static
asset versions in `booking.html` when changing the browser integration.

Run `node --test test/*.test.mjs` for unit checks. For the fixture-based browser
flow, start the local preview, set `PLAYWRIGHT_MODULE` to an existing Playwright
`index.mjs`, then run `node test/booking-browser.mjs`. It checks desktop/mobile,
both profiles, packages, extras, required answers, terms, submission retries and
empty/error states without creating real bookings. `BOOKING_TEST_URL` can select
another website base URL.

## Coming-soon preview

`npm start` runs the server-side preview gate; use a separate `PORT` when the
Python preview is already running. Visitors see Coming soon and a corner Log in
button. Preview access uses the supplied shared preview password and lasts eight
hours. Set a private `SITE_PREVIEW_SECRET` consistently across replicas to retain
sessions. `SITE_PREVIEW_ENABLED=0` opens the public website after launch approval.
The Python preview remains useful for direct booking fixture tests.

The Node server in `deploy/` is distributed from Showrunner's
`clients/site-preview/server.mjs`. It retains legacy asset redirects and supports
media ranges, compression and private preview caching. `test/site-preview.test.mjs`
checks the gate without changing live users or settings. For booking browser
tests against the gated server, set `BOOKING_PREVIEW_PASSWORD` as well as
`BOOKING_TEST_URL`.
