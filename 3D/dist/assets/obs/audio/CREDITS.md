# TARAIRON cabin sound effects

Original library selected on 2026-10-05. There are 27 clips under **CC0 1.0 Universal**.
License: https://creativecommons.org/publicdomain/zero/1.0/
The bed lid is under the **Pixabay Content License**, not CC0.
The user-supplied power-on edit below has an unverified license.
No remotely streamed audio. Do not describe the complete library as CC0.
Attribution is retained here voluntarily, including the exact source and edit recipe.

## Factory Warning Buzzer — qubodup / Freesound, 2026-10-10

- User-selected **Factory Warning Buzzer**, sound #832414, a recorded bridge-crane warning.
- Source and explicit CC0 license, checked 2026-10-10:
  https://freesound.org/people/qubodup/sounds/832414/
- Public HQ preview: https://cdn.freesound.org/previews/832/832414_71257-hq.mp3
- `factory-warning-buzzer.mp3` SHA-256: `36b798f34ec06999ff8de1377055516f1ad4b7423733fdc1db2474f0ad7e69aa`.
- Full 0–3.000 s → `factory-warning-buzzer.wav`: 132,344 bytes.
  Mono 22,050 Hz PCM16, 4 ms attack / 45 ms release, -9 dBFS peak.
  Original speed and pitch, no added layer, filtering or time stretching.
  Playback gain 0.38; one repeating voice heard throughout the cabin.
- Active only while the interior-hatch fault exists; verified recovery stops it.
  Existing mute, pause, hidden-tab and disposal controls stop the voice.
  Late loading starts the current warning without replaying old events.
- Rebuild: `node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY factory-warning-buzzer`.
- Preview: `/3D/emergency-lighting-study.html`, then enable the warning sound.

## Gentle pot simmer — Joseph SARDIN / BigSoundBank, 2026-10-09

- **Small Broth in a Pot**, sound #0492: a real pot simmering gently.
- Source and explicit CC0 license, checked 2026-10-09:
  https://bigsoundbank.com/small-broth-in-a-pot-s0492.html
- Public MP3: https://bigsoundbank.com/UPLOAD/mp3/0492.mp3
- `pot-simmer.mp3` SHA-256: `b7f11e07c5ab3e7f173556b3ac65365ce8a2d62bc93f0e7696f10195d1bfb3a5`.
- Source 2.000–6.120 s → `pot-simmer.wav`: 4.0-second loop, 176,444 bytes.
  Mono 22,050 Hz PCM16, high-pass 90 Hz / low-pass 5,000 Hz, 120 ms cosine
  crossfade at the join, -9 dBFS peak. Original speed and pitch; no synthetic
  bubbling, pitch sweep, time stretching or live filters. Playback gain 0.18.
- Only the existing `cook-stir` work phase enables the loop. It stops during
  waiting, serving, cleanup and cancellation. The source stays at the saucepan's
  liquid surface (-10.56, 1.305, -0.17), with normal camera/deck attenuation.
  One reused buffer/voice, independent of hand revolutions. Mute, pause and
  hidden tabs use the existing mixer cleanup; finished cooking never replays.
- Rebuild: `node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY pot-simmer`.
  Preview: `/3D/cabin-audio-study.html?scenario=simmer` uses the real droid
  action speed (16 authored seconds / DROID_PACE 1.6 = 10 seconds of stirring).

## Mouse chase — recorded rat squeaks and cat chirp, 2026-10-09

- Rat: Zabuhailo — **ratSqueak.wav**, recorded pet rat, not a synthesizer or mouth imitation.
  Source and CC0 license: https://freesound.org/people/Zabuhailo/sounds/143125/
  Public HQ preview: https://cdn.freesound.org/previews/143/143125_2580450-hq.mp3
  `rat-squeaks.mp3` SHA-256: `2f6d2447616474a89617db231600ed1d3947da499cde8a2304ba127667491937`.
  These rat recordings represent the fictional cabin mouse; not a house-mouse recording.
  - 6.840–7.180 s → `mouse-squeak-1.wav`: 0.34 s, 15,038 bytes, gain 0.12.
  - 7.780–8.160 s → `mouse-squeak-2.wav`: 0.38 s, 16,802 bytes, gain 0.10.
  High-pass 1,000 Hz / low-pass 9,000 Hz to reduce handling and background noise.
