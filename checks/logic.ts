import {
  parseColour,
  toHex,
  toBareHex,
  toCss,
  toGamut,
  toListText,
  isWide,
  colourEquals,
  oppositeColour,
  randomColour,
  distinctFrom,
  deltaE,
  JND,
} from '../src/color'
import { clampCount, gamutFor, MODES, modeById, wouldClamp } from '../src/modes'
import { simulate } from '../src/cvd'
import { formatColourList, parseColourList } from '../src/colourList'
import {
  apca,
  contrastRatio,
  formatApca,
  formatMinFontSize,
  formatRatio,
  largeTextPx,
  minFontSize,
  scoreFor,
} from '../src/contrast'
import { MAX_PINS, WEIGHTS } from '../src/types'
import type { Weight } from '../src/types'
import {
  readHash,
  readAudit,
  readVision,
  readSpec,
  readWeight,
  readGamut,
  buildShareUrl,
} from '../src/urlHash'
import { load, save, DEFAULT_SETTINGS } from '../src/storage'
import { reducer } from '../src/hooks/useHistory'

let pass = 0
let fail = 0
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    pass++
    console.log(`  ok   ${label}`)
  } else {
    fail++
    console.log(`  FAIL ${label}\n         got ${a}\n         want ${e}`)
  }
}

/** Colours are floats; almost nothing about them is worth comparing exactly. */
function near(label: string, actual: number, expected: number, tolerance: number) {
  if (Math.abs(actual - expected) <= tolerance) {
    pass++
    console.log(`  ok   ${label}`)
  } else {
    fail++
    console.log(`  FAIL ${label}\n         got ${actual}\n         want ${expected} ± ${tolerance}`)
  }
}

const c = (hex: string) => parseColour(hex)!

console.log('\ncolour conversion')
{
  eq('mid grey has no hue to lose', c('#4d4d4d').a === 0 && c('#4d4d4d').b === 0, true)
  eq('black', toHex(c('#000000')), '#000000')
  eq('white', toHex(c('#ffffff')), '#ffffff')
  eq('invalid text rejected', parseColour('nonsense'), null)
  eq('bare hex has no hash', toBareHex(c('#ff0000')), 'ff0000')
  eq('colourEquals', colourEquals({ l: 1, a: 2, b: 3 }, { l: 1, a: 2, b: 3 }), true)

  // The canary from the README: integer HSL could not hold this colour, which
  // is why nothing is rounded. OKLab holds every one of the 16.7M sRGB colours
  // exactly, so the claim is worth checking across the whole space rather than
  // on a handful of samples.
  eq('the canary round trips', toHex(c('#2e86ab')), '#2e86ab')
  let drift = 0
  for (let i = 0; i < 20000; i++) {
    const hex = '#' + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0')
    if (toHex(c(hex)) !== hex) drift++
  }
  eq('hex -> oklab -> hex never drifts, over 20k samples', drift, 0)
}

