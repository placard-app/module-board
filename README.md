# Board (`places.board`)

Turn 22 saved places into a travel-themed board. Create multiple private designs,
replace or reorder places, customize printed labels, and explore the board in 3D.
This release is a board designer, not a playable game or complete game kit.

## Install

Requires Placard SDK 1 with `persistent-data`, Node.js 24+, and an authenticated
account. Build with `pnpm --filter @placard-official/places.board build` from the
plugins workspace, then upload `dist/places.board-0.1.0.placard-module` (or its ZIP)
in **Settings → Module marketplace**. Enable the module and show it in navigation.
Open **Board** from navigation or **Open Board Designer** from the command palette.
No release has to be published to install the local artifact.

## Design and print

Choose a library selection using text, category, list, or tag filters. At least 22
unique accessible places are needed. Auto-fill chooses 22 without repeats; Shuffle
order rearranges those places. Replace searches the whole accessible library.
Move buttons work with keyboards and touch. Shorten labels flagged as too long.

Save explicitly before leaving. Flat preview and both exports share the same SVG
layout; 3D loads on demand and falls back to flat if WebGL is unavailable. Font,
icons, PDF code and Three.js are bundled; no external asset service is needed.

- **Print shop:** vector PDF with a single 500 × 500 mm page; ask for actual size.
- **Home:** six portrait A4 sheets, three columns by two rows. Print single-sided
  at **100% / Actual size**, with scaling disabled. The ruler must measure 50 mm.
  Each page has 10 mm margins and overlapping artwork. Column origins are 0,
  165 and 330 mm; row origins are 0 and 250 mm. Align matching crosshairs at these
  origins. Trim the left/top margins of the next sheet, overlap it onto the prior
  sheet, and join on the back. Keep the outside board edges; trim excess white
  paper after assembly. The finished artwork is 500 mm square.

## Storage and API

Private snapshots live in `ctx.dataDir/boards.sqlite`, outside replaceable module
code. Back up the module data directory. Updates, disabling and reinstalling retain
saved boards; removing a board explicitly deletes only that user's snapshot.
Renaming/deleting library places does not change snapshots. Adding/replacing a
place validates current access. Duplicating an owned board retains its snapshots.

All endpoints below are relative to `/api/m/places.board` and require the host
session; ownership is never accepted from the request body:

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/search` | Host search filters; returns accessible place records |
| GET | `/lists` | Accessible list names and IDs |
| GET / POST | `/boards` | List private boards / create a design |
| GET / PUT / DELETE | `/boards/:id` | Read, replace or delete an owned board |

Designs contain `templateVersion: 1`, `title`, and 22 ordered `properties` with
`placeId`, captured `name`/`category`, and printed `label`. Responses add `id`,
`revision`, and `updatedAt`. PUT requires the last-read revision; stale saves return
409 and leave storage intact. POST optionally accepts `duplicateOf` for copying an
owned snapshot. Source names/categories are derived on the server, not trusted
from clients. No core tables or MCP tools are added.

## Validation

```
pnpm --filter @placard-official/places.board typecheck
pnpm --filter @placard-official/places.board test
pnpm --filter @placard-official/places.board build
pnpm --filter @placard-official/places.board test:e2e
```

Browser tests require Docker, Chromium installed through Playwright, and the sibling
Placard checkout with its web app built. Override its path with `PLACARD_CORE_DIR`.
Tests use a temporary PostGIS container and isolated module/media directories,
upload the real package, and save screenshots and both PDFs under `test-results`.
Check rendered PDFs for clipping, typography, tile overlap and scale.

DejaVu Sans is bundled under its accompanying font license. Application source is
AGPL-3.0-only. V1 uses English labels, one theme, and no public board sharing.
