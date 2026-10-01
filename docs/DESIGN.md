# Lettermancer design system

**Concept: an illuminated manuscript at night.** The game is about letters, so its signature element is the
_historiated initial_: every enemy (and the logo) is a glyph set inside a gold-ruled square on a colored field with
faint vine work. Everything around it stays quiet.

## Color

| Token         | Hex       | Use                                                                                      |
| ------------- | --------- | ---------------------------------------------------------------------------------------- |
| `--night`     | `#130f1d` | Page background                                                                          |
| `--ink`       | `#221b33` | Panels, keys, cards                                                                      |
| `--moon`      | `#ddd7ea` | Primary text                                                                             |
| `--gold`      | `#d9b45b` | Ornament, rewards, primary actions — nothing else                                        |
| `--witchfire` | `#7fe0b0` | Healing and shield                                                                       |
| `--rose`      | `#e24b6e` | Danger: your health, enemy wind-ups, errors                                              |
| Muse colors   | —         | Ember, Frost, Spark, Aurum, Echo, Glass, Ward: only on the keys and letters they empower |

## Type

- **Cinzel** (display): names, titles, big numbers. It is an inscriptional capital face, so never use it for body text.
- **Alegreya Sans** (text): everything you read.
- **JetBrains Mono** (typing): only the words you type and keycaps — letter clarity at speed matters more than mood.
- **Cormorant Garamond**: glyphs inside illuminated initials.

All fonts are OFL and self-hosted (no requests to Google).

Rules: sentence case for labels, no all-caps tracked labels, no dot-separated meta strings, no monospace for stat labels.

## Components (`apps/web/src/lib/ui`)

`Frame` (ink panel; `ornate` adds gold corners — reserve for rare things), `Initial`, `Corner`, `Bar`, `Button`
(primary gold / quiet), `OfferCard`, `Keyboard` (layouts, heatmap, picking, finger colors), `Hud`, `HeatLegend`.

## Motion

- Motion answers the player: key presses, hits, kills, damage taken. Entrances ≤ 250 ms.
- One orchestrated moment per screen at most (title arrival, boss reveal).
- Screen shake only on crits, kills and taking damage.
- `prefers-reduced-motion` (or the in-game setting) turns animation down to a single frame and quarters particles.

## Sound

Synthesized in `lib/fx/audio.ts` — no audio files. Three buses (master, effects, music). The music is a quiet
generative drone and arpeggio that quickens with your combo tier.
