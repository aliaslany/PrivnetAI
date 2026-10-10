import SEAL from 'node-seal';
import { compileBank, evaluateCompiled } from './krylov.js';

// This is a local experimental demonstration. The evaluator below receives a
// serialized public request, never a secret key or an unencrypted Krylov bank.
// Both roles share one browser process; this is not process isolation.
const POLY_MODULUS_DEGREE = 16384;
const COEFF_MODULUS_BITS = [60, 40, 40, 40, 40, 60];
const SCALE = 2 ** 40;
let runtimePromise;

async function runtime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      if (typeof window === 'undefined') return SEAL();
      const { default: wasmUrl } = await import('node-seal-wasm?url');
      return SEAL({
        locateFile: (path) => (path.endsWith('.wasm') ? wasmUrl : path),
      });
    })().catch((error) => {
      runtimePromise = undefined;
      throw error;
    });
  }
  return runtimePromise;
}

const now = () => performance.now();
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

function resources() {
  const owned = new Set();
  return {
    keep(value) {
      owned.add(value);
      return value;
    },
    drop(value) {
      if (value && owned.delete(value)) value.delete();
    },
    dispose() {
      for (const value of [...owned].reverse()) value.delete();
      owned.clear();
    },
  };
}

function validate(fixture, degree, features) {
  const model = fixture?.model;
  if (!Number.isInteger(degree) || degree < 0 || degree > 4) {
    throw new Error('The local CKKS demo supports integer degrees from 0 to 4.');
  }
  const nodes = features?.length;
  const channels = features?.[0]?.length;
  const hidden = model?.bias?.length;
  const classes = model?.output_bias?.length;
  if (!(nodes >= 1 && nodes <= 32 && channels >= 1 && channels <= 4
    && hidden >= 1 && hidden <= 8 && classes >= 2 && classes <= 8)) {
    throw new Error('This CKKS demo requires a small graph and a compatible model.');
  }
  if (fixture.nodes.length !== nodes
    || features.some((row) => row.length !== channels)
    || model.theta.length <= degree
    || model.theta.slice(0, degree + 1).some((layer) => layer.length !== channels
      || layer.some((row) => row.length !== hidden))
    || model.output_weights.length !== hidden
    || model.output_weights.some((row) => row.length !== classes)) {
    throw new Error('The graph features and model dimensions do not match.');
  }
  if (JSON.stringify(model.activation_coefficients) !== '[0,0,1]') {
    throw new Error('This encrypted circuit implements the square activation only.');
  }
  const numbers = [features, model.theta, model.bias,
    model.output_weights, model.output_bias].flat(Infinity);
  if (numbers.some((value) => !Number.isFinite(value) || Math.abs(value) > 8)) {
    throw new Error('Demo inputs and model coefficients must be finite and bounded by 8.');
  }
  return { nodes, channels, hidden, classes };
}

function makeParameters(seal, owned) {
  const parameters = owned.keep(new seal.EncryptionParameters(seal.SchemeType.ckks));
  parameters.setPolyModulusDegree(POLY_MODULUS_DEGREE);
  const modulus = owned.keep(seal.CoeffModulus.Create(
    POLY_MODULUS_DEGREE, Int32Array.from(COEFF_MODULUS_BITS),
  ));
  parameters.setCoeffModulus(modulus);
  owned.drop(modulus);
  return parameters;
}

function publicContext(seal, request, owned) {
  // Only these named fields cross the logical client/evaluator boundary.
  const parameters = owned.keep(new seal.EncryptionParameters(seal.SchemeType.ckks));
  parameters.loadFromArray(request.parameters);
  const context = owned.keep(new seal.SEALContext(parameters, true, seal.SecLevelType.tc128));
  if (!context.parametersSet()) throw new Error('SEAL rejected the encryption parameters.');
  const publicKey = owned.keep(new seal.PublicKey());
  publicKey.loadFromArray(context, request.publicKey);
  const relinKeys = owned.keep(new seal.RelinKeys());
  relinKeys.loadFromArray(context, request.relinKeys);
  return { context, publicKey, relinKeys };
}

function encodeScalar(seal, encoder, evaluator, owned, value, ciphertext) {
  const plaintext = owned.keep(new seal.Plaintext());
  // A one-element vector does NOT broadcast in CKKS. Populate every slot.
  const constant = new Float64Array(encoder.slotCount());
  constant.fill(value);
  encoder.encode(constant, SCALE, plaintext);
  const id = owned.keep(ciphertext.parmsId());
  evaluator.plainModSwitchToInplace(plaintext, id);
  owned.drop(id);
  return plaintext;
}

