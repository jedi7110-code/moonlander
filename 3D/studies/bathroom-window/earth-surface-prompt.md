# Earth surface seen through cabin windows

Archived study. On 2026-09-29 the Earth view was replaced at the user's request
by the same starfield used in the opposite passage. This asset is no longer loaded.

- Method: built-in `image_gen` image edit.
- Input: the generated ocean-and-cloud orbital photograph, itself based on the user's photographic references.
- Asset: `public/assets/obs/earth-surface-view.webp`, 1024 × 1024, WebP quality 88.
- Shared by the shower, toilet and operations rear-room windows.
- Earth fills the image, with a prominent continent and coastline, sparse clouds, and no horizon or black space.
- Each view uses world-space projection onto an optical plane 1,000 km away; the visible window geometry only masks the view. There is no Earth sphere or extra render pass.

## Final prompt

Use case: precise-object-edit. Edit this photorealistic straight-down orbital Earth view to reveal a large continent and much less cloud. Preserve the realistic blue ocean, natural daylight, straight-down camera direction, and square composition. Replace about 55 to 60 percent of the ocean with a broad connected continent: detailed tan, muted olive and brown terrain, subtle mountain ranges, dry basins, coastal plains, and a clearly readable natural coastline. The coastline must pass diagonally through the CENTRAL part of the square so a crop of the central area clearly shows both substantial land and deep blue ocean. The remaining roughly 40 percent is sea, with a narrow restrained turquoise shallows near parts of the coast. Reduce cloud coverage to under 8 percent: only a few thin wisps or small scattered clouds, leaving the central land and coastline unobstructed. Geography should feel like a real broad continental coast seen from low Earth orbit, not isolated tropical islands, an atlas, a flat map graphic, or fantasy terrain. Keep the land at large continental scale, with no visible individual buildings. The entire image and all four corners are Earth's surface. NO horizon, NO planetary limb, NO black space, NO atmosphere rim, NO stars, NO window or spacecraft parts, NO text, NO borders. Fine photographic surface details, natural restrained colors, no excessive saturation, no thick white cloud fields. Output one square image.
