# Chromist
Get your colours right.

- **Import your palette.** Paste your colours in as text.
- **Six ways to edit.** HSL, HSB, HWB, OKHSL, OKLCH and LCh, one control.
- **Accessibility audit.** Every combination, read against WCAG 2.2 or the 3.0
  draft, at any font weight, with colour-blindness simulation over the lot.
- **Share with anyone.** One link, to anyone. No account or sign-up.
- **Private.** No backend, accounts, database or analytics.

## Actions

Click a hex code to copy it, click a stripe to edit it, drag to reorder, `+` to
add a colour beside the selected one. `cmd`/`ctrl` + `Z` undoes.

Above the picker: the colour space, the value in it, and a button to copy that
value. The square and the slider are the same control in every space — only what
their axes mean changes. The field reads anything CSS can express and writes the
current space's notation.

The bar, left to right: edit as text, audit, share link, reset, undo, redo, help,
light/dark. Reset is the only one that can't be undone, and it asks first.

In the audit: the specification, the font weight, and which eye to read it
through. Weight feeds both specifications — 2.2 needs it to know where large
text begins, 3.0 to pick a column of the APCA table — so a cell can finally
answer how small the text may be rather than leaving you to guess.

## Colour spaces

The square is always two channels and the slider is always hue. What changes is
which two, and whether every point in the square is a colour you can have.

| Space | Square | Why this one |
| ----- | ------ | ------------ |
| **OKHSL** | S × L | The default. Perceptual, so lightness means the same at every hue — and the only perceptual space here whose square has no unreachable corner. |
| **HSL** | S × L | What CSS and every other tool speak. Familiar, and dishonest: `hsl(60 100% 50%)` and `hsl(240 100% 50%)` claim the same lightness and are nowhere near it. |
| **HSB** | S × B | Matches Figma, Photoshop and Sketch, so numbers pasted from them land where you expect. |
| **HWB** | W × B | Tinting and shading as straight axes — the one to build a ramp off a single hue in. |
| **OKLCH (P3)** | C × L | Perceptual and honest, and the numbers paste straight into CSS. Reaches past sRGB. |
| **LCh (P3)** | C × L | CIELAB — what colour science and print speak. Reaches past sRGB. |

The two P3 spaces can name colours sRGB can't, and mark how far sRGB reached
with a dashed line across the square. The other four are the sRGB cube
relabelled and cannot leave it, which is why the space you pick is also the
gamut you get — there is no separate switch for it.

## Construction

