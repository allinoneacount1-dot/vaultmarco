#!/usr/bin/env python3
"""Decompress + instance the Fontsource Unbounded variable woff2 to a static bold TTF."""
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SRC = "node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2"
OUT = "scripts/tmp/unbounded-bold.ttf"

font = TTFont(SRC)
if "fvar" in font:
    instantiateVariableFont(font, {"wght": 700}, inplace=True)
font.flavor = None
font.save(OUT)
print("saved", OUT, "unitsPerEm:", font["head"].unitsPerEm)
