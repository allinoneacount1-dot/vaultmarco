// Convert TTF -> three.js typeface JSON (facetype-style) for drei <Text3D>.
import opentype from "opentype.js";
import fs from "node:fs";

const SRC = "scripts/tmp/unbounded-bold.ttf";
const OUT = "src/assets/unbounded-bold.typeface.json";
const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,+/—·%$&-'’↗";

const buf = fs.readFileSync(SRC);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const scale = (1000 * 100) / ((font.unitsPerEm || 2048) * 72);
const round = Math.round;

const glyphs = {};
for (const ch of CHARS) {
  const g = font.charToGlyph(ch);
  if (!g) continue;
  const token = [];
  const path = g.path;
  for (const c of path.commands) {
    if (c.type === "M") token.push("m", round(c.x * scale), round(c.y * scale));
    else if (c.type === "L") token.push("l", round(c.x * scale), round(c.y * scale));
    else if (c.type === "Q")
      token.push("q", round(c.x * scale), round(c.y * scale), round(c.x1 * scale), round(c.y1 * scale));
    else if (c.type === "C")
      token.push(
        "b",
        round(c.x * scale),
        round(c.y * scale),
        round(c.x1 * scale),
        round(c.y1 * scale),
        round(c.x2 * scale),
        round(c.y2 * scale),
      );
    // 'Z' omitted — three closes subpaths automatically
  }
  glyphs[ch] = {
    ha: round((g.advanceWidth ?? font.unitsPerEm) * scale),
    x_min: round((g.xMin ?? 0) * scale),
    x_max: round((g.xMax ?? 0) * scale),
    o: token.join(" "),
  };
}

const json = {
  glyphs,
  familyName: "Unbounded",
  ascender: round(font.ascender * scale),
  descender: round(font.descender * scale),
  underlinePosition: round((font.tables.post?.underlinePosition ?? -100) * scale),
  underlineThickness: round((font.tables.post?.underlineThickness ?? 50) * scale),
  boundingBox: {
    yMin: round(font.tables.head.yMin * scale),
    xMin: round(font.tables.head.xMin * scale),
    yMax: round(font.tables.head.yMax * scale),
    xMax: round(font.tables.head.xMax * scale),
  },
  resolution: 1000,
  original_font_information: { format: 0, fontFamily: "Unbounded", fontSubfamily: "Bold" },
};

fs.writeFileSync(OUT, JSON.stringify(json));
console.log("typeface glyphs:", Object.keys(glyphs).length, "bytes:", fs.statSync(OUT).size);
