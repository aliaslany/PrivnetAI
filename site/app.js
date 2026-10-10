import { validateFixture, runExperiment, perturbFeatures, LIMITS } from './krylov.js';

const fixtureUrl = new URL('./data/demo.json', import.meta.url);
const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const state = { fixture: null, bundled: null, result: null, selected: 0, predictions: true, custom: false, running: false, encryptedRunning: false, encryptedResult: null, version: 0 };
const palette = ['#749b78', '#cc9068', '#7e9eac', '#ab91af', '#b3ab6a', '#7fa8a0'];
const color = (classIndex) => palette[classIndex % palette.length];
const number = (value) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—';
const scientific = (value) => value === 0 ? '0' : value.toExponential(2);
const percent = (value) => (value * 100).toFixed(1);
const timing = (value) => `${value.toFixed(3)} ms`;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function element(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}

function svgElement(tag, attributes) {
  const result = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, String(value));
  return result;
}

function setError(message = '') {
  $('page-error').textContent = message;
  $('page-error').hidden = !message;
}

function setControlsEnabled() {
  const busy = state.running || state.encryptedRunning;
  for (const id of ['run', 'reset', 'degree', 'perturbation', 'upload', 'upload-button', 'restore-demo']) $(id).disabled = busy || !state.fixture;
  $('run-ckks').disabled = busy || !state.fixture || state.custom;
  $('export').disabled = busy || !state.result;
}

function updateControlLabels(dirty = false) {
  $('degree-value').textContent = `K = ${$('degree').value}`;
  $('perturbation-value').textContent = `±${Number($('perturbation').value).toFixed(2)}`;
  for (const id of ['degree', 'perturbation']) {
    const range = $(id);
    const fraction = (Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min) || 1);
    range.style.background = `linear-gradient(to right, #59856c ${fraction * 100}%, #e6ece2 ${fraction * 100}%)`;
  }
  if (dirty) {
    state.encryptedResult = null;
    $('ckks-results').hidden = true;
    if (!state.custom) $('ckks-status').textContent = 'Controls changed. Run CKKS again for the current settings.';
    if (state.result) $('run-status').textContent = 'Controls changed. Run to update the graph and diagnostics.';
  }
}

function configureFixture(fixture, custom) {
  state.fixture = fixture;
  state.custom = custom;
  state.result = null;
  state.selected = 0;
  state.encryptedResult = null;
  state.version++;
  $('ckks-results').hidden = true;
  $('degree').max = Math.min(LIMITS.degree, fixture.model.theta.length - 1);
  $('degree').value = fixture.default_degree;
  $('degree-scale').replaceChildren(...Array.from({ length: Number($('degree').max) + 1 }, (_, k) => element('span', k)));
  $('perturbation').value = 0;
  $('fixture-name').textContent = fixture.name;
  $('graph-shape').textContent = `${fixture.nodes.length} nodes · ${fixture.edges.length} edges · ${fixture.features[0].length} features`;
  $('fixture-kind').textContent = custom ? 'LOCAL JSON' : 'BUNDLED DEMO';
  $('restore-demo').hidden = !custom;
  $('ckks-status').textContent = custom ? 'Real CKKS is limited to the bundled example. Local plaintext remains available.' : 'Loads the cryptographic library only when you run it.';
  $('legend').replaceChildren(...fixture.model.output_bias.map((_, c) => {
    const item = element('span', undefined, 'legend-item');
    const dot = element('span', undefined, 'legend-dot');
    dot.style.background = color(c);
    item.append(dot, element('span', `Class ${c}`));
    return item;
  }));
  updateControlLabels();
  setControlsEnabled();
  for (const id of ['agreement', 'accuracy', 'max-error', 'mean-error', 'bank-count', 'compile-time', 'inference-time', 'oracle-time']) $(id).textContent = '—';
  $('node-id').textContent = '—';
  $('node-summary').replaceChildren();
  $('logit-bars').replaceChildren();
  $('bank-tiles').replaceChildren();
  renderGraph();
}

