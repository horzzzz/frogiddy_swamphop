import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Menu } from '@/constants/theme';
import { WEAPONS, type Weapon } from '@/constants/weapons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type WeaponCardProps = {
  weapon: Weapon;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
};

/** Segment count for the reach meter — one per rung of the Arsenal's price ladder. */
const REACH_TIERS = WEAPONS.length;

/** How far up the WEAPONS price ladder this weapon sits, filled left to right. */
function ReachMeter({ weapon }: { weapon: Weapon }) {
  const tier = WEAPONS.findIndex((candidate) => candidate.id === weapon.id);
  const filled = tier + 1;

  return (
    <View style={styles.reachRow}>
      <Text style={styles.reachLabel}>Reach</Text>
      <View style={styles.reachMeter}>
        {Array.from({ length: REACH_TIERS }, (_, i) => (
          <View key={i} style={[styles.reachSegment, i < filled && styles.reachSegmentFilled]} />
        ))}
      </View>
    </View>
  );
}

/** One row in the Arsenal list: icon, name, description, reach, and a buy/equip button. */
export function WeaponCard({ weapon, owned, equipped, canAfford, onBuy, onEquip }: WeaponCardProps) {
  const pressed = useSharedValue(0);
  const disabled = equipped;

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
          <ReachMeter weapon={weapon} />
        </View>
      </View>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={equipped ? `${weapon.name} equipped` : owned ? `Equip ${weapon.name}` : `Buy ${weapon.name}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={owned ? onEquip : onBuy}
        onPressIn={() => !disabled && (pressed.value = withTiming(1, { duration: 80 }))}
        onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
        style={[styles.button, animatedStyle, { opacity: equipped ? 0.5 : canAfford || owned ? 1 : 0.85 }]}>
        <Image
          source={require('@/assets/images/menu/btn-green.webp')}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
        />
        {equipped ? (
          <Text style={styles.price}>Equipped</Text>
        ) : owned ? (
          <Text style={styles.price}>Equip</Text>
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
  reachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  reachLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
  },
  reachMeter: {
    flexDirection: 'row',
    gap: 3,
  },
  reachSegment: {
    width: 10,
    height: 5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  reachSegmentFilled: {
    backgroundColor: '#8BC34A',
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
