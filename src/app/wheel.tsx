import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/menu-button';
import { SwampBackground } from '@/components/menu/swamp-background';
import { WheelResultModal } from '@/components/modal/wheel-result-modal';
import { TopBar } from '@/components/top-bar';
import { FortuneWheel, type FortuneWheelHandle } from '@/components/wheel/fortune-wheel';
import { pickSegmentIndex, WHEEL_SEGMENTS, type WheelSegment } from '@/components/wheel/segments';
import { Menu } from '@/constants/theme';
import { startWheelSpin, stopWheelSpin } from '@/services/audio';
import { cooldownRemaining, useEconomy, WHEEL_SPIN_COOLDOWN_MS } from '@/state/economy';

function formatRemaining(ms: number) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `Wait ${hours}h ${minutes}m`;
}

export default function Wheel() {
  const router = useRouter();
  const { freeSpins, lastWheelSpinAt, spinWheel, addCoins, grantFreeSpins } = useEconomy();
  const wheelRef = useRef<FortuneWheelHandle>(null);
  const { width: windowWidth } = useWindowDimensions();
  const wheelSize = Math.min(windowWidth, Menu.frameWidth) - 48;

  const [remaining, setRemaining] = useState(() => cooldownRemaining(lastWheelSpinAt, WHEEL_SPIN_COOLDOWN_MS));
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelSegment | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    setRemaining(cooldownRemaining(lastWheelSpinAt, WHEEL_SPIN_COOLDOWN_MS));
    const timer = setInterval(() => setRemaining(cooldownRemaining(lastWheelSpinAt, WHEEL_SPIN_COOLDOWN_MS)), 1000);
    return () => clearInterval(timer);
  }, [lastWheelSpinAt]);

  // Leaving mid-spin skips the landing callback, so the ratchet has to be
  // stopped here as well or it would keep ticking on the menu.
  useEffect(() => stopWheelSpin, []);

  const canSpin = !spinning && (freeSpins > 0 || remaining === 0);

  const handleSpin = () => {
    if (!canSpin) return;
    if (!spinWheel()) return;

    const index = pickSegmentIndex();
    setSpinning(true);
    startWheelSpin();
    wheelRef.current?.spin(index, () => {
      stopWheelSpin();
      const segment = WHEEL_SEGMENTS[index];
      if (segment.kind === 'coins') addCoins(segment.amount);
      if (segment.kind === 'free-spins') grantFreeSpins(segment.amount);
      setSpinning(false);
      setResult(segment);
      setShowResult(true);
    });
  };

  const spinLabel = spinning ? 'Spin' : freeSpins > 0 || remaining === 0 ? 'Spin' : formatRemaining(remaining);

  return (
    <SwampBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <TopBar title="Wheel of Luck" onBack={() => router.back()} />

        <View style={styles.wheelSlot}>
          <FortuneWheel ref={wheelRef} size={wheelSize} />
        </View>

        <MenuButton label={spinLabel} onPress={handleSpin} disabled={!canSpin} />
      </SafeAreaView>

      <WheelResultModal visible={showResult} segment={result} onClose={() => setShowResult(false)} />
    </SwampBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: Menu.frameWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  wheelSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
