"""Verify the actual browser print files; bundled PDF dependencies only."""
from pathlib import Path
from collections import Counter
import json, math, re, unicodedata
from pypdf import PdfReader
import pdfplumber
from PIL import Image, ImageDraw

base = Path(__file__).resolve().parents[3]
evidence = base / "docs/screenshots/phase-6/print"
evidence.mkdir(parents=True, exist_ok=True)
# Chromium's Thai PDF extraction can decompose marks; normalize only QA comparisons.
def normalized(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c) and not c.isspace() and c != "\x00")

results = []
for stem, prefix in [("daily-a4-landscape", "daily"), ("occupancy-a4-landscape", "occupancy")]:
    file = base / "output/pdf" / (stem + ".pdf")
    reader = PdfReader(file)
    assert len(reader.pages) > 1, "Fixture must exercise repeated table headers"
    page_checks, row_counts = [], Counter()
    with pdfplumber.open(file) as doc:
        for index, (page, layout) in enumerate(zip(reader.pages, doc.pages)):
            text = page.extract_text() or ""
            norm = normalized(text)
            assert normalized("โรงพยาบาลอากาศอำนวย") in norm, (stem, index, "hospital header")
            assert normalized("หอผู้ป่วย") in norm, (stem, index, "table header")
            assert normalized("ผู้พิมพ์") in norm and "2569" in text, (stem, index, "print metadata")
            assert normalized("ข้ามไปเนื้อหาหลัก") not in norm, (stem, index, "navigation printed")
            assert not re.search(r"20(?:26|27)-\d{2}", text), (stem, index, "Gregorian ISO date")
            width, height = float(page.mediabox.width), float(page.mediabox.height)
            assert abs(width - 841.89) < 2 and abs(height - 595.28) < 2, (width, height)
            # Thai combining marks legitimately have zero advance width.
            assert layout.chars and all(-1 <= c["x0"] <= c["x1"] <= width + 1 and -1 <= c["top"] <= c["bottom"] <= height + 1 for c in layout.chars)
            tables = layout.extract_tables()
            complete_rows = 0
            for table in tables:
                for row in table:
                    first = normalized(row[0] or "") if row else ""
                    if normalized("หอผู้ป่วยตัวอย่าง") in first:
                        assert normalized("ตาราง") in first, (stem, index, "split row", row[0])
                        complete_rows += 1
            assert complete_rows > 0, (stem, index, "blank/header-only page")
            ids = re.findall(normalized("ตัวอย่าง") + r"(\d{2})", norm)
            row_counts.update(ids)
            page_checks.append({"page": index + 1, "widthPt": width, "heightPt": height, "repeatedHeader": True, "completeFixtureRows": complete_rows, "allTextWithinPage": True})
    copies = 10 if prefix == "daily" else 1  # 2 records/ward * 5 printed column groups
    assert row_counts == Counter({str(i).zfill(2): copies for i in range(1,35)}), (stem, row_counts)
    images = sorted(evidence.glob(prefix + "-*.png"))
    assert len(images) == len(reader.pages), (stem, "render every page first")
    tile_width, tile_height, columns = 450, 340, 4
    montage = Image.new("RGB", (columns*tile_width, math.ceil(len(images)/columns)*tile_height), "white")
    draw = ImageDraw.Draw(montage)
    for i, image_path in enumerate(images):
        with Image.open(image_path) as image:
            image.thumbnail((tile_width, tile_height-20))
            x,y = (i%columns)*tile_width, (i//columns)*tile_height
            montage.paste(image, (x,y+20))
            draw.text((x+8,y+2), "Page "+str(i+1), fill="black")
    montage.save(evidence / (prefix + "-all-pages.jpg"), quality=90)
    results.append({"file": str(file.relative_to(base)), "pages": len(reader.pages), "A4Landscape": True, "allFixtureRowsPresent": True, "headersRepeated": True, "noNavigation": True, "noISODates": True, "pageChecks": page_checks})
(base / "docs/screenshots/phase-6/print-checks.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps([{"file": x["file"], "pages": x["pages"], "passed": True} for x in results]))
