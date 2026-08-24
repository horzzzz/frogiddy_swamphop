import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Menu } from '@/constants/theme';
import type { Weapon } from '@/constants/weapons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type WeaponCardProps = {
  weapon: Weapon;
  owned: boolean;
  canAfford: boolean;
  onBuy: () => void;
};

/** One row in the Arsenal list: icon, name, description, and a buy button. */
export function WeaponCard({ weapon, owned, canAfford, onBuy }: WeaponCardProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Image source={weapon.icon} style={styles.icon} contentFit="contain" />
        </View>
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {weapon.name}
          </Text>
          <Text style={styles.description}>{weapon.description}</Text>
        </View>
      </View>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={owned ? `${weapon.name} owned` : `Buy ${weapon.name}`}
        accessibilityState={{ disabled: owned }}
        disabled={owned}
        onPress={onBuy}
        onPressIn={() => !owned && (pressed.value = withTiming(1, { duration: 80 }))}
        onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
        style={[styles.button, animatedStyle, { opacity: owned ? 0.5 : canAfford ? 1 : 0.85 }]}>
        <Image
          source={require('@/assets/images/menu/btn-green.webp')}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
        />
        {owned ? (
          <Text style={styles.price}>Owned</Text>
        ) : (
          <>
            <Text style={styles.price}>{weapon.price}</Text>
            <Image
              source={require('@/assets/images/menu/icon-blu.webp')}
              style={styles.priceIcon}
              contentFit="contain"
            />
          </>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 64,
    aspectRatio: 112 / 140,
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  text: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: Menu.textPrimary,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  button: {
    width: '100%',
    height: 56,
    overflow: 'hidden',
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    color: Menu.textPrimary,
  },
  priceIcon: {
    width: 22,
    height: 22,
  },
});
