import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Tutorial } from '@/constants/theme';
import type { TutorialCardData } from '@/constants/tutorial';
import { playSfx } from '@/services/audio';

/** Card art from the Figma frame renders at this fixed height; width follows its own aspect ratio. */
const IMAGE_HEIGHT = 98;

type TutorialCardProps = {
  card: TutorialCardData;
  /** Design-unit-to-pixel scale, same convention as `game-hud.tsx` — `width / DESIGN_WIDTH`. */
  scale: number;
  onInfoPress: () => void;
};

/** One tutorial card — title, "?" info button, one-line hint and its illustration. */
export function TutorialCard({ card, scale, onInfoPress }: TutorialCardProps) {
  const imageWidth = (card.imageWidth / card.imageHeight) * IMAGE_HEIGHT * scale;

  return (
    <View
      style={[
        styles.container,
        {
          width: Tutorial.cardWidth * scale,
          borderColor: card.color,
          borderRadius: 15 * scale,
          borderWidth: 2 * scale,
          paddingHorizontal: 27 * scale,
          paddingVertical: 12 * scale,
          gap: 8 * scale,
        },
      ]}>
      <View style={[styles.titleRow, { gap: 6 * scale }]}>
        <Text style={[styles.title, { color: card.color, fontSize: 24 * scale }]}>{card.title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`About ${card.title}`}
          hitSlop={10}
          onPress={() => {
            playSfx('click');
            onInfoPress();
          }}
          style={[
            styles.infoButton,
            {
              width: 22 * scale,
              height: 22 * scale,
              borderRadius: 11 * scale,
              borderWidth: 2 * scale,
              borderColor: card.color,
            },
          ]}>
          <Text style={[styles.infoMark, { color: card.color, fontSize: 14 * scale }]}>?</Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { fontSize: 16 * scale }]} numberOfLines={1}>
        {card.hint}
      </Text>
      <Image
        source={card.image}
        style={{ width: imageWidth, height: IMAGE_HEIGHT * scale }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Tutorial.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  infoButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoMark: {
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
