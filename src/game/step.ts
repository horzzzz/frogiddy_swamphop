import { FIXED_DT, MAX_FRAME_DT, MAX_SUBSTEPS } from '@/game/constants';
import { updateCamera } from '@/game/camera';
import { checkDeath, collectPickups, stepPhysics } from '@/game/physics';
import { recycleBelow, spawnAhead } from '@/game/spawn';
import { FrogState, type GameState } from '@/game/types';

/**
 * Advances the world by one rendered frame.
 *
 * Physics runs on a fixed step regardless of the display's refresh rate, so the
 * jump arc is identical at 60 and 120 Hz. Camera, generation and recycling run
 * once per frame — they are smoothing and bookkeeping, and gain nothing from
 * substepping.
 */
export function advance(state: GameState, frameDt: number) {
  'worklet';
  if (state.frogState === FrogState.Dead) return;

  // A hitch (backgrounded app, GC pause) is clamped rather than replayed: better
  // to lose a moment of simulation than to hand the player a teleporting frog.
  const dt = Math.min(frameDt, MAX_FRAME_DT);
  state.accumulator += dt;

  let steps = 0;
  while (state.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
    stepPhysics(state, FIXED_DT);
    collectPickups(state);
    state.accumulator -= FIXED_DT;
    steps += 1;
  }

  // Hitting the substep ceiling means we are behind. Dropping the backlog keeps
  // one slow frame from cascading into the next.
  if (steps === MAX_SUBSTEPS) state.accumulator = 0;

  updateCamera(state, dt);
  spawnAhead(state);
  recycleBelow(state);
  checkDeath(state);
}
