# Cat food retail packaging

- Request: 猫えさのパッケージはリアルな商品ぽく。
- Generated using the built-in imagegen skill / image generation tool, 2026-09-30.
- Original fictional LUNA branding. Ingredient and analysis copy are fictional game-prop artwork, not animal feeding advice or verified product specifications.
- Print master: `print-master.png`; generated artwork has the front on the left and back on the right.
- Runtime asset: `../../public/assets/obs/cat-food-luna.webp`, 1024 × 512, quality 86 WebP. Resized/encoded with cwebp; no changes to the artwork.
- One shared texture/material across the held pouch, discarded wrapper and delivery/stored cartons. Pouches: 40 triangles; cartons: 12 triangles each. No runtime canvas redraw or additional lights.
- Preview: `/3D/equipment-label-study.html?view=cat-food`; flat artwork: `?view=cat-food-atlas`.
- OBS uses the same factories through `ship.js` and `droid-service.js`; empty/full grip dimensions remain 0.23 × 0.25, with depths 0.05 / 0.14.

## Final generation prompt

Use case: product-mockup
Asset type: flat game texture atlas for retail cat-food packaging, original fictional product.
Create a polished, realistic supermarket cat food print design, NOT a photograph of a bag. Output a landscape image with exact 2:1 aspect ratio, two equal square panels side by side with NO gap and NO external border. Left half is the front print, right half is the back print. Each panel fills its entire square, straight on, orthographic, no perspective, no folds, no shadows, no bag mockup.
Make the product clearly recognizable as premium but everyday adult dry cat food. Use a natural friendly photographed short-haired tabby cat portrait prominently on the FRONT and a small appetizing bowl of brown dry kibble beneath it, integrated into professional consumer packaging typography and generous readable hierarchy. Cream/off-white and restrained deep forest-green print with a warm ochre CHICKEN recipe band. Original typography/identity, not resembling any existing cat-food brand or trade dress. Not a sci-fi warning label.
Front exact copy: "LUNA" as the large original fictional product name at top, "DAILY NUTRITION", "ADULT CAT", "CHICKEN RECIPE", "DRY CAT FOOD", "NET WT. 500 g". No health claims, badges, or certification logos. Cat portrait centered beneath the brand, recipe band near lower edge. Extend cream/green background to all edges.
Back: same coordinated graphic design but no cat photograph. Clear title "LUNA", subtitle "ADULT CAT / CHICKEN RECIPE". Dense, professionally typeset realistic-looking packaging text blocks, a clean two-column analysis table, a small feeding/storage section, a plain barcode and batch/date area. Exact text blocks:
"INGREDIENTS"
"Chicken meal, rice, chicken fat, beet pulp, yeast, minerals, vitamins, taurine."
"TYPICAL ANALYSIS"
"Protein 32%" "Fat 14%" "Fibre 3%" "Moisture 8%"
"DAILY FEEDING GUIDE"
"Serve measured portions. Adjust to body condition and activity. Always provide fresh drinking water."
"STORAGE"
"Reseal after opening. Store in a cool, dry place away from direct sunlight."
"LOT L-0249 / BEST BEFORE: SEE SEAL"
"NET WT. 500 g"
Small discreet final footnote "FICTIONAL GAME PROP".
Constraints: finished print artwork ready to UV-map directly onto a low-poly food pouch. Sharp, convincing consumer graphic design, photorealistic cat and kibble imagery on front only. Text upright and spelled exactly. Back table and barcode clearly organized. No third panel, no objects outside the print, no hands, no background environment, no actual brand marks, no medical or safety certification, no watermark.