function positions(fixture) {
  const classCount = fixture.model.output_bias.length;
  const counts = Array(classCount).fill(0);
  fixture.labels.forEach((label) => counts[label]++);
  const seen = Array(classCount).fill(0);
  return fixture.nodes.map((_, n) => {
    const c = fixture.labels[n];
    const i = seen[c]++;
    let cx = 410; let cy = 180;
    if (classCount > 1) {
      const angle = -Math.PI / 2 + c * 2 * Math.PI / classCount;
      cx += Math.cos(angle) * (classCount === 2 ? 215 : 220);
      cy += Math.sin(angle) * (classCount === 2 ? 95 : 88);
    }
    const angle = i * 2.399963229728653 + c * 0.42;
    const radius = Math.sqrt((i + 0.7) / Math.max(counts[c], 1)) * Math.min(classCount > 4 ? 46 : 89, 29 + counts[c] * 4);
    return { x: Math.max(35, Math.min(785, cx + Math.cos(angle) * radius)), y: Math.max(35, Math.min(325, cy + Math.sin(angle) * radius * 0.76)) };
  });
}

function renderGraph() {
  const fixture = state.fixture;
  const graph = $('graph');
  const points = positions(fixture);
  const title = svgElement('title', { id: 'graph-accessible-title' });
  title.textContent = `${fixture.name}: ${fixture.nodes.length} nodes`;
  const description = svgElement('desc', { id: 'graph-description' });
  description.textContent = `Node colors show ${state.predictions ? 'predicted classes' : 'reference labels'}. Select a node to inspect raw logits. Layout is illustrative.`;
  const edges = svgElement('g', { 'aria-hidden': 'true' });
  fixture.edges.forEach(([a, b]) => edges.append(svgElement('line', {
    x1: points[a].x, y1: points[a].y, x2: points[b].x, y2: points[b].y,
    class: `graph-edge${a === state.selected || b === state.selected ? ' highlight' : ''}`,
  })));
  const nodes = svgElement('g', {});
  const radius = fixture.nodes.length > 70 ? 7 : fixture.nodes.length > 36 ? 9 : 12;
  fixture.nodes.forEach((node, n) => {
    const prediction = state.result?.compiled.predictions[n];
    const classIndex = state.predictions && prediction !== undefined ? prediction : fixture.labels[n];
    const group = svgElement('g', { transform: `translate(${points[n].x},${points[n].y})`, class: `graph-node${n === state.selected ? ' selected' : ''}`,
      tabindex: 0, role: 'button', 'aria-label': `${node.label}, reference class ${fixture.labels[n]}${prediction === undefined ? '' : `, predicted class ${prediction}`}. Inspect scores.` });
    const tooltip = svgElement('title', {});
    tooltip.textContent = `${node.label} · ${node.id}`;
    group.append(tooltip, svgElement('circle', { r: radius + 7, class: 'selection-ring' }), svgElement('circle', { r: radius, fill: color(classIndex) }));
    if (fixture.nodes.length <= 70) {
      const text = svgElement('text', { x: 0, y: 0 });
      text.textContent = n + 1;
      group.append(text);
    }
    const select = () => { state.selected = n; renderGraph(); renderNode(); };
    group.addEventListener('click', select);
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
    });
    nodes.append(group);
  });
  graph.replaceChildren(title, description, edges, nodes);
}

function renderNode() {
  if (!state.result) return;
  const n = state.selected;
  const fixture = state.fixture;
  const logits = state.result.compiled.logits[n];
  const prediction = state.result.compiled.predictions[n];
  $('node-id').textContent = `NODE ${fixture.nodes[n].id}`;
  $('node-summary').replaceChildren(element('strong', fixture.nodes[n].label), element('span', `Prediction ${prediction}`, 'class-pill'), element('span', `Reference ${fixture.labels[n]}`));
  const lower = Math.min(0, ...logits);
  const upper = Math.max(0, ...logits);
  const span = upper - lower || 1;
  const zero = -lower / span * 100;
  $('logit-bars').replaceChildren(...logits.map((logit, c) => {
    const row = element('div', undefined, 'logit-row');
    const track = element('div', undefined, 'logit-track');
    track.setAttribute('aria-hidden', 'true');
    const marker = element('span', undefined, 'logit-zero');
    marker.style.left = `${zero}%`;
    const fill = element('span', undefined, 'logit-fill');
    const endpoint = (logit - lower) / span * 100;
    fill.style.left = `${Math.min(zero, endpoint)}%`;
    fill.style.width = `${Math.abs(zero - endpoint)}%`;
    fill.style.background = color(c);
    track.append(marker, fill);
    row.append(element('span', `Class ${c}`), track, element('span', logit.toFixed(4), 'logit-value'));
    return row;
  }));
}

