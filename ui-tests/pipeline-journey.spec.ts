import { expect, test } from '@playwright/test';
import fs from 'node:fs';

const required = [
  'RHOMBUS_STORAGE_STATE', 'RHOMBUS_PROJECT_NAME', 'RHOMBUS_S3_BUCKET',
  'RHOMBUS_S3_REGION', 'RHOMBUS_GCS_BUCKET',
  'RHOMBUS_GCS_SERVICE_ACCOUNT_JSON_PATH',
] as const;
const missing = required.filter((key) => !process.env[key]);

test('S3 to AI-built cleaning pipeline to GCS on a schedule', async ({ page }) => {
  test.skip(missing.length > 0, `Live integration needs: ${missing.join(', ')}`);
  test.setTimeout(80 * 60 * 1000); // An hourly schedule can take up to one hour to trigger.

  const project = process.env.RHOMBUS_PROJECT_NAME!;
  const bucket = process.env.RHOMBUS_S3_BUCKET!;
  const region = process.env.RHOMBUS_S3_REGION!;
  const sourceKey = `${process.env.RHOMBUS_S3_PREFIX || ''}baseline.csv`;
  const gcsBucket = process.env.RHOMBUS_GCS_BUCKET!;
  const key = fs.readFileSync(process.env.RHOMBUS_GCS_SERVICE_ACCOUNT_JSON_PATH!, 'utf8');

  await test.step('Open or create the dedicated test project', async () => {
    await page.goto('/');
    await expect(page.getByText(/please log in/i)).toHaveCount(0);
    await page.getByRole('button', { name: /projects/i }).click();
    const existing = page.getByText(project, { exact: true });
    if (await existing.count()) {
      await existing.click();
    } else {
      await page.getByRole('button', { name: /new project/i }).click();
      await page.getByRole('textbox', { name: /project name|name/i }).fill(project);
      await page.getByRole('button', { name: /^create$/i }).click();
    }
    await expect(page.getByText(project, { exact: true })).toBeVisible();
  });

  await test.step('Connect the S3 source and verify the dataset is visible', async () => {
    await page.getByRole('tab', { name: /^data$/i }).click();
    await page.getByRole('tab', { name: /sources/i }).click();
    if (!(await page.getByText(bucket, { exact: true }).count())) {
      await page.getByRole('button', { name: /add data sources|add source/i }).click();
      await page.getByText(/amazon s3/i).last().click();
      await page.getByRole('textbox', { name: /bucket name/i }).fill(bucket);
      await page.getByRole('combobox', { name: /region/i }).selectOption({ label: region });
      if (process.env.RHOMBUS_S3_PREFIX) {
        await page.getByText(/optional settings/i).click();
        await page.getByRole('textbox', { name: /folder|path/i }).fill(process.env.RHOMBUS_S3_PREFIX);
      }
      await page.getByRole('button', { name: /connect s3 source/i }).click();
    }
    await expect(page.getByText(bucket, { exact: true })).toBeVisible();
    await expect(page.getByText(/baseline\.csv/i)).toBeVisible();
  });

  await test.step('Ask the AI builder to create the cleaning transformations', async () => {
    await page.getByRole('tab', { name: /workflow|pipeline|canvas/i }).click();
    const composer = page.getByRole('textbox', { name: /message|chat|prompt/i }).last();
    await composer.fill('/');
    await page.getByText('Pipeline', { exact: true }).last().click();
    await composer.fill([
      `Build a pipeline using the connected S3 dataset ${bucket}/${sourceKey}.`,
      'Use AI-generated transformations only. Trim all text. Lowercase customer_email.',
      'Keep the first row for each order_id; reject rows with missing order_id or email,',
      'non-numeric or non-positive amount_usd, invalid MM/DD/YYYY order_date, or country',
      'outside US/usa/United States. Fill missing customer_name with Unknown.',
      'Normalize country to US, amount_usd to two decimals, order_date to YYYY-MM-DD.',
      'Produce exactly order_id,customer_email,customer_name,amount_usd,order_date,country',
      'in that order, and add a Data Output node for CSV export.',
    ].join(' '));
    await composer.press('Enter');
    await expect(page.getByText(/data input/i).last()).toBeVisible();
    await expect(page.getByText(/data output/i).last()).toBeVisible();
  });

  await test.step('Configure and verify the GCS destination', async () => {
    await page.getByText(/data output/i).last().click();
    await page.getByRole('button', { name: /select destination/i }).click();
    if (!(await page.getByText(gcsBucket, { exact: true }).count())) {
      await page.getByRole('button', { name: /add new destination/i }).click();
      await page.getByText(/google cloud storage/i).last().click();
      await page.getByRole('textbox', { name: /service account json/i }).fill(key);
      await page.getByRole('textbox', { name: /bucket name/i }).fill(gcsBucket);
      await page.getByRole('button', { name: /create destination/i }).click();
    }
    await page.getByText(gcsBucket, { exact: true }).last().click();
    await page.getByRole('combobox', { name: /export format/i }).selectOption({ label: 'CSV' });
    await page.getByRole('textbox', { name: /custom filename/i }).fill('rhombus-qa-output');
    await page.getByRole('button', { name: /^apply$/i }).click();
    await expect(page.getByText(gcsBucket, { exact: true })).toBeVisible();
  });

  await test.step('Schedule the pipeline and wait for a new successful scheduled run', async () => {
    await page.getByRole('tab', { name: /schedule/i }).click();
    const previousRuns = await page.getByRole('row').filter({ hasText: /success|failure/i }).count();
    if (!(await page.getByText(/hourly/i).count())) {
      await page.getByRole('button', { name: /add schedule/i }).click();
      await page.getByRole('radio', { name: /hourly/i }).check();
      await page.getByRole('spinbutton', { name: /minute/i }).fill(process.env.RHOMBUS_SCHEDULE_MINUTE || '15');
      await page.getByRole('button', { name: /^create$/i }).click();
    }
    await expect(page.getByText(/active/i).first()).toBeVisible();
    await expect.poll(async () => {
      await page.reload();
      await page.getByRole('tab', { name: /schedule/i }).click();
      return page.getByRole('row').filter({ hasText: /success|failure/i }).count();
    }, { timeout: 75 * 60 * 1000, intervals: [30_000] }).toBeGreaterThan(previousRuns);
    await expect(page.getByRole('row').filter({ hasText: /success/i }).first()).toBeVisible();
  });
});
