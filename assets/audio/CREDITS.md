# Audio credits

Every third-party file here is CC0 (public domain dedication) — no attribution is
legally required, but the sources are recorded so the provenance stays auditable.

All files were re-encoded to mono AAC (`.m4a`) with `afconvert`, trimmed of
leading/trailing silence, peak-normalised to -3 dBFS and given short fades so no
clip starts or ends with a click. Levels are balanced in code
(`src/services/audio.ts`), not baked into the files.

| File | Source | Author | License |
|---|---|---|---|
| `music-swamp.m4a` | [Happy Swamp](https://opengameart.org/content/happy-swamp) (`happy_swamp_0.mp3`) | ShggothSlave | CC0 |
| `sfx-click.m4a` | [51 UI sound effects](https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks) (`click3.wav`) | Kenney | CC0 |
| `sfx-pickup.m4a` | [80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx) (`item_coins_01.ogg`) | rubberduck | CC0 |
| `sfx-hit.m4a` | [8 wet squish/slurp impacts](https://opengameart.org/content/8-wet-squish-slurp-impacts) (`impactsplat03`) | qubodup | CC0 |
| `sfx-hurt.m4a` | [80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx) (`creature_hurt_01.ogg`) | rubberduck | CC0 |
| `sfx-lose.m4a` | [Level up, power up, coin get — 13 sounds](https://opengameart.org/content/level-up-power-up-coin-get-13-sounds) (`Downer01.aif`) | wobbleboxx | CC0 |
| `sfx-wheel.m4a` | Supplied by the project owner (`sfx-wheel.mp3`) | — | — |

## Music loop

`music-swamp.m4a` is an 80-second cut (8s…88s of the 3-minute original) whose tail
is cross-faded into the material preceding the cut, so looping it wraps around
without an audible seam. The original's intro and fade-out are deliberately left
out — both would be obvious every time the loop restarts.
