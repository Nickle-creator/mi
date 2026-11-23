#!/usr/bin/env python3
"""Shrinks the personal photos so the page loads fast. Run from the site folder:
    pip install pillow && python3 tools/optimize-photos.py
Originals are kept in ./originals/."""
import os, shutil
from PIL import Image, ImageOps
names = "memoryone two three four eight nine ten five eleven twelve".split()
os.makedirs("originals", exist_ok=True)
for n in names:
    f = f"{n}.jpeg"
    if not os.path.exists(f): continue
    shutil.copy2(f, f"originals/{f}") if not os.path.exists(f"originals/{f}") else None
    im = ImageOps.exif_transpose(Image.open(f"originals/{f}")).convert("RGB")
    im.thumbnail((1800, 1800), Image.LANCZOS)
    im.save(f, "JPEG", quality=80, optimize=True, progressive=True)
    print(f, os.path.getsize(f) // 1024, "KB")
