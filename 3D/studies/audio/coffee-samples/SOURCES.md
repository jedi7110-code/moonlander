# Coffee-machine audition samples

Prepared 2026-10-27 for local comparison. The user selected A's first 20 seconds
for OBS. `studies/audio/pack-coffee.mjs` derives the production clip; it is loaded
before Curtis's visit rather than during initial cabin loading. The complete
audition files remain study assets. B is not registered or used by OBS.

Both source pages explicitly declare CC0 1.0, checked 2026-10-27:
https://creativecommons.org/publicdomain/zero/1.0/

## A — Nespresso extraction

- Author: bassimat.
- Title: Nespresso Machine Making Coffee and Coffee Drops.
- Source: https://freesound.org/people/bassimat/sounds/832445/
- Public preview: https://cdn.freesound.org/previews/832/832445_15636277-hq.mp3
- Preview SHA-256: `f5310446a82c685432bd4d047b505d86dfbb6e17f1be0536d3d698bbfd70978e`.
- Output: `A-nespresso-extraction.wav`, approximately 30.41 seconds.
- Output SHA-256: `9e3030e1f7dbd20b0028a8563e8c86b0205e20187d243d9798fcf1937e4284f7`.
- The author describes an espresso machine making coffee, with drops at the end.

## B — Domestic espresso machine

- Author: Cafezz.
- Title: Coffee Espresso Machine Wave 44100hz.wav.
- Source: https://freesound.org/people/Cafezz/sounds/333948/
- Public preview: https://cdn.freesound.org/previews/333/333948_5415212-hq.mp3
- Preview SHA-256: `2d9c670b743bccfc149ecf925255722352832756c310153200e73ea2cacbe4c7`.
- Output: `B-espresso-machine.wav`, approximately 24.58 seconds.
- Output SHA-256: `c6e5a2ae853c64c4d780bd6df982d2799a15fd4fb4c6abb67aa39076f8f1184b`.
- The author describes a Cuisinart espresso machine, filter handling, coffee
  falling into a cup, and switching the machine on and off.

## Audition processing

The complete public previews are retained at their native speed and pitch.
FFmpeg converts them to mono 22,050 Hz PCM16, normalizes audition loudness
with `loudnorm=I=-23:TP=-6:LRA=11`, and applies 20 ms / 50 ms edge fades.
There are no synthetic layers or additional sound effects. These are comparison
levels, not approved in-game mix levels. Original downloads remain outside the
repository.

For each downloaded preview:

```sh
ffmpeg -i SOURCE.mp3 -ac 1 -ar 22050 \
  -af 'loudnorm=I=-23:TP=-6:LRA=11,afade=t=in:d=0.02,afade=t=out:st=FADE_START:d=0.05' \
  -c:a pcm_s16le OUTPUT.wav
```

`FADE_START` is `30.36` for A and `24.52` for B.
