import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Menu } from '@/constants/theme';

type CounterPillProps = {
  icon: number;
  value: string;
};

export function CounterPill({ icon, value }: CounterPillProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/menu/panel-pill.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
      />
      <Image source={icon} style={styles.icon} contentFit="contain" />
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 130,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  icon: {
    width: 24,
    height: 24,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
});
