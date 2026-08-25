import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DESIGN_WIDTH,
  JOYSTICK_BASE_RADIUS,
  JOYSTICK_DEAD_ZONE,
  JOYSTICK_KNOB_RADIUS,
  JOYSTICK_MARGIN_BOTTOM,
  JOYSTICK_MARGIN_X,
} from '@/game/constants';

type MoveJoystickProps = {
  /**
   * Horizontal input axis this stick drives, -1..1. Written directly on the UI
   * thread from the stick's own gesture — no React re-render is involved in
   * moving the frog, same reasoning as every other live-gameplay value in the
   * engine.
   */
  moveAxis: SharedValue<number>;
};

/**
 * Fixed bottom-left stick, horizontal-only, that drives the frog's move axis.
 *
 * Lives in its own view and `GestureDetector`, mounted as a sibling of
 * `GameCanvas` rather than inside its gesture — react-native-gesture-handler
 * routes a touch to whichever view it actually lands on, so a finger that
 * starts here physically never reaches the canvas's own tongue/attack
 * gesture underneath. No exclusivity wiring needed between the two.
 */
export function MoveJoystick({ moveAxis }: MoveJoystickProps) {
  const { width } = useWindowDimensions();
  const scale = width / DESIGN_WIDTH;

  const baseRadius = JOYSTICK_BASE_RADIUS * scale;
  const knobRadius = JOYSTICK_KNOB_RADIUS * scale;
  const travel = baseRadius - knobRadius;
  const deadZone = travel * JOYSTICK_DEAD_ZONE;

  const knobX = useSharedValue(0);

  const gesture = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onBegin(() => {
      'worklet';
      knobX.value = 0;
    })
    .onUpdate((event) => {
      'worklet';
      const clamped = Math.max(-travel, Math.min(travel, event.translationX));
      knobX.value = clamped;

      // `moveAxis` is a SharedValue passed in as a prop; it is a mutable
      // container by design, but the compiler's prop-immutability check has no
      // way to know that — only that it arrived through props. Every write to
      // `.value` below is disabled for the same reason.
      if (Math.abs(clamped) < deadZone) {
        // eslint-disable-next-line react-hooks/immutability
        moveAxis.value = 0;
        return;
      }
      // Rescale past the dead zone so the axis still reaches -1/1 at full
      // travel instead of stalling short of it.
      const sign = clamped > 0 ? 1 : -1;
      moveAxis.value = (sign * (Math.abs(clamped) - deadZone)) / (travel - deadZone);
    })
    .onFinalize(() => {
      'worklet';
      knobX.value = 0;
      // eslint-disable-next-line react-hooks/immutability
      moveAxis.value = 0;
    });

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }],
  }));

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']} pointerEvents="box-none">
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.base,
            {
              width: baseRadius * 2,
              height: baseRadius * 2,
              borderRadius: baseRadius,
              left: JOYSTICK_MARGIN_X * scale - baseRadius,
              bottom: JOYSTICK_MARGIN_BOTTOM * scale - baseRadius,
            },
          ]}>
          <Animated.View
            style={[
              styles.knob,
              {
                width: knobRadius * 2,
                height: knobRadius * 2,
                borderRadius: knobRadius,
              },
              knobStyle,
            ]}
          />
        </Animated.View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    // Full-screen and `pointerEvents="box-none"` on the SafeAreaView above,
    // same convention GameHud uses — only the stick view itself is a touch
    // target, everything else passes through to whatever sits beneath it.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  base: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
});
