const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory database ────────────────────────────────────────────────────────
const db = {
  users: new Map(),   // id → user
  posts: new Map(),   // id → post
  comments: new Map(),   // id → comment
  likes: new Set(),   // "userId:postId"
  follows: new Set(),   // "followerId:followedId"
  sessions: new Map(),   // token → userId
};

// Seed demo data
(function seed() {
  const users = [
    { id: 'u1', username: 'aurora_nova', name: 'Aurora Nova', bio: 'Chasing light & pixels 🌅', avatar: 'AN', color: '#7c3aed', joined: Date.now() - 864e5 * 30 },
    { id: 'u2', username: 'felix_storm', name: 'Felix Storm', bio: 'Designer × Developer', avatar: 'FS', color: '#0ea5e9', joined: Date.now() - 864e5 * 20 },
    { id: 'u3', username: 'mira_bloom', name: 'Mira Bloom', bio: 'Coffee & code ☕', avatar: 'MB', color: '#10b981', joined: Date.now() - 864e5 * 10 },
  ];
  users.forEach(u => { u.password = hash('password123'); db.users.set(u.id, u); });

  const posts = [
    { id: 'p1', userId: 'u1', content: "Just shipped a new feature 🚀 Six months of work, countless iterations, and it's finally live. The feeling never gets old.", createdAt: Date.now() - 36e5 * 5,  image: null },
    { id: 'p2', userId: 'u2', content: "Design tip: white space isn't wasted space. It's breathing room that makes everything else shine. ✨", createdAt: Date.now() - 36e5 * 12, image: null },
    { id: 'p3', userId: 'u3', content: "Hot take: the best debugging tool is a good night's sleep. Come back with fresh eyes and the bug reveals itself. 💤", createdAt: Date.now() - 36e5 * 24, image: null },
    { id: 'p4', userId: 'u1', content: "The sunrise this morning was unreal 🌄 Sometimes you need to step away from the screen and remember why you build things in the first place.", createdAt: Date.now() - 36e5 * 48, image: null },
  ];
  posts.forEach(p => db.posts.set(p.id, p));

  const comments = [
    { id: 'c1', postId: 'p1', userId: 'u2', content: 'Congrats! This is huge 🎉', createdAt: Date.now() - 36e5 * 4 },
    { id: 'c2', postId: 'p1', userId: 'u3', content: "Can't wait to try it out!", createdAt: Date.now() - 36e5 * 3 },
    { id: 'c3', postId: 'p2', userId: 'u1', content: 'Such a timeless principle. Bookmarking this.', createdAt: Date.now() - 36e5 * 10 },
    { id: 'c4', postId: 'p3', userId: 'u2', content: 'This saved me last week, 100%', createdAt: Date.now() - 36e5 * 22 },
  ];
  comments.forEach(c => db.comments.set(c.id, c));

  db.likes.add('u2:p1'); db.likes.add('u3:p1'); db.likes.add('u1:p2');
  db.likes.add('u3:p2'); db.likes.add('u1:p3'); db.likes.add('u2:p4');

  db.follows.add('u1:u2'); db.follows.add('u1:u3');
  db.follows.add('u2:u1'); db.follows.add('u3:u1');
})();

// ── Helpers ───────────────────────────────────────────────────────────────────
function hash(str) { return crypto.createHash('sha256').update(str).digest('hex'); }
function uid() { return crypto.randomBytes(8).toString('hex'); }
function token() { return crypto.randomBytes(32).toString('hex'); }

function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const userId = db.sessions.get(t);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = userId;
  next();
}

function enrichPost(post, viewerId) {
  const user = db.users.get(post.userId);
  const commentList = [...db.comments.values()]
    .filter(c => c.postId === post.id)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(c => ({ ...c, user: safeUser(db.users.get(c.userId)) }));
  return {
    ...post,
    user: safeUser(user),
    likes: [...db.likes].filter(k => k.endsWith(':' + post.id)).length,
    liked: viewerId ? db.likes.has(`${viewerId}:${post.id}`) : false,
    comments: commentList,
  };
}

function safeUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

function enrichUser(u, viewerId) {
  const safe = safeUser(u);
  return {
    ...safe,
    followers: [...db.follows].filter(k => k.endsWith(':' + u.id)).length,
    following: [...db.follows].filter(k => k.startsWith(u.id + ':')).length,
    isFollowing: viewerId ? db.follows.has(`${viewerId}:${u.id}`) : false,
    postCount: [...db.posts.values()].filter(p => p.userId === u.id).length,
  };
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { username, name, email, password } = req.body;
  if (!username || !name || !password) return res.status(400).json({ error: 'Missing fields' });
  if ([...db.users.values()].find(u => u.username === username))
    return res.status(409).json({ error: 'Username taken' });

  const colors = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const user = {
    id: 'u' + uid(), username, name,
    bio: '', avatar: initials,
    color: colors[Math.floor(Math.random() * colors.length)],
    joined: Date.now(), password: hash(password),
  };
  db.users.set(user.id, user);
  const t = token();
  db.sessions.set(t, user.id);
  res.json({ token: t, user: safeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = [...db.users.values()].find(u => u.username === username);
  if (!user || user.password !== hash(password))
    return res.status(401).json({ error: 'Invalid credentials' });
  const t = token();
  db.sessions.set(t, user.id);
  res.json({ token: t, user: safeUser(user) });
});

app.post('/api/auth/logout', auth, (req, res) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  db.sessions.delete(t);
  res.json({ ok: true });
});

