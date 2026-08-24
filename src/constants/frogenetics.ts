/**
 * The Frogenetics catalog — cosmetic/stat upgrades bought with coins. Purely
 * visual for now: WeaponCard-style buy buttons render but don't spend
 * anything (see `frogenetics-card.tsx` and `src/app/frogenetics.tsx`).
 */
export type FrogeneticsUpgrade = {
  id: string;
  name: string;
  description: string;
  value: string;
  price: number;
  icon: number;
};

export const FROGENETICS_UPGRADES: readonly FrogeneticsUpgrade[] = [
  {
    id: 'tongue',
    name: 'Tongue',
    description: 'Tongue Range',
    value: '3.0 m',
    price: 250,
    icon: require('@/assets/images/frogenetics/icon-tongue.webp'),
  },
  {
    id: 'body',
    name: 'Body',
    description: 'Max Health',
    value: '4',
    price: 300,
    icon: require('@/assets/images/frogenetics/icon-body.webp'),
  },
  {
    id: 'legs',
    name: 'Legs',
    description: 'Jump Power',
    value: '100%',
    price: 200,
    icon: require('@/assets/images/frogenetics/icon-legs.webp'),
  },
];
