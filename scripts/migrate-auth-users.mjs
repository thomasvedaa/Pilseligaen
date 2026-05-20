#!/usr/bin/env node

/*
  Create Supabase Auth users from existing public.pl_users rows and link them
  back with pl_users.auth_user_id.

  Dry run:
    $env:SUPABASE_SERVICE_ROLE_KEY="..."
    node scripts/migrate-auth-users.mjs --dry-run

  Apply:
    $env:SUPABASE_SERVICE_ROLE_KEY="..."
    node scripts/migrate-auth-users.mjs --apply

  Optional:
    $env:AUTH_EMAIL_DOMAIN="pilseligaen.local"
    $env:USE_EXISTING_PASSWORDS="false"
*/

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SUPABASE_URL = 'https://hmgvocclrpfypmflbyop.supabase.co';
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dryRun = args.has('--dry-run') || !apply;

const SUPABASE_URL = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const EMAIL_DOMAIN = process.env.AUTH_EMAIL_DOMAIN || 'pilseligaen.local';
const USE_EXISTING_PASSWORDS = process.env.USE_EXISTING_PASSWORDS !== 'false';
const MIN_PASSWORD_LENGTH = Number(process.env.MIN_PASSWORD_LENGTH || 6);

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'auth-migration-output');

if (!SERVICE_KEY) {
  die([
    'Missing SUPABASE_SERVICE_ROLE_KEY.',
    'Find it in Supabase Dashboard -> Project Settings -> API -> service_role key.',
    'Do not commit or paste this key into frontend code.',
  ]);
}

function die(lines) {
  console.error(Array.isArray(lines) ? lines.join('\n') : lines);
  process.exit(1);
}

function safeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `user-${randomBytes(3).toString('hex')}`;
}

function emailFor(profile, usedEmails) {
  const base = safeUsername(profile.username_lc || profile.username);
  let email = `${base}@${EMAIL_DOMAIN}`;
  let i = 2;
  while (usedEmails.has(email)) {
    email = `${base}-${i}@${EMAIL_DOMAIN}`;
    i++;
  }
  usedEmails.add(email);
  return email;
}

function randomPassword() {
  return `Pilse-${randomBytes(9).toString('base64url')}1!`;
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = text; }
  }

  if (!res.ok) {
    const message = typeof body === 'string'
      ? body
      : (body?.message || body?.msg || body?.error_description || body?.error || text);
    const err = new Error(message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

async function getProfiles() {
  const select = 'id,username,username_lc,nickname,password,auth_user_id';
  const url = `${SUPABASE_URL}/rest/v1/pl_users?select=${encodeURIComponent(select)}&order=username_lc.asc`;
  try {
    return await requestJson(url);
  } catch (err) {
    const msg = String(err.message || '');
    if (msg.includes('auth_user_id') || msg.includes('column')) {
      die([
        'The column public.pl_users.auth_user_id does not exist yet.',
        'Run this in Supabase SQL Editor first:',
        '',
        'alter table public.pl_users',
        'add column if not exists auth_user_id uuid unique references auth.users(id);',
      ]);
    }
    throw err;
  }
}

async function listAuthUsers() {
  const users = [];
  for (let page = 1; page < 100; page++) {
    const body = await requestJson(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`);
    const rows = Array.isArray(body) ? body : (body?.users || []);
    users.push(...rows);
    if (rows.length < 100) break;
  }
  return users;
}

async function createAuthUser({ email, password, profile }) {
  return requestJson(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        pl_user_id: profile.id,
        username: profile.username,
      },
    }),
  });
}

async function linkProfile(profileId, authUserId) {
  const url = `${SUPABASE_URL}/rest/v1/pl_users?id=eq.${encodeURIComponent(profileId)}`;
  await requestJson(url, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ auth_user_id: authUserId }),
  });
}

const profiles = await getProfiles();
const authUsers = await listAuthUsers();
const authByEmail = new Map(authUsers.map(u => [String(u.email || '').toLowerCase(), u]));
const plannedEmails = new Set();

const report = {
  dryRun,
  supabaseUrl: SUPABASE_URL,
  emailDomain: EMAIL_DOMAIN,
  totalProfiles: profiles.length,
  skippedAlreadyLinked: [],
  linkedExistingAuthUser: [],
  createdAuthUser: [],
  generatedTemporaryPasswords: [],
  warnings: [],
};

for (const profile of profiles) {
  if (profile.auth_user_id) {
    report.skippedAlreadyLinked.push({
      username: profile.username,
      auth_user_id: profile.auth_user_id,
    });
    continue;
  }

  const email = emailFor(profile, plannedEmails);
  const existingAuthUser = authByEmail.get(email.toLowerCase());

  if (existingAuthUser) {
    if (!dryRun) {
      await linkProfile(profile.id, existingAuthUser.id);
    }
    report.linkedExistingAuthUser.push({
      username: profile.username,
      email,
      auth_user_id: dryRun ? '(would link existing)' : existingAuthUser.id,
    });
    continue;
  }

  const rawPassword = String(profile.password || '');
  const canReusePassword = USE_EXISTING_PASSWORDS && rawPassword.length >= MIN_PASSWORD_LENGTH;
  const password = canReusePassword ? rawPassword : randomPassword();
  const passwordSource = canReusePassword ? 'existing_pl_users_password' : 'generated_temporary_password';

  if (!canReusePassword) {
    report.generatedTemporaryPasswords.push({
      username: profile.username,
      email,
      temporaryPassword: password,
      reason: rawPassword ? `old password shorter than ${MIN_PASSWORD_LENGTH}` : 'missing old password',
    });
  }

  if (dryRun) {
    report.createdAuthUser.push({
      username: profile.username,
      email,
      auth_user_id: '(would create)',
      passwordSource,
    });
    continue;
  }

  try {
    const authUser = await createAuthUser({ email, password, profile });
    await linkProfile(profile.id, authUser.id);
    report.createdAuthUser.push({
      username: profile.username,
      email,
      auth_user_id: authUser.id,
      passwordSource,
    });
  } catch (err) {
    report.warnings.push({
      username: profile.username,
      email,
      error: err.message,
    });
  }
}

await mkdir(outDir, { recursive: true });
const outPath = join(outDir, `auth-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`${dryRun ? 'Dry run complete' : 'Migration complete'}.`);
console.log(`Profiles: ${report.totalProfiles}`);
console.log(`Already linked: ${report.skippedAlreadyLinked.length}`);
console.log(`Existing Auth users linked: ${report.linkedExistingAuthUser.length}`);
console.log(`Auth users ${dryRun ? 'planned' : 'created'}: ${report.createdAuthUser.length}`);
console.log(`Generated temporary passwords: ${report.generatedTemporaryPasswords.length}`);
console.log(`Warnings: ${report.warnings.length}`);
console.log(`Report written to: ${outPath}`);
console.log('Do not commit report files if they contain temporary passwords.');