async function evaluatePublic(seal, request, model, dimensions, progress) {
  const owned = resources();
  try {
    const { context, publicKey, relinKeys } = publicContext(seal, request, owned);
    const encoder = owned.keep(new seal.CKKSEncoder(context));
    const evaluator = owned.keep(new seal.Evaluator(context));
    const encryptor = owned.keep(new seal.Encryptor(context, publicKey));
    const inputs = request.columns.map((degreeColumns) => degreeColumns.map((bytes) => {
      const ciphertext = owned.keep(new seal.Ciphertext());
      ciphertext.loadFromArray(context, bytes);
      return ciphertext;
    }));

    function linearCombination(terms, bias) {
      let result;
      for (const [ciphertext, weight] of terms) {
        if (weight === 0) continue; // Avoid transparent zero ciphertexts.
        const plaintext = encodeScalar(seal, encoder, evaluator, owned, weight, ciphertext);
        const product = owned.keep(new seal.Ciphertext());
        evaluator.multiplyPlain(ciphertext, plaintext, product);
        owned.drop(plaintext);
        if (result) {
          evaluator.addInplace(result, product);
          owned.drop(product);
        } else result = product;
      }
      if (result) {
        evaluator.rescaleToNextInplace(result);
        result.setScale(SCALE);
      } else {
        // Encrypt a genuine zero with the public key; no client secret is used.
        const zero = owned.keep(new seal.Plaintext());
        encoder.encode(new Float64Array(encoder.slotCount()), SCALE, zero);
        result = owned.keep(new seal.Ciphertext());
        encryptor.encrypt(zero, result);
        owned.drop(zero);
        // Match the level reached by a nonzero linear combination.
        const source = terms[0][0];
        const id = owned.keep(source.parmsId());
        evaluator.cipherModSwitchToInplace(result, id);
        owned.drop(id);
        evaluator.cipherModSwitchToNextInplace(result);
      }
      if (bias !== 0) {
        const plaintext = encodeScalar(seal, encoder, evaluator, owned, bias, result);
        evaluator.addPlainInplace(result, plaintext);
        owned.drop(plaintext);
      }
      return result;
    }

    const hidden = [];
    for (let h = 0; h < dimensions.hidden; h += 1) {
      await progress(`Evaluating encrypted hidden channel ${h + 1}/${dimensions.hidden}…`);
      const terms = inputs.flatMap((columns, k) => columns.map((ciphertext, f) => (
        [ciphertext, model.theta[k][f][h]]
      )));
      const activation = linearCombination(terms, model.bias[h]);
      evaluator.squareInplace(activation);
      evaluator.relinearizeInplace(activation, relinKeys);
      evaluator.rescaleToNextInplace(activation);
      activation.setScale(SCALE);
      hidden.push(activation);
    }

    const outputs = [];
    for (let c = 0; c < dimensions.classes; c += 1) {
      await progress(`Evaluating encrypted class ${c + 1}/${dimensions.classes}…`);
      const result = linearCombination(hidden.map((ciphertext, h) => (
        [ciphertext, model.output_weights[h][c]]
      )), model.output_bias[c]);
      outputs.push(Uint8Array.from(result.saveToArray(seal.ComprModeType.none)));
      owned.drop(result);
    }
    return outputs;
  } finally {
    owned.dispose();
  }
}

