/* Quality governor — protects the film when the device is struggling.

   Priorities, highest first:
     1  the image sequence              never degraded
     2  typography and its focus shift  never degraded
     3  interaction (hotspots, callout) never degraded
     4  ambient (sound field, studio light, cursor halo)
     5  decoration (grain movement)

   The governor watches real frame pacing. If a large share of frames in a
   window arrive late, it steps quality down one level, shedding priority 5
   and then priority 4 work. It steps back up only after a long run of good
   windows, so it cannot flicker between levels.

     level 2   everything
     level 1   ambient reduced: fewer motes, no studio light, grain still
     level 0   ambient off

   Phones start at level 1: the same film, with lighter atmosphere. */

import { onTick } from './ticker.js';

/** A frame counts as late past this — two-thirds of a 60Hz frame over. */
const LATE_FRAME_MS = 26;
const WINDOW_MS = 600;
/** Share of late frames in a window that means sustained pressure. */
const DEGRADE_AT = 0.35;
/** Good windows in a row needed before stepping back up. */
const RECOVER_AFTER = 8;

export const quality = { level: 2, max: 2 };

export function initQuality() {
  const narrow = innerWidth < 860;
  quality.max = narrow ? 1 : 2;
  quality.level = quality.max;
  document.documentElement.dataset.quality = String(quality.level);

  let elapsed = 0;
  let frames = 0;
  let late = 0;
  let calm = 0;

  const set = (level) => {
    if (level === quality.level) return;
    quality.level = level;
    document.documentElement.dataset.quality = String(level);
  };

  onTick((dt) => {
    // The ticker caps dt at 64ms after a stall (tab switch, first paint);
    // those are not evidence of steady pressure.
    if (dt >= 64) return;
    frames += 1;
    if (dt > LATE_FRAME_MS) late += 1;
    elapsed += dt;
    if (elapsed < WINDOW_MS) return;

    const share = late / frames;
    if (share > DEGRADE_AT && quality.level > 0) {
      set(quality.level - 1);
      calm = 0;
    } else if (share < 0.05) {
      calm += 1;
      if (calm >= RECOVER_AFTER && quality.level < quality.max) {
        set(quality.level + 1);
        calm = 0;
      }
    } else {
      calm = 0;
    }
    elapsed = 0;
    frames = 0;
    late = 0;
  }, { phase: 'read' });
}