// ── User routes ───────────────────────────────────────────────────────────────
app.get('/api/me', auth, (req, res) => {
  res.json(enrichUser(db.users.get(req.userId), req.userId));
});

app.patch('/api/me', auth, (req, res) => {
  const user = db.users.get(req.userId);
  const { name, bio } = req.body;
  if (name) user.name = name;
  if (bio !== undefined) user.bio = bio;
  db.users.set(user.id, user);
  res.json(safeUser(user));
});

app.get('/api/users/:username', (req, res) => {
  const viewerId = db.sessions.get((req.headers.authorization || '').replace('Bearer ', ''));
  const user = [...db.users.values()].find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(enrichUser(user, viewerId));
});

app.get('/api/users/:username/posts', (req, res) => {
  const viewerId = db.sessions.get((req.headers.authorization || '').replace('Bearer ', ''));
  const user = [...db.users.values()].find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const posts = [...db.posts.values()]
    .filter(p => p.userId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(p => enrichPost(p, viewerId));
  res.json(posts);
});

app.post('/api/users/:id/follow', auth, (req, res) => {
  const key = `${req.userId}:${req.params.id}`;
  if (req.userId === req.params.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  if (!db.users.has(req.params.id)) return res.status(404).json({ error: 'User not found' });
  if (db.follows.has(key)) { db.follows.delete(key); return res.json({ following: false }); }
  db.follows.add(key);
  res.json({ following: true });
});

app.get('/api/users', (req, res) => {
  const viewerId = db.sessions.get((req.headers.authorization || '').replace('Bearer ', ''));
  const q = (req.query.q || '').toLowerCase();
  let users = [...db.users.values()];
  if (q) users = users.filter(u => u.username.includes(q) || u.name.toLowerCase().includes(q));
  res.json(users.slice(0, 20).map(u => enrichUser(u, viewerId)));
});

// ── Post routes ───────────────────────────────────────────────────────────────
app.get('/api/feed', auth, (req, res) => {
  const following = [...db.follows]
    .filter(k => k.startsWith(req.userId + ':'))
    .map(k => k.split(':')[1]);
  const ids = [req.userId, ...following];
  const posts = [...db.posts.values()]
    .filter(p => ids.includes(p.userId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(p => enrichPost(p, req.userId));
  res.json(posts);
});

app.get('/api/posts', (req, res) => {
  const viewerId = db.sessions.get((req.headers.authorization || '').replace('Bearer ', ''));
  const posts = [...db.posts.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(p => enrichPost(p, viewerId));
  res.json(posts);
});

app.post('/api/posts', auth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  const post = { id: 'p' + uid(), userId: req.userId, content: content.trim(), createdAt: Date.now(), image: null };
  db.posts.set(post.id, post);
  res.status(201).json(enrichPost(post, req.userId));
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const post = db.posts.get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  if (post.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  db.posts.delete(post.id);
  [...db.comments.values()].filter(c => c.postId === post.id).forEach(c => db.comments.delete(c.id));
  [...db.likes].filter(k => k.endsWith(':' + post.id)).forEach(k => db.likes.delete(k));
  res.json({ ok: true });
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  if (!db.posts.has(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const key = `${req.userId}:${req.params.id}`;
  if (db.likes.has(key)) { db.likes.delete(key); return res.json({ liked: false }); }
  db.likes.add(key);
  res.json({ liked: true });
});

// ── Comment routes ────────────────────────────────────────────────────────────
app.post('/api/posts/:id/comments', auth, (req, res) => {
  if (!db.posts.has(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  const comment = { id: 'c' + uid(), postId: req.params.id, userId: req.userId, content: content.trim(), createdAt: Date.now() };
  db.comments.set(comment.id, comment);
  res.status(201).json({ ...comment, user: safeUser(db.users.get(req.userId)) });
});

app.delete('/api/comments/:id', auth, (req, res) => {
  const comment = db.comments.get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  db.comments.delete(comment.id);
  res.json({ ok: true });
});

// ── Catch-all → SPA ──────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`✅  Server running → http://localhost:${PORT}`));
module.exports = app;
