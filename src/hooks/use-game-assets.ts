import { Skia, useImageAsTexture, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { GameAssets, Sprite } from '@/game/render';

function toSprite(image: SkImage): Sprite {
  'worklet';
  // The source rect covers the whole image and never changes, so building it once
  // here keeps `width()`/`height()` — both JSI calls — out of the frame loop.
  return { image, src: Skia.XYWHRect(0, 0, image.width(), image.height()) };
}

function collect(images: (SkImage | null)[]): Sprite[] | null {
  'worklet';
  const sprites: Sprite[] = [];
  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    if (!image) return null;
    sprites.push(toSprite(image));
  }
  return sprites;
}

/**
 * Uploads every game texture to the GPU and hands the renderer one bundle.
 *
 * Array order is load-bearing: `frog` is indexed by FrogSprite, `platforms` by
 * PlatformType and `pickups` by PickupType, so the draw loop can index straight
 * off the simulation's own enums with no lookup.
 *
 * Textures are kept as individual images rather than one packed sheet. The
 * renderer only ever sees `{ image, src }`, so moving to a real atlas later is a
 * change to this file alone.
 *
 * `attackSprite` is the equipped Arsenal weapon's attack-pose sprite (a
 * `require()` number, from `Weapon.attackSprite` — see constants/weapons.ts),
 * or the bare-fisted default when nothing is equipped. `useImageAsTexture`
 * reloads whenever its source changes (its `useEffect` is keyed on it), so
 * swapping weapons swaps exactly this one texture — nothing else re-uploads.
 */
export function useGameAssets(attackSprite: number): SharedValue<GameAssets | null> {
  const bg = useImageAsTexture(require('@/assets/images/game/bg.webp'));

  const frogIdle = useImageAsTexture(require('@/assets/images/game/frog/idle.webp'));
  const frogJump = useImageAsTexture(require('@/assets/images/game/frog/jump.webp'));
  const frogFall = useImageAsTexture(require('@/assets/images/game/frog/fall.webp'));
  const frogWallLeft = useImageAsTexture(require('@/assets/images/game/frog/wall-left.webp'));
  const frogWallRight = useImageAsTexture(require('@/assets/images/game/frog/wall-right.webp'));
  const frogTongue = useImageAsTexture(require('@/assets/images/game/frog/tongue.webp'));
  const frogAttack = useImageAsTexture(attackSprite);
  const frogHit = useImageAsTexture(require('@/assets/images/game/frog/hit.webp'));
  const frogDead = useImageAsTexture(require('@/assets/images/game/frog/dead.webp'));
  const frogBouncyHit = useImageAsTexture(require('@/assets/images/game/frog/bouncy-hit.webp'));

  const platLong = useImageAsTexture(require('@/assets/images/game/platforms/long.webp'));
  const platMedium = useImageAsTexture(require('@/assets/images/game/platforms/medium.webp'));
  const platSmall = useImageAsTexture(require('@/assets/images/game/platforms/small.webp'));
  const platWooden = useImageAsTexture(require('@/assets/images/game/platforms/wooden.webp'));
  const platMoving = useImageAsTexture(require('@/assets/images/game/platforms/moving.webp'));
  const platBouncy = useImageAsTexture(require('@/assets/images/game/platforms/bouncy.webp'));
  const platStart = useImageAsTexture(require('@/assets/images/game/platforms/start.webp'));
  const platWall = useImageAsTexture(require('@/assets/images/game/platforms/wall.webp'));
  const platSlope = useImageAsTexture(require('@/assets/images/game/platforms/slope.webp'));
  const platCorner = useImageAsTexture(require('@/assets/images/game/platforms/corner.webp'));
  const platSpikes = useImageAsTexture(require('@/assets/images/game/platforms/hurty.webp'));

  const pickCoin = useImageAsTexture(require('@/assets/images/game/pickups/coin.webp'));
  const pickCrystal = useImageAsTexture(require('@/assets/images/game/pickups/crystal.webp'));
  const pickLife = useImageAsTexture(require('@/assets/images/game/pickups/life.webp'));

  // Enemy order: EnemyType (Swamp, Slime, Mosq) × EnemyPose (Idle, Attack, Dead).
  const swampIdle = useImageAsTexture(require('@/assets/images/game/enemies/swamp-idle.webp'));
  const swampAttack = useImageAsTexture(require('@/assets/images/game/enemies/swamp-attack.webp'));
  const swampDead = useImageAsTexture(require('@/assets/images/game/enemies/swamp-dead.webp'));
  const slimeIdle = useImageAsTexture(require('@/assets/images/game/enemies/slime-idle.webp'));
  const slimeAttack = useImageAsTexture(require('@/assets/images/game/enemies/slime-attack.webp'));
  const slimeDead = useImageAsTexture(require('@/assets/images/game/enemies/slime-dead.webp'));
  const mosqIdle = useImageAsTexture(require('@/assets/images/game/enemies/mosq-idle.webp'));
  const mosqAttack = useImageAsTexture(require('@/assets/images/game/enemies/mosq-attack.webp'));
  const mosqDead = useImageAsTexture(require('@/assets/images/game/enemies/mosq-dead.webp'));

  return useDerivedValue<GameAssets | null>(() => {
    const bgImage = bg.value;
    if (!bgImage) return null;

    const frog = collect([
      frogIdle.value,
      frogJump.value,
      frogFall.value,
      frogWallLeft.value,
      frogWallRight.value,
      frogTongue.value,
      frogAttack.value,
      frogHit.value,
      frogDead.value,
      frogBouncyHit.value,
    ]);
    const platforms = collect([
      platLong.value,
      platMedium.value,
      platSmall.value,
      platWooden.value,
      platMoving.value,
      platBouncy.value,
      platStart.value,
      platWall.value,
      platSlope.value,
      platCorner.value,
      platSpikes.value,
    ]);
    const pickups = collect([pickCoin.value, pickCrystal.value, pickLife.value]);
    const enemies = collect([
      swampIdle.value,
      swampAttack.value,
      swampDead.value,
      slimeIdle.value,
      slimeAttack.value,
      slimeDead.value,
      mosqIdle.value,
      mosqAttack.value,
      mosqDead.value,
    ]);

    if (!frog || !platforms || !pickups || !enemies) return null;

    return { bg: toSprite(bgImage), frog, platforms, pickups, enemies };
  });
}
