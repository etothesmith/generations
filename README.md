# GENERATIONS 👑
### A live multiplayer family game show: culture, history & generations

One screen (TV or laptop) runs the show. Everybody else plays on their own phone: buzzers, votes, wagers and answers.

- **Gemini art built in:** stage, logo, podiums, 24 icons, stamps, badges, trophy, crowd, curtains, plus a **host mascot** who pops up with one-liners, an **animated "Gold Jacket" avatar** players can pick, and **themes** (Classic · Juneteenth · Christmas · Family Reunion) in the lobby.
- **Show open:** curtains, a logo slam and team intros. There are round title cards, and a live studio crowd that cheers and gasps.
- **Round 1: The Generations Board.** A 6×5 Jeopardy-style board, built from 16 categories, with 2 hidden **Family Wagers**, 1v1 podium buzz-offs, steals, Family Huddle lifelines, and the **CARD REVOKED!** stamp.
- **Round 2: For the Culture Remix.** Majority Rules · Hashtag Decode · Mama Said · Emoji Decode · **The Family Survey** · **Culture Charades** · One's Gotta Go · Name That Era · **60-Second Blitz**.
- **Round 3: The Final Wager.** Secret wagers, typed answers, a slow reveal, a trophy ceremony, and MVP awards.
- **467 questions** included, plus 20 Family Survey prompts and 60 charades clues, plus a **Family Questions editor** with JSON/CSV import.

**The 19 board categories** (all centered on African American life and history): Slang Across the Generations · Classic Black Cinema · Motown & Soul · R&B & Hip-Hop · Soul Train & Dance · Black TV Classics · Who Said It? · Comedy Kings & Queens · Black History Deep Cuts · Civil Rights Movement · Black America Road Trip · Trailblazers · Inventors & Innovators · HBCU Life · Sports Legends · Church & Gospel · Soul Food Kitchen · Card Check · Little Ones' Corner (made for the kids)

**What makes it different** (after studying Jackbox, Kahoot, Family Feud and the Black-culture trivia apps):
- **The Family Survey:** a Family Feud-style board built from *your family's own answers*. While people wait in the lobby, every phone answers 3 quick survey questions ("Name something you ALWAYS see at a family cookout"). In Round 2, those answers become the board: a face-off for control, teammates take turns typing guesses, three strikes, then the other team gets one guess to steal. The game matches typos and plurals ("potato salads" = "Potato salad"). If somebody says something that should count, the host taps the hidden answer to award it and wipe the strike.
- **Culture Charades:** one actor per team sees the clue on their phone (the Electric Slide, Grandma fanning herself in church, the Carlton…), with *Got it* and *Skip* buttons. The team shouts guesses for 45 seconds.
- **Play-Along for the bench:** while two people battle at the podiums, everybody else secretly answers on their phone. Each team earns up to +50 based on how much of its bench got it right (fair for big and small teams).
- **🔥 On Fire streaks + 🐾 Underdog bonus:** 3 right in a row earns +50 and flames on the podium. A team in last place and 500+ behind gets +50% on its right answers, so nobody checks out (Kahoot found that streak bonuses alone discourage the players at the bottom).
- **👀 Audience seats:** anyone can join just to watch, react, vote and play along without being on a team. Good for big gatherings.

