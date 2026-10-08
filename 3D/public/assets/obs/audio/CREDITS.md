# TARAIRON cabin sound effects

Selected on 2026-10-05. All sources below are **CC0 1.0 Universal**.
License: https://creativecommons.org/publicdomain/zero/1.0/
No paid assets, attribution-only/noncommercial assets, or remotely streamed audio.
Attribution is retained here voluntarily, including the exact source and edit recipe.

## Kenney — Sci-fi Sounds 1.0

- Author: Kenney (https://kenney.nl)
- Source and license: https://kenney.nl/assets/sci-fi-sounds
- Commercial-use clarification: https://kenney.nl/support
- Download: https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip
- `Audio/spaceEngineLow_000.ogg` (starting at 0.5 s, pitch ratios 0.88 / 0.80,
  high-pass 55 Hz / low-pass 1,100 Hz) → low motor layer in
  `door-open-air-motor.wav` / `door-close-air-motor.wav`.
- The earlier `Audio/engineCircular_000.ogg` engine loop was removed on 2026-10-08.

## Kenney — Impact Sounds 1.0

- Author: Kenney
- Source and license: https://kenney.nl/assets/impact-sounds
- Download: https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
- `Audio/impactMetal_medium_000.ogg` → `metal.wav`: cargo impacts only, no human/droid footsteps or ladder contacts.

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
- `sfx-cc0/handcuffs-metal-lock-01.wav` → `latch.wav`: latch engagement and appliance lids.
- `sfx-cc0/plastic-bag-pickup-01.wav` → `bag.wav`: cat-food packet handling and pouring rustle (not fabricated pellet impacts).
- `sfx-cc0/apple-cut-01.wav` → `chop.wav`: droid food preparation.
- `sfx-cc0/compressed-air-spray-02.wav` (0.15–0.58 s, high-pass 320 Hz /
  low-pass 5,800 Hz) → pneumatic layer in `door-open-air-motor.wav` /
  `door-close-air-motor.wav`. Actual compressed-air foley, not a synthesized beep.

### Revised hatch mix — 2026-10-05

The earlier Kenney `doorOpen_000.ogg` / `doorClose_000.ogg` edits were replaced.
Opening: 1.04 s; air release at 0, low motor starts at 0.13 s.
Closing: 1.12 s; air release at 0, lower/heavier motor starts at 0.10 s.
The air lasts 0.38 s with an 8 ms attack / 200 ms release; the motor has a
100 ms attack / 260 ms release. Both layers are mixed offline into a single mono
WAV per action, then normalized to -9 dBFS. No additional runtime voices.
The cat elevator reuses these buffers at 40% of the cabin hatch gain, plus a
quiet latch at full closure; entrance and destination emit from their own decks.

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

## Processing / reproduction

`node studies/audio/pack-cabin-audio.mjs SOURCE_DIRECTORY` (Node 20+, ffmpeg).
Extract source ZIPs into `scifi/`, `impact/`, `foley/`; name recordings
`shower.mp3`, `flush.mp3`, `washer.mp3`, `boots-metal.mp3`, `rubber-sole.mp3`, `servo-sweep.mp3`, `cat-meow.mp3` in that scratch directory.
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
