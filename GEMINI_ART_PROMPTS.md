# GENERATIONS — Gemini Art Prompts

> **Nov 26, 2026 additions:** Claude generated 3 more pieces in Gemini: `party_*.webp` (4 party-game scene badges), `stage_bg_party.jpg` (backyard-cookout Party Night stage) and `family_banner.webp` (four-generations lineup used in the lobby, team screen and phone join screen). The originals are in `art_src/`.
>
> **Status (Nov 2026):** ✅ All 9 core images and 5 extras (animated avatar, host mascot, round frame, 3 theme backdrops) are in `assets/` and wired into the game. Use the prompts below only to **redo** a piece, or see **"Adding more"** at the bottom to grow the cast.

**Art direction (from Claude, lead designer).** The game is already finished and playable with built-in art. These prompts only *upgrade* the look. Make whichever ones you like, in any order. Any image you skip just keeps the built-in version.

**Budget:** 9 prompts, so about 9 to 12 generations in total. Each prompt puts several pieces into **one image**, and the game cuts them apart automatically.

---

## How to use

1. Open a **new Gemini chat** and paste the **Style Lock** first, together with Prompt 1.
2. For each image you like: **download → rename it to the exact filename shown → drop it into the game's `assets/` folder.**
3. Refresh the host screen, or open **`studio.html`** to see every slot and play every animation with your new art.
   - **Magenta backgrounds are removed automatically.** Don't use a background remover.
   - **Sprite sheets are cut apart automatically.** Just keep a little magenta space between items.
   - `.png`, `.jpg` and `.webp` all work.

**If Gemini…**
- **adds a gray/white checkerboard** ("fake transparency"): reply *"Use a solid flat #FF00FF magenta background, no checkerboard."*
- **adds extra items or text:** reply *"Exactly N items, no labels, no extra text."*
- **touches or overlaps the items:** reply *"Keep wide magenta gaps between every item."*

---

## STYLE LOCK (paste this first, once per chat)

```
You are the illustrator for "GENERATIONS," a TV game show about African American culture, history, and family. Every image in this chat must use this exact style:
- Flat vector cartoon. Thick #2B2B2B charcoal outlines (heavy, even weight). Bright flat fills with ONE soft shade tone per shape. Slight 3/4 view. Clean, bold, readable from across a living room.
- NO pixel art, NO photorealism, NO gradients except subtle glows, NO real people, NO logos or brands, NO copyrighted characters.
- Palette: obsidian #151515, royal navy #1A1B3A, royal gold #F2B632, crimson #C8102E, emerald #1E9E5A, warm cream #FFF6E5, violet #5B3FA0, teal #12A4A4.
- Afro-modern accents are welcome: kente-style stripes, mudcloth patterns, Adinkra-inspired shapes.
- When I ask for a magenta background, it must be a SOLID flat #FF00FF fill edge to edge, no shadows on it, no checkerboard.
Reply "Ready" and wait for my first request.
```

---

## Prompt 1: Stage backdrop → `stage_bg.png`

```
Image 1. Wide 16:9 landscape, 1920x1080. A glowing, curved TV game-show stage seen from the audience. Deep royal navy and obsidian backdrop, a curved gold LED trim arc across the floor, two big soft spotlight beams angled in from the upper corners, faint kente-stripe pattern on the back wall panels, subtle sparkles. The center and the top two-thirds must stay fairly dark and EMPTY (text and cards go there). No podiums, no people, no text, no logos.
```

## Prompt 2: Title logo → `logo.png` *(optional)*

```
Image 2. The word "GENERATIONS" as a bold game-show title logo, all caps, chunky rounded display letters in royal gold with a crimson drop shadow and thick charcoal outline, a small crown over the letter "O", a thin kente stripe underline. Spell it exactly G-E-N-E-R-A-T-I-O-N-S. Centered on a solid flat #FF00FF magenta background with wide margins. Nothing else in the image.
```
> If the spelling comes out wrong even once, skip this one. The built-in text logo already looks good.

## Prompt 3: Podium → `podium.png`

```
Image 3. ONE sleek game-show contestant podium, straight-on front view, slightly wider than tall. Navy body with gold trim edges, a large blank dark rectangular LED screen panel across the upper front (leave it completely empty, it will show names and scores), a small kente stripe band near the base. Centered on a solid flat #FF00FF magenta background with wide margins. No text, no person.
```

## Prompt 4: Category icon sheet → `icons_sheet.png`

```
Image 4. A sprite sheet of EXACTLY 24 icons in a 6-column by 4-row grid, evenly spaced, each icon the same size, with WIDE solid #FF00FF magenta gaps between them and a solid flat #FF00FF magenta background. No labels, no text. In this exact order, left to right, top to bottom:
Row 1: (1) retro boombox, (2) vintage stage microphone, (3) retro tube TV with rabbit-ear antennas, (4) bunch of colorful party balloons, (5) Sankofa bird looking back over its shoulder, (6) gold crown with laurel wreath
Row 2: (7) gold "black card" (a playing card with a small heart), (8) red rubber stamp, (9) spades playing card, (10) slice of sweet potato pie, (11) bold hashtag symbol, (12) cassette tape
Row 3: (13) movie clapperboard, (14) vinyl record with a gold label, (15) basketball, (16) small white country church with a steeple, (17) a house slipper (the one Mama throws), (18) gold star
Row 4: (19) graduation cap with gold tassel, (20) comedy and tragedy theater masks, (21) black cast-iron skillet with cornbread, (22) pair of shiny dancing shoes, (23) gold lightning bolt, (24) cool smiley face wearing sunglasses
```
> **Order matters.** It's how the game knows which icon goes with which category. Open `studio.html` after you drop the sheet in. It shows each icon with its name, so you can see right away if anything landed in the wrong spot. If 24 is too many for one image, ask for **two images of 12 (4×3 each)** and stack them in a photo editor: the first 12 on top, the second 12 below.

