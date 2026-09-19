/* The timeline — one continuous shot, choreographed as story beats.

   Each act declares, as piecewise stops over its own scroll progress:

     frames     which still is on screen. Flat segments are deliberate holds,
                which is what turns the disassembly into a staged engineering
                reveal instead of everything flying apart at once.
     opacity / brightness / scale
                the film itself.
     text       opacity of that act's typography.

   Optional channels:

     aim + pull a point in art space the camera travels towards, and how far
                (0 = the plain camera, so aiming eases in with no jump).
     cue        a named lighting moment, see film/cues.js.
     field      intensity of the ambient sound field around the product.
     studio     how much this moment invites the pointer-led key light.

   The rule the whole page obeys: product and text are never both fully
   present. One leads, the other recedes — through opacity and brightness.
   There is no blur: a live filter on the full-screen film cost an extra
   compositing pass every frame, and at the opacities where it was used
   (a backdrop at 12–30%) the 1.5px of defocus was not visible.

   The emotional arc the acts are ordered around:
     curiosity → discovery → energy → engineering → immersion → silence
     → reveal → desire */

export const TIMELINE = [
  {
    id: 'hero',
    // CURIOSITY. Almost still. The opening should breathe, not move.
    frames:     [[0, 1], [1, 22]],
    opacity:    [[0, 1], [0.30, 1], [0.66, 0.5]],
    brightness: [[0, 1], [0.30, 1], [0.66, 0.78]],
    scale:      [[0, 1.05], [0.5, 1], [1, 1]],
    text:       [[0, 1], [1, 1]],
    field:      [[0, 0.3], [0.6, 0.18], [1, 0.12]],
    studio:     [[0, 0.8], [0.6, 0.3]],
  },
  {
    id: 'form',
    // DISCOVERY. Text leads. The product sits back and dims, but stays legible.
    frames:     [[0, 22], [1, 80]],
    opacity:    [[0, 0.5], [0.2, 0.3], [0.8, 0.3], [1, 0.55]],
    brightness: [[0, 0.8], [0.2, 0.62], [0.8, 0.62], [1, 0.8]],
    scale:      [[0, 1], [1, 1.015]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'energy',
    // ENERGY — the power-up. The product goes, a point of light remains,
    // it becomes waves, the waves collapse into one acoustic ring, and the
    // ring releases outward with the product formed inside it. The film is
    // invisible from 0.3 until the ring releases at 0.78, where it cuts in
    // behind a shade that only lets the inside of the ring through.
    frames:     [[0, 80], [0.3, 86], [0.78, 88], [1, 88]],
    opacity:    [[0, 0.55], [0.3, 0], [0.779, 0], [0.78, 1], [1, 1]],
    // Silhouette first, then lit.
    brightness: [[0, 0.8], [0.3, 0.6], [0.78, 0.18], [0.92, 0.7], [1, 1]],
    scale:      [[0, 1.015], [1, 1.04]],
    text:       [[0, 1], [0.52, 1], [0.64, 0], [1, 0]],
    cue:        'powerup',
  },
  {
    id: 'explode',
    // ENGINEERING. Staged disassembly with a settle at every stage, and the
    // typography pulled right back so the engineering can be read. Once the
    // assembly is fully open, its components can be put under the light.
    frames: [
      [0, 88], [0.17, 104], [0.19, 104],   // outer shell, settles
      [0.39, 124], [0.41, 124],            // structure, settles
      [0.61, 144], [0.63, 144],            // internals, settles
      [0.86, 168], [1, 176],               // full configuration
    ],
    opacity:    [[0, 1]],
    brightness: [[0, 1]],
    // Push in, then the camera stops entirely for the middle of the act.
    scale:      [[0, 1.04], [0.25, 1], [0.78, 1], [1, 0.99]],
    text:       [[0, 0.7], [0.14, 0.3], [0.9, 0.3], [1, 0.5]],
    cue:        'spotlight',
    field:      [[0, 0.5], [0.2, 0.75], [1, 0.7]],
    studio:     [[0, 0.8]],
  },
  {
    id: 'purpose',
    // Text leads again, one statement at a time — then hands straight back
    // to the product for the move into the crown ring.
    frames:     [[0, 176], [1, 214]],
    opacity:    [[0, 1], [0.16, 0.42], [0.84, 0.42], [1, 1]],
    brightness: [[0, 1], [0.16, 0.7], [0.84, 0.7], [1, 1]],
    scale:      [[0, 0.99], [0.84, 1.01], [1, 1.04]],
    text:       [[0, 0.5], [0.16, 1], [0.84, 1], [1, 0.35]],
    field:      [[0, 0.4], [1, 0.25]],
  },
  {
    id: 'system',
    // IMMERSION, by way of the one transition nobody expects. Shadow closes
    // in until only the crown ring remains; the camera travels into it; its
    // circle leaves as a wave; the wave clears the frame for the gallery.
    // The film is dark by the time the camera snaps back at 0.4.
    // Held through the zoom: at 2.4x, every small frame change would be
    // magnified into a visible pop. It resumes once the frame is dark.
    frames:     [[0, 214], [0.46, 214], [1, 232]],
    aim:        [0.5, 0.078],
    pull:       [[0, 0], [0.06, 0], [0.22, 0.8], [0.34, 1], [0.4, 1], [0.4, 0], [1, 0]],
    scale:      [[0, 1.04], [0.06, 1.04], [0.34, 2.4], [0.4, 2.4], [0.4, 1.06], [1, 1.05]],
    opacity:    [[0, 1], [0.3, 1], [0.38, 0], [0.46, 0], [0.56, 0.16], [1, 0.12]],
    brightness: [[0, 1], [0.4, 0.8], [0.56, 0.5], [1, 0.45]],
    text:       [[0, 0], [0.44, 0], [0.54, 1], [1, 1]],
    cue:        'focus',
  },
  {
    id: 'presence',
    frames:     [[0, 232], [1, 240]],
    opacity:    [[0, 0.1], [0.3, 0.28], [1, 0.3]],
    brightness: [[0, 0.5], [0.3, 0.7], [1, 0.7]],
    scale:      [[0, 1.05], [1, 1.02]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'visualizer',
    // Instrument moment. The dial and the line are the subject; the render
    // drops right back so both can be read. It goes fully dark at the end,
    // handing over to silence.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0.3], [0.25, 0.26], [0.8, 0.26], [1, 0]],
    brightness: [[0, 0.7], [0.25, 0.55], [0.8, 0.55], [1, 0.6]],
    scale:      [[0, 1.02], [1, 1.02]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'silence',
    // SILENCE. Nothing moves. The absence is the point. Its two lines are
    // paced by ui/beats.js, far slower than anything else on the page.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0]],
    brightness: [[0, 0.6]],
    scale:      [[0, 1.02]],
    text:       [[0, 1]],
  },
  {
    id: 'philosophy',
    // Text only. Near-empty black.
    frames:     [[0, 240], [1, 240]],
    opacity:    [[0, 0], [0.3, 0.06], [0.8, 0.06], [1, 0.12]],
    brightness: [[0, 0.6], [1, 0.5]],
    scale:      [[0, 1.02], [1, 1.03]],
    text:       [[0, 1], [1, 1]],
  },
  {
    id: 'reassembly',
    // PRODUCT MOMENT. The disassembly run backwards with the same held
    // stages, ending on the assembled pose the reveal is built around.
    frames: [
      [0, 240], [0.19, 176], [0.21, 176],
      [0.43, 144], [0.45, 144],
      [0.67, 120], [0.69, 120],
      [1, 72],
    ],
    opacity:    [[0, 0.12], [0.15, 1], [1, 1]],
    brightness: [[0, 0.5], [0.15, 1], [1, 1]],
    // Settles and holds, then the faintest push at the end.
    scale:      [[0, 1.03], [0.35, 1], [0.82, 1], [1, 1.02]],
    text:       [[0, 0.8], [0.2, 0.28], [0.85, 0.28], [1, 0.6]],
    field:      [[0, 0], [0.2, 0.7], [1, 0.6]],
    studio:     [[0, 0.8]],
  },
  {
    id: 'reveal',
    // REVEAL. Everything goes dark, and a light travels the finished product
    // — head, then body, then everything — while the line arrives. The
    // headline recedes again once the product is fully lit.
    frames:     [[0, 72], [1, 68]],
    opacity:    [[0, 1]],
    brightness: [[0, 1], [0.14, 0.85], [1, 1]],
    scale:      [[0, 1.02], [0.14, 1], [1, 1.03]],
    text:       [[0, 0], [0.42, 0], [0.56, 1], [0.72, 1], [0.84, 0.55], [1, 0.55]],
    cue:        'reveal',
    field:      [[0, 0], [0.84, 0], [1, 0.5]],
    studio:     [[0, 0], [0.86, 0], [1, 0.8]],
  },
  {
    id: 'finale',
    // DESIRE. The hands close back over the face — the opening shot, in
    // reverse, as the last frame of the film.
    frames:     [[0, 68], [1, 1]],
    opacity:    [[0, 1], [0.3, 0.62], [1, 0.55]],
    brightness: [[0, 1], [0.3, 0.85], [1, 0.8]],
    scale:      [[0, 1.03], [1, 1.08]],
    text:       [[0, 0.6], [0.25, 1], [1, 1]],
    field:      [[0, 0.5], [1, 0.35]],
    studio:     [[0, 0.8], [0.3, 0.4]],
  },
];

export const timelineFor = (id) => TIMELINE.find((t) => t.id === id);
