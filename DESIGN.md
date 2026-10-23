# Cottage 616 website design

Preserve the existing Cottage and Hive identity: navy text, warm paper surfaces,
Libre Baskerville display type, Raleway body type, and the shared button system.
The Hive's gold accents are a page theme, not a second base palette.

## Sources of truth

- `styles/tokens.css` owns shared colors, fonts, spacing steps, page gutters,
  content width, radii, focus, icon sizes and control motion. Repeated values use
  these tokens; image proportions and unique responsive compositions stay local.
- `styles/components/header.css` owns header and navigation layout on all four
  pages, including the common 760px mobile breakpoint.
- `styles/components/buttons.css` owns action variants and states. Page classes
  position actions without replacing their appearance.
- `styles/themes/booking.css` maps booking roles to the shared website tokens.
- `templates/header.html` and `templates/footer.html` own shared markup.
  `scripts/tools/build-site.py` generates the marked regions in the public HTML.
  Navigation variants live in that script. Commit regenerated pages with changes
  to the templates; the public site has no template runtime or JavaScript dependency.
- `templates/Caddyfile` and the same generator produce Railway's `Caddyfile` from
  `deploy/asset-redirects.json`, preserving old media URLs after moves.
- `assets/shared/icons/` holds reusable contact icons. Use CSS masks and
  `currentColor` so they inherit their control's color.

Headings are HTML text, including the Hive menu title. Its photo binding remains
available as a decorative background; the historical banner with embedded text
is adapted to the existing paper texture without changing stored client content.
Keep Showrunner selectors, booking attributes, accessibility labels and static
contact fallbacks when changing shared markup.

Run the generation and verification commands in README.md before committing.
`test/design_system_test.py` checks generated markup, shared color ownership,
static vendor contacts and lazy video asset validation.
