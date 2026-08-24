import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeaponCard } from '@/components/arsenal/weapon-card';
import { SwampBackground } from '@/components/menu/swamp-background';
import { TopBar } from '@/components/top-bar';
import { Menu } from '@/constants/theme';
import { WEAPONS } from '@/constants/weapons';
import { useEconomy } from '@/state/economy';

export default function Arsenal() {
  const router = useRouter();
  const { crystals, ownedWeapons, buyWeapon } = useEconomy();

  return (
    <SwampBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBarInset}>
          <TopBar title="Arsenal" onBack={() => router.back()} />
        </View>

        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
            {WEAPONS.map((weapon) => {
              const owned = ownedWeapons.includes(weapon.id);
              return (
                <WeaponCard
                  key={weapon.id}
                  weapon={weapon}
                  owned={owned}
                  canAfford={crystals >= weapon.price}
                  onBuy={() => {
                    if (!owned) buyWeapon(weapon.id, weapon.price);
                  }}
                />
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>
    </SwampBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: Menu.frameWidth,
    alignSelf: 'center',
  },
  topBarInset: {
    paddingHorizontal: 16,
  },
  panel: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  panelContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
});
