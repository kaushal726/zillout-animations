# ZILLOUT — cinematic single-page experience

Vanilla HTML / CSS / JS. No framework, no build dependencies, no npm install.
A 240-frame render is scrubbed on one fixed canvas across the whole page, so
the eleven sections read as a single continuous shot rather than stacked blocks.

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
index.html              markup for all eleven acts
css/base.css            tokens, type scale, nav, cursor, preloader, buttons
css/film.css            the fixed canvas stage, FX layers, vignette, grain
css/acts.css            per-act layout, cards, product plate, responsive
js/                     ES modules — the source of truth
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
- **Recession is opacity and brightness, not blur.** Blur is capped at 1.5px
  and used only where the film is deep background.

### Frame indices interpolate linearly — do not ease them

`sampleStops(stops, p, ease)` defaults to eased, which is right for opacity,
scale and brightness. Frames pass `ease = false`.

An eased segment flattens at both ends. Once the frame index is rounded to a
whole number, that flat part becomes a *visible dwell* — a pause at every
keyframe, not just where one was intended. Linear keeps scroll-to-frame
constant, so the only pauses are the ones written as explicit flat segments.

## How loading works

Frames arrive in waves, and the background wave always fetches whatever is
nearest the current playhead rather than working in index order — so the
frames about to be needed are the ones being downloaded.

A frame counts as ready only once it has been **decoded**. A loaded-but-undecoded
frame would cost a synchronous decode on the main thread at the exact moment it
has to appear, which is the other classic source of a hitch.

Phones (< 860px) load every second frame: half the bytes, same quality.

## Checks

```bash
node tools/check-timeline.mjs   # hierarchy invariant, blur cap, frame reversals
node tools/check-density.mjs    # scroll-pixels per frame, longest hold per act
```
