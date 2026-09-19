/* Engineering marker — the crosshair, hairlines and figure label that
   annotate the crown ring as it is isolated at the start of Act 06.
   Positioned from film/cues.js; this only writes what changed. */

export function initMarker(el) {
  if (!el) return () => {};
  let last = '';

  return (marker) => {
    const opacity = marker ? marker.opacity : 0;
    const key = marker
      ? `${opacity.toFixed(3)}|${Math.round(marker.x)}|${Math.round(marker.y)}|${Math.round(marker.r)}`
      : 'off';
    if (key === last) return;
    last = key;

    el.style.opacity = opacity.toFixed(3);
    if (!marker) return;
    el.style.transform = `translate3d(${marker.x.toFixed(1)}px, ${marker.y.toFixed(1)}px, 0)`;
    // Sized rather than scaled: scaling would thicken the 1px border with it.
    // It is one small absolutely-positioned box, live for a fraction of one
    // act, so the layout it costs is negligible.
    el.style.setProperty('--r', `${marker.r.toFixed(1)}px`);
  };
}
