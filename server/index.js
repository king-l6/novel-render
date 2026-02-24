const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'novel-reader.db');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db = null;

function get(sql, ...params) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (stmt.step()) return stmt.getAsObject();
    return null;
  } finally {
    stmt.free();
  }
}

function all(sql, ...params) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function run(sql, ...params) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }
  const lastId = get('SELECT last_insert_rowid() as id');
  const changes = get('SELECT changes() as c');
  saveDb();
  return {
    lastInsertRowid: lastId?.id ?? 0,
    changes: changes?.c ?? 0,
  };
}

function saveDb() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('Save DB error:', e.message);
  }
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: '未登录' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: '未登录' });
  const u = get('SELECT is_admin FROM users WHERE id = ?', req.session.userId);
  if (!u || !u.is_admin) return res.status(403).json({ error: '需要管理员权限' });
  next();
}

// 允许浏览器从任意来源访问 API（解决 Failed to fetch）
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'novel-reader-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// ----- Auth -----
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '缺少用户名或密码' });
  const user = get('SELECT id, username, password_hash, is_admin FROM users WHERE username = ?', username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.isAdmin = !!user.is_admin;
  res.json({ username: user.username, isAdmin: !!user.is_admin });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: '未登录' });
  const user = get('SELECT username, is_admin FROM users WHERE id = ?', req.session.userId);
  if (!user) return res.status(401).json({ error: '未登录' });
  res.json({ username: user.username, isAdmin: !!user.is_admin });
});

// ----- Books (current user) -----
app.get('/api/books', requireAuth, (req, res) => {
  const rows = all(
    `SELECT b.id, b.title, b.file_name, b.size, b.created_at,
      p.scroll_top, p.percent, p.page_index, p.updated_at as progress_updated
     FROM books b
     LEFT JOIN progress p ON p.book_id = b.id AND p.user_id = ?
     WHERE b.user_id = ?
     ORDER BY COALESCE(p.updated_at, b.created_at) DESC`,
    req.session.userId,
    req.session.userId
  );
  res.json(rows);
});

app.post('/api/books', requireAuth, (req, res) => {
  const { title, file_name, content, size } = req.body || {};
  if (!title || !file_name || content == null) return res.status(400).json({ error: '缺少 title / file_name / content' });
  const r = run(
    'INSERT INTO books (user_id, title, file_name, content, size, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    req.session.userId,
    title || file_name.replace(/\.txt$/i, ''),
    file_name,
    String(content),
    Number(size) || 0,
    Date.now()
  );
  res.status(201).json({ id: r.lastInsertRowid, title, file_name, size: Number(size) || 0 });
});

app.get('/api/books/:id', requireAuth, (req, res) => {
  const row = get('SELECT id, title, file_name, content, size, created_at FROM books WHERE id = ? AND user_id = ?', req.params.id, req.session.userId);
  if (!row) return res.status(404).json({ error: '书籍不存在' });
  const progress = get('SELECT scroll_top, percent, page_index FROM progress WHERE user_id = ? AND book_id = ?', req.session.userId, row.id);
  res.json({ ...row, progress: progress || null });
});

app.put('/api/books/:id/progress', requireAuth, (req, res) => {
  const { scroll_top, percent, page_index } = req.body || {};
  const book = get('SELECT id FROM books WHERE id = ? AND user_id = ?', req.params.id, req.session.userId);
  if (!book) return res.status(404).json({ error: '书籍不存在' });
  const now = Date.now();
  run(
    `INSERT INTO progress (user_id, book_id, scroll_top, percent, page_index, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, book_id) DO UPDATE SET scroll_top=excluded.scroll_top, percent=excluded.percent, page_index=excluded.page_index, updated_at=excluded.updated_at`,
    req.session.userId,
    book.id,
    Number(scroll_top) || 0,
    Number(percent) || 0,
    Number(page_index) || 0,
    now
  );
  res.json({ ok: true });
});

