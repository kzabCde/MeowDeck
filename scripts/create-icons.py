"""Rebuild original MeowDeck PWA icon derivatives from the approved P0 idle sprite.
Does NOT edit the source sprite sheet. Uses nearest-neighbor pixels throughout.
"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
src = Image.open(root / "public/assets/meowdeck/mochi/sprites/mochi_idle_4f_96x96.png").convert("RGBA").crop((0, 0, 96, 96))
target = root / "public/icons"
target.mkdir(parents=True, exist_ok=True)
for size, name, inner in [(192, "meowdeck-192.png", 140), (512, "meowdeck-512.png", 370), (512, "meowdeck-maskable-512.png", 300), (180, "apple-touch-icon.png", 130), (64, "favicon.png", 52)]:
    canvas = Image.new("RGBA", (size, size), (25, 56, 43, 255))
    draw = ImageDraw.Draw(canvas)
    margin = int(size * .07)
    draw.rounded_rectangle((margin, margin, size-margin-1, size-margin-1), radius=int(size*.12), fill=(40,84,65,255), outline=(230,192,117,255), width=max(2, size//64))
    cat = src.resize((inner, inner), resample=Image.Resampling.NEAREST)
    canvas.alpha_composite(cat, ((size-inner)//2, (size-inner)//2))
    canvas.save(target/name, optimize=True)
print('Generated five branded PWA icons; source P0 sprite remains unchanged.')
