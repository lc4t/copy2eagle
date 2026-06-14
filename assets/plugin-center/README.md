# Plugin Center Assets

## Final Files

- `cover-1280x800.png` — Plugin Center cover
- `screenshot-01-overview.png` — main panel and core workflow
- `screenshot-02-eagle-result.png` — imported images shown in Eagle
- `screenshot-03-settings.png` — naming, deduplication, and routing settings

All final images are 1280×800 PNG files.

## Privacy Review

- Removed the Eagle sidebar containing personal folder names.
- Removed the Eagle details panel containing hostname tags and device annotation.
- Cropped the settings screenshot below the hostname tag field.
- Kept `COPY2SYNC` as an approved demonstration folder name.
- Raw screenshots containing unrelated private content are not stored in the repository.

## Generation

Run `swift build/store-assets.swift <background> <overview> <eagle> <settings> <output-dir>`.

The cover background was generated with the built-in image generation tool using:

> Clean premium abstract background for a clipboard image archiving plugin; subtle image-card flow into an archive tray; light blue-gray, #1677ff blue, cyan and a small warm-yellow accent; wide 16:10 layout; no text, logo, UI, or watermark.

The product UI remains pixel-preserved from real Eagle screenshots and is composed locally by the Swift script.
