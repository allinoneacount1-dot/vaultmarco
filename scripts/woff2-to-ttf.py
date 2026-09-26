#!/usr/bin/env python3
"""Decompress + instance the Fontsource Unbounded variable woff2 to a static bold TTF.

Variable-font glyphs are drawn with overlapping / self-intersecting contours
(E, T, H, R, A = stacked strokes; N, V, L = one path crossing itself). Extruded
as-is by three.js those overlaps become internal walls and bevels that cut
through the letter faces as hairline seams, and earcut can drop cap triangles
where a contour crosses itself. Instancing therefore also merges overlaps, so
every glyph is one clean outline (requires: pip install fonttools brotli skia-pathops).
"""
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps
from fontTools.varLib.instancer import instantiateVariableFont

SRC = "node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2"
OUT = "scripts/tmp/unbounded-bold.ttf"

font = TTFont(SRC)
if "fvar" in font:
    instantiateVariableFont(font, {"wght": 700}, inplace=True)
removeOverlaps(font)
font.flavor = None
font.save(OUT)
print("saved", OUT, "unitsPerEm:", font["head"].unitsPerEm)
