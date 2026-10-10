/**
 * Independent plaintext Chebyshev graph compilation, implemented for this demo.
 * No cryptographic operations occur here. S = D^-1/2 (A + I) D^-1/2.
 * Bank: B0 = X, B1 = SX, Bk = 2 S B(k-1) - B(k-2).
 */

const LIMITS = Object.freeze({ nodes: 120, features: 32, hidden: 32, classes: 16, degree: 4 });
export { LIMITS };

const zeros = (rows, columns) => Array.from({ length: rows }, () => Array(columns).fill(0));
const copyMatrix = (matrix) => matrix.map((row) => row.slice());
const now = () => globalThis.performance?.now?.() ?? Date.now();

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function finiteNumber(value, context) {
  requireCondition(typeof value === 'number' && Number.isFinite(value), `${context} must contain finite numbers.`);
  requireCondition(Math.abs(value) <= 1e6, `${context} exceeds the supported magnitude (1,000,000).`);
  return value;
}

function vector(value, size, context) {
  requireCondition(Array.isArray(value) && value.length === size, `${context} must have ${size} entries.`);
  return value.map((item) => finiteNumber(item, context));
}

function matrix(value, rows, columns, context) {
  requireCondition(Array.isArray(value) && value.length === rows, `${context} must have ${rows} rows.`);
  return value.map((row) => vector(row, columns, context));
}

/** Validate and copy a bounded fixture. Duplicate undirected edges are deduplicated. */
export function validateFixture(raw) {
  requireCondition(raw && typeof raw === 'object' && !Array.isArray(raw), 'The JSON must be an object.');
  requireCondition(raw.schema_version === 1, 'Only fixture schema_version 1 is supported.');
  requireCondition(Array.isArray(raw.nodes) && raw.nodes.length > 0 && raw.nodes.length <= LIMITS.nodes,
    `Provide between 1 and ${LIMITS.nodes} nodes.`);
  const nodeCount = raw.nodes.length;
  const nodes = raw.nodes.map((node, index) => {
    requireCondition(node && typeof node === 'object', `Node ${index} must be an object.`);
    requireCondition(node.id === index, `Node ids must be consecutive integers 0 through ${nodeCount - 1}, in array order.`);
    requireCondition(typeof node.label === 'string' && node.label.length <= 100,
      `Node ${index} needs a label of at most 100 characters.`);
    return { id: index, label: node.label };
  });
  requireCondition(Array.isArray(raw.edges) && raw.edges.length <= nodeCount * nodeCount,
    'edges must be an array of node-index pairs.');
  const seen = new Set();
  const edges = [];
  for (const edge of raw.edges) {
    requireCondition(Array.isArray(edge) && edge.length === 2 && edge.every((v) => Number.isInteger(v) && v >= 0 && v < nodeCount),
      'Each edge must contain two valid node indices.');
    requireCondition(edge[0] !== edge[1], 'Omit self loops: the compiler adds one self loop per node.');
    const pair = [Math.min(...edge), Math.max(...edge)];
    const key = pair.join(':');
    if (!seen.has(key)) { seen.add(key); edges.push(pair); }
  }
  requireCondition(Array.isArray(raw.features) && Array.isArray(raw.features[0]), 'features must be a rectangular numeric matrix.');
  const featureCount = raw.features[0].length;
  requireCondition(featureCount > 0 && featureCount <= LIMITS.features, `Use 1–${LIMITS.features} input features.`);
  const features = matrix(raw.features, nodeCount, featureCount, 'features');
  const model = raw.model;
  requireCondition(model && typeof model === 'object' && Array.isArray(model.theta) && model.theta.length > 0,
    'model.theta must contain at least the degree-zero weight matrix.');
  requireCondition(model.theta.length <= LIMITS.degree + 1, `The maximum supported degree is ${LIMITS.degree}.`);
  requireCondition(Array.isArray(model.bias) && model.bias.length > 0 && model.bias.length <= LIMITS.hidden,
    `Use 1–${LIMITS.hidden} hidden channels.`);
  const hiddenCount = model.bias.length;
  const theta = model.theta.map((weights, k) => matrix(weights, featureCount, hiddenCount, `model.theta[${k}]`));
  const bias = vector(model.bias, hiddenCount, 'model.bias');
  requireCondition(Array.isArray(model.activation_coefficients) && model.activation_coefficients.length > 0 && model.activation_coefficients.length <= 9,
    'Provide 1–9 polynomial activation coefficients in ascending order.');
  const activationCoefficients = vector(model.activation_coefficients, model.activation_coefficients.length, 'model.activation_coefficients');
  requireCondition(Array.isArray(model.output_bias) && model.output_bias.length > 0 && model.output_bias.length <= LIMITS.classes,
    `Use 1–${LIMITS.classes} output classes.`);
  const classCount = model.output_bias.length;
  const outputWeights = matrix(model.output_weights, hiddenCount, classCount, 'model.output_weights');
  const outputBias = vector(model.output_bias, classCount, 'model.output_bias');
  requireCondition(Array.isArray(raw.labels) && raw.labels.length === nodeCount && raw.labels.every((label) => Number.isInteger(label) && label >= 0 && label < classCount),
    'labels must contain one valid class index per node.');
  requireCondition(Number.isInteger(raw.default_degree) && raw.default_degree >= 0 && raw.default_degree < theta.length,
    'default_degree must select an available theta prefix.');
  requireCondition(raw.name === undefined || (typeof raw.name === 'string' && raw.name.length <= 120), 'name must be at most 120 characters.');
  return {
    schema_version: 1, name: raw.name || 'Custom graph', nodes, edges, features,
    labels: raw.labels.slice(), default_degree: raw.default_degree,
    model: { theta, bias, activation_coefficients: activationCoefficients, output_weights: outputWeights, output_bias: outputBias },
    provenance: raw.provenance && typeof raw.provenance === 'object' ? raw.provenance : {},
  };
}

