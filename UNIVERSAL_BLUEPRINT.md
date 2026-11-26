# GENERATIONS: Universal Edition, Build Blueprint

**What this is:** a step-by-step script for turning the GENERATIONS family game show (built for African American culture and history) into a **universal engine** that any family, classroom, church, company or culture can run with its own content.

**What stays:** the original African American edition stays exactly as it is. It becomes the first **Culture Pack** on the new engine, the flagship and the proof that the engine works.

**Who this is for:** a future build session (Claude Code or a developer). Each phase ends with something that runs and can be tested.

---

## 1. The core idea in one sentence

> **The engine knows how to run a game show. A Culture Pack knows what to talk about.**

Everything that is specific to one culture (questions, categories, slang, sayings, foods, songs, art, mascot lines, team names, generation labels, theme colors) moves out of the code and into a **pack folder**. The engine never hard-codes culture again.

---

## 2. What we already have (and keep)

Everything below already works in GENERATIONS today and carries over as-is.

| Piece | Today | Universal version |
|---|---|---|
| Host TV screen | `host.html` + `js/host.js` | Same, reads labels and art from the active pack |
| Phone buzzers | `play.html` + `js/play.js` | Same, plus pack theme colors |
| Host Remote | `remote.html` (Simple/Full, sound pad, +10s) | Same, sound pad labels come from the pack |
| Game rules | `js/engine.js`, `js/party.js` | Same, with zero culture text inside |
| Live sync | Firebase RTDB + BroadcastChannel demo | Same |
| Remote play | chat, voice notes, WebRTC video, watch screen | Same |
| Practice Run (group) | `data/practice.json` | Per-pack `practice.json` |
| Practice Academy (solo) | `learn.html` + `js/learn.js` | Same; bot names and art come from the pack |
| Side game | `cookout.html` (Invited to the Cookout) | Becomes a **pack mini-game slot** (each pack can ship its own) |
| Art pipeline | Gemini art on magenta, keyed in the browser | Same, with a per-pack art checklist |
| Question freshness | seen-tracking + decks | Same, keyed per pack |

**The games (all carry over):** Buzz-In Trivia board, Family Wager, Sankofa Spin (renamed per pack), Majority Rules, Family Survey, Mama Said (sayings), Emoji Decode, Hashtag Decode, Name That Era, One's Gotta Go, 60-Second Blitz, Culture Charades, Settle It!, Who in the Family…?, Top That!, Two Truths & a Lie, Sing It!, Hum That Tune, Final Wager, Season mode, awards.

---

## 3. The Culture Pack format

One folder per pack. Nothing else in the repo needs to change to add a new culture.

```
packs/
  black-american/          ← the current game, moved here
    pack.json
    questions.json
    extras.json
    practice.json
    art/
    sidegame/ (optional)
  latino-familia/
  caribbean/
  southern-family/
  classroom-us-history/
  church-youth/
  office-team/
  blank-template/          ← copy this to start a new pack
```

### 3.1 `pack.json` (the identity of a pack)

```json
{
  "id": "black-american",
  "title": "GENERATIONS",
  "subtitle": "The Family Game Show · Culture · History · Generations",
  "language": "en-US",
  "audience": "family",
  "maturity": "family",
  "theme": {
    "colors": { "gold": "#F2B632", "crimson": "#C8102E", "navy": "#1A1B3A", "teal": "#12A4A4" },
    "fonts": { "display": "Bungee", "body": "Outfit" },
    "pattern": "kente-strip"
  },
  "generations": [
    { "id": "elders", "label": "Elders", "nick": "OGs", "from": 0, "to": 1964, "icon": "👑" },
    { "id": "genx", "label": "Gen X", "from": 1965, "to": 1980, "icon": "📻" },
    { "id": "millennial", "label": "Millennials", "from": 1981, "to": 1996, "icon": "📱" },
    { "id": "genz", "label": "Gen Z", "from": 1997, "to": 2012, "icon": "⚡" },
    { "id": "alpha", "label": "Gen Alpha", "from": 2013, "to": 9999, "icon": "🧃", "groupWith": "genz" }
  ],
  "gameNames": {
    "sayings": "Mama Said",
    "spin": "Sankofa Spin",
    "majority": "Majority Rules",
    "survey": "Family Survey",
    "huddle": "Family Huddle",
    "wager": "Family Wager",
    "final": "Final Wager"
  },
  "spinPrizes": ["+200", "DOUBLE NEXT", "+1 HUDDLE", "COOKOUT! +100 ALL", "+300", "SPIN AGAIN"],
  "teamNames": ["The Cookout Kings", "Kitchen Table Council", "Electric Slide Crew"],
  "mascot": { "name": "the host", "lines": { "correct": ["…"], "wrong": ["…"], "steal": ["…"] } },
  "bots": [
    { "id": "grandma", "name": "Grandma Pearl", "art": "art/bot_grandma.webp" },
    { "id": "uncle", "name": "Uncle Ray", "art": "art/bot_uncle.webp" },
    { "id": "auntie", "name": "Auntie Dee", "art": "art/bot_auntie.webp" }
  ],
  "reactions": ["👏🏾", "🔥", "😂", "🙌🏾", "😱", "🤦🏾", "💯", "🃏"],
  "soundPad": ["applause", "ooh", "drumroll", "airhorn", "laugh", "crickets", "boo", "church"],
  "sidegame": { "title": "Invited to the Cookout", "path": "sidegame/index.html" },
  "credits": "Content reviewed by …"
}
```

