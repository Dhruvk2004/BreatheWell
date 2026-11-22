/**
 * Renders the install icons for the web app manifest (F24) from the logo mark: 192 and 512 px, plus
 * a maskable 512 px with the tile inside the safe zone. Run by hand (`npm run icons`); the PNGs are
 * committed, so builds never need sharp.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const mark = await readFile(join(ROOT, "public/logo-mark.svg"));

for (const size of [192, 512]) {
  await sharp(mark, { density: 512 })
    .resize(size, size)
    .png()
    .toFile(join(ROOT, `public/icons/icon-${size}.png`));
}

// Maskable: the brand colour fills the square; the mark sits in the central 80% safe zone.
const inner = await sharp(mark, { density: 512 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0B5E7A" } })
  .composite([{ input: inner, top: 51, left: 51 }])
  .png()
  .toFile(join(ROOT, "public/icons/maskable-512.png"));
console.log("wrote public/icons/icon-192.png, icon-512.png, maskable-512.png");