/** Real CKKS evaluation of a client-compiled Krylov bank. Never falls back. */
export async function runEncrypted(fixture, {
  degree = fixture.default_degree ?? 2,
  features = fixture.features,
  onProgress = () => {},
} = {}) {
  const started = now();
  const timings = {};
  const dimensions = validate(fixture, degree, features);
  const progress = async (message) => {
    onProgress(message);
    await nextFrame();
  };
  await progress('Loading the real CKKS WebAssembly runtime…');
  let mark = now();
  const seal = await runtime();
  timings.wasmLoadMs = now() - mark;
  const owned = resources();
  try {
    await progress('Compiling the Krylov bank on the client…');
    mark = now();
    const bank = compileBank(fixture, degree, features);
    const reference = evaluateCompiled(fixture, bank, degree);
    timings.compileMs = now() - mark;

    await progress('Creating fresh client keys and a public evaluator request…');
    mark = now();
    const parameters = makeParameters(seal, owned);
    const context = owned.keep(new seal.SEALContext(parameters, true, seal.SecLevelType.tc128));
    if (!context.parametersSet()) throw new Error('SEAL rejected the encryption parameters.');
    const keyGenerator = owned.keep(new seal.KeyGenerator(context));
    const publicKey = owned.keep(keyGenerator.createPublicKey());
    const secretKey = owned.keep(keyGenerator.secretKey());
    const relinKeys = owned.keep(keyGenerator.createRelinKeys());
    const encoder = owned.keep(new seal.CKKSEncoder(context));
    const encryptor = owned.keep(new seal.Encryptor(context, publicKey));
    const decryptor = owned.keep(new seal.Decryptor(context, secretKey));
    const request = {
      parameters: Uint8Array.from(parameters.saveToArray(seal.ComprModeType.none)),
      publicKey: Uint8Array.from(publicKey.saveToArray(seal.ComprModeType.none)),
      relinKeys: Uint8Array.from(relinKeys.saveToArray(seal.ComprModeType.none)),
      columns: [],
    };
    timings.keygenMs = now() - mark;
    owned.drop(keyGenerator);
    owned.drop(relinKeys);

    await progress('Encrypting each client Krylov-bank column…');
    mark = now();
    for (const layer of bank) {
      const columns = [];
      for (let f = 0; f < dimensions.channels; f += 1) {
        const plaintext = owned.keep(new seal.Plaintext());
        encoder.encode(Float64Array.from(layer.map((row) => row[f])), SCALE, plaintext);
        const ciphertext = owned.keep(new seal.Ciphertext());
        encryptor.encrypt(plaintext, ciphertext);
        columns.push(Uint8Array.from(ciphertext.saveToArray(seal.ComprModeType.none)));
        owned.drop(ciphertext);
        owned.drop(plaintext);
      }
      request.columns.push(columns);
    }
    timings.encryptionMs = now() - mark;
    const inputCiphertextBytes = request.columns.flat().reduce((sum, bytes) => sum + bytes.length, 0);

    await progress('Evaluating with public parameters and encrypted columns only…');
    mark = now();
    const outputs = await evaluatePublic(seal, request, fixture.model, dimensions, progress);
    timings.evaluationMs = now() - mark;
    const outputCiphertextBytes = outputs.reduce((sum, bytes) => sum + bytes.length, 0);

    await progress('Decrypting final logits locally and checking the plaintext reference…');
    mark = now();
    const logits = Array.from({ length: dimensions.nodes }, () => []);
    for (const bytes of outputs) {
      const ciphertext = owned.keep(new seal.Ciphertext());
      ciphertext.loadFromArray(context, bytes);
      const plaintext = owned.keep(new seal.Plaintext());
      decryptor.decrypt(ciphertext, plaintext);
      const values = encoder.decodeFloat64(plaintext);
      for (let i = 0; i < dimensions.nodes; i += 1) logits[i].push(values[i]);
      owned.drop(plaintext);
      owned.drop(ciphertext);
    }
    timings.decryptionMs = now() - mark;
    if (logits.flat().some((value) => !Number.isFinite(value))) {
      throw new Error('CKKS produced a non-finite output; no plaintext fallback was used.');
    }
    const argmax = (row) => row.indexOf(Math.max(...row));
    const predictions = logits.map(argmax);
    const expectedPredictions = reference.logits.map(argmax);
    const maxAbsoluteError = Math.max(...logits.flatMap((row, i) => (
      row.map((value, c) => Math.abs(value - reference.logits[i][c]))
    )));
    const predictionAgreement = predictions.reduce((sum, prediction, i) => (
      sum + Number(prediction === expectedPredictions[i])
    ), 0) / dimensions.nodes;
    timings.totalMs = now() - started;
    return {
      logits,
      predictions,
      params: {
        scheme: 'CKKS',
        backend: 'node-seal 7.0.0 / Microsoft SEAL 4.1.2 / WebAssembly',
        polyModulusDegree: POLY_MODULUS_DEGREE,
        coefficientModulusBits: [...COEFF_MODULUS_BITS],
        scaleBits: 40,
        slotCount: POLY_MODULUS_DEGREE / 2,
        securityLevel: 'SEAL classical 128-bit parameter check; no independent concrete or post-quantum estimate',
        multiplicativeLevelsConsumed: 3,
        rotations: 0,
        encryptedBankColumns: request.columns.flat().length,
      },
      timings,
      maxAbsoluteError,
      predictionAgreement,
      ciphertextBytes: inputCiphertextBytes + outputCiphertextBytes,
      inputCiphertextBytes,
      outputCiphertextBytes,
      publicContextHasSecretKey: false,
      scope: 'Local real CKKS: client compilation, encryption and final decryption; public evaluator in the same browser process. Public weights. No bank, key or ciphertext is sent to a remote evaluator; no process isolation or independent security audit.',
    };
  } finally {
    owned.dispose();
  }
}
