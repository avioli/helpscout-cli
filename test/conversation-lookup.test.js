/**
 * Tests for getConversationByIdOrNumber (fake client, no network).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getConversationByIdOrNumber } from '../src/mailbox-client.js';

function fakeClient({ ids = {}, numbers = {} }) {
  const calls = [];
  return {
    calls,
    async get(path, params) {
      calls.push(params?.number ? `${path}?number=${params.number}` : path);
      if (path === '/conversations') {
        const id = numbers[params.number];
        return { _embedded: { conversations: id ? [{ id }] : [] } };
      }
      const id = Number(path.split('/').pop());
      if (ids[id]) return ids[id];
      throw Object.assign(new Error('Not found'), { status: 404 });
    },
  };
}

test('small value is looked up as a number first', async () => {
  const c = fakeClient({ ids: { 3467077030: { id: 3467077030 } }, numbers: { 18527: 3467077030 } });
  const r = await getConversationByIdOrNumber('18527', { client: c });
  assert.equal(r.id, 3467077030);
  assert.deepEqual(c.calls, ['/conversations?number=18527', '/conversations/3467077030']);
});

test('small value falls back to ID', async () => {
  const c = fakeClient({ ids: { 42: { id: 42 } } });
  const r = await getConversationByIdOrNumber(42, { client: c });
  assert.equal(r.id, 42);
  assert.deepEqual(c.calls, ['/conversations?number=42', '/conversations/42']);
});

test('large value is looked up as an ID first', async () => {
  const c = fakeClient({ ids: { 3467077030: { id: 3467077030 } } });
  await getConversationByIdOrNumber(3467077030, { client: c });
  assert.deepEqual(c.calls, ['/conversations/3467077030']);
});

test('large value falls back to number', async () => {
  const c = fakeClient({ ids: { 7: { id: 7 } }, numbers: { 200000: 7 } });
  const r = await getConversationByIdOrNumber(200000, { client: c });
  assert.equal(r.id, 7);
});

test('not found either way throws 404', async () => {
  await assert.rejects(getConversationByIdOrNumber(5, { client: fakeClient({}) }), { status: 404 });
});

test('non-numeric input is rejected', async () => {
  await assert.rejects(getConversationByIdOrNumber('abc', { client: fakeClient({}) }), /Invalid/);
});

test('params are passed to the final fetch', async () => {
  let seen;
  const client = {
    async get(path, params) {
      seen = params;
      return { id: 3467077030 };
    },
  };
  await getConversationByIdOrNumber(3467077030, { params: { embed: 'threads' }, client });
  assert.deepEqual(seen, { embed: 'threads' });
});
