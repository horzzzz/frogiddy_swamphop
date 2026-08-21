import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Menu } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MenuTileProps = {
  icon: number;
  label: string;
  onPress?: () => void;
};

export function MenuTile({ icon, label, onPress }: MenuTileProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.05 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
      style={[styles.container, animatedStyle]}>
      <Image
        source={require('@/assets/images/menu/panel-tile.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
      />
      <Image source={icon} style={styles.icon} contentFit="contain" />
      <Text style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 8,
    gap: 8,
    maxHeight: 118,
  },
  icon: {
    width: 62,
    height: 62,
  },
  label: {
    fontSize: 12,
    fontWeight: '400',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
});
