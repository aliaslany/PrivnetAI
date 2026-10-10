import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const demo = JSON.parse(await readFile(new URL('../../site/data/demo.json', import.meta.url), 'utf8'));

async function openLab(page) {
  await page.goto('./');
  await expect(page.locator('#run-status')).toContainText('Complete');
  await expect(page.locator('#page-error')).toBeHidden();
}

async function downloadResult(page) {
  const waiting = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await waiting;
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}

test('project-path assets load and controls change an inspectable graph computation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openLab(page);
  await expect(page.locator('#graph .graph-node')).toHaveCount(24);
  await expect(page.locator('#agreement')).toHaveText('100.0%');
  await expect(page.locator('#bank-count')).toHaveText('216');
  await page.locator('#graph .graph-node').nth(6).click();
  await expect(page.locator('#node-id')).toHaveText('NODE 6');
  await page.getByRole('button', { name: 'Reference labels', exact: true }).click();
  await expect(page.locator('#show-labels')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#degree').focus();
  await page.locator('#degree').press('End');
  await page.getByRole('button', { name: 'Run experiment' }).click();
  await expect(page.locator('#run-status')).toContainText('K = 4');
  await expect(page.locator('#bank-count')).toHaveText('360');
  await page.getByRole('button', { name: 'Reset controls' }).click();
  await expect(page.locator('#run-status')).toContainText('K = 2');
  await expect(page.locator('#bank-count')).toHaveText('216');
  expect(errors).toEqual([]);
});

test('invalid uploads preserve the current graph; valid data stays local and renders as text', async ({ page }) => {
  await openLab(page);
  const writes = [];
  page.on('request', (request) => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.locator('#upload').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await expect(page.locator('#graph .graph-node')).toHaveCount(24);
  const custom = structuredClone(demo);
  custom.name = 'Local graph <img src=x onerror=alert(1)>';
  custom.nodes[0].label = '<script>window.fixtureInjected = true</script>';
  custom.model.theta = custom.model.theta.slice(0, 1);
  custom.default_degree = 0;
  await page.locator('#upload').setInputFiles({ name: 'custom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(custom)) });
  await expect(page.locator('#fixture-kind')).toHaveText('LOCAL JSON');
  await expect(page.locator('#run-status')).toContainText('K = 0');
  await expect(page.locator('#bank-count')).toHaveText('72');
  await expect(page.locator('#fixture-name')).toHaveText(custom.name);
  await expect(page.locator('#fixture-name img')).toHaveCount(0);
  expect(await page.evaluate(() => window.fixtureInjected)).toBeUndefined();
  await expect(page.locator('#run-ckks')).toBeDisabled();
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Return to bundled example' }).click();
  await expect(page.locator('#run-status')).toContainText('K = 2');
  await expect(page.locator('#run-ckks')).toBeEnabled();
});

test('export identifies plaintext execution and reproduces the selected controls', async ({ page }) => {
  await openLab(page);
  await page.locator('#perturbation').focus();
  await page.locator('#perturbation').press('ArrowRight');
  await page.getByRole('button', { name: 'Run experiment' }).click();
  await expect(page.locator('#run-status')).toContainText('±0.01');
  const result = await downloadResult(page);
  expect(result.degree).toBe(2);
  expect(result.perturbation).toBe(0.01);
  expect(result.diagnostics.prediction_agreement).toBe(1);
  expect(result.diagnostics.max_absolute_logit_error).toBeLessThan(1e-10);
  expect(result.optional_ckks).toBeNull();
  expect(JSON.stringify(result)).toContain('plaintext');
});

test('real browser CKKS runs with a secret-free evaluator and current model controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openLab(page);
  await page.locator('#degree').focus();
  await page.locator('#degree').press('End');
  // Deliberately skip the plaintext Run button: encrypted execution must sync it.
  await page.getByRole('button', { name: 'Run real CKKS' }).click();
  await expect(page.locator('#ckks-status')).toContainText('Complete', { timeout: 60_000 });
  await expect(page.locator('#ckks-results')).toBeVisible();
  await expect(page.locator('#ckks-diagnostics')).toContainText('Absent from context');
  const result = await downloadResult(page);
  expect(result.degree).toBe(4);
  expect(result.optional_ckks.degree).toBe(4);
  expect(result.optional_ckks.publicContextHasSecretKey).toBe(false);
  expect(result.optional_ckks.predictionAgreement).toBe(1);
  expect(result.optional_ckks.maxAbsoluteError).toBeLessThan(1e-3);
  expect(result.optional_ckks.ciphertextBytes).toBeGreaterThan(1000);
  expect(result.optional_ckks.timings.encryptionMs).toBeGreaterThan(0);
  expect(result.optional_ckks.timings.evaluationMs).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.locator('#degree').focus();
  await page.locator('#degree').press('Home');
  await expect(page.locator('#ckks-results')).toBeHidden();
  const afterChange = await downloadResult(page);
  expect(afterChange.optional_ckks).toBeNull();
});

test('mobile layout remains usable without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Run experiment' }).click();
  await expect(page.locator('#run-status')).toContainText('Complete');
});
