import { Image } from 'expo-image';
import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { WHEEL_SEGMENT_COUNT } from '@/components/wheel/segments';

/** Wedge count baked into sectors.webp — each wedge is exactly this many degrees wide. */
const SEGMENT_ANGLE = 360 / WHEEL_SEGMENT_COUNT;
const FULL_SPINS = 6;
const SPIN_DURATION_MS = 4200;

export type FortuneWheelHandle = {
  /** Spins to the given segment index and calls onLanded once the wheel stops. */
  spin: (index: number, onLanded: () => void) => void;
};

type FortuneWheelProps = {
  /** Width of the bamboo ring; the wheel's overall footprint scales from this. */
  size: number;
};

export const FortuneWheel = forwardRef<FortuneWheelHandle, FortuneWheelProps>(function FortuneWheel(
  { size },
  ref
) {
  const rotation = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    spin: (index, onLanded) => {
      const currentMod = ((rotation.value % 360) + 360) % 360;
      const targetMod = (360 - index * SEGMENT_ANGLE) % 360;
      const delta = (targetMod - currentMod + 360) % 360;
      rotation.value = withTiming(
        rotation.value + FULL_SPINS * 360 + delta,
        { duration: SPIN_DURATION_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onLanded)();
        }
      );
    },
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const ringTop = size * (12 / 382);
  const ringSize = size;
  const sectorsSize = size * (322 / 382);
  const sectorsOffset = (ringSize - sectorsSize) / 2;
  const pointerWidth = size * (35 / 382);
  const pointerHeight = size * (70 / 382);

  return (
    <View style={{ width: size, height: ringTop + ringSize }}>
      <Image
        source={require('@/assets/images/wheel/ring.webp')}
        style={{ position: 'absolute', top: ringTop, left: 0, width: ringSize, height: ringSize }}
        contentFit="contain"
      />

      <Animated.View
        style={[
          {
            position: 'absolute',
            top: ringTop + sectorsOffset,
            left: sectorsOffset,
            width: sectorsSize,
            height: sectorsSize,
          },
          spinStyle,
        ]}>
        <Image
          source={require('@/assets/images/wheel/sectors.webp')}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
      </Animated.View>

      {/* Rendered last so it stays on top of the ring and the spinning disc. */}
      <Image
        source={require('@/assets/images/wheel/pointer.webp')}
        style={{
          position: 'absolute',
          top: 0,
          left: (size - pointerWidth) / 2,
          width: pointerWidth,
          height: pointerHeight,
        }}
        contentFit="contain"
      />
    </View>
  );
});
