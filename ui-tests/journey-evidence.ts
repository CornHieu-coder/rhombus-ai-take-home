import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const REDACTED = '[REDACTED]';

function buckets() {
  return [process.env.RHOMBUS_S3_BUCKET, process.env.RHOMBUS_GCS_BUCKET]
    .filter((value): value is string => Boolean(value));
}

function redactText(value: string): string {
  let redacted = value.replace(/https?:\/\/[^\s<>"'`]+/gi, raw => {
    try {
      const url = new URL(raw);
      if (url.search || url.hash || url.username || url.password) {
        return `${url.origin}${url.pathname} [URL credentials/query redacted]`;
      }
    } catch { /* Leave malformed text to the remaining redaction rules. */ }
    return raw;
  }).replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, REDACTED)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/=\-]+/gi, `Bearer ${REDACTED}`)
    .replace(EMAIL, '[EMAIL REDACTED]');
  for (const bucket of buckets()) redacted = redacted.split(bucket).join('[BUCKET REDACTED]');
  return redacted;
}

function sensitiveKey(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return /authorization|cookie|token|secret|privatekey|serviceaccount|credential/.test(normalized)
    || /headers?$|params?$|parameters?$|requestbody$|requestpayload$/.test(normalized);
}

function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactText(value);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return redactText(value.message).slice(0, 2000);
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map(item => sanitize(item, seen))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [
      redactText(key), sensitiveKey(key) ? REDACTED : sanitize(item, seen),
    ]));
  seen.delete(value);
  return result;
}

export class JourneyEvidence {
  public readonly directory: string;
  public manifest: Record<string, any>;

  constructor(testInfo: TestInfo, runId: string) {
    this.directory = path.resolve(process.env.RHOMBUS_JOURNEY_EVIDENCE_DIR || testInfo.outputPath('journey'));
    if (/(?:^|[\\/])(?:auth|secrets)(?:[\\/]|$)/i.test(this.directory)) {
      throw new Error('Journey evidence must not be written under auth or secrets directories.');
    }
    fs.mkdirSync(this.directory, { recursive: true });
    this.manifest = {
      version: 1,
      run_id: runId,
      started_at: new Date().toISOString(),
      command: 'RHOMBUS_RUN_PROVISIONING_JOURNEY=1 npm run test:journey -- --workers=1',
      outcome: 'incomplete',
      journey_configuration_verified: false,
      automatic_baseline_verified: false,
      steps: [],
    };
  }

  private filename(name: string) {
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name) || name.includes('..')) {
      throw new Error('Evidence filenames must be safe basenames without path separators or parent traversal.');
    }
    return path.join(this.directory, name);
  }

  writeJson(name: string, data: unknown): void {
    fs.writeFileSync(this.filename(name), `${JSON.stringify(sanitize(data), null, 2)}\n`, 'utf8');
  }

  writeBytes(name: string, bytes: Uint8Array): void {
    fs.writeFileSync(this.filename(name), bytes);
  }

  writeText(name: string, text: string): void {
    fs.writeFileSync(this.filename(name), redactText(text), 'utf8');
  }

  checkpoint(): void {
    this.writeJson('manifest.json', this.manifest);
  }

  async step<T>(name: string, callback: () => Promise<T>): Promise<T> {
    const started = Date.now();
    const record: Record<string, unknown> = {
      name: redactText(name), started_at: new Date(started).toISOString(), state: 'running',
    };
    this.manifest.steps.push(record);
    this.checkpoint();
    try {
      const result = await callback();
      record.state = 'passed';
      return result;
    } catch (error) {
      record.state = 'failed';
      record.error = redactText(error instanceof Error ? error.message : String(error)).slice(0, 2000);
      throw error; // Playwright retains the original diagnostics in ignored local output.
    } finally {
      record.finished_at = new Date().toISOString();
      record.duration_ms = Date.now() - started;
      this.checkpoint();
    }
  }

  async screenshot(page: Page, name: string): Promise<void> {
    const screenshotPath = this.filename(name);
    const mask = [page.getByText(new RegExp(EMAIL.source, 'i')),
      page.locator('textarea[name="service_account_json"]')];
    for (const bucket of buckets()) mask.push(page.getByText(bucket));
    await page.screenshot({ path: screenshotPath, fullPage: true, mask });
  }
}
