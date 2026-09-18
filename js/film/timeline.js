/* The timeline — one continuous shot, choreographed as story beats.

   Each act declares, as piecewise stops over its own scroll progress:

     frames  which still is on screen. Flat segments are deliberate holds,
             which is what turns the disassembly into a staged engineering
             reveal instead of everything flying apart at once.
     product opacity / brightness / scale / blur of the film.
     text    opacity of that act's typography.

   The rule the whole page obeys: product and text are never both fully
   present. One leads, the other recedes — and it recedes through opacity
   and brightness, not through heavy blur, so nothing ever looks broken.

   Blur is capped deliberately low (1.5px) and used only where the film is
   deep background. */

export const TIMELINE = [
  {
    id: 'hero',
    // Almost still. The opening should breathe, not move.
    frames:     [[0, 1], [1, 22]],
    opacity:    [[0, 1], [0.30, 1], [0.66, 0.5]],
    brightness: [[0, 1], [0.30, 1], [0.66, 0.78]],
    scale:      [[0, 1.05], [0.5, 1], [1, 1]],
    blur:       [[0, 0]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'form',
    // Text leads. The product sits back and dims, but stays legible.
    frames:     [[0, 22], [1, 80]],
    opacity:    [[0, 0.5], [0.2, 0.3], [0.8, 0.3], [1, 0.55]],
    brightness: [[0, 0.8], [0.2, 0.62], [0.8, 0.62], [1, 0.8]],
    scale:      [[0, 1], [1, 1.015]],
    blur:       [[0, 0]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'energy',
    // Handover: the product recedes to a glow, the field takes the frame.
    frames:     [[0, 80], [1, 88]],
    opacity:    [[0, 0.55], [0.5, 0.12], [1, 0.1]],
    brightness: [[0, 0.8], [1, 0.6]],
    scale:      [[0, 1.015], [1, 1.04]],
    blur:       [[0, 0], [0.5, 1.2], [1, 1.2]],
    text:       [[0, 1], [0.85, 1], [1, 0.45]],
  },
  {
    id: 'explode',
    // PRODUCT MOMENT. Staged disassembly with a pause at every stage, and
    // the typography pulled right back so the engineering can be read.
    frames: [
      [0, 88], [0.17, 104], [0.19, 104],   // outer shell, settles
      [0.39, 124], [0.41, 124],            // structure, settles
      [0.61, 144], [0.63, 144],            // internals, settles
      [0.86, 168], [1, 176],               // full configuration
    ],
    opacity:    [[0, 0.15], [0.18, 1], [1, 1]],
    brightness: [[0, 0.7], [0.18, 1], [1, 1]],
    // Push in, then the camera stops entirely for the middle of the act.
    scale:      [[0, 1.04], [0.25, 1], [0.78, 1], [1, 0.99]],
    blur:       [[0, 1.2], [0.18, 0], [1, 0]],
    text:       [[0, 1], [0.14, 0.3], [0.9, 0.3], [1, 0.5]],
  },
  {
    id: 'purpose',
    // Text leads again, one statement at a time.
    frames:     [[0, 176], [1, 214]],
    opacity:    [[0, 1], [0.16, 0.42], [0.85, 0.42], [1, 0.6]],
    brightness: [[0, 1], [0.16, 0.7], [0.85, 0.7], [1, 0.8]],
    scale:      [[0, 0.99], [1, 1.01]],
    blur:       [[0, 0]],
    text:       [[0, 0.5], [0.16, 1], [1, 1]],
  },
  {
    id: 'system',
    // The gallery is the content; the film drops to a backdrop.
    frames:     [[0, 214], [1, 232]],
    opacity:    [[0, 0.6], [0.2, 0.16], [0.85, 0.16], [1, 0.1]],
    brightness: [[0, 0.8], [0.2, 0.5], [1, 0.45]],
    scale:      [[0, 1.01], [1, 1.05]],
    blur:       [[0, 0], [0.2, 1.5], [1, 1.5]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'presence',
    frames:     [[0, 232], [1, 240]],
    opacity:    [[0, 0.1], [0.3, 0.28], [1, 0.3]],
    brightness: [[0, 0.5], [0.3, 0.7], [1, 0.7]],
    scale:      [[0, 1.05], [1, 1.02]],
    blur:       [[0, 1.5], [0.3, 0.6], [1, 0.6]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'visualizer',
    // Instrument moment. The dial and the line are the subject; the render
    // drops right back so both can actually be read against it. Brightening
    // the render here buries the instrument drawn on top of it.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0.3], [0.25, 0.26], [0.8, 0.26], [1, 0.34]],
    brightness: [[0, 0.7], [0.25, 0.55], [0.8, 0.55], [1, 0.68]],
    scale:      [[0, 1.02], [1, 1.02]],
    blur:       [[0, 0]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'philosophy',
    // Text only. Near-empty black.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0.3], [0.25, 0.06], [0.8, 0.06], [1, 0.12]],
    brightness: [[0, 0.7], [1, 0.5]],
    scale:      [[0, 1.02], [1, 1.03]],
    blur:       [[0, 0.6], [0.25, 1.5], [1, 1.5]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'reassembly',
    // PRODUCT MOMENT. The reveal run backwards, with the same held stages.
    frames: [
      [0, 240], [0.19, 176], [0.21, 176],
      [0.43, 144], [0.45, 144],
      [0.67, 120], [0.69, 120],
      [0.90, 40], [1, 1],
    ],
    opacity:    [[0, 0.12], [0.15, 1], [1, 1]],
    brightness: [[0, 0.5], [0.15, 1], [1, 1]],
    // Settles and holds, then the faintest push at the end.
    scale:      [[0, 1.03], [0.35, 1], [0.82, 1], [1, 1.02]],
    blur:       [[0, 1.5], [0.15, 0], [1, 0]],
    text:       [[0, 0.8], [0.2, 0.28], [0.85, 0.28], [1, 0.6]],
  },
  {
    id: 'finale',
    frames:     [[0, 1], [1, 1]],
    opacity:    [[0, 1], [0.3, 0.62], [1, 0.55]],
    brightness: [[0, 1], [0.3, 0.85], [1, 0.8]],
    scale:      [[0, 1], [1, 1.06]],
    blur:       [[0, 0]],
    text:       [[0, 0.6], [0.25, 1], [1, 1]],
  },
];

export const timelineFor = (id) => TIMELINE.find((t) => t.id === id);
