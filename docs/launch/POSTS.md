# Launch posts (drafts for Oct 5+)

Each is tuned to where it's posted. Replace https://lettermancer.vercel.app with https://lettermancer.vercel.app (or your own domain),
and attach `docs/media/lettermancer.gif` wherever images are allowed. Post at a time you can answer comments for the
next few hours; the first hour of replies matters most.

---

## Hacker News: Show HN

**Title:** Show HN: Lettermancer – a typing roguelike where your keyboard is the deck

**URL:** https://lettermancer.vercel.app

**First comment (post it yourself right after submitting):**

> Hi HN, I built Lettermancer, a roguelike you play by typing. Enemies carry words; finishing a word strikes. Between
> fights you win powers from six "muses" and bind them to individual keys, so your E might set enemies burning and
> your S push their attacks back. Every keystroke is timed, and the game quietly feeds you more words with the
> letters you're slowest at.
>
> Some technical bits that might interest you:
>
> - The rules engine is deterministic TypeScript with no framework. A run is a seed plus the list of actions you took,
>   so save/resume, practice ghosts and anti-cheat are all the same replay function.
> - Leaderboard runs are replayed on the server (Supabase edge functions running the same engine bundle) and rejected
>   for impossible timing, invalid actions, or starting bonuses that real progress can't produce.
> - Sound is synthesized with Web Audio and the art is CSS/SVG, so there are no asset files at all.
> - It works fully offline as a guest; accounts are optional.
>
> It's MIT-licensed: https://github.com/masabinhok/lettermancer. I'd love feedback on the difficulty curve and on which
> moments feel slow.

---

## Reddit: r/WebGames

**Title:** Lettermancer – a free browser roguelike you play by typing (bind powers to individual keys)

**Body:**

> Type words to fight glyph-monsters, then bind powers to individual keys: Ember on E burns, Frost on S slows attacks,
> Spark on N zaps other enemies. Three acts, six bosses, daily and weekly challenges, and it secretly drills the keys
> you're slowest at.
>
> Free, no ads, no sign-up needed: https://lettermancer.vercel.app

(Attach the GIF.)

---

## Reddit: r/roguelikes / r/roguelites

**Title:** I made a typing roguelite where your keyboard is the deck

**Body:**

> The core idea: instead of collecting cards, you collect powers for keys. A key holds two powers, binding the same one
> again upgrades its rarity, and boons from two muses can combine into duo boons (Ember + Frost = Steam: frost on a
> burning enemy detonates its burn). There are relics, Glass keys that shatter on a typo, Oaths for extra difficulty
> (Heat), and between runs a hub with permanent upgrades, keepsakes and 60+ achievements.
>
> Runs are seeded and deterministic, so the daily rite is the same run for everyone.
>
> Play free in the browser: https://lettermancer.vercel.app · Source (MIT): https://github.com/masabinhok/lettermancer
>
> I'm especially interested in whether the build choices feel meaningful by Act 2.

---

## Reddit: r/typing / r/learntyping

**Title:** A typing game that adapts to your weakest keys (free, open source)

**Body:**

> Every keystroke in Lettermancer is timed. Keys that are slow or error-prone get a weakness score, and about 30% of
> enemy words are picked to drill them. After each run you get a heatmap of your keyboard and your hardest letter
> pair, and each key earns Bronze, Silver and Gold as you get faster.
>
> There's also a practice desk: timed and word-count tests, public-domain quotes, adaptive lessons that unlock letters
> one at a time, trials, and ghosts to race (your best run, or anyone on the leaderboard). Finger colors for QWERTY,
> Dvorak, Colemak and AZERTY.
>
> https://lettermancer.vercel.app

---

## X / Bluesky

> I made Lettermancer: a typing roguelike where your keyboard is the deck ⌨️🔥
>
> Bind powers to keys (E burns, S freezes, N throws sparks), fight through three acts, and it quietly trains your
> slowest letters.
>
> Free in the browser, open source: https://lettermancer.vercel.app

(Attach the GIF. Short follow-up post in the thread: the GitHub link and one line on the deterministic replay engine.)

---

## Discord (friends / communities)

> Hey! I've been building a typing roguelike called Lettermancer and it's finally public: https://lettermancer.vercel.app
> You fight by typing words and bind powers to individual keys. There's a daily run that's the same for everyone,
> if anyone wants to compare scores 👀 Feedback very welcome, especially on what feels slow or confusing.
