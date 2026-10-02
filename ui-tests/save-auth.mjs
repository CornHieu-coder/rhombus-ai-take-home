import { chromium } from '@playwright/test';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const destination = process.env.RHOMBUS_STORAGE_STATE || 'auth/rhombus.json';
const baseURL = process.env.RHOMBUS_BASE_URL || 'https://rhombusai.com';
const appHost = new URL(baseURL).hostname.replace(/^www\./, '');
const belongsToApp = (host) => {
  const normalized = host.replace(/^\./, '');
  return normalized === appHost || normalized.endsWith(`.${appHost}`);
};
const attach = process.argv.includes('--cdp');
const browser = attach
  ? await chromium.connectOverCDP(process.env.RHOMBUS_CDP_URL || 'http://127.0.0.1:9333')
  : await chromium.launch({ headless: false });

try {
  const context = attach ? browser.contexts()[0] : await browser.newContext();
  if (!context) throw new Error('The Chrome test profile has no browser context.');
  let page;
  if (attach) {
    page = context.pages().find((candidate) => {
      try { return belongsToApp(new URL(candidate.url()).hostname); }
      catch { return false; }
    });
    if (!page) throw new Error('Sign in to Rhombus in the normal Chrome test window before attaching.');
  } else {
    page = await context.newPage();
    await page.goto(baseURL);
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      await prompt.question('Sign in using the browser window, then press Enter here to save the local session. For Google SSO rejection, use the normal-Chrome --cdp flow in README.md. ');
    } finally {
      prompt.close();
    }
  }

  const response = await page.request.get(new URL('/api/auth/session', baseURL).toString());
  if (!response.ok()) throw new Error(`Session check returned HTTP ${response.status()}.`);
  const session = await response.json();
  if (!session || typeof session !== 'object' || !session.user) {
    throw new Error('Rhombus is not signed in; no session file was saved.');
  }

  const state = await context.storageState({ indexedDB: true });
  // Export only the application's state, excluding Google and other sites.
  const applicationState = {
    cookies: state.cookies.filter((cookie) => belongsToApp(cookie.domain)),
    origins: state.origins.filter((origin) => belongsToApp(new URL(origin.origin).hostname)),
  };
  if (!applicationState.cookies.length && !applicationState.origins.length) {
    throw new Error('No Rhombus browser state was found; no session file was saved.');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(applicationState, null, 2));
  console.log(`Verified sign-in and saved Rhombus-only state to ${destination}. This file is gitignored.`);
} finally {
  await browser.close();
}
