// scripts/__fixtures__/forbidden-fixture.cjs
//
// Synthetic "bad bundle" used by the negative test of check-no-network.mjs
// (Plan 04-09 / PRIV-07). Running
//
//   node scripts/check-no-network.mjs scripts/__fixtures__/forbidden-fixture.cjs
//
// MUST exit 1 and surface the https.request FAIL. If this fixture stops
// failing, the guard has been weakened — escalate before merging.
//
// Never require()d at runtime; CI only.
const https = require("node:https");
module.exports = function badRequest() {
  return https.request("https://example.com/health");
};