**Made for every generation:**
- **Generation Crossover Bonus:** many questions are tagged for one generation (👑 OGs, 📻 Gen X, 📱 Millennials, ⚡ Gen Z). If someone from a *different* generation gets it right, their team earns +50% extra. Teens who know Motown and grandmas who know Doc McStuffins get celebrated.
- **Answer time:** Quick 10s, Relaxed 15s, or Grandma-Friendly 20s. Steals get half that time.
- **Remix length:** Short, Normal or Long Round 2.
- **Shuffled answers:** choices come up in a new order every game, so nobody learns "it's always A."
- **Fresh questions:** questions you've already played are saved on the host computer and skipped until the bank runs low.
- **Live reactions:** everybody's phone has a reaction bar (👏🏾🔥😂🙌🏾😱🤦🏾💯🃏). Taps float up the TV with the player's name, so the bench is never bored. The bar hides on the phone of whoever is answering.
- **60-Second Blitz:** each podium player gets the same stack of 15 quick questions on their own phone. Answer as many as you can; +100 each, live race lanes on the TV.
- **End-of-game awards** now also include 🔥 On Fire, 🛋️ Armchair Expert (play-along) and 🎭 Best Actor.
- **End-of-game awards:** ⭐ MVP · 🌉 Bridge Builder (most crossover answers) · 🦹🏾 Master Thief (most steals).

---

## ✅ Firebase is connected

This copy is already wired to the Firebase project **`generations-game`** (owner: your Google account). It has a Realtime Database (us-central1) with security rules, anonymous sign-in, and a web app. The keys are in `js/config.js`. Phones can join from anywhere as soon as the folder is online (step 3).

- The security rules (`database.rules.json`) are live. Only the host's browser can change the game, players can only send their own moves, and the Host Remote's answer key can't be listed or overwritten.
- Add **`?demo`** to any URL (e.g. `host.html?demo`) to test offline in one browser.

## 1. Try it right now (no setup)

Open `host.html?demo` to use **Local Demo Mode**. In demo mode, all players use tabs in **the same browser on the same computer**. That's good for testing, not for a real game night.

```bash
cd generations
python3 -m http.server 8000      # or: npx serve .
```
Open `http://localhost:8000/host.html`. Then open a few more tabs at `http://localhost:8000/play.html` and join with the room code.

> It must be opened through a web server (`http://…`), not by double-clicking the file (`file://…`).

---

## 2. Real game night: phones join from anywhere (Firebase, free)

This takes about 10 minutes, one time.

1. Go to **console.firebase.google.com** → **Add project** → name it `generations` (Analytics can be off).
2. **Build → Realtime Database → Create database.** Pick a location and start in **locked mode**.
3. Open the database's **Rules** tab. Paste in the contents of `database.rules.json` and click **Publish**.
4. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
5. **Project settings (⚙️) → Your apps → Web (`</>`)**, then register the app (no Hosting needed). Copy the `firebaseConfig` values into **`js/config.js`**.
   - Make sure `databaseURL` is filled in. If it's missing, copy it from the top of the Realtime Database page (it looks like `https://generations-xxxx-default-rtdb.firebaseio.com`).
6. Put the site online (step 3 below). Open `host.html` on the TV, and everyone scans the QR code.

The free Spark plan allows 100 simultaneous connections, which is plenty for a family.

---

## 3. Put it online (GitHub Pages)

1. Create a repo, e.g. `etothesmith/generations`, and upload **everything in this folder** (keep the folder structure).
2. Go to **Settings → Pages → Source: Deploy from a branch → `main` / root → Save.**
3. After about a minute, the game is at `https://etothesmith.github.io/generations/`.
   - TV: `…/generations/host.html`
   - Phones: scan the QR code on the TV. It points to `…/play.html?room=CODE`.

Everything is bundled locally: the Firebase SDK, fonts and the QR code generator. There are no outside CDNs to get blocked.

---

## 4. How to host

**Lobby.** Wait for everyone to join. Pick a **Show** format (Classic / Party Night / Trivia Only), then pick **By Generation** or **Random ×2/×3/×4**, set the **Answer time** and **Remix** length, and choose 6 board categories (or tap **🎲 Shuffle**). Then tap **Make Teams →**.
- *By Generation* sorts players by birth year: Elders (before 1965) · Gen X (1965–80) · Millennials (81–96) · Gen Z (97–2012) · Gen Alpha (2013+, grouped with Gen Z).
- If a generation only has one player, tap **Old School vs. New School** to merge.
- Tap a player to move them to another team. Tap a team name to rename it.

