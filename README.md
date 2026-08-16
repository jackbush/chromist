# Palette Builder

A small mobile-first tool for building colour palettes. Pin up to seven
colours, edit any of them live, copy hex codes, share a palette as a link.

No backend, no accounts, no database. Everything lives in the browser.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173/palette-builder/
```

Note the `/palette-builder/` path — the app is built for a GitHub Pages project
site, so `base` is set in `vite.config.ts` and dev runs under the same path.

| Script            | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Dev server with hot reload                          |
| `npm run build`   | Type-check (`tsc -b`) then build to `dist/`         |
| `npm run preview` | Serve the built `dist/` locally                     |
| `npm run check`   | Logic assertions — colour maths, URL hash, storage  |

## Deploying

Pushing to `main` builds and publishes to GitHub Pages
(`.github/workflows/deploy.yml`). The workflow runs `npm run check` and
`npm run build` first, so a broken build never goes live.

**One-time setup:** in the repo, go to *Settings → Pages* and set **Source** to
**GitHub Actions**. Without that the workflow will fail at the deploy step.

The site lands at `https://<user>.github.io/palette-builder/`. If you ever
rename the repo, change `base` in `vite.config.ts` to match or every asset will
404.

## How it works

**Layout.** Below 768px: pinned colours on the top half, editor on the bottom,
action bar at the bottom of the screen. At 768px and above it flips to a
left/right split with the bar on top, and the pinned stripes rotate from
vertical columns to horizontal bands.

**Starting colours.** The app opens on one pin in a random colour — random hue,
with saturation and lightness held in a usable band so it never starts muddy or
near-black. After that, `+` pins the *opposite* of whatever is selected: hue
rotated half a turn with lightness mirrored around 50%, saturation kept.
Lightness is mirrored rather than the hue simply rotated because a plain
rotation does nothing at all to a grey. If that opposite is already in the
palette — which happens on the second `+` in a row, since the opposite of an
opposite is the original — it falls back to a fresh random colour instead.

**Pinned pane.** Seven colours maximum. The `+` column is fixed at one seventh
of the pane and the colours split what's left equally — one colour takes six
sevenths, two take three sevenths each, and so on. That means the add column
never moves, and going from six colours to seven doesn't resize anything: at
six, every column is already a seventh wide. It has no hex cell of its own, so
it runs the full height of the pane with the `+` centred on that. `+` pins a
stripe straight away and points the editor at it — there is no confirm step.
A bar of hex codes runs along the pane edge in the app's background and text
colours; click one to copy it to the clipboard, silently. Click a stripe to
edit it, drag to reorder, and use the `×` on the selected stripe to remove it.

**Editor.** A saturation/lightness square with a hue bar, filling the pane. The
only other thing in there is the hex code, centred above it — and that field is
editable, so you can type or paste a colour in. Changes write back to the
selected stripe live.

**Undo/redo.** The arrows in the action bar step through changes to the palette
— adds, deletes, reorders and colour edits — with `cmd`/`ctrl` + `Z` and
`shift` + `cmd`/`ctrl` + `Z` as shortcuts. A continuous run of changes (a drag
in the picker, a drag to reorder) collapses into one step rather than one per
pointer event. Theme changes are settings, not palette edits, so they aren't
undoable.

**Action bar.** "Share this palette" on the left copies the shareable URL;
undo, redo, settings and reset sit on the right. Anything copyable — the share
label and each hex code — shows a clipboard icon on hover. Reset wipes the
palette, the settings and the stored copy of both — it's destructive and not
undoable, so it asks for confirmation first.

**Settings** (sliders icon in the action bar): *Theme* — Black (the default),
Neutral (`#4d4d4d`), White. Black gets white text, the other two get black.

## Sharing and storage

Palettes are encoded in the URL fragment:

```
https://<user>.github.io/palette-builder/#p=ff5733,2e86ab,f6f5ae
```

The fragment never reaches a server, so a link is entirely self-contained.
Opening one loads that palette. Your working palette and settings also persist
to `localStorage`; a palette in the URL takes precedence on load.

## Notes for anyone changing this

**Colours are stored as HSL at full precision, deliberately unrounded.**
Integer HSL has roughly 3.7M states against hex's 16.7M, so rounding on import
makes colours drift — `#2e86ab` comes back as `#2e87ad` after a round trip.
Round at the point of display instead (see `src/color.ts`, and the round-trip
assertions in `checks/logic.ts`).

**Writes to `localStorage` and the URL are debounced.** Dragging a slider fires
a change per pointer event, and Safari rate-limits `history.replaceState` at
roughly 100 calls per 30 seconds before throwing. See
`src/hooks/usePersistentState.ts`.

**culori leaves hue undefined for greys**, which includes two of the three
themes, so any read of `.h` needs a fallback.

**`oppositeHsl` is its own inverse.** Applying it twice returns the original,
which is why `+` runs its result through `distinctFrom` — otherwise repeated
presses would just alternate between two colours.

**The hover clipboard on hex cells is positioned, not laid out.** The code must
sit dead centre of its cell, so the icon is absolutely positioned just past the
code's right edge — `50% + 3.5ch`, exact because the code is always seven
characters of a monospace face. Making it a flex sibling instead pushes the
code off centre whether or not it's visible.

It is also behind a container query, because at seven colours on a phone the
cell can't hold both. Note the query measures the cell's *content box*, not its
border box — the threshold is deliberately below the width you'd read off
devtools.

**Icons are drawn to match the type** (`src/components/icons.tsx`): a 24-unit
grid, uniform 2-unit strokes, square caps, miter joins, right angles and 45s
only. Adding a rounded or tapered icon will look wrong next to the rest.

**History coalescing is tag-based.** `useHistory.commit` takes an optional tag;
successive commits sharing a tag inside 400ms overwrite the present instead of
deepening the past. Colour edits tag per pin (`edit:<id>`) and reorders tag per
dragged pin, which is what keeps one drag to one undo step. Anything committed
without a tag is always its own step.

## Stack

Vite, React, TypeScript, plain CSS. [react-colorful](https://github.com/omgovich/react-colorful)
for the picker, [culori](https://culorijs.org/) for colour conversion —
culori also speaks OKLCH, which is the sane basis for tint ramps or harmony
suggestions if those ever get built.

## Layout of the source

```
src/
  App.tsx                    state, and the wiring between the two panes
  color.ts                   hex <-> hsl conversion
  storage.ts                 localStorage, with validation of anything read back
  urlHash.ts                 share-link encoding and decoding
  clipboard.ts               copy, with a fallback for non-secure origins
  components/                PinnedPane, Editor, ActionBar, SettingsPopover, icons
  hooks/                     useHistory, usePersistentState, useIsDesktop
checks/logic.ts              assertions run by `npm run check`
tasks/todo.md                build plan and review notes
```
