import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Menu } from '@/constants/theme';

/** Width:height ratio every menu button is locked to, regardless of its content. */
const BUTTON_ASPECT_RATIO = 3.2;

type MenuButtonProps =
  | {
      label: string;
      locked?: false;
    }
  | {
      label: string;
      locked: true;
      hint: string;
      hintIcon: number;
    };

export function MenuButton(props: MenuButtonProps) {
  if (!props.locked) {
    return (
      <View style={styles.container}>
        <Image
          source={require('@/assets/images/menu/btn-green.webp')}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
        />
        <Text style={styles.title}>{props.label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.locked]}>
      <Image
        source={require('@/assets/images/menu/btn-green.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
      />
      <Image
        source={require('@/assets/images/menu/icon-lock.webp')}
        style={styles.lock}
        contentFit="contain"
      />
      <View style={styles.lockedCenter}>
        <Text style={styles.lockedTitle}>{props.label}</Text>
        <View style={styles.hintRow}>
          <Text style={styles.hint}>{props.hint}</Text>
          <Image source={props.hintIcon} style={styles.hintIcon} contentFit="contain" />
        </View>
      </View>
      <Image
        source={require('@/assets/images/menu/icon-lock.webp')}
        style={styles.lock}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: BUTTON_ASPECT_RATIO,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  locked: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  lock: {
    width: 68,
    height: 68,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  lockedCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  lockedTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hint: {
    fontSize: 14,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  hintIcon: {
    width: 20,
    height: 20,
  },
});
