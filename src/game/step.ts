import { FIXED_DT, MAX_FRAME_DT, MAX_SUBSTEPS } from '@/game/constants';
import { updateCamera } from '@/game/camera';
import { stepEnemies } from '@/game/enemy';
import {
  checkDeath,
  collectPickups,
  stepDeathFx,
  stepDust,
  stepFlyers,
  stepFrog,
  stepHazards,
  stepMovingPlatforms,
} from '@/game/physics';
import { recycleBelow, spawnAhead } from '@/game/spawn';
import { resolveTouch, stepTongue } from '@/game/tongue';
import { FrogState, TongueState, type GameState } from '@/game/types';

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
    state.elapsed += FIXED_DT;

    // Order matters. Platforms move first so a passenger is carried before its
    // own integration; the touch is resolved before the tongue so a hold that
    // just matured fires on this step; while the tongue is pulling it owns the
    // frog's motion outright, so ordinary gravity is skipped; and enemies react
    // after the frog has actually moved, so aggro and attacks see this step's
    // real position, not last step's. Hazards run after enemies so they read
    // this step's already-ticked i-frame timer; flyers run after pickups so a
    // flyer spawned this very step still gets a tick, and death effects run
    // after enemies for the same reason.
    stepMovingPlatforms(state, FIXED_DT);
    resolveTouch(state);
    stepTongue(state, FIXED_DT);
    if (state.tongueState !== TongueState.Pulling) stepFrog(state, FIXED_DT);
    stepEnemies(state, FIXED_DT);
    stepHazards(state);
    collectPickups(state);
    stepFlyers(state, FIXED_DT);
    stepDeathFx(state, FIXED_DT);
    stepDust(state, FIXED_DT);

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
