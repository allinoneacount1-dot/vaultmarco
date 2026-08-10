#!/usr/bin/env python3
"""Prepare monogram bitmap for tracing + fringe-free dark logo.

1. marcovault-logo-dark.png  — un-matte the white fringe (logo was traced off white)
2. monogram-mask.png         — black silhouette of the VM letterforms only
                               (ring/sparkles removed by radial mask) for potrace
"""
from PIL import Image
import numpy as np

SRC = "src/assets/marcovault-logo.png"

im = Image.open(SRC).convert("RGBA")
a = np.array(im).astype(np.float64)
rgb, alpha = a[:, :, :3], a[:, :, 3:4] / 255.0

# --- 1. un-matte against white: rgb_true = (rgb - (1-a)*255) / a ---
safe = np.clip(alpha, 1e-4, 1.0)
unmatted = np.clip((rgb - (1.0 - alpha) * 255.0) / safe, 0, 255)
out = np.dstack([unmatted, alpha * 255.0]).astype(np.uint8)
# fully transparent pixels: zero the color to avoid stray white
out[out[:, :, 3] == 0] = 0
Image.fromarray(out, "RGBA").save("src/assets/marcovault-logo-dark.png", optimize=True)

# favicon (512, on void background so it reads in any tab theme)
fav = Image.new("RGBA", im.size, (5, 5, 6, 255))
fav.alpha_composite(Image.fromarray(out, "RGBA"))
fav.thumbnail((512, 512), Image.LANCZOS)
fav.save("public/favicon.png", optimize=True)

# --- 2. silhouette mask for potrace: letterforms only ---
h, w = a.shape[:2]
yy, xx = np.mgrid[0:h, 0:w]
cy, cx = h / 2, w / 2
r = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
solid = (a[:, :, 3] > 140) & (r < 0.36 * w)  # inside the ring
# drop the vertical sparkle streak (thin column above/below the letterforms)
streak = (np.abs(xx - cx) < 0.016 * w) & ((yy < 0.34 * h) | (yy > 0.72 * h))
# the thin center "needle" inside the V counter (~7px wide) — letters only for 3D
streak |= (np.abs(xx - cx) < 0.007 * w) & (yy > 0.29 * h) & (yy < 0.442 * h)
solid &= ~streak
mask = np.full((h, w), 255, np.uint8)
mask[solid] = 0
Image.fromarray(mask, "L").save("scripts/tmp/monogram-mask.png")
print("wrote dark logo, favicon, monogram mask;",
      "solid px:", int(solid.sum()))
