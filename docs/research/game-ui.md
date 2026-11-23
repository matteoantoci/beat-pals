# Game UI rules for Beat Pals: game feel, readability, safety, child design, performance, visual design

Researched on 2026-11-20. Style reviewed: `.scratch/prototypes/play-style/a/` (Gumball Gang). Measurements of style A come from its code (`index.html`) and from pixels of its screenshots (2x scale, so 1 CSS px is 2 image px). A claim with [INFERENCE] is my conclusion, not a statement of the source. A claim with [UNVERIFIED] has no source that I could read.

## Summary for Beat Pals

1. A hit must feel good in one frame: the ring and the pal react on `pointerdown`, a short sound sits on the beat, and the effect is gone in about 0.6 s. Do not shake the screen and do not freeze the notes (no hit-stop), because the hit line is the target.
2. Juice must point the eye at the hit line, not pull it away. Style A has too much motion outside the task: 9 background circles that drift and pulse, 3 pals that bob, notes that wobble, and hit effects that cover the next lane.
3. Flash safety: style A passes WCAG 2.3.1 only because hits come at most about 1.8 times each second. Make each hit flash small (a bright area of 8,700 CSS px² or less), never flash the full screen, and never flash saturated red.
4. The child cannot read, so all feedback is sound, shape, size, and motion. Lanes must differ by position and shape, not by color alone: with deuteranopia, berry and mint look almost the same.
5. On the iPhone 12, keep each frame under 16.7 ms, keep notes on time at 30 fps in Low Power Mode, draw with one texture atlas and object pools, and use one 4 px space scale, one radius scale, and one light direction for the whole game.

## 1. Game feel and juice

### What the sources say

