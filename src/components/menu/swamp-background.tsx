import { Image } from 'expo-image';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Menu } from '@/constants/theme';

export function SwampBackground({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.container, style]} {...rest}>
      <Image
        source={require('@/assets/images/menu/bg.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    backgroundColor: Menu.overlay,
  },
});
