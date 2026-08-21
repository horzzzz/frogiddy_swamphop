import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GameModal } from '@/components/modal/game-modal';
import { MenuButton } from '@/components/menu/menu-button';
import { Menu } from '@/constants/theme';
import { cooldownRemaining, DAILY_BONUS_AMOUNT, DAILY_BONUS_COOLDOWN_MS, useEconomy } from '@/state/economy';

const CONTENT_WIDTH = 320;

type DailyBonusModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function DailyBonusModal({ visible, onClose }: DailyBonusModalProps) {
  const { lastDailyBonusAt, claimDailyBonus } = useEconomy();
  const [remaining, setRemaining] = useState(() => cooldownRemaining(lastDailyBonusAt, DAILY_BONUS_COOLDOWN_MS));

  useEffect(() => {
    if (!visible) return;
    setRemaining(cooldownRemaining(lastDailyBonusAt, DAILY_BONUS_COOLDOWN_MS));
    const timer = setInterval(
      () => setRemaining(cooldownRemaining(lastDailyBonusAt, DAILY_BONUS_COOLDOWN_MS)),
      1000
    );
    return () => clearInterval(timer);
  }, [visible, lastDailyBonusAt]);

  const ready = remaining === 0;

  const handleClaim = () => {
    if (!ready) return;
    claimDailyBonus();
    onClose();
  };

  return (
    <GameModal visible={visible} title="Daily Bonus!" onClose={onClose}>
      <Image
        source={require('@/assets/images/modal/chest-sparkle.webp')}
        style={styles.chestScene}
        contentFit="contain"
      />

      <View style={styles.infoPlate}>
        <Text style={styles.infoText}>
          {ready ? 'We give you daily bonus!' : 'Come back tomorrow for more!'}
        </Text>
        <View style={styles.amountRow}>
          <Image
            source={require('@/assets/images/menu/icon-coin.webp')}
            style={styles.coinIcon}
            contentFit="contain"
          />
          <Text style={styles.amount}>{DAILY_BONUS_AMOUNT}</Text>
        </View>
      </View>

      <View style={styles.claimButton}>
        <MenuButton label={ready ? 'Claim' : 'Claimed'} onPress={handleClaim} disabled={!ready} />
      </View>
    </GameModal>
  );
}

const styles = StyleSheet.create({
  chestScene: {
    width: 250,
    height: 250,
  },
  infoPlate: {
    width: CONTENT_WIDTH,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 20,
    fontWeight: '400',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coinIcon: {
    width: 33,
    height: 32,
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  claimButton: {
    width: CONTENT_WIDTH,
  },
});
