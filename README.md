# Keycraft

A roguelike typing game where your keyboard is the deck. Type words to fight typographic monsters, win power-ups, and install them onto individual keys, so your **E** burns, your **T** earns gold, and your **O** hits like glass. While you play, the game tracks your slowest keys and quietly works them into the words you get.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build to `dist/` |
| `npm test` | Run the unit and balance tests |
| `npm run words` | Rebuild `src/data/words.json` from the word lists |

## How to play

### The run
A run is **3 acts**. Each act follows the same path:

```
⚔ fight → ⚔ fight → $ shop → ⚔ fight → ◆ elite → $ shop → ☠ boss
```

Your HP carries over between fights. Beating a boss heals 40% of your max HP. Clear all three acts to win.

### Combat
- Every enemy has a **word**. Start typing it and that enemy becomes your target.
- Finish the word to hit the enemy. **Each letter is 1 damage** before mods and combo.
- Once you've targeted an enemy, a wrong key does nothing to your progress, but it does count as a typo.
- The bar under each enemy is its **attack timer**. When it fills, the enemy hits you. The number beside it is how hard.
- When two enemies are on screen, their words always start with different letters, so the first key you press picks your target.

### Combo
Every correct key adds to your combo. Every typo resets it to zero.

| Combo | Damage |
|---|---|
| 0–9 | ×1 |
| 10–24 | ×1.5 |
| 25–49 | ×2 |
| 50–99 | ×3 |
| 100+ | ×4 |

Accuracy matters more than speed. Going a little slower and keeping your combo usually wins.

### Key mods
After each fight you choose one of three mods, then **press the key you want to install it on**. Keys with mods glow on the on-screen keyboard, and their letters are colored in enemy words. Each key holds 2 mods. Installing a third pushes out the oldest.

| Mod | Effect (per letter in the finished word) |
|---|---|
| ▲ **Ember** | Adds 2 Burn. Burn deals its value in damage every second, then drops by 1 |
| ◆ **Frost** | Pushes the target's attack back 0.7s |
| ϟ **Spark** | Zaps another enemy for 3 (scaled by combo) |
| ● **Gold** | +1 coin |
| ◎ **Echo** | The letter counts double for damage |
| ◇ **Glass** | The letter deals ×3. If you mistype when this key is next, the Glass **shatters** and is gone |
| ■ **Ward** | +1 Shield for this fight. Shield absorbs damage before HP |

**Tip:** common letters (e, t, a, o, i, n, s, r) trigger far more often. The game also gives you more words that contain your modded keys.

### Relics
Relics change the rules for the rest of the run. You get to choose one after elite and boss fights, and shops sell them too.

| Relic | Effect |
|---|---|
| Twin Fangs | Words with a double letter deal ×2 |
| Lipogram | Words without the letter E deal +50% |
| Marathon | Words of 8+ letters heal 2 HP |
| Steady Hands | A typo halves your combo instead of resetting it |
| Whetstone | +2 base damage on every word |
| Hourglass | Enemies attack 15% slower |
| Interest | After each fight, +1 coin per 5 held (max 5) |
| Fang Ink | Every 25 combo heals 3 HP |
| First Strike | Your first word each fight deals ×3 |
| Thorns | When you're hit, deal 4 damage back to the attacker |

### Shops
Shops sell mods, relics and a Patch Kit (heals 15 HP). A reroll costs 3 coins, and each further reroll in the same shop costs 1 more.

### Bosses
Each run shuffles the three bosses across the acts:

- **Hydra of Ands**: every hit grows a new head, up to 2 at a time.
- **Mirror Scribe**: its words are written backwards, so type exactly what you see.
- **Blackout**: its words fade after a moment and the keyboard goes dark, so you type from memory. A typo briefly reveals the word again.

### Starting keyboards
Each starting keyboard begins the run with different mods. You unlock more by reaching milestones.

| Keyboard | Start | Unlock |
|---|---|---|
| Apprentice | Ember on E, Gold on A, 5 coins | Available from the start |
| Glassblower | Glass on E, T, O | Reach Act 2 |
| Cryomancer | Frost on S and R, Spark on N | Win a fight with 100% accuracy (5+ words) |
| Tycoon | Gold on E and T, 15 coins, Interest relic | Hold 40 coins at once |

## Controls

| Key | Where | Action |
|---|---|---|
| `a`–`z` | Combat | Type |
| `Backspace` | Combat | Delete the last letter (with nothing typed, drop your target) |
| `Tab` / `Esc` | Combat | Drop your target so you can switch enemies |
| `a`–`z` | Installing a mod | Put the mod on that key |
| `Esc` | Installing a mod | Throw the mod away |
| `1`–`7` | Menu, rewards, shop | Pick a card (or click it) |
| `0` | Shop | Reroll |
| `Enter` | Everywhere else | Start, continue, skip, or leave the shop |

The game pauses automatically when the window loses focus. Click to resume.

## Learning while you play

- Every keystroke is timed. Keys that are slow or error-prone get a **weakness score**.
- About **30% of enemy words** are picked to drill your weakest keys.
- At the end of each run you get a **heatmap** of your keyboard (redder means weaker), plus your **nemesis pair**, the slowest two-letter combination you typed.
- **Finger colors** (toggle on the menu) color each key by which finger should press it in touch typing. **F** and **J** are underlined as your home-row anchors.

Your stats, unlocks and settings are saved in your browser's localStorage. No account is needed.

## Project layout

```
src/engine/   game rules: combat, mods & relics, run progression, word picker, stats
src/ui/       screens: menu, combat, reward, shop, results, and the on-screen keyboard
src/fx/       synthesized audio and hit particles
tests/        unit tests and a bot that plays full runs to check balance
```
