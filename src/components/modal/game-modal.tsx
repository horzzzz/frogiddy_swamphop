import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { Menu } from '@/constants/theme';
import { playSfx } from '@/services/audio';

type GameModalProps = {
  visible: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  /** Blocks dismissing by tapping the backdrop, used for blocking states. */
  dismissable?: boolean;
};

/**
 * Reusable vine-bordered dialog chrome from the Figma design system — the same
 * frame art is meant to back every future modal (settings, shop, etc.), not just
 * the daily bonus one.
 */
export function GameModal({ visible, title, children, onClose, dismissable = true }: GameModalProps) {
  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(240)} style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={
          dismissable
            ? () => {
                playSfx('click');
                onClose();
              }
            : undefined
        }
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Animated.View
        entering={ZoomIn.springify().damping(20).stiffness(180).overshootClamping(1)}
        exiting={ZoomOut.duration(240)}
        style={styles.card}>
        <Image
          source={require('@/assets/images/modal/panel.webp')}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
        />
        <View style={styles.content}>
          {title && <Text style={styles.title}>{title.toUpperCase()}</Text>}
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Menu.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10,
  },
  card: {
    width: '100%',
    maxWidth: 382,
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
    gap: 16,
  },
  title: {
    fontFamily: 'BlackHanSans_400Regular',
    fontSize: 36,
    color: Menu.textPrimary,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
