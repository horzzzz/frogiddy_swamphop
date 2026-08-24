import { StyleSheet, Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/menu-button';
import { GameModal } from '@/components/modal/game-modal';
import { Menu } from '@/constants/theme';
import type { TutorialCardData } from '@/constants/tutorial';

const CONTENT_WIDTH = 320;

type TutorialInfoModalProps = {
  card: TutorialCardData | null;
  onClose: () => void;
};

/** Full explanation for one tutorial card, opened from its "?" button. Same chrome as `DailyBonusModal`. */
export function TutorialInfoModal({ card, onClose }: TutorialInfoModalProps) {
  return (
    <GameModal visible={card !== null} title={card?.title} onClose={onClose}>
      <View style={styles.infoPlate}>
        <Text style={styles.infoText}>{card?.description}</Text>
      </View>

      <View style={styles.closeButton}>
        <MenuButton label="Got it" onPress={onClose} />
      </View>
    </GameModal>
  );
}

const styles = StyleSheet.create({
  infoPlate: {
    width: CONTENT_WIDTH,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 18,
    fontWeight: '400',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  closeButton: {
    width: CONTENT_WIDTH,
  },
});
