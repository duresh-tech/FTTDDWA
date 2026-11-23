# Member ID cards

A business designs its own membership card in a drag-and-drop editor, and the
server renders one PDF per member from that design.

The split that makes this work: a **template holds tokens, never values.**
`member.memberNameTamil` is stored, not "ரமேஷ் குமார்". One design therefore
renders every member, and changing the design changes every card issued
afterwards without touching the ones already generated.

## Two tables

| Table | Holds |
| --- | --- |
| `tenant_id_card_templates` | the design: name, card size in mm, and a `layout` JSON |
| `tenant_member_id_cards` | one generated card per member: the stored PDF's path and size |

`@@unique([tenantMemberId])` — **one current card per member.** Regenerating
updates that row in place and deletes the superseded file, rather than
inserting a second row. Updating rather than delete-and-insert is also what
stops a soft-deleted row from blocking a reissue.

A business may keep many templates, exactly one of which is `isDefault`. That
is an **invariant, not a flag**: setting one clears the others inside the same
transaction, so two can never both claim it. The first template a business
creates becomes its default, so generation works before anyone thinks about
the flag.

## Cards are stored privately, and /uploads is not private

This is the part worth understanding before changing anything here.

`main.ts` serves `LOCAL_STORAGE_DIR` through `app.useStaticAssets()` —
**outside Nest's guard pipeline** — and the console gateway proxies `/uploads`
to it. That is exactly what lets an `<img src>` show a logo without an API key.
It also means anything in that tree is readable by anyone holding the URL.

A card carries the member's photo, phone number, address and the last four
digits of their Aadhaar. So cards go somewhere else:

- `PRIVATE_STORAGE_DIR` (default `storage/private`) is served by nothing and
  proxied by nothing.
- `StorageService` takes a `scope: 'public' | 'private'`. Local writes resolve
  against the matching directory; S3 prefixes private keys with `private/`.
- The **only** way a card leaves the server is
  `GET /tenant/member-id-cards/:id/download`, which checks
  `tenant-member-id-cards:view` first. Handing out `filePath` buys nothing.

In Docker this needs its own named volume (`fttddwa-private-storage`), because
the api container runs `read_only: true` — only mounted volumes and `/tmp` are
writable. It is created and `chown`ed in the Dockerfile before `USER node`, for
the same reason the upload tree is: Docker seeds a fresh volume from the image
path and inherits its ownership.

**Back it up with the same care as the database.** A lost card has to be
reissued.

## The field catalogue is server-owned

`backend/src/tenant-id-cards/id-card-fields.ts` declares every token, its
label, its group, whether it is text, an image or a QR code, and a `sample`.
`GET /tenant/id-card-templates/fields` serves it, and the designer renders its
palette from the response rather than a hardcoded list — the same discipline as
`listRefOptions()` owning which table a `ref` names. Adding a field is a
one-file change both sides pick up.

Three rules in the resolver:

- **For `association.*` the token IS the settingKey**, so there is no second
  mapping to keep in step. Values come from
  `getSettingsMapForBusiness()`, already the documented way application code
  reads settings.
- **An unknown token renders empty** — never the token text, never a throw. A
  template outlives the catalogue, and printing `member.oldField` on somebody's
  card would be worse than printing nothing.
- **`aadhaarLast4` is offered and the full number is not.** The register never
  returns the full number, and a printed card is not the place to start.

The card path runs its own member query. The shared `INCLUDE` in
`tenant-members.service.ts` selects only the English names from the related
lookups, and widening it would grow every member list and detail response for
the sake of this one consumer.

## Everything is in millimetres

A card is a physical object printed at a fixed size; pixels belong to whatever
screen drew it. The layout stores mm, the canvas multiplies by a px-per-mm
scale on the way out and divides on the way in, and the renderer converts to
PostScript points (`mm × 72 ÷ 25.4`). Font sizes are the one exception and are
in points, because that is what type is measured in.

Storing pixels is how a layout ends up correct on the designer's monitor and
wrong on the printer.

CR80 — 85.6 × 54 mm — is the standard ID card and the default. CR79, A7 and A6
are offered as presets, and any size from 20 to 500 mm can be typed in.
**Orientation is simply the two dimensions swapped**; there is no separate
field for it to drift out of step with them.

Resizing a card **pulls stranded elements back inside and says how many
moved**. A shrink or an orientation flip that quietly left elements off the
card would only be noticed at the printer.

The card size lives in two places — the `widthMm`/`heightMm` columns, for
listing and sorting, and `layout.card`, for the renderer — and the service
reconciles them with **the columns winning**. So a save that changes the size
must PATCH all three; sending only the layout silently keeps the old size.

Zoom is a view concern. The canvas picks a px-per-mm scale (Fit, or 50–200%)
and converts on the way in and out; nothing that is saved ever sees a pixel.

The layout is validated by a Zod schema **on write**, so a malformed design is
rejected at the API rather than discovered halfway through generating a few
hundred cards.

## Tamil needs real shaping, and one font is not enough

Tamil vowel signs reorder around their base consonant and clusters form
ligatures. A renderer that maps codepoints to glyphs in order produces
plausible-looking nonsense that no automated test catches — only a reader of
Tamil does.

`pdfkit` lays out through `fontkit`, whose Indic shaper is a port of
HarfBuzz's. Verified against the bundled font before the feature was built:
`க` + `ொ` emits `[ெ, க, ா]` — the vowel sign moved in front of its consonant —
and `ஸ்ரீ` collapses four codepoints into one glyph.

> `pdf-lib` is **not** an alternative. It uses fontkit only to embed and
> subset, so it does no shaping at all.

