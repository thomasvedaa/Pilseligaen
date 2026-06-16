#!/usr/bin/env node

/*
  Reset password for a Pilseligaen Supabase Auth user.

  PowerShell usage:
    $env:SUPABASE_SERVICE_ROLE_KEY="..."
    node scripts/reset-auth-password.mjs --username "brukernavn" --password "Midlertidig123!"

  If --password is omitted, the script generates a temporary password and prints it.

  Optional:
    $env:SUPABASE_URL="https://hmgvocclrpfypmflbyop.supabase.co"
    node scripts/reset-auth-password.mjs --auth-user-id "uuid-here"
*/

import { randomBytes } from 'node:crypto';

const DEFAULT_SUPABASE_URL = 'https://hmgvocclrpfypmflbyop.supabase.co';
const SUPABASE_URL = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const args = process.argv.slice(2);

function usage() {
  console.log([
    'Reset Supabase Auth password for a Pilseligaen user.',
    '',
    'Usage:',
    '  node scripts/reset-auth-password.mjs --username "brukernavn" --password "Midlertidig123!"',
    '  node scripts/reset-auth-password.mjs --username "brukernavn"',
    '  node scripts/reset-auth-password.mjs --auth-user-id "uuid-here" --password "Midlertidig123!"',
    '',
    'Required environment variable:',
    '  SUPABASE_SERVICE_ROLE_KEY',
  ].join('\n'));
}

function die(message) {
  console.error(message);
  process.exit(1);
}

function argValue(name) {
  const prefix = `--${name}=`;
  const withEquals = args.find(arg => arg.startsWith(prefix));
  if (withEquals) return withEquals.slice(prefix.length);

  const index = args.indexOf(`--${name}`);
  if (index === -1) return '';
  const value = args[index + 1];
  if (!value || value.startsWith('--')) die(`Missing value for --${name}.`);
  return value;
}

function temporaryPassword() {
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
    throw new Error(message || `HTTP ${res.status}`);
  }

  return body;
}

async function getProfiles() {
  const select = 'id,username,username_lc,auth_user_id';
  const url = `${SUPABASE_URL}/rest/v1/pl_users?select=${encodeURIComponent(select)}&order=username_lc.asc`;
  return requestJson(url);
}

async function findAuthUserId(username) {
  const needle = String(username || '').trim().toLowerCase();
  if (!needle) die('Missing username.');

  const profiles = await getProfiles();
  const matches = profiles.filter(profile => {
    const usernameLc = String(profile.username_lc || '').trim().toLowerCase();
    const usernameRaw = String(profile.username || '').trim().toLowerCase();
    return usernameLc === needle || usernameRaw === needle;
  });

  if (!matches.length) {
    die(`Could not find a public.pl_users profile for "${username}".`);
  }
  if (matches.length > 1) {
    die(`Found multiple profiles matching "${username}". Use --auth-user-id instead.`);
  }
  if (!matches[0].auth_user_id) {
    die(`Profile "${matches[0].username}" has no auth_user_id.`);
  }

  return {
    authUserId: matches[0].auth_user_id,
    username: matches[0].username,
  };
}

async function updatePassword(authUserId, password) {
  return requestJson(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
}

if (args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

if (!SERVICE_KEY) {
  die([
    'Missing SUPABASE_SERVICE_ROLE_KEY.',
    'Find it in Supabase Dashboard -> Project Settings -> API -> service_role key.',
    'Set it in PowerShell before running this script:',
    '$env:SUPABASE_SERVICE_ROLE_KEY="..."',
  ].join('\n'));
}

const usernameArg = argValue('username');
const authUserIdArg = argValue('auth-user-id');
const passwordArg = argValue('password');

if (!usernameArg && !authUserIdArg) {
  usage();
  die('\nProvide either --username or --auth-user-id.');
}

const generatedPassword = !passwordArg;
const password = passwordArg || temporaryPassword();
if (password.length < 6) die('Password must be at least 6 characters.');

const userInfo = authUserIdArg
  ? { authUserId: authUserIdArg, username: '(auth user id provided)' }
  : await findAuthUserId(usernameArg);

const result = await updatePassword(userInfo.authUserId, password);
const email = result?.email ? ` (${result.email})` : '';

console.log('Password updated.');
console.log(`User: ${userInfo.username}${email}`);
console.log(`Auth user id: ${userInfo.authUserId}`);
if (generatedPassword) {
  console.log(`Temporary password: ${password}`);
}
