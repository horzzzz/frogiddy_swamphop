import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Menu } from '@/constants/theme';

/** Design-unit dimensions the pill art was drawn at; `scale` maps them to real pixels. */
const BASE_WIDTH = 130;
const BASE_HEIGHT = 36;
const BASE_ICON = 24;
const BASE_FONT = 20;
const BASE_PADDING_H = 12;

type CounterPillProps = {
  icon: number;
  value: string;
  /** Menu pills are 130 wide; the in-game HUD uses the narrower 105 from the game frame. */
  width?: number;
  /**
   * Design-unit-to-pixel scale, same convention as the game canvas
   * (`width / DESIGN_WIDTH`). Defaults to 1 — the menu screens that don't pass
   * it render at the same fixed size they always have. The in-game HUD passes
   * the real one so the pill row scales down on a narrow phone the same way
   * the canvas art does, instead of running off the edge of the screen.
   */
  scale?: number;
};

export function CounterPill({ icon, value, width = BASE_WIDTH, scale = 1 }: CounterPillProps) {
  return (
    <View
      style={[
        styles.container,
        {
          width: width * scale,
          height: BASE_HEIGHT * scale,
          paddingHorizontal: BASE_PADDING_H * scale,
        },
      ]}>
      <Image
        source={require('@/assets/images/menu/panel-pill.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
      />
      <Image source={icon} style={{ width: BASE_ICON * scale, height: BASE_ICON * scale }} contentFit="contain" />
      <Text style={[styles.value, { fontSize: BASE_FONT * scale }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  value: {
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
});
