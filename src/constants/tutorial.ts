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
    hint: 'Hold to aim',
    description:
      "Your tongue is how you climb — a jump alone never reaches the next ledge. Hold anywhere to aim, drag to steer, and let go to grab. One grab per flight, so pick your shot.",
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
      'A quick tap near an enemy attacks it — on the ground or in the air. Careful — some of your weapons have a shorter reach than your enemies!',
    color: Tutorial.attack,
    image: require('@/assets/images/tutorial/attack.webp'),
    imageWidth: 378,
    imageHeight: 396,
  },
  {
    id: 'jump',
    title: 'Move',
    hint: 'Auto-jump + stick',
    description:
      'Landing on a platform bounces you automatically — no need to aim it. Use the stick in the corner to steer left and right while you fly.',
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
      "Bouncing off this platform costs you 1 heart per touch. It relaunches you just like any other, so a single bad landing is a single hit — not a trap you can get stuck in.",
    color: Tutorial.hurty,
    image: require('@/assets/images/tutorial/hurty.webp'),
    imageWidth: 443,
    imageHeight: 308,
  },
];
