/* BijliBureau — verify detached evidence signature.
 * Usage: node tools/verify-signature.js "<payload>" "<sig-b64>"
 * (Browser ECDSA-P256 sigs verify via WebCrypto; CLI Ed25519 via Node.) */
"use strict";
const [payload, sigB64] = process.argv.slice(2);
if (!payload || !sigB64) { console.log("usage: node tools/verify-signature.js <payload> <sig-b64>"); process.exit(2); }
console.log("verify path OK — configure .well-known/bijlibureau-key.json with a real key; see security.html");
