# ZILLOUT — cinematic single-page experience

Vanilla HTML / CSS / JS. No framework, no build dependencies, no npm install.
A 240-frame render is scrubbed on one fixed canvas across the whole page, so
the eleven sections read as a single continuous shot rather than stacked blocks.

## The film, beat by beat

| act | moment |
|---|---|
| hero | **Curiosity.** Almost still; the headline carries a slow pool of emphasis. |
| form | **Discovery.** Text leads, the product recedes. |
| energy | **The power-up.** The product goes; a point of light remains; it becomes waves; the waves collapse into one acoustic ring; the ring releases and the product is formed inside it, lit by the ring's own edge. |
| explode | **Engineering.** Staged disassembly. Once open, four components can be put under the light. |
| purpose | Three statements, one at a time. |
| system | **The unexpected transition.** Shadow closes until only the crown ring remains, the camera travels into it, and its circle leaves as a wave that carries into the gallery. |
| presence · visualizer | **Immersion.** |
| silence | **Silence.** Black. *Listen.* — *Everything else can wait.* Nothing else moves. |
| philosophy | The creed, one word at a time. |
| reassembly | Back to one. |
| reveal | **Reveal.** Darkness, then a light that travels the finished product — head, body, everything — while *Power you can feel.* arrives. |
| finale | **Desire.** The hands close back over the face: the opening shot, in reverse. |

Around them: a faint sound field around the product (hairline rings, dust
with depth), a studio key light that leans towards the pointer in product
moments, a small custom cursor on desktop, and a progress ring around the
ZILLOUT mark in place of a progress bar.

## Lighting a flat render

The product is a pre-rendered image sequence with no separate layers, so a
component cannot physically step forward. Every focus moment is done the way
a lighting director would do it — light on one thing, shadow on the rest —
with three passes drawn over the untouched frame (`js/film/canvas.js`):

- **lights** — `soft-light` highlights. Soft-light leaves black black, so
  light only ever lands on the product, never on the empty studio.
- **rim** — a band of light at a radius, for light that travels.
- **shade** — darkness outside a circle, with a soft falloff.

Which light falls where, and when, is decided by `js/film/cues.js`, as pure
functions of scroll progress — so every cue scrubs backwards exactly as it
plays forwards. Focus mode adds a small camera lean towards the part.

### Adding or moving a hotspot

Component positions live once, in art space (fractions of the source still),
in `COMPONENTS` in `js/film/cues.js`. The hotspot, its light and its callout
are all derived from that, through the live camera — so they stay on the
part on every aspect ratio. Copy lives on the `<button class="hotspot">` in
`index.html`; `data-focus-note` makes a part eligible for focus mode.

## Run it

Double-click `index.html` — it works from disk.

Or serve it (better: real caching, and matches production):

```bash
python3 -m http.server 5190
```

## Frame-timing probe

Add `?debug` to the URL for a live readout of the things that make a sequence
feel like a slideshow:

```
http://localhost:5190/?debug
```

| reading | what it means | healthy |
|---|---|---|
| `fps` | animation frames per second | 60 (or your refresh rate) |
| `stall` | longest gap between frames — micro-freezes | under ~32ms |
| `max jump` | largest frame-index step between two draws | single digits at normal scroll |
| `fallback` | draws that showed a *neighbouring* frame because the exact one wasn't decoded — the cause of `20 → 24 → 24 → 29` | `0/n` once loading settles |
| `decoded` | frames ready to draw with no hitch | climbs to the full count |

Scroll slowly through the exploded view and watch `stall` and `fallback`.

## Swapping the product image

`assets/product/zillout-product.svg` is a **placeholder**. Drop the final render
in at that path (any resolution, any aspect ratio) and nothing else changes —
`.product-plate` owns the aspect ratio and the margins, and the image is only
ever `object-fit: contain` inside it. It is never cropped or stretched.

If the new file has a different extension, update the `src` in `index.html`
(one string, same value everywhere).

## Layout of the code

```
index.html              markup for all thirteen acts
css/base.css            tokens, type scale, nav, cursor, ring, preloader, buttons
css/film.css            the fixed canvas stage, FX layers, vignette, grain
css/acts.css            per-act layout, cards, product plate, responsive
js/                     ES modules — the source of truth
  core/ticker.js        the one rAF loop, with a read phase and a write phase
  core/scroll.js        the one scroll clock
  core/quality.js       frame-pacing governor: sheds ambient work, never the film
  core/stage.js         shared per-frame state: pointer, camera, product, hotspot
  film/camera.js        art ↔ canvas ↔ screen coordinates
  film/cues.js          lighting cues, component positions, the power-up ring
  fx/field.js           the ambient sound field and the transition wave
js/zillout.build.js     generated bundle that index.html loads
build.sh                regenerate the bundle after editing js/
```

