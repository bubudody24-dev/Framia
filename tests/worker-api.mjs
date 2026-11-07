import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:8787';
const origin = 'http://localhost:8787';
const id = crypto.randomUUID();
const userA = `test-a-${id}`;
const userB = `test-b-${id}`;
const project = {
  id, name: 'Worker integration test', width: 320, height: 180, fps: 12,
  frames: [{ id: 'f1', start: 0, duration: 1 }],
  layers: [{ id: 'l1', name: 'Layer 1', visible: true, opacity: 1 }],
  content: { f1: { l1: [] } }, clips: [], background: '#ffffff',
};

async function call(path, { method = 'GET', user, data, body, contentType, requestOrigin = origin } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(user ? { 'x-test-user': user } : {}),
      ...(method !== 'GET' ? { Origin: requestOrigin } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body: data ? JSON.stringify(data) : body,
  });
  const result = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text();
  return { status: response.status, result, headers: response.headers };
}

assert.equal((await call('/api/me')).status, 401);
assert.equal((await call('/api/projects/' + id, { method: 'PUT', user: userA, data: project, requestOrigin: 'https://other.example' })).status, 403);
assert.equal((await call('/api/projects/' + id, { method: 'PUT', user: userA, data: project })).status, 200);
assert.equal((await call('/api/projects/' + id, { user: userA })).result.project.name, project.name);
assert.equal((await call('/api/projects/' + id, { user: userB })).status, 404);
assert.equal((await call('/api/projects', { user: userA })).result.projects.some((p) => p.id === id), true);
assert.equal((await call('/api/projects', { user: userB })).result.projects.some((p) => p.id === id), false);
assert.equal((await call('/api/brushes', { method: 'PUT', user: userA, data: [{ id: 'custom', name: 'Custom' }] })).status, 200);
assert.equal((await call('/api/brushes', { user: userB })).result.brushes.length, 0);

const room = await call('/api/rooms', { method: 'POST', user: userA, data: { project } });
assert.equal(room.status, 200, JSON.stringify(room.result));
const code = room.result.code;
assert.equal((await call('/api/rooms/' + code, { user: userB })).status, 403);
assert.equal((await call('/api/realtime/ticket', { method: 'POST', user: userB, data: { room: `project:${code}` } })).status, 403);
assert.equal((await call('/api/rooms/' + code + '/join', { method: 'POST', user: userB, data: {} })).status, 200);
assert.equal((await call('/api/rooms/' + code, { user: userB })).result.revision, 1);
const stroke = await call('/api/rooms/' + code + '/stroke', { method: 'POST', user: userA, data: { frameId: 'f1', layerId: 'l1', elements: [{ id: 's1', type: 'line', points: [{ x: 1, y: 1 }, { x: 3, y: 3 }] }] } });
assert.equal(stroke.status, 200, JSON.stringify(stroke.result));
assert.equal((await call('/api/rooms/' + code, { user: userB })).result.project.content.f1.l1.length, 1);
assert.equal((await call('/api/rooms/' + code + '/stroke', { method: 'POST', user: userA, data: { frameId: 'f1', layerId: 'l1', elements: [{ id: 's1', type: 'line' }] } })).status, 200);
assert.equal((await call('/api/rooms/' + code, { user: userB })).result.project.content.f1.l1.length, 1, 'duplicate stroke IDs must be idempotent');
const [strokeA, strokeB] = await Promise.all([
  call('/api/rooms/' + code + '/stroke', { method: 'POST', user: userA, data: { frameId: 'f1', layerId: 'l1', elements: [{ id: 's2', type: 'line', createdAt: 2 }] } }),
  call('/api/rooms/' + code + '/stroke', { method: 'POST', user: userB, data: { frameId: 'f1', layerId: 'l1', elements: [{ id: 's3', type: 'line', createdAt: 3 }] } }),
]);
assert.equal(strokeA.status, 200);
assert.equal(strokeB.status, 200);
let shared = (await call('/api/rooms/' + code, { user: userA })).result.project.content.f1.l1;
assert.deepEqual(new Set(shared.map((element) => element.id)), new Set(['s1', 's2', 's3']), 'simultaneous strokes must merge');
assert.equal((await call('/api/rooms/' + code + '/undo', { method: 'POST', user: userA, data: {} })).status, 200);
shared = (await call('/api/rooms/' + code, { user: userA })).result.project.content.f1.l1;
assert.deepEqual(new Set(shared.map((element) => element.id)), new Set(['s1', 's3']), 'undo must only remove the current user latest stroke');
assert.equal((await call('/api/rooms/' + code, { method: 'PUT', user: userA, data: { baseRevision: 1, project } })).status, 409);
assert.equal((await call('/api/rooms/' + code + '/media/test', { method: 'PUT', user: userA, body: 'media bytes', contentType: 'text/plain' })).status, 200);
assert.equal((await call('/api/rooms/' + code + '/media/test', { user: userB })).result, 'media bytes');
const ticket = await call('/api/realtime/ticket', { method: 'POST', user: userA, data: { room: `project:${code}` } });
assert.equal(ticket.status, 200, JSON.stringify(ticket.result));
assert.ok(ticket.result.websocketUrl);
const secondTicket = await call('/api/realtime/ticket', { method: 'POST', user: userB, data: { room: `project:${code}` } });
assert.equal(secondTicket.status, 200);
const first = new WebSocket(ticket.result.websocketUrl, { headers: { Origin: origin } });
const second = new WebSocket(secondTicket.result.websocketUrl, { headers: { Origin: origin } });
const firstMessages = [];
const secondMessages = [];
first.addEventListener('message', (event) => firstMessages.push(JSON.parse(event.data)));
second.addEventListener('message', (event) => secondMessages.push(JSON.parse(event.data)));
async function until(check) {
  const end = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > end) throw Error('Realtime event timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
await until(() => firstMessages.some((message) => message.type === 'ready') && secondMessages.some((message) => message.type === 'ready'));
first.send(JSON.stringify({ type: 'broadcast', event: 'chat', data: { text: 'hello' } }));
await until(() => secondMessages.some((message) => message.type === 'broadcast' && message.event === 'chat'));
second.close();
const reconnectTicket = await call('/api/realtime/ticket', { method: 'POST', user: userB, data: { room: `project:${code}` } });
assert.equal(reconnectTicket.status, 200);
const reconnected = new WebSocket(reconnectTicket.result.websocketUrl, { headers: { Origin: origin } });
const reconnectMessages = [];
reconnected.addEventListener('message', (event) => reconnectMessages.push(JSON.parse(event.data)));
await until(() => reconnectMessages.some((message) => message.type === 'ready'));
assert.equal((await call('/api/rooms/' + code, { user: userB })).result.project.content.f1.l1.length, 2);
first.close();
reconnected.close();
assert.equal((await call('/api/projects/' + id, { method: 'DELETE', user: userA })).status, 200);
console.log('Worker API integration checks passed');
