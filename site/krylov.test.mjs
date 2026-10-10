import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFixture, normalizedShift, compileBank, evaluateCompiled, evaluateDirect, perturbFeatures, runExperiment } from './krylov.js';

function fixture() {
  return validateFixture({ schema_version: 1, name: 'Three-node chain', nodes: [{ id: 0, label: 'A' }, { id: 1, label: 'B' }, { id: 2, label: 'C' }],
    edges: [[0, 1], [1, 2]], features: [[1, 0], [0, 1], [2, -1]], labels: [0, 1, 0], default_degree: 2,
    model: { theta: Array.from({ length: 5 }, (_, k) => [[0.2 + k * 0.03, -0.1], [0.4, 0.3 - k * 0.02]]), bias: [0.1, -0.03],
      activation_coefficients: [0.1, 0.7, 0.2], output_weights: [[0.6, -0.4], [-0.2, 0.3]], output_bias: [0.01, 0.02] } });
}

function close(actual, expected, tolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  actual.forEach((row, i) => row.forEach((value, j) => assert.ok(Math.abs(value - expected[i][j]) < tolerance, `${i},${j}: ${value} vs ${expected[i][j]}`)));
}

test('normalization adds self loops, deduplicates edges, and preserves isolated nodes', () => {
  close(normalizedShift(3, [[0, 1], [1, 0], [0, 1]]), [[0.5, 0.5, 0], [0.5, 0.5, 0], [0, 0, 1]]);
  const shift = normalizedShift(3, [[0, 1], [1, 2]]);
  assert.ok(Math.abs(shift[0][1] - 1 / Math.sqrt(6)) < 1e-15);
  close(shift, shift[0].map((_, i) => shift.map((row) => row[i])));
});

test('degree-zero bank is an independent copy and degree-two follows Chebyshev recurrence', () => {
  const data = fixture();
  const bank = compileBank(data, 2);
  close(bank[0], data.features);
  assert.notEqual(bank[0], data.features);
  assert.notEqual(bank[0][0], data.features[0]);
  const shift = normalizedShift(data.nodes.length, data.edges);
  const manual = data.features.map((row, i) => row.map((value, f) => {
    let shiftedTwice = 0;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) shiftedTwice += shift[i][a] * shift[a][b] * data.features[b][f];
    return 2 * shiftedTwice - value;
  }));
  close(bank[2], manual);
});

test('compiled feature recurrence agrees with independent dense-matrix oracle at every degree', () => {
  const data = fixture();
  const original = JSON.stringify(data);
  for (let degree = 0; degree <= 4; degree++) {
    const features = perturbFeatures(data.features, 0.17);
    const compiled = evaluateCompiled(data, compileBank(data, degree, features), degree);
    const direct = evaluateDirect(data, degree, features);
    close(compiled.preactivation, direct.preactivation);
    close(compiled.logits, direct.logits);
    assert.deepEqual(compiled.predictions, direct.predictions);
  }
  assert.equal(JSON.stringify(data), original);
});

test('affine and polynomial readout has an independently calculable scalar result', () => {
  const data = validateFixture({ schema_version: 1, nodes: [{ id: 0, label: 'Only node' }], edges: [], features: [[2]], labels: [0], default_degree: 0,
    model: { theta: [[[3]]], bias: [1], activation_coefficients: [0, 0, 1], output_weights: [[2, -1]], output_bias: [0.5, 3] } });
  const result = evaluateCompiled(data, compileBank(data, 0));
  close(result.preactivation, [[7]]);
  close(result.activation, [[49]]);
  close(result.logits, [[98.5, -46]]);
  assert.deepEqual(result.predictions, [0]);
});

test('perturbations are deterministic, bounded and leave the input unchanged', () => {
  const input = [[1, 2], [-3, 4]];
  assert.deepEqual(perturbFeatures(input, 0), input);
  const perturbed = perturbFeatures(input, 0.2);
  assert.deepEqual(perturbed, perturbFeatures(input, 0.2));
  perturbed.forEach((row, i) => row.forEach((value, j) => assert.ok(Math.abs(value - input[i][j]) <= 0.2)));
  assert.deepEqual(input, [[1, 2], [-3, 4]]);
});

test('fixture validation rejects malformed, oversized and nonfinite inputs', () => {
  const data = fixture();
  assert.throws(() => validateFixture({ ...data, schema_version: 99 }), /schema_version/);
  assert.throws(() => validateFixture({ ...data, features: [[NaN], [0], [1]] }), /finite/);
  assert.throws(() => validateFixture({ ...data, edges: [[0, 3]] }), /valid node/);
  assert.throws(() => validateFixture({ ...data, nodes: [...data.nodes, ...data.nodes] }), /consecutive/);
  assert.throws(() => validateFixture({ ...data, features: [[1], [2, 3], [4]] }), /entries/);
  assert.throws(() => validateFixture({ ...data, nodes: Array(121).fill({ id: 'a', label: 'A' }) }), /120/);
  assert.throws(() => validateFixture({ ...data, labels: [0, 9, 0] }), /class index/);
  assert.throws(() => validateFixture({ ...data, default_degree: 5 }), /theta prefix/);
  assert.throws(() => compileBank(data, 5), /degree/);
});

test('experiment diagnostics identify plaintext mode and count the bank accurately', () => {
  const result = runExperiment(fixture(), 3, 0.2);
  assert.equal(result.encrypted, false);
  assert.equal(result.mode, 'Local plaintext demonstration');
  assert.equal(result.bank_scalar_count, 4 * 3 * 2);
  assert.equal(result.diagnostics.prediction_agreement, 1);
  assert.ok(result.diagnostics.max_absolute_logit_error < 1e-12);
  for (const value of Object.values(result.timing_ms)) assert.ok(value >= 0);
});
