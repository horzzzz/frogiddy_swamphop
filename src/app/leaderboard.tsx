import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwampBackground } from '@/components/menu/swamp-background';
import { TopBar } from '@/components/top-bar';
import { Menu } from '@/constants/theme';
import { useEconomy } from '@/state/economy';

type Row = {
  rank: number;
  name: string;
  amount: number;
  isYou?: boolean;
};

const MOCK_NAMES = [
  'NeonFalcon',
  'SkyRider',
  'CosmicAce',
  'ShadowWolf',
  'PixelKnight',
  'BlazeFang',
  'FrostViper',
  'IronHawk',
  'LunarWisp',
  'ThunderClaw',
  'VoidRunner',
  'EmberFox',
  'CrimsonJay',
  'SilentPuma',
  'RogueComet',
];

/** Ranks the player against a fixed pool of mock opponents by their real coin balance. */
function buildBoard(playerCoins: number): Row[] {
  const rows: Row[] = MOCK_NAMES.map((name, index) => ({
    rank: 0,
    name,
    amount: Math.max(500, 100000 - index * 7000 + (index % 3) * 1200),
  }));
  rows.push({ rank: 0, name: 'You', amount: playerCoins, isYou: true });

  rows.sort((a, b) => b.amount - a.amount);
  rows.forEach((row, index) => (row.rank = index + 1));
  return rows;
}

function formatAmount(amount: number) {
  return `$ ${amount.toLocaleString('en-US')}`;
}

function LeaderboardRow({ rank, name, amount }: Row) {
  return (
    <View style={styles.row}>
      <View style={styles.rankSlot}>
        <Text style={styles.rankValue}>{rank}</Text>
        <Text style={styles.rankLabel}>Number</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.amountSlot}>
        <Text style={styles.amountValue}>{formatAmount(amount)}</Text>
        <Text style={styles.amountLabel}>withdrawal amount</Text>
      </View>
    </View>
  );
}

function YouRow({ rank, amount }: Row) {
  return (
    <LinearGradient
      colors={['#708B25', '#556E1C', '#3A5012']}
      style={styles.youRow}>
      <View style={styles.rankSlot}>
        <Text style={styles.rankValue}>{rank}</Text>
        <Text style={styles.rankLabel}>Number</Text>
      </View>
      <Text style={styles.youName} numberOfLines={1}>
        You
      </Text>
      <View style={styles.amountSlot}>
        <Text style={styles.amountValue}>{formatAmount(amount)}</Text>
        <Text style={styles.amountLabel}>withdrawal amount</Text>
      </View>
    </LinearGradient>
  );
}

export default function Leaderboard() {
  const router = useRouter();
  const { coins } = useEconomy();

  const board = useMemo(() => buildBoard(coins), [coins]);
  const you = board.find((row) => row.isYou)!;
  const others = useMemo(() => board.filter((row) => !row.isYou), [board]);

  return (
    <SwampBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <TopBar title="Leaderboard" onBack={() => router.back()} />

        <FlatList
          data={others}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => <LeaderboardRow {...item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <YouRow {...you} />
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
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  listContent: {
    gap: 8,
    paddingBottom: 12,
  },
  row: {
    height: 69,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  youRow: {
    height: 69,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  rankSlot: {
    width: 53,
    alignItems: 'center',
  },
  rankValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Menu.textPrimary,
  },
  rankLabel: {
    fontSize: 8,
    fontWeight: '400',
    color: Menu.textPrimary,
    opacity: 0.8,
    textTransform: 'capitalize',
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  youName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Menu.textPrimary,
    textAlign: 'center',
  },
  amountSlot: {
    width: 90,
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Menu.textPrimary,
  },
  amountLabel: {
    fontSize: 8,
    fontWeight: '400',
    color: Menu.textPrimary,
    opacity: 0.8,
    textTransform: 'capitalize',
  },
});