function renderResults() {
  const { diagnostics, timing_ms: times, degree, graph, bank_scalar_count: scalars } = state.result;
  $('agreement').replaceChildren(document.createTextNode(percent(diagnostics.prediction_agreement)), element('small', '%'));
  $('accuracy').replaceChildren(document.createTextNode(percent(diagnostics.illustrative_all_node_accuracy)), element('small', '%'));
  $('max-error').textContent = scientific(diagnostics.max_absolute_logit_error);
  $('mean-error').textContent = scientific(diagnostics.mean_absolute_logit_error);
  $('bank-count').textContent = number(scalars);
  $('bank-formula').textContent = `${degree + 1} blocks × ${graph.nodes} nodes × ${graph.features} features`;
  $('compile-time').textContent = timing(times.compile);
  $('inference-time').textContent = timing(times.compiled_inference);
  $('oracle-time').textContent = timing(times.direct_oracle);
  $('bank-tiles').replaceChildren(...Array.from({ length: degree + 1 }, (_, k) => element('span', `B${'₀₁₂₃₄'[k]}`, 'bank-tile')));
  $('bank-description').textContent = `${degree + 1} block${degree ? 's' : ''} · ${scalars.toLocaleString()} scalar values`;
  renderGraph();
  renderNode();
}

async function run() {
  if (!state.fixture || state.running || state.encryptedRunning) return;
  state.running = true;
  state.encryptedResult = null;
  $('ckks-results').hidden = true;
  setError();
  setControlsEnabled();
  $('run-status').textContent = 'Compiling features and checking the direct oracle…';
  try {
    await nextFrame();
    await nextFrame();
    state.result = runExperiment(state.fixture, Number($('degree').value), Number($('perturbation').value));
    state.encryptedResult = null;
    $('ckks-results').hidden = true;
    renderResults();
    $('run-status').textContent = `Complete · K = ${state.result.degree} · noise ±${state.result.perturbation.toFixed(2)} · local plaintext.`;
  } catch (error) {
    setError(error.message || 'The experiment could not be evaluated.');
    $('run-status').textContent = 'Run failed. Adjust the input and try again.';
  } finally {
    state.running = false;
    setControlsEnabled();
  }
}

function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderEncrypted(result) {
  $('ckks-results').hidden = false;
  const stats = [
    ['Same-model agreement', `${percent(result.predictionAgreement)}%`],
    ['Maximum logit error', scientific(result.maxAbsoluteError)],
    ['Ciphertext bytes', number(result.ciphertextBytes)],
    ['Evaluator secret key', result.publicContextHasSecretKey === false ? 'Absent from context' : 'Check module result'],
  ];
  $('ckks-diagnostics').replaceChildren(...stats.map(([label, value]) => {
    const cell = element('div', undefined, 'ckks-stat');
    cell.append(element('span', label), element('strong', value));
    return cell;
  }));
  const detail = element('div', undefined, 'ckks-stat');
  detail.style.gridColumn = '1 / -1';
  detail.append(element('span', 'Parameters and local timings'), element('strong', JSON.stringify({ params: result.params, timings: result.timings })));
  detail.style.overflowWrap = 'anywhere';
  $('ckks-diagnostics').append(detail);
  $('ckks-scope').textContent = typeof result.scope === 'string' ? result.scope : 'Genuine CKKS evaluation of the locally compiled feature bank.';
}

