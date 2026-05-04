#!/usr/bin/env node
/**
 * Single-command desktop release:
 *   1. Bump version in app/package.json (patch by default, or pass an explicit
 *      semver: `npm run update-desktop 1.2.0`).
 *   2. Build the Electron renderer + package the .app via electron-builder.
 *   3. Upload zip + dmg to S3 (via api/scripts/uploadDesktopRelease.js).
 *   4. Patch api/desktopVersion.js so the live API serves the new version,
 *      which makes every running desktop client see a mismatch and prompt
 *      the user to update.
 *
 * After this runs, commit + push so Coolify deploys the new API version.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const APP_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(APP_DIR, '..');
const API_DIR = path.join(REPO_DIR, 'api');
const APP_PKG_PATH = path.join(APP_DIR, 'package.json');
const API_VERSION_PATH = path.join(API_DIR, 'desktopVersion.js');

function bumpPatch(version) {
  const parts = String(version).split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Cannot parse semver: ${version}`);
  }
  parts[2] += 1;
  return parts.join('.');
}

function isValidSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(String(v).trim());
}

function run(cmd, cwd) {
  console.log(`\n→ ${cmd}  (in ${path.relative(REPO_DIR, cwd) || '.'})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function main() {
  const arg = process.argv[2];
  const pkg = JSON.parse(fs.readFileSync(APP_PKG_PATH, 'utf8'));
  const oldVersion = pkg.version;
  const newVersion = arg
    ? (isValidSemver(arg) ? arg : (() => { throw new Error(`Invalid version "${arg}". Use X.Y.Z.`); })())
    : bumpPatch(oldVersion);

  console.log(`\nDesktop release: ${oldVersion} → ${newVersion}`);

  // 1. Bump app/package.json
  pkg.version = newVersion;
  fs.writeFileSync(APP_PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✓ wrote app/package.json (version ${newVersion})`);

  // 2. Build + package
  run('npm run export', APP_DIR);

  // 3. Upload to S3
  run('node scripts/uploadDesktopRelease.js', API_DIR);

  // 4. Patch api/desktopVersion.js
  const current = require(API_VERSION_PATH);
  const next = {
    version: newVersion,
    downloadUrl: current.downloadUrl,
    dmgUrl: current.dmgUrl,
  };
  const body =
    `// Source of truth for the currently-published desktop app version.\n` +
    `// Bumped automatically by \`app/scripts/updateDesktop.js\` — don't edit by hand.\n` +
    `module.exports = ${JSON.stringify(next, null, 2)};\n`;
  fs.writeFileSync(API_VERSION_PATH, body);
  console.log(`✓ wrote api/desktopVersion.js (version ${newVersion})`);

  console.log(
    `\n✅ Released ${newVersion}. Now commit & push so the API redeploys:\n` +
      `   git add -A && git commit -m "release desktop ${newVersion}" && git push\n`,
  );
}

try {
  main();
} catch (err) {
  console.error(`\n✗ update-desktop failed: ${err.message}`);
  process.exit(1);
}
