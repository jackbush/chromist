# Chromist

A chromist got colour right by hand. Now it's a browser tool: build palettes,
share a link, no account required.

**https://jackbush.github.io/chromist/**

Mobile-first, monospace, up to seven colours. No backend, no accounts, no
database: the palette lives in the URL and in `localStorage`, and nothing is
ever sent anywhere.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173/chromist/
```

| Script            | What it does                                       |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Dev server with hot reload                         |
| `npm run build`   | Type-check then build to `dist/`                   |
| `npm run preview` | Serve the built `dist/` locally                    |
| `npm run check`   | Logic assertions — colour maths, URL hash, storage |

## Deploying

Push to `main`; the workflow runs `check` and `build`, then publishes to GitHub
Pages. One-time setup: *Settings → Pages → Source → GitHub Actions*.

`base` in `vite.config.ts` must match the repo name or every asset 404s. That's
why dev also runs under `/chromist/`.

## How it works

The pane of pinned colours sits above the editor on mobile, left of it at 768px
and up, where the stripes rotate into horizontal bands.

- **Starting colours.** Opens on a random vivid colour. `+` then pins the
  *opposite* of the selection — hue rotated half a turn, lightness mirrored,
  saturation kept — falling back to random if that colour is already pinned.
- **Pinned pane.** The `+` column is a fixed seventh; the colours split the rest.
  Click a hex code to copy it silently, click a stripe to edit it, drag to
  reorder. The palette is never empty.
- **Editor.** Saturation square plus hue bar, filling the pane, with an editable
  hex field above it and a trash icon to delete the selected colour.
- **Action bar.** Share-link, undo, redo, settings, reset. Undo covers palette
  changes only, with `cmd`/`ctrl` + `Z`.
- **Themes.** Black (default), Neutral `#4d4d4d`, White.

Palettes encode into the URL fragment — `#p=ff5733,2e86ab` — which never
reaches a server, so a shared link is self-contained. It wins over stored pins
on load.

## Traps for anyone changing this

- **HSL is stored unrounded.** Integer HSL has ~3.7M states against hex's 16.7M,
  so rounding on import makes colours drift (`#2e86ab` → `#2e87ad`). Round only
  when displaying. Related: culori leaves hue *undefined* for greys, so every
  read of `.h` needs a fallback.
- **Writes are debounced.** Dragging in the picker fires a change per pointer
  event, and Safari throws once `history.replaceState` passes ~100 calls per 30
  seconds.
- **`oppositeHsl` is its own inverse**, which is why `+` filters its result
  through `distinctFrom` — otherwise repeated presses alternate between two
  colours.
- **The hover clipboard on a hex cell is absolutely positioned**, not a flex
  sibling, so the code stays dead centre. Its container query measures the
  *content box*, so the threshold looks smaller than the cell.
- **History coalescing is tag-based.** Commits sharing a tag within 400ms merge,
  which is what keeps one drag to one undo step. Untagged commits always stand
  alone.
- **Icons are drawn to match the type** — 24-unit grid, 2-unit strokes, square
  caps, right angles and 45s only. Nothing rounded.

## Stack

Vite, React, TypeScript, plain CSS.
[react-colorful](https://github.com/omgovich/react-colorful) for the picker,
[culori](https://culorijs.org/) for conversion — culori also speaks OKLCH, the
sane basis for tint ramps or harmony suggestions if those ever get built.

```
src/
  App.tsx        state, and the wiring between the two panes
  color.ts       hex <-> hsl, opposite, random, de-duplication
  storage.ts     localStorage, validating anything read back
  urlHash.ts     share-link encoding and decoding
  clipboard.ts   copy, with a fallback for non-secure origins
  components/    PinnedPane, Editor, ActionBar, SettingsPopover, icons
  hooks/         useHistory, usePersistentState, useIsDesktop
checks/logic.ts  assertions run by `npm run check`
```