**Rule:** if a word shows up on screen and it's about a culture, it lives in `pack.json` or the pack's data files. The engine only stores neutral defaults ("Sayings", "Bonus Spin", "Team Huddle").

### 3.2 `questions.json` (same shape as today, plus 3 fields)

Every question keeps today's fields (`id`, `round`, `category`, `value`, `questionType`, `generationEra`, `difficulty`, `prompt`, `choices`, `answer`, `acceptAlso`, `culturalContext`) and adds:

- `pack`: the pack id (so mixed packs can be played together later).
- `reviewed`: who checked it and when (`"reviewed": "EJS 2026-11"`).
- `sensitivity`: `"none" | "history" | "heavy"`. **Heavy** topics (violence, slavery, war, tragedy) need a respectful `culturalContext` and never get a jokey answer choice. A host setting can switch heavy topics off for little kids.

### 3.3 Generations are configurable

Different cultures and countries name their generations differently, and a classroom may want "Grade 9 vs Grade 12" instead. The `generations` list in `pack.json` replaces the hard-coded `GENERATIONS` object in `js/util.js`. Team-split options ("Old Heads vs Young Bucks", "Grandparents & Grandkids vs The Parents") read their labels from the pack too.

---

## 4. Build script (the phases)

Each phase is small enough for one focused session. **Run the full test suite at the end of every phase** (see section 6).

### Phase 1: Pull culture out of the code (no new features)
1. Create `packs/black-american/` and move `data/questions.json`, `data/extras.json`, `data/practice.json` and the culture art into it.
2. Write `pack.json` for it using everything that's hard-coded today. Search the code for culture words: `grep -n "Mama Said\|Sankofa\|Cookout\|Big Mama\|Grandma\|👏🏾" js/*.js`.
3. Add `js/pack.js`: `loadPack(id)` fetches `pack.json` + data files and exposes `PACK` (theme, names, generations, bots, lines).
4. Replace every hard-coded label in `engine.js`, `party.js`, `host.js`, `play.js`, `remote.js`, `learn.js` with `PACK.gameNames.x || 'Neutral default'`.
5. Apply `PACK.theme` as CSS variables at boot.
6. **Done when:** the game looks and plays *exactly* like today, and the chaos test passes, but `grep` finds no culture words in `js/`.

### Phase 2: Pack picker
1. The host lobby gets a **"Choose your edition"** card grid (title, cover art, a one-line pitch, the number of questions).
2. The room publishes `s.pack` so phones and the remote load the same pack.
3. The URL can force a pack: `host.html?pack=caribbean`.
4. Seen-tracking and decks are keyed by pack (`gen-seen-<pack>`).
5. **Done when:** two packs can be switched between with a page reload, and phones follow the host.

