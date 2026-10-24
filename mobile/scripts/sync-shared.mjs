// The app reuses the website's pure rule files verbatim (fees, gig roles, UPI and phone
// rules, attachment limits, Inner Circle workflow) so money and role logic is never
// re-derived. Metro watchFolders would also work but risks bundling the web app's React,
// so the files are copied instead and this script keeps the copies honest.
//   node mobile/scripts/sync-shared.mjs           copy lib/ -> mobile/shared/
//   node mobile/scripts/sync-shared.mjs --check   exit 1 if any copy has drifted
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['fees', 'gigRoles', 'attachments', 'innerCircle', 'upi', 'phone'];
const norm = (s) => s.replace(/\r\n/g, '\n');
const check = process.argv.includes('--check');
let drift = 0;

for (const f of FILES) {
  const src = norm(readFileSync(join(root, 'lib', `${f}.ts`), 'utf8'));
  const dst = join(root, 'mobile', 'shared', `${f}.ts`);
  const have = existsSync(dst) ? norm(readFileSync(dst, 'utf8')) : null;
  if (have === src) continue;
  if (check) {
    console.error(`DRIFT: mobile/shared/${f}.ts differs from lib/${f}.ts`);
    drift++;
  } else {
    writeFileSync(dst, src);
    console.log(`copied lib/${f}.ts`);
  }
}
if (check && drift) process.exit(1);
if (check) console.log('shared files match lib/');
