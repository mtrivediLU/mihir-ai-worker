const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-profile-test-'));
buildSync({ entryPoints: [path.join(__dirname, '../src/lib/profile.ts'), path.join(__dirname, '../src/lib/prompts.ts')], outdir, bundle: true, platform: 'neutral', format: 'cjs', target: 'es2022' });
const { PROFILE } = require(path.join(outdir, 'profile.js'));
const { SYSTEM_PROMPT_CHAT, SYSTEM_PROMPT_RAG } = require(path.join(outdir, 'prompts.js'));
test.after(() => fs.rmSync(outdir, { recursive: true, force: true }));
test('public profile omits personal phone, employment dates and unsupported current availability', () => {
  assert.equal(PROFILE.contact.phone, '');
  assert(PROFILE.experience.every(role => role.period === ''));
  assert.doesNotMatch(JSON.stringify(PROFILE), /actively interviewing|available immediately|5 active credentials|99\.5|Cementation|Saint-Gobain|Edgepark/i);
  assert.match(PROFILE.summary, /since 2017/);
  assert.match(PROFILE.summary, /not a claim of independent consulting tenure/);
  assert(PROFILE.certifications.some(c => /AZ-305.*exam passed/.test(c.name)));
  assert(PROFILE.certifications.some(c => /OCAP.*course completion/.test(c.name)));
});
test('both response paths direct private employment and availability questions to Mihir', () => {
  for (const prompt of [SYSTEM_PROMPT_CHAT('{}', PROFILE.availability), SYSTEM_PROMPT_RAG('public context')]) {
    assert.match(prompt, /Do not disclose or infer a full employment timeline/);
    assert.match(prompt, /current employer or client identities/);
    assert.match(prompt, /Credential evidence does not establish current certification status/);
    assert.match(prompt, /mtrivedi@laurentian.ca/);
  }
});