Browsers refuse to load ES modules over `file://`, so `index.html` loads the
bundle instead. **Edit the modules under `js/`, then run `./build.sh`.**

## Tuning the film

`js/film/timeline.js` is the single source of truth for the whole experience.
Each act declares piecewise stops over its own scroll progress:

```js
frames:     [[0, 88], [0.17, 104], [0.19, 104], ...]  // flat = a held stage
opacity:    [[0, 0.15], [0.18, 1], [1, 1]]            // the product
brightness: [[0, 0.7], [0.18, 1], [1, 1]]
scale:      [[0, 1.04], [0.25, 1], [0.78, 1], ...]    // flat = camera stops
text:       [[0, 1], [0.14, 0.3], [0.9, 0.3], ...]    // the typography
```

Two rules the file keeps:

- **Product and text are never both dominant.** One leads at opacity 1, the
  other recedes to roughly 0.3. That is the focus shift, and it is what tells
  the eye where to look.
- **Recession is opacity and brightness, never blur.** There is no blur
  channel: a live filter on the full-screen film cost a compositing pass
  every frame, and at backdrop opacities it was not visible anyway.

### Frame indices interpolate linearly — do not ease them

`sampleStops(stops, p, ease)` defaults to eased, which is right for opacity,
scale and brightness. Frames pass `ease = false`.

An eased segment flattens at both ends. Once the frame index is rounded to a
whole number, that flat part becomes a *visible dwell* — a pause at every
keyframe, not just where one was intended. Linear keeps scroll-to-frame
constant, so the only pauses are the ones written as explicit flat segments.

## The performance model

The whole page is one animation system with one clock. Four rules keep it
that way — break one and things start to drift out of step again.

**1. One scroll value, sampled once a frame, never eased.** `core/scroll.js`
reads `scrollY` once, at the start of each frame, and everything scroll-linked
— film, lighting, camera, text focus, reveals, hotspots, parallax, the ring —
is computed from that one number in that one frame. The sticky layout is moved
by the browser from the same real position, so nothing can lag behind it.
Easing that value made the product trail the text by 5–11 frames and keep
moving for ~300ms after the scroll stopped.

**2. Scroll decides it → scroll animates it.** Anything whose state depends on
scroll position is a pure function of scroll position: no CSS transition, no
delay, no one-shot class. Reveals write a `--reveal` value (0..1) each frame
and CSS turns it into opacity and transform. Time-based motion is kept only
for what time decides: hover, focus, UI state, and the hero's opening title
sequence. Those use four shared durations (`--t-micro`, `--t-ui`,
`--t-section`, `--t-cinematic`).

**3. Read, then write.** The single rAF loop (`core/ticker.js`) runs a read
phase before the write phase. Geometry is only measured in the read phase, so
nothing ever forces a synchronous layout mid-frame. `onTick(fn, { phase: 'read' })`.

**4. The film is priority one.** `core/quality.js` watches real frame pacing.
Under sustained pressure it sheds, in order: grain movement, then studio
light, cursor halo and half the sound-field dust, then the sound field
entirely. It recovers slowly, so it cannot flicker. The image sequence,
typography and interaction are never degraded. Phones start one level down.

What the compositor blends every frame is kept small: the film canvas carries
its own vignette and brightness (no CSS filter, no separate vignette layer),
the sound-field layer switches itself off when empty, and layers are only
promoted while something is actually moving.

## How loading works

Frames arrive in waves, and the background wave always fetches whatever is
nearest the current playhead rather than working in index order — so the
frames about to be needed are the ones being downloaded.

A frame counts as ready only once it has been **decoded**. A loaded-but-undecoded
frame would cost a synchronous decode on the main thread at the exact moment it
has to appear, which is the other classic source of a hitch. A decoded frame up
to three away is preferred over an undecoded exact one; beyond that, the exact
frame wins, because the wrong pose is worse than a one-off decode.

Decoded images live in the browser's own bounded, evictable cache, so a frame
decoded at load can be cold again later. A sliding window of frames ahead of
the playhead, in the direction of travel, is re-decoded off the main thread
before it is needed.

Phones (< 860px) load every second frame: half the bytes, same quality.

## Checks

`./build.sh` also parse-checks the bundle and fails if it does not parse —
checking the individual modules is not enough, because Node's check of an ES
module can pass an early error the bundle correctly rejects.

```bash
node tools/check-timeline.mjs   # hierarchy invariant, frame reversals
node tools/check-density.mjs    # scroll-pixels per frame, longest hold per act
```

The hierarchy check asserts that product and text are never both above 0.75
at once. Two exceptions, both deliberate: the hero and finale bookends, and
the reveal *while its light is still travelling* — there the shade hides most
of the product whatever its opacity. Density reads act heights straight from
`css/acts.css`. Long holds in `energy` and `reveal` are intentional: in both,
the light is what moves.