app.delete('/api/books/:id', requireAuth, (req, res) => {
  const r = run('DELETE FROM books WHERE id = ? AND user_id = ?', req.params.id, req.session.userId);
  if (r.changes === 0) return res.status(404).json({ error: '书籍不存在' });
  res.json({ ok: true });
});

// ----- Admin: users -----
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const rows = all('SELECT id, username, is_admin, created_at FROM users ORDER BY id');
  res.json(rows);
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { username, password, is_admin } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '缺少 username 或 password' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const r = run('INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?)', username, hash, is_admin ? 1 : 0, Date.now());
    res.status(201).json({ id: r.lastInsertRowid, username, is_admin: !!is_admin });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(400).json({ error: '用户名已存在' });
    throw e;
  }
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const { username, password, is_admin } = req.body || {};
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: '无效用户 id' });
  const updates = [];
  const params = [];
  if (username !== undefined) {
    updates.push('username = ?');
    params.push(username);
  }
  if (password !== undefined && password !== '') {
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(password, 10));
  }
  if (is_admin !== undefined) {
    updates.push('is_admin = ?');
    params.push(is_admin ? 1 : 0);
  }
  if (updates.length === 0) return res.status(400).json({ error: '无更新字段' });
  params.push(id);
  const r = run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, ...params);
  if (r.changes === 0) return res.status(404).json({ error: '用户不存在' });
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.session.userId) return res.status(400).json({ error: '不能删除自己' });
  const r = run('DELETE FROM users WHERE id = ?', id);
  if (r.changes === 0) return res.status(404).json({ error: '用户不存在' });
  res.json({ ok: true });
});

// ----- Admin: user's books -----
app.get('/api/admin/users/:userId/books', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const rows = all(
    `SELECT b.id, b.title, b.file_name, b.size, b.created_at,
      p.percent, p.updated_at as progress_updated
     FROM books b
     LEFT JOIN progress p ON p.book_id = b.id AND p.user_id = b.user_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`,
    userId
  );
  res.json(rows);
});

app.delete('/api/admin/books/:id', requireAdmin, (req, res) => {
  const r = run('DELETE FROM books WHERE id = ?', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: '书籍不存在' });
  res.json({ ok: true });
});

// 健康检查：访问 http://localhost:3000/api/health 可确认服务是否在跑
app.get('/api/health', (req, res) => res.json({ ok: true, message: 'novel-reader server is running' }));

// 前端：仅使用 Vue 构建产物（frontend/dist）
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const useVue = fs.existsSync(frontendDist);

function sendVueIndex(_, res) {
  res.sendFile(path.join(frontendDist, 'index.html'));
}

if (useVue) {
  app.get('/', sendVueIndex);
  app.get('/login', sendVueIndex);
  app.get('/bookshelf', sendVueIndex);
  app.get('/reader/:id', sendVueIndex);
  app.use(express.static(frontendDist));
} else {
  const needBuild = (_, res) => {
    res.type('html').status(503).send(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>请先构建前端</title></head><body><p>请先构建前端：<code>pnpm run build</code></p><p>或开发时同时运行：终端1 <code>pnpm start</code>，终端2 <code>pnpm run dev:frontend</code>，访问 <a href="http://localhost:5173">http://localhost:5173</a></p></body></html>'
    );
  };
  app.get('/', needBuild);
  app.get('/login', needBuild);
  app.get('/bookshelf', needBuild);
  app.get('/reader/:id', needBuild);
}

async function start() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      scroll_top INTEGER DEFAULT 0,
      percent INTEGER DEFAULT 0,
      page_index INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, book_id)
    );
    CREATE INDEX IF NOT EXISTS idx_books_user ON books(user_id);
    CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
  `);
  saveDb();

  const adminExists = get('SELECT 1 FROM users WHERE username = ?', 'admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    run('INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, 1, ?)', 'admin', hash, Date.now());
    console.log('Created default admin: username=admin, password=admin123');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Novel Reader server is running. Open in browser:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  http://127.0.0.1:${PORT}`);
    console.log(`  http://local.bilibili.co:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
