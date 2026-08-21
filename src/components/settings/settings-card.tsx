import { StyleSheet, View, type ViewProps } from 'react-native';

/** Shared translucent panel used to group rows on the settings screen. */
export function SettingsCard({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 24,
    gap: 16,
  },
});
