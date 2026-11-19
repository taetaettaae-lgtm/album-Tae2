/* ============================================================
   คลังอัลบั้มรูป — เซิร์ฟเวอร์ Node.js ตัวเดียว (ไม่ต้อง npm install)
   รัน: node server.js แล้วเปิด http://localhost:3000
   เก็บข้อมูล: data/albums.json (เมตาดาต้า) + uploads/ (ไฟล์รูป)
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');
const ALBUMS_FILE = path.join(DATA_DIR, 'albums.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const MAX_BODY = 150 * 1024 * 1024; // 150 MB ต่อครั้ง (อัปโหลดหลายรูปพร้อมกันเป็น base64)

[DATA_DIR, UPLOAD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const extOf = type => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' })[type] || 'img';

/* ---------- config (รหัสผู้ดูแล แฮช SHA-256) ---------- */
let config;
try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
catch (e) { config = { passcodeHash: sha256('admin123') }; fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); }

/* ---------- albums ---------- */
let albums = [];
try { albums = JSON.parse(fs.readFileSync(ALBUMS_FILE, 'utf8')); } catch (e) { albums = []; }
const saveAlbums = () => fs.writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2));
const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

const isAdmin = pass => pass && sha256(String(pass)) === config.passcodeHash;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const sendJSON = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
};
const readBody = req => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('TOO_LARGE')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