- Cat: dreamstobecome — **cat chirp.wav**, Queen Felicia's quiet chirping.
  Source and CC0 license: https://freesound.org/people/dreamstobecome/sounds/451250/
  Public HQ preview: https://cdn.freesound.org/previews/451/451250_7758073-hq.mp3
  `cat-chirps.mp3` SHA-256: `be493a43c91b5078eeaf8d08010382e7dec64e2d96197132bf2c26af048c6ab4`.
  6.320–6.960 s → `cat-chase-chirp.wav`: 0.64 s, 28,268 bytes, gain 0.18.
  High-pass 180 Hz / low-pass 7,500 Hz. A contented domestic-cat voice adapted
  for Lucy noticing the mouse, not a recording of an actual hunt.
- Both source pages declare CC0, checked 2026-10-09. Three short edits total
  60,108 bytes; originals remain outside the repository. Mono 22,050 Hz PCM16,
  4 ms attack / 45 ms release, -9 dBFS peak. No stretching, pitch change,
  synthetic layer, repeated syllables or live audio filters.
- One cat chirp at `notice`, two different squeaks at 0.65 and 2.8 seconds of
  the visible mouse's `run` phase. Cancellation and mouse-only crossings stay
  silent. Calls use each animal's own position and the existing distance/deck
  attenuation. Mute, late loading, pauses and seeks cannot queue old calls.
- Rebuild (the packer checks both source hashes):
  `node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY mouse-squeak-1 mouse-squeak-2 cat-chase-chirp`.
  Preview: `/3D/cabin-audio-study.html?scenario=mouseChase`.

## User-supplied Glitch 13 — cabin lighting starter, 2026-10-09

- User-provided local file: `Glitch 13.wav` from their `sounds` directory.
- Original author/pack/license: **not supplied / unverified**, not assumed CC0.
  Confirm the source pack's game-use and distribution terms before public release.
- Source SHA-256: `fa4f44b765b02483a070f48e2f8430dd4ad2b01d13295a6c7193ddc6d789272e`.
- `power-on-glitch.wav`: 1.05 s, mono 22,050 Hz PCM16, 46,350 bytes.
  Three source fragments, without synthetic oscillators, added reverb or loops:
  - 0.320–0.445 s placed at 0 s, relative gain 1, 8 ms attack / 45 ms release,
    high-pass 650 Hz / low-pass 5,400 Hz.
  - 0.620–0.750 s placed at 0.25 s, relative gain 0.82, 8 ms attack / 50 ms release,
    high-pass 650 Hz / low-pass 4,800 Hz.
  - 1.100–1.700 s placed at 0.45 s, relative gain 0.36, 35 ms attack / 280 ms release,
    high-pass 650 Hz / low-pass 2,600 Hz.
- Cosine fades and -9 dBFS peak normalization are baked into one file.
  Playback gain 0.24. One voice only when the dark cabin first powers up;
  muted/not-yet-loaded activations are not replayed later.
- Rebuild: `node studies/audio/pack-power-on.mjs SOURCE_DIRECTORY`.
  The full 12-second source stays outside the repository; the source is not edited.

## Bed movement: user-selected gas strut and pneumatic tray

- Revised 2026-10-09 from the user's specific reference around second 2.
  The generic air hiss is no longer used; the sliding tray is unchanged.
