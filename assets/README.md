# Asset library

Start with the business, then the asset type. [Open the visual index](index.html) to browse previews, search current or previous filenames, and copy paths. The index is a repository tool; it is not linked from the customer site.

```text
assets/
├── cottage-616/
│   ├── branding/             Cottage mark and wordmark
│   ├── icons/
│   │   ├── events/           Birthday, wedding, shower, and graduation icons
│   │   └── highlights/       Heart, stars, and party popper
│   ├── illustrations/highlights/
│   ├── photos/
│   │   ├── events/           cards/, feature/, and gallery/
│   │   └── venue/            Entrance, lawn, and neon sign
│   └── sources/              Original venue and event images
├── hive/
│   ├── branding/             Logo and honeycomb symbols
│   ├── icons/
│   │   ├── benefits/
│   │   └── services/
│   ├── illustrations/        Bee, honey pot, and honeycomb artwork
│   ├── photos/
│   │   ├── products/
│   │   ├── team/
│   │   └── treatments/
│   └── textures/             Cork and honeycomb patterns
├── vendors/
│   ├── illustrations/
│   ├── logos/
│   └── photos/
└── shared/
    ├── fonts/
    ├── icons/shapes/
    ├── illustrations/pushpins/
    └── textures/             Paper and linen
```

## Naming and placement

- Use lowercase, hyphenated names that describe the subject: `scalp-rinse.jpg`, `entrance-bench.jpg`, or `photo-booth-guests.jpg`.
- Put the business first: `hive/icons/`, never `icons/hive/`.
- Name resized web versions with their actual width, such as `head-spa-1280w.webp` or `birthday-480w.webp`.
- Keep original large exports in that business's `sources/` folder. Use the optimized photo versions on the website.
- Keep alternate and currently unused artwork available. “Library asset” in the visual index means no static site reference was found; content managed outside this repository may still use it.
- Use `shared/` only for reusable assets without a single business owner.

## Maintenance

From the repository root:

```shell
python scripts/tools/build-asset-index.py
python scripts/tools/check-assets.py
```

The first command rebuilds [the visual index](index.html) and [catalog.json](catalog.json). The second checks local references, case-sensitive filenames, and redirects.

[deploy/asset-redirects.json](../deploy/asset-redirects.json) maps previous public asset, stylesheet, and script URLs directly to their current paths. When renaming a file, update references and add its old path to this map. Update existing aliases to point directly to the new destination rather than creating redirect chains.

Two identical file pairs were consolidated: the duplicate Hive logo PNG and the shared hexagon SVG. All distinct original asset content remains available.
