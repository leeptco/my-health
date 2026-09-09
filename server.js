'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Читаем .env без сторонних зависимостей
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env не обязателен */ }

const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const { DATA_DIR, TABLES, all, one, run, list, get, insert, update, remove, transaction } = require('./db');

const PORT = Number(process.env.PORT) || 3000;
const PASSWORD = process.env.HEALTH_PASSWORD || '';
const SECURE_COOKIE = process.env.SECURE_COOKIE === '1';
const UPLOADS = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

// ---------- Настройки и сессия ----------
const setting = (k) => one('SELECT value FROM settings WHERE key = ?', [k])?.value;
const setSetting = (k, v) => run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, v]);
let SECRET = setting('secret');
if (!SECRET) { SECRET = crypto.randomBytes(32).toString('hex'); setSetting('secret', SECRET); }
// Токен зависит от пароля: смена пароля разлогинивает все устройства
const sessionToken = () => crypto.createHmac('sha256', SECRET).update('session:' + PASSWORD).digest('hex');
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
// API-токен для интеграций без браузера (iOS «Команды» и т.п.): заголовок X-Api-Token
let API_TOKEN = setting('api_token');
if (!API_TOKEN) { API_TOKEN = crypto.randomBytes(24).toString('hex'); setSetting('api_token', API_TOKEN); }

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const PUBLIC_PATHS = new Set(['/login.html', '/login', '/style.css', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png']);
app.use((req, res, next) => {
  if (!PASSWORD || PUBLIC_PATHS.has(req.path)) return next();
  const t = req.cookies.hs;
  if (typeof t === 'string' && safeEq(t, sessionToken())) return next();
  const apiT = req.get('x-api-token');
  if (req.path.startsWith('/api/') && typeof apiT === 'string' && safeEq(apiT, API_TOKEN)) return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/files/')) return res.status(401).json({ error: 'Нужно войти' });
  res.redirect('/login.html');
});

const loginAttempts = new Map();
app.post('/login', (req, res) => {
  const a = loginAttempts.get(req.ip) || { n: 0, t: 0 };
  if (a.n >= 10 && Date.now() - a.t < 15 * 60e3) return res.status(429).send('Слишком много попыток. Подождите 15 минут.');
  const pw = String(req.body.password || '');
  if (!PASSWORD || !safeEq(pw, PASSWORD)) {
    loginAttempts.set(req.ip, { n: a.n + 1, t: Date.now() });
    return res.redirect('/login.html?error=1');
  }
  loginAttempts.delete(req.ip);
  res.cookie('hs', sessionToken(), { httpOnly: true, sameSite: 'lax', secure: SECURE_COOKIE, maxAge: 400 * 864e5 });
  res.redirect('/');
});
app.post('/logout', (req, res) => { res.clearCookie('hs'); res.redirect('/login.html'); });

// Главную отдаём с флагом серверного режима: фронтенд тогда ходит в API, а не в локальную базу браузера
const STATIC_DIR = path.join(__dirname, 'docs');
const indexHtml = () => fs.readFileSync(path.join(STATIC_DIR, 'index.html'), 'utf8').replace('<script src="./localapi.js"></script>', '<script>window.HEALTH_SERVER = true;</script>');
app.get(['/', '/index.html'], (req, res) => res.type('html').send(indexHtml()));
app.use(express.static(STATIC_DIR, { extensions: ['html'] }));

// ---------- Вспомогательное ----------
const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD в локальной зоне сервера
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv-SE'); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const nameOf = (table, id) => (id && get(table, id)?.name) || '';

function tableOr404(req, res) {
  const t = req.params.table;
  if (!TABLES[t]) { res.status(404).json({ error: 'Нет такой таблицы' }); return null; }
  return t;
}

// Расход/напоминание, привязанные к сущности: создаём, обновляем или удаляем при каждом сохранении
function syncExpense(type, id, amount, date, category, title, place_id) {
  const ex = one('SELECT id FROM expenses WHERE entity_type = ? AND entity_id = ?', [type, id]);
  if (!amount || amount <= 0) { if (ex) remove('expenses', ex.id); return; }
  if (ex) update('expenses', ex.id, { amount, date, category, title, place_id });
  else insert('expenses', { date, amount, category, title, place_id, entity_type: type, entity_id: id, deductible: 1 });
}
function syncReminder(type, id, date, title, kind) {
  const ex = one('SELECT id, done FROM reminders WHERE entity_type = ? AND entity_id = ?', [type, id]);
  if (!date) { if (ex) remove('reminders', ex.id); return; }
  if (ex) update('reminders', ex.id, { date, title, kind });
  else insert('reminders', { date, title, kind, entity_type: type, entity_id: id, done: 0 });
}

function afterSave(table, row, body) {
  if (table === 'visits') {
    const doc = row.doctor_id ? get('doctors', row.doctor_id) : null;
    const who = doc ? `${doc.name}${doc.specialty ? ' (' + doc.specialty + ')' : ''}` : 'врач';
    syncExpense('visits', row.id, row.dms ? 0 : row.cost, row.date, doc?.specialty === 'Стоматолог' ? 'Стоматология' : 'Врач', 'Визит: ' + who, row.place_id);
    syncReminder('visits', row.id, row.next_date, 'Повторный визит: ' + who, 'visit');
  }
  if (table === 'labs') {
    syncExpense('labs', row.id, row.dms ? 0 : row.cost, row.date, 'Анализы', row.name, row.place_id);
    if (Array.isArray(body.results)) {
      run('DELETE FROM lab_results WHERE lab_id = ?', [row.id]);
      for (const r of body.results) {
        if (!r.indicator || !String(r.indicator).trim()) continue;
        insert('lab_results', { ...r, lab_id: row.id, indicator: String(r.indicator).trim() });
      }
    }
  }
  if (table === 'courses') {
    const med = get('medications', row.medication_id);
    syncExpense('courses', row.id, row.cost, row.start_date, 'Лекарства', med?.name || 'Препарат', null);
    syncReminder('courses', row.id, row.is_kok ? null : row.end_date, 'Конец курса: ' + (med?.name || ''), 'course');
  }
}

function beforeDelete(table, id, res) {
  const refs = {
    doctors: [['visits', 'doctor_id'], ['courses', 'doctor_id'], ['labs', 'doctor_id']],
    places: [['visits', 'place_id'], ['labs', 'place_id'], ['doctors', 'place_id']],
    medications: [['courses', 'medication_id']],
  }[table];
  if (refs) {
    for (const [t, col] of refs) {
      const n = one(`SELECT COUNT(*) n FROM ${t} WHERE ${col} = ?`, [id]).n;
      if (n) { res.status(409).json({ error: `Нельзя удалить: используется в записях (${t}: ${n})` }); return false; }
    }
  }
  return true;
}

function afterDelete(table, id) {
  run('DELETE FROM expenses WHERE entity_type = ? AND entity_id = ?', [table, id]);
  run('DELETE FROM reminders WHERE entity_type = ? AND entity_id = ?', [table, id]);
  for (const f of all('SELECT * FROM files WHERE entity_type = ? AND entity_id = ?', [table, id])) {
    fs.rm(path.join(UPLOADS, f.stored_name), { force: true }, () => {});
    remove('files', f.id);
  }
  if (table === 'courses') run('DELETE FROM intakes WHERE course_id = ?', [id]);
  if (table === 'labs') run('DELETE FROM lab_results WHERE lab_id = ?', [id]);
  if (table === 'episodes') {
    for (const t of ['diary', 'visits', 'courses', 'labs']) run(`UPDATE ${t} SET episode_id = NULL WHERE episode_id = ?`, [id]);
    run('UPDATE episodes SET parent_id = NULL WHERE parent_id = ?', [id]);
  }
}

// ---------- Специальные эндпоинты (до универсального CRUD) ----------

// Главный экран: лекарства на сегодня, КОК, напоминания, цикл, статистика
app.get('/api/today', (req, res) => {
  const date = req.query.date || today();
  const courses = all(`SELECT c.*, m.name med_name, m.form med_form, m.strength med_strength FROM courses c
    JOIN medications m ON m.id = c.medication_id
    WHERE c.active = 1 AND c.start_date <= ? AND (c.end_date IS NULL OR c.end_date >= ?) ORDER BY c.is_kok DESC, m.name`, [date, date]);
  const intakes = all('SELECT course_id, slot FROM intakes WHERE date = ? AND taken = 1', [date]);
  const takenSet = new Set(intakes.map(i => `${i.course_id}:${i.slot}`));

  let kok = null;
  const items = courses.map(c => {
    const times = (() => { try { return JSON.parse(c.times || '[]'); } catch { return []; } })();
    const perDay = c.per_day || 1;
    const slots = Array.from({ length: perDay }, (_, i) => ({ slot: i, time: times[i] || null, taken: takenSet.has(`${c.id}:${i}`) }));
    let onBreak = false;
    if (c.is_kok && c.pack_size) {
      const cycleLen = c.pack_size + (c.break_days || 0);
      const d = daysBetween(c.start_date, date);
      const idx = ((d % cycleLen) + cycleLen) % cycleLen;
      const packStart = addDays(date, -idx);
      onBreak = idx >= c.pack_size;
      // пропуски в текущей пачке: дни до сегодня без отметки
      const lastPillDay = Math.min(daysBetween(packStart, date) - 1, c.pack_size - 1);
      let missed = [];
      if (lastPillDay >= 0) {
        const takenDays = new Set(all('SELECT date FROM intakes WHERE course_id = ? AND taken = 1 AND date >= ? AND date <= ?', [c.id, packStart, addDays(packStart, lastPillDay)]).map(r => r.date));
        for (let i = 0; i <= lastPillDay; i++) { const dd = addDays(packStart, i); if (!takenDays.has(dd)) missed.push(dd); }
      }
      kok = {
        course_id: c.id, name: c.med_name, pack_size: c.pack_size, break_days: c.break_days || 0,
        on_break: onBreak, pill: onBreak ? null : idx + 1, break_day: onBreak ? idx - c.pack_size + 1 : null,
        pack_start: packStart, last_pill: addDays(packStart, c.pack_size - 1), next_pack: addDays(packStart, cycleLen),
        missed, taken_today: takenSet.has(`${c.id}:0`),
      };
    }
    return { ...c, times, slots, on_break: onBreak };
  });

  const reminders = all('SELECT * FROM reminders WHERE done = 0 AND date <= ? ORDER BY date', [addDays(date, 14)]);
  const episodes = all('SELECT * FROM episodes WHERE end_date IS NULL AND COALESCE(chronic, 0) = 0 ORDER BY start_date DESC');
  const diary = list('diary', { limit: 3 });

  const starts = all('SELECT start_date FROM cycles WHERE start_date <= ? ORDER BY start_date DESC LIMIT 7', [date]).map(r => r.start_date);
  let cycle = null;
  if (starts.length) {
    const lens = [];
    for (let i = 0; i + 1 < starts.length; i++) lens.push(daysBetween(starts[i + 1], starts[i]));
    const avg = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 28;
    cycle = { day: daysBetween(starts[0], date) + 1, last_start: starts[0], avg_length: avg, next_predicted: addDays(starts[0], avg) };
  }

  const since = addDays(date, -90);
  const recent = list('diary', { from: since, to: date });
  const counts = {};
  let badDays = new Set();
  for (const d of recent) {
    for (const s of d.symptoms || []) counts[s] = (counts[s] || 0) + 1;
    if (d.feeling && d.feeling <= 2) badDays.add(d.date);
  }
  const stats = {
    days: 90, entries: recent.length, bad_days: badDays.size,
    symptoms: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
    visits: one('SELECT COUNT(*) n FROM visits WHERE date >= ?', [since]).n,
    spent_year: one("SELECT COALESCE(SUM(amount),0) s FROM expenses WHERE substr(date,1,4) = ?", [date.slice(0, 4)]).s,
  };

  const has_data = one('SELECT (SELECT COUNT(*) FROM diary) + (SELECT COUNT(*) FROM visits) + (SELECT COUNT(*) FROM courses) + (SELECT COUNT(*) FROM labs) n').n > 0;
  res.json({ date, courses: items, kok, reminders, episodes, diary, cycle, stats, has_data, last_backup: setting('last_backup') || null });
});

// Отметить/снять отметку приёма
app.post('/api/intakes/toggle', (req, res) => {
  const { course_id, date, slot = 0 } = req.body;
  if (!course_id || !date) return res.status(400).json({ error: 'course_id и date обязательны' });
  const ex = one('SELECT id FROM intakes WHERE course_id = ? AND date = ? AND slot = ?', [course_id, date, slot]);
  if (ex) { remove('intakes', ex.id); return res.json({ taken: false }); }
  insert('intakes', { course_id, date, slot, taken: 1, time: new Date().toTimeString().slice(0, 5) });
  res.json({ taken: true });
});

// КОК: начать новую пачку с указанной даты
app.post('/api/courses/:id/new-pack', (req, res) => {
  const c = get('courses', req.params.id);
  if (!c) return res.status(404).json({ error: 'Курс не найден' });
  res.json(update('courses', c.id, { start_date: req.body.date || today() }));
});

// Динамика показателей анализов
app.get('/api/labs/indicators', (req, res) => {
  const rows = all(`SELECT r.indicator, r.unit, r.value, r.ref_min, r.ref_max, l.date, l.id lab_id, l.name lab_name
    FROM lab_results r JOIN labs l ON l.id = r.lab_id WHERE r.value IS NOT NULL ORDER BY r.indicator COLLATE NOCASE, l.date`);
  const map = new Map();
  for (const r of rows) {
    const key = r.indicator.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { indicator: r.indicator.trim(), unit: r.unit, points: [] });
    const g = map.get(key);
    if (!g.unit && r.unit) g.unit = r.unit;
    g.points.push({ date: r.date, value: r.value, ref_min: r.ref_min, ref_max: r.ref_max, lab_id: r.lab_id, lab_name: r.lab_name });
  }
  res.json([...map.values()]);
});

// Известные названия показателей (для автодополнения)
app.get('/api/labs/indicator-names', (req, res) => {
  res.json(all('SELECT indicator, unit, ref_min, ref_max, MAX(id) FROM lab_results GROUP BY indicator COLLATE NOCASE ORDER BY indicator COLLATE NOCASE'));
});

// Сводка расходов за год
app.get('/api/expenses/summary', (req, res) => {
  const year = String(req.query.year || today().slice(0, 4));
  const rows = all('SELECT * FROM expenses WHERE substr(date,1,4) = ? ORDER BY date DESC, id DESC', [year]);
  const byCat = {}, byMonth = {};
  let total = 0, deductible = 0;
  for (const e of rows) {
    total += e.amount;
    if (e.deductible) deductible += e.amount;
    byCat[e.category || 'Другое'] = (byCat[e.category || 'Другое'] || 0) + e.amount;
    const m = e.date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + e.amount;
  }
  const years = all("SELECT DISTINCT substr(date,1,4) y FROM expenses ORDER BY y DESC").map(r => r.y);
  res.json({ year, years, total, deductible, by_category: byCat, by_month: byMonth, items: rows });
});

// Резервная копия: все таблицы одним JSON
app.get('/api/export', (req, res) => {
  const data = { version: 1, exported_at: new Date().toISOString(), tables: {} };
  for (const t of Object.keys(TABLES)) data.tables[t] = all(`SELECT * FROM ${t} ORDER BY id`);
  res.setHeader('Content-Disposition', `attachment; filename="health-backup-${today()}.json"`);
  setSetting('last_backup', req.query.date || today());
  res.json(data);
});

// Восстановление из резервной копии (заменяет все данные!)
app.post('/api/import', (req, res) => {
  const data = req.body;
  if (!data || !data.tables) return res.status(400).json({ error: 'Неверный формат файла' });
  transaction(() => {
    for (const t of Object.keys(TABLES)) {
      if (!Array.isArray(data.tables[t])) continue;
      run(`DELETE FROM ${t}`);
      for (const row of data.tables[t]) {
        const cols = Object.keys(row).filter(c => c === 'id' || c === 'created_at' || c === 'uploaded_at' || TABLES[t].cols.includes(c));
        run(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map(c => row[c]));
      }
    }
  });
  res.json({ ok: true });
});

// ---------- Интеграции: Apple Health / Flo / iOS «Команды» ----------
app.get('/api/settings/token', (req, res) => res.json({ token: API_TOKEN }));
app.post('/api/settings/token', (req, res) => {
  API_TOKEN = crypto.randomBytes(24).toString('hex'); setSetting('api_token', API_TOKEN);
  res.json({ token: API_TOKEN });
});

const RU_MONTHS = { 'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'ма': 5, 'июн': 6, 'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12 };
// Вытаскивает даты (YYYY-MM-DD) из произвольного текста: ISO, 09.09.2026, «9 сент. 2026 г.»
function extractDates(text) {
  const out = new Set();
  const s = String(text || '');
  for (const m of s.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) out.add(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of s.matchAll(/(\d{1,2})\.(\d{2})\.(\d{4})/g)) out.add(`${m[3]}-${m[2]}-${m[1].padStart(2, '0')}`);
  for (const m of s.matchAll(/(\d{1,2})\s+(янв|фев|мар|апр|ма|июн|июл|авг|сен|окт|ноя|дек)[а-яё.]*\s+(\d{4})/gi)) {
    out.add(`${m[3]}-${String(RU_MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  }
  return [...out].filter(d => !Number.isNaN(Date.parse(d))).sort();
}

// Склеивает дни с кровотечением в эпизоды (разрыв до 2 дней — один эпизод) и записывает их как циклы
function importBleedingDays(dayFlow) {
  const days = [...dayFlow.keys()].sort();
  const runs = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && daysBetween(last.end, d) <= 2) { last.end = d; last.flows.push(dayFlow.get(d)); }
    else runs.push({ start: d, end: d, flows: [dayFlow.get(d)] });
  }
  const rank = { 'Скудные': 1, 'Обычные': 2, 'Обильные': 3 };
  let added = 0, updated = 0;
  for (const r of runs) {
    const flow = r.flows.filter(Boolean).sort((a, b) => (rank[b] || 0) - (rank[a] || 0))[0] || null;
    const ex = one('SELECT * FROM cycles WHERE start_date BETWEEN ? AND ?', [addDays(r.start, -3), addDays(r.start, 3)]);
    if (ex) {
      const patch = {};
      if (!ex.end_date || ex.end_date < r.end) patch.end_date = r.end;
      if (!ex.flow && flow) patch.flow = flow;
      if (Object.keys(patch).length) { update('cycles', ex.id, patch); updated++; }
    } else { insert('cycles', { start_date: r.start, end_date: r.end, flow, note: 'импорт' }); added++; }
  }
  return { episodes: runs.length, added, updated };
}

// Мазня / межменструальные кровотечения → записи дневника (по одной на день)
function importSpottingDays(days) {
  let added = 0;
  for (const d of days) {
    const ex = all('SELECT symptoms FROM diary WHERE date = ?', [d]).some(r => (r.symptoms || '').includes('Мазня'));
    if (ex) continue;
    insert('diary', { date: d, symptoms: ['Мазня / кровянистые выделения'], note: 'импорт из Apple Health' });
    added++;
  }
  return added;
}

// Синхронизация из iOS «Команды»: тело — JSON {dates: [...]|"..."} или просто текст с датами
app.post('/api/cycles/sync', express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
  let raw = req.body;
  if (raw && typeof raw === 'object') raw = JSON.stringify(raw);
  let dates = [];
  try { const j = JSON.parse(raw); dates = extractDates(Array.isArray(j.dates) ? j.dates.join('\n') : (j.dates ?? raw)); }
  catch { dates = extractDates(raw); }
  if (!dates.length) return res.status(400).json({ error: 'Не нашла ни одной даты в запросе' });
  const result = importBleedingDays(new Map(dates.map(d => [d, null])));
  res.json({ ok: true, dates: dates.length, ...result });
});

// Импорт export.xml из приложения «Здоровье» (туда же Flo синхронизирует цикл)
const uploadXml = multer({ dest: path.join(DATA_DIR, 'tmp'), limits: { fileSize: 3 * 1024 * 1024 * 1024 } });
app.post('/api/import/apple-health', uploadXml.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Нет файла' });
  const FLOW = { Light: 'Скудные', Medium: 'Обычные', Heavy: 'Обильные' };
  const menses = new Map(), spotting = new Set();
  let records = 0;
  try {
    const rl = require('readline').createInterface({ input: fs.createReadStream(req.file.path, 'utf8') });
    for await (const line of rl) {
      if (!line.includes('<Record ')) continue;
      records++;
      const type = /type="([^"]+)"/.exec(line)?.[1];
      if (type !== 'HKCategoryTypeIdentifierMenstrualFlow' && type !== 'HKCategoryTypeIdentifierIntermenstrualBleeding') continue;
      const date = /startDate="(\d{4}-\d{2}-\d{2})/.exec(line)?.[1];
      if (!date) continue;
      if (type === 'HKCategoryTypeIdentifierIntermenstrualBleeding') { spotting.add(date); continue; }
      const val = /value="HKCategoryValueMenstrualFlow(\w+)"/.exec(line)?.[1];
      if (val === 'None') continue;
      const flow = FLOW[val] || null;
      if (!menses.has(date) || (flow && !menses.get(date))) menses.set(date, flow);
    }
  } finally { fs.rm(req.file.path, { force: true }, () => {}); }
  if (!records) return res.status(400).json({ error: 'Это не похоже на export.xml из приложения «Здоровье»' });
  const cycles = transaction(() => importBleedingDays(menses));
  const spottingAdded = transaction(() => importSpottingDays([...spotting].sort()));
  res.json({ ok: true, records, menses_days: menses.size, spotting_days: spotting.size, spotting_added: spottingAdded, ...cycles });
});

// ---------- Файлы ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase().slice(0, 10)}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
});

app.post('/api/upload', upload.array('files', 10), (req, res) => {
  const { entity_type, entity_id } = req.body;
  if (!TABLES[entity_type] || !entity_id) return res.status(400).json({ error: 'entity_type/entity_id обязательны' });
  // Имя файла может прийти как latin1-байты UTF-8 (зависит от версии busboy) — чиним только если это действительно так
  const fixName = (n) => {
    if (/[^ -ÿ]/.test(n)) return n;
    const dec = Buffer.from(n, 'latin1').toString('utf8');
    return dec.includes('�') ? n : dec;
  };
  const rows = (req.files || []).map(f => insert('files', {
    entity_type, entity_id, stored_name: f.filename,
    original_name: fixName(f.originalname), mime: f.mimetype, size: f.size,
  }));
  res.json(rows);
});

app.get('/files/:id', (req, res) => {
  const f = get('files', req.params.id);
  if (!f) return res.status(404).send('Файл не найден');
  const name = encodeURIComponent(f.original_name || f.stored_name);
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${name}`);
  res.type(f.mime || 'application/octet-stream');
  res.sendFile(path.join(UPLOADS, f.stored_name));
});

app.delete('/api/files/:id', (req, res) => {
  const f = get('files', req.params.id);
  if (!f) return res.status(404).json({ error: 'Файл не найден' });
  fs.rm(path.join(UPLOADS, f.stored_name), { force: true }, () => {});
  remove('files', f.id);
  res.json({ ok: true });
});

// ---------- Универсальный CRUD ----------
app.get('/api/:table', (req, res) => { const t = tableOr404(req, res); if (t) res.json(list(t, req.query)); });
app.get('/api/:table/:id', (req, res) => {
  const t = tableOr404(req, res); if (!t) return;
  const row = get(t, req.params.id);
  if (!row) return res.status(404).json({ error: 'Не найдено' });
  if (t === 'labs') row.results = all('SELECT * FROM lab_results WHERE lab_id = ? ORDER BY id', [row.id]);
  row.files = all('SELECT * FROM files WHERE entity_type = ? AND entity_id = ? ORDER BY uploaded_at', [t, row.id]);
  res.json(row);
});
app.post('/api/:table', (req, res) => {
  const t = tableOr404(req, res); if (!t) return;
  const row = transaction(() => { const r = insert(t, req.body); afterSave(t, r, req.body); return r; });
  res.json(row);
});
app.put('/api/:table/:id', (req, res) => {
  const t = tableOr404(req, res); if (!t) return;
  if (!get(t, req.params.id)) return res.status(404).json({ error: 'Не найдено' });
  const row = transaction(() => { const r = update(t, req.params.id, req.body); afterSave(t, r, req.body); return r; });
  res.json(row);
});
app.delete('/api/:table/:id', (req, res) => {
  const t = tableOr404(req, res); if (!t) return;
  if (!beforeDelete(t, req.params.id, res)) return;
  transaction(() => { remove(t, req.params.id); afterDelete(t, Number(req.params.id)); });
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`Здоровье: http://localhost:${PORT}`);
  console.log(`Данные: ${DATA_DIR}`);
  if (!PASSWORD) console.log('ВНИМАНИЕ: пароль не задан (HEALTH_PASSWORD) — вход без пароля. Для хостинга обязательно задай пароль в .env');
});
