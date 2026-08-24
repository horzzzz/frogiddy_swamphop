import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
    // A dedicated Android window, not just a top-of-tree view: the game screen's
    // opaque Skia canvas renders on its own SurfaceView compositor layer, which
    // React views added on top of it (this modal) never actually land on. Modal
    // sidesteps that by giving the dialog its own window above everything.
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismissable ? onClose : () => {}}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    // Modal's own container already fills the window; no absolute positioning needed here.
    flex: 1,
    backgroundColor: Menu.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
