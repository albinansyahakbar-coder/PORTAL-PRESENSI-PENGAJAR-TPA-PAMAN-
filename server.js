const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 7860;
const DB_FILE = path.join(__dirname, 'data.json');
const JAM_BATAS_MASUK = '17:45';

/* ================= DATABASE (JSON) ================= */
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const db = {
      users: [
        { id: 1, nama: 'Administrator', username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'admin' },
        { id: 2, nama: 'Ustadz Ahmad Fauzi', username: 'guru1', password: bcrypt.hashSync('guru123', 10), role: 'guru' },
        { id: 3, nama: 'Ustadzah Fatimah', username: 'guru2', password: bcrypt.hashSync('guru123', 10), role: 'guru' }
      ],
      presensi: [],
      nextUserId: 4,
      nextPresensiId: 1
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

/* ================= HELPER ================= */
function nowWIB() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const p = {};
  fmt.formatToParts(new Date()).forEach(x => p[x.type] = x.value);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}:${p.second}`
  };
}
const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
function tglPendek(iso) {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)} ${BULAN[parseInt(m) - 1]} ${y}`;
}
function hariDari(iso) {
  return HARI[new Date(iso + 'T00:00:00').getDay()];
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ================= MIDDLEWARE ================= */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'tpa-presensi-rahasia-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

function auth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function adminOnly(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin')
    return res.status(403).send(page(req, 'Akses Ditolak', '',
      '<div class="card"><h2>403 - Akses Ditolak</h2><p>Halaman ini hanya untuk admin.</p></div>'));
  next();
}

/* ================= LAYOUT ================= */
function page(req, title, active, body) {
  const u = req.session.user;
  const flash = req.session.flash;
  if (flash) delete req.session.flash;

  const nav = u ? `
  <nav class="navbar">
    <div class="brand"><span>🕌</span> Portal Presensi Pengajar TPA Paman</div>
    <div class="nav-links">
      <a href="/" class="${active === 'home' ? 'active' : ''}">Dashboard</a>
      <a href="/riwayat" class="${active === 'riwayat' ? 'active' : ''}">Riwayat</a>
      ${u.role === 'admin' ? `<a href="/pengajar" class="${active === 'pengajar' ? 'active' : ''}">Kelola Pengajar</a>` : ''}
      <a href="/password" class="${active === 'password' ? 'active' : ''}">Ganti Password</a>
      <a href="/logout" class="logout">Keluar</a>
    </div>
  </nav>` : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Portal Presensi Pengajar TPA Paman</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       background:linear-gradient(135deg,#eef2ff 0%,#ecfdf5 100%);color:#1a202c;min-height:100vh}
  a{color:inherit;text-decoration:none}
  .navbar{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.07);padding:12px 20px;
          display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;
          position:sticky;top:0;z-index:10}
  .brand{font-weight:700;color:#065f46;font-size:16px;display:flex;align-items:center;gap:8px}
  .brand span{font-size:22px}
  .nav-links{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
  .nav-links a{padding:8px 13px;border-radius:8px;font-size:13.5px;font-weight:500;
               color:#475569;transition:.18s}
  .nav-links a:hover{background:#f1f5f9;color:#065f46}
  .nav-links a.active{background:#d1fae5;color:#065f46}
  .nav-links a.logout{background:#fee2e2;color:#b91c1c}
  .nav-links a.logout:hover{background:#fecaca}
  .container{max-width:1000px;margin:0 auto;padding:24px 16px 60px}
  .page-title{font-size:22px;font-weight:700;margin-bottom:4px;color:#0f172a}
  .page-sub{color:#64748b;font-size:14px;margin-bottom:20px}
  .card{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:16px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px}
  .stat{background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 10px rgba(15,23,42,.06);
        border-left:4px solid #10b981}
  .stat .lbl{font-size:12.5px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;font-weight:600}
  .stat .val{font-size:30px;font-weight:800;color:#065f46;margin-top:6px}
  .stat.blue{border-left-color:#3b82f6}.stat.blue .val{color:#1d4ed8}
  .stat.amber{border-left-color:#f59e0b}.stat.amber .val{color:#b45309}
  .stat.red{border-left-color:#ef4444}.stat.red .val{color:#b91c1c}
  .btn{display:inline-block;padding:11px 20px;border-radius:10px;border:none;font-size:14px;
       font-weight:600;cursor:pointer;transition:.18s;font-family:inherit}
  .btn-primary{background:#059669;color:#fff}
  .btn-primary:hover{background:#047857}
  .btn-danger{background:#dc2626;color:#fff}
  .btn-danger:hover{background:#b91c1c}
  .btn-secondary{background:#e2e8f0;color:#334155}
  .btn-secondary:hover{background:#cbd5e1}
  .btn-lg{padding:15px 32px;font-size:16px;width:100%;max-width:320px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{padding:11px 10px;text-align:left;border-bottom:1px solid #f1f5f9}
  th{background:#f8fafc;font-weight:600;color:#475569;font-size:12.5px;
     text-transform:uppercase;letter-spacing:.3px}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#fafcff}
  .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11.5px;font-weight:700}
  .badge-green{background:#d1fae5;color:#065f46}
  .badge-amber{background:#fef3c7;color:#92400e}
  .badge-red{background:#fee2e2;color:#991b1b}
  .badge-gray{background:#e2e8f0;color:#475569}
  input[type=text],input[type=password],select{
    width:100%;padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;
    font-size:14px;font-family:inherit;outline:none;transition:.18s;background:#fff}
  input:focus,select:focus{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.12)}
  label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:6px}
  .form-group{margin-bottom:14px}
  .flash{padding:12px 16px;border-radius:10px;margin-bottom:16px;font-size:14px;font-weight:500}
  .flash.ok{background:#d1fae5;color:#065f46;border-left:4px solid #10b981}
  .flash.err{background:#fee2e2;color:#991b1b;border-left:4px solid #ef4444}
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .login-box{background:#fff;border-radius:18px;padding:36px 30px;width:100%;max-width:400px;
             box-shadow:0 10px 40px rgba(15,23,42,.1)}
  .login-logo{text-align:center;font-size:48px;margin-bottom:8px}
  .login-box h1{text-align:center;font-size:21px;color:#065f46;margin-bottom:4px}
  .login-box p.sub{text-align:center;color:#94a3b8;font-size:13px;margin-bottom:26px}
  .empty{text-align:center;padding:36px 16px;color:#94a3b8;font-size:14px}
  .time-box{background:#ecfdf5;border:1.5px dashed #6ee7b7;border-radius:12px;
            padding:20px;text-align:center;margin-bottom:16px}
  .time-box .t{font-size:34px;font-weight:800;color:#065f46;letter-spacing:1px;font-variant-numeric:tabular-nums}
  .time-box .d{color:#059669;font-size:13px;margin-top:4px;font-weight:500}
  .actions{display:flex;gap:12px;flex-wrap:wrap}
  .card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;flex-wrap:wrap}
  .card-head h3{margin:0;font-size:16px}
  @media(max-width:600px){
    .navbar{flex-direction:column;align-items:stretch}
    .nav-links{justify-content:center}
    .nav-links a{padding:7px 10px;font-size:12.5px}
    th,td{padding:9px 6px;font-size:12.5px}
    .stat .val{font-size:24px}
  }
</style>
</head>
<body>
${nav}
${flash ? `<div class="container" style="padding-bottom:0"><div class="flash ${flash.type}">${esc(flash.msg)}</div></div>` : ''}
${body}
</body>
</html>`;
}

/* ================= ROUTES ================= */

// --- LOGIN ---
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.send(page(req, 'Masuk', '', `
  <div class="login-wrap">
    <div class="login-box">
      <div class="login-logo">🕌</div>
      <h1>Portal Presensi Pengajar TPA Paman</h1>
      <p class="sub">Silakan masuk untuk melanjutkan</p>
      <form method="POST" action="/login">
        <div class="form-group">
          <label>Username</label>
          <input type="text" name="username" required autofocus placeholder="contoh: guru1">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" required placeholder="••••••••">
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;padding:13px">Masuk</button>
      </form>
      <p style="text-align:center;color:#cbd5e1;font-size:12px;margin-top:22px">
        &copy; ${new Date().getFullYear()} Portal Presensi Pengajar TPA Paman
      </p>
    </div>
  </div>`));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    req.session.flash = { type: 'err', msg: 'Username atau password salah!' };
    return res.redirect('/login');
  }
  req.session.user = { id: user.id, nama: user.nama, username: user.username, role: user.role };
  req.session.flash = { type: 'ok', msg: `Selamat datang, ${user.nama}!` };
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// --- DASHBOARD ---
app.get('/', auth, (req, res) => {
  const db = loadDB();
  const u = req.session.user;
  const { date, time } = nowWIB();

  if (u.role === 'admin') {
    const hariIni = db.presensi.filter(p => p.tanggal === date);
    const guruList = db.users.filter(x => x.role === 'guru');
    const totalGuru = guruList.length;
    const hadir = hariIni.length;
    const terlambat = hariIni.filter(p => p.terlambat).length;
    const belum = totalGuru - hadir;
    const totalRiwayat = db.presensi.length;

    const rows = guruList.map(g => {
      const p = hariIni.find(x => x.userId === g.id);
      let status = '<span class="badge badge-gray">Belum Presensi</span>';
      if (p) {
        status = p.terlambat
          ? '<span class="badge badge-amber">Terlambat</span>'
          : '<span class="badge badge-green">Hadir</span>';
      }
      return `<tr>
        <td>${esc(g.nama)}</td>
        <td>${p ? p.jamMasuk : '-'}</td>
        <td>${p && p.jamPulang ? p.jamPulang : '-'}</td>
        <td>${status}</td>
      </tr>`;
    }).join('');

    res.send(page(req, 'Dashboard Admin', 'home', `
    <div class="container">
      <div class="page-title">Dashboard Admin</div>
      <div class="page-sub">${hariDari(date)}, ${tglPendek(date)} — Pukul ${time} WIB</div>

      <div class="grid">
        <div class="stat blue"><div class="lbl">Total Pengajar</div><div class="val">${totalGuru}</div></div>
        <div class="stat"><div class="lbl">Hadir Hari Ini</div><div class="val">${hadir}</div></div>
        <div class="stat amber"><div class="lbl">Terlambat</div><div class="val">${terlambat}</div></div>
        <div class="stat red"><div class="lbl">Belum Presensi</div><div class="val">${belum}</div></div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Presensi Pengajar Hari Ini</h3>
          <span style="color:#94a3b8;font-size:12.5px">Total riwayat tersimpan: <b>${totalRiwayat}</b></span>
        </div>
        ${guruList.length === 0
          ? '<div class="empty">Belum ada data pengajar.</div>'
          : `<div style="overflow-x:auto"><table>
              <thead><tr><th>Nama</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr></thead>
              <tbody>${rows}</tbody>
             </table></div>`}
      </div>

      <div class="card" style="border-left:4px solid #ef4444">
        <div class="card-head">
          <h3 style="color:#b91c1c">⚠️ Zona Berbahaya (Admin Only)</h3>
        </div>
        <p style="color:#64748b;font-size:13.5px;margin-bottom:14px;line-height:1.7">
          Tombol di bawah ini akan <b>menghapus SEMUA riwayat presensi</b> dari seluruh pengajar, 
          baik data hari ini maupun hari-hari sebelumnya. Data yang sudah dihapus <b>tidak dapat dikembalikan</b>. 
          Gunakan hanya di akhir periode (misal akhir semester atau akhir tahun ajaran).
        </p>
        <form method="POST" action="/admin/reset-riwayat" onsubmit="return confirm('⚠️ PERINGATAN KERAS!\\n\\nAnda akan menghapus SEMUA riwayat presensi dari seluruh pengajar.\\n\\nData yang dihapus TIDAK BISA dikembalikan!\\n\\nYakin ingin melanjutkan?')">
          <button type="submit" class="btn btn-danger">🗑️ Reset Semua Riwayat Presensi</button>
        </form>
      </div>
    </div>`));
    return;
  }

  // Dashboard Guru
  const rec = db.presensi.find(p => p.userId === u.id && p.tanggal === date);
  let aksi = '';
  if (!rec) {
    aksi = `<form method="POST" action="/presensi/masuk">
      <button type="submit" class="btn btn-primary btn-lg">✅ Presensi Masuk</button>
    </form>`;
  } else if (!rec.jamPulang) {
    aksi = `<form method="POST" action="/presensi/pulang">
      <button type="submit" class="btn btn-danger btn-lg">🏠 Presensi Pulang</button>
    </form>`;
  } else {
    aksi = `<div class="flash ok" style="margin:0">Presensi hari ini sudah lengkap. Terima kasih! 🙏</div>`;
  }

  res.send(page(req, 'Dashboard', 'home', `
  <div class="container">
    <div class="page-title">Assalamu'alaikum, ${esc(u.nama)}</div>
    <div class="page-sub">${hariDari(date)}, ${tglPendek(date)}</div>

    <div class="card">
      <div class="time-box">
        <div class="t" id="clock">${time}</div>
        <div class="d">Waktu Indonesia Barat (WIB)</div>
      </div>

      <div class="grid" style="margin-bottom:16px">
        <div class="stat"><div class="lbl">Jam Masuk</div><div class="val" style="font-size:22px">${rec ? rec.jamMasuk : '--:--'}</div></div>
        <div class="stat ${rec && rec.terlambat ? 'amber' : ''}"><div class="lbl">Jam Pulang</div><div class="val" style="font-size:22px">${rec && rec.jamPulang ? rec.jamPulang : '--:--'}</div></div>
        <div class="stat ${rec && rec.terlambat ? 'amber' : 'blue'}"><div class="lbl">Status</div><div class="val" style="font-size:18px">${
          !rec ? 'Belum Presensi' : (rec.terlambat ? 'Terlambat' : 'Tepat Waktu')
        }</div></div>
      </div>

      <div class="actions" style="justify-content:center">${aksi}</div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:12px;font-size:15px">ℹ️ Informasi</h3>
      <p style="color:#64748b;font-size:13.5px;line-height:1.7">
        • Batas jam masuk tepat waktu adalah <b>${JAM_BATAS_MASUK} WIB</b>.<br>
        • Presensi masuk & pulang hanya bisa dilakukan <b>1x per hari</b>.<br>
        • Lihat riwayat lengkap di menu <b>Riwayat</b>.
      </p>
    </div>
  </div>

  <script>
    setInterval(()=>{
      const d=new Date();
      const t=d.toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour12:false});
      const el=document.getElementById('clock');
      if(el) el.textContent=t.replace(/\\./g,':');
    },1000);
  </script>`));
});

// --- PRESENSI MASUK ---
app.post('/presensi/masuk', auth, (req, res) => {
  const db = loadDB();
  const u = req.session.user;
  const { date, time } = nowWIB();

  const sudah = db.presensi.find(p => p.userId === u.id && p.tanggal === date);
  if (sudah) {
    req.session.flash = { type: 'err', msg: 'Anda sudah melakukan presensi masuk hari ini.' };
    return res.redirect('/');
  }

  const terlambat = time > JAM_BATAS_MASUK;
  db.presensi.push({
    id: db.nextPresensiId++,
    userId: u.id,
    nama: u.nama,
    tanggal: date,
    jamMasuk: time,
    jamPulang: null,
    terlambat
  });
  saveDB(db);

  req.session.flash = {
    type: 'ok',
    msg: `Presensi masuk tercatat pukul ${time} WIB. ${terlambat ? '⚠️ Anda terlambat.' : '✅ Tepat waktu.'}`
  };
  res.redirect('/');
});

// --- PRESENSI PULANG ---
app.post('/presensi/pulang', auth, (req, res) => {
  const db = loadDB();
  const u = req.session.user;
  const { date, time } = nowWIB();

  const rec = db.presensi.find(p => p.userId === u.id && p.tanggal === date);
  if (!rec) {
    req.session.flash = { type: 'err', msg: 'Anda belum presensi masuk hari ini.' };
    return res.redirect('/');
  }
  if (rec.jamPulang) {
    req.session.flash = { type: 'err', msg: 'Anda sudah presensi pulang hari ini.' };
    return res.redirect('/');
  }

  rec.jamPulang = time;
  saveDB(db);

  req.session.flash = { type: 'ok', msg: `Presensi pulang tercatat pukul ${time} WIB. Hati-hati di jalan!` };
  res.redirect('/');
});

// --- RIWAYAT ---
app.get('/riwayat', auth, (req, res) => {
  const db = loadDB();
  const u = req.session.user;
  const filterUser = req.query.user || '';

  let data = db.presensi.slice();
  if (u.role !== 'admin') {
    data = data.filter(p => p.userId === u.id);
  } else if (filterUser) {
    data = data.filter(p => p.userId == filterUser);
  }
  data.sort((a, b) => (b.tanggal + b.jamMasuk).localeCompare(a.tanggal + a.jamMasuk));

  const rows = data.length === 0
    ? `<tr><td colspan="6"><div class="empty">Belum ada data presensi.</div></td></tr>`
    : data.map(p => `<tr>
        <td>${tglPendek(p.tanggal)}</td>
        <td>${hariDari(p.tanggal)}</td>
        ${u.role === 'admin' ? `<td>${esc(p.nama)}</td>` : ''}
        <td>${p.jamMasuk}</td>
        <td>${p.jamPulang || '-'}</td>
        <td>${p.terlambat
          ? '<span class="badge badge-amber">Terlambat</span>'
          : '<span class="badge badge-green">Tepat</span>'}</td>
      </tr>`).join('');

  const guruOpts = db.users.filter(x => x.role === 'guru')
    .map(g => `<option value="${g.id}" ${filterUser == g.id ? 'selected' : ''}>${esc(g.nama)}</option>`).join('');

  res.send(page(req, 'Riwayat Presensi', 'riwayat', `
  <div class="container">
    <div class="page-title">Riwayat Presensi</div>
    <div class="page-sub">${u.role === 'admin' ? 'Seluruh data presensi pengajar' : 'Data presensi Anda'}</div>

    ${u.role === 'admin' ? `
    <div class="card">
      <form method="GET" action="/riwayat" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:200px">
          <label>Filter Pengajar</label>
          <select name="user">
            <option value="">— Semua Pengajar —</option>
            ${guruOpts}
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Terapkan</button>
        <a href="/riwayat" class="btn btn-secondary">Reset</a>
      </form>
    </div>` : ''}

    <div class="card">
      <div style="overflow-x:auto">
        <table>
          <thead><tr>
            <th>Tanggal</th><th>Hari</th>${u.role === 'admin' ? '<th>Nama</th>' : ''}
            <th>Masuk</th><th>Pulang</th><th>Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`));
});

// --- KELOLA PENGAJAR (ADMIN) ---
app.get('/pengajar', auth, adminOnly, (req, res) => {
  const db = loadDB();
  const rows = db.users.map(u => `<tr>
      <td>${esc(u.nama)}</td>
      <td>${esc(u.username)}</td>
      <td>${u.role === 'admin'
        ? '<span class="badge badge-red">Admin</span>'
        : '<span class="badge badge-green">Guru</span>'}</td>
      <td>${u.id === req.session.user.id
        ? '<span style="color:#94a3b8;font-size:12.5px">(akun Anda)</span>'
        : `<form method="POST" action="/pengajar/${u.id}/hapus" onsubmit="return confirm('Hapus pengajar ini?')" style="display:inline">
             <button class="btn btn-danger" style="padding:6px 12px;font-size:12.5px">Hapus</button>
           </form>`}</td>
    </tr>`).join('');

  res.send(page(req, 'Kelola Pengajar', 'pengajar', `
  <div class="container">
    <div class="page-title">Kelola Pengajar</div>
    <div class="page-sub">Tambah dan kelola akun pengajar TPA</div>

    <div class="card">
      <h3 style="margin-bottom:16px;font-size:16px">➕ Tambah Pengajar Baru</h3>
      <form method="POST" action="/pengajar/tambah">
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:14px">
          <div>
            <label>Nama Lengkap</label>
            <input type="text" name="nama" required placeholder="Ustadz/Ustadzah ...">
          </div>
          <div>
            <label>Username</label>
            <input type="text" name="username" required placeholder="tanpa spasi">
          </div>
          <div>
            <label>Password</label>
            <input type="text" name="password" required placeholder="min. 5 karakter">
          </div>
          <div>
            <label>Role</label>
            <select name="role">
              <option value="guru">Guru</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Simpan Pengajar</button>
      </form>
    </div>

    <div class="card">
      <h3 style="margin-bottom:14px;font-size:16px">📋 Daftar Akun (${db.users.length})</h3>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Aksi</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`));
});

app.post('/pengajar/tambah', auth, adminOnly, (req, res) => {
  const { nama, username, password, role } = req.body;
  const db = loadDB();

  if (!nama || !username || !password) {
    req.session.flash = { type: 'err', msg: 'Semua field wajib diisi.' };
    return res.redirect('/pengajar');
  }
  if (password.length < 5) {
    req.session.flash = { type: 'err', msg: 'Password minimal 5 karakter.' };
    return res.redirect('/pengajar');
  }
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    req.session.flash = { type: 'err', msg: `Username "${username}" sudah dipakai.` };
    return res.redirect('/pengajar');
  }

  db.users.push({
    id: db.nextUserId++,
    nama: nama.trim(),
    username: username.trim(),
    password: bcrypt.hashSync(password, 10),
    role: role === 'admin' ? 'admin' : 'guru'
  });
  saveDB(db);

  req.session.flash = { type: 'ok', msg: `Pengajar "${nama}" berhasil ditambahkan.` };
  res.redirect('/pengajar');
});

app.post('/pengajar/:id/hapus', auth, adminOnly, (req, res) => {
  const db = loadDB();
  const id = parseInt(req.params.id);

  if (id === req.session.user.id) {
    req.session.flash = { type: 'err', msg: 'Anda tidak bisa menghapus akun sendiri.' };
    return res.redirect('/pengajar');
  }
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) {
    req.session.flash = { type: 'err', msg: 'Pengajar tidak ditemukan.' };
    return res.redirect('/pengajar');
  }

  const nama = db.users[idx].nama;
  db.users.splice(idx, 1);
  saveDB(db);

  req.session.flash = { type: 'ok', msg: `Akun "${nama}" berhasil dihapus.` };
  res.redirect('/pengajar');
});

// --- RESET RIWAYAT (ADMIN ONLY) ---
app.post('/admin/reset-riwayat', auth, adminOnly, (req, res) => {
  const db = loadDB();
  const jumlahLama = db.presensi.length;
  db.presensi = [];
  db.nextPresensiId = 1;
  saveDB(db);

  req.session.flash = {
    type: 'ok',
    msg: `✅ Berhasil menghapus ${jumlahLama} data riwayat presensi. Database bersih kembali.`
  };
  res.redirect('/');
});

// --- GANTI PASSWORD ---
app.get('/password', auth, (req, res) => {
  res.send(page(req, 'Ganti Password', 'password', `
  <div class="container">
    <div class="page-title">Ganti Password</div>
    <div class="page-sub">Perbarui password akun Anda</div>

    <div class="card" style="max-width:480px">
      <form method="POST" action="/password">
        <div class="form-group">
          <label>Password Lama</label>
          <input type="password" name="lama" required>
        </div>
        <div class="form-group">
          <label>Password Baru</label>
          <input type="password" name="baru" required placeholder="min. 5 karakter">
        </div>
        <div class="form-group">
          <label>Konfirmasi Password Baru</label>
          <input type="password" name="konfirmasi" required>
        </div>
        <button type="submit" class="btn btn-primary">Simpan Password</button>
      </form>
    </div>
  </div>`));
});

app.post('/password', auth, (req, res) => {
  const { lama, baru, konfirmasi } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.id === req.session.user.id);

  if (!user || !bcrypt.compareSync(lama, user.password)) {
    req.session.flash = { type: 'err', msg: 'Password lama salah.' };
    return res.redirect('/password');
  }
  if (baru.length < 5) {
    req.session.flash = { type: 'err', msg: 'Password baru minimal 5 karakter.' };
    return res.redirect('/password');
  }
  if (baru !== konfirmasi) {
    req.session.flash = { type: 'err', msg: 'Konfirmasi password tidak cocok.' };
    return res.redirect('/password');
  }

  user.password = bcrypt.hashSync(baru, 10);
  saveDB(db);

  req.session.flash = { type: 'ok', msg: 'Password berhasil diubah.' };
  res.redirect('/password');
});

// 404
app.use((req, res) => {
  res.status(404).send(page(req, 'Tidak Ditemukan', '',
    '<div class="container"><div class="card"><h2>404</h2><p>Halaman tidak ditemukan.</p>' +
    '<a href="/" class="btn btn-primary" style="margin-top:14px">Kembali ke Dashboard</a></div></div>'));
});

/* ================= START ================= */
loadDB();
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ╔══════════════════════════════════════════╗');
  console.log('  ║   🕌  PORTAL PRESENSI PENGAJAR TPA PAMAN  🕌           ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║   Server jalan di port ${PORT}             ║`);
  console.log('  ║   Buka: http://localhost:' + PORT + '            ║');
  console.log('  ╚══════════════════════════════════════════╝\n');
  console.log('  ⚙️  Batas jam tepat waktu : ' + JAM_BATAS_MASUK + ' WIB');
  console.log('  Akun default:');
  console.log('    Admin  →  admin / admin123');
  console.log('    Guru   →  guru1 / guru123');
  console.log('    Guru   →  guru2 / guru123\n');
});
