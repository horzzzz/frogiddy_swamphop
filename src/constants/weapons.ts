/**
 * The Arsenal catalog. Purely presentational for now — what each weapon does in
 * a run, and how they differ from one another, is a later decision. Prices are
 * the Figma mockup's coin prices divided by 10, since the shop actually charges
 * crystals.
 */
export type Weapon = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: number;
};

export const WEAPONS: readonly Weapon[] = [
  {
    id: 'hollow-sword',
    name: 'Hollow Sword',
    description: 'A balanced blade for close combat.',
    price: 10,
    icon: require('@/assets/images/arsenal/hollow-sword.webp'),
  },
  {
    id: 'swamp-spear',
    name: 'Swamp Spear',
    description: 'A long spear made for keeping enemies away.',
    price: 20,
    icon: require('@/assets/images/arsenal/swamp-spear.webp'),
  },
  {
    id: 'thorn-mace',
    name: 'Thorn Mace',
    description: 'A heavy spiked weapon with brutal impact.',
    price: 30,
    icon: require('@/assets/images/arsenal/thorn-mace.webp'),
  },
  {
    id: 'bog-dagger',
    name: 'Bog Dagger',
    description: 'A lightweight blade for quick attacks.',
    price: 40,
    icon: require('@/assets/images/arsenal/bog-dagger.webp'),
  },
  {
    id: 'crystal-sword',
    name: 'Crystal Sword',
    description: 'A rare crystal blade charged with swamp energy.',
    price: 50,
    icon: require('@/assets/images/arsenal/crystal-sword.webp'),
  },
  {
    id: 'vine-whip',
    name: 'Vine Whip',
    description: 'A flexible living vine that strikes from afar.',
    price: 60,
    icon: require('@/assets/images/arsenal/vine-whip.webp'),
  },
  {
    id: 'frog-hammer',
    name: 'Frog Hammer',
    description: 'A massive hammer that crushes nearby enemies.',
    price: 80,
    icon: require('@/assets/images/arsenal/frog-hammer.webp'),
  },
  {
    id: 'magic-staff',
    name: 'Magic Staff',
    description: 'Fires magical swamp energy from a safe distance.',
    price: 100,
    icon: require('@/assets/images/arsenal/magic-staff.webp'),
  },
];
