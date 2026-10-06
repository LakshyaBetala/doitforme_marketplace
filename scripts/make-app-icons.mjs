// Generate the PWA / app icon set from public/sloth.png.
//
// Two problems with what the manifest declared before:
//
// 1. It pointed BOTH the 192 and the 512 entry at public/logo.png, which is a
//    1024x1024 890KB file. Every install downloaded 890KB twice and the browser
//    downscaled it, so the small icon looked soft as well as costing the bytes.
//
// 2. It declared logo.png as `purpose: "maskable"`. A maskable icon is cropped
//    to whatever shape the launcher wants — Android crops to a circle on most
//    devices — and the safe zone is the middle 80%, so a full-bleed square logo
//    loses its edges. Declaring an icon maskable without padding it is how an
//    app ends up with its own corners cut off on the home screen.
//
// So: real sizes for `any`, and a separate padded canvas for `maskable`.
//
//   node scripts/make-app-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SRC = "public/sloth.png";
const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

// The grape from the workspace rail. A maskable icon's padding is visible, so it
// has to be a deliberate brand colour rather than transparent — transparent
// renders as white or black depending on the launcher.
const GRAPE = { r: 0x34, g: 0x10, b: 0x44, alpha: 1 };

const ANY = [192, 512];
const MASKABLE = [192, 512];

for (const size of ANY) {
  const file = path.join(OUT, `icon-${size}.png`);
  await sharp(SRC).resize(size, size, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(file);
  console.log("any     ", file);
}

for (const size of MASKABLE) {
  // The safe zone for a maskable icon is the centre 80%, so the artwork is inset
  // by 10% on each side and the rest is brand colour.
  const inner = Math.round(size * 0.8);
  const pad = Math.round((size - inner) / 2);
  const file = path.join(OUT, `maskable-${size}.png`);
  const art = await sharp(SRC).resize(inner, inner, { fit: "cover" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: GRAPE } })
    .composite([{ input: art, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log("maskable", file);
}

// Apple ignores the manifest and uses apple-touch-icon. It also does not respect
// transparency — it composites onto black — so this one is pre-flattened.
const apple = path.join(OUT, "apple-touch-icon.png");
await sharp({ create: { width: 180, height: 180, channels: 4, background: GRAPE } })
  .composite([{ input: await sharp(SRC).resize(156, 156, { fit: "cover" }).toBuffer(), top: 12, left: 12 }])
  .png({ compressionLevel: 9 })
  .toFile(apple);
console.log("apple   ", apple);
