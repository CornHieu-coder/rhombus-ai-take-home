import { expect, type Page } from '@playwright/test';

// Authentication stays in memory. This request was observed in the real UI.
export async function openProject(page: Page, projectName = process.env.RHOMBUS_PROJECT_NAME!) {
  await page.addLocatorHandler(page.getByRole('dialog', { name: 'Ad Blocker Detected' }),
    async dialog => { await dialog.getByRole('button', { name: 'Continue Anyway' }).click(); });
  await page.goto('/');
  const project = page.getByRole('link', {
    name: projectName, exact: true,
  });
  await expect(project).toBeVisible({ timeout: 30_000 });
  const href = await project.getAttribute('href');
  const projectId = href?.match(/^\/workflow\/(\d+)$/)?.[1];
  if (!projectId) throw new Error('The selected project has no workflow ID.');
  const nodesPath = `/api/dataset/analyzer/v2/projects/${projectId}/nodes`;
  const pending = page.waitForResponse(response =>
    new URL(response.url()).pathname === nodesPath && response.request().method() === 'GET');
  await project.click();
  const response = await pending;
  expect(response.status()).toBe(200);
  const authorization = response.request().headers().authorization;
  if (!authorization) throw new Error('The authenticated backend request has no authorization header.');
  await expect(page.getByRole('tab', { name: 'Canvas', exact: true })).toBeVisible();
  return {
    projectId,
    apiBase: new URL(response.url()).origin,
    headers: { Authorization: authorization },
    nodes: await response.json(),
  };
}

// Backend runtime names and React Flow node IDs are different identifiers.
export function canvasNodeId(node: any): string {
  const id = node.metadata?.node?.id || node.name;
  if (!id) throw new Error('The pipeline node has no canvas identifier.');
  return String(id);
}

export async function openSchedule(page: Page, projectId: string) {
  const path = `/api/dataset/analyzer/v2/projects/${projectId}/pipeline/schedules`;
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === path);
  await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  const schedules = await response.json();
  const schedule = schedules.find((item: { enabled: boolean }) => item.enabled);
  if (!schedule) throw new Error('No enabled schedule exists in this test project.');
  await expect(page.getByRole('button', { name: 'Add Schedule' })).toBeVisible();
  return schedule;
}
