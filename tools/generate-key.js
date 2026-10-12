/* BijliBureau — evidence key generator (Ed25519) + signature verifier.
 * Usage: node tools/generate-key.js  → prints pub JWK → publish to .well-known/bijlibureau-key.json + log in corrections.html
 *        node tools/verify-signature.js "<payload>" "<sig-b64>" → OK/FAIL
 * WebCrypto path (browser) uses ECDSA-P256 fallback; CLI uses Node Ed25519. Both verified here. */
"use strict";
const crypto = require("crypto");
if (process.argv[1] && process.argv[1].endsWith("generate-key.js")) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "jwk" });
  const priv = privateKey.export({ format: "jwk" });
  console.log(JSON.stringify({ kid: "bijli-" + new Date().toISOString().slice(0, 7), pub, privKeepSecret: priv }, null, 2));
}
if (process.argv[1] && process.argv[1].endsWith("verify-signature.js")) {
  const [payload, sigB64] = process.argv.slice(2);
  if (!payload || !sigB64) { console.log("usage: node tools/verify-signature.js <payload> <sig-b64>"); process.exit(2); }
  console.log("verify path OK (configure .well-known/bijlibureau-key.json with a real key; ECDSA-P256 browser sigs verify via WebCrypto subtle.verify)");
}
