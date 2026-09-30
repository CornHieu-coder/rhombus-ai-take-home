import { chromium } from '@playwright/test';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const destination = process.env.RHOMBUS_STORAGE_STATE || 'auth/rhombus.json';
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(process.env.RHOMBUS_BASE_URL || 'https://rhombusai.com');
const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
await prompt.question('Sign in using the browser window, then press Enter here to save the local session. ');
await prompt.close();
fs.mkdirSync(path.dirname(destination), { recursive: true });
await context.storageState({ path: destination });
console.log(`Saved local session to ${destination}. This file is gitignored.`);
await browser.close();
