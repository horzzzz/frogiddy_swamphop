import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Menu } from '@/constants/theme';

type MenuTileProps = {
  icon: number;
  label: string;
};

export function MenuTile({ icon, label }: MenuTileProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/menu/panel-tile.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
      />
      <Image source={icon} style={styles.icon} contentFit="contain" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 8,
    gap: 8,
    maxHeight: 118,
  },
  icon: {
    width: 62,
    height: 62,
  },
  label: {
    fontSize: 12,
    fontWeight: '400',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
});