**Noto Sans Tamil contains no Latin letters.** A line like `Member: ரமேஷ்`
cannot be drawn with one font: the Tamil font renders the Latin half as
`.notdef` boxes, and the Latin font loses the Tamil. So the renderer splits
text into same-script runs and picks the font per run. There is deliberately no
"script" field on a text element — asking the designer to label a block Tamil
or Latin would both duplicate that decision and get mixed content wrong.

Fonts are bundled in `backend/assets/fonts` (Noto, OFL) rather than fetched at
run time, because the prod filesystem is read-only and the build must not
depend on the network. `nest build` copies only compiled TypeScript, so the
Dockerfile copies `assets/` explicitly.

## Shapes are defined once, on the server

Each shape is an **SVG path inside a unit square** (`0 0 1 1`), listed in
`backend/src/tenant-id-cards/id-card-shapes.ts` and served by
`GET …/id-card-templates/shapes`. The designer draws it with
`viewBox="0 0 1 1"` and the renderer scales the same path, so adding a shape is
a change to that one file — the console holds no copy to keep in step. This is
the same discipline as the field catalogue.

Nine today: rectangle, ellipse, triangle, diamond, pentagon, hexagon, star,
arrow, chevron. Plus a separate `line` element, which is a stroke with no fill:
it keeps the box model so dragging and resizing behave as they do everywhere
else, and `direction` says whether it runs along the horizontal midline, the
vertical one, or corner to corner.

> **The renderer scales a shape's coordinates, never the canvas.** PDF requires
> path construction to be followed directly by a painting operator, so changing
> the CTM between `path()` and `fill()` produces a stream that renderers
> silently discard — the shape simply does not appear, with nothing logged.
> `scaleUnitPath()` rewrites the numbers instead, which also keeps stroke
> widths uniform and gradient coordinates in page space.

A shape the current build does not know falls back to a rectangle rather than
failing the template, for the same reason an unknown token renders empty.

## Fills can be gradients

A fill is **either a hex string or a gradient**:

```jsonc
{ "type": "linear", "angle": 20, "stops": [
  { "offset": 0, "color": "#1e3a8a" }, { "offset": 1, "color": "#06b6d4" } ] }
```

Keeping a plain string as one arm of that union is what lets every template
written before gradients existed stay valid, with no migration and no
transform over stored JSON.

Shape fills and side backgrounds both take one. The canvas renders CSS
`linear-gradient` / `radial-gradient`; the renderer builds `doc.linearGradient`
or `doc.radialGradient` **anchored to the element's own box**, so the same fill
reads the same on a 5 mm dot and on a whole card. `angle` is measured clockwise
from left-to-right, and the gradient line runs through the box's centre, so 0°
spans its full width and 90° its full height.

## Layers

The designer lists a side's elements topmost-first, with drag-to-reorder,
forward/back, a visibility toggle and a lock.

- **`z` is derived from position in that list**, and the inspector carries no z
  field. Two ways to set the same thing is how they end up disagreeing.
- **Hidden elements are skipped by the renderer**, not just the canvas — a
  preview that disagreed with the PDF would be worse than no preview.
- **Locked elements still print**; they just cannot be dragged. That is what
  makes a full-bleed background usable, since otherwise it swallows every click
  meant for something on top of it. A locked element is still selectable, so it
  can be inspected and unlocked.

## The editor is its own page

The template **list** is at `/tenant/settings/id-card-templates`, under
Settings → Business, because it is configuration. The **editor** is at
`/tenant/id-card-templates/[id]` and is deliberately *not* nested under
settings: in the App Router a nested layout always wraps its parent, so a page
there could never escape `TenantShell` and the settings rail — and a design
canvas squeezed beside a navigation rail is the thing the full-screen editor
exists to fix.

Because it sits outside the shell, the editor provides its own
`TenantSessionProvider`; that is what the permission checks read.

## Generating

`POST /tenant/member-id-cards/members/:memberId` renders with the given
template, or the business default, stores the PDF privately and returns the
card row. The console then calls the download endpoint.

Generation is refused when `memberRegister.enabled` is off — a closed register
should not keep issuing cards.

**Bulk** (`POST /tenant/member-id-cards/bulk`) takes explicit member ids, caps
the batch at 250, and returns one multi-page PDF for the print run while also
storing each member's own card. The combined file is **not** stored: it is a
disposable artefact of one print run, unlike the per-member card. Ids are
explicit rather than a filter so the operator can see how many cards they are
about to produce.

Both refuse a batch spanning several businesses: a card is rendered from one
business's template and settings, and mixing them would quietly print one
association's branding on another's members.

## What fails softly, and what does not

Rendering is forgiving by design, because a bulk run must not die on one bad
row:

- a **missing or unreadable image** (no passport photo, a WebP logo that pdfkit
  cannot read) is skipped with a warning
- an **unknown token** renders empty
- one **bad element** is skipped, not fatal to the card

What is not forgiving: a malformed `layout` is rejected on write, and a
template whose stored JSON cannot be parsed refuses to generate rather than
producing a blank card.

## Permissions

| Module | Actions |
| --- | --- |
| `tenant-id-card-templates` | `create view update delete list restore` |
| `tenant-member-id-cards` | `generate view list delete` |

`generate` is its own action for the reason `tenant-members:change_status` is:
issuing somebody's card is a different act from editing a layout, and you would
plausibly grant one and not the other. `view` is what downloads a PDF.

`TENANT_ADMIN` holds nine of the ten — `restore` is system-admin only, as for
every other resource.

Deleting a card removes the **file** as well as soft-deleting the row. That is
unlike most soft deletes here, and deliberate: the row is the only index into
private storage, so keeping the file would leave member data on disk that
nothing references and nobody can reach.