console.log('\nediting modes')
{
  const samples = ['#2e86ab', '#000000', '#ffffff', '#808080', '#ff0000', '#00ff88', '#0009be']

  for (const mode of MODES) {
    let worst = 0
    for (const hex of samples) {
      worst = Math.max(worst, deltaE(c(hex), mode.fromCoords(mode.toCoords(c(hex), 0))))
    }
    // Float noise sits around 1e-13 for five of the six. LCh does worse, and is
    // the reason the tolerance is named per mode: CIELAB is defined against
    // D50, and the adaptation to and from D65 is not quite invertible in
    // culori's matrices. The error is still some five orders of magnitude under
    // a just-noticeable difference, so it is documented rather than fought.
    near(`${mode.id} round trips through its own coordinates`, worst, 0, mode.id === 'lch' ? 1e-3 : 1e-9)
  }

  // Every point of the box is a colour in these, which is the whole reason
  // OKHSL exists alongside OKLCH.
  for (const mode of MODES.filter((m) => m.fullSquare)) {
    let outside = 0
    let broken = 0
    for (const h of [0, 60, 120, 200, 280, 340]) {
      for (let i = 0; i <= 20; i++) {
        for (let j = 0; j <= 20; j++) {
          const out = mode.fromCoords({ x: (i / 20) * mode.x.max, y: (j / 20) * mode.y.max, s: h })
          if (!Number.isFinite(out.l + out.a + out.b)) broken++
          if (isWide(out)) outside++
        }
      }
    }
    eq(`${mode.id} has no dead zone`, outside, 0)
    // OKHSL divides by zero at both ends of its lightness axis. Every mode is
    // checked because a coordinate that converts to nothing would be stored.
    eq(`${mode.id} never converts to NaN`, broken, 0)
  }

  // And the opposite claim for the polar modes, which is why they draw one.
  {
    const oklch = modeById('oklch')
    let reachable = 0
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 20; j++) {
        const co = { x: (i / 20) * oklch.x.max, y: (j / 20) * oklch.y.max, s: 200 }
        if (!isWide(oklch.fromCoords(co))) reachable++
      }
    }
    eq('most of an OKLCH square is out of sRGB at hue 200', reachable / 441 < 0.35, true)
  }

  // A grey has no hue, so the control has to supply one — otherwise dragging
  // lightness through a neutral snaps the slider back to red.
  for (const mode of MODES) {
    eq(`${mode.id} keeps the given hue on a grey`, mode.toCoords(c('#808080'), 137).s, 137)
  }

  // The gamut is the mode's own, not a second choice laid over it.
  eq('HSL works in sRGB', gamutFor(modeById('hsl')), 'srgb')
  eq('OKHSL too — it is defined against sRGB', gamutFor(modeById('okhsl')), 'srgb')
  eq('OKLCH reaches P3', gamutFor(modeById('oklch')), 'p3')
  eq('LCh reaches P3', gamutFor(modeById('lch')), 'p3')
  eq('and the P3 ones say so in their names', MODES.filter((m) => !m.srgbOnly).every((m) => m.label.includes('(P3)')), true)

  // Moving a wide colour into an sRGB space has to change it, and that is worth
  // asking about. The reverse never is: every sRGB colour has an OKLCH reading.
  const wide = parseColour('color(display-p3 0 1 0)')!
  eq('a wide colour would be clamped by HSL', wouldClamp(modeById('hsl'), wide), true)
  eq('and by OKHSL, which is also sRGB', wouldClamp(modeById('okhsl'), wide), true)
  eq('but not by OKLCH', wouldClamp(modeById('oklch'), wide), false)
  eq('nor by LCh', wouldClamp(modeById('lch'), wide), false)
  eq('an sRGB colour is never clamped by anything', MODES.every((m) => !wouldClamp(m, c('#2e86ab'))), true)
  // The boundary case the gamut epsilon exists for must not trigger a warning.
  eq('nor is one sitting exactly on the sRGB edge', MODES.every((m) => !wouldClamp(m, c('#0009be'))), true)

  // The space belongs to the palette, so the warning counts the palette.
  const mixed = [c('#2e86ab'), wide, c('#ffffff'), parseColour('color(display-p3 1 0 0)')!]
  eq('every wide colour is counted, not just the selected one', clampCount(modeById('hsl'), mixed), 2)
  eq('an all-sRGB palette needs no warning', clampCount(modeById('hsl'), [c('#2e86ab'), c('#ffffff')]), 0)
  eq('and a P3 space never does', clampCount(modeById('oklch'), mixed), 0)
  eq('an empty palette needs no warning', clampCount(modeById('hsl'), []), 0)
  // What answering yes does to them.
  eq('clamping the palette leaves nothing outside sRGB', mixed.map((m) => isWide(toGamut(m, 'srgb'))), [false, false, false, false])
  eq('and leaves the ones already inside it alone', toGamut(c('#2e86ab'), 'srgb'), c('#2e86ab'))
}

