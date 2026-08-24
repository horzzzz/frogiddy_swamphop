import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { playSfx } from '@/services/audio';

const TRACK_WIDTH = 42;
const TRACK_HEIGHT = 22;
const THUMB_SIZE = 14;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - 4 * 2;

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
};

/** Green pill switch from the Figma design system — no slider variant, on/off only. */
export function Toggle({ value, onValueChange, accessibilityLabel }: ToggleProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 150 });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + progress.value * 0.5,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * THUMB_TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => {
        playSfx('click');
        onValueChange(!value);
      }}
      hitSlop={8}>
      <Animated.View style={[styles.track, trackStyle]}>
        <LinearGradient colors={['#708B25', '#3A5012']} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    marginLeft: 4,
  },
});
