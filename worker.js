import { createFreebuffAuth, isSameOriginRequest } from '@freebuff/auth';
import { createRealtimeTicket, publishRealtime } from './freebuff-realtime/server.js';

let auth;
let handler;
let schema;

const privateHeaders = { 'Cache-Control': 'private, no-store' };
const json = (value, status = 200) => Response.json(value, { status, headers: privateHeaders });
const error = (message, status) => json({ error: message }, status);

function validProject(project) {
  return project && typeof project === 'object' && typeof project.id === 'string' &&
    project.id.length <= 100 && typeof project.name === 'string' && project.name.length <= 200 &&
    Number.isInteger(project.width) && project.width > 0 && project.width <= 8192 &&
    Number.isInteger(project.height) && project.height > 0 && project.height <= 8192 &&
    Array.isArray(project.frames) && project.frames.length > 0 &&
    Array.isArray(project.layers) && project.layers.length > 0 &&
    project.content && typeof project.content === 'object' &&
    Array.isArray(project.clips || []);
}

async function ensureSchema(env) {
  schema ??= env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_projects_v2 (owner TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, frames INTEGER NOT NULL, updated_at INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(owner,id))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_brushes_v2 (owner TEXT PRIMARY KEY, body TEXT NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_rooms_v2 (code TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_room_members_v2 (code TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(code,user_id))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_profiles (user_id TEXT PRIMARY KEY, username TEXT, display_name TEXT, bio TEXT, avatar TEXT, banner TEXT, banner_image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS framia_profiles_username ON framia_profiles(username)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_friends (id TEXT PRIMARY KEY, requester TEXT NOT NULL, target TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS framia_friends_pair ON framia_friends(requester,target)'),
  ]).catch((cause) => { schema = undefined; throw cause; });
  await schema;
}

async function readJson(request, maxBytes = 15_000_000) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('JSON required');
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('Request too large');
  return JSON.parse(text);
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

async function member(env, code, userId) {
  return env.DB.prepare('SELECT 1 FROM framia_room_members_v2 WHERE code=? AND user_id=?')
    .bind(code, userId).first();
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

function imageData(value, max) {
  if (typeof value !== 'string' || !value) return '';
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return '';
  return value.length <= max ? value : '';
}

function publicProfile(row) {
  return {
    id: row.user_id,
    username: row.username || '',
    displayName: row.display_name || '',
    bio: row.bio || '',
    avatar: row.avatar || '',
    banner: row.banner || '',
    bannerImage: row.banner_image || '',
    updatedAt: row.updated_at,
  };
}

function defaultName(user) {
  return text(user.name || (user.email || '').split('@')[0] || 'Framia', 40) || 'Framia';
}

async function ensureProfile(env, user) {
  let row = await env.DB.prepare('SELECT * FROM framia_profiles WHERE user_id=?').bind(user.sub).first();
  if (!row) {
    const now = Date.now();
    await env.DB.prepare('INSERT OR IGNORE INTO framia_profiles(user_id,username,display_name,bio,avatar,banner,banner_image,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(user.sub, null, defaultName(user), '', '', '#9585ed', '', now, now).run();
    row = await env.DB.prepare('SELECT * FROM framia_profiles WHERE user_id=?').bind(user.sub).first();
  }
  return row;
}

async function friendship(env, me, other) {
  const row = await env.DB.prepare(
    'SELECT * FROM framia_friends WHERE (requester=? AND target=?) OR (requester=? AND target=?)',
  ).bind(me, other, other, me).first();
  if (!row) return { state: 'none', id: null };
  if (row.status === 'accepted') return { state: 'friend', id: row.id };
  return { state: row.requester === me ? 'outgoing' : 'incoming', id: row.id };
}

async function publish(env, code, revision) {
  if (env.REALTIME) await publishRealtime(env, { room: `project:${code}`, event: 'project-updated', data: { revision } }).catch(() => {});
}

async function api(request, env, signedIn) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (request.method !== 'GET' && !isSameOriginRequest(request, env.APP_ORIGIN)) return error('Origin forbidden', 403);
  const user = await signedIn.getUser(request);
  if (!user) return error('Sign in required', 401);
  await ensureSchema(env);
  const path = url.pathname.split('/').filter(Boolean);

  try {
    if (path[1] === 'me' && request.method === 'GET') return json({ user });
    if (path[1] === 'projects') {
      if (path.length === 2 && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT id,name,width,height,frames,updated_at FROM framia_projects_v2 WHERE owner=? ORDER BY updated_at DESC').bind(user.sub).all();
        return json({ projects: rows.results.map((r) => ({ id: r.id, name: r.name, width: r.width, height: r.height, frames: r.frames, updatedAt: r.updated_at })) });
      }
      if (path.length === 3 && request.method === 'GET') {
        const row = await env.DB.prepare('SELECT body FROM framia_projects_v2 WHERE owner=? AND id=?').bind(user.sub, path[2]).first();
        return row ? json({ project: JSON.parse(row.body) }) : error('Project not found', 404);
      }
      if (path.length === 3 && request.method === 'PUT') {
        const project = await readJson(request);
        if (!validProject(project) || project.id !== path[2]) return error('Invalid project', 400);
        const now = Date.now();
        await env.DB.prepare('INSERT INTO framia_projects_v2(owner,id,name,width,height,frames,updated_at,body) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET name=excluded.name,width=excluded.width,height=excluded.height,frames=excluded.frames,updated_at=excluded.updated_at,body=excluded.body')
          .bind(user.sub, project.id, project.name, project.width, project.height, project.frames.length, now, JSON.stringify(project)).run();
        return json({ ok: true });
      }
      if (path.length === 3 && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM framia_projects_v2 WHERE owner=? AND id=?').bind(user.sub, path[2]).run();
        return json({ ok: true });
      }
    }
    if (path[1] === 'brushes' && path.length === 2) {
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT body FROM framia_brushes_v2 WHERE owner=?').bind(user.sub).first();
        return json({ brushes: row ? JSON.parse(row.body) : [] });
      }
      if (request.method === 'PUT') {
        const brushes = await readJson(request, 1_000_000);
        if (!Array.isArray(brushes) || brushes.length > 200) return error('Invalid brushes', 400);
        await env.DB.prepare('INSERT INTO framia_brushes_v2(owner,body) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET body=excluded.body').bind(user.sub, JSON.stringify(brushes)).run();
        return json({ ok: true });
      }
    }
    if (path[1] === 'rooms') {
      if (path.length === 2 && request.method === 'POST') {
        const { project } = await readJson(request);
        if (!validProject(project)) return error('Invalid project', 400);
        for (let attempt = 0; attempt < 5; attempt++) {
          const code = roomCode();
          try {
            await env.DB.prepare('INSERT INTO framia_rooms_v2(code,revision,body) VALUES(?,?,?)').bind(code, 1, JSON.stringify(project)).run();
            await env.DB.prepare('INSERT INTO framia_room_members_v2(code,user_id) VALUES(?,?)').bind(code, user.sub).run();
            return json({ code, revision: 1 });
          } catch (cause) {
            if (attempt === 4) throw cause;
          }
        }
      }
      const code = path[2]?.toUpperCase();
      if (!code || !/^[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/.test(code)) return error('Invalid room', 400);
      if (path.length === 4 && path[3] === 'join' && request.method === 'POST') {
        const exists = await env.DB.prepare('SELECT 1 FROM framia_rooms_v2 WHERE code=?').bind(code).first();
        if (!exists) return error('Room not found', 404);
        await env.DB.prepare('INSERT OR IGNORE INTO framia_room_members_v2(code,user_id) VALUES(?,?)').bind(code, user.sub).run();
        return json({ ok: true });
      }
      if (!(await member(env, code, user.sub))) return error('Room forbidden', 403);
      if (path.length === 3 && request.method === 'GET') {
        const row = await env.DB.prepare('SELECT revision,body FROM framia_rooms_v2 WHERE code=?').bind(code).first();
        return row ? json({ revision: row.revision, project: JSON.parse(row.body) }) : error('Room not found', 404);
      }
      if (path.length === 3 && request.method === 'PUT') {
        const { baseRevision, project } = await readJson(request);
        if (!validProject(project) || !Number.isInteger(baseRevision)) return error('Invalid mutation', 400);
        const result = await env.DB.prepare('UPDATE framia_rooms_v2 SET revision=revision+1,body=? WHERE code=? AND revision=?')
          .bind(JSON.stringify(project), code, baseRevision).run();
        if (!result.meta.changes) return error('Room changed', 409);
        await publish(env, code, baseRevision + 1);
        return json({ revision: baseRevision + 1 });
      }
      if (path.length === 4 && path[3] === 'stroke' && request.method === 'POST') {
        const { frameId, layerId, elements } = await readJson(request, 1_000_000);
        if (typeof frameId !== 'string' || typeof layerId !== 'string' || !Array.isArray(elements) || elements.length > 500) return error('Invalid stroke', 400);
        for (let attempt = 0; attempt < 5; attempt++) {
          const row = await env.DB.prepare('SELECT revision,body FROM framia_rooms_v2 WHERE code=?').bind(code).first();
          if (!row) return error('Room not found', 404);
          const project = JSON.parse(row.body);
          if (!project.frames.some((frame) => frame.id === frameId) || !project.layers.some((layer) => layer.id === layerId)) return error('Frame or layer missing', 400);
          project.content[frameId] ??= {};
          project.content[frameId][layerId] ??= [];
          project.content[frameId][layerId].push(...elements);
          const result = await env.DB.prepare('UPDATE framia_rooms_v2 SET revision=revision+1,body=? WHERE code=? AND revision=?')
            .bind(JSON.stringify(project), code, row.revision).run();
          if (result.meta.changes) {
            await publish(env, code, row.revision + 1);
            return json({ revision: row.revision + 1 });
          }
        }
        return error('Room changed', 409);
      }
      if (path.length === 5 && path[3] === 'media') {
        const key = `rooms/${code}/${encodeURIComponent(path[4])}`;
        if (request.method === 'PUT') {
          if ((Number(request.headers.get('content-length')) || 0) > 25_000_000) return error('Media too large', 413);
          await env.FILES.put(key, request.body, { httpMetadata: { contentType: request.headers.get('content-type') || 'application/octet-stream' } });
          return json({ ok: true });
        }
        if (request.method === 'GET') {
          const object = await env.FILES.get(key);
          return object ? new Response(object.body, { headers: { ...privateHeaders, 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream' } }) : error('Media not found', 404);
        }
      }
    }
    if (path[1] === 'profile') {
      if (request.method === 'GET') {
        const row = await ensureProfile(env, user);
        return json({ profile: publicProfile(row), needsUsername: !row.username });
      }
      if (request.method === 'PUT') {
        const row = await ensureProfile(env, user);
        const body = await readJson(request, 400_000);
        let username = row.username;
        if (!username && typeof body.username === 'string' && body.username.trim()) {
          username = body.username.trim().toLowerCase();
          if (!USERNAME_RE.test(username)) return error('Invalid username', 400);
          const taken = await env.DB.prepare('SELECT 1 FROM framia_profiles WHERE username=? AND user_id<>?')
            .bind(username, user.sub).first();
          if (taken) return error('Username taken', 409);
        }
        const displayName = body.displayName === undefined
          ? row.display_name
          : text(body.displayName, 40).trim() || defaultName(user);
        const bio = body.bio === undefined ? row.bio : text(body.bio, 280);
        const avatar = body.avatar === undefined ? row.avatar : imageData(body.avatar, 200_000);
        const banner = body.banner === undefined ? row.banner : text(body.banner, 200);
        const bannerImage = body.bannerImage === undefined ? row.banner_image : imageData(body.bannerImage, 400_000);
        await env.DB.prepare('UPDATE framia_profiles SET username=?,display_name=?,bio=?,avatar=?,banner=?,banner_image=?,updated_at=? WHERE user_id=?')
          .bind(username || null, displayName, bio, avatar, banner, bannerImage, Date.now(), user.sub).run();
        const saved = await env.DB.prepare('SELECT * FROM framia_profiles WHERE user_id=?').bind(user.sub).first();
        return json({ profile: publicProfile(saved), needsUsername: !saved.username });
      }
      return error('Method not allowed', 405);
    }
    if (path[1] === 'profiles' && path.length === 3 && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM framia_profiles WHERE user_id=?').bind(path[2]).first();
      if (!row) return error('Profile not found', 404);
      return json({ profile: publicProfile(row), friend: await friendship(env, user.sub, path[2]) });
    }
    if (path[1] === 'users' && path[2] === 'search' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 20);
      if (q.length < 2) return json({ people: [] });
      const rows = await env.DB.prepare('SELECT * FROM framia_profiles WHERE username LIKE ? AND user_id<>? LIMIT 10')
        .bind(`${q}%`, user.sub).all();
      return json({
        people: rows.results.map((row) => ({
          ...publicProfile(row),
          friend: null,
        })),
      });
    }
    if (path[1] === 'friends') {
      if (path.length === 2 && request.method === 'GET') {
        const rows = await env.DB.prepare(
          'SELECT f.id, f.requester, f.target, f.status, f.created_at, p.* FROM framia_friends f '
          + 'LEFT JOIN framia_profiles p ON p.user_id = CASE WHEN f.requester=? THEN f.target ELSE f.requester END '
          + 'WHERE f.requester=? OR f.target=?',
        ).bind(user.sub, user.sub, user.sub).all();
        const bucket = { friend: [], incoming: [], outgoing: [] };
        for (const row of rows.results) {
          const entry = {
            requestId: row.id,
            profile: {
              id: row.user_id,
              username: row.username || '',
              displayName: row.display_name || '',
              bio: row.bio || '',
              avatar: row.avatar || '',
              banner: row.banner || '',
              bannerImage: row.banner_image || '',
            },
          };
          if (row.status === 'accepted') bucket.friend.push(entry);
          else if (row.requester === user.sub) bucket.outgoing.push(entry);
          else bucket.incoming.push(entry);
        }
        return json(bucket);
      }
      if (path[2] === 'request' && request.method === 'POST') {
        const body = await readJson(request, 2_000);
        const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
        if (!USERNAME_RE.test(username)) return error('Invalid username', 400);
        const target = await env.DB.prepare('SELECT user_id FROM framia_profiles WHERE username=?').bind(username).first();
        if (!target) return error('Usuário não encontrado', 404);
        if (target.user_id === user.sub) return error('Você não pode adicionar você mesmo', 400);
        const current = await friendship(env, user.sub, target.user_id);
        if (current.state === 'friend') return json({ state: 'friend' });
        if (current.state === 'outgoing') return json({ state: 'outgoing' });
        if (current.state === 'incoming') {
          await env.DB.prepare("UPDATE framia_friends SET status='accepted' WHERE id=?").bind(current.id).run();
          return json({ state: 'friend' });
        }
        await env.DB.prepare('INSERT INTO framia_friends(id,requester,target,status,created_at) VALUES(?,?,?,?,?)')
          .bind(crypto.randomUUID(), user.sub, target.user_id, 'pending', Date.now()).run();
        return json({ state: 'outgoing' });
      }
      if (path[2] === 'respond' && request.method === 'POST') {
        const body = await readJson(request, 2_000);
        const row = await env.DB.prepare('SELECT * FROM framia_friends WHERE id=?').bind(String(body.id || '')).first();
        if (!row || row.target !== user.sub) return error('Request not found', 404);
        if (body.accept) {
          await env.DB.prepare("UPDATE framia_friends SET status='accepted' WHERE id=?").bind(row.id).run();
          return json({ state: 'friend' });
        }
        await env.DB.prepare('DELETE FROM framia_friends WHERE id=?').bind(row.id).run();
        return json({ state: 'none' });
      }
      if (path.length === 3 && request.method === 'DELETE') {
        const row = await env.DB.prepare('SELECT * FROM framia_friends WHERE id=?').bind(path[2]).first();
        if (!row || (row.requester !== user.sub && row.target !== user.sub)) return error('Request not found', 404);
        await env.DB.prepare('DELETE FROM framia_friends WHERE id=?').bind(path[2]).run();
        return json({ state: 'none' });
      }
      return error('Method not allowed', 405);
    }
    if (path[1] === 'realtime' && path[2] === 'ticket' && request.method === 'POST') {
      const { room } = await readJson(request, 10_000);
      const code = typeof room === 'string' && /^project:([A-Z2-9]{6}(?:[A-Z2-9]{2})?)$/.exec(room)?.[1];
      if (!code || !(await member(env, code, user.sub))) return error('Room forbidden', 403);
      const ticket = await createRealtimeTicket(env, { room, userId: user.sub, origin: env.APP_ORIGIN, publish: true, presence: true });
      return json(ticket);
    }
    return error('Not found', 404);
  } catch (cause) {
    if (cause instanceof SyntaxError || /JSON required|Request too large/.test(cause.message)) return error('Invalid request', 400);
    return error('Server error', 500);
  }
}

export { api };

export default {
  fetch(request, env) {
    if (!env.FREEBUFF_CLIENT_ID || !env.APP_ORIGIN) {
      if (new URL(request.url).pathname.startsWith('/api/')) return Promise.resolve(error('Authentication is not configured', 503));
      return env.ASSETS.fetch(request);
    }
    auth ??= createFreebuffAuth({ clientId: env.FREEBUFF_CLIENT_ID, issuer: env.FREEBUFF_ISSUER, baseUrl: env.APP_ORIGIN, allowInsecureLocalhost: env.APP_ORIGIN.startsWith('http://localhost:') });
    handler ??= auth.wrap((req, bindings) => api(req, bindings, auth));
    return handler(request, env);
  },
};
