"""Pack the eight transparent Lucy renders around the torso rig axis.

Input: PNG frames and pivots.json produced from footer-link-sprite.html.
Usage: python3 studies/lucy/pack-footer-link.py RAW_DIR
"""

import json
import sys
from pathlib import Path

from PIL import Image


NAMES = ("f", "fl", "l", "bl", "b", "br", "r", "fr")
RAW = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / "public/assets/obs/lucy/footer-link"
OUT.mkdir(parents=True, exist_ok=True)
PIVOTS = json.loads((RAW / "pivots.json").read_text())
def frame(name, width, height, center_x, bottom, scale):
    source = Image.open(RAW / f"lucy-{name}.png").convert("RGBA")
    box = source.getchannel("A").getbbox()
    assert box is not None
    crop = source.crop(box)
    scaled = crop.resize(
        (round(crop.width * scale), round(crop.height * scale)),
        Image.Resampling.LANCZOS,
    )
    x = round(center_x + (box[0] - PIVOTS[name]["x"]) * scale)
    y = bottom - scaled.height
    assert x > 0 and y > 0 and x + scaled.width < width and y + scaled.height < height, (
        name, (x, y), scaled.size, (width, height)
    )
    result = Image.new("RGBA", (width, height))
    result.alpha_composite(scaled, (x, y))
    return result


def strip(label, width, height, center_x, bottom, scale):
    sheet = Image.new("RGBA", (width * len(NAMES), height))
    for i, name in enumerate(NAMES):
        image = frame(name, width, height, center_x, bottom, scale)
        if label == "portrait":
            image.save(OUT / f"lucy-{name}.png")
        sheet.alpha_composite(image, (width * i, 0))
    suffix = "" if label == "portrait" else "-wide"
    sheet.save(OUT / f"lucy-sprite{suffix}.webp", format="WEBP", lossless=True, method=6)
    background = Image.new("RGB", sheet.size, (223, 226, 222))
    background.paste(sheet, mask=sheet.getchannel("A"))
    preview_size = (1600, round(1600 * height / (width * len(NAMES))))
    background.resize(preview_size, Image.Resampling.LANCZOS).save(
        OUT / f"lucy{suffix}-preview.jpg", quality=90
    )


strip("portrait", 400, 498, 200, 430, 1.2)
strip("wide", 560, 315, 280, 300, 1.3)
