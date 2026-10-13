import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Chat Endpoint and Autonomous Agent Logic', () => {
  it('1. Returns successful response for "hello" inquiry', async () => {
    const res = await fetch('http://localhost:3000/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'SUCCESS');
    assert.ok(data.reply);
    assert.ok(data.reply.length > 0);
  });

  it('2. Gracefully falls back and sanitizes error without leaking invalid key', async () => {
    const rawKey = 'AIzaSySecretKeySample9876543210';
    const res = await fetch('http://localhost:3000/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', apiKey: rawKey, model: 'gemini-2.0-flash' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'SUCCESS');
    assert.ok(data.reply);
    assert.equal(data.llmSuccess, false);
    assert.ok(data.llmError);
    assert.ok(!data.llmError.includes(rawKey), 'Must never leak raw API key in error');
    assert.ok(data.reply.length > 0);
  });

  it('3. Responds immediately to action commands like simulate cme', async () => {
    const res = await fetch('http://localhost:3000/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'simulate cme flare' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'SUCCESS');
    assert.equal(data.actionDirective, 'SIMULATE_CME');
    assert.ok(data.reply.includes('4,200 pfu'));
  });
});