## Prompt 5: Stamps → `stamps.png`

```
Image 5. TWO rubber-stamp impressions side by side with a wide magenta gap between them, on a solid flat #FF00FF magenta background. LEFT: a crimson #C8102E stamp reading "CARD REVOKED!" in heavy distressed block letters inside a thick rectangular border, slightly tilted. RIGHT: an emerald #1E9E5A stamp reading "CARD SAVED!" in the same style. Inky, grungy stamp texture, cream fill behind the letters. Spell the words exactly. No other text.
```

## Prompt 6: Generation crests → `badges_sheet.png`

```
Image 6. EXACTLY 5 shield-shaped badges in ONE horizontal row, evenly spaced, same size, wide magenta gaps, solid flat #FF00FF magenta background, no text, in this order:
(1) Gold #F2B632 shield with a crown (the Elders)
(2) Crimson #C8102E shield with a boombox (Gen X)
(3) Violet #5B3FA0 shield with a flip phone (Millennials)
(4) Teal #12A4A4 shield with a lightning bolt (Gen Z)
(5) Teal #12A4A4 shield with a star (Gen Alpha)
```

## Prompt 7: Champion trophy → `trophy.png`

```
Image 7. ONE tall gold championship trophy cup with two handles, a small Sankofa bird on top of the lid, an emerald ribbon tied around the stem, a navy base with a kente stripe band, sparkles around it. Centered on a solid flat #FF00FF magenta background with wide margins. No text.
```

## Prompt 8: Studio audience → `crowd.png`

```
Image 8. A very wide panoramic strip (about 4:1) of a cheering TV studio audience seen from behind, as dark navy (#0b0c1f) silhouettes with a thin warm gold rim light: two overlapping rows of heads and shoulders, a mix of afros, puffs, locs, braids, fades, church hats and baseball caps, a few hands raised. Flat vector, no faces or details visible, no text. Solid flat #FF00FF magenta background above and between the people.
```
> The crowd sits along the bottom of the TV screen. It bounces when somebody gets one right and gasps at a CARD REVOKED!

## Prompt 9: Show-open curtain → `curtain.png`

```
Image 9. Wide 16:9, 1920x1080. A closed, rich crimson velvet theater stage curtain filling the entire frame, deep folds, a gold-fringed valance across the top, and a thin kente-pattern trim along the bottom hem. Dramatic soft lighting. No text, no logo, no people.
```
> The game splits this image down the middle and opens it like real curtains at the start of every show.

---

## Checklist

| File | Used for | Required? |
|---|---|---|
| `stage_bg.png` | Backdrop behind every host screen | Nice to have |
| `logo.png` | Title on lobby + landing page | Optional |
| `podium.png` | Contestant podiums (tinted per team automatically) | Nice to have |
| `icons_sheet.png` | Category icons on the board and question cards | Nice to have |
| `stamps.png` | CARD REVOKED! / CARD SAVED! slam | Nice to have |
| `badges_sheet.png` | Generation badges in the lobby | Optional |
| `trophy.png` | Champion ceremony | Optional |
| `crowd.png` | Studio audience along the bottom | Nice to have |
| `curtain.png` | Show-open curtains | Optional |

**Avatars aren't on this list on purpose.** The game draws its own layered avatars, which change expression live (focused, cheering, sweating, gasping). To use your Money Moves avatars instead, see "Avatar swap" in the README.


---

## Adding more (already supported by the code)

**Another animated character** (players pick it on their phone under "Style"):
Make 4 strips of the same character. Each strip has **4 poses in a row, evenly spaced, on solid #FF00FF magenta, about 2064×512**:
`avatar2_focused.png` (thinking), `avatar2_cheer.png` (celebrating), `avatar2_sweat.png` (nervous, sweat drops), `avatar2_gasp.png` (shocked).
Then add one line to `SPRITE_SETS` in `js/assets.js`: `{ id: 'auntie', name: 'Auntie', prefix: 'avatar2_' }`.

```
A sprite strip of EXACTLY 4 poses of the SAME character in one horizontal row, evenly spaced, same size and same framing (waist up), solid flat #FF00FF magenta background, no text. Character: [describe — e.g. a stylish Black auntie in her 50s with a short silver natural cut, gold hoop earrings and an emerald church dress]. Expression for all 4 frames: [CHEERING — fists up, laughing, small bounce between frames]. Same style lock as before.
```

**Another theme backdrop:** save as `stage_bg_<name>.jpg` and add it to `THEME_FILES` in `js/assets.js`, plus a button label in the lobby theme list in `js/host.js`. Good next ones are Kwanzaa, Homecoming and Black History Month.

**Mascot poses:** `host_mascot.png` is 4 poses in a row, in this order: presenting, pointing, cheering, gasping. Keep that order if you redo it.
