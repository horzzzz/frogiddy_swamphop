import { Tutorial } from '@/constants/theme';

export type TutorialCardData = {
  id: string;
  /** Short title shown on the card itself. */
  title: string;
  /** One-line hint shown under the title on the card. */
  hint: string;
  /** Full explanation shown in the info modal opened from the card's "?" button. */
  description: string;
  color: string;
  image: number;
  /** Native width the image renders at when scaled to a fixed height, from its own aspect ratio. */
  imageWidth: number;
  /** Native height the image was measured at — see `imageWidth`. */
  imageHeight: number;
};

export const TUTORIAL_CARDS: TutorialCardData[] = [
  {
    id: 'tongue',
    title: 'Tongue',
    hint: 'Hold/Tap to grab',
    description:
      'While on the ground, long-press in the direction you want to reach with your tongue. While in the air, just tap quickly where you want to pull yourself to.',
    color: Tutorial.tongue,
    image: require('@/assets/images/tutorial/tongue.webp'),
    imageWidth: 412,
    imageHeight: 445,
  },
  {
    id: 'attack',
    title: 'Attack',
    hint: 'Tap to attack',
    description:
      'Attack enemies at close range while standing on the ground. Careful — some of your weapons have a shorter reach than your enemies!',
    color: Tutorial.attack,
    image: require('@/assets/images/tutorial/attack.webp'),
    imageWidth: 378,
    imageHeight: 396,
  },
  {
    id: 'jump',
    title: 'Jump',
    hint: 'Drag to aim',
    description:
      "Pull down with your finger and pick your jump trajectory. Combine it with your tongue mid-flight to land exactly on the platform you need!",
    color: Tutorial.jump,
    image: require('@/assets/images/tutorial/jump.webp'),
    imageWidth: 222,
    imageHeight: 213,
  },
  {
    id: 'hurty',
    title: 'Hurty',
    hint: 'Avoid it',
    description:
      "Stepping on this platform costs you 1 heart. If you don't jump off in time, you will keep losing hearts until the run is over.",
    color: Tutorial.hurty,
    image: require('@/assets/images/tutorial/hurty.webp'),
    imageWidth: 443,
    imageHeight: 308,
  },
];
