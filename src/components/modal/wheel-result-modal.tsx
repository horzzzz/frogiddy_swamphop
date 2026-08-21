import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { GameModal } from '@/components/modal/game-modal';
import { MenuButton } from '@/components/menu/menu-button';
import { Menu } from '@/constants/theme';
import type { WheelSegment } from '@/components/wheel/segments';

const CONTENT_WIDTH = 320;

type WheelResultModalProps = {
  visible: boolean;
  segment: WheelSegment | null;
  onClose: () => void;
};

export function WheelResultModal({ visible, segment, onClose }: WheelResultModalProps) {
  if (!segment) return null;

  const title = segment.kind === 'fail' ? 'Bad luck!' : 'You won!';

  return (
    <GameModal visible={visible} title={title} onClose={onClose}>
      {segment.kind === 'coins' && (
        <View style={styles.amountRow}>
          <Image
            source={require('@/assets/images/menu/icon-coin.webp')}
            style={styles.coinIcon}
            contentFit="contain"
          />
          <Text style={styles.amount}>{segment.amount}</Text>
        </View>
      )}

      {segment.kind === 'free-spins' && (
        <View style={styles.amountRow}>
          <Image
            source={require('@/assets/images/menu/icon-wheel.webp')}
            style={styles.coinIcon}
            contentFit="contain"
          />
          <Text style={styles.amount}>{segment.amount} spins</Text>
        </View>
      )}

      {segment.kind === 'fail' && <Text style={styles.failText}>Nothing this time — try again tomorrow!</Text>}

      <View style={styles.button}>
        <MenuButton label="Continue" onPress={onClose} />
      </View>
    </GameModal>
  );
}

const styles = StyleSheet.create({
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coinIcon: {
    width: 40,
    height: 40,
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  failText: {
    fontSize: 18,
    fontWeight: '400',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  button: {
    width: CONTENT_WIDTH,
  },
});