**Round 1.** Click a tile. The question shows on the TV and on the phones, and buzzers unlock after a short read (or press **Open Buzzers**). Buzzing early gets a 1-second **false start** lockout.
- The winner of the buzz has **10 s** to tap a choice on their phone. For spoken answers, the host taps **✅ / ❌**.
- A miss opens a **5 s steal** for the other podium(s).
- **Family Huddle 📞:** 2 per team per game. It adds 15 s for the bench to help.
- **Card Check** misses get the **CARD REVOKED!** slam.
- The podium rotates after every question, so everybody plays.

**Round 2.** Each mini-game gets an intro card. **Skip Segment** skips one you don't want.
- **Family Survey:** needs at least 3 people to have answered a survey question on their phone (the lobby shows the count). Board tiles are tappable for the host: tap a hidden answer to award it (and erase the strike that just happened). **❌ Strike** (or `X`) gives a strike by hand. **👁 Peek** shows the whole board to the host.
- **Culture Charades:** **▶ Start Clock** for each team's actor, then **Time!** to end early, then **Next Team**.

**🎉 Party games (laughs, arguments, receipts).** These four mix into Round 2 and run Party Night:
- **Settle It!** A hot take hits the screen ("Raisins belong in potato salad"). Everybody votes **Agree / Disagree**. Then one player from each side gets **20 seconds** to argue. If nobody took a side, someone plays devil's advocate. Then everybody votes again. The side that **gains ground** wins its speaker's team **+200**.
- **Who in the Family…?** "Who's most likely to show up two hours late to the cookout?" Everybody votes for a player (not themselves). If you pick who the room picks, your team gets **+50**. The "winner" gets crowned on the TV.
- **Top That!** Everybody finishes a sentence on their phone. Answers show up anonymously, and everyone votes for the funniest (you can't vote for your own). Each vote is worth **+50**, and the room favorite gets **+100** more. The host can tap **🙈** on any answer to hide it (on the TV or the remote, which also shows who wrote what).
- **Two Truths & a Lie.** A rotating teller secretly types two true things and one lie on their phone. Everybody else votes on the lie. Catch it and your team gets **+50**. The teller's team gets **+50 for every person fooled**. Teammates can vote, but they don't score.

**Show format (lobby → Show).**
- **Classic Show** runs the Board, then the Remix, then the Final Wager.
- **Party Night** has no board. It's a long run of party games plus Mama Said, Charades, One's Gotta Go and more, then it crowns the champions.
- **Trivia Only** leaves out the four party games.
- **Games** chips switch any Round 2 game on or off.
- **Remix** Short / Normal / Long sets how many of each game you play.

**📺 Season mode (play for hours).** On the champions screen, tap **📺 Next Episode (same teams)**. Scores reset with fresh questions, and the **Season Standings** keep adding up wins and points by team name. It also shows in the lobby, with a **Reset season** button. New awards: 🎤 The Closer, 😂 Family Comedian, 🤥 Smooth Liar, 👑 Most Likely Legend.

**🆕 Always different.** The TV remembers what it has already shown. Questions, survey prompts, charades clues and party prompts are dealt **unseen first** across game nights, and only repeat after you've used them all. Each new game picks a fresh board, weighted toward categories with the most unplayed questions. The lobby shows how many questions this TV hasn't played yet. When it runs low, **Start fresh** resets the history.

**Round 3.** Captains wager privately (from $0 up to their score, or up to $500 if behind) and then type an answer. The host judges each team's answer with ✅ / ❌, lowest score first.

**📱 Host Remote (recommended).** Tap **📱 Remote** on the TV and scan the QR with *your* phone. You can then run the whole show from your hand: pick board tiles, open buzzers, ✅/❌, skip, pause, award Family Survey answers, adjust scores, and judge the Final Wager. It also **shows you the answer privately** (plus the hidden ★ Family Wager tiles and the full survey board), so nobody sees it on the TV. Keep that QR to yourself.

**🎡 Sankofa Spin.** Every 6 board tiles, the team in control spins the prize wheel from its podium player's phone. Prizes: +200 · Double the next question · +1 Family Huddle · Cookout (+100 for every team) · +300 · Spin again.

**Host controls (bottom bar).** Next · ✅/❌ · Skip · 👁 Peek (shows the host the answer for ~2 s) · Pause · ± Scores (manual adjust for family debates) · Undo Last Points · Sound · End Game.

**Keyboard.** `Space`/`Enter` = Next / Open Buzzers · `C` = Correct · `X` = Wrong · `P` = Pause · `S` = Skip.

**If a phone sleeps or refreshes, it rejoins automatically as the same player.** If someone switches phones, they can join again with the **same name** and take back their seat.

---

## 5. Family Questions

In the lobby, tap **✏️ Family Questions**. You can add questions one by one, or **import JSON/CSV**.
- Use one of the 6 built-in categories to mix your questions in, **or** make your own category (e.g. *Family History*). Once it has at least 5 questions, it shows up in the lobby's **Board** picker.
- CSV columns: `category, value, generationEra, prompt, choiceA, choiceB, choiceC, choiceD, answer, culturalContext`
- Custom questions are saved in the host computer's browser. Use **Export** to back them up.

To edit the built-in bank, change `data/questions.json` (each entry has the fields `id, round, category, value, questionType, generationEra, difficulty, prompt, choices, answer, acceptAlso, culturalContext, needsReview`).

---

## 6. Art (Gemini)

See **`GEMINI_ART_PROMPTS.md`**. Drop the images into `assets/` with the listed filenames. Magenta backgrounds are removed and sprite sheets are cut automatically. Anything missing uses the built-in art.

## 7. Art & Animation Studio

Open **`studio.html`** (e.g. `…/generations/studio.html`). It shows every art slot, whether your Gemini image is loaded, the full icon sheet with names, a sound board, an avatar expression lab, and a button for every animation in the game (show open, round cards, stamps, crossover, buzzer shockwave, reactions, crowd). **`ANIMATION_SPEC.md`** lists every animation, what triggers it, how long it runs, and which art slot upgrades it.

## 8. Avatar swap (Money Moves / Smith's Classroom 2.0)

`js/avatar.js` → `renderAvatar(avatarData, expression, sizePx)` returns an HTML string. Replace its body with your layered-PNG renderer, using the same signature. Expressions used: `idle`, `focused`, `cheer`, `sweat`, `gasp`. The phone picker options live in `AVATAR_OPTIONS` in the same file.

---

## Files

```
index.html            landing page (Host / Join)
remote.html           📱 Host Remote (private answer key + every host button)
studio.html           Art & Animation Studio (preview art + trigger every animation)
ANIMATION_SPEC.md     every visual moment, its trigger and its art slot
host.html             big-screen host view
play.html             phone controller
js/engine.js          game rules, scoring, timers (runs on the host)
js/party.js           Party games (Settle It!, Who in the Family, Top That!, Two Truths) + Season mode
js/host.js            host screen UI + controls
js/play.js            phone UI
js/transport.js       Firebase + local demo sync
js/config.js          ← paste your Firebase keys here
js/avatar.js          layered SVG avatars (swap point)
js/assets.js          Gemini art loader (magenta keying + sheet slicing)
js/audio.js           synthesized sound effects (no audio files)
js/fx.js              confetti, stamp slam, shockwave, banners
js/editor.js          Family Questions editor
data/questions.json   question bank (739: 504 board questions in 22 categories + 235 Round 2/Final)
data/extras.json      Survey prompts, charades clues, hot takes, "most likely to" + Top That! prompts (edit freely)
database.rules.json   Firebase security rules
vendor/               bundled Firebase SDK + QR code generator
fonts/                Bungee + Outfit (SIL Open Font License)
assets/               put Gemini art here
```
