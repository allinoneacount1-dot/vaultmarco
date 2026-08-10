// Trace the monogram silhouette into a clean single-path SVG for 3D extrusion.
import potrace from "potrace";
import fs from "node:fs";

potrace.trace(
  "scripts/tmp/monogram-mask.png",
  {
    threshold: 128,
    turdSize: 220, // drop specks
    optTolerance: 0.35,
    alphaMax: 1.0,
  },
  (err, svg) => {
    if (err) throw err;
    // keep only the path data; wrap in our own minimal svg
    const d = [...svg.matchAll(/d="([^"]+)"/g)].map((m) => m[1]).join(" ");
    const vb = svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 1024 1024";
    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><path fill="#ffffff" fill-rule="evenodd" d="${d}"/></svg>`;
    fs.writeFileSync("src/assets/monogram.svg", out);
    console.log("monogram.svg bytes:", out.length, "paths merged:", (svg.match(/<path/g) || []).length);
  },
);
