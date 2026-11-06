import pathlib, sys

p = pathlib.Path("worker.js")
t = p.read_text()


def rep(old, new, count=1):
    global t
    n = t.count(old)
    if n != count:
        sys.exit(f"expected {count} match, got {n}: {old[:90]!r}")
    t = t.replace(old, new)


# --- schema -----------------------------------------------------------------
rep(
    """    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_room_members_v2 (code TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(code,user_id))'),""",
    """    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_room_members_v2 (code TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(code,user_id))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_profiles (user_id TEXT PRIMARY KEY, username TEXT, display_name TEXT, bio TEXT, avatar TEXT, banner TEXT, banner_image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS framia_profiles_username ON framia_profiles(username)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS framia_friends (id TEXT PRIMARY KEY, requester TEXT NOT NULL, target TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS framia_friends_pair ON framia_friends(requester,target)'),""",
)

# --- helpers ----------------------------------------------------------------
rep(
    """async function publish(env, code, revision) {""",
    """const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

function imageData(value, max) {
  if (typeof value !== 'string' || !value) return '';
  if (!/^data:image\\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return '';
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

async function publish(env, code, revision) {""",
)

# --- endpoints --------------------------------------------------------------
rep(
    """    if (path[1] === 'realtime' && path[2] === 'ticket' && request.method === 'POST') {""",
    """    if (path[1] === 'profile') {
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
    if (path[1] === 'realtime' && path[2] === 'ticket' && request.method === 'POST') {""",
)

p.write_text(t)
print("patched worker")
