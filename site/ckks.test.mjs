import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runEncrypted } from './ckks.js';
import { evaluateDirect, perturbFeatures, validateFixture } from './krylov.js';

const fixture = validateFixture(JSON.parse(await readFile(
  new URL('./data/demo.json', import.meta.url), 'utf8',
)));

test('real CKKS matches an independent dense oracle at degree 0, 2 and 4', async () => {
  for (const degree of [0, 2, 4]) {
    const features = perturbFeatures(fixture.features, 0.07, 31);
    const expected = evaluateDirect(fixture, degree, features);
    const result = await runEncrypted(fixture, { degree, features });
    const maxError = Math.max(...result.logits.flatMap((row, n) => (
      row.map((value, c) => Math.abs(value - expected.logits[n][c]))
    )));
    assert.ok(maxError < 1e-4, `degree ${degree}: logit error ${maxError}`);
    assert.deepEqual(result.predictions, expected.predictions);
    assert.equal(result.params.encryptedBankColumns, (degree + 1) * features[0].length);
    assert.ok(result.inputCiphertextBytes > 0);
    assert.ok(result.outputCiphertextBytes > 0);
    assert.equal(result.publicContextHasSecretKey, false);
    assert.equal(result.params.rotations, 0);
  }
});

test('zero-weight circuits use real public-key zero encryption and preserve biases', async () => {
  const zero = structuredClone(fixture);
  zero.model.theta = zero.model.theta.map((weights) => weights.map((row) => row.map(() => 0)));
  zero.model.output_weights = zero.model.output_weights.map((row) => row.map(() => 0));
  zero.model.output_bias = [0.25, -0.5];
  const result = await runEncrypted(zero);
  for (const row of result.logits) {
    assert.ok(Math.abs(row[0] - 0.25) < 1e-5);
    assert.ok(Math.abs(row[1] + 0.5) < 1e-5);
  }
});

test('unsupported circuits are rejected before any encrypted evaluation', async () => {
  const incompatible = structuredClone(fixture);
  incompatible.model.activation_coefficients = [0, 1];
  await assert.rejects(runEncrypted(incompatible), /square activation/);
  await assert.rejects(runEncrypted(fixture, { degree: 5 }), /degrees from 0 to 4/);
  const huge = structuredClone(fixture.features);
  huge[0][0] = 9;
  await assert.rejects(runEncrypted(fixture, { features: huge }), /bounded by 8/);
});
