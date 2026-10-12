// Generate the ANDROID launcher icon set from public/sloth.png.
//
// WHY THIS EXISTS: `npx cap add android` ships Capacitor's own placeholder
// launcher icon, and nothing in the build replaces it. So the APK installed
// with the real app id and the real name "DoItForMe" and then sat on the home
// screen as the generic Capacitor logo — which is the single most obvious
// "unfinished" signal a store listing can carry, and it is invisible in every
// web build and every test.
//
// scripts/make-app-icons.mjs already does this for the PWA and iOS. It cannot
// be reused: Android wants different sizes, a SEPARATE foreground layer for
// adaptive icons, and a different safe zone.
//
//   node scripts/make-android-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SRC = "public/sloth.png";
const RES = "android/app/src/main/res";

// The same grape as the PWA and apple-touch icons, so the app does not have a
// different identity on the home screen than in the browser. A maskable or
// adaptive icon's padding is VISIBLE, so it has to be a deliberate brand colour
// — transparent renders as white or black depending on the launcher.
const GRAPE = { r: 0x34, g: 0x10, b: 0x44, alpha: 1 };

// Adaptive icons (API 26+) are a 108dp canvas of which only the centre 72dp is
// guaranteed visible: the launcher crops the rest to whatever shape it likes
// (circle, squircle, rounded square) and ANIMATES within the margin. Art drawn
// to the full 108 loses its edges on most devices. 72/108 = 0.667.
const ADAPTIVE_SAFE = 72 / 108;

// Legacy icon (API < 26) is a flat 48dp with no mask, so it is drawn nearly
// full-bleed on the brand colour.
const LEGACY_INSET = 0.82;

const DENSITIES = [
  ["mdpi", 1],
  ["hdpi", 1.5],
  ["xhdpi", 2],
  ["xxhdpi", 3],
  ["xxxhdpi", 4],
];

/** A circular alpha mask, for ic_launcher_round. */
const circleMask = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );

for (const [density, scale] of DENSITIES) {
  const dir = path.join(RES, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });

  // ---- Adaptive foreground: art centred on a TRANSPARENT 108dp canvas. The
  // background layer (a brand colour, set in values/ic_launcher_background.xml)
  // supplies the fill, so baking it in here would double it up and defeat the
  // launcher's parallax.
  const fg = Math.round(108 * scale);
  const art = Math.round(fg * ADAPTIVE_SAFE);
  const off = Math.round((fg - art) / 2);
  await sharp({
    create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: await sharp(SRC).resize(art, art, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), top: off, left: off }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, "ic_launcher_foreground.png"));

  // ---- Legacy square + round, flattened onto the grape.
  const lg = Math.round(48 * scale);
  const lgArt = Math.round(lg * LEGACY_INSET);
  const lgOff = Math.round((lg - lgArt) / 2);
  const flattened = await sharp({ create: { width: lg, height: lg, channels: 4, background: GRAPE } })
    .composite([{ input: await sharp(SRC).resize(lgArt, lgArt, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), top: lgOff, left: lgOff }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await sharp(flattened).toFile(path.join(dir, "ic_launcher.png"));
  await sharp(flattened)
    .composite([{ input: circleMask(lg), blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, "ic_launcher_round.png"));

  console.log(`${density.padEnd(8)} foreground ${fg}px  legacy ${lg}px`);
}
