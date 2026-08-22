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
 */
export function useGameAssets(): SharedValue<GameAssets | null> {
  const bg = useImageAsTexture(require('@/assets/images/game/bg.png'));

  const frogIdle = useImageAsTexture(require('@/assets/images/game/frog/idle.png'));
  const frogJump = useImageAsTexture(require('@/assets/images/game/frog/jump.png'));
  const frogFall = useImageAsTexture(require('@/assets/images/game/frog/fall.png'));
  const frogWallLeft = useImageAsTexture(require('@/assets/images/game/frog/wall-left.png'));
  const frogWallRight = useImageAsTexture(require('@/assets/images/game/frog/wall-right.png'));
  const frogTongue = useImageAsTexture(require('@/assets/images/game/frog/tongue.png'));
  const frogAttack = useImageAsTexture(require('@/assets/images/game/frog/attack.png'));
  const frogHit = useImageAsTexture(require('@/assets/images/game/frog/hit.png'));
  const frogDead = useImageAsTexture(require('@/assets/images/game/frog/dead.png'));
  const frogBouncyHit = useImageAsTexture(require('@/assets/images/game/frog/bouncy-hit.png'));

  const platLong = useImageAsTexture(require('@/assets/images/game/platforms/long.png'));
  const platMedium = useImageAsTexture(require('@/assets/images/game/platforms/medium.png'));
  const platSmall = useImageAsTexture(require('@/assets/images/game/platforms/small.png'));
  const platWooden = useImageAsTexture(require('@/assets/images/game/platforms/wooden.png'));
  const platMoving = useImageAsTexture(require('@/assets/images/game/platforms/moving.png'));
  const platBouncy = useImageAsTexture(require('@/assets/images/game/platforms/bouncy.png'));
  const platStart = useImageAsTexture(require('@/assets/images/game/platforms/start.png'));
  const platWall = useImageAsTexture(require('@/assets/images/game/platforms/wall.png'));
  const platSlope = useImageAsTexture(require('@/assets/images/game/platforms/slope.png'));
  const platCorner = useImageAsTexture(require('@/assets/images/game/platforms/corner.png'));

  const pickCoin = useImageAsTexture(require('@/assets/images/game/pickups/coin.png'));
  const pickCrystal = useImageAsTexture(require('@/assets/images/game/pickups/crystal.png'));
  const pickLife = useImageAsTexture(require('@/assets/images/game/pickups/life.png'));

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
    ]);
    const pickups = collect([pickCoin.value, pickCrystal.value, pickLife.value]);

    if (!frog || !platforms || !pickups) return null;

    return { bg: toSprite(bgImage), frog, platforms, pickups };
  });
}
