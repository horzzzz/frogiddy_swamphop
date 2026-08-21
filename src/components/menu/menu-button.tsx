import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Menu } from '@/constants/theme';

/** Width:height ratio every menu button is locked to, regardless of its content. */
const BUTTON_ASPECT_RATIO = 3.2;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CommonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

type MenuButtonProps =
  | (CommonProps & {
      locked?: false;
    })
  | (CommonProps & {
      locked: true;
      hint: string;
      hintIcon: number;
    });

export function MenuButton(props: MenuButtonProps) {
  const { label, onPress, disabled = false } = props;
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  const content = !props.locked ? (
    <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
      {label}
    </Text>
  ) : (
    <>
      <Image source={require('@/assets/images/menu/icon-lock.webp')} style={styles.lock} contentFit="contain" />
      <View style={styles.lockedCenter}>
        <Text style={styles.lockedTitle}>{label}</Text>
        <View style={styles.hintRow}>
          <Text style={styles.hint}>{props.hint}</Text>
          <Image source={props.hintIcon} style={styles.hintIcon} contentFit="contain" />
        </View>
      </View>
      <Image source={require('@/assets/images/menu/icon-lock.webp')} style={styles.lock} contentFit="contain" />
    </>
  );

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
      style={[
        styles.container,
        props.locked && styles.locked,
        animatedStyle,
        { opacity: disabled ? 0.5 : 1 },
      ]}>
      <Image
        source={require('@/assets/images/menu/btn-green.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
      />
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: BUTTON_ASPECT_RATIO,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  locked: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  lock: {
    width: 48,
    height: 48,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  lockedCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  lockedTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hint: {
    fontSize: 14,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  hintIcon: {
    width: 20,
    height: 20,
  },
});
