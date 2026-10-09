# PAX footer: Lucy seated sprite

`public/assets/obs/lucy/footer-link/lucy-sprite.webp` is a transparent 8-frame strip. Each frame is 400 × 498 pixels; the strip is 3200 × 498. The order is front, front-left, left, back-left, back, back-right, right, front-right. It fits the existing PAX footer window because its frame ratio is 200:249.

`lucy-sprite-wide.webp` uses the same eight poses, with a 560 × 315 transparent frame. At the footer's 48px height the cat is easier to see. Use a 560:315 window for this variant; it needs a small CSS change to `.hidden-game-frame`.

The source pose comes from the approved `lucy-cabin.glb` and `animateLucy(..., mode: 'look')`. The render uses the same toon treatment as OBS. `footer-link-sprite.html` exposes the torso rig midpoint between `pelvis` and `Bone002`; `pack-footer-link.py` centers every frame on that projected point, rather than on the cat-and-tail image bounds. `footer-link-preview.html` shows the first frame at 200 × 249 and both variants at the PAX footer's 48px height. Start `node studies/lucy/study-server.mjs`, then open `http://127.0.0.1:8767/3D/studies/lucy/footer-link-preview.html`.

The PAX copies are `renew-pax/assets/images/moon/lucy-sprite.webp` and `lucy-sprite-wide.webp`. Its current astronaut sprite and footer source are separate, existing work. The OBS destination URL should be confirmed before changing the anchor.
