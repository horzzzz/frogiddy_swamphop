import { Linking, StyleSheet, Text, View } from 'react-native';

import { Menu } from '@/constants/theme';

export function LegalText() {
  return (
    <View style={styles.container}>
      <Text style={styles.line}>By tapping “Play” you confirm that you 18+ and</Text>
      <Text style={styles.linksLine}>
        our{' '}
        <Text
          style={styles.link}
          onPress={() => Linking.openURL('https://telegra.ph/TERMS-OF-USE-08-24-10')}
        >
          terms of use
        </Text>{' '}
        &{' '}
        <Text
          style={styles.link}
          onPress={() => Linking.openURL('https://telegra.ph/PRIVACY-POLICY-08-24-121')}
        >
          privacy policy
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 4,
  },
  line: {
    fontSize: 12,
    fontWeight: '400',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  linksLine: {
    fontSize: 16,
    fontWeight: '400',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  link: {
    textDecorationLine: 'underline',
  },
});
