# Bathroom Earth window background

Archived horizon variant. The current windows use the opposite passage's starfield;
neither Earth image is loaded. See `earth-surface-prompt.md` for the later archived variant.

- Method: built-in `image_gen` tool, using the two user-supplied orbital photographs as visual inputs.
- Project asset: `public/assets/obs/bathroom-earth-view.webp` (1024 × 1024, shared by the shower, toilet and operations rear room).
- References: `bg-bnr_kibo-view.jpg`, `esa-italy-window-horizontal01.jpg`.
- The window frame, gasket and glazing are separate geometry. Earth is a static image projected along world-space eye rays to an optical plane 1,000 km away. The small surface behind each opening only masks that view to the aperture; the image does not move with the window or stretch to its frame.

## Final prompt

Use case: precise-object-edit. Asset type: a square 1024 by 1024 photorealistic background texture for a 3D spacecraft's bathroom windows. Edit the first reference into an unobstructed Earth-and-space-only view: remove all window frames, spacecraft structure, equipment, reflections, shadows across the glass, and lettering, reconstructing the view behind them. The second image is a supporting reference for natural blue oceans, detailed white cloud formations, and the delicate blue atmospheric limb. Final composition: a very close low-Earth-orbit view, not a small globe. Earth's gently curved horizon runs across the image at about 28 to 32 percent from the top; Earth fills the lower 70 percent of the square, extending beyond the left, right, and bottom edges. The curvature should be subtle, as seen from a space-station window, with the center horizon slightly higher than its edges. Upper 30 percent clean near-black space, with no conspicuous stars. Below the horizon are natural blue oceans, scattered realistic white cloud systems, subtle land toward the far upper part, and a thin pale-blue atmosphere. Restrained photographic daylight colors and fine realistic cloud detail, not oversaturated blue or glowing science fiction. This is only the scene outside the window: NO porthole, NO frame, NO spacecraft hardware, NO glass, NO text or symbols, NO borders. Preserve the sense of Earth filling most of the window as in the references. Save one square image.
