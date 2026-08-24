import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Menu } from '@/constants/theme';
import { playSfx } from '@/services/audio';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TopBarProps = {
  title: string;
  onBack: () => void;
};

/** Shared header from the Figma design system — a centered title with a back arrow, used on every screen past the menu. */
export function TopBar({ title, onBack }: TopBarProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.1 }],
  }));

  return (
    <View style={styles.container}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => {
          playSfx('click');
          onBack();
        }}
        onPressIn={() => (pressed.value = withTiming(1, { duration: 80 }))}
        onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
        style={[styles.back, animatedStyle]}>
        <Image source={require('@/assets/images/ui/icon-back.webp')} style={styles.backIcon} contentFit="contain" />
      </AnimatedPressable>
      <Text style={styles.title} numberOfLines={1}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    left: 0,
    width: 36,
    height: 36,
  },
  backIcon: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: 'BlackHanSans_400Regular',
    fontSize: 24,
    color: Menu.textPrimary,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
