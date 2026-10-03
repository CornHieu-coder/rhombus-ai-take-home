import { chromium, expect, type Browser, type Page, type Request, type Response } from '@playwright/test';

export interface CloudObserverOptions {
  cdpUrl: string;
  s3Bucket: string;
  s3Region: string;
  s3Key: string;
  gcsBucket: string;
}

export interface CloudObject {
  name: string;
  /** GCS timeCreated (ISO 8601), when present in the listing response. */
  createdAt?: string;
}

const timeout = 45_000;
const objectDetails = /^Object details page for .+\.$/;

async function bounded<T>(work: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeout);
    })]);
  } finally { clearTimeout(timer!); }
}

function validateOptions(options: CloudObserverOptions): void {
  let endpoint: URL;
  try { endpoint = new URL(options.cdpUrl); }
  catch { throw new Error('Cloud observation requires a loopback CDP URL on port 9333.'); }
  if (!['http:', 'ws:'].includes(endpoint.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
      endpoint.port !== '9333' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Cloud observation requires a loopback CDP URL on port 9333 without credentials.');
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(options.s3Bucket) ||
      !/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(options.gcsBucket) ||
      !/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(options.s3Region) ||
      !options.s3Key || /[\x00-\x1f\x7f]/.test(options.s3Key) || options.s3Key.endsWith('/')) {
    throw new Error('Cloud observation requires valid bucket names, an S3 region, and an existing source object key.');
  }
}

function pageUrl(page: Page): URL | undefined {
  try { return new URL(page.url()); } catch { return undefined; }
}

function existingBucketPage(pages: Page[], provider: 'S3' | 'GCS', bucket: string): Page {
  const candidates = pages.filter((page) => {
    const url = pageUrl(page);
    return url && (provider === 'S3'
      ? /^(?:[a-z0-9-]+\.)?console\.aws\.amazon\.com$/.test(url.hostname) && /^\/s3\/buckets\/[^/]+/.test(url.pathname)
      : url.hostname === 'console.cloud.google.com' && /^\/storage\/browser\/(?!_details\/)[^/]+/.test(url.pathname));
  });
  const exact = candidates.find((page) => {
    const path = pageUrl(page)!.pathname;
    return decodeURIComponent(path.split('/')[3]).split(';')[0] === bucket;
  });
  if (exact) return exact;
  if (candidates.length === 1) return candidates[0];
  throw new Error(`Open the authenticated ${provider} bucket tab in the dedicated Chrome on port 9333 before running the journey.`);
}

/** Read-only cloud verification through the user's existing authenticated Chrome. */
export class CloudObserver {
  private closed = false;

  private constructor(
    private readonly browser: Browser,
    private readonly s3: Page,
    private readonly gcs: Page,
    private readonly options: CloudObserverOptions,
  ) {}

  static async connect(options: CloudObserverOptions): Promise<CloudObserver> {
    validateOptions(options);
    let browser: Browser;
    try { browser = await chromium.connectOverCDP(options.cdpUrl, { timeout, noDefaults: true }); }
    catch { throw new Error('Could not attach to the dedicated Chrome on loopback port 9333. Open its authenticated S3 and GCS bucket tabs first.'); }
    try {
      const pages = browser.contexts().flatMap((context) => context.pages());
      const observer = new CloudObserver(browser,
        existingBucketPage(pages, 'S3', options.s3Bucket),
        existingBucketPage(pages, 'GCS', options.gcsBucket), { ...options });
      const prefix = options.s3Key.slice(0, options.s3Key.lastIndexOf('/') + 1);
      const s3Url = new URL(`https://${options.s3Region}.console.aws.amazon.com/s3/buckets/${encodeURIComponent(options.s3Bucket)}`);
      s3Url.searchParams.set('region', options.s3Region);
      if (prefix) s3Url.searchParams.set('prefix', prefix);
      await observer.s3.goto(s3Url.toString(), { waitUntil: 'domcontentloaded', timeout });
      await observer.gcs.goto(`https://console.cloud.google.com/storage/browser/${encodeURIComponent(options.gcsBucket)}`, {
        waitUntil: 'domcontentloaded', timeout,
      });
      await expect(observer.s3.getByRole('checkbox', { name: `Select ${options.s3Key.split('/').at(-1)}`, exact: true })).toBeVisible({ timeout });
      await expect(observer.gcs.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible({ timeout });
      return observer;
    } catch {
      await browser.close();
      throw new Error('Cloud prerequisites were not ready: the existing S3 source and GCS bucket tabs must be authenticated and accessible.');
    }
  }

  private assertConnected(): void {
    if (this.closed || !this.browser.isConnected()) throw new Error('Cloud observer is disconnected.');
  }

  async downloadSource(): Promise<Buffer> {
    this.assertConnected();
    const checkbox = this.s3.getByRole('checkbox', { name: `Select ${this.options.s3Key.split('/').at(-1)}`, exact: true });
    try {
      await checkbox.check({ timeout });
      const pending = this.s3.waitForEvent('download', { timeout });
      void pending.catch(() => {});
      await this.s3.getByRole('button', { name: 'Download', exact: true }).click({ timeout });
      const download = await pending;
      const url = new URL(download.url());
      const { s3Bucket: bucket, s3Region: region, s3Key: key } = this.options;
      const virtualHosts = [`${bucket}.s3.${region}.amazonaws.com`, `${bucket}.s3-${region}.amazonaws.com`, `${bucket}.s3.amazonaws.com`];
      const pathHosts = [`s3.${region}.amazonaws.com`, `s3-${region}.amazonaws.com`, 's3.amazonaws.com'];
      const path = decodeURIComponent(url.pathname);
      if (url.protocol !== 'https:' || url.username || url.password ||
          !(virtualHosts.includes(url.hostname) && path === `/${key}` || pathHosts.includes(url.hostname) && path === `/${bucket}/${key}`)) {
        throw new Error('The S3 download did not identify the configured source object.');
      }
      return await this.download(this.s3, url.toString(), 'S3 source');
    } catch {
      throw new Error('S3 source download failed; no source bytes were verified.');
    } finally {
      // Selection is transient UI state; no upload or overwrite controls are used.
      await checkbox.uncheck({ timeout });
    }
  }

  private isGcsListing(request: Request): boolean {
    if (request.method() !== 'GET') return false;
    let url: URL;
    try { url = new URL(request.url()); } catch { return false; }
    if (url.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)*(?:googleapis\.com|clients6\.google\.com)$/.test(url.hostname)) return false;
    const match = decodeURIComponent(url.pathname).match(/\/(?:storage\/)?v1\/b\/([^/]+)\/o\/?$/);
    return match?.[1] === this.options.gcsBucket;
  }

  private async refreshListing(): Promise<Response> {
    const page = this.gcs;
    const requests = new Set<Request>();
    let resolve!: (response: Response) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
    // A click failure can precede the response timeout; keep that rejection handled.
    void pending.catch(() => {});
    const onRequest = (request: Request) => { if (this.isGcsListing(request)) requests.add(request); };
    const onResponse = (response: Response) => { if (requests.has(response.request())) resolve(response); };
    const onFailure = (request: Request) => {
      if (requests.has(request)) reject(new Error('GCS listing transport failed; no fresh listing was verified.'));
    };
    const timer = setTimeout(() => reject(new Error('GCS Refresh did not produce a fresh object listing within 45 seconds.')), timeout);
    page.on('request', onRequest);
    page.on('response', onResponse);
    page.on('requestfailed', onFailure);
    try {
      try { await page.getByRole('button', { name: 'Refresh', exact: true }).click({ timeout }); }
      catch { throw new Error('The GCS Refresh control was not available.'); }
      const response = await pending;
      if (response.status() !== 200) throw new Error(`GCS object listing returned HTTP ${response.status()}; this is not an empty bucket result.`);
      if (await bounded(response.finished(), 'GCS listing transport timed out while receiving the response.')) {
        throw new Error('GCS listing transport failed while receiving the response.');
      }
      return response;
    } finally {
      clearTimeout(timer);
      page.off('request', onRequest);
      page.off('response', onResponse);
      page.off('requestfailed', onFailure);
    }
  }

  async listOutputs(): Promise<CloudObject[]> {
    this.assertConnected();
    await expect(this.gcs.getByRole('grid').first()).toBeVisible({ timeout });
    await expect(this.gcs.getByRole('row', { name: 'Loading contents', exact: true })).toHaveCount(0, { timeout });
    const response = await this.refreshListing();
    let listing: { items?: Array<{ name: string; bucket?: string; timeCreated?: string }>; nextPageToken?: string; error?: unknown };
    try { listing = await bounded(response.json(), 'GCS listing transport timed out while receiving JSON.'); }
    catch { throw new Error('GCS object listing did not return JSON; no fresh listing was verified.'); }
    if (!listing || typeof listing !== 'object' || Array.isArray(listing) || listing.error ||
        listing.items !== undefined && !Array.isArray(listing.items)) {
      throw new Error('GCS object listing returned an unexpected response; no fresh listing was verified.');
    }
    if (listing.nextPageToken) throw new Error('The GCS bucket listing is paginated; a complete output comparison cannot be verified from this page.');
    const items = listing.items ?? [];
    if (items.some((item) => !item || typeof item.name !== 'string' || !item.name || item.bucket && item.bucket !== this.options.gcsBucket)) {
      throw new Error('GCS listing object metadata did not identify the configured bucket.');
    }
    const names = items.map((item) => item.name).sort();
    await expect(this.gcs.getByRole('row', { name: 'Loading contents', exact: true })).toHaveCount(0, { timeout });
    // The response must be reflected in the rendered table, including an empty bucket.
    await expect.poll(async () => (await this.gcs.getByRole('link', { name: objectDetails }).allTextContents()).map((name) => name.trim()).sort(), { timeout }).toEqual(names);
    return items.map((item) => ({
      name: item.name,
      ...(typeof item.timeCreated === 'string' && Number.isFinite(Date.parse(item.timeCreated)) ? { createdAt: item.timeCreated } : {}),
    }));
  }

  async downloadOutput(name: string): Promise<Buffer> {
    this.assertConnected();
    if (!name || /[\x00-\x1f\x7f]/.test(name)) throw new Error('An observed GCS output object name is required.');
    if (!(await this.listOutputs()).some((item) => item.name === name)) throw new Error('The requested GCS output was not present in a fresh listing.');
    const link = this.gcs.getByRole('link', { name: `Download ${name}`, exact: true });
    await expect(link).toBeVisible({ timeout });
    const href = await link.getAttribute('href');
    let url: URL;
    try { url = new URL(href ?? '', this.gcs.url()); }
    catch { throw new Error('GCS output download link was not valid.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'storage.cloud.google.com' || url.username || url.password ||
        decodeURIComponent(url.pathname) !== `/${this.options.gcsBucket}/${name}`) {
      throw new Error('The GCS download link did not identify the requested output object.');
    }
    return this.download(this.gcs, url.toString(), 'GCS output');
  }

  private async download(page: Page, url: string, label: string): Promise<Buffer> {
    try {
      const response = await page.context().request.get(url, { timeout });
      try {
        if (response.status() !== 200) throw new Error(`${label} download returned HTTP ${response.status()}.`);
        if (/text\/html/i.test(response.headers()['content-type'] ?? '')) throw new Error(`${label} download returned a sign-in page.`);
        return await response.body();
      } finally { await response.dispose(); }
    } catch {
      // Playwright transport errors can contain signed URLs, so never propagate them.
      throw new Error(`${label} download failed; no object bytes were verified.`);
    }
  }

  async captureOutputs(path: string): Promise<void> {
    await this.listOutputs();
    await this.gcs.screenshot({ path, fullPage: true, animations: 'disabled', mask: [
      this.gcs.getByRole('banner'),
      this.gcs.getByText(this.options.gcsBucket, { exact: false }),
      this.gcs.getByText(this.options.s3Bucket, { exact: false }),
      this.gcs.getByText(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i),
      this.gcs.locator('[aria-label*="@"], [title*="@"], img[alt*="@"]'),
    ] });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    // For connectOverCDP, Playwright closes the CDP transport, not Chrome.
    // Do not close any Page or BrowserContext owned by the user's profile.
    await this.browser.close();
  }
}
