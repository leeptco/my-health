'use strict';
// Слой данных: схема SQLite + простые CRUD-хелперы. Используется встроенный node:sqlite (Node >= 22.13).
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'health.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

-- Справочники
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT, address TEXT, phone TEXT, note TEXT,
  created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, specialty TEXT, phone TEXT, place_id INTEGER, note TEXT,
  created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS medications (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, form TEXT, strength TEXT, note TEXT,
  created_at TEXT DEFAULT (datetime('now')));

-- Эпизод болезни: связывает записи дневника, визиты, курсы и анализы
CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT,
  diagnosis TEXT, note TEXT, created_at TEXT DEFAULT (datetime('now')));

-- Дневник самочувствия
CREATE TABLE IF NOT EXISTS diary (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, time TEXT, feeling INTEGER, symptoms TEXT,
  severity INTEGER, temperature REAL, episode_id INTEGER, note TEXT,
  created_at TEXT DEFAULT (datetime('now')));

-- Визиты к врачам
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, time TEXT, doctor_id INTEGER, place_id INTEGER,
  episode_id INTEGER, reason TEXT, conclusion TEXT, diagnosis TEXT, referrals TEXT,
  next_date TEXT, cost REAL, note TEXT, created_at TEXT DEFAULT (datetime('now')));

-- Курс приёма препарата (в т.ч. постоянный, например КОК)
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY, medication_id INTEGER NOT NULL, episode_id INTEGER, visit_id INTEGER,
  doctor_id INTEGER, dose TEXT, per_day INTEGER DEFAULT 1, times TEXT, start_date TEXT NOT NULL,
  end_date TEXT, is_kok INTEGER DEFAULT 0, pack_size INTEGER, break_days INTEGER,
  purpose TEXT, cost REAL, note TEXT, active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')));

-- Отметки «выпила» по дням и приёмам
CREATE TABLE IF NOT EXISTS intakes (
  id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL, date TEXT NOT NULL, slot INTEGER NOT NULL DEFAULT 0,
  taken INTEGER DEFAULT 1, time TEXT, note TEXT,
  UNIQUE(course_id, date, slot));

-- Анализы и обследования
CREATE TABLE IF NOT EXISTS labs (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, name TEXT NOT NULL, place_id INTEGER, episode_id INTEGER,
  doctor_id INTEGER, cost REAL, note TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS lab_results (
  id INTEGER PRIMARY KEY, lab_id INTEGER NOT NULL, indicator TEXT NOT NULL, value REAL, value_text TEXT,
  unit TEXT, ref_min REAL, ref_max REAL);

-- Менструальный цикл
CREATE TABLE IF NOT EXISTS cycles (
  id INTEGER PRIMARY KEY, start_date TEXT NOT NULL, end_date TEXT, flow TEXT, note TEXT);

-- Расходы (часть создаётся автоматически из визитов/анализов/курсов)
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, amount REAL NOT NULL, category TEXT, title TEXT,
  place_id INTEGER, entity_type TEXT, entity_id INTEGER, deductible INTEGER DEFAULT 1, note TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS expenses_entity ON expenses(entity_type, entity_id) WHERE entity_type IS NOT NULL;

-- Напоминания
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, title TEXT NOT NULL, kind TEXT,
  entity_type TEXT, entity_id INTEGER, done INTEGER DEFAULT 0, note TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS reminders_entity ON reminders(entity_type, entity_id) WHERE entity_type IS NOT NULL;

-- Прикреплённые файлы (PDF, фото)
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, stored_name TEXT NOT NULL,
  original_name TEXT, mime TEXT, size INTEGER, uploaded_at TEXT DEFAULT (datetime('now')));