### Phase 3: The blank template + the Pack Builder
1. `packs/blank-template/` with 1 example of every question type and every extras list.
2. `builder.html`: a no-code editor for a pack (extends today's Family Questions editor):
   - forms for each question type with live phone preview,
   - an import box: paste a spreadsheet (CSV) with columns `category, value, era, prompt, A, B, C, D, answer, context`,
   - a validator (see section 5) with red/yellow/green checks,
   - **Export pack** (zip) and **Publish to my rooms** (saved in Firebase under the host's account).
3. **Done when:** a teacher can build a 30-question pack from a spreadsheet in 15 minutes.

### Phase 4: Starter packs (content work, not code)
Build each with the content checklist in section 5. Ship at least 300 questions + 50 of each party deck per pack before calling it live.

| Pack | Audience | Notes |
|---|---|---|
| **Black American** (flagship) | families | today's game |
| **Latino Familia** | families | bilingual EN/ES prompts; *dichos* instead of "Mama Said"; Spanish UI option |
| **Caribbean Yard** | families | Jamaica, Trinidad, Haiti, etc.; carnival, soca, food |
| **Southern Sunday** | families | church, Southern food, country & gospel |
| **Classroom: U.S. History & Government** | grades 8-12 | ties to the classroom games already built; no party decks with grown-up humor |
| **Faith & Fellowship** | church youth/families | Bible trivia, hymns for Sing It! |
| **Office Party** | coworkers | no family assumptions; team building |
| **Everybody's Family** | anyone | general pop culture across decades (the most "universal") |

### Phase 5: Language support
1. Move all UI text into `i18n/en.json`, `i18n/es.json` (start with the strings in `play.js`, the most-read screen).
2. The pack sets the default language; each phone can switch with one tap (like the **Aa** big-text toggle).
3. Questions can carry `prompt_es`, `choices_es`. The phone shows the player's language; the TV shows the pack's language.

### Phase 6: Mixed-pack nights and "Generations Across Cultures"
1. Allow 2+ packs in one game (e.g., a blended family): the board takes categories from each pack, labeled with a small flag/icon.
2. New award: **Culture Crossover** (like today's Generation Crossover), a bonus for answering another culture's question.

### Phase 7: Side games per pack
`cookout.html` becomes a template: lane runner + RSVP mat. Each pack supplies its own sprites and names (a *quinceañera* dance floor, a carnival road march, a church picnic, an office pizza party). Same code, new `sidegame.json` + art.

### Phase 8: Polish & launch
- Landing page with an edition gallery and a 30-second trailer per pack.
- `how-to-play.html` generated from the pack (game names change per pack).
- Analytics (privacy-friendly, counts only): games started, which games get skipped, average session length.
- Accessibility pass: contrast, screen-reader labels, captions for voice notes, big-text default for Elders.

---

## 5. Content rules (for every pack)

**Accuracy**
- Every fact question needs a source in the reviewer notes, and a second person checks it.
- Avoid "first/only/best-selling" claims unless the source says so plainly.
- Dates and numbers are the most common mistakes: check them twice.

**Respect**
- People of a culture write and review that culture's pack. Use a review panel of at least 3 people across at least 3 generations.
- Humor punches up and laughs *with* the family, never at a group. No stereotypes as answer choices.
- Heavy history (`sensitivity: heavy`) is taught, not joked about.

**Balance**
- Spread questions across generations: roughly 25% for each era group, plus "all."
- Each board category needs at least 5 questions per value tier (100-500) so the board never runs dry.
- Every party deck (hot takes, most likely, top that, sing words, hum songs, charades, survey) needs 50+ entries.
- Practice content lives only in `practice.json` and never shows up in a real game (the validator enforces this).

**Validator checks (Pack Builder + a CLI script)**
- duplicate or near-duplicate prompts (keyword overlap ≥ 60%), within the pack and against the practice file
- every multiple-choice question has 4 choices and a valid answer letter
- `acceptAlso` exists for every typed answer (Final Wager)
- category × value coverage table
- generation spread chart
- reading level (flag prompts over 25 words)

---

## 6. Tests that must pass at every phase

These already exist in `tools/` and get extended with a `--pack` flag:

| Test | What it proves |
|---|---|
| `playtest.py` | a full Classic Show with 4 phones, every round |
| `partytest.py` | Party Night + Season mode |
| `practicetest.py` | Practice Run never touches seen-tracking or Seasons |
| `chaostest.py` | random taps from host, remote and 5 phones in every format reach the champion screen with zero errors |
| `learntest.py` | every Practice Academy lesson finishes |
| `cooktest.py` | the side game runs on phone and desktop |
| `socialtest.py`, `singtest.py`, `surveytest.py` | remote play, Sing It!/Hum, Family Survey |
| **new** `packtest.py` | every pack loads, validates, and runs a short chaos game |

---

## 7. Gemini art checklist per pack

All art follows the current pipeline: flat `#FF00FF` magenta background, nothing touching, keyed in the browser.

- Logo / title card (wide)
- Stage background (16:9) + one party-night variant
- Family banner (4 generations cheering)
- Host mascot (5 poses)
- 3 practice bots (chibi, full body)
- Round title cards
- Category icons (one per category)
- Side-game sheets: 12 "invited" items, 8 guests, 6 "uninvited" hazards, 2 power-ups, player run frames
- Share card (1200×630) for group chats

---

## 8. Data model changes (summary for the engine)

- `s.pack` (string) added to the room state.
- `GENERATIONS` constant → `PACK.generations`.
- `REMIX_PLAN` labels/blurbs → `PACK.gameNames` + neutral fallbacks.
- `WHEEL` prize labels → `PACK.spinPrizes`.
- `onReact` allowed list → `PACK.reactions`.
- `hype` sound list → `PACK.soundPad` (sounds stay in `audio.js`; the pack only picks which show up).
- localStorage keys prefixed by pack: `gen-seen-<pack>`, `gen-deck-<pack>-<key>`, `gen-season-<pack>`.

---

## 9. First prompt to start the build

> "Open the GENERATIONS repo. Read `UNIVERSAL_BLUEPRINT.md`. Do **Phase 1** only: move the content into `packs/black-american/`, add `js/pack.js`, and replace every hard-coded culture label with pack values and neutral fallbacks. The game must look and play exactly the same. Run every test in `tools/` and show me the results before and after."
