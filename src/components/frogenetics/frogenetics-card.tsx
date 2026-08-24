import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { FROGENETICS_MAX_LEVEL, upgradePrice, type FrogeneticsUpgrade } from '@/constants/frogenetics';
import { Menu } from '@/constants/theme';
import { playSfx } from '@/services/audio';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type FrogeneticsCardProps = {
  upgrade: FrogeneticsUpgrade;
  level: number;
  canAfford: boolean;
  onBuy: () => void;
};

/** One row in the Frogenetics list: icon, level, name, stat, and a buy button that levels it up. */
export function FrogeneticsCard({ upgrade, level, canAfford, onBuy }: FrogeneticsCardProps) {
  const pressed = useSharedValue(0);
  const maxed = level >= FROGENETICS_MAX_LEVEL;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Image source={upgrade.icon} style={styles.icon} contentFit="contain" />
        </View>
        <View style={styles.text}>
          <Text style={styles.level}>{`Level ${level}`}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {upgrade.name}
          </Text>
          <Text style={styles.description}>{upgrade.description}</Text>
          <Text style={styles.value}>{upgrade.formatValue(level)}</Text>
        </View>
      </View>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={maxed ? `${upgrade.name} maxed out` : `Upgrade ${upgrade.name}`}
        accessibilityState={{ disabled: maxed }}
        disabled={maxed}
        onPress={() => {
          playSfx('click');
          onBuy();
        }}
        onPressIn={() => !maxed && (pressed.value = withTiming(1, { duration: 80 }))}
        onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
        style={[styles.button, animatedStyle, { opacity: maxed ? 0.5 : canAfford ? 1 : 0.85 }]}>
        <Image
          source={require('@/assets/images/menu/btn-green.webp')}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
        />
        {maxed ? (
          <Text style={styles.price}>MAX</Text>
        ) : (
          <>
            <Text style={styles.price}>{upgradePrice(level)}</Text>
            <Image
              source={require('@/assets/images/menu/icon-coin.webp')}
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
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 78,
    height: 78,
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  text: {
    gap: 4,
    justifyContent: 'center',
  },
  level: {
    fontSize: 12,
    color: Menu.textPrimary,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Menu.textPrimary,
  },
  description: {
    fontSize: 12,
    color: Menu.textPrimary,
  },
  value: {
    fontSize: 14,
    color: Menu.textPrimary,
  },
  button: {
    width: 90,
    height: 78,
    overflow: 'hidden',
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: Menu.textPrimary,
  },
  priceIcon: {
    width: 24,
    height: 24,
  },
});