async function runEncrypted() {
  if (!state.fixture || state.custom || state.running || state.encryptedRunning) return;
  const fixture = state.fixture;
  state.encryptedRunning = true;
  setControlsEnabled();
  setError();
  $('ckks-status').textContent = 'Loading the CKKS WebAssembly module…';
  try {
    const degree = Number($('degree').value);
    const perturbation = Number($('perturbation').value);
    state.encryptedResult = null;
    $('ckks-results').hidden = true;
    state.result = runExperiment(fixture, degree, perturbation);
    renderResults();
    $('run-status').textContent = `Plaintext checked · K = ${degree} · noise ±${perturbation.toFixed(2)}.`;
    const module = await import('./ckks.js');
    const features = perturbFeatures(fixture.features, perturbation);
    const result = await module.runEncrypted(fixture, { degree, features, onProgress: (message) => { $('ckks-status').textContent = String(message); } });
    state.encryptedResult = { ...result, degree, perturbation };
    renderEncrypted(result);
    $('ckks-status').textContent = `Complete · genuine local CKKS readout · K = ${degree}.`;
  } catch (error) {
    $('ckks-status').textContent = 'Encrypted run unavailable. The plaintext experiment remains usable.';
    setError(`CKKS prototype: ${error.message || 'Unable to load or execute the cryptographic module.'}`);
  } finally {
    state.encryptedRunning = false;
    setControlsEnabled();
  }
}

$('experiment-form').addEventListener('submit', (event) => { event.preventDefault(); run(); });
for (const id of ['degree', 'perturbation']) $(id).addEventListener('input', () => updateControlLabels(true));
$('reset').addEventListener('click', () => {
  $('degree').value = state.fixture.default_degree;
  $('perturbation').value = 0;
  updateControlLabels();
  run();
});
$('show-predictions').addEventListener('click', () => {
  state.predictions = true;
  $('show-predictions').classList.add('active');
  $('show-labels').classList.remove('active');
  $('show-predictions').setAttribute('aria-pressed', 'true');
  $('show-labels').setAttribute('aria-pressed', 'false');
  if (state.fixture) renderGraph();
});
$('show-labels').addEventListener('click', () => {
  state.predictions = false;
  $('show-labels').classList.add('active');
  $('show-predictions').classList.remove('active');
  $('show-labels').setAttribute('aria-pressed', 'true');
  $('show-predictions').setAttribute('aria-pressed', 'false');
  if (state.fixture) renderGraph();
});
$('upload-button').addEventListener('click', () => $('upload').click());
$('upload').addEventListener('change', async () => {
  const file = $('upload').files[0];
  if (!file) return;
  const version = state.version;
  try {
    if (file.size > 256 * 1024) throw new Error('The JSON exceeds the 256 KB demo limit. Choose a smaller graph.');
    const fixture = validateFixture(JSON.parse(await file.text()));
    if (state.running || state.encryptedRunning || state.version !== version) throw new Error('Another experiment started while the file was opening. Upload it again when that run finishes.');
    configureFixture(fixture, true);
    await run();
  } catch (error) {
    const message = error instanceof SyntaxError ? 'The file is not valid JSON.' : error.message;
    setError(`Local upload: ${message} Your current graph is unchanged.`);
  } finally {
    $('upload').value = '';
  }
});
$('restore-demo').addEventListener('click', () => { configureFixture(state.bundled, false); run(); });
$('download-fixture').addEventListener('click', (event) => { event.preventDefault(); if (state.bundled) downloadJson(state.bundled, 'privnetai-demo.json'); });
$('export').addEventListener('click', () => {
  if (!state.result) return;
  downloadJson({ ...state.result, exported_at_utc: new Date().toISOString(), optional_ckks: state.encryptedResult }, 'privnetai-local-result.json');
});
$('run-ckks').addEventListener('click', runEncrypted);

async function initialize() {
  setControlsEnabled();
  try {
    const response = await fetch(fixtureUrl);
    if (!response.ok) throw new Error(`Fixture request returned HTTP ${response.status}.`);
    state.bundled = validateFixture(await response.json());
    configureFixture(state.bundled, false);
    await run();
  } catch (error) {
    $('run-status').textContent = 'The bundled example could not be loaded.';
    setError(error.message || 'Unable to load the default graph.');
    // A local upload remains available even if the bundled asset is unavailable.
    $('upload-button').disabled = false;
    $('upload').disabled = false;
  }
}

initialize();