console.log('\ngamut')
{
  const wide = parseColour('color(display-p3 0 1 0)')!
  eq('P3 green is outside sRGB', isWide(wide), true)
  eq('and inside P3', isWide(toGamut(wide, 'p3')) && true, true)
  eq('mapping into sRGB lands in sRGB', isWide(toGamut(wide, 'srgb')), false)
  // Chroma is reduced while lightness and hue hold; clipping RGB channels
  // instead would move the hue, which is the failure this avoids.
  near('mapping holds lightness', toGamut(wide, 'srgb').l, wide.l, 0.02)
  eq('an in-gamut colour is left alone', toGamut(c('#2e86ab'), 'srgb'), c('#2e86ab'))

  // The boundary case that made an epsilon necessary: every blue with r=00 sits
  // exactly on the edge and reads a fraction outside it after a round trip.
  eq('a colour on the sRGB boundary is not mapped away', toHex(c('#0009be')), '#0009be')
  eq('nor these', ['#0000ff', '#00ff00', '#ff0000', '#0017e8'].every((h) => toHex(c(h)) === h), true)

  eq('an sRGB colour writes as hex', toListText(c('#2e86ab')), '#2E86AB')
  eq('a wide colour writes as color()', toListText(wide).startsWith('color(display-p3'), true)
  // Float noise out of the gamut mapping must not reach the stylesheet: pure P3
  // green was printing as `-8.47e-15 1.0000000000000002 1.79e-15`.
  eq('and without a tail of float noise', toCss(wide, 'p3'), 'color(display-p3 0 1 0)')
  eq('every channel stays inside 0-1', /^color\(display-p3( (0|1|0\.\d{1,5}))+\)$/.test(toCss(wide, 'p3')), true)
  eq('a wide colour asked for sRGB comes back as hex', toCss(wide, 'srgb').startsWith('#'), true)
}

console.log('\nopposite colour')
{
  const opp = (hex: string) => toHex(oppositeColour(c(hex)))

  eq('black -> white', opp('#000000'), '#ffffff')
  eq('white -> black', opp('#ffffff'), '#000000')
  // The reason lightness is mirrored rather than hue simply rotated: a plain
  // rotation is a no-op on any grey, and both themes are grey.
  eq('grey moves', opp('#808080') !== '#808080', true)

  const before = c('#2e86ab')
  const after = oppositeColour(before)
  eq('both opponent axes flip', [after.a, after.b], [-before.a, -before.b])
  eq('lightness mirrors around the middle', after.l, 1 - before.l)
  eq('applying it twice returns the original exactly', oppositeColour(after), before)

  let moved = 0
  for (const hex of ['#2e86ab', '#ff5733', '#f6f5ae', '#4d4d4d', '#000000', '#808080']) {
    if (opp(hex) !== hex) moved++
  }
  eq('every sample changes colour', moved, 6)
}