/** Positive symmetric normalization; no implicit weighting or duplicate counting. */
export function normalizedShift(nodeCount, edges) {
  requireCondition(Number.isInteger(nodeCount) && nodeCount > 0 && nodeCount <= LIMITS.nodes, 'Invalid graph size.');
  const adjacency = zeros(nodeCount, nodeCount);
  for (let i = 0; i < nodeCount; i++) adjacency[i][i] = 1;
  for (const [a, b] of edges) {
    requireCondition(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < nodeCount && b < nodeCount, 'Invalid edge index.');
    adjacency[a][b] = 1;
    adjacency[b][a] = 1;
  }
  const degrees = adjacency.map((row) => row.reduce((sum, value) => sum + value, 0));
  return adjacency.map((row, i) => row.map((value, j) => value / Math.sqrt(degrees[i] * degrees[j])));
}

export function multiply(a, b) {
  const result = zeros(a.length, b[0].length);
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < b.length; k++) {
      if (a[i][k] === 0) continue;
      for (let j = 0; j < b[0].length; j++) result[i][j] += a[i][k] * b[k][j];
    }
  }
  return result;
}

function checkDegree(fixture, degree) {
  requireCondition(Number.isInteger(degree) && degree >= 0 && degree < fixture.model.theta.length && degree <= LIMITS.degree,
    'Choose an available polynomial degree.');
}

/** Returns bank[k][node][feature]; never mutates features or model weights. */
export function compileBank(fixture, degree = fixture.default_degree, features = fixture.features) {
  checkDegree(fixture, degree);
  const shift = normalizedShift(fixture.nodes.length, fixture.edges);
  const bank = [copyMatrix(features)];
  if (degree > 0) bank.push(multiply(shift, bank[0]));
  for (let k = 2; k <= degree; k++) {
    const shifted = multiply(shift, bank[k - 1]);
    bank.push(shifted.map((row, i) => row.map((value, j) => 2 * value - bank[k - 2][i][j])));
  }
  return bank;
}

function finish(fixture, preactivation) {
  const coefficients = fixture.model.activation_coefficients;
  const activation = preactivation.map((row) => row.map((value) => {
    let result = 0;
    for (let p = coefficients.length - 1; p >= 0; p--) result = result * value + coefficients[p];
    return result;
  }));
  const logits = multiply(activation, fixture.model.output_weights)
    .map((row) => row.map((value, c) => value + fixture.model.output_bias[c]));
  requireCondition(logits.every((row) => row.every(Number.isFinite)), 'This input produces nonfinite outputs; reduce its magnitudes or polynomial coefficients.');
  const predictions = logits.map((row) => row.reduce((best, value, c) => value > row[best] ? c : best, 0));
  return { preactivation, activation, logits, predictions };
}