/* ---------- API handlers ---------- */
async function handleAPI(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const method = req.method;

  // POST /api/admin/login
  if (method === 'POST' && parts[1] === 'admin' && parts[2] === 'login') {
    const body = JSON.parse(await readBody(req));
    if (isAdmin(body.passcode)) return sendJSON(res, 200, { ok: true });
    return sendJSON(res, 401, { ok: false, error: 'รหัสไม่ถูกต้อง' });
  }
  // POST /api/admin/passcode (เปลี่ยนรหัส)
  if (method === 'POST' && parts[1] === 'admin' && parts[2] === 'passcode') {
    const body = JSON.parse(await readBody(req));
    if (!isAdmin(body.oldPass)) return sendJSON(res, 401, { error: 'รหัสเดิมไม่ถูกต้อง' });
    if (!body.newPass || String(body.newPass).length < 4) return sendJSON(res, 400, { error: 'รหัสใหม่ต้องอย่างน้อย 4 ตัวอักษร' });
    config.passcodeHash = sha256(String(body.newPass)); saveConfig();
    return sendJSON(res, 200, { ok: true });
  }

  // GET /api/albums (รายการอัลบั้ม สาธารณะ)
  if (method === 'GET' && parts[1] === 'albums' && parts.length === 2) {
    const list = albums.slice().sort((a, b) => b.createdAt - a.createdAt).map(a => ({
      id: a.id, name: a.name, desc: a.desc, createdAt: a.createdAt,
      count: a.images.length,
      totalSize: a.images.reduce((s, i) => s + i.size, 0),
      cover: a.images.length ? '/uploads/' + a.images[0].file : null
    }));
    return sendJSON(res, 200, { albums: list });
  }

  // GET /api/albums/:id (รายละเอียดอัลบั้ม รวมรูป สาธารณะ)
  if (method === 'GET' && parts[1] === 'albums' && parts.length === 3) {
    const a = albums.find(x => x.id === parts[2]);
    if (!a) return sendJSON(res, 404, { error: 'ไม่พบอัลบั้ม' });
    return sendJSON(res, 200, { album: a });
  }

  // POST /api/albums (สร้างอัลบั้ม — ผู้ดูแล)
  if (method === 'POST' && parts[1] === 'albums' && parts.length === 2) {
    const body = JSON.parse(await readBody(req));
    if (!isAdmin(body.passcode)) return sendJSON(res, 401, { error: 'ต้องเข้าสู่ระบบผู้ดูแล' });
    if (!body.name || !String(body.name).trim()) return sendJSON(res, 400, { error: 'ต้องป้อนชื่ออัลบั้ม' });
    const a = { id: uid(), name: String(body.name).trim(), desc: String(body.desc || '').trim(), createdAt: Date.now(), images: [] };
    albums.push(a); saveAlbums();
    return sendJSON(res, 200, { album: a });
  }

  // DELETE /api/albums/:id (ลบอัลบั้ม — ผู้ดูแล)
  if (method === 'DELETE' && parts[1] === 'albums' && parts.length === 3) {
    const body = JSON.parse(await readBody(req));
    if (!isAdmin(body.passcode)) return sendJSON(res, 401, { error: 'ต้องเข้าสู่ระบบผู้ดูแล' });
    const idx = albums.findIndex(x => x.id === parts[2]);
    if (idx < 0) return sendJSON(res, 404, { error: 'ไม่พบอัลบั้ม' });
    albums[idx].images.forEach(im => { try { fs.unlinkSync(path.join(UPLOAD_DIR, im.file)); } catch (e) {} });
    albums.splice(idx, 1); saveAlbums();
    return sendJSON(res, 200, { ok: true });
  }

  // POST /api/albums/:id/images (อัปโหลดรูป — ผู้ดูแล)  body: {passcode, images:[{name,caption,type,dataUrl}]}
  if (method === 'POST' && parts[1] === 'albums' && parts[2] && parts[3] === 'images' && parts.length === 4) {
    const a = albums.find(x => x.id === parts[2]);
    if (!a) return sendJSON(res, 404, { error: 'ไม่พบอัลบั้ม' });
    const body = JSON.parse(await readBody(req));
    if (!isAdmin(body.passcode)) return sendJSON(res, 401, { error: 'ต้องเข้าสู่ระบบผู้ดูแล' });
    const imgs = Array.isArray(body.images) ? body.images : [];
    let ok = 0;
    for (const it of imgs) {
      try {
        if (!it.dataUrl || !String(it.dataUrl).startsWith('data:image')) continue;
        const [head, b64] = it.dataUrl.split(',');
        const mime = (head.match(/data:(.*?);/) || [])[1] || 'image/png';
        const file = uid() + '.' + extOf(mime);
        fs.writeFileSync(path.join(UPLOAD_DIR, file), Buffer.from(b64, 'base64'));
        const size = fs.statSync(path.join(UPLOAD_DIR, file)).size;
        a.images.push({ id: uid(), name: it.name || 'รูปภาพ', caption: it.caption || it.name || 'รูปภาพ', type: mime, file, size, addedAt: Date.now() });
        ok++;
      } catch (e) { console.error('upload error', e.message); }
    }
    saveAlbums();
    return sendJSON(res, 200, { ok, album: a });
  }

  // PATCH /api/albums/:id/images/:imgId (แก้ไขคำอธิบาย — ผู้ดูแล)
  if (method === 'PATCH' && parts[1] === 'albums' && parts[3] === 'images' && parts.length === 5) {
    const a = albums.find(x => x.id === parts[2]);
    if (!a) return sendJSON(res, 404, { error: 'ไม่พบอัลบั้ม' });
    const body = JSON.parse(await readBody(req));
    if (!isAdmin(body.passcode)) return sendJSON(res, 401, { error: 'ต้องเข้าสู่ระบบผู้ดูแล' });
    const im = a.images.find(x => x.id === parts[4]);
    if (im) { im.caption = String(body.caption || im.name).trim() || im.name; saveAlbums(); }
    return sendJSON(res, 200, { ok: true });
  }

  // DELETE /api/albums/:id/images/:imgId (ลบรูป — ผู้ดูแล)
  if (method === 'DELETE' && parts[1] === 'albums' && parts[3] === 'images' && parts.length === 5) {
    const a = albums.find(x => x.id === parts[2]);
    if (!a) return sendJSON(res, 404, { error: 'ไม่พบอัลบั้ม' });
    const body = JSON.parse(await readBody(req));
    if (!isAdmin(body.passcode)) return sendJSON(res, 401, { error: 'ต้องเข้าสู่ระบบผู้ดูแล' });
    const idx = a.images.findIndex(x => x.id === parts[4]);
    if (idx >= 0) { try { fs.unlinkSync(path.join(UPLOAD_DIR, a.images[idx].file)); } catch (e) {} a.images.splice(idx, 1); saveAlbums(); }
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 404, { error: 'ไม่พบ API' });
}

/* ---------- static file ---------- */
function serveStatic(res, filePath, baseDir) {
  if (!filePath.startsWith(baseDir)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not Found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleAPI(req, res, url);
    if (url.pathname.startsWith('/uploads/')) {
      const f = path.join(UPLOAD_DIR, path.basename(url.pathname));
      return serveStatic(res, f, UPLOAD_DIR);
    }
    // static public
    let rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const f = path.join(PUBLIC_DIR, rel);
    return serveStatic(res, f, PUBLIC_DIR);
  } catch (e) {
    if (e.message === 'TOO_LARGE') return sendJSON(res, 413, { error: 'ไฟล์มีขนาดใหญ่เกินไป' });
    console.error('ERR', e.message);
    sendJSON(res, 500, { error: 'Server error: ' + e.message });
  }
});

server.listen(PORT, () => {
  console.log('==============================================');
  console.log(' คลังอัลบั้มรูป — เซิร์ฟเวอร์รันแล้ว');
  console.log(' เปิด: http://localhost:' + PORT);
  console.log(' รหัสผู้ดูแลเริ่มต้น: admin123 (แนะนำให้เปลี่ยน)');
  console.log(' ข้อมูลเก็บที่: data/ + uploads/');
  console.log('==============================================');
});