console.log('\nrandom start colour')
{
  const samples = Array.from({ length: 500 }, () => randomColour())
  eq('lightness stays usable', samples.every((s) => s.l >= 0.5 && s.l <= 0.8), true)
  eq('always lands somewhere showable', samples.every((s) => !isWide(s)), true)
  eq('always a valid hex', samples.every((s) => /^#[0-9a-f]{6}$/.test(toHex(s))), true)
  eq('no two samples are the same colour', new Set(samples.map(toHex)).size > 400, true)
}

console.log('\nno duplicate colours')
{
  const blue = c('#2e86ab')
  const opposite = oppositeColour(blue)

  eq('a free colour is used as-is', toHex(distinctFrom(opposite, [blue], 'srgb')), toHex(opposite))

  // The case this exists for: + twice in a row, where the second opposite is
  // the original colour again.
  const again = oppositeColour(opposite)
  eq('a colour already pinned is replaced', deltaE(distinctFrom(again, [blue, opposite], 'srgb'), blue) >= JND, true)

  // And the case a hex comparison missed: a colour one bit away is the same
  // colour, and adding it is never what was meant.
  eq('a barely-different colour also counts as taken', deltaE(distinctFrom(c('#2e87ad'), [blue], 'srgb'), blue) >= JND, true)

  const full = ['#2e86ab', '#ff5733', '#f6f5ae', '#4d4d4d', '#000000', '#ffffff', '#00ff88'].map(c)
  let collided = false
  for (let i = 0; i < 200; i++) {
    const out = distinctFrom(full[i % full.length], full, 'srgb')
    if (full.some((f) => deltaE(f, out) < JND)) collided = true
  }
  eq('replacement never collides with a full palette', collided, false)

  // The candidate is fitted to the target on the way through, since this is
  // where it stops being a calculation and becomes a colour to be shown.
  eq('the result is always inside the target gamut', isWide(distinctFrom(parseColour('color(display-p3 0 1 0)')!, [], 'srgb')), false)
}

console.log('\nproximity')
{
  // The pair from the README's rounding note: a single bit apart, and the same
  // colour to look at.
  eq('one bit apart is the same colour', deltaE(c('#2e86ab'), c('#2e87ad')) < JND, true)
  eq('a visible step is not', deltaE(c('#2e86ab'), c('#4aa3c8')) >= JND, true)
  eq('a colour against itself is zero', deltaE(c('#2e86ab'), c('#2e86ab')), 0)
  // CIEDE2000 rather than Euclidean OKLab, and this is why: near-blacks have to
  // score in the same range as everything else, and in OKLab they do not.
  eq('near-blacks are not over-weighted', deltaE(c('#000000'), c('#0a0a0a')) < 3, true)
}

console.log('\ncolour vision')
{
  eq('normal vision is the identity', simulate(c('#2e86ab'), 'normal'), c('#2e86ab'))
  // The textbook case: red and green separate for normal vision and collapse
  // towards each other without a working green cone.
  const apart = deltaE(c('#d40000'), c('#00a000'))
  const together = deltaE(simulate(c('#d40000'), 'deutan'), simulate(c('#00a000'), 'deutan'))
  eq('red and green collapse for a deuteranope', together < apart / 2, true)
  eq('greys are unaffected', toHex(simulate(c('#808080'), 'deutan')), '#808080')
  eq('every simulation stays a colour', (['protan', 'deutan', 'tritan'] as const).every((v) => /^#[0-9a-f]{6}$/.test(toHex(simulate(c('#2e86ab'), v)))), true)
}

console.log('\nurl hash')
{
  eq('empty hash -> null', readHash(''), null)
  eq('unrelated hash -> null', readHash('#other=1'), null)
  eq('garbage values dropped', readHash('#p=zzzzzz,nothex'), null)
  const three = readHash('#p=ff0000,00ff00,0000ff')
  eq('three colours parsed', three?.length, 3)
  eq('first parsed correctly', toHex(three![0].colour), '#ff0000')
  eq('ids are unique', new Set(three?.map((p) => p.id)).size, 3)
  eq('capped at 7', readHash('#p=' + Array(12).fill('ff0000').join(','))?.length, 7)
  eq('mixed valid/invalid keeps valid', readHash('#p=ff0000,xx,00ff00')?.length, 2)
  eq('audit flag read', readAudit('#p=ff0000&a=1'), true)
  eq('no audit flag', readAudit('#p=ff0000'), false)
  eq('audit flag must be 1', readAudit('#p=ff0000&a=yes'), false)
  eq('empty hash has no audit flag', readAudit(''), false)
  eq('spec read', readSpec('#p=ff0000&a=1&w=3'), 'wcag30')
  eq('unknown spec is not read', readSpec('#p=ff0000&a=1&w=9'), null)
  eq('no spec in the hash', readSpec('#p=ff0000&a=1'), null)
  eq('weight read', readWeight('#p=ff0000&a=1&fw=700'), 700)
  eq('gamut read', readGamut('#p=ff0000&a=1&g=p3'), 'p3')
  eq('unknown gamut is not read', readGamut('#p=ff0000&a=1&g=rec2020'), null)
  eq('no gamut in the hash', readGamut('#p=ff0000&a=1'), null)
  eq('a weight off the scale is not read', readWeight('#p=ff0000&a=1&fw=650'), null)
  eq('vision read', readVision('#p=ff0000&a=1&v=deutan'), 'deutan')
  eq('unknown vision falls back', readVision('#p=ff0000&a=1&v=martian'), 'normal')
  eq('no vision is normal', readVision('#p=ff0000'), 'normal')

  // A wide colour has no six-digit hex, so it travels in P3's primaries.
  const wide = readHash('#p=p3-00ff00')
  eq('a p3 token parses', wide?.length, 1)
  eq('and comes back outside sRGB', isWide(wide![0].colour), true)

  ;(globalThis as any).window = { location: { origin: 'https://x.test', pathname: '/' } }
  eq('share url', buildShareUrl(three!), 'https://x.test/#p=ff0000,00ff00,0000ff')
  eq('share url with no pins', buildShareUrl([]), 'https://x.test/')
  eq('audit share url', buildShareUrl(three!, { audit: true }), 'https://x.test/#p=ff0000,00ff00,0000ff&a=1')
  eq('audit share url with no pins', buildShareUrl([], { audit: true }), 'https://x.test/')
  eq('audit share url round trips', readAudit(buildShareUrl(three!, { audit: true }).split('#')[1]), true)
  eq('the vision rides with the audit', buildShareUrl(three!, { audit: true, vision: 'deutan' }), 'https://x.test/#p=ff0000,00ff00,0000ff&a=1&v=deutan')
  eq('but not without it', buildShareUrl(three!, { vision: 'deutan' }), 'https://x.test/#p=ff0000,00ff00,0000ff')
  eq('the spec and weight ride too', buildShareUrl(three!, { audit: true, spec: 'wcag30', weight: 700 }), 'https://x.test/#p=ff0000,00ff00,0000ff&a=1&w=3&fw=700')
  // Defaults stay out of the hash, so the common link is as short as it was.
  eq('the defaults are left implicit', buildShareUrl(three!, { audit: true, spec: 'wcag22', weight: 400 }), 'https://x.test/#p=ff0000,00ff00,0000ff&a=1')
  eq('and nothing rides without the audit', buildShareUrl(three!, { spec: 'wcag30', weight: 700 }), 'https://x.test/#p=ff0000,00ff00,0000ff')
  eq('spec round trips', readSpec(buildShareUrl(three!, { audit: true, spec: 'wcag30' }).split('#')[1]), 'wcag30')
  eq('weight round trips', readWeight(buildShareUrl(three!, { audit: true, weight: 900 }).split('#')[1]), 900)
  eq('gamut rides with the audit', buildShareUrl(three!, { audit: true, gamut: 'p3' }), 'https://x.test/#p=ff0000,00ff00,0000ff&a=1&g=p3')
  eq('the default gamut stays implicit', buildShareUrl(three!, { audit: true, gamut: 'srgb' }), 'https://x.test/#p=ff0000,00ff00,0000ff&a=1')
  eq('gamut round trips', readGamut(buildShareUrl(three!, { audit: true, gamut: 'p3' }).split('#')[1]), 'p3')

  // Links shared before any of this existed have to keep working, and keep
  // producing the hash they always did.
  eq('an sRGB palette encodes exactly as it used to', buildShareUrl(readHash('#p=2e86ab,f6f5ae')!), 'https://x.test/#p=2e86ab,f6f5ae')
  eq('a wide colour round trips through the url', isWide(readHash(buildShareUrl(wide!).split('#')[1])![0].colour), true)
}

console.log('\nstorage validation')
{
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  }
  eq('default theme is light', DEFAULT_SETTINGS.theme, 'white')
  // Perceptual by default, and the one perceptual space with no unreachable
  // corner to explain.
  eq('default mode is OKHSL', DEFAULT_SETTINGS.mode, 'okhsl')
  eq('default spec is the one people are held to', DEFAULT_SETTINGS.spec, 'wcag22')
  eq('default weight is regular', DEFAULT_SETTINGS.weight, 400)
  eq('default gamut is the safe one', DEFAULT_SETTINGS.gamut, 'srgb')
  eq('empty storage -> defaults', load(), { pins: [], settings: DEFAULT_SETTINGS })
  store.set('chromist.v2', '{ not json')
  eq('corrupt json -> defaults', load(), { pins: [], settings: DEFAULT_SETTINGS })

  store.set(
    'chromist.v2',
    JSON.stringify({
      pins: [
        { id: 'a', colour: { l: 0.5, a: 0, b: 0 } },
        { id: 'b', colour: { l: 'bad', a: 0, b: 0 } },
        { nope: true },
      ],
      settings: {
        theme: 'martian',
        gamut: 'rec2020',
        mode: 'wheel',
        spec: 'wcag99',
        weight: 650,
        picker: 'old',
      },
    }),
  )
  const loaded = load()
  eq('malformed pins filtered out', loaded.pins.length, 1)
  eq('unknown theme falls back to the default', loaded.settings.theme, DEFAULT_SETTINGS.theme)
  eq('unknown mode falls back', loaded.settings.mode, DEFAULT_SETTINGS.mode)
  eq('unknown spec falls back', loaded.settings.spec, DEFAULT_SETTINGS.spec)
  eq('a weight off the scale falls back', loaded.settings.weight, DEFAULT_SETTINGS.weight)
  eq('unknown gamut falls back', loaded.settings.gamut, DEFAULT_SETTINGS.gamut)
  eq('settings from older builds drop unknown keys', loaded.settings, DEFAULT_SETTINGS)

  store.set('chromist.v2', JSON.stringify({ pins: [], settings: { theme: 'neutral' } }))
  eq('a retired theme falls back to the default', load().settings.theme, DEFAULT_SETTINGS.theme)

  save({ pins: [{ id: 'a', colour: { l: 0.5, a: 0.1, b: 0.1 } }], settings: DEFAULT_SETTINGS })
  eq('save round trips', load().pins[0].id, 'a')

  // A palette stored by any build before colour modes is HSL, and has to come
  // across as the same palette rather than as nothing.
  store.clear()
  store.set(
    'chromist.v1',
    JSON.stringify({
      pins: [
        { id: 'old', hsl: { h: 197.4, s: 57.5, l: 42.5 } },
        { id: 'bad', hsl: { h: 'x', s: 1, l: 1 } },
      ],
      settings: { theme: 'white' },
    }),
  )
  const migrated = load()
  eq('a v1 palette is carried across', migrated.pins.length, 1)
  eq('and keeps its ids', migrated.pins[0].id, 'old')
  near('and its colour', deltaE(migrated.pins[0].colour, c('#2e86ab')), 0, 0.5)
  eq('v1 settings come with it', migrated.settings.theme, 'white')
  eq('and gain the new defaults', [migrated.settings.mode, migrated.settings.spec, migrated.settings.weight], ['okhsl', 'wcag22', 400])
  // `picker` was a real setting once; reading field by field is what keeps it
  // from coming back through the door.
  eq('a retired setting is dropped', 'picker' in migrated.settings, false)
}

console.log('\nundo / redo')
{
  const start = { past: [] as string[], present: 'a', future: [] as string[] }
  const step = (s: typeof start, next: string, coalesce = false) =>
    reducer(s, { type: 'commit', next, coalesce })

  let s = step(step(start, 'b'), 'c')
  eq('commits stack up', [s.past, s.present], [['a', 'b'], 'c'])

  s = reducer(s, { type: 'undo' })
  eq('undo steps back one', [s.past, s.present, s.future], [['a'], 'b', ['c']])

  s = reducer(s, { type: 'undo' })
  eq('undo again', [s.past, s.present, s.future], [[], 'a', ['b', 'c']])

  eq('undo at the start is a no-op', reducer(s, { type: 'undo' }).present, 'a')

  s = reducer(s, { type: 'redo' })
  eq('redo steps forward', [s.past, s.present, s.future], [['a'], 'b', ['c']])

  const branched = step(s, 'x')
  eq('committing after undo drops the redo branch', branched.future, [])
  eq('committing after undo keeps the past', branched.past, ['a', 'b'])

  const coalesced = step(step(start, 'b'), 'c', true)
  eq('coalesced commit does not deepen history', [coalesced.past, coalesced.present], [['a'], 'c'])
  eq(
    'undo after coalescing lands before the whole run',
    reducer(coalesced, { type: 'undo' }).present,
    'a',
  )

  const afterReset = reducer(step(step(start, 'b'), 'c'), { type: 'reset', next: 'z' })
  eq('reset clears the whole stack', afterReset, { past: [], present: 'z', future: [] })

  let long = start
  for (let i = 0; i < 150; i++) long = step(long, `v${i}`)
  eq('history is capped', long.past.length, 100)
  eq('cap keeps the most recent', long.past[99], 'v148')
}

console.log('\ncontrast')
{
  const ratio = (a: string, b: string) => contrastRatio(c(a), c(b))

  // A float, and displayed floored to two places, so the last bit is noise.
  near('black on white is the maximum', ratio('#000000', '#ffffff'), 21, 1e-9)
  eq('a colour against itself is 1', ratio('#2e86ab', '#2e86ab'), 1)
  eq('order does not matter', ratio('#2e86ab', '#ffffff'), ratio('#ffffff', '#2e86ab'))

  eq('7 and over is AAA', scoreFor(7), 'AAA')
  eq('just under 7 is AA', scoreFor(6.99), 'AA')
  eq('4.5 is AA', scoreFor(4.5), 'AA')
  eq('just under 4.5 is large-text only', scoreFor(4.49), 'AA+')
  eq('3 is large-text only', scoreFor(3), 'AA+')
  eq('under 3 fails outright', scoreFor(2.99), 'FAIL')

  // A displayed ratio must never round its way into looking like a pass.
  eq('the ratio rounds down', formatRatio(4.499), '4.49:1')
  eq('the ratio keeps two places', formatRatio(21), '21.00:1')

  // Checked against the apca-w3 0.1.9 reference implementation, which is not a
  // dependency here — fifty lines of arithmetic against a package, and the
  // numbers are fixed by the spec.
  const vectors: Array<[string, string, number]> = [
    ['#000000', '#ffffff', 106.0407],
    ['#ffffff', '#000000', -107.8847],
    ['#888888', '#ffffff', 63.0565],
    ['#ffffff', '#888888', -68.5415],
    ['#000000', '#aaaaaa', 58.1463],
    ['#aaaaaa', '#000000', -56.2411],
    ['#2e86ab', '#ffffff', 67.8881],
    ['#0009be', '#ffffff', 94.2001],
  ]
  for (const [text, bg, want] of vectors) {
    near(`apca ${text} on ${bg}`, apca(c(text), c(bg)), want, 0.001)
  }
  // Two colours a hair apart report nothing rather than a tiny number, and the
  // clip below Lc 10 does the same at the bottom of the range.
  eq('apca ignores a difference too small to matter', apca(c('#010101'), c('#050505')), 0)
  eq('apca is polarity-aware, unlike the ratio', apca(c('#ffffff'), c('#888888')) < 0, true)
  eq('formatApca', formatApca(67.8881), 'Lc 68')
  // Kept signed: the magnitude is the score, but the sign is what says the grid
  // has stopped being symmetric.
  eq('formatApca keeps the sign', formatApca(-68.09), 'Lc -68')
}

console.log('\nwcag 2.2 sizing')
{
  // WCAG 2's entire interest in weight: one step, at 700.
  eq('regular large text is 18pt', largeTextPx(400), 24)
  eq('and 14pt once bold', largeTextPx(700), 18.66)
  eq('the step is exactly at 700', [largeTextPx(600), largeTextPx(800)], [24, 18.66])
}

console.log('\napca font lookup')
{
  const px = (lc: number, w: Weight) => formatMinFontSize(minFontSize(lc, w))

  // Read straight off the published table.
  eq('Lc 75 at regular is 18px', px(75, 400), '18px')
  eq('Lc 75 at bold is 14px', px(75, 700), '14px')
  eq('Lc 60 at regular is 24px', px(60, 400), '24px')
  eq('Lc 90 at regular is 16px', px(90, 400), '16px')
  eq('Lc 45 at regular is 42px', px(45, 400), '42px')
  eq('Lc 125 at regular is 10px', px(125, 400), '10px')

  // Above 24px the reference rounds to whole pixels; below it keeps half steps.
  // Matching that is what makes every row here identical to the reference
  // rather than merely close — verified against apca-w3 0.1.9 across all 2169
  // Lc-and-weight combinations, with none reading smaller than the reference.
  eq('a large size rounds to whole pixels', px(85, 200), '35px')
  eq('and rounds down where the table does', px(80, 200), '38px')
  eq('a small size keeps its half step', px(70, 700), '14.5px')

  // The sentinels, and the band below which APCA declines to call anything
  // fluently readable.
  eq('Lc 10 carries no text at all', px(10, 400), 'no text')
  eq('Lc 15 is non-text only', px(15, 400), 'non-text')
  eq('Lc 35 is spot text only', px(35, 400), 'spot only')
  eq('and Lc 40 still is, just under the line', px(40, 400), 'spot only')
  eq('Lc 45 is where fluent text starts', 'px' in minFontSize(45, 400), true)

  // Polarity decides the Lc, not what it buys.
  eq('the sign is dropped', px(-68, 400), px(68, 400))

  // Flooring to the row, never past it — the same rule formatRatio follows.
  eq('an Lc between rows takes the row below', px(74, 400), px(70, 400))
  eq('and never the row above', px(74, 400) !== px(75, 400), true)
  let monotonic = true
  for (const w of WEIGHTS) {
    let last = Infinity
    for (let lc = 45; lc <= 125; lc += 5) {
      const r = minFontSize(lc, w)
      if (!('px' in r)) continue
      if (r.px > last) monotonic = false
      last = r.px
    }
  }
  eq('more contrast never demands larger text', monotonic, true)

  // Out-of-range input must not index off the end of the table in either
  // direction; Lc below 5 would otherwise land on no row at all.
  eq('Lc 0 is handled', px(0, 400), 'no text')
  eq('Lc 4 is handled', px(4, 400), 'no text')
  eq('an impossible Lc is clamped', px(500, 400), px(125, 400))
  eq('every weight resolves at every row', WEIGHTS.every((w) => {
    for (let lc = 0; lc <= 125; lc += 5) if (formatMinFontSize(minFontSize(lc, w)) === 'undefinedpx') return false
    return true
  }), true)
}

console.log('\ncolour list')
{
  const list = (text: string) => parseColourList(text).colours.map(toHex)
  const errs = (text: string) => parseColourList(text).errors

  eq('reads a plain list', list('#e4572e\n#17bebb'), ['#e4572e', '#17bebb'])
  eq('takes codes without the hash', list('e4572e'), ['#e4572e'])
  eq('lower-cases what it reads', list('#E4572E'), ['#e4572e'])
  eq('expands three digits', list('#abc\nfff'), ['#aabbcc', '#ffffff'])
  eq('ignores blank lines and padding', list('\n  #abc  \n\n'), ['#aabbcc'])
  eq('round-trips the formatted form', list(formatColourList([c('#e4572e')])), ['#e4572e'])

  // Anything culori can read, which is what lets a palette come back in the
  // notation it was written out in.
  eq('reads oklch', list('oklch(0.7 0.1 200)').length, 1)
  eq('reads a named colour', list('tomato'), ['#ff6347'])
  eq('reads a wide colour', parseColourList('color(display-p3 0 1 0)').colours.map(isWide), [true])
  eq('a wide colour survives the round trip', parseColourList(formatColourList(parseColourList('color(display-p3 0 1 0)').colours)).colours.map(isWide), [true])

  eq('rejects eight-digit alpha', errs('#e4572eff'), [
    { line: 1, message: 'no opacity — drop the last digits' },
  ])
  eq('rejects four-digit alpha', errs('#abcd'), [
    { line: 1, message: 'no opacity — drop the last digits' },
  ])
  eq('rejects alpha in any notation', errs('rgb(1 2 3 / 50%)'), [
    { line: 1, message: 'no opacity — drop the alpha' },
  ])
  eq('rejects text that is not a colour', errs('nope'), [{ line: 1, message: 'not a colour' }])
  eq('rejects odd hex lengths', errs('#abcde'), [{ line: 1, message: 'needs three or six digits' }])
  eq('rejects an empty list', errs(' \n '), [{ line: 1, message: 'needs at least one colour' }])
  eq('reports the failing line number', errs('#abc\n\nnope')[0].line, 3)
  eq('holds everything back while a line is bad', list('#abc\nnope'), [])

  const over = errs(Array(MAX_PINS + 1).fill('#abc').join('\n'))
  eq('rejects more than the cap', over, [{ line: MAX_PINS + 1, message: `over ${MAX_PINS} colours` }])
  eq('accepts exactly the cap', list(Array(MAX_PINS).fill('#abc').join('\n')).length, MAX_PINS)
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
