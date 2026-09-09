'use strict';
// Автономный режим: те же «эндпоинты», что у server.js, но данные живут в IndexedDB этого устройства.
// app.js вызывает localApi.request(method, url, body) вместо fetch. Если страницу отдал сервер (window.HEALTH_SERVER), слой не включается.
(() => {
  if (window.HEALTH_SERVER) return;

  // ---------- Описание таблиц (зеркало db.js) ----------
  const NOCASE = 'nocase';
  const TABLES = {
    places:      { cols: ['name', 'type', 'address', 'phone', 'note'], order: [['name', 1, NOCASE]] },
    doctors:     { cols: ['name', 'specialty', 'phone', 'place_id', 'note'], num: ['place_id'], order: [['name', 1, NOCASE]] },
    medications: { cols: ['name', 'form', 'strength', 'note'], order: [['name', 1, NOCASE]] },
    episodes:    { cols: ['title', 'start_date', 'end_date', 'diagnosis', 'chronic', 'parent_id', 'note'], num: ['chronic', 'parent_id'], defaults: { chronic: 0 }, order: [['start_date', -1]] },
    diary:       { cols: ['date', 'time', 'feeling', 'symptoms', 'severity', 'temperature', 'episode_id', 'note'], json: ['symptoms'],
                   num: ['feeling', 'severity', 'temperature', 'episode_id'], order: [['date', -1], ['time', -1], ['id', -1]] },
    visits:      { cols: ['date', 'time', 'doctor_id', 'place_id', 'episode_id', 'reason', 'conclusion', 'diagnosis', 'referrals', 'next_date', 'cost', 'dms', 'note'],
                   num: ['doctor_id', 'place_id', 'episode_id', 'cost', 'dms'], defaults: { dms: 0 }, order: [['date', -1], ['time', -1]] },
    courses:     { cols: ['medication_id', 'episode_id', 'visit_id', 'doctor_id', 'dose', 'per_day', 'times', 'start_date', 'end_date', 'is_kok', 'pack_size', 'break_days', 'purpose', 'cost', 'note', 'active'],
                   json: ['times'], num: ['medication_id', 'episode_id', 'visit_id', 'doctor_id', 'per_day', 'is_kok', 'pack_size', 'break_days', 'cost', 'active'],
                   defaults: { per_day: 1, is_kok: 0, active: 1 }, order: [['active', -1], ['start_date', -1]] },
    intakes:     { cols: ['course_id', 'date', 'slot', 'taken', 'time', 'note'], num: ['course_id', 'slot', 'taken'], defaults: { slot: 0, taken: 1 }, order: [['date', -1]] },
    labs:        { cols: ['date', 'name', 'place_id', 'episode_id', 'doctor_id', 'cost', 'dms', 'note'], num: ['place_id', 'episode_id', 'doctor_id', 'cost', 'dms'], defaults: { dms: 0 }, order: [['date', -1]] },
    lab_results: { cols: ['lab_id', 'indicator', 'value', 'value_text', 'unit', 'ref_min', 'ref_max'], num: ['lab_id', 'value', 'ref_min', 'ref_max'], order: [['id', 1]] },
    cycles:      { cols: ['start_date', 'end_date', 'flow', 'note'], order: [['start_date', -1]] },
    expenses:    { cols: ['date', 'amount', 'category', 'title', 'place_id', 'entity_type', 'entity_id', 'deductible', 'note'],
                   num: ['amount', 'place_id', 'entity_id', 'deductible'], defaults: { deductible: 1 }, order: [['date', -1], ['id', -1]] },
    reminders:   { cols: ['date', 'title', 'kind', 'entity_type', 'entity_id', 'done', 'note'], num: ['entity_id', 'done'], defaults: { done: 0 }, order: [['done', 1], ['date', 1]] },
    files:       { cols: ['entity_type', 'entity_id', 'stored_name', 'original_name', 'mime', 'size'], num: ['entity_id', 'size'], order: [['uploaded_at', 1]] },
  };

  const todayStr = () => new Date().toLocaleDateString('sv-SE');
  const nowIso = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv-SE'); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
  const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };

  // ---------- IndexedDB ----------
  const DB_NAME = 'health-local', DB_VER = 1;
  let idb;
  function openDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('data')) d.createObjectStore('data'); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  const tx = (store, mode, fn) => new Promise((res, rej) => {
    const t = idb.transaction(store, mode); const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
  const getBlob = (id) => tx('blobs', 'readonly', s => s.get(id));
  const putBlob = (id, blob) => tx('blobs', 'readwrite', s => s.put(blob, id));
  const delBlob = (id) => tx('blobs', 'readwrite', s => s.delete(id));
  const clearBlobs = () => tx('blobs', 'readwrite', s => s.clear());
  const allBlobKeys = () => tx('blobs', 'readonly', s => s.getAllKeys());

  // Все таблицы держим в памяти и целиком сохраняем после каждого изменения — для личной базы это единицы мегабайт.
  let S = null;
  const emptyState = () => ({ tables: Object.fromEntries(Object.keys(TABLES).map(t => [t, []])), seq: Object.fromEntries(Object.keys(TABLES).map(t => [t, 0])), settings: {} });
  let ready = null;
  function init() {
    return ready ||= (async () => {
      idb = await openDb();
      S = (await tx('data', 'readonly', s => s.get('main'))) || emptyState();
      for (const t of Object.keys(TABLES)) { S.tables[t] ||= []; S.seq[t] ||= S.tables[t].reduce((m, r) => Math.max(m, r.id), 0); }
      S.settings ||= {};
      try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch {}
    })();
  }
  let saveChain = Promise.resolve();
  const save = () => (saveChain = saveChain.then(() => tx('data', 'readwrite', s => s.put(S, 'main'))));

  // ---------- CRUD ----------
  const rows = (t) => S.tables[t];
  const cmpVal = (a, b, nocase) => {
    if (a == null && b == null) return 0; if (a == null) return -1; if (b == null) return 1;
    if (nocase) return String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' });
    return a < b ? -1 : a > b ? 1 : 0;
  };
  const sorted = (t, list) => [...list].sort((x, y) => { for (const [c, dir, nc] of TABLES[t].order) { const r = cmpVal(x[c], y[c], nc); if (r) return r * dir; } return 0; });

  function clean(t, body) {
    const conf = TABLES[t], out = {};
    for (const c of conf.cols) {
      if (body[c] === undefined) continue;
      let v = body[c];
      if (v === '') v = null;
      if ((conf.json || []).includes(c)) v = Array.isArray(v) ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []);
      else if ((conf.num || []).includes(c) && v !== null) { v = Number(v); if (Number.isNaN(v)) v = null; }
      else if (typeof v === 'boolean') v = v ? 1 : 0;
      out[c] = v;
    }
    return out;
  }
  const norm = (t, r) => { for (const c of TABLES[t].json || []) if (!Array.isArray(r[c])) r[c] = []; return r; };

  function list(t, q = {}) {
    const conf = TABLES[t];
    let out = rows(t);
    for (const c of ['id', ...conf.cols]) if (q[c] !== undefined && q[c] !== '') out = out.filter(r => String(r[c]) === String(q[c]));
    const dateCol = conf.cols.includes('date') ? 'date' : conf.cols.includes('start_date') ? 'start_date' : null;
    if (dateCol && q.from) out = out.filter(r => r[dateCol] >= q.from);
    if (dateCol && q.to) out = out.filter(r => r[dateCol] <= q.to);
    out = sorted(t, out);
    if (q.limit) out = out.slice(0, Number(q.limit));
    return out.map(r => ({ ...r }));
  }
  const get = (t, id) => { const r = rows(t).find(x => x.id === Number(id)); return r ? { ...r } : null; };
  function insert(t, body) {
    const conf = TABLES[t];
    const r = norm(t, { ...(conf.defaults || {}), ...clean(t, body) });
    r.id = ++S.seq[t];
    r[t === 'files' ? 'uploaded_at' : 'created_at'] = nowIso();
    rows(t).push(r);
    return { ...r };
  }
  function update(t, id, body) {
    const r = rows(t).find(x => x.id === Number(id));
    if (!r) return null;
    Object.assign(r, clean(t, body)); norm(t, r);
    return { ...r };
  }
  function remove(t, id) { const i = rows(t).findIndex(x => x.id === Number(id)); if (i >= 0) rows(t).splice(i, 1); return i >= 0 ? 1 : 0; }
  const one = (t, pred) => rows(t).find(pred) || null;

  // ---------- Хуки (зеркало server.js) ----------
  function syncExpense(type, id, amount, date, category, title, place_id) {
    const ex = one('expenses', e => e.entity_type === type && e.entity_id === id);
    if (!amount || amount <= 0) { if (ex) remove('expenses', ex.id); return; }
    if (ex) update('expenses', ex.id, { amount, date, category, title, place_id });
    else insert('expenses', { date, amount, category, title, place_id, entity_type: type, entity_id: id, deductible: 1 });
  }
  function syncReminder(type, id, date, title, kind) {
    const ex = one('reminders', r => r.entity_type === type && r.entity_id === id);
    if (!date) { if (ex) remove('reminders', ex.id); return; }
    if (ex) update('reminders', ex.id, { date, title, kind });
    else insert('reminders', { date, title, kind, entity_type: type, entity_id: id, done: 0 });
  }
  function afterSave(t, row, body) {
    if (t === 'visits') {
      const doc = row.doctor_id ? get('doctors', row.doctor_id) : null;
      const who = doc ? `${doc.name}${doc.specialty ? ' (' + doc.specialty + ')' : ''}` : 'врач';
      // по ДМС платит страховая — в расходы не попадает
      syncExpense('visits', row.id, row.dms ? 0 : row.cost, row.date, doc?.specialty === 'Стоматолог' ? 'Стоматология' : 'Врач', 'Визит: ' + who, row.place_id);
      syncReminder('visits', row.id, row.next_date, 'Повторный визит: ' + who, 'visit');
    }
    if (t === 'labs') {
      syncExpense('labs', row.id, row.dms ? 0 : row.cost, row.date, 'Анализы', row.name, row.place_id);
      if (Array.isArray(body.results)) {
        S.tables.lab_results = rows('lab_results').filter(r => r.lab_id !== row.id);
        for (const r of body.results) { if (!r.indicator || !String(r.indicator).trim()) continue; insert('lab_results', { ...r, lab_id: row.id, indicator: String(r.indicator).trim() }); }
      }
    }
    if (t === 'courses') {
      const med = get('medications', row.medication_id);
      syncExpense('courses', row.id, row.cost, row.start_date, 'Лекарства', med?.name || 'Препарат', null);
      syncReminder('courses', row.id, row.is_kok ? null : row.end_date, 'Конец курса: ' + (med?.name || ''), 'course');
    }
  }
  function beforeDelete(t, id) {
    const refs = { doctors: [['visits', 'doctor_id'], ['courses', 'doctor_id'], ['labs', 'doctor_id']], places: [['visits', 'place_id'], ['labs', 'place_id'], ['doctors', 'place_id']], medications: [['courses', 'medication_id']] }[t];
    if (!refs) return;
    const RU = { visits: 'визитах', courses: 'курсах лекарств', labs: 'анализах', doctors: 'карточках врачей' };
    for (const [tt, col] of refs) { const n = rows(tt).filter(r => r[col] === Number(id)).length; if (n) fail(`Нельзя удалить: используется в ${n} ${RU[tt] || tt}. Сначала измени или удали эти записи.`, 409); }
  }
  async function afterDelete(t, id) {
    id = Number(id);
    S.tables.expenses = rows('expenses').filter(e => !(e.entity_type === t && e.entity_id === id));
    S.tables.reminders = rows('reminders').filter(r => !(r.entity_type === t && r.entity_id === id));
    for (const f of rows('files').filter(f => f.entity_type === t && f.entity_id === id)) await deleteFile(f.id);
    if (t === 'courses') S.tables.intakes = rows('intakes').filter(i => i.course_id !== id);
    if (t === 'labs') S.tables.lab_results = rows('lab_results').filter(r => r.lab_id !== id);
    if (t === 'episodes') {
      for (const tt of ['diary', 'visits', 'courses', 'labs']) for (const r of rows(tt)) if (r.episode_id === id) r.episode_id = null;
      for (const r of rows('episodes')) if (r.parent_id === id) r.parent_id = null;
    }
  }

  // ---------- Файлы ----------
  const urlCache = new Map();
  async function fileUrl(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const blob = await getBlob(id);
    if (!blob) return null;
    const u = URL.createObjectURL(blob); urlCache.set(id, u); return u;
  }
  async function filesOf(t, id) {
    const out = [];
    for (const f of sorted('files', rows('files').filter(f => f.entity_type === t && f.entity_id === Number(id)))) out.push({ ...f, url: await fileUrl(f.id) });
    return out;
  }
  async function deleteFile(id) {
    id = Number(id);
    if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
    await delBlob(id); remove('files', id);
  }

  // ---------- Сводные запросы ----------
  function today(date) {
    date ||= todayStr();
    const courses = sorted('courses', rows('courses').filter(c => c.active === 1 && c.start_date <= date && (!c.end_date || c.end_date >= date)))
      .sort((a, b) => (b.is_kok || 0) - (a.is_kok || 0));
    const taken = new Set(rows('intakes').filter(i => i.date === date && i.taken === 1).map(i => `${i.course_id}:${i.slot}`));
    let kok = null;
    const items = courses.map(c => {
      const m = get('medications', c.medication_id) || {};
      const perDay = c.per_day || 1;
      const slots = Array.from({ length: perDay }, (_, i) => ({ slot: i, time: (c.times || [])[i] || null, taken: taken.has(`${c.id}:${i}`) }));
      let onBreak = false;
      if (c.is_kok && c.pack_size) {
        const cycleLen = c.pack_size + (c.break_days || 0);
        const d = daysBetween(c.start_date, date);
        const idx = ((d % cycleLen) + cycleLen) % cycleLen;
        const packStart = addDays(date, -idx);
        onBreak = idx >= c.pack_size;
        const lastPillDay = Math.min(daysBetween(packStart, date) - 1, c.pack_size - 1);
        const missed = [];
        if (lastPillDay >= 0) {
          const takenDays = new Set(rows('intakes').filter(i => i.course_id === c.id && i.taken === 1).map(i => i.date));
          for (let i = 0; i <= lastPillDay; i++) { const dd = addDays(packStart, i); if (!takenDays.has(dd)) missed.push(dd); }
        }
        kok = { course_id: c.id, name: m.name, pack_size: c.pack_size, break_days: c.break_days || 0, on_break: onBreak, pill: onBreak ? null : idx + 1,
          break_day: onBreak ? idx - c.pack_size + 1 : null, pack_start: packStart, last_pill: addDays(packStart, c.pack_size - 1), next_pack: addDays(packStart, cycleLen), missed, taken_today: taken.has(`${c.id}:0`) };
      }
      return { ...c, med_name: m.name, med_form: m.form, med_strength: m.strength, slots, on_break: onBreak };
    });
    const reminders = sorted('reminders', rows('reminders').filter(r => !r.done && r.date <= addDays(date, 14)));
    // «Сейчас болею» — только острые эпизоды; хронические болезни живут в своём разделе
    const episodes = sorted('episodes', rows('episodes').filter(e => !e.end_date && !e.chronic));
    const diary = list('diary', { limit: 3 });
    const starts = rows('cycles').filter(c => c.start_date <= date).map(c => c.start_date).sort().reverse().slice(0, 7);
    let cycle = null;
    if (starts.length) {
      const lens = []; for (let i = 0; i + 1 < starts.length; i++) lens.push(daysBetween(starts[i + 1], starts[i]));
      const avg = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 28;
      cycle = { day: daysBetween(starts[0], date) + 1, last_start: starts[0], avg_length: avg, next_predicted: addDays(starts[0], avg) };
    }
    const since = addDays(date, -90);
    const recent = list('diary', { from: since, to: date });
    const counts = {}; const bad = new Set();
    for (const d of recent) { for (const s of d.symptoms || []) counts[s] = (counts[s] || 0) + 1; if (d.feeling && d.feeling <= 2) bad.add(d.date); }
    const stats = { days: 90, entries: recent.length, bad_days: bad.size, symptoms: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
      visits: rows('visits').filter(v => v.date >= since).length, spent_year: rows('expenses').filter(e => e.date.slice(0, 4) === date.slice(0, 4)).reduce((s, e) => s + e.amount, 0) };
    const has_data = ['diary', 'visits', 'courses', 'labs'].some(t => rows(t).length > 0);
    return { date, courses: items, kok, reminders, episodes, diary, cycle, stats, has_data, last_backup: S.settings.last_backup || null };
  }

  function indicators() {
    const map = new Map();
    const labs = Object.fromEntries(rows('labs').map(l => [l.id, l]));
    for (const r of rows('lab_results')) {
      if (r.value == null) continue; const l = labs[r.lab_id]; if (!l) continue;
      const key = r.indicator.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { indicator: r.indicator.trim(), unit: r.unit, points: [] });
      const g = map.get(key); if (!g.unit && r.unit) g.unit = r.unit;
      g.points.push({ date: l.date, value: r.value, ref_min: r.ref_min, ref_max: r.ref_max, lab_id: l.id, lab_name: l.name });
    }
    for (const g of map.values()) g.points.sort((a, b) => a.date.localeCompare(b.date));
    return [...map.values()].sort((a, b) => a.indicator.localeCompare(b.indicator, 'ru', { sensitivity: 'base' }));
  }
  function indicatorNames() {
    const map = new Map();
    for (const r of sorted('lab_results', rows('lab_results'))) map.set(r.indicator.toLowerCase(), { indicator: r.indicator, unit: r.unit, ref_min: r.ref_min, ref_max: r.ref_max });
    return [...map.values()].sort((a, b) => a.indicator.localeCompare(b.indicator, 'ru', { sensitivity: 'base' }));
  }
  function expensesSummary(year) {
    year = String(year || todayStr().slice(0, 4));
    const items = sorted('expenses', rows('expenses').filter(e => e.date.slice(0, 4) === year));
    const by_category = {}, by_month = {}; let total = 0, deductible = 0;
    for (const e of items) { total += e.amount; if (e.deductible) deductible += e.amount; by_category[e.category || 'Другое'] = (by_category[e.category || 'Другое'] || 0) + e.amount; by_month[e.date.slice(0, 7)] = (by_month[e.date.slice(0, 7)] || 0) + e.amount; }
    const years = [...new Set(rows('expenses').map(e => e.date.slice(0, 4)))].sort().reverse();
    return { year, years, total, deductible, by_category, by_month, items: items.map(e => ({ ...e })) };
  }

  // ---------- Импорт цикла из Apple Health ----------
  function importBleedingDays(dayFlow) {
    const days = [...dayFlow.keys()].sort(); const runs = [];
    for (const d of days) { const last = runs[runs.length - 1]; if (last && daysBetween(last.end, d) <= 2) { last.end = d; last.flows.push(dayFlow.get(d)); } else runs.push({ start: d, end: d, flows: [dayFlow.get(d)] }); }
    const rank = { 'Скудные': 1, 'Обычные': 2, 'Обильные': 3 };
    let added = 0, updated = 0;
    for (const r of runs) {
      const flow = r.flows.filter(Boolean).sort((a, b) => (rank[b] || 0) - (rank[a] || 0))[0] || null;
      const ex = one('cycles', c => c.start_date >= addDays(r.start, -3) && c.start_date <= addDays(r.start, 3));
      if (ex) { const patch = {}; if (!ex.end_date || ex.end_date < r.end) patch.end_date = r.end; if (!ex.flow && flow) patch.flow = flow; if (Object.keys(patch).length) { update('cycles', ex.id, patch); updated++; } }
      else { insert('cycles', { start_date: r.start, end_date: r.end, flow, note: 'импорт' }); added++; }
    }
    return { episodes: runs.length, added, updated };
  }
  function importSpottingDays(days) {
    let added = 0;
    for (const d of days) { if (rows('diary').some(r => r.date === d && (r.symptoms || []).some(s => s.includes('Мазня')))) continue; insert('diary', { date: d, symptoms: ['Мазня / кровянистые выделения'], note: 'импорт из Apple Health' }); added++; }
    return added;
  }
  async function* readLines(file) {
    const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) { const { value, done } = await reader.read(); if (done) break; buf += value; let i; while ((i = buf.indexOf('\n')) >= 0) { yield buf.slice(0, i); buf = buf.slice(i + 1); } }
    if (buf) yield buf;
  }
  async function importAppleHealth(file) {
    const FLOW = { Light: 'Скудные', Medium: 'Обычные', Heavy: 'Обильные' };
    const menses = new Map(), spotting = new Set(); let records = 0;
    for await (const line of readLines(file)) {
      if (!line.includes('<Record ')) continue; records++;
      const type = /type="([^"]+)"/.exec(line)?.[1];
      if (type !== 'HKCategoryTypeIdentifierMenstrualFlow' && type !== 'HKCategoryTypeIdentifierIntermenstrualBleeding') continue;
      const date = /startDate="(\d{4}-\d{2}-\d{2})/.exec(line)?.[1]; if (!date) continue;
      if (type === 'HKCategoryTypeIdentifierIntermenstrualBleeding') { spotting.add(date); continue; }
      const val = /value="HKCategoryValueMenstrualFlow(\w+)"/.exec(line)?.[1]; if (val === 'None') continue;
      const flow = FLOW[val] || null;
      if (!menses.has(date) || (flow && !menses.get(date))) menses.set(date, flow);
    }
    if (!records) fail('Это не похоже на export.xml из приложения «Здоровье»');
    const cycles = importBleedingDays(menses);
    const spotting_added = importSpottingDays([...spotting].sort());
    await save();
    return { ok: true, records, menses_days: menses.size, spotting_days: spotting.size, spotting_added, ...cycles };
  }

  // ---------- Резервная копия ----------
  const blobToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  async function exportData({ withFiles = false } = {}) {
    await init();
    const data = { version: 1, exported_at: new Date().toISOString(), source: 'local', tables: {} };
    for (const t of Object.keys(TABLES)) data.tables[t] = sorted(t, rows(t)).sort((a, b) => a.id - b.id).map(r => ({ ...r }));
    if (withFiles) {
      data.blobs = {};
      for (const f of rows('files')) { const b = await getBlob(f.id); if (b) data.blobs[f.id] = { mime: b.type || f.mime, data: await blobToDataUrl(b) }; }
    }
    S.settings.last_backup = todayStr(); await save();
    return data;
  }
  async function importData(data) {
    if (!data || !data.tables) fail('Неверный формат файла');
    const next = emptyState();
    for (const t of Object.keys(TABLES)) {
      const src = Array.isArray(data.tables[t]) ? data.tables[t] : [];
      next.tables[t] = src.map(r => norm(t, { ...r }));
      next.seq[t] = src.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    }
    next.settings = { ...S.settings };
    await clearBlobs();
    if (data.blobs) {
      for (const [id, b] of Object.entries(data.blobs)) { const resp = await fetch(b.data); await putBlob(Number(id), await resp.blob()); }
    } else next.tables.files = []; // копия без файлов — список вложений не восстанавливаем, чтобы не было битых ссылок
    for (const u of urlCache.values()) URL.revokeObjectURL(u); urlCache.clear();
    S = next; await save();
    return { ok: true };
  }
  async function storageInfo() {
    let est = null, persisted = null;
    try { est = await navigator.storage?.estimate?.(); } catch {}
    try { persisted = await navigator.storage?.persisted?.(); } catch {}
    return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted, files: rows('files').length };
  }

  // ---------- Маршрутизация «как у сервера» ----------
  async function request(method, url, body) {
    await init();
    const [pathFull, qs] = String(url).split('?');
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    const path = pathFull.replace(/^.*?\/api\//, '/api/');
    const seg = path.replace(/^\/api\//, '').split('/').filter(Boolean);
    const fd = body instanceof FormData ? body : null;

    if (method === 'GET' && path === '/api/today') return today(q.date);
    if (method === 'POST' && path === '/api/intakes/toggle') {
      const { course_id, date, slot = 0 } = body || {};
      if (!course_id || !date) fail('course_id и date обязательны');
      const ex = one('intakes', i => i.course_id === Number(course_id) && i.date === date && i.slot === Number(slot));
      if (ex) { remove('intakes', ex.id); await save(); return { taken: false }; }
      insert('intakes', { course_id, date, slot, taken: 1, time: new Date().toTimeString().slice(0, 5) }); await save(); return { taken: true };
    }
    if (method === 'POST' && seg[0] === 'courses' && seg[2] === 'new-pack') {
      if (!get('courses', seg[1])) fail('Курс не найден', 404);
      const r = update('courses', seg[1], { start_date: body?.date || todayStr() }); await save(); return r;
    }
    if (method === 'GET' && path === '/api/labs/indicators') return indicators();
    if (method === 'GET' && path === '/api/labs/indicator-names') return indicatorNames();
    if (method === 'GET' && path === '/api/expenses/summary') return expensesSummary(q.year);
    if (method === 'GET' && path === '/api/export') return exportData();
    if (method === 'POST' && path === '/api/import') return importData(body);
    if (method === 'POST' && path === '/api/import/apple-health') { const f = fd?.get('file'); if (!f) fail('Нет файла'); return importAppleHealth(f); }
    if (path === '/api/settings/token') return { token: '' };
    if (method === 'POST' && path === '/api/upload') {
      const entity_type = fd.get('entity_type'), entity_id = Number(fd.get('entity_id'));
      if (!TABLES[entity_type] || !entity_id) fail('entity_type/entity_id обязательны');
      const out = [];
      for (const f of fd.getAll('files')) {
        const row = insert('files', { entity_type, entity_id, stored_name: `${Date.now()}-${f.name}`, original_name: f.name, mime: f.type, size: f.size });
        await putBlob(row.id, f); out.push({ ...row, url: await fileUrl(row.id) });
      }
      await save(); return out;
    }
    if (method === 'DELETE' && seg[0] === 'files' && seg[1]) { if (!get('files', seg[1])) fail('Файл не найден', 404); await deleteFile(seg[1]); await save(); return { ok: true }; }

    const t = seg[0], id = seg[1];
    if (!TABLES[t]) fail('Нет такой таблицы', 404);
    if (method === 'GET' && !id) return list(t, q);
    if (method === 'GET') {
      const row = get(t, id); if (!row) fail('Не найдено', 404);
      if (t === 'labs') row.results = sorted('lab_results', rows('lab_results').filter(r => r.lab_id === row.id)).map(r => ({ ...r }));
      row.files = await filesOf(t, row.id);
      return row;
    }
    if (method === 'POST' && !id) { const r = insert(t, body || {}); afterSave(t, r, body || {}); await save(); return get(t, r.id); }
    if (method === 'PUT' && id) { if (!get(t, id)) fail('Не найдено', 404); const r = update(t, id, body || {}); afterSave(t, r, body || {}); await save(); return get(t, id); }
    if (method === 'DELETE' && id) { beforeDelete(t, id); remove(t, id); await afterDelete(t, id); await save(); return { ok: true }; }
    fail('Неизвестный запрос', 404);
  }

  window.localApi = { request, exportData, importData, storageInfo, init };
})();
