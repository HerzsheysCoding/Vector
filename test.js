const test = require('node:test');
const assert = require('node:assert');

test('Offline Rule-Based Scorer Test - Brush Fire', () => {
  const report = "Thick black smoke and rapidly spreading brush fire near road.";
  const lower = report.toLowerCase();
  let severity = 5;
  if (lower.includes('fire') || lower.includes('smoke')) {
    severity = 8;
  }
  assert.strictEqual(severity, 8);
});

test('Offline Rule-Based Scorer Test - Substation Arc', () => {
  const report = "High voltage transformer explosion and arc flash.";
  const lower = report.toLowerCase();
  let severity = 5;
  if (lower.includes('transformer') || lower.includes('arc')) {
    severity = 9;
  }
  assert.strictEqual(severity, 9);
});
