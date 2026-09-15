from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path("client/public/icons")
out.mkdir(parents=True, exist_ok=True)

for size in (192, 512):
    image = Image.new("RGBA", (size, size), "#0f172a")
    draw = ImageDraw.Draw(image)
    margin = round(size * 0.12)
    radius = round(size * 0.18)
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=radius,
        fill="#1e293b",
        outline="#38bdf8",
        width=max(2, round(size * 0.018)),
    )
    font = None
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ):
        if Path(candidate).exists():
            font = ImageFont.truetype(candidate, round(size * 0.34))
            break
    if font is None:
        raise SystemExit("A bold system font is required to generate the PWA icon")
    text = "LF"
    box = draw.textbbox((0, 0), text, font=font)
    x = (size - (box[2] - box[0])) / 2 - box[0]
    y = (size - (box[3] - box[1])) / 2 - box[1] - round(size * 0.02)
    draw.text((x, y), text, font=font, fill="#f8fafc")
    image.save(out / f"icon-{size}.png", optimize=True)
