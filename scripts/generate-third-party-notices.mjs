/**
 * Generate THIRD_PARTY_NOTICES.md from root + server package-lock.json.
 * Usage: node scripts/generate-third-party-notices.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'THIRD_PARTY_NOTICES.md');

/** Licenses that typically block closed/capstone redistribution if exclusive. */
const BLOCKING = [
  /^agpl/i,
  /^gpl-3\.0(?!-or-later)/i,
  /^gpl-2\.0(?!-or-later)/i,
  /^gpl($|[^-\w])/i,
  /^sspl/i,
  /^commons-clause/i,
];

/** Worth noting for panel but still OK for typical use. */
const REVIEW_HINTS = [
  { re: /mpl-2\.0/i, note: 'MPL-2.0 (file-level copyleft; OK to use without open-sourcing Ordinex)' },
  { re: /gpl-3\.0-or-later/i, note: 'GPL-3.0-or-later appears in a dual-license expression; MIT path usually available' },
  { re: /cc-by/i, note: 'Creative Commons attribution — keep credit if redistributing the asset' },
];

function normalizeLicense(raw) {
  if (raw == null) return '(none)';
  if (typeof raw === 'string') return raw.trim() || '(none)';
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === 'string' ? x : x?.type || String(x)))
      .filter(Boolean)
      .join(' OR ') || '(none)';
  }
  if (typeof raw === 'object' && raw.type) return String(raw.type);
  return String(raw);
}

function packageNameFromLockKey(key) {
  // "node_modules/foo" or "node_modules/@scope/foo" or nested ".../node_modules/bar"
  const parts = key.split('node_modules/').filter(Boolean);
  return parts[parts.length - 1] || key;
}

function collectFromLock(lockPath, label) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const packages = lock.packages || {};
  /** @type {Map<string, { name: string, version: string, license: string }>} */
  const map = new Map();

  for (const [key, meta] of Object.entries(packages)) {
    if (!key) continue; // root workspace entry
    if (!key.includes('node_modules/')) continue;
    const name = packageNameFromLockKey(key);
    const version = meta.version || '?';
    const license = normalizeLicense(meta.license ?? meta.licenses);
    const id = `${name}@${version}`;
    if (!map.has(id)) {
      map.set(id, { name, version, license });
    }
  }

  const rows = [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );

  const counts = {};
  for (const r of rows) {
    counts[r.license] = (counts[r.license] || 0) + 1;
  }

  return { label, lockPath: path.relative(root, lockPath).replace(/\\/g, '/'), rows, counts };
}

function isBlocking(license) {
  const l = license.toLowerCase();
  // Dual licenses that include MIT/Apache are OK
  if (/\bmit\b/.test(l) || /\bapache-2\.0\b/.test(l) || /\bisc\b/.test(l) || /\bbsd\b/.test(l)) {
    if (/agpl/i.test(license)) return true; // AGPL even dual is concerning
    return false;
  }
  return BLOCKING.some((re) => re.test(license));
}

function reviewNotes(counts) {
  const notes = [];
  for (const lic of Object.keys(counts)) {
    for (const h of REVIEW_HINTS) {
      if (h.re.test(lic)) notes.push(`- \`${lic}\`: ${h.note}`);
    }
  }
  return [...new Set(notes)].sort();
}

function formatCounts(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([lic, n]) => `| \`${lic.replace(/\|/g, '\\|')}\` | ${n} |`)
    .join('\n');
}

function formatTable(rows) {
  const lines = [
    '| Package | Version | License |',
    '|---------|---------|---------|',
  ];
  for (const r of rows) {
    const lic = r.license.replace(/\|/g, '\\|');
    lines.push(`| ${r.name} | ${r.version} | ${lic} |`);
  }
  return lines.join('\n');
}

function main() {
  const frontend = collectFromLock(path.join(root, 'package-lock.json'), 'Frontend (root)');
  const server = collectFromLock(path.join(root, 'server', 'package-lock.json'), 'Server');

  const allRows = [...frontend.rows, ...server.rows];
  const blocking = allRows.filter((r) => isBlocking(r.license));

  const combinedCounts = {};
  for (const set of [frontend.counts, server.counts]) {
    for (const [k, v] of Object.entries(set)) {
      combinedCounts[k] = (combinedCounts[k] || 0) + v;
    }
  }

  const generatedAt = new Date().toISOString().slice(0, 10);
  const review = [
    ...reviewNotes(frontend.counts),
    ...reviewNotes(server.counts),
  ];
  const uniqueReview = [...new Set(review)].sort();

  const md = `# Third-party notices (generated)

> **Do not edit by hand.** Regenerate with:
> \`\`\`bash
> npm run licenses:generate
> \`\`\`
>
> Generated: **${generatedAt}**  
> Sources: \`${frontend.lockPath}\`, \`${server.lockPath}\`  
> Direct-dependency narrative credits: see \`LICENSE\` and in-app \`/licenses\`.  
> SaaS processors (Groq, PayMongo, etc.): see \`docs/legal/PRIVACY_POLICY.md\` — not listed here.

## Verdict

${blocking.length === 0
    ? '**Pass.** No AGPL / exclusive-GPL / SSPL licenses were found that would typically forbid use of this stack in a student/capstone product. Nested packages are overwhelmingly MIT, Apache-2.0, BSD, or ISC.'
    : `**Fail.** ${blocking.length} package(s) use a license that needs legal review before redistribution:\n\n${blocking.map((r) => `- ${r.name}@${r.version} — \`${r.license}\``).join('\n')}`}

## License summary (both locks)

| License | Package count |
|---------|---------------|
${formatCounts(combinedCounts)}

${uniqueReview.length ? `## Notable licenses (still OK to use)\n\n${uniqueReview.join('\n')}\n` : ''}
## ${frontend.label}

**${frontend.rows.length}** unique package versions.

### Counts

| License | Count |
|---------|-------|
${formatCounts(frontend.counts)}

### Packages

${formatTable(frontend.rows)}

## ${server.label}

**${server.rows.length}** unique package versions.

### Counts

| License | Count |
|---------|-------|
${formatCounts(server.counts)}

### Packages

${formatTable(server.rows)}
`;

  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`Wrote ${path.relative(root, outPath)} (${frontend.rows.length} frontend + ${server.rows.length} server packages).`);

  if (blocking.length > 0) {
    console.error('Blocking licenses detected:', blocking.map((r) => `${r.name}@${r.version} (${r.license})`).join(', '));
    process.exit(1);
  }
}

main();
