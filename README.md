# palette-builder

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

**Pinned pane.** Equal-width stripes, seven maximum, with an extra `+` column
that disappears once you're full. A bar of hex codes runs along the pane edge
in the app's background and text colours — click one to copy it to the
clipboard, silently. Click a stripe to load it into the editor, drag to
reorder, and use the `×` on the selected stripe to remove it.

**Editor.** Changes write back to the selected stripe live. While a pinned
colour is dirty the button offers `revert`; a new colour offers `pin`. Starting
a new colour begins from the current theme background.

**Settings** (cog in the action bar):

- *Theme* — Neutral (`#4d4d4d`, the default), Black, White. Black gets white
  text, the other two get black.
- *Colour picker* — Sliders (default), Square, Wheel.
- *Copy share link*.

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

**The wheel picker is hand-built** (`src/components/Wheel.tsx`) — react-colorful
ships square-and-hue-bar pickers only. The disc is a conic gradient: angle is
hue, distance from centre is saturation, lightness has its own slider.

## Stack

Vite, React, TypeScript, plain CSS. [react-colorful](https://github.com/omgovich/react-colorful)
for the square picker, [culori](https://culorijs.org/) for colour conversion —
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
  components/                PinnedPane, Editor, Sliders, Wheel, ActionBar, SettingsPopover
  hooks/                     usePersistentState, useIsDesktop
checks/logic.ts              assertions run by `npm run check`
tasks/todo.md                build plan and review notes
```
