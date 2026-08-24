/**
 * The Arsenal catalog. Every weapon kills an enemy in one hit — the only thing
 * that differs between them is reach: `rangeX`/`rangeY` overwrite the frog's
 * attack box in `triggerAttack` (src/game/tongue.ts) the moment a weapon is
 * equipped. Prices are the Figma mockup's coin prices divided by 10, since the
 * shop actually charges crystals.
 *
 * Array order is load-bearing: it is the reach ladder, cheapest-to-longest,
 * and the Arsenal's reach-meter (WeaponCard) reads a weapon's tier straight
 * off its index. Reordering this array reorders the ladder.
 */
export type Weapon = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: number;
  /** Half-width/half-height of the ground attack's hit box, in design units. */
  rangeX: number;
  rangeY: number;
  /** Frog sprite drawn during the attack pose while this weapon is equipped. */
  attackSprite: number;
};

export const WEAPONS: readonly Weapon[] = [
  {
    id: 'bog-dagger',
    name: 'Bog Dagger',
    description: 'A lightweight blade for quick attacks.',
    price: 10,
    icon: require('@/assets/images/arsenal/bog-dagger.webp'),
    rangeX: 82,
    rangeY: 54,
    attackSprite: require('@/assets/images/game/frog/attack-bog-dagger.webp'),
  },
  {
    id: 'hollow-sword',
    name: 'Hollow Sword',
    description: 'A balanced blade for close combat.',
    price: 20,
    icon: require('@/assets/images/arsenal/hollow-sword.webp'),
    rangeX: 95,
    rangeY: 58,
    attackSprite: require('@/assets/images/game/frog/attack-hollow-sword.webp'),
  },
  {
    id: 'thorn-mace',
    name: 'Thorn Mace',
    description: 'A heavy spiked weapon with brutal impact.',
    price: 30,
    icon: require('@/assets/images/arsenal/thorn-mace.webp'),
    rangeX: 107,
    rangeY: 62,
    attackSprite: require('@/assets/images/game/frog/attack-thorn-mace.webp'),
  },
  {
    id: 'crystal-sword',
    name: 'Crystal Sword',
    description: 'A rare crystal blade charged with swamp energy.',
    price: 40,
    icon: require('@/assets/images/arsenal/crystal-sword.webp'),
    rangeX: 120,
    rangeY: 66,
    attackSprite: require('@/assets/images/game/frog/attack-crystal-sword.webp'),
  },
  {
    id: 'frog-hammer',
    name: 'Frog Hammer',
    description: 'A massive hammer that crushes nearby enemies.',
    price: 50,
    icon: require('@/assets/images/arsenal/frog-hammer.webp'),
    rangeX: 132,
    rangeY: 70,
    attackSprite: require('@/assets/images/game/frog/attack-frog-hammer.webp'),
  },
  {
    id: 'swamp-spear',
    name: 'Swamp Spear',
    description: 'A long spear made for keeping enemies away.',
    price: 60,
    icon: require('@/assets/images/arsenal/swamp-spear.webp'),
    rangeX: 145,
    rangeY: 74,
    attackSprite: require('@/assets/images/game/frog/attack-swamp-spear.webp'),
  },
  {
    id: 'vine-whip',
    name: 'Vine Whip',
    description: 'A flexible living vine that strikes from afar.',
    price: 80,
    icon: require('@/assets/images/arsenal/vine-whip.webp'),
    rangeX: 157,
    rangeY: 79,
    attackSprite: require('@/assets/images/game/frog/attack-vine-whip.webp'),
  },
  {
    id: 'magic-staff',
    name: 'Magic Staff',
    description: 'Fires magical swamp energy from a safe distance.',
    price: 100,
    icon: require('@/assets/images/arsenal/magic-staff.webp'),
    // Matches the old, pre-Frogenetics tongue reach — still short of a fully
    // upgraded tongue (TONGUE_RANGE_BASE * 2 in src/constants/frogenetics.ts),
    // just no longer short of the unupgraded one.
    rangeX: 170,
    rangeY: 85,
    attackSprite: require('@/assets/images/game/frog/attack-magic-staff.webp'),
  },
];
