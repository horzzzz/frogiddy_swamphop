import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Menu } from '@/constants/theme';
import { playSfx } from '@/services/audio';

import { Toggle } from './toggle';

type SettingsToggleRowProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SettingsToggleRow({ label, value, onValueChange }: SettingsToggleRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={label} />
    </View>
  );
}

type SettingsLinkRowProps = {
  label: string;
  onPress: () => void;
};

/** A stub navigation row — the arrow signals "more", `onPress` has nothing to open yet. */
export function SettingsLinkRow({ label, onPress }: SettingsLinkRowProps) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => {
        playSfx('click');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <Image
        source={require('@/assets/images/ui/icon-back.webp')}
        style={styles.linkArrow}
        contentFit="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 20,
    fontWeight: '400',
    color: Menu.textPrimary,
    textTransform: 'capitalize',
  },
  linkArrow: {
    width: 24,
    height: 24,
    transform: [{ scaleX: -1 }],
  },
});
