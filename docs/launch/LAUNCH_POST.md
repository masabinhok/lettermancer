# Launch post (draft)

**Title:** Lettermancer: a typing roguelike where your keyboard is the deck (open source)

I've been building a game about getting faster at typing without it feeling like drills. It's out now, free in the
browser, and the source is MIT-licensed.

**The idea:** in a deckbuilder you collect cards. In Lettermancer you collect powers for _keys_. Bind Ember to your E and
every E you type sets the enemy burning. Put Frost on S and your S pushes attacks back. Enemies carry words, and
finishing a word is how you strike. Over three acts you build a keyboard that plays like nobody else's.

**The sneaky part:** every keystroke is timed. The game notices you're slow on Q or on "br", and quietly deals you more
words that drill them. After each run you get a heatmap of your hands. The goal is that you get faster without
noticing.

**New for launch:**

- A **daily rite**: the same seed and keyboard for everyone, one attempt.
- A **weekly challenge** under fixed Oaths.
- **Leaderboards** where every run is replayed and checked on the server by the same engine your browser runs, so
  bots and forged scores get turned away.
- **Ghosts**: race your best practice test, or the leaderboard's.
- **Share cards** of your runs.

**For developers:** the rules engine is deterministic TypeScript. A run is its seed plus the list of actions you took,
so save/resume, ghosts and anti-cheat all come from one replay function. Content (enemies, boons, relics,
achievements) is plain data, and the good-first-issue label has plenty of small things to pick up.

Play: <link> · Code: https://github.com/masabinhok/lettermancer

I'd love to hear which key you built your run around.
