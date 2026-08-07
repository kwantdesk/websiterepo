from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(r"C:\Users\Karen\Documents\QUANT DESK\kwantdesk-websiterepo\tmp\pdfs")
rendered = ROOT / "rendered"
output = ROOT / "contact_sheets"
output.mkdir(parents=True, exist_ok=True)

pages = sorted(rendered.glob("page-*.png"))
thumb_w = 330
thumb_h = 467
gap = 18
label_h = 28
cols = 3
rows = 2
per_sheet = cols * rows

for sheet_index in range((len(pages) + per_sheet - 1) // per_sheet):
    batch = pages[sheet_index * per_sheet : (sheet_index + 1) * per_sheet]
    sheet = Image.new(
        "RGB",
        (
            cols * thumb_w + (cols + 1) * gap,
            rows * (thumb_h + label_h) + (rows + 1) * gap,
        ),
        "#222222",
    )
    draw = ImageDraw.Draw(sheet)
    for i, page_path in enumerate(batch):
        image = Image.open(page_path).convert("RGB")
        image.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        col = i % cols
        row = i // cols
        x = gap + col * (thumb_w + gap)
        y = gap + row * (thumb_h + label_h + gap)
        sheet.paste(image, (x, y))
        draw.text((x, y + thumb_h + 7), page_path.stem, fill="#FFFFFF")
    sheet.save(output / f"sheet-{sheet_index + 1:02d}.png")

print(output)