- Jonasson and Purho define juice as "maximum output for minimum input". Their Breakout demo adds, in steps: color, tweens with easing, squash and stretch on the paddle and the ball, a white flash on the ball at each hit, sound, music, particles, screen shake, and eyes on the paddle ([Juice it or lose it, 2012](https://www.youtube.com/watch?v=Fy0aCDmgnxg)).
- In the same talk, sound is "the most cost-effective thing you can add to a game to make it juicier". Their example from Swink: two circles that pass through each other seem to bounce when a sound plays at contact ([Juice it or lose it](https://www.youtube.com/watch?v=Fy0aCDmgnxg)).
- They warn about screen shake: "I want you to be careful with this when you try it at home because it's... It's powerful!" ([Juice it or lose it](https://www.youtube.com/watch?v=Fy0aCDmgnxg)).
- Swink defines polish as "the interactive impression of physicality created by the harmony of animation, sounds, and effects with input-driven motion". For a squishy object, "A simple squash and stretch deformation is probably enough" ([Swink, Game Feel: The Secret Ingredient](https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient)).
- Nijman shows 30 small changes to a shooter: impact effects, a hit animation (the enemy turns flat white for a fraction of a second), screen shake, "sleep" (a pause of about 20 ms on a heavy hit), more bass in the sounds, and permanence of debris ([The art of screenshake, INDIGO 2013](https://www.youtube.com/watch?v=AJdEqssNZ-U); the video has no transcript, so the list comes from a secondary summary: [artificials.ch](https://artificials.ch/juice-up-your-game/)).
- Sakurai describes hit-stop: "When you strike the opponent, both parties momentarily freeze". He caps its length and keeps it short in free-for-all play, because a frozen pair gives a third player a free hit ([Sakurai, Thinking About Hitstop, translated](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/)).
- Anticipation is one of the 12 principles of animation, which the Juice talk lists as a reference ([talk description](https://www.youtube.com/watch?v=Fy0aCDmgnxg)). Style A already has anticipation: each pal opens its mouth 0.55 s before its note arrives (`notes.md`).

### When juice becomes noise

- In two studies (40 and 32 adults), visual embellishments made games more attractive but did not improve objective performance. One player said that the juicy version "was slightly more difficult as the animations meant slightly more to focus on" ([Hicks et al., CHI PLAY 2019](https://lirias.kuleuven.be/server/api/core/bitstreams/d201f21c-ed67-4f9d-9c87-821b4addd1f1/content)).
- Game developers in a survey said: "Juice should be used to direct the players attention, not divide it", and "The pleasure aspects should not detract from the others like too much screenshake" ([Hicks et al., DiGRA 2018](https://dl.digra.org/index.php/dl/article/download/936/936)).
- Apple: "Gratuitous or excessive animation can distract people". Feedback animation must be brief and precise, so that "players can instantly get the message without being distracted from their gameplay" ([Apple HIG, Motion](https://developer.apple.com/design/human-interface-guidelines/motion)).
- Xbox: avoid camera shake, or give an option to turn it off ([XAG 117](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117)).

### Rules for Beat Pals

- The hit line and the notes never move for effect. In a rhythm game the hit line is the target, so screen shake moves the target. Shake or squash only the pal or the ring [INFERENCE].
- No hit-stop. Each frame places the notes from the audio clock (decision 16), so a freeze would put the notes off the music. A short squash of the pal gives the same "weight" [INFERENCE].
- Layer each hit: (1) the ring pops (scale up to 1.15, then back) and brightens, (2) the pal squashes and bounces, (3) 6 to 10 sparkles, (4) the hit sound on the beat (P6). The sound is the most important layer ([Juice it or lose it](https://www.youtube.com/watch?v=Fy0aCDmgnxg)).
- Keep the main burst at 0.6 s or less and all hit effects at 1.2 s or less. At the fastest step (550 ms between notes) a longer effect overlaps the next note [INFERENCE from P12].
- A "great" hit (±100 ms, P4) gets a bigger effect than a "good" hit: more sparkles and a brighter sound. No text (section 2).

## 2. Rhythm game readability and feedback time

### Look-ahead time and note speed

- osu! (lazer) expresses osu!mania scroll speed as the time that a note is on screen: `ComputeScrollTime(scrollSpeed) => MAX_TIME_RANGE / scrollSpeed`, with `MAX_TIME_RANGE = 11485` ms, `MIN_TIME_RANGE = 290` ms, and a default speed of `8.0` ([DrawableManiaRuleset.cs](https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Mania/UI/DrawableManiaRuleset.cs), [ManiaRulesetConfigManager.cs](https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Mania/Configuration/ManiaRulesetConfigManager.cs)). So the adult default is about 1.44 s of look-ahead [derived].
- Beat Saber mappers: note jump speed "will affect both the spacing between notes and the timing windows provided for the player"; "Aim for the *lowest possible* value". For low difficulties, "be wary about putting too many notes on-screen at once". Typical Easy values are NJS 10 to 12 and jump distance 25 to 30 ([BSMG Wiki, Basic Mapping](https://bsmg.wiki/mapping/basic-mapping.html)).
- Children follow a cue that moves to a clear impact point better than a flash, but audio stays the main cue (see `child-rhythm-design.md`, section 1.5, with Repp 2005 and Iversen 2015).
- Style A uses `LEAD = 2.0` s in both orientations. The note speed is then about 278 CSS px/s (4.6 cm/s) in portrait and about 134 CSS px/s (2.2 cm/s) in landscape [derived from `layout()`].

Rule: keep the look-ahead time constant across orientations and screens, between 1.8 and 2.5 s, and let the speed in px/s change with the highway length [INFERENCE: longer than the adult default of 1.44 s, because a 4-year-old child reacts more slowly; test with the child].

### Note contrast, hit line, lanes

- WCAG 1.4.11: "Graphical Objects" and "User Interface Components" need "a contrast ratio of at least 3:1 against adjacent color(s)" ([Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Xbox asks 3:1 for large visual elements and 4.5:1 for standard ones ([XAG 102](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102)).
- Measured in style A (screenshot pixels, WCAG formula): berry note on the berry chute 4.5:1, lemon note on its chute 8.0:1, mint note on its chute 4.7:1; berry note on the light top of the background 3.2:1. The notes pass. The beat dots are 1.8:1 against the chute, and the empty progress beads are 1.06:1 against the background.
- Sesame Workshop: "Interactive elements (e.g., buttons, game objects) should be visually distinct", and "Objects should only look touchable when they are touchable" ([Sesame Workshop, Best Practices, 2012](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf)).
- Beat Saber mappers avoid "vision blocks": patterns that hide the notes that come next ([BSMG Wiki](https://bsmg.wiki/mapping/basic-mapping.html)). For Beat Pals, the same applies to hit effects: an effect must not cover the approach path of the next note [INFERENCE].

### Judgement feedback

- Taiko no Tatsujin gives "a GOOD, OK, or BAD for each note, depending on how well the note was lined up with the frame when you hit it" ([Taiko no Tatsujin, How to Play](https://taiko.namco-ch.net/taiko/en/howto/onpu.php)). osu!mania uses six text grades with windows from about 14 ms to 188 ms ([ManiaHitWindows.cs](https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Mania/Scoring/ManiaHitWindows.cs)). Just Dance shows word ratings, and Guitar Hero shows a flame on the fret [UNVERIFIED: no primary source read].
- A 4-year-old child cannot read the grade words ([Sesame Workshop](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf)). Children under 6 did not notice subtle face and sound cues in a game; NN/g recommends "exaggerated facial expressions" ([NN/g, Designing for Kids: Cognitive Considerations](https://www.nngroup.com/articles/kids-cognition/)).

Rule: two tiers only, "great" and "good", shown by size, sparkle count, and sound pitch. A miss shows nothing red and stops nothing (P5, decision 9).

### Feedback time: visual at once, audio on the beat

- Sesame Workshop: "Children expect immediate feedback from their touch", and "We recommend programming input registration upon touch rather than on lift" ([Sesame Workshop](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf)). Hirsh-Pasek et al.: "When each touch or swipe is met with an immediate response, children feel in control, maintain their focus, and continue the interaction" ([Hirsh-Pasek et al. 2015](https://kathyhirshpasek.com/wp-content/uploads/sites/9/2015/09/Psychological-Science-in-the-Public-Interest-2015-Hirsh-Pasek-3-34.pdf)).
- Rock Band calibrates audio and video separately, because "the audio and video may play at different times" ([Harmonix, Calibration](http://www.harmonixmusic.com/how-to-calibration)).
- ITU-R BT.1359: "detectability thresholds are about +45 ms to -125 ms and acceptability thresholds are about +90 ms to -185 ms", where a positive value means that the sound comes before the picture ([ITU-R BT.1359](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1359-0-199802-S!!PDF-E.pdf)). People accept a sound that comes late more easily than a sound that comes early.

Rule: draw the hit effect in the first frame after `pointerdown` (16.7 ms at 60 Hz, 33 ms at 30 Hz). Never wait for the audio. The hit sound follows P6. With AirPods (45 to 190 ms, `ios-pwa-audio.md`), the sound comes after the picture, which is the direction that people tolerate better [INFERENCE from BT.1359].

## 3. Seizure and flash safety

### The limits

- WCAG 2.3.1 (Level A): content does not flash "more than three times in any one second period, or the flash is below the general flash and red flash thresholds" ([Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)).
- A general flash is "a pair of opposing changes in relative luminance of 10% or more of the maximum relative luminance (1.0) where the relative luminance of the darker image is below 0.80". A flash is below the threshold if "the combined area of flashes occurring concurrently occupies no more than a total of .006 steradians within any 10 degree visual field on the screen (25% of any 10 degree visual field on the screen)" ([Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)).
- In CSS pixels, the 10° field is 341 x 256 CSS px (87,296 CSS px²), so 25% is 21,824 CSS px² [derived]. WCAG adds: "Users that are closer to their screens than the idealized viewing distance will be affected by flashing areas that normatively pass" ([Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)).
- Red flash (WCAG 2.2 note): one state has "R/(R + G + B) that is greater than or equal to 0.8" and the two states differ by more than 0.2 in CIE 1976 u'v' ([Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)).
- ITU-R BT.1702-3: a harmful flash is a change of "20 cd/m² or more" when the darker image is below 160 cd/m². A sequence is not permitted when the flashes cover "more than 25% of the displayed screen area" and there are "more than three flashes … within any one-second period". Flashes with leading edges "separated by 334 ms or more are acceptable in a 60 Hz environment". "Irrespective of luminance, a transition to or from a saturated red is also potentially harmful." "A sequence of flashing images lasting more than five seconds might constitute a risk even when it complies with the guidelines above" ([ITU-R BT.1702-3](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-3-202311-I!!PDF-E.pdf)).
- BT.1702-3 also says that the risk is higher in a darker room, on a brighter screen, and closer to the screen, and that photosensitivity "is reported as most prevalent among children and young people below the age of 20 years" ([ITU-R BT.1702-3, Annex 5](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-3-202311-I!!PDF-E.pdf)).
- Xbox XAG 118: a flash is a 10% change in luminance; failure when flashes are "approximately more than three per second" and take "approximately 20 percent or more" of the screen; a red flash applies when either extreme is "R/(R + G + B) >= 0.8"; "Lower intensity flashing can also cause a failure if it's continued for an extended period of time"; high-contrast stripes over about 20% of the screen also fail ([XAG 118](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118)).
- Game Accessibility Guidelines: avoid "More than three flashes* in a single second, covering 25%+ of the screen" and "Any sequence of flashing* images that lasts for more than 5 seconds". Never call a mode "epilepsy safe" ([GAG, Avoid flickering images](https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/)).
- Jordan and Vanderheiden: at the CSS reference pixel, "a circle with a diameter of 235 CSS px would be 0.006 steradian". Only 3% of 170 people with photosensitive epilepsy responded at 3 Hz, against nearly 90% at 16 Hz. The 1997 Pokémon episode used "12 Hz alternation between large red and blue fields" with a difference of only 25 cd/m² ([Jordan and Vanderheiden 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11872230/)).
- PlayStation publishes a consumer health notice ([PS5 Safety Guide](https://www.playstation.com/content/dam/global_pdc/en/corporate/support/manuals/ps5-docs/1000b-digital-edition/CFI-10XXB_PS5_Safety_Guide_EN_EXP.pdf)). I found no public PlayStation developer thresholds [UNVERIFIED].
- Test tools: the Harding test is a paid service ([GAG](https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/)). PEAT is free for web content ([Jordan and Vanderheiden 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11872230/)).
- iOS "Dim Flashing Lights" applies to video playback ([Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). It does not protect a game canvas [INFERENCE].

### Numbers for the iPhone 12 and a child

- The iPhone 12 has 2532 x 1170 px at 460 ppi and "625 nits max brightness (typical)" ([Apple, iPhone 12 specifications](https://support.apple.com/kb/SP830?locale=en_US)). So 1 CSS px is about 0.0166 cm (60.4 CSS px per cm) [derived].
- At full brightness, the WCAG step of 0.1 relative luminance is about 62 cd/m², three times the ITU step of 20 cd/m² [derived]. So a pulse with a change of 0.03 or more can count as a flash under ITU.
- 0.006 sr at a distance of 20 cm is 2.4 cm², which is about 8,700 CSS px² (a circle of about 105 CSS px). At 25 cm it is about 13,700 CSS px² [derived]. A 4-year-old child can hold the phone at 20 cm [UNVERIFIED].

### Limits for Beat Pals

| Effect | Limit | Reason |
|---|---|---|
| Any change with Δ relative luminance ≥ 0.1, or any saturated red transition | 3 or fewer in any 1 s window over the whole screen; flash starts 334 ms or more apart | WCAG 2.3.1, BT.1702-3 |
| Area of a bright hit flash (ΔL ≥ 0.1) | 8,700 CSS px² or less in total at any instant, doubles included (one disc of about Ø 105 CSS px) | 0.006 sr at 20 cm [derived] |
| Full-screen white flash on each hit | Do not use it. If a full-screen tint is necessary, keep its peak white alpha at 0.15 or less: on this palette, alpha 0.22 to 0.29 is where ΔL reaches 0.1 | Measured; a hit every 0.55 s for a full song is a sequence longer than 5 s (BT.1702-3) |
| Lane glow on a hit | Extra lane-color alpha 0.2 or less (now 0.35), so that ΔL stays below 0.1 | Measured: now ΔL 0.15 (mint) and 0.18 (lemon) |
| Pulses that repeat (hold glow, beat pulse) | ΔL below 0.03 and 3 Hz or less | ITU 20 cd/m² at 625 nits [derived] |
| Red | Never flash a color with linear R/(R+G+B) ≥ 0.8 | WCAG 2.2 note, XAG 118 |
| Stripes | No pattern that moves with more than 5 light and dark stripe pairs over 25% of the screen | BT.1702-3 Attachment 1 |

Style A today: each hit has a white disc (alpha 0.85, ΔL 0.71, 4,300 to 6,600 CSS px², 120 ms), a lane-color shock ring, and a lane glow (ΔL 0.15 to 0.18). A double hit doubles the disc to about 13,200 CSS px². The total bright area of one hit can be larger than the 20 cm limit. Style A passes WCAG 2.3.1 only by the rate clause, because P1 keeps 550 ms or more between notes (1.8 hits per second at most) [derived]. Berry (`0.686`) passes the red test. Berry dark (`0.783`) is close to 0.8, so it must not flash.

## 4. Design for a 4-year-old child

### Attention and overstimulation

- 4-year-old children who watched a fast-paced cartoon for 9 minutes "performed significantly worse on the executive function tasks" than children who watched an educational cartoon or drew ([Lillard and Peterson 2011](https://pubmed.ncbi.nlm.nih.gov/21911349)). This study is about television, not games, but it is a reason to keep the pace calm.
- Kindergarten children in a highly decorated classroom "were more distracted by the visual environment, spent more time off task, and demonstrated smaller learning gains" ([Fisher, Godwin, and Seltman 2014](https://pubmed.ncbi.nlm.nih.gov/24855019)).
- Hirsh-Pasek et al.: "Preschoolers are particularly susceptible to distraction". For 4-year-old children, "only continuous distraction impaired performance" (Kannass and Colombo 2007). "Extraneous animations, sound effects, and tangential games might be appealing to a child when activated but not add to the child's understanding" ([Hirsh-Pasek et al. 2015](https://kathyhirshpasek.com/wp-content/uploads/sites/9/2015/09/Psychological-Science-in-the-Public-Interest-2015-Hirsh-Pasek-3-34.pdf)).
- Background animation "can distract greatly from elements that are important to gameplay" ([GAG, background movement](https://gameaccessibilityguidelines.com/provide-an-option-to-turn-off-hide-background-movement/)). Apple asks to reduce "automatic and repetitive animations, including zooming, scaling, and peripheral motion" when Reduce Motion is on ([Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)).

Rule: during a song, only things that carry game information move: the notes, the beat dots, the hit effects, and the pal of a lane with a note near or a hit. The background stays still [INFERENCE from the sources above].

### No text, audio first, simple goals

- "Assume preschool-aged children cannot read"; "Primary instructions and other prompts should be conveyed verbally and visually"; "Children typically do not pay attention to audio instructions alone" ([Sesame Workshop](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf)).
- Children synchronize better with a sound than with a flash (`child-rhythm-design.md`, section 1.5). The beat must be in the audio. The picture supports it.
- Sago Mini designs with "no spoken or written words", "no timer, no pressure", and immediate results. Their first movement control "was too chaotic for preschoolers", so they slowed the game down ([Apple Developer, Sago Mini Jinja's Garden Q&A](https://developer.apple.com/news/?id=3t6o5jec)).
- Toca Boca apps have "no winning or losing, high scores or time limits" and little speech or text ([The Guardian, Toca Boca interview](https://www.theguardian.com/technology/appsblog/2011/jun/24/toca-boca-interview)).
- PBS KIDS publishes a brand style guide with a "contrast guide for screens" ([PBS KIDS Style Guide](https://pbs-kids-brand.pbskids.org/downloads/pbs-kids-style-guide.pdf)). I found no public PBS KIDS game design rules [UNVERIFIED].

### Reward pace

- "Payoffs are very important to children"; use a sound effect and "a visual payoff via animation or light movement" ([Sesame Workshop](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf)).
- In apps used by 160 children of 3 to 5 years, manipulative designs were common: "parasocial relationship pressure", "time pressure", "navigation constraints", and "attractive lures" ([Radesky et al. 2022](https://pubmed.ncbi.nlm.nih.gov/35713902)).
- Decision 10, P5, and P12 already set the reward model: earned stars and record colors, no failure, no prizes.

Rule: each hit gets a small reward (section 1). The end of the song gets one larger reward of 5 s or less that a tap can skip. No pal looks sad, no timer, no "play again" lure [INFERENCE from Radesky and P5].

## 5. Accessibility

### Color blindness

- "Difficulty perceiving red or green in particular is very common, affecting around 8-10% of males" ([GAG, colour](https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-a-colour-alone/)). The child is a girl, so the risk is lower, but the rule costs little.
- "Color alone should never be used to represent information" ([XAG 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103)). Apple: "Offer visual indicators, like distinct shapes or icons, in addition to color" ([Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)).
- Measured on the style A lane colors (Machado 2009 matrices at full severity, CIELAB ΔE): normal vision berry and mint ΔE 109; protanopia ΔE 36; deuteranopia ΔE 14. With deuteranopia, berry and mint look almost the same grey. Lemon and mint have a contrast of only 1.15:1, so they differ by hue, not by lightness.
- Style A pals differ by shape (round, square, tall bean), which is good. The gumballs are all the same shape, so a note shows its lane by position and color only. Position is enough for the rule "tap the lane", but the shape also helps the child match a note to its pal [INFERENCE].

### Reduced motion

- `prefers-reduced-motion` detects the user preference "to minimize the amount of non-essential motion"; on iOS it is "Settings > Accessibility > Motion" ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)).
- Apple: when Reduce Motion is on, reduce "automatic and repetitive animations, including zooming, scaling, and peripheral motion" ([Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). WCAG 2.3.3 (AAA) asks that motion from interaction can be turned off ([Understanding 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)).
- Prior result for the sister game: in a game with no text, keep every cue and every sound and swap travel for fades (`pile-pals/research/native-feel/motion.md`, section 8, with the WebKit sources there).
- Xbox: give a way to "entirely disable" moving and flashing content and to "pause or hide" it ([XAG 117](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117)).
- Style A reads `REDUCED` once. It stops the drift of the background circles but not their beat pulse; it keeps the shock ring, the music note that floats up, and the pal squash. It does not listen for the `change` event.

## 6. Performance on the iPhone 12 (PixiJS)

- Safari draws a Home Screen web app at 60 Hz, so each frame has 16.7 ms. Low Power Mode throttles `requestAnimationFrame` to 30 fps (`ios-pwa-audio.md`, from [WebKit bug 168837](https://bugs.webkit.org/show_bug.cgi?id=168837)). Each frame places the notes from the audio clock, so a dropped frame moves no note off time (decision 16).
- PixiJS: "Group similar object types together in the scene graph", because each type change breaks the batch; "Graphics objects are fastest when they are not modified constantly"; "Use Spritesheets where possible"; Graphics masks use the stencil buffer and "Sprite masks … are really expensive"; "Filters are expensive"; on some mobile devices `backgroundAlpha: 1` and `antialias: false` help ([PixiJS Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips)).
- `ParticleContainer` uploads only the properties that are marked dynamic each frame; its API is "stable but **experimental**" ([PixiJS Particle Container](https://pixijs.com/8.x/guides/components/scene-objects/particle-container)).
- PixiJS: "Use pooling for frequently created/destroyed objects" ([PixiJS Garbage Collection](https://pixijs.com/8.x/guides/concepts/garbage-collection)). Per frame, also avoid new arrays, closures, and color strings in the game loop, because garbage collection can pause a frame [INFERENCE]. The style A loop creates 7 arrays and many `rgba(...)` strings in each frame; that is acceptable in a prototype, not in the game.
- `resolution` is the "Pixel ratio for rendering", to use "with `autoDensity: true`" ([PixiJS Application](https://pixijs.com/8.x/guides/components/application)). A full-screen canvas at DPR 3 has 2.96 million pixels; at DPR 2 it has 1.32 million (2.2 times fewer) [derived]. Start at `resolution: Math.min(devicePixelRatio, 2)` and measure [INFERENCE].
- Particle count: style A spawns 18 sparkles for each hit with a life of up to 0.95 s. At 1.8 hits per second that is about 31 live sparkles, plus 8 for each hold [derived]. A pool of 64 is enough [INFERENCE].
- PixiJS has no `shadowBlur`; the hold glow needs a pre-blurred texture (style A `notes.md`). The rope of a hold should be a stretched sprite or a nine-slice sprite, not a `Graphics` path drawn again in each frame [INFERENCE from the Graphics tip].
- HTML pals over the canvas: animate only `transform` and `opacity`, call `decode()` on each image before the song starts, and expect `will-change` layers to drop under memory pressure (`pile-pals/research/native-feel/motion.md`, sections 1, 3, and 4). Style A changes `src` of each pal `<img>` on a state change; an animated WebP that decodes on the first show can drop a frame [UNVERIFIED: measure on the device].

## 7. Review of style A

| # | Problem in style A | Evidence | Fix | Checklist |
|---|---|---|---|---|
| A1 | White flash on each hit, plus a lane glow, plus a shock ring; the total bright area of one hit (and more of a double) can pass the 20 cm limit. Safety depends only on the 550 ms note gap. | `drawHit`: disc alpha 0.85, ΔL 0.71, up to 6,600 CSS px²; lane glow ΔL 0.15 to 0.18; `double-portrait.png` | Replace the white disc with a ring pop (scale 1.0 to 1.15 to 1.0 in 150 ms) and a lane-color fill at ΔL < 0.1. Lane glow extra alpha ≤ 0.2. Keep one small white core (Ø ≤ 40 CSS px) for "great" hits only. | C10, C11, C12 |
| A2 | 9 background circles drift for the whole song and pulse on each beat. They are a second beat display, outside the task, in the child's peripheral vision. | `drawBackground`; visible in all play screenshots | Make the background still: draw it one time into a texture. Show the beat only with the beat dots and the pal bob of an active lane. | C14, C15 |
| A3 | Hit effects cover other lanes and the approach path. The shock ring grows to 2.6 times the ring radius (about 96 CSS px), wider than half a lane; sprinkles rise up to about 110 px and spread wider than the lane; the music note floats 110 px up into the chute. In a double, the rainbow, two rings, and two notes cover the middle lane. | `drawHit`, `drawFive`; `play-portrait.png` (mint ring crosses the lemon chute), `double-portrait.png`, `double-landscape.png` | Clip each hit effect to its own lane width. Ring wave ≤ 1.4 times the ring radius. 6 to 10 sparkles that fall down and out, not up the chute. Move the music note to the side of the pal, below the hit line. Rainbow only between the two pals, below the rings. | C4, C5 |
| A4 | Sprinkles take the color of the next lane (`LANES[(i + 1) % 3].base`), so a mint hit throws berry pieces into the berry lane. | `drawHit`, `cols` | Sprinkles in the own lane color, white, and lemon only. | C5, C27 |
| A5 | Too many things move at the same time: background circles, 3 pal bobs, note wobble (`sin(t * 9)`), beat dots, and hit effects. | `frame()`, `drawGumball` | Idle pals hold still (or bob ≤ 2 px on strong beats only). Remove the note wobble. | C15 |
| A6 | Lanes depend on color: with deuteranopia, berry and mint notes look the same. All gumballs have the same shape. | ΔE 14 (deuteranopia) | Put the pal motif on each note and on its ring: a leaf on berry, an antenna dot on lemon, a sprout on mint. Keep lane position as the main cue. | C17 |
| A7 | Empty progress beads are invisible (1.06:1). Beat dots are faint (1.8:1, Ø 5 to 8 CSS px). | Pixel measurement | Beads: add a 2 px outline at ≥ 3:1. Beat dots: decide their role. If they guide the child, make them ≥ 3:1 and Ø ≥ 10 px; if not, remove them. | C7, C28 |
| A8 | Reduced motion is partial: the background still pulses, the shock ring and the music note still travel, and `change` is not observed. | `REDUCED`, `drawBackground`, `drawHit` | Follow C16. Read the media query at start and on `change`. | C16 |
| A9 | Glow and blur in the hold: `shadowBlur = 24` each frame on canvas. The tail is a path drawn again in each frame. | `drawTail` | In PixiJS: one pre-blurred glow sprite, a stretched or nine-slice rope sprite. | C20 |
| A10 | The game loop allocates each frame (arrays, closures, color strings, `ok()` calls in `drawBackground`). | `frame()` | Precompute colors as numbers; object pools; no allocation in the loop. | C20 |
| A11 | Space values are off any scale: 7, 9, 10, 11, 13, 14, 18, 26 px in CSS (`.beads` gap 7, bead 11, `.song-grid` gap 26/18, padding 14/18, `.ring` inset -9). | `index.html` CSS | Move to a 4 px scale: bead 12, gap 8; grid gaps 24/16; padding 16/16/24/16; ring inset -8. | C22 |
| A12 | The song list header pals hop forever (`animation: hop … infinite`), and three cards all tilt by different angles. The eye goes to the hop, not to the songs. | `.gang img`, `songs-portrait.png` | Pals hop one time on load and when a song is tapped. Keep the tilt (it is the "toy block" idea) but use two angles only (-1.5° and 1.5°). | C15, C25 |
| A13 | Mixed depth language: cards and the play button use a hard drop shadow (0 7px 0, 0 5px 0), the pause and gear buttons are flat, gumballs and pals have a highlight at the top left. | CSS and `drawGumball` | One light direction (top left). Two shadow levels: "block" (0 6px 0, cards and the play button) and none (HUD). Give the pause and gear buttons the same block shadow at 4 px or keep both flat on purpose. | C29 |
| A14 | Mixed outline widths: ring 6 px, chute 2.5 px, preview ring 6 px, star 1.5 px, gumballs and pals with no outline. | Code | Two widths only: 6 px for targets (rings, preview ring) and 2 px for small outlines (chutes, beads, empty stars). | C29 |
| A15 | Landscape: the highway is 4.4 cm and notes are Ø 49 CSS px (0.81 cm); the side areas are empty but full of circles that drift. | `play-landscape.png`, `layout()` | Still sides. Keep the note diameter ≥ 1 cm (60 CSS px) if the lane allows it. | C14, C25 |
| A16 | The rings sit on the pal heads, and the pal faces (104 px) are larger than the targets (Ø 74 px). Faces pull the eye down below the hit line [INFERENCE]. | `play-portrait.png` | Keep the pals, but make the ring and the note the brightest and highest-contrast objects; pals move only when they react. Squint test (C25). | C25 |

What style A does well: no text for the child, no red and no failure, a clear anticipation cue (the "ready" pal), pals with different shapes, a constant look-ahead time in both orientations, safe areas with `env()`, 44 px HUD buttons, and an honest note on build cost.

## 8. General visual design

### Space and margins

- Refactoring UI: "Start with too much white space", then remove it; "white space should be removed, not added" ([Refactoring UI sample chapter](https://refactoring-ui.nyc3.cdn.digitaloceanspaces.com/Refactoring%20UI%20-%20Start%20with%20too%20much%20white%20space.pdf)). The book also has the chapters "Establish a spacing and sizing system" and "Avoid ambiguous spacing" (same PDF, table of contents). Its example scale is 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px, and it says that "a linear scale won't work" ([secondary notes on the book](https://phlip9.com/notes/design/refactoring%20ui)).
- Material Design 3: "The spacing system is measured on an 8dp scale, where space100 = 8dp"; space has three parts: padding (inside), gap (between), and margin (outside) ([M3 Spacing](https://m3.material.io/styles/spacing)).
- Proximity: "Items close together are likely to be perceived as part of the same group" ([NN/g, Proximity](https://www.nngroup.com/articles/gestalt-proximity/)). Refactoring UI: increase the space above a label and decrease the space below it, so that the label groups with its field ([secondary notes](https://phlip9.com/notes/design/refactoring%20ui)).
- Apple: respect "system-defined safe areas, margins, and guides"; "Align elements to make them easier to scan"; "Group related items" with negative space, shapes, or separators ([Apple HIG, Layout](https://developer.apple.com/design/human-interface-guidelines/layout)). Minimum control size on iOS is 44 x 44 pt ([Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)).
- The unslop check: "Everything sits on a 4px grid", "Same thing, same size", and space inside a group is smaller than space between groups (`skill://unslop`, pass 1).

Rule: one 4 px scale (4, 8, 12, 16, 24, 32, 48, 64) for every `margin`, `padding`, `gap`, and fixed size in CSS and in the PixiJS layout. 2 px steps only inside small icons. Screen-edge margin = safe-area inset + 16 px.

### Visual hierarchy

- Visual hierarchy comes from "color and contrast", "scale", and "grouping". NN/g limits: "no more than 3 sizes", "limit your color use to 2 primary and 2 secondary colors", "no more than 3 contrast variations", and "Limit how many elements are big to a maximum of 2". The squint test (blur by 5 to 10 px) shows the real hierarchy ([NN/g, Visual Hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)).
- Apple: "Order content by relative importance" ([Apple HIG, Layout](https://developer.apple.com/design/human-interface-guidelines/layout)). Sesame: "The more fundamental the action, the more eye-catching the interactive element should be" ([Sesame Workshop](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf)).
- Unslop: craft "keeps the chrome quiet and puts the richness into one or two moments" (`skill://unslop`).

Rule: one focal point on each screen. Play screen: the hit zone and the next note. Song list: the song pictures. HUD and menus stay quiet.

### Typography for the parent labels

- iOS default text size is 17 pt and the minimum is 11 pt; "avoid light font weights" ([Apple HIG, Typography](https://developer.apple.com/design/human-interface-guidelines/typography)).
- Refactoring UI: establish a type scale; keep line length at 45 to 75 characters ([secondary notes](https://phlip9.com/notes/design/refactoring%20ui)).
- Impeccable and unslop: one family, two weights, sentence case, no wide-tracked uppercase labels, body text ≥ 4.5:1 (`skill://impeccable`, `skill://unslop`).

Rule: system rounded font only (`ui-rounded`, as in style A), 2 sizes (13 and 17 px), weights 600 and 700, sentence case, one line for each title (truncate at 24 characters).

### Color

- "Avoid using the same color to mean different things" ([Apple HIG, Color](https://developer.apple.com/design/human-interface-guidelines/color)).
- WCAG 1.4.3: text 4.5:1, large text 3:1 (Apple uses the same values: [Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). WCAG 1.4.11: meaningful graphics and controls 3:1 ([Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- Refactoring UI chapters: "Define your shades up front", "Don't let lightness kill your saturation", "Greys don't have to be grey", "Accessible doesn't have to mean ugly" ([sample PDF, table of contents](https://refactoring-ui.nyc3.cdn.digitaloceanspaces.com/Refactoring%20UI%20-%20Start%20with%20too%20much%20white%20space.pdf)). For light colors like yellow, rotate the hue toward orange as you darken, instead of a "muddy and dull brown" ([secondary notes](https://phlip9.com/notes/design/refactoring%20ui)).

How saturated child colors look good and not cheap [INFERENCE from the sources above]:

1. Few colors with fixed roles: 3 lane colors (berry, lemon, mint), 1 accent (lemon also means reward and progress), 1 tinted dark ramp (grape 950 to 300) for everything else. Style A already works in OKLCH; keep it.
2. Full saturation only on content that matters (notes, pals, rings, stars, song pictures). The chrome (background, HUD, chutes) uses the dark ramp at low chroma.
3. Each saturated color has a darker shade for its rim and shadow, with the hue rotated 5° to 15° (style A does this: lemon dark at hue 80 under lemon at hue 96).
4. No glows, no color gradients across hues, no rainbow sprinkles of all lane colors.

### Consistency and depth

- Refactoring UI: "Emulate a light source" ("light comes from above") and "Establish an elevation system" with 5 shadows or fewer ([secondary notes](https://phlip9.com/notes/design/refactoring%20ui)).
- Unslop: nested radius, "An inner radius equals the outer radius minus the padding between them"; one icon set at one size and stroke (`skill://unslop`, passes 3 and 7).

Rule: radius scale 8, 16, and full round; one outline width for targets (6 px) and one for small outlines (2 px); light from the top left; two shadow levels.

### Signs of amateur design and their fixes

| Sign | Fix |
|---|---|
| Uneven space (7, 9, 13, 18, 26 px) | Snap to the 4 px scale |
| Equal space above and below a label | More space above, less below |
| Too many colors, one color with two meanings | Fixed palette with roles |
| Weak contrast on small parts (empty beads, faint dots) | ≥ 3:1 or remove |
| Elements off a shared line by 1 to 3 px | Align edges and centers |
| Clutter: decoration that moves | Still background, one focal point |
| Mixed radii, outline widths, and shadow styles | One scale for each |
| Light font weights, many sizes | 2 sizes, 2 weights |
| Glows, blobs, gradient text, loops that pulse | Remove (`skill://unslop`, signs list) |

## Checklist

Each item: rule, check that a prototype agent can run on its screenshots, code, or a device trace, and source.

| ID | Rule | Check | Source |
|---|---|---|---|
| C1 | The hit effect starts in the first frame after `pointerdown`. | Web Inspector timeline: event to first frame with the effect ≤ 17 ms (≤ 34 ms in Low Power Mode). | [Sesame](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf), [Hirsh-Pasek 2015](https://kathyhirshpasek.com/wp-content/uploads/sites/9/2015/09/Psychological-Science-in-the-Public-Interest-2015-Hirsh-Pasek-3-34.pdf) |
| C2 | No hit-stop: notes never freeze. | In a capture of a hit, note y in each frame equals `hitY - (T - t) * speed` within 1 px. | [Sakurai](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/), decision 16 |
| C3 | No screen shake; the hit line and highway never move. | The y of each ring is the same in all frames of a hit. | [XAG 117](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117) |
| C4 | Hit effect budget: main burst ≤ 0.6 s, all hit effects gone ≤ 1.2 s, 6 to 10 particles. | Code constants; screenshot at 1.2 s after a hit shows no effect. | [Hicks 2018](https://dl.digra.org/index.php/dl/article/download/936/936), [Apple HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion) |
| C5 | Hit effects stay in their own lane and keep the approach path clear. | Screenshots at 0.1 s and 0.3 s after a hit and a double hit: no effect pixel over another lane's ring or more than 1 ring diameter above the own ring. Particle colors: own lane, white, lemon only. | [BSMG vision blocks](https://bsmg.wiki/mapping/basic-mapping.html), [Hicks 2018](https://dl.digra.org/index.php/dl/article/download/936/936) |
| C6 | Look-ahead time is constant in both orientations, 1.8 to 2.5 s. | One constant (`LEAD`); note travel time from top to ring measured in portrait and landscape differs ≤ 50 ms. | [osu! scroll time](https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Mania/UI/DrawableManiaRuleset.cs) [INFERENCE for range] |
| C7 | Notes, rings, and progress beads have ≥ 3:1 contrast against the colors next to them. | Sample pixels in screenshots; WCAG contrast formula. | [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [XAG 102](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102) |
| C8 | Judgement feedback has no text and no red; "great" and "good" differ by size, particle count, and sound. | Screenshots of a great hit, a good hit, and a miss: no glyphs, no hue near red on miss. | [Sesame](https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf), [NN/g kids cognition](https://www.nngroup.com/articles/kids-cognition/), P5 |
| C9 | The visual never waits for the audio; the hit sound is never more than 45 ms before the picture. | Code review: no `await` or audio callback before the draw; device test with speaker. | [ITU-R BT.1359](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1359-0-199802-S!!PDF-E.pdf), P6 |
| C10 | 3 or fewer flashes (ΔL ≥ 0.1 or saturated red) in any 1 s, flash starts ≥ 334 ms apart. | Screen capture at 60 fps of the fastest chart; frame luminance per region; or PEAT. | [WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), [BT.1702-3](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-3-202311-I!!PDF-E.pdf) |
| C11 | Area with ΔL ≥ 0.1 at any instant ≤ 8,700 CSS px², double hits included. | Diff of two frames (before and at the peak of a double hit): count pixels with ΔL ≥ 0.1, divide by 4 at 2x scale. | [WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) [derived for 20 cm] |
| C12 | No full-screen flash: any full-screen overlay has peak white alpha ≤ 0.15; lane glow extra alpha ≤ 0.2; repeated pulses ΔL < 0.03. | Code constants; frame diff of the full screen ΔL < 0.1. | [BT.1702-3](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-3-202311-I!!PDF-E.pdf), [XAG 118](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118) |
| C13 | No red flash: nothing that flashes or pulses has linear R/(R+G+B) ≥ 0.8. | Compute the ratio for each effect color (berry 0.686 passes; berry dark 0.783 must not flash). | [WCAG 2.2 note](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), [XAG 118](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118) |
| C14 | The background is still during a song. | Two frames 1 beat apart with no note or hit: zero pixel change outside the lanes and the HUD. | [GAG background movement](https://gameaccessibilityguidelines.com/provide-an-option-to-turn-off-hide-background-movement/), [Fisher 2014](https://pubmed.ncbi.nlm.nih.gov/24855019), [Hirsh-Pasek 2015](https://kathyhirshpasek.com/wp-content/uploads/sites/9/2015/09/Psychological-Science-in-the-Public-Interest-2015-Hirsh-Pasek-3-34.pdf) |
| C15 | Only information moves: notes, beat dots, hit effects, and the pal of an active lane. Idle pals move ≤ 2 px. No loop animation on menus. | Frame diff with no note near: only beat dots change; CSS has no `infinite` animation outside a preview. | [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Hirsh-Pasek 2015](https://kathyhirshpasek.com/wp-content/uploads/sites/9/2015/09/Psychological-Science-in-the-Public-Interest-2015-Hirsh-Pasek-3-34.pdf) |
| C16 | With `prefers-reduced-motion: reduce`: no travel > 8 px and no scale change except the notes; effects become fades; every sound and color cue stays; the game reacts to `change`. | Web Inspector media emulation; screenshots at 0.1 and 0.3 s after a hit. | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility), `pile-pals/research/native-feel/motion.md` §8 |
| C17 | Lanes do not depend on color: each note and ring carries its pal motif. | Screenshot in grayscale and with a deuteranopia filter: each note matches its pal by shape. | [XAG 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103), [GAG colour](https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-a-colour-alone/) |
| C18 | No manipulative design: no timer, no sad pal, no lure to continue; the end reward is ≤ 5 s and a tap skips it. | Walk through all screens; time the end screen. | [Radesky 2022](https://pubmed.ncbi.nlm.nih.gov/35713902), [Sago Mini](https://developer.apple.com/news/?id=3t6o5jec), P5 |
| C19 | 95% of frames ≤ 16.7 ms and none > 33 ms in a full song on the iPhone 12; in Low Power Mode, hits still score on time. | Web Inspector Timelines ("Rendering Frames" view); play one song in Low Power Mode. | `ios-pwa-audio.md`, [WebKit 168837](https://bugs.webkit.org/show_bug.cgi?id=168837) |
| C20 | PixiJS: one texture atlas, object pools, no `Graphics` redrawn per frame, no filters during play, at most 1 mask, `resolution ≤ 2` with `autoDensity`, no allocation in the game loop. | Code review; Web Inspector memory timeline shows no growth during 60 s of play. | [PixiJS Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips), [PixiJS GC](https://pixijs.com/8.x/guides/concepts/garbage-collection) |
| C21 | HTML pals animate only `transform` and `opacity`; all pal images are decoded before the song starts. | Code review; no frame > 33 ms at the first state change of each pal. | `pile-pals/research/native-feel/motion.md` §1, §4 |
| C22 | Every `margin`, `padding`, `gap`, and fixed size is a multiple of 4 px (2 px inside small icons). | `grep -oE '[0-9.]+px'` in CSS and layout constants: all values divisible by 4. | [M3 Spacing](https://m3.material.io/styles/spacing), [Refactoring UI](https://refactoring-ui.nyc3.cdn.digitaloceanspaces.com/Refactoring%20UI%20-%20Start%20with%20too%20much%20white%20space.pdf), `skill://unslop` |
| C23 | Space inside a group is at most half the space between groups. | Song list screenshot: card to its stars ≤ ½ of stars to next card. | [NN/g Proximity](https://www.nngroup.com/articles/gestalt-proximity/) |
| C24 | Controls and pals stay inside the safe area + 16 px; every control is ≥ 44 x 44 pt. | `?sim` screenshots in both orientations: measure distances to the notch and home indicator. | [Apple HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) |
| C25 | One focal point: after a 10 px blur, the strongest contrast area is the hit zone and next note (play) or the song pictures (list). | Blur the screenshot by 10 px and compare. | [NN/g Visual Hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) |
| C26 | Parent labels: system rounded font, 2 sizes (≥ 13 px), no light weights, sentence case, ≥ 4.5:1. | CSS review; contrast of label pixels against the background. | [Apple HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| C27 | Fixed palette with one meaning for each color: 3 lane colors, lemon accent, one dark ramp. | List all color constants: ≤ 12 tokens; lemon only for reward, progress, and the play action. | [Apple HIG Color](https://developer.apple.com/design/human-interface-guidelines/color), [NN/g Visual Hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) |
| C28 | Meaningful non-text chrome (stars, beads, pause, gear) ≥ 3:1 against its background. | Pixel sample of each element on its background. | [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| C29 | One radius scale (8, 16, full), nested radius = outer radius minus inner space, 2 outline widths (6 and 2 px), one light direction (top left), 2 shadow levels. | Review of CSS and draw constants; screenshot shows highlights at top left only. | [Refactoring UI notes](https://phlip9.com/notes/design/refactoring%20ui), `skill://unslop` |
| C30 | Edges and centers align on shared lines. | In screenshots, the left edges, centers, and baselines of related items differ ≤ 1 CSS px. | [Apple HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout) |

## Open questions

1. Viewing distance: at what distance does the child hold the iPhone? The flash area limit (C11) assumes 20 cm. A measurement with a ruler during play settles it.
2. Look-ahead time: is 2.0 s right for this child, or does she need 2.5 s at the 700 ms step? Test both while the parent watches.
3. Beat dots: do they help the child, or are they noise? Test one song with them and one without.
4. Pal motif on the notes (A6): does the child match a note to a pal by shape? A short test with one lane color changed tells.
5. The hit sound: one fixed sound for each lane, or a sound that changes with the song key? This needs the audio research.
6. Does an animated WebP state change on an `<img>` drop a frame on the iPhone 12 (A16, C21)? Measure on the device.
7. Is `resolution: 2` sharp enough for the notes at 3x DPR, or does the game need 3 with a smaller particle budget? Compare screenshots on the device.

## Sources

Primary sources (talks, papers, standards, official guidelines, code):

1. Jonasson, M., and Purho, P. "Juice it or lose it". Talk, 2012. https://www.youtube.com/watch?v=Fy0aCDmgnxg
2. Swink, S. "Game Feel: The Secret Ingredient". Game Developer, 2007. https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient
3. Nijman, J. W. "The art of screenshake". INDIGO Classes 2013. https://www.youtube.com/watch?v=AJdEqssNZ-U
4. Sakurai, M. "Thinking About Hitstop", Famitsu column, fan translation. https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/
5. Hicks, K., Gerling, K., Dickinson, P., Vanden Abeele, V. "Juicy Game Design". CHI PLAY 2019. https://lirias.kuleuven.be/server/api/core/bitstreams/d201f21c-ed67-4f9d-9c87-821b4addd1f1/content
6. Hicks, K., Dickinson, P., Holopainen, J., Gerling, K. "Good Game Feel". DiGRA 2018. https://dl.digra.org/index.php/dl/article/download/936/936
7. ppy/osu, `DrawableManiaRuleset.cs`, `ManiaRulesetConfigManager.cs`, `ManiaHitWindows.cs`. https://github.com/ppy/osu
8. BSMG Wiki, Basic Mapping. https://bsmg.wiki/mapping/basic-mapping.html
9. Bandai Namco, Taiko no Tatsujin, How to Play. https://taiko.namco-ch.net/taiko/en/howto/onpu.php
10. Harmonix, Rock Band 4 Calibration. http://www.harmonixmusic.com/how-to-calibration
11. ITU-R BT.1359, Relative timing of sound and vision for broadcasting. https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1359-0-199802-S!!PDF-E.pdf
12. W3C, Understanding SC 2.3.1. https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
13. ITU-R BT.1702-3 (11/2023). https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-3-202311-I!!PDF-E.pdf
14. Microsoft, Xbox Accessibility Guidelines 102, 103, 117, 118. https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118
15. Game Accessibility Guidelines: flicker, colour, background movement. https://gameaccessibilityguidelines.com/
16. Jordan, J. B., and Vanderheiden, G. C. "International Guidelines for Photosensitive Epilepsy: Gap Analysis and Recommendations". ACM TACCESS 2024. https://pmc.ncbi.nlm.nih.gov/articles/PMC11872230/
17. Sony Interactive Entertainment, PS5 Safety Guide. https://www.playstation.com/content/dam/global_pdc/en/corporate/support/manuals/ps5-docs/1000b-digital-edition/CFI-10XXB_PS5_Safety_Guide_EN_EXP.pdf
18. Apple, iPhone 12 Technical Specifications. https://support.apple.com/kb/SP830?locale=en_US
19. Apple Human Interface Guidelines: Motion, Accessibility, Layout, Typography, Color. https://developer.apple.com/design/human-interface-guidelines/
20. Sesame Workshop, "Best Practices: Designing Touch Tablet Experiences for Preschoolers", 2012. https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf
21. Hirsh-Pasek, K., et al. "Putting Education in Educational Apps". Psychological Science in the Public Interest, 2015. https://kathyhirshpasek.com/wp-content/uploads/sites/9/2015/09/Psychological-Science-in-the-Public-Interest-2015-Hirsh-Pasek-3-34.pdf
22. Lillard, A. S., and Peterson, J. Pediatrics, 2011. https://pubmed.ncbi.nlm.nih.gov/21911349
23. Fisher, A. V., Godwin, K. E., and Seltman, H. Psychological Science, 2014. https://pubmed.ncbi.nlm.nih.gov/24855019
24. Radesky, J., et al. JAMA Network Open, 2022. https://pubmed.ncbi.nlm.nih.gov/35713902
25. NN/g: Designing for Kids, Cognitive Considerations; Visual Hierarchy; Proximity. https://www.nngroup.com/articles/kids-cognition/, https://www.nngroup.com/articles/visual-hierarchy-ux-definition/, https://www.nngroup.com/articles/gestalt-proximity/
26. Apple Developer, ADA Q&A: Sago Mini Jinja's Garden, 2026. https://developer.apple.com/news/?id=3t6o5jec
27. The Guardian, Toca Boca interview, 2011. https://www.theguardian.com/technology/appsblog/2011/jun/24/toca-boca-interview
28. W3C, Understanding SC 1.4.3, 1.4.11, 2.3.3. https://www.w3.org/WAI/WCAG22/Understanding/
29. MDN, `prefers-reduced-motion`. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
30. PixiJS v8 guides: Performance Tips, Particle Container, Garbage Collection, Application. https://pixijs.com/8.x/guides/concepts/performance-tips
31. WebKit bug 168837 (rAF in Low Power Mode). https://bugs.webkit.org/show_bug.cgi?id=168837
32. Wathan, A., and Schoger, S. Refactoring UI, sample chapter and table of contents. https://refactoring-ui.nyc3.cdn.digitaloceanspaces.com/Refactoring%20UI%20-%20Start%20with%20too%20much%20white%20space.pdf
33. Material Design 3, Spacing. https://m3.material.io/styles/spacing
34. PBS KIDS Style Guide. https://pbs-kids-brand.pbskids.org/downloads/pbs-kids-style-guide.pdf

Secondary sources (used only where no primary text was readable):

35. Summary of the 30 changes in "The art of screenshake". https://artificials.ch/juice-up-your-game/
36. Notes on Refactoring UI (scale values, light source, elevation, saturation). https://phlip9.com/notes/design/refactoring%20ui

Project files that this file builds on: `docs/research/README.md`, `docs/research/child-rhythm-design.md`, `docs/research/ios-pwa-audio.md`, `.scratch/prototypes/play-style/a/notes.md` and `index.html`, `pile-pals/research/native-feel/motion.md`, `skill://impeccable`, `skill://unslop`.

Downloads in `docs/research/.cache/game-ui/`: `hirsh-pasek-2015.pdf`, `rui-whitespace.pdf`, `ps5-safety.pdf` (and their text extracts).