/** Bank projection and polynomial readout; graph operations are absent from this step. */
export function evaluateCompiled(fixture, bank, degree = bank.length - 1) {
  checkDegree(fixture, degree);
  requireCondition(bank.length >= degree + 1, 'The feature bank is incomplete.');
  const preactivation = Array.from({ length: fixture.nodes.length }, () => fixture.model.bias.slice());
  for (let k = 0; k <= degree; k++) {
    const projected = multiply(bank[k], fixture.model.theta[k]);
    for (let n = 0; n < preactivation.length; n++) {
      for (let h = 0; h < preactivation[n].length; h++) preactivation[n][h] += projected[n][h];
    }
  }
  return finish(fixture, preactivation);
}

/**
 * Independent dense oracle: construct T_k(S) as full N×N matrices, then apply X.
 * It does not call compileBank or evaluateCompiled. Both paths use the same model.
 */
export function evaluateDirect(fixture, degree = fixture.default_degree, features = fixture.features) {
  checkDegree(fixture, degree);
  const n = fixture.nodes.length;
  const shift = normalizedShift(n, fixture.edges);
  let previous = zeros(n, n);
  for (let i = 0; i < n; i++) previous[i][i] = 1;
  let current = shift;
  const preactivation = Array.from({ length: n }, () => fixture.model.bias.slice());
  for (let k = 0; k <= degree; k++) {
    let polynomial;
    if (k === 0) polynomial = previous;
    else if (k === 1) polynomial = current;
    else {
      const product = multiply(shift, current);
      polynomial = product.map((row, i) => row.map((value, j) => 2 * value - previous[i][j]));
      previous = current;
      current = polynomial;
    }
    const projection = multiply(multiply(polynomial, features), fixture.model.theta[k]);
    for (let i = 0; i < n; i++) {
      for (let h = 0; h < preactivation[i].length; h++) preactivation[i][h] += projection[i][h];
    }
  }
  return finish(fixture, preactivation);
}

/** Deterministic, bounded perturbation; repeat runs with the same setting match. */
export function perturbFeatures(features, amount = 0, seed = 17) {
  requireCondition(Number.isFinite(amount) && amount >= 0 && amount <= 1, 'Perturbation must be between 0 and 1.');
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return features.map((row) => row.map((value) => value + amount * (2 * random() - 1)));
}

export function runExperiment(fixture, degree = fixture.default_degree, perturbation = 0) {
  checkDegree(fixture, degree);
  const features = perturbFeatures(fixture.features, perturbation);
  const t0 = now();
  const bank = compileBank(fixture, degree, features);
  const t1 = now();
  const compiled = evaluateCompiled(fixture, bank, degree);
  const t2 = now();
  const direct = evaluateDirect(fixture, degree, features);
  const t3 = now();
  const errors = compiled.logits.flatMap((row, n) => row.map((value, c) => Math.abs(value - direct.logits[n][c])));
  const agreement = compiled.predictions.filter((prediction, n) => prediction === direct.predictions[n]).length / fixture.nodes.length;
  const accuracy = compiled.predictions.filter((prediction, n) => prediction === fixture.labels[n]).length / fixture.nodes.length;
  return {
    schema_version: 1, mode: 'Local plaintext demonstration', encrypted: false,
    fixture_name: fixture.name, degree, perturbation, feature_seed: 17,
    graph: { nodes: fixture.nodes.length, edges: fixture.edges.length, features: fixture.features[0].length },
    bank_scalar_count: (degree + 1) * fixture.nodes.length * fixture.features[0].length,
    timing_ms: { compile: t1 - t0, compiled_inference: t2 - t1, direct_oracle: t3 - t2 },
    diagnostics: { max_absolute_logit_error: Math.max(...errors), mean_absolute_logit_error: errors.reduce((sum, value) => sum + value, 0) / errors.length,
      prediction_agreement: agreement, illustrative_all_node_accuracy: accuracy },
    compiled, direct, nodes: fixture.nodes, labels: fixture.labels, provenance: fixture.provenance,
  };
}