- Lid: Gavin Mogensen / Fronbondi_Skegs —
  **FOLEY - A Gas Strut Being Compressed, then Expanding Sound Effect** (#255504).
  Source: https://pixabay.com/ja/sound-effects/映画と特殊効果-foley-a-gas-strut-being-compressed-then-expanding-sound-effect-255504/
  License: **Pixabay Content License**, verified on the source page on 2026-10-09.
  https://pixabay.com/service/license-summary/ and https://pixabay.com/service/terms/
  This is not CC0. Use this derivative as part of TARAIRON's bed mechanism;
  do not redistribute it as a standalone sound library or downloadable SFX pack.
  The local study is an internal implementation preview, not a stock-audio service.
  Original download: `fronbondi_skegs-foley-a-gas-strut-being-compressed-then-expanding-sound-effect-255504.mp3`.
  SHA-256: `c8959326b07b18ccbb1d5d3d859afe0a53ae8a6c5990c485842efd925e1bcf59`.
  The 7.824-second original remains outside the repository.
- Tray: Joseph SARDIN / BigSoundBank — Pneumatic cylinder, small #3.
- Source and explicit CC0 license: https://bigsoundbank.com/pneumatic-cylinder-small-3-s1493.html
- Public preview used: https://bigsoundbank.com/UPLOAD/mp3/1493.mp3
- Source SHA-256: `d86d898453e835d6030b140add2a5f8e8b3bd1ab1906ab4c61800b6f89b799dd`.
- Actual seat-table pneumatic cylinder, edited to suggest the bed's mechanism;
  this is not a recording of this fictional bed. No synthetic motor, beep or added impact.
- `bed-piston.wav`: one extension, source 1.740–2.260 s (the user's roughly
  2-second reference), excluding adjacent handling, silence and contact clacks.
  The earlier 1.580–1.740 s onset was removed after the user reported it sounded
  like a voice. This is an edit description, not a claim of recorded speech.
  High-pass 180 Hz / low-pass 6,500 Hz; original speed, pitch and duration.
  No time stretching, varispeed, padding, repeated strokes, runtime loop,
  added hiss or synthetic motor.
  0.52 s, 22,976 bytes, 45 ms attack / 65 ms release, gain **0.18**.
  Playback rate is always 1 for opening, closing, waking and sealing, even
  with custom phase durations. The clip plays once at motion start and ends
  naturally; the 2.4–2.7-second lid animation is unchanged.
- `bed-slide.wav`: 1.4 s, 61,784 bytes, 120 ms attack / 200 ms release, gain 0.30.
  Unchanged: source 0.400–1.450 s, pitch 0.90, two equal tempo passes,
  high-pass 160 Hz / low-pass 3,200 Hz.
  Extending, entering, leaving and retracting follow the actual tray phases.
- Mono 22,050 Hz PCM16, cosine fades, normalized to -9 dBFS. One finite buffer
  per movement, stopped when the phase changes; no loops or runtime filtering.
  Sleeping, sitting/rising, cancelled approaches, seeks and stale events are silent.
  Bed-position distance attenuation uses the existing camera-aware mixer.
- Rebuild: `node studies/audio/pack-bed-piston.mjs pneumatic-cylinder-1493.mp3 GAS_STRUT_MP3`.
  The packer verifies the specified gas-strut source hash before writing.

## Historical source, no longer used — Kenney / Sci-fi Sounds 1.0

- Author: Kenney (https://kenney.nl)
- Source and license: https://kenney.nl/assets/sci-fi-sounds
- Commercial-use clarification: https://kenney.nl/support
- Download: https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip
- The low `Audio/spaceEngineLow_000.ogg` motor layers were removed from both
  hatch clips on 2026-10-09. The legacy filenames still contain `air-motor`,
  but the files now contain only the Vehicle compressed-air burst.
- The earlier `Audio/engineCircular_000.ogg` engine loop was removed on 2026-10-08.

## Nox_Sound — Foley_Object_Toolbox_Metal_Drop_Mono.wav

- Replaces the Kenney `impactMetal_medium_000.ogg` edit on 2026-10-09.
- Source and explicit CC0 license: https://freesound.org/people/Nox_Sound/sounds/556648/
- Public HQ preview used: https://cdn.freesound.org/previews/556/556648_9250976-hq.mp3
- Source SHA-256: `5d8ff98f449eddaa5a219514368d4fba9f7d74ca12ea60a7b100d0cc2f44fd6a`.
- The recording contains real metal-toolbox drops onto concrete, wood, gravel
  and grass. This edit uses one of the initial concrete contacts, not a recording
  of the ship's cases or metal floor.
- `toolbox-drop.mp3` 2.555–2.855 s → `metal.wav`: one 0.30-second contact,
  high-pass 45 Hz / low-pass 1,800 Hz, 3 ms attack / 100 ms release.
  Original speed and pitch; no oscillator, pitch slide, reverb or layered hit.
  The trailing shell rattle is excluded. Mono 22,050 Hz PCM16, -9 dBFS peak.
- Playback gain 0.20, supply landings at 0.85 relative volume, shelf placement
  at 0.45. Only cases use this clip: greens and served meals no longer trigger it.
  Shelf contact follows the visible halfway placement, not the end of the job.
- Rebuild: `node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY metal`.

## alec_mackay — footsteps boots metal 2.wav

- Source and CC0 license: https://freesound.org/people/alec_mackay/sounds/463666/
- Public HQ preview used: https://cdn.freesound.org/previews/463/463666_6551032-hq.mp3
- `boots-metal.mp3` 6.665–7.185 s → `step-metal-boots-1.wav`
- `boots-metal.mp3` 7.625–8.145 s → `step-metal-boots-2.wav`
- `boots-metal.mp3` 8.455–8.975 s → `step-metal-boots-3.wav`
- Three distinct recorded footsteps, preserving heel/toe contacts and the metal
  surface's own decay; 4 ms attack / 45 ms end fade, high-pass 75 Hz / low-pass
  8 kHz. No synthetic impact layer or added reverb; source WAVs retain their pitch.
- Playback tuning, 2026-10-08: boot gains halved to 0.20 / 0.185 / 0.20
  (about -6 dB), with a fixed 0.84 playback rate (about three semitones down).
  Preview and OBS share this tuning. Movement/contact timing is unchanged;
  rubber soles and cargo retain their existing tuning. Ladders now use the separate edits below.
- Replaces the previous short Kenney concrete footstep edits on 2026-10-05.
  Only short cuts ship, not the full two-minute recording.

### Milo ladder contacts — 2026-10-08

- `step-metal-boots-1.wav` (0–0.30 s) → `step-ladder-boots-1.wav`.
- `step-metal-boots-2.wav` (0–0.30 s) → `step-ladder-boots-2.wav`.
- `step-metal-boots-3.wav` (0–0.30 s) → `step-ladder-boots-3.wav`.
- These are edited boots-on-metal recordings used to suggest a rung contact,
  not a recording of a ladder climb. High-pass 75 Hz / low-pass 2,400 Hz,
  4 ms attack / 45 ms release, normalized to -9 dBFS. No synthetic thump,
  added clang or artificial reverb. The small room/metal decay is from the source.
- Playback rate 0.88, gains 0.13 / 0.12 / 0.13. Three distinct contacts alternate
  instead of repeatedly pitching one generic metal impact. Finished duration
  is about 0.341 s, shorter than the normal 0.384 s between rung events.
- Rebuild offline from the existing boot WAVs:
  `node studies/audio/pack-cabin-audio.mjs . step-ladder-boots-1 step-ladder-boots-2 step-ladder-boots-3`.
  The original floor boots, robot soles and cargo buffers are not changed.

## Aerny — Shoes 02 | rubber sole.wav

- Added 2026-10-08 for the droid's rubber soles; human boots remain unchanged.
- Source and CC0 license: https://freesound.org/people/Aerny/sounds/578706/
- Public HQ preview used: https://cdn.freesound.org/previews/578/578706_1071564-hq.mp3
- Source is real soft rubber-soled shoes on stone tile, not a metal-floor recording.
- `rubber-sole.mp3` 0.615–1.035 s → `step-rubber-1.wav`
- `rubber-sole.mp3` 1.270–1.690 s → `step-rubber-2.wav`
- `rubber-sole.mp3` 2.555–2.975 s → `step-rubber-3.wav`
- Three separate contacts, high-pass 70 Hz / low-pass 4,200 Hz, 4 ms attack /
  45 ms end fade. Short, subdued contact with no added metallic ring, squeak,
  reverb or pitch shift. One buffer per footfall, reusing the existing voice cap.

## Burningmonkey — Servo motor

- Source and CC0 license: https://freesound.org/people/Burningmonkey/sounds/322021/
- Public HQ preview used: https://cdn.freesound.org/previews/322/322021_813260-hq.mp3
- `servo-sweep.mp3` 4.675–4.875 s → `servo-stroke.wav`.
- Actual servo sweep, high-pass 100 Hz / low-pass 1,800 Hz, 20 ms attack /
  80 ms release. No added oscillator or engine layer. One 0.20 s stroke at
  gain 0.055 per pivot pair or ladder rung; a single quiet stroke during wake.
  No loop. Waiting, stationary and muted motion cannot replay a backlog.

## Vehicle / Jan Schupke — Tinysized SFX

- Author: Vehicle / Jan Schupke
- Source and explicit CC0 notice: https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx
- Download: https://opengameart.org/sites/default/files/tinysized.zip
- `sfx-cc0/handcuffs-metal-lock-01.wav` → `latch.wav`, revised 2026-10-09:
  0.065–0.225 s, first engagement only, excluding the second separated impact.
  High-pass 180 Hz / low-pass 3,800 Hz, 4 ms attack / 45 ms release, gain 0.20
  (previously 0.38). No pitch change, added reverb or synthetic layer.
  Hatch locks and quiet appliance unlocking only; lid contact is separate below.
- `sfx-cc0/plastic-bag-pickup-01.wav` → `bag.wav`: cat-food packet handling and pouring rustle (not fabricated pellet impacts).
- `sfx-cc0/apple-cut-01.wav` → `chop.wav`: droid food preparation.
- `sfx-cc0/compressed-air-spray-02.wav` (decode 0.15–0.58 s; retain 0.15–0.53 s,
  high-pass 320 Hz / low-pass 5,800 Hz) → sole source of `door-open-air-motor.wav` /
  `door-close-air-motor.wav`. Actual compressed-air foley, not a synthesized beep.

### Air-only hatch revision — 2026-10-09

Opening and closing now contain only the original 0.38-second air burst.
Both keep an 8 ms attack / 200 ms release, normalized to -9 dBFS. The motor
layer is removed entirely, not merely quieted or filtered. No later rumble,
extra layers, pitch changes or runtime voices. Each file is 16,802 bytes,
down from 45,908 / 49,436 bytes. Playback gains remain 0.65 / 0.58.
The legacy filenames are retained for all existing hatch consumers.
The cat elevator reuses these buffers at 40% of the cabin hatch gain, plus a
quiet latch at full closure; entrance and destination emit from their own decks.
The separate closure latch and animation/event timing are unchanged.
Rebuild only these clips:
`node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY door-open-air-motor door-close-air-motor`.

## Fabrizio84 — Shower

- Source and CC0 license: https://freesound.org/people/Fabrizio84/sounds/457603/
- Public HQ preview used: https://cdn.freesound.org/previews/457/457603_2841496-hq.mp3
- 30–34 s → `shower.wav`: stable running water while Milo is using the shower.

## simosco — toilet flushing.wav

- Source and CC0 license: https://freesound.org/people/simosco/sounds/235554/
- Public HQ preview used: https://cdn.freesound.org/previews/235/235554_4258636-hq.mp3
- 0–5 s → `flush.wav`: one subdued drain cycle after use, not repeatedly while occupied.

## ANARKYA — Washing machine [wash cycle]

- Source and CC0 license: https://freesound.org/people/ANARKYA/sounds/423210/
- Public HQ preview used: https://cdn.freesound.org/previews/423/423210_4448255-hq.mp3
- 2–6 s → `washer.wav`: drum operation only while the simulation's washer is running.

## samplecat — washmachine close2.WAV

- Added 2026-10-09. Actual AEG washing-machine door closing.
- Source and CC0 license: https://freesound.org/people/samplecat/sounds/11574/
- Public HQ preview used: https://cdn.freesound.org/previews/11/11574_31600-hq.mp3
- `washer-door.mp3` 0.460–0.680 s → `appliance-lid.wav`: the central contact,
  excluding the preceding handling and later bounce. High-pass 60 Hz / low-pass
  1,800 Hz, 4 ms attack / 45 ms release, gain 0.24, original speed and pitch.
- No extra ringing, reverb or synthetic thump. Mono 22,050 Hz PCM16, -9 dBFS peak.
  Washer closure follows its actual hinge position, not a subsequent job token.
  The waste-box lid reuses this contact at 75% volume; it is not a waste-box recording.
- Rebuild these two short clips only:
  `node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY latch appliance-lid`.

## tuberatanka — cat meow

- Added 2026-10-08. Source and CC0 license:
  https://freesound.org/people/tuberatanka/sounds/110011/
- Public HQ preview used: https://cdn.freesound.org/previews/110/110011_1537422-hq.mp3
- The author describes an actual hungry cat, not a human imitation.
- `cat-meow.mp3` 0–1.544 s → `cat-meow.wav`: one complete recorded cry,
  high-pass 100 Hz / low-pass 6,500 Hz, 4 ms attack / 45 ms end fade,
  mono 22,050 Hz PCM16, normalized to -9 dBFS. No synthetic layer,
  pitch shift, time stretch or added reverb. Playback gain 0.14, with the
  existing camera/distance attenuation; no additional runtime filters.
- Lucy only cries while hungry and awake: fullness at most 35, initial wait
  8–18 seconds, then randomized 45–90 second gaps. Sleeping, eating,
  grooming, playing, hopping and cat-lift travel suppress the sound.
  Suppressed/muted calls are never queued. Sound timing has its own random
  source, separate from the cat's behaviour/feeding decisions.

## Caitlin_100 — Pouring cat biscuit into a bowl.mp3

- Added 2026-10-09 alongside the approved bag rustle, which is unchanged.
- Actual dry cat-food biscuits poured into a cat bowl; the author does not
  identify the bowl material, so this is not labelled a metal-bowl recording.
- Source and explicit CC0 license: https://freesound.org/people/Caitlin_100/sounds/365654/
- Public HQ preview used: https://cdn.freesound.org/previews/365/365654_5407590-hq.mp3
- Source SHA-256: `0e2f877f3f7faf3d03669fd766f275a990b5e83e5cc2ef3b11c27af2805ccac5`.
- `cat-biscuit-pour.mp3` 0.600–3.720 s → `kibble-pour.wav`: 3.0 seconds,
  132,344 bytes after a 120 ms seam crossfade, mono 22,050 Hz PCM16.
  High-pass 140 Hz / low-pass 6,000 Hz, -9 dBFS peak, playback gain 0.23.
  Original pitch/speed, without synthetic grains, added reverberation or layers.
- A single source follows the shared visible pouring interval, with an approximate
  0.24 authored-second delay for the grains to reach the bowl (0.15 seconds at
  the normal 1.6 action rate). No per-particle audio or extra live filters.
  Sound originates at the bowl, stops at pour end, on waiting, cancellation or
  loss of food, and follows the existing mute/pause and camera-distance mixer.
  The source is longer than the normal 2.19-second pour, so that pour does not
  repeat a short burst. Only extended pours or the four-second solo preview loop.
- Rebuild only this new clip:
  `node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY kibble-pour`.

## Processing / reproduction

`node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY` (Node 20+, ffmpeg).
Extract the Tinysized SFX ZIP into `foley/` (Kenney's ZIP is no longer needed); name recordings
`shower.mp3`, `flush.mp3`, `washer.mp3`, `boots-metal.mp3`, `rubber-sole.mp3`, `servo-sweep.mp3`, `cat-meow.mp3`, `washer-door.mp3`, `toolbox-drop.mp3`, `cat-biscuit-pour.mp3` in that scratch directory.
To rebuild only selected clips, append their names, for example:
`node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY step-rubber-1 step-rubber-2 step-rubber-3`.

Files are mono 22,050 Hz PCM WAV for predictable Web Audio decoding and gapless
loops. Except for the hatch, ladder, rubber-sole, servo and cat recipes above, they use high-pass 75 Hz /
low-pass 8 kHz. One-shots use silence-trimming and edge fades except the recorded
footsteps and cat cry, whose complete contact/decay or vocalization is preserved as described above.
Loops use a 120 ms cosine crossfade at their seam. Peak normalization
is -9 dBFS before per-effect gain, spatial attenuation and the master bus.
No human voices/music were intentionally selected. Only these small edited clips ship;
the original full recordings/packs are not bundled. Existing synthetic ventilation
and notification tones remain separate from these sourced sounds. Synthesized
condensate plips were removed on 2026-10-08; the visual droplets/ripples remain.