CREATE INDEX IF NOT EXISTS diary_date ON diary(date);
CREATE INDEX IF NOT EXISTS visits_date ON visits(date);
CREATE INDEX IF NOT EXISTS intakes_date ON intakes(date);
CREATE INDEX IF NOT EXISTS files_entity ON files(entity_type, entity_id);
`);

// Описание таблиц для универсального CRUD: какие колонки можно писать, какие хранятся как JSON, какие числовые.
const TABLES = {
  places:      { cols: ['name', 'type', 'address', 'phone', 'note'], order: 'name COLLATE NOCASE' },
  doctors:     { cols: ['name', 'specialty', 'phone', 'place_id', 'note'], num: ['place_id'], order: 'name COLLATE NOCASE' },
  medications: { cols: ['name', 'form', 'strength', 'note'], order: 'name COLLATE NOCASE' },
  episodes:    { cols: ['title', 'start_date', 'end_date', 'diagnosis', 'note'], order: 'start_date DESC' },
  diary:       { cols: ['date', 'time', 'feeling', 'symptoms', 'severity', 'temperature', 'episode_id', 'note'],
                 json: ['symptoms'], num: ['feeling', 'severity', 'temperature', 'episode_id'], order: 'date DESC, time DESC, id DESC' },
  visits:      { cols: ['date', 'time', 'doctor_id', 'place_id', 'episode_id', 'reason', 'conclusion', 'diagnosis', 'referrals', 'next_date', 'cost', 'note'],
                 num: ['doctor_id', 'place_id', 'episode_id', 'cost'], order: 'date DESC, time DESC' },
  courses:     { cols: ['medication_id', 'episode_id', 'visit_id', 'doctor_id', 'dose', 'per_day', 'times', 'start_date', 'end_date', 'is_kok', 'pack_size', 'break_days', 'purpose', 'cost', 'note', 'active'],
                 json: ['times'], num: ['medication_id', 'episode_id', 'visit_id', 'doctor_id', 'per_day', 'is_kok', 'pack_size', 'break_days', 'cost', 'active'], order: 'active DESC, start_date DESC' },
  intakes:     { cols: ['course_id', 'date', 'slot', 'taken', 'time', 'note'], num: ['course_id', 'slot', 'taken'], order: 'date DESC' },
  labs:        { cols: ['date', 'name', 'place_id', 'episode_id', 'doctor_id', 'cost', 'note'], num: ['place_id', 'episode_id', 'doctor_id', 'cost'], order: 'date DESC' },
  lab_results: { cols: ['lab_id', 'indicator', 'value', 'value_text', 'unit', 'ref_min', 'ref_max'], num: ['lab_id', 'value', 'ref_min', 'ref_max'], order: 'id' },
  cycles:      { cols: ['start_date', 'end_date', 'flow', 'note'], order: 'start_date DESC' },
  expenses:    { cols: ['date', 'amount', 'category', 'title', 'place_id', 'entity_type', 'entity_id', 'deductible', 'note'],
                 num: ['amount', 'place_id', 'entity_id', 'deductible'], order: 'date DESC, id DESC' },
  reminders:   { cols: ['date', 'title', 'kind', 'entity_type', 'entity_id', 'done', 'note'], num: ['entity_id', 'done'], order: 'done, date' },
  files:       { cols: ['entity_type', 'entity_id', 'stored_name', 'original_name', 'mime', 'size'], num: ['entity_id', 'size'], order: 'uploaded_at' },
};

const all = (sql, params = []) => db.prepare(sql).all(...params);
const one = (sql, params = []) => db.prepare(sql).get(...params);
const run = (sql, params = []) => db.prepare(sql).run(...params);

function parseRow(table, row) {
  if (!row) return row;
  for (const c of TABLES[table].json || []) {
    if (typeof row[c] === 'string') { try { row[c] = JSON.parse(row[c]); } catch { row[c] = []; } }
    else if (row[c] == null) row[c] = [];
  }
  return row;
}

// Приводит тело запроса к виду, пригодному для записи: только известные колонки, '' -> NULL, числа -> Number, JSON -> строка.
// Не переданные поля пропускаются — при INSERT сработают DEFAULT из схемы, при UPDATE они не тронутся.
function clean(table, body) {
  const t = TABLES[table];
  const out = {};
  for (const c of t.cols) {
    if (body[c] === undefined) continue;
    let v = body[c];
    if (v === '') v = null;
    if ((t.json || []).includes(c)) v = JSON.stringify(v ?? []);
    else if ((t.num || []).includes(c) && v !== null) { v = Number(v); if (Number.isNaN(v)) v = null; }
    else if (typeof v === 'boolean') v = v ? 1 : 0;
    out[c] = v;
  }
  return out;
}

function list(table, q = {}) {
  const t = TABLES[table];
  const where = [], params = [];
  for (const c of ['id', ...t.cols]) {
    if (q[c] !== undefined && q[c] !== '') { where.push(`${c} = ?`); params.push(q[c]); }
  }
  const dateCol = t.cols.includes('date') ? 'date' : t.cols.includes('start_date') ? 'start_date' : null;
  if (dateCol && q.from) { where.push(`${dateCol} >= ?`); params.push(q.from); }
  if (dateCol && q.to) { where.push(`${dateCol} <= ?`); params.push(q.to); }
  let sql = `SELECT * FROM ${table}` + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ` ORDER BY ${t.order}`;
  if (q.limit) { sql += ' LIMIT ?'; params.push(Number(q.limit)); }
  return all(sql, params).map(r => parseRow(table, r));
}

function get(table, id) { return parseRow(table, one(`SELECT * FROM ${table} WHERE id = ?`, [id])); }

function insert(table, body) {
  const data = clean(table, body);
  const cols = Object.keys(data);
  const r = cols.length
    ? run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map(c => data[c]))
    : run(`INSERT INTO ${table} DEFAULT VALUES`);
  return get(table, Number(r.lastInsertRowid));
}

function update(table, id, body) {
  const data = clean(table, body);
  const cols = Object.keys(data);
  if (cols.length) run(`UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => data[c]), id]);
  return get(table, id);
}

function remove(table, id) { return run(`DELETE FROM ${table} WHERE id = ?`, [id]).changes; }

function transaction(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { db, DATA_DIR, TABLES, all, one, run, list, get, insert, update, remove, transaction };