Vite, React, TypeScript, plain CSS, and [culori](https://culorijs.org/) for the
colour maths. No picker library: the square is painted per pixel, which is the
one thing a CSS gradient can't do.

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

Push to `main`; the workflow runs `check` and `build`, then publishes to GitHub
Pages. One-time setup: *Settings → Pages → Source → GitHub Actions*. `base` in
`vite.config.ts` must match the repo name or every asset 404s — which is why dev
also runs under `/chromist/`.

```
src/
  App.tsx        state, and the wiring between the panes
  types.ts       the type surface, including the canonical Colour
  color.ts       parsing, opposite, random, de-duplication, ΔE
  gamut.ts       what a screen can show: mapping, CSS output, the square
  modes.ts       the six editing modes, as one table
  cvd.ts         colour-vision deficiency simulation
  storage.ts     localStorage, validating anything read back
  urlHash.ts     share-link encoding and decoding
  clipboard.ts   copy, with a fallback for non-secure origins
  colourList.ts  the text form of a palette: parsing, validation, formatting
  contrast.ts    WCAG ratio, the four bands the audit reports, and APCA
  components/    PinnedPane, Editor, ChannelPicker, ActionBar,
                 EditColoursDialog, ContrastAudit, icons
  hooks/         useHistory, usePersistentState, useIsDesktop
checks/logic.ts  assertions run by `npm run check`
```

## Decisions

Things that look like mistakes until you know why.

- **Colours are stored as OKLab, unrounded.** Unbounded, so a Display P3 colour
  is the same kind of value as an sRGB one and nothing needs a special case;
  perceptual, so every editing mode is a pure function of it and ΔE is a
  distance. Rounding is left to display: `#2e86ab` → `#2e87ad` is what happens
  otherwise, and the checks assert zero drift over 20k random hexes.
- **The gamut test has an epsilon, and needs one.** Every blue with `r=00` sits
  exactly on the sRGB boundary and reads a fraction *outside* it after a round
  trip. Testing strictly hands it to the chroma mapper, which moved `#0009be` to
  `#001fb0`. The tolerance also has to clear OKHSL, whose square is fitted to an
  approximation of the boundary and overshoots by up to 8e-6.
- **Only OKLCH and LCh reach Display P3.** HSL, HSB and HWB are re-labellings of
  the sRGB cube. OKHSL is too, less obviously: its saturation is a fraction of
  the chroma available *in sRGB*. The editor says so rather than letting a drag
  quietly clamp.
- **The picker holds its own coordinates during a drag.** A colour that has been
  fitted to a gamut has forgotten where the pointer was, so pushing chroma past
  the edge would stick there instead of coming back — and a drag through grey
  would lose its hue, since grey hasn't got one. Same arrangement as the text
  field's half-typed draft.
- **The proximity metric is CIEDE2000, not Euclidean OKLab.** OKLab distance is
  badly nonlinear at the dark end: it scores `#000000` against `#0a0a0a` some
  thirty times higher than a mid-tone pair that looks equally close. The
  threshold is 2.3, the long-standing JND.
- **One specification at a time.** 2.2 and 3.0 disagree by design, and showing a
  ratio next to an Lc invites reading the disagreement as a single verdict. 2.2
  is the default and keeps the AAA / AA / AA+ vocabulary, because that is what
  conformance means and what anyone is held to; 3.0 is labelled a draft and
  reports what APCA actually answers — the smallest usable font size.
- **The APCA font table is floored to its row, not interpolated.** The reference
  ships a second table of deltas for interpolating within a band. Leaving it out
  errs the only safe way: Lc 74 is answered as Lc 70, asking for 19.5px at
  weight 400 where interpolating would allow about 18.2. Same rule `formatRatio`
  follows — never advertise what hasn't been earned. Verified against apca-w3
  0.1.9 across all 2169 Lc-and-weight combinations: identical at every row, and
  never once smaller.
  - Watch the row spacing if you touch it. The table jumps Lc 0, 10, 15 and
    carries that offset for its whole length, so the index is
    `floor(Lc / 5) - 1`. Getting it wrong reads every answer one row too
    generous, silently.
- **The implementation is checked against apca-w3, not built on it.** Fifty
  lines of arithmetic and a table whose constants are fixed by the spec, against
  a dependency and its transitive one.
- **Lc keeps its sign.** The magnitude is the score, but WCAG 2's ratio reads the
  same both ways and APCA's doesn't — so under 2.2 the grid is symmetric across
  its diagonal and under 3.0 the two triangles are two different findings. The
  sign is what says so.
- **The verdict is drawn at the selected weight.** The grid is meant to be its
  own evidence, and weight is half of what legibility depends on. A verdict that
  is hard to read at weight 100 is the finding, not a fault.
- **The audit's fact strip is in theme colours, not the pair's.** A cell whose
  finding is that its two colours are one colour has no third colour to say so
  in. The score above it stays in the pair's own colours, so when they are the
  same colour that band is simply blank — which is the finding.
- **Writes are debounced.** Dragging in the picker fires a change per pointer
  event, and Safari throws once `history.replaceState` passes ~100 calls per 30
  seconds.
- **`oppositeColour` is its own inverse**, which is why `+` filters its result
  through `distinctFrom` — otherwise repeated presses alternate between two
  colours. It stays exact and unclamped for that reason; fitting the result to a
  gamut is `distinctFrom`'s job. That filter compares by ΔE rather than by hex,
  since two colours a single bit apart are the same colour to look at.
- **The audit replaces the panes rather than covering them.** It's a mode, not a
  dialog: nothing is trapped, the bar stays live, and the mode rides in the URL
  (`&a=1`, and `&v=deutan` for the simulation) but not into storage — it
  describes a look at the palette, not the palette.
- **The share link is the one lossy channel.** Storage holds the unrounded
  value; the URL quantises to eight bits a channel, `rrggbb` for sRGB and
  `p3-rrggbb` for anything wider. That keeps every link ever shared working and
  the common case as short as it was, which is worth more than the last bit.
- **History coalescing is tag-based.** Commits sharing a tag within 400ms merge,
  which is what keeps one drag to one undo step. Untagged commits always stand
  alone.
- **The hover clipboard on a hex cell is absolutely positioned**, not a flex
  sibling, so the code stays dead centre. Its container query measures the
  *content box*, so the threshold looks smaller than the cell.
- **Icons are [Phosphor](https://phosphoricons.com), regular weight** (MIT),
  inlined in `components/icons.tsx` rather than installed — nine icons is a
  short list. To add one, copy the **regular** SVG from
  [phosphoricons.com](https://phosphoricons.com) and paste its `<path>` into a
  new component there; any other weight sits at a different visual density.
  Regular draws outlines as *filled* shapes on a 256 grid, so CSS that colours
  an icon sets `color`, never `stroke`. If the list stops being short,
  `npm i @phosphor-icons/react` — the wrapper exists so callers wouldn't change.
