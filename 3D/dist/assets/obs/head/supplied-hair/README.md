# Supplied Milo hair

Imported from the user-provided `obj file.obj` (groups `Hair_S_` and
`Scalp_Male`) and corresponding files in `textures/maya file.fbm`.
The original files are untouched. No face, eye, beard or body mesh is displayed
from the supplied character.

`hair.json` and `scalp.json` preserve the source UV layout. Hair/scalp colour,
opacity and hair normal maps are copied without resampling. The importer fits
the original skull's radial surface to Milo's scan, preserving the hair volume
above it. This deformation is baked once rather than calculated during loading.
The approved forward head offset is applied by the head controller.

Rebuild from the 3D project root:

```sh
node scripts/import-milo-hair.mjs '/path/to/obj file.obj' '/path/to/textures/maya file.fbm'
```

Study: `?mode=appearance&hair=reference&beard=none`.
The prior A–D hairstyles remain available. Shared imported textures/materials
are retained when toggling away, so returning to this style does not reload it.

These are user-supplied assets; their redistribution licence has not been verified.

## Lightweight display version

The current preview uses the further-reduced `hair-solid.json`: 12,069 triangles
and 20,079 vertices before the localized nape trim. It is generated directly from
`hair.json` with ratio `0.25` using the same Blender command below and a different
output filename. The previous `hair-lite.json` remains available. Both versions
use the same 2K textures. Micro-normal strength is now 0.18 and roughness is 0.84
to emphasize matte locks. The nape trim preserves the previously removed side
protrusions. The figures below describe the retained 50% version, not the active
25% version.

The viewer uses `hair-lite.json` and the three `hair-*-2k` textures. The fitted
full-resolution geometry and original textures remain here for regeneration.
Hair triangles: 48,278 -> 24,139; scalp remains 1,148 triangles. Hair vertices:
56,300 -> 32,193. Hair colour/opacity/normal textures: 4096 -> 2048 pixels per
side. Scalp textures were already 1024 pixels and remain unchanged.
Loaded asset file sizes total 24,580,799 -> 10,976,902 bytes (before HTTP compression).
This does not imply a measured FPS improvement; transparent pixel overdraw remains.

After reimporting the full-quality source, regenerate the lightweight version:

```sh
blender -b --factory-startup --python scripts/simplify-milo-hair.py -- public/assets/obs/head/supplied-hair/hair.json public/assets/obs/head/supplied-hair/hair-lite.json 0.5
sips -Z 2048 public/assets/obs/head/supplied-hair/hair-color.png --out public/assets/obs/head/supplied-hair/hair-color-2k.png
sips -Z 2048 public/assets/obs/head/supplied-hair/hair-opacity.jpg --out public/assets/obs/head/supplied-hair/hair-opacity-2k.jpg
sips -Z 2048 public/assets/obs/head/supplied-hair/hair-normal.png --out public/assets/obs/head/supplied-hair/hair-normal-2k.png
```
