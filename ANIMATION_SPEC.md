# GENERATIONS — Graphics & Animation Spec
*Lead designer's map of every visual moment in the show: what triggers it, how long it runs, what it's built from today, and which Gemini art slot upgrades it.*

**How the pieces fit:**
- **Motion is code** (CSS/canvas in `css/styles.css` and `js/fx.js`). It already works and stays the same no matter what art you add.
- **Art is Gemini images** dropped into `assets/`. Each one replaces a built-in drawing.
- **`studio.html` plays every animation with whatever art is loaded,** so you can check new art in motion before game night.

## Look
- **Style:** flat vector cartoon, thick `#2B2B2B` outlines, one shade tone, slight 3/4 view (matches Smith's Classroom 2.0).
- **Palette:** obsidian `#151515` · navy `#1A1B3A` · gold `#F2B632` · crimson `#C8102E` · emerald `#1E9E5A` · cream `#FFF6E5` · violet `#5B3FA0` · teal `#12A4A4`.
- **Type:** Bungee for display, Outfit for body. Both are bundled locally.
- **Motifs:** kente stripe bands, spotlight sweeps, gold LED trim.

## Show moments

| # | Moment | Trigger | Length | Built from today | Art slot |
|---|---|---|---|---|---|
| 1 | **Show Open:** curtains part, "Live from the living room…", logo slam, teams fly in with VS, "Round 1" pill | Host taps **Start the Show** | 7 s (tap to skip) | CSS curtains + text logo + team cards with avatars | `curtain.png`, `logo.png` |
| 2 | **Round title card:** kente band sweeps across, ROUND N slams in | Start of Round 2 and Round 3 | 2.8 s | CSS kente gradient | — (all code) |
| 3 | **Card flip:** board tile turns into the question card | Tile picked / next question | 0.7 s | CSS 3D rotateY | — |
| 4 | **Buzzer shockwave:** gold/crimson ring from the winning podium | First buzz | 0.9 s | CSS box-shadow ring | — |
| 5 | **Spotlight on:** light cone over the podiums that can buzz | Buzzers open | live | CSS radial gradient | `stage_bg.png` sets the mood |
| 6 | **Avatar expressions:** focused → sweat (under 3 s left) → cheer / gasp | Every question | live | Layered SVG avatar + CSS motion | Money Moves avatar swap |
| 7 | **CARD REVOKED! / CARD SAVED!:** rubber-stamp slam with screen shake | Card Check miss / hit | 2.4 s | CSS text stamp | `stamps.png` |
| 8 | **STEAL!:** crimson banner | First answer wrong | 1.3 s | CSS banner | — |
| 9 | **Generation Crossover:** gold banner, name and bonus, confetti, crowd cheer | Correct answer on another generation's question | 2.2 s | CSS banner + canvas confetti | — |
| 10 | **Family Huddle:** violet ribbon on the card, timer extends | Lifeline used | 15 s | CSS | — |
| 11 | **Family Wager splash:** pulsing "FAMILY WAGER!" | Hidden tile found | until wager | CSS | — |
| 12 | **Majority bars:** vote bars grow to their counts | Votes revealed | 1.2 s | CSS width transition | — |
| 13 | **Blitz:** 3-2-1 countdown, team lanes flash green/red on every answer, "TIME!" | 60-Second Blitz | 63 s | CSS lanes + countdown | `icons_sheet` #23 bolt |
| 14 | **Live reactions:** emojis with player names float up the TV | Any phone taps the reaction bar | 3–4 s each | CSS float (max 40 at once) | — (native emoji) |
| 15 | **Studio crowd:** silhouettes bounce on cheers, sink on gasps, bob on reactions | correct / wrong / revoked / reactions / round cards | 0.5–4 s | SVG silhouettes | `crowd.png` |
| 16 | **Confetti:** gold/crimson/emerald burst | Correct answers, round ends, crossover, champion | ~3 s | Canvas (max 150 pieces) | — |
| 17 | **Standings bars:** team bars grow from the floor | Round ends, champion screen | 1 s | CSS scaleY | — |
| 18 | **Champion ceremony:** trophy float, winners cheering, MVP / Bridge Builder / Master Thief awards pop in, triple confetti | Game over | live | Emoji trophy + CSS | `trophy.png` |
| 20 | **Host mascot:** pops up from the bottom-right with a speech bubble — presents, points, cheers, gasps | show open, round cards, buzz, correct, wrong, revoked, steal, Family Wager, Blitz, segment intros, champion | 1.8–3.8 s (pinned on champion) | `fx.js` mascotSay() | `host_mascot.png` ✅ |
| 21 | **Animated avatars:** 4-frame loops per expression (Gold Jacket) | Player picks "✨ Gold Jacket" on their phone | live | SVG `<animate>` stepping through a strip | `avatar_*.png` ✅ |
| 22 | **Theme backdrops + confetti colors** | Lobby → Theme | — | `applyTheme()` in host.js | `stage_bg_*.jpg` ✅ |
| 23 | **Family Survey board:** blue numbered tiles flip to cream answer cards; giant red ✕ strikes (screen shake on the third); "TEAM has the board!" banner | Survey round | 0.5–1.3 s | CSS | — (future: Gemini survey board frame) |
| 24 | **Charades counter:** huge count with timer, recap chips (✓ got / ↷ skipped) | Charades | 45 s per team | CSS | `icons_sheet` #20 masks |
| 25 | **🔥 ON FIRE / UNDERDOG banners** + flames on the podium | Streak of 3+ / trailing team scores | 1.9 s | CSS | — |
| 19 | **Score bump:** team score chip pops when it changes | Any score change | 0.6 s | CSS | — |

**Phones:** vibration patterns for buzz, correct, wrong, false start, crossover and champion. The buzzer pulses when it's live and turns gold when you win the buzz. Phones play **no** sounds, so the TV is the only speaker.

**Sound** (all generated by `js/audio.js`, no audio files): buzz · correct · wrong · record scratch · stamp thud · ticks under 5 s · card flip · join chime · reveal · vote blip · whoosh · fanfare.

**Accessibility:** `prefers-reduced-motion` turns shakes and confetti into simple fades. Every timer also shows a number, not just a shrinking bar.

## Upgrade paths
1. ✅ **Animated avatar sprites:** done (Gold Jacket). Add more characters with `SPRITE_SETS` (see the Gemini prompt sheet).
2. ✅ **Round title art:** done (`round_frame.png` behind round cards, Round 2 intros and the Final intro).
3. ⬜ **Category reveal cascade:** board headers flip in one by one at the start of Round 1 (hook: `viewBoard` in `js/host.js`).
4. ✅ **Host mascot:** done.
5. ✅ **Theme packs:** done (Juneteenth, Christmas, Family Reunion). Add more with `THEME_FILES`.
