// Generate the static 1200x630 social-share card.
//
// WHY STATIC. The dynamic route (app/u/[username]/opengraph-image.tsx) rendered
// a personalised card with next/og, which pulls Satori + resvg into the Worker:
// resvg.wasm 1.38MB, yoga.wasm 71KB and a 126KB font, together ~605 KiB
// GZIPPED — about 20% of the 3072 KiB Cloudflare ceiling, spent so that a
// shared profile link shows someone's name on a picture. With the ceiling
// exceeded (3074.30 KiB) that trade stops being arguable: the whole site could
// not deploy. A branded card still gives every link a proper preview.
//
// Also fixes a quieter bug: app/layout.tsx declared /logo.png as 1200x630 and
// that file is 1024x1024, so every card was letterboxed by the platform.
//
//   node scripts/make-og-card.mjs
import sharp from "sharp";

const W = 1200, H = 630;
const INK = "#0B0B11", PURPLE = "#8825F5", SOFT = "#C9A9FF";

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="18%" cy="12%" r="85%">
      <stop offset="0%" stop-color="#341044" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="${INK}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${INK}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${PURPLE}"/>
  <text x="80" y="214" font-family="Segoe UI, DejaVu Sans, sans-serif" font-size="30"
        font-weight="700" fill="${SOFT}" letter-spacing="6">DOITFORME.IN</text>
  <text x="80" y="310" font-family="Segoe UI, DejaVu Sans, sans-serif" font-size="68"
        font-weight="700" fill="#FAFAFA" letter-spacing="-2">Get paid for real work.</text>
  <text x="80" y="386" font-family="Segoe UI, DejaVu Sans, sans-serif" font-size="68"
        font-weight="700" fill="#FAFAFA" letter-spacing="-2">Money held until approved.</text>
  <text x="80" y="470" font-family="Segoe UI, DejaVu Sans, sans-serif" font-size="27"
        fill="rgba(250,250,250,0.62)">India&#8217;s campus freelance network &#183; verified students &#183; UPI payouts</text>
  <rect x="80" y="516" width="188" height="52" rx="26" fill="${PURPLE}"/>
  <text x="112" y="550" font-family="Segoe UI, DejaVu Sans, sans-serif" font-size="23"
        font-weight="700" fill="#FFFFFF">Escrow&#8209;backed</text>
</svg>`;

const sloth = await sharp("public/hisloth.png").resize(330, 330, { fit: "contain",
  background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: sloth, top: 150, left: 800 }])
  .png({ compressionLevel: 9 })
  .toFile("public/og-card.png");

const m = await sharp("public/og-card.png").metadata();
const { size } = await sharp("public/og-card.png").toBuffer({ resolveWithObject: true })
  .then(r => ({ size: r.data.length }));
console.log(`public/og-card.png  ${m.width}x${m.height}  ${(size/1024).toFixed(0)} KB`);
