'use strict';

// ===================== Константы =====================
const SYMPTOMS = [
  'Головная боль', 'Мигрень', 'Болит горло', 'Нет голоса', 'Насморк', 'Кашель', 'Температура',
  'Болит живот', 'Тянет поясницу / низ живота', 'Мочевой пузырь / цистит', 'Тошнота', 'Слабость',
  'Головокружение', 'Зубы', 'Плохой сон', 'Кожа / аллергия',
  'Тазовая боль', 'Болезненные месячные', 'Мазня / кровянистые выделения',
];
const hormTag = (c) => c.is_kok ? `<span class="tag accent">${c.break_days > 0 ? 'КОК' : 'гормоны'}</span>` : '';
const FEELINGS = { 1: ['😣', 'Очень плохо'], 2: ['😕', 'Плохо'], 3: ['😐', 'Так себе'], 4: ['🙂', 'Хорошо'], 5: ['😄', 'Отлично'] };
const MED_FORMS = ['Таблетки', 'Капсулы', 'Суспензия', 'Сироп', 'Порошок / саше', 'Капли', 'Спрей', 'Свечи', 'Мазь / крем / гель', 'Раствор', 'Инъекции', 'Пластырь', 'Ингаляции', 'Другое'];
const PLACE_TYPES = ['Поликлиника', 'Частная клиника', 'Стоматология', 'Лаборатория', 'Больница', 'Аптека', 'Другое'];
const SPECIALTIES = ['Терапевт', 'Гинеколог', 'Уролог', 'Стоматолог', 'ЛОР', 'Невролог', 'Гастроэнтеролог', 'Эндокринолог', 'Дерматолог', 'Офтальмолог', 'Кардиолог', 'Хирург', 'Психотерапевт', 'УЗИ / диагностика', 'Другое'];
const EXPENSE_CATS = ['Врач', 'Анализы', 'Лекарства', 'Стоматология', 'Обследование', 'Другое'];
const LAB_NAMES = ['Общий анализ крови', 'Общий анализ мочи', 'Биохимия крови', 'Посев мочи', 'Мазок', 'Витамин D', 'Ферритин', 'ТТГ', 'Гормоны', 'УЗИ', 'МРТ', 'КТ', 'Рентген', 'ЭКГ'];
const DEFAULT_TIMES = { 1: ['09:00'], 2: ['09:00', '21:00'], 3: ['09:00', '15:00', '21:00'], 4: ['08:00', '13:00', '18:00', '23:00'], 5: ['08:00', '12:00', '16:00', '20:00', '00:00'], 6: ['08:00', '11:00', '14:00', '17:00', '20:00', '23:00'] };
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_FULL = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

// ===================== Утилиты =====================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => new Date().toLocaleDateString('sv-SE');
const nowTime = () => new Date().toTimeString().slice(0, 5);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv-SE'); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
function fmtDate(d, withYear = true) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]}${withYear && y !== new Date().getFullYear() ? ' ' + y : ''}`;
}
function fmtDateLong(d) { const [y, m, day] = d.split('-').map(Number); const dt = new Date(y, m - 1, day); return `${day} ${MONTHS_FULL[m - 1]}, ${WEEKDAYS[dt.getDay()]}`; }
const money = (n) => (Number(n) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return n + ' ' + (a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many); };
const dateCol = (d) => { const [, m, day] = d.split('-').map(Number); return `<div class="date-col"><b>${day}</b>${MONTHS[m - 1]}</div>`; };
const groupBy = (arr, fn) => arr.reduce((acc, x) => { const k = fn(x); (acc[k] ||= []).push(x); return acc; }, {});
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

let toastTimer;
function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, err ? 4000 : 2000);
}

// ===================== API =====================
const LOCAL = !!window.localApi; // автономный режим: данные в этом устройстве, сервера нет
async function api(method, url, body) {
  if (LOCAL) {
    try { return await window.localApi.request(method, url, body); }
    catch (e) { toast(e.message || 'Ошибка', true); throw e; }
  }
  const isForm = body instanceof FormData;
  const r = await fetch(url, { method, headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { location.href = '/login.html'; throw new Error('auth'); }
  if (!r.ok) { const e = await r.json().catch(() => ({ error: r.statusText })); toast(e.error || 'Ошибка', true); throw new Error(e.error); }
  return r.json();
}
const GET = (u) => api('GET', u), POST = (u, b) => api('POST', u, b), PUT = (u, b) => api('PUT', u, b), DEL = (u) => api('DELETE', u);
const save = (table, data) => data.id ? PUT(`/api/${table}/${data.id}`, data) : POST(`/api/${table}`, data);

// ===================== Справочники (кэш) =====================
const refs = { doctors: [], places: [], medications: [], episodes: [] };
async function loadRefs() {
  const [d, p, m, e] = await Promise.all([GET('/api/doctors'), GET('/api/places'), GET('/api/medications'), GET('/api/episodes')]);
  Object.assign(refs, { doctors: d, places: p, medications: m, episodes: e });
}
const byId = (list, id) => list.find(x => x.id === Number(id));
const doctor = (id) => byId(refs.doctors, id);
const place = (id) => byId(refs.places, id);
const med = (id) => byId(refs.medications, id);
const episode = (id) => byId(refs.episodes, id);
const docLabel = (d) => d ? `${d.name}${d.specialty ? ' · ' + d.specialty : ''}` : '';
const medLabel = (m) => m ? [m.name, m.strength, m.form ? m.form.toLowerCase() : ''].filter(Boolean).join(' ') : '';

// ===================== Sheet (модальная форма) =====================
const sheet = { onSubmit: null, open: false, pushed: false, scrollY: 0 };
// На iPhone клавиатура уменьшает видимую область, а не окно: подгоняем размеры модалки под visualViewport
function syncViewport() {
  const vv = window.visualViewport; if (!vv) return;
  const s = document.documentElement.style;
  s.setProperty('--vvh', vv.height + 'px');
  s.setProperty('--vv-top', vv.offsetTop + 'px');
}
if (window.visualViewport) { visualViewport.addEventListener('resize', syncViewport); visualViewport.addEventListener('scroll', syncViewport); }

function openSheet({ title, body, submit = 'Сохранить', onSubmit, onDelete, deleteConfirm = 'Удалить запись?' }) {
  $('#sheet-title').textContent = title;
  const form = $('#sheet-form'); form.innerHTML = body;
  const foot = $('#sheet-foot'); foot.innerHTML = '';
  if (onDelete) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn danger'; b.textContent = '🗑';
    b.onclick = async () => { if (!confirm(deleteConfirm)) return; await onDelete(); closeSheet(); };
    foot.appendChild(b);
  }
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn cancel'; cancel.textContent = 'Отмена';
  cancel.onclick = () => closeSheet();
  foot.appendChild(cancel);
  if (onSubmit) {
    const b = document.createElement('button'); b.type = 'submit'; b.className = 'btn primary'; b.textContent = submit; b.setAttribute('form', 'sheet-form');
    foot.appendChild(b);
  }
  sheet.onSubmit = onSubmit;
  if (!sheet.open) {
    sheet.scrollY = window.scrollY;
    document.body.classList.add('sheet-open');
    document.body.style.top = -sheet.scrollY + 'px';
    // запись в историю: системная кнопка «назад» закрывает окно, а не уводит со страницы
    history.pushState({ sheet: true }, '');
    sheet.pushed = true;
  }
  sheet.open = true;
  syncViewport();
  $('#sheet').hidden = false;
  $('.sheet-body').scrollTop = 0;
  if (matchMedia('(min-width: 700px)').matches) form.querySelector('input:not([type=hidden]):not([type=date]):not([type=time]),textarea,select')?.focus();
}
function closeSheet(fromHistory = false) {
  if (!sheet.open) return;
  if (!fromHistory && sheet.pushed) { sheet.pushed = false; history.back(); return; } // popstate вызовет closeSheet(true)
  sheet.pushed = false; sheet.open = false; sheet.onSubmit = null;
  $('#sheet').hidden = true;
  document.body.classList.remove('sheet-open'); document.body.style.top = '';
  window.scrollTo(0, sheet.scrollY);
  document.activeElement?.blur?.();
}
window.addEventListener('popstate', () => { if (sheet.open) closeSheet(true); });

function formData(form) {
  const d = {};
  for (const el of form.elements) {
    if (!el.name || el.name.endsWith('[]') || el.name.startsWith('__')) continue;
    if (el.type === 'checkbox') d[el.name] = el.checked ? 1 : 0;
    else if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
    else d[el.name] = el.value.trim ? el.value.trim() : el.value;
  }
  return d;
}

// ===================== Поля форм =====================
const F = {
  text: (name, label, value = '', attrs = '') => `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" ${attrs}></label>`,
  number: (name, label, value = '', attrs = '') => `<label class="field"><span>${label}</span><input type="number" inputmode="decimal" name="${name}" value="${esc(value)}" ${attrs}></label>`,
  date: (name, label, value = '', attrs = '') => `<label class="field"><span>${label}</span><input type="date" name="${name}" value="${esc(value)}" ${attrs}></label>`,
  time: (name, label, value = '') => `<label class="field"><span>${label}</span><input type="time" name="${name}" value="${esc(value)}"></label>`,
  area: (name, label, value = '', ph = '') => `<label class="field"><span>${label}</span><textarea name="${name}" placeholder="${esc(ph)}">${esc(value)}</textarea></label>`,
  check: (name, label, checked, attrs = '') => `<label class="check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} ${attrs}><span>${label}</span></label>`,
  select: (name, label, options, value, { none = '— не выбрано —', attrs = '' } = {}) =>
    `<label class="field"><span>${label}</span><select name="${name}" ${attrs}>${none !== null ? `<option value="">${none}</option>` : ''}${options.map(o => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select></label>`,
  datalist: (id, items) => `<datalist id="${id}">${items.map(i => `<option value="${esc(i)}">`).join('')}</datalist>`,
  hidden: (name, value) => `<input type="hidden" name="${name}" value="${esc(value)}">`,
};

// Select по справочнику с пунктом «＋ Добавить» и раскрывающимися полями для нового элемента
function refSelect(kind, value, label) {
  const conf = {
    doctor: { name: 'doctor_id', items: refs.doctors, lbl: docLabel, add: '＋ Новый врач', fields: `
      ${F.text('new_doctor_name', 'ФИО врача', '', 'placeholder="Иванова Анна Петровна"')}
      <div class="field-row">${F.select('new_doctor_specialty', 'Специальность', SPECIALTIES, '', { none: '—' })}${F.text('new_doctor_phone', 'Телефон')}</div>` },
    place: { name: 'place_id', items: refs.places, lbl: p => p.name + (p.address ? ' · ' + p.address : ''), add: '＋ Новое место', fields: `
      ${F.text('new_place_name', 'Название', '', 'placeholder="Поликлиника №3, Клиника «Мать и дитя»…"')}
      <div class="field-row">${F.select('new_place_type', 'Тип', PLACE_TYPES, '', { none: '—' })}${F.text('new_place_address', 'Адрес')}</div>` },
    medication: { name: 'medication_id', items: refs.medications, lbl: medLabel, add: '＋ Новый препарат', fields: `
      ${F.text('new_med_name', 'Название препарата', '', 'placeholder="Монурал, Канефрон, Джес…"')}
      <div class="field-row">${F.select('new_med_form', 'Форма', MED_FORMS, 'Таблетки', { none: null })}${F.text('new_med_strength', 'Дозировка', '', 'placeholder="500 мг, 3 г, 5 мл"')}</div>` },
    episode: { name: 'episode_id', items: refs.episodes, lbl: e => `${e.title} (${fmtDate(e.start_date)}${e.end_date ? ' – ' + fmtDate(e.end_date) : ', сейчас'})`, add: '＋ Новая болезнь / эпизод', fields: `
      ${F.text('new_episode_title', 'Название', '', 'placeholder="Цистит, ОРВИ, мигрень…"')}${F.date('new_episode_start', 'Началось', todayStr())}` },
  }[kind];
  const options = conf.items.map(i => `<option value="${i.id}" ${Number(value) === i.id ? 'selected' : ''}>${esc(conf.lbl(i))}</option>`).join('');
  return `<label class="field"><span>${label}</span><select name="${conf.name}" data-inline-new="${kind}">
      <option value="">— не выбрано —</option>${options}<option value="__new__">${conf.add}</option></select></label>
    <div class="inline-new" data-inline-for="${kind}" hidden>${conf.fields}</div>`;
}

// Создаёт новые записи справочников, выбранные через «＋ Добавить», и подставляет их id
async function resolveNew(d) {
  let changed = false;
  if (d.place_id === '__new__') {
    if (!d.new_place_name) throw toast('Укажи название места', true);
    const p = await POST('/api/places', { name: d.new_place_name, type: d.new_place_type, address: d.new_place_address });
    d.place_id = p.id; changed = true;
  }
  if (d.doctor_id === '__new__') {
    if (!d.new_doctor_name) throw toast('Укажи ФИО врача', true);
    const doc = await POST('/api/doctors', { name: d.new_doctor_name, specialty: d.new_doctor_specialty, phone: d.new_doctor_phone, place_id: d.place_id || null });
    d.doctor_id = doc.id; changed = true;
  }
  if (d.medication_id === '__new__') {
    if (!d.new_med_name) throw toast('Укажи название препарата', true);
    const m = await POST('/api/medications', { name: d.new_med_name, form: d.new_med_form, strength: d.new_med_strength });
    d.medication_id = m.id; changed = true;
  }
  if (d.episode_id === '__new__') {
    if (!d.new_episode_title) throw toast('Укажи название эпизода', true);
    const e = await POST('/api/episodes', { title: d.new_episode_title, start_date: d.new_episode_start || todayStr() });
    d.episode_id = e.id; changed = true;
  }
  for (const k of Object.keys(d)) if (k.startsWith('new_')) delete d[k];
  if (changed) await loadRefs();
  return d;
}

// ---- файлы ----
function filesBlock(files = [], label = 'Документы (PDF, фото)') {
  return `<div class="field-label">${label}</div>
    <div class="files">${files.map(fileRow).join('')}</div>
    <input type="file" name="__files" multiple accept="image/*,.pdf,.doc,.docx,.heic,.txt">`;
}
const fileHref = (f) => f.url || `/files/${f.id}`;
function fileRow(f) {
  const isImg = (f.mime || '').startsWith('image/');
  return `<div class="file" data-file-id="${f.id}">${isImg ? `<img class="thumb" src="${fileHref(f)}" alt="">` : '<span>📄</span>'}
    <a href="${fileHref(f)}" target="_blank" rel="noopener">${esc(f.original_name || 'файл')}</a>
    <span class="muted small nowrap">${Math.round((f.size || 0) / 1024)} КБ</span>
    <button type="button" class="del" data-del-file="${f.id}" title="Удалить">✕</button></div>`;
}
async function uploadFiles(form, entityType, entityId) {
  const input = form.querySelector('input[name="__files"]');
  if (!input || !input.files.length) return;
  const fd = new FormData();
  fd.append('entity_type', entityType); fd.append('entity_id', entityId);
  for (const f of input.files) fd.append('files', f);
  await POST('/api/upload', fd);
}
async function loadFull(table, id) { return id ? GET(`/api/${table}/${id}`) : null; }

// ===================== Графики (SVG, без библиотек) =====================
function lineChart(points, { refMin, refMax, unit } = {}) {
  if (!points.length) return '<p class="muted">Нет данных</p>';
  const W = 520, H = 220, L = 44, R = 16, T = 22, B = 34;
  const vals = points.map(p => p.value);
  let lo = Math.min(...vals, refMin ?? Infinity), hi = Math.max(...vals, refMax ?? -Infinity);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
  const x = (i) => points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  if (refMin != null || refMax != null) {
    const y1 = y(refMax ?? hi), y2 = y(refMin ?? lo);
    s += `<rect x="${L}" y="${y1}" width="${W - L - R}" height="${Math.max(0, y2 - y1)}" fill="#2f7d6d" opacity="0.10"/>`;
    if (refMin != null) s += `<text x="${L - 4}" y="${y(refMin) + 4}" text-anchor="end">${refMin}</text>`;
    if (refMax != null) s += `<text x="${L - 4}" y="${y(refMax) + 4}" text-anchor="end">${refMax}</text>`;
  }
  s += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#e6e2d9"/>`;
  if (points.length > 1) s += `<polyline fill="none" stroke="#2f7d6d" stroke-width="2.5" stroke-linejoin="round" points="${points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}"/>`;
  points.forEach((p, i) => {
    const out = (p.ref_min != null && p.value < p.ref_min) || (p.ref_max != null && p.value > p.ref_max);
    s += `<circle cx="${x(i)}" cy="${y(p.value)}" r="5" fill="${out ? '#c2453a' : '#2f7d6d'}" stroke="#fff" stroke-width="2"/>`;
    s += `<text x="${x(i)}" y="${y(p.value) - 10}" text-anchor="middle" style="fill:${out ? '#c2453a' : '#1c1c1e'};font-weight:600">${p.value}</text>`;
    if (points.length <= 8 || i % Math.ceil(points.length / 8) === 0) s += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle">${fmtDate(p.date)}</text>`;
  });
  if (unit) s += `<text x="${L}" y="${T - 6}">${esc(unit)}</text>`;
  return s + '</svg>';
}
function hbars(items, { max } = {}) {
  if (!items.length) return '<p class="muted small">Пока нет данных</p>';
  const m = max ?? Math.max(...items.map(i => i.n), 1);
  return `<div class="bars">${items.map(i => `<div class="bar"><span class="ellipsis">${esc(i.name)}</span><div class="track"><div style="width:${(100 * i.n) / m}%"></div></div><span class="n">${i.label ?? i.n}</span></div>`).join('')}</div>`;
}

// ===================== Views =====================
const view = $('#view');
const render = (html) => { view.innerHTML = html; window.scrollTo(0, 0); };
const fab = (act) => `<button class="fab" data-act="${act}" aria-label="Добавить">＋</button>`;
const pageHead = (title, sub, actions = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="row no-print">${actions}</div></div>`;
const addBtn = (act, label) => `<button class="btn primary small desk-only" data-act="${act}">＋ ${label}</button>`;

// ---------- Сегодня ----------
async function viewToday() {
  const [t, upcomingVisits] = await Promise.all([GET('/api/today?date=' + todayStr()), GET(`/api/visits?from=${todayStr()}&to=${addDays(todayStr(), 30)}`)]);
  const upcoming = upcomingVisits.filter(v => v.date > todayStr() || !v.conclusion).sort((a, b) => a.date.localeCompare(b.date));
  const visitsCard = upcoming.length ? `<div class="card"><div class="card-title"><h2>🩺 Ближайшие визиты</h2><a href="#visits" class="small">Все →</a></div>
      ${upcoming.map(v => { const d = doctor(v.doctor_id), p = place(v.place_id); return `<div class="pill-row" data-act="visit-edit" data-id="${v.id}" style="cursor:pointer"><div class="info"><div class="name">${d ? esc(d.name) : 'Врач'}${d?.specialty ? ` <span class="muted">· ${esc(d.specialty)}</span>` : ''}</div>
        <div class="dose">${fmtDate(v.date)}${v.time ? ' в ' + v.time : ''} · ${untilLabel(v.date, t.date)}${p ? ' · 📍 ' + esc(p.name) : ''}</div></div><span class="muted">›</span></div>`; }).join('')}</div>` : '';
  const feelRow = Object.entries(FEELINGS).map(([v, [e, l]]) => `<button class="feel-btn" data-act="diary-new" data-feeling="${v}" title="${l}">${e}<small>${l}</small></button>`).join('');

  const pills = t.courses.length ? t.courses.map(c => `
    <div class="pill-row">
      <div class="info"><div class="name">${esc(c.med_name)} ${hormTag(c)}</div>
        <div class="dose">${esc([c.dose, c.med_strength, c.med_form?.toLowerCase()].filter(Boolean).join(' · '))}${c.purpose ? ' — ' + esc(c.purpose) : ''}${c.end_date ? ` · до ${fmtDate(c.end_date)}` : ''}</div></div>
      ${c.on_break ? '<span class="tag">перерыв</span>' : `<div class="slots">${c.slots.map(s => `<button class="slot ${s.taken ? 'on' : ''}" data-act="toggle-intake" data-course="${c.id}" data-slot="${s.slot}">${s.taken ? '✓ ' : ''}${s.time || (c.per_day > 1 ? `${s.slot + 1}-й` : 'выпить')}</button>`).join('')}</div>`}
    </div>`).join('') : '<p class="muted">Активных курсов нет. <a href="#meds">Добавить лекарство →</a></p>';

  let kokCard = '';
  if (t.kok) {
    const k = t.kok;
    const pct = k.on_break ? 100 : Math.round((100 * k.pill) / k.pack_size);
    kokCard = `<div class="card">
      <div class="card-title"><h2>🌙 ${esc(k.name)}</h2><a href="#cycle" class="small">Цикл →</a></div>
      ${k.on_break
        ? `<p><b>Перерыв</b>: день ${k.break_day} из ${k.break_days}. Новая пачка — <b>${fmtDate(k.next_pack)}</b>.</p>`
        : `<p><b>Таблетка ${k.pill} из ${k.pack_size}</b>. Последняя в пачке — ${fmtDate(k.last_pill)}${k.break_days ? `, перерыв до ${fmtDate(k.next_pack)}` : ''}.</p>`}
      <div class="progress ${k.missed.length ? 'warn' : ''}"><div style="width:${pct}%"></div></div>
      ${k.missed.length ? `<p class="mt small" style="color:var(--warn)">⚠️ Нет отметки за: ${k.missed.map(d => fmtDate(d)).join(', ')}</p>` : ''}
      <div class="row mt wrap"><button class="btn small ghost" data-act="new-pack" data-course="${k.course_id}">Начать новую пачку сегодня</button></div>
    </div>`;
  }

  const rem = t.reminders.length ? t.reminders.map(r => {
    const over = r.date < t.date, isToday = r.date === t.date;
    return `<div class="pill-row"><div class="info"><div class="name">${esc(r.title)}</div>
      <div class="dose" style="${over ? 'color:var(--danger)' : isToday ? 'color:var(--warn)' : ''}">${over ? 'Просрочено · ' : isToday ? 'Сегодня · ' : ''}${fmtDate(r.date)}${r.note ? ' — ' + esc(r.note) : ''}</div></div>
      <button class="slot" data-act="reminder-done" data-id="${r.id}">✓</button>
      <button class="icon-btn" data-act="reminder-edit" data-id="${r.id}" aria-label="Изменить">✎</button></div>`;
  }).join('') : '<p class="muted">Ближайших напоминаний нет</p>';

  const eps = t.episodes.length ? t.episodes.map(e => `<div class="pill-row" data-act="episode-edit" data-id="${e.id}" style="cursor:pointer"><div class="info"><div class="name">${esc(e.title)}</div><div class="dose">с ${fmtDate(e.start_date)} · ${plural(daysBetween(e.start_date, t.date) + 1, 'день', 'дня', 'дней')}${e.diagnosis ? ' · ' + esc(e.diagnosis) : ''}</div></div><span class="muted">›</span></div>`).join('') : '';

  const diary = t.diary.length ? t.diary.map(d => diaryItem(d)).join('') : '<p class="muted">Записей пока нет</p>';

  const cyc = t.cycle ? `<div class="stat"><div class="v">${t.cycle.day}</div><div class="l">день цикла · след. ~${fmtDate(t.cycle.next_predicted)}</div></div>` : '';

  // напоминание о резервной копии: раз в месяц, только если есть что копировать
  const backupDue = t.has_data && (!t.last_backup || daysBetween(t.last_backup, t.date) >= 30);
  const backupCard = backupDue ? `<div class="card" style="border:1px solid var(--warn);background:var(--warn-soft)">
      <div class="card-title"><h2>💾 Пора сделать резервную копию</h2></div>
      <p class="small">${t.last_backup ? `Последняя копия — ${fmtDate(t.last_backup)}.` : 'Копий ещё не было.'} Скачай файл и положи в облако или на другой диск. Файлы анализов лежат отдельно в <code>data\\uploads</code>.</p>
      ${LOCAL ? '<button class="btn small primary" data-act="backup" data-files="1">Сохранить копию</button>' : '<a class="btn small primary" href="/api/export" download data-act="backup-done">Скачать копию</a>'}</div>` : '';

  render(`
    ${pageHead('Сегодня', fmtDateLong(t.date))}
    ${backupCard}
    <div class="card"><h3>Как самочувствие?</h3><div class="feel-picker" style="margin:0">${feelRow}</div></div>
    ${visitsCard}
    <div class="card"><div class="card-title"><h2>💊 Лекарства сегодня</h2><a href="#meds" class="small">Все →</a></div>${pills}</div>
    ${kokCard}
    <div class="card"><div class="card-title"><h2>🔔 Напоминания</h2><button class="btn small ghost" data-act="reminder-new">＋ Добавить</button></div>${rem}</div>
    ${eps ? `<div class="card"><div class="card-title"><h2>🤒 Сейчас болею</h2><a href="#episodes" class="small">Все →</a></div>${eps}</div>` : ''}
    <div class="grid3">
      <div class="stat"><div class="v">${t.stats.bad_days}</div><div class="l">плохих дней за 90</div></div>
      <div class="stat"><div class="v">${t.stats.visits}</div><div class="l">визитов за 90 дней</div></div>
      ${cyc || `<div class="stat"><div class="v">${money(t.stats.spent_year)}</div><div class="l">расходы за ${t.date.slice(0, 4)}</div></div>`}
    </div>
    <div class="card mt"><div class="card-title"><h2>📊 Симптомы за 90 дней</h2></div>${hbars(t.stats.symptoms)}</div>
    <div class="card"><div class="card-title"><h2>📝 Последние записи</h2><a href="#diary" class="small">Дневник →</a></div><div class="list">${diary}</div></div>
  `);
}

// ---------- Дневник ----------
const diaryState = { filter: null };
function diaryItem(d) {
  const f = FEELINGS[d.feeling];
  return `<div class="item" data-act="diary-edit" data-id="${d.id}">
    <div class="feel">${f ? f[0] : '📝'}</div>
    <div class="body">
      <div class="title">${fmtDate(d.date)}${d.time ? ' · ' + d.time : ''}${d.severity ? ` <span class="tag ${d.severity >= 7 ? 'danger' : d.severity >= 4 ? 'warn' : ''}">боль ${d.severity}/10</span>` : ''}${d.temperature ? ` <span class="tag warn">${d.temperature}°</span>` : ''}</div>
      <div>${(d.symptoms || []).map(s => `<span class="tag">${esc(s)}</span>`).join('') || `<span class="muted small">${f ? f[1] : ''}</span>`}</div>
      ${d.note ? `<div class="meta">${esc(d.note)}</div>` : ''}
      ${d.episode_id && episode(d.episode_id) ? `<div class="meta">🤒 ${esc(episode(d.episode_id).title)}</div>` : ''}
    </div></div>`;
}
async function viewDiary() {
  const all = await GET('/api/diary');
  const used = [...new Set(all.flatMap(d => d.symptoms || []))];
  const items = diaryState.filter ? all.filter(d => (d.symptoms || []).includes(diaryState.filter)) : all;
  const groups = groupBy(items, d => d.date.slice(0, 7));
  render(`
    ${pageHead('Дневник', plural(all.length, 'запись', 'записи', 'записей'), addBtn('diary-new', 'Запись'))}
    ${used.length ? `<div class="chips mb"><span class="chip ${!diaryState.filter ? 'on' : ''}" data-act="filter-sym" data-sym="">Все</span>${used.map(s => `<span class="chip ${diaryState.filter === s ? 'on' : ''}" data-act="filter-sym" data-sym="${esc(s)}">${esc(s)}</span>`).join('')}</div>` : ''}
    ${items.length ? Object.entries(groups).map(([m, list]) => `<div class="group-label">${MONTHS_NOM[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</div><div class="list">${list.map(diaryItem).join('')}</div>`).join('')
      : '<div class="empty">Записей нет. Нажми ＋, чтобы записать, как ты себя чувствуешь.</div>'}
    ${fab('diary-new')}
  `);
}
async function diaryForm(row = {}, preset = {}) {
  const r = { date: todayStr(), time: nowTime(), symptoms: [], ...row, ...preset };
  openSheet({
    title: row.id ? 'Запись дневника' : 'Как самочувствие?',
    body: `
      ${F.hidden('feeling', r.feeling ?? '')}
      <div class="feel-picker">${Object.entries(FEELINGS).map(([v, [e, l]]) => `<button type="button" class="${Number(r.feeling) === Number(v) ? 'on' : ''}" data-feel="${v}">${e}<small>${l}</small></button>`).join('')}</div>
      <div class="field-row">${F.date('date', 'Дата', r.date, 'required')}${F.time('time', 'Время', r.time || '')}</div>
      <div class="field-label">Что беспокоит</div>
      ${F.hidden('symptoms', JSON.stringify(r.symptoms || []))}
      <div class="chips mb" id="sym-chips">${[...new Set([...SYMPTOMS, ...(r.symptoms || [])])].map(s => `<span class="chip ${(r.symptoms || []).includes(s) ? 'on' : ''}" data-sym="${esc(s)}">${esc(s)}</span>`).join('')}</div>
      ${F.text('__custom_sym', 'Другой симптом', '', 'placeholder="Напиши и нажми Enter" data-custom-sym')}
      <label class="field"><span>Насколько сильно болит / беспокоит: <b id="sev-out">${r.severity ?? 0}</b>/10</span><input type="range" name="severity" min="0" max="10" value="${r.severity ?? 0}" data-range="sev-out"></label>
      <div class="field-row">${F.number('temperature', 'Температура, °C', r.temperature ?? '', 'step="0.1" min="34" max="43" placeholder="36.6"')}<div></div></div>
      ${refSelect('episode', r.episode_id, 'Относится к болезни')}
      ${F.area('note', 'Заметка', r.note, 'Что ела, сколько спала, что помогло…')}
    `,
    onSubmit: async (d, form) => {
      const custom = form.querySelector('[data-custom-sym]').value.trim();
      const syms = JSON.parse(d.symptoms || '[]');
      if (custom && !syms.includes(custom)) syms.push(custom);
      d.symptoms = syms;
      if (Number(d.severity) === 0) d.severity = null;
      await resolveNew(d);
      await save('diary', { ...d, id: row.id });
      toast('Сохранено'); route();
    },
    onDelete: row.id ? async () => { await DEL(`/api/diary/${row.id}`); toast('Удалено'); route(); } : null,
  });
}

// ---------- Визиты ----------
const untilLabel = (date, today) => { const n = daysBetween(today, date); return n === 0 ? 'сегодня' : n === 1 ? 'завтра' : `через ${plural(n, 'день', 'дня', 'дней')}`; };
function visitItem(v, today = todayStr()) {
  const d = doctor(v.doctor_id), p = place(v.place_id);
  const future = v.date > today || (v.date === today && !v.conclusion);
  return `<div class="item" data-act="visit-edit" data-id="${v.id}">${dateCol(v.date)}
    <div class="body">
      <div class="title">${d ? esc(d.name) : 'Врач не указан'}${d?.specialty ? ` <span class="muted">· ${esc(d.specialty)}</span>` : ''}${future && v.date >= today ? ` <span class="tag accent">${untilLabel(v.date, today)}${v.time ? ' · ' + v.time : ''}</span>` : ''}</div>
      ${p ? `<div class="sub">📍 ${esc(p.name)}${p.address ? ', ' + esc(p.address) : ''}</div>` : ''}
      ${future && v.reason ? `<div class="meta">${esc(v.reason)}</div>` : ''}
      ${v.diagnosis ? `<div class="meta"><b>Диагноз:</b> ${esc(v.diagnosis)}</div>` : ''}
      ${v.conclusion ? `<div class="meta ellipsis">${esc(v.conclusion)}</div>` : ''}
      <div>${v.next_date ? `<span class="tag ${v.next_date >= todayStr() ? 'accent' : ''}">повтор ${fmtDate(v.next_date)}</span>` : ''}${v.referrals ? '<span class="tag warn">направления</span>' : ''}${v.cost ? `<span class="tag">${money(v.cost)}</span>` : ''}${v.episode_id && episode(v.episode_id) ? `<span class="tag">🤒 ${esc(episode(v.episode_id).title)}</span>` : ''}</div>
    </div></div>`;
}
async function viewVisits() {
  const all = await GET('/api/visits');
  const today = todayStr();
  const upcoming = all.filter(v => v.date > today).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  const past = all.filter(v => v.date <= today);
  // прошлые визиты, где врач назначил повтор, а записи на него ещё нет
  const planned = past.filter(v => v.next_date && v.next_date >= today && !all.some(x => x.date === v.next_date && x.doctor_id === v.doctor_id));
  const groups = groupBy(past, v => v.date.slice(0, 4));
  const plannedHtml = planned.map(v => { const d = doctor(v.doctor_id); return `<div class="item" data-act="visit-plan" data-id="${v.id}" style="border:1px dashed var(--line);box-shadow:none;background:transparent">${dateCol(v.next_date)}
      <div class="body"><div class="title muted">Повторный визит: ${d ? esc(d.name) : 'врач'}${d?.specialty ? ` · ${esc(d.specialty)}` : ''}</div>
      <div class="sub">назначен на визите ${fmtDate(v.date)} · <span style="color:var(--accent)">создать запись →</span></div></div></div>`; }).join('');
  render(`
    ${pageHead('Визиты к врачам', plural(all.length, 'визит', 'визита', 'визитов'), addBtn('visit-new', 'Визит'))}
    <div class="group-label">Предстоящие</div>
    <div class="list">${upcoming.length || planned.length ? upcoming.map(v => visitItem(v, today)).join('') + plannedHtml : '<div class="empty">Ничего не запланировано. Чтобы записаться — нажми ＋ и поставь будущую дату.</div>'}</div>
    <div class="group-label">Прошедшие</div>
    ${past.length ? Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).map(([y, list]) => `<div class="group-label small" style="margin-top:6px">${y}</div><div class="list">${list.map(v => visitItem(v, today)).join('')}</div>`).join('')
      : '<div class="empty">Визитов пока нет. Нажми ＋ и запиши, что сказал врач.</div>'}
    ${fab('visit-new')}
  `);
}
async function visitForm(id, preset = {}) {
  const row = id ? await loadFull('visits', id) : { date: todayStr(), time: '', doctor_id: ls.get('last_doctor'), place_id: ls.get('last_place'), ...preset };
  openSheet({
    title: id ? (row.date > todayStr() ? 'Предстоящий визит' : 'Визит') : 'Новый визит',
    body: `
      <p class="small muted">Будущая дата — это запись к врачу, она попадёт в «Предстоящие» и на главную. После приёма открой её и допиши, что сказал врач.</p>
      <div class="field-row">${F.date('date', 'Дата', row.date, 'required')}${F.time('time', 'Время', row.time || '')}</div>
      ${refSelect('doctor', row.doctor_id, 'Врач')}
      ${refSelect('place', row.place_id, 'Где')}
      ${refSelect('episode', row.episode_id, 'Относится к болезни')}
      ${F.area('reason', 'С чем пришла', row.reason, 'Жалобы, повод визита')}
      ${F.area('conclusion', 'Что сказал врач', row.conclusion, 'Заключение, рекомендации, что назначил')}
      ${F.text('diagnosis', 'Диагноз', row.diagnosis)}
      ${F.area('referrals', 'Направления / что дальше', row.referrals, 'К какому врачу, какие анализы, куда')}
      <div class="field-row">${F.date('next_date', 'Повторный визит', row.next_date)}${F.number('cost', 'Стоимость, ₽', row.cost ?? '', 'step="1" min="0"')}</div>
      ${F.area('note', 'Заметка', row.note)}
      ${filesBlock(row.files)}
    `,
    onSubmit: async (d, form) => {
      await resolveNew(d);
      const saved = await save('visits', { ...d, id });
      await uploadFiles(form, 'visits', saved.id);
      if (d.doctor_id) ls.set('last_doctor', d.doctor_id);
      if (d.place_id) ls.set('last_place', d.place_id);
      toast('Сохранено'); route();
    },
    onDelete: id ? async () => { await DEL(`/api/visits/${id}`); toast('Удалено'); route(); } : null,
  });
}

// ---------- Лекарства ----------
function courseItem(c, today) {
  const m = med(c.medication_id);
  const left = c.end_date ? daysBetween(today, c.end_date) : null;
  const total = c.end_date ? daysBetween(c.start_date, c.end_date) + 1 : null;
  const done = total ? Math.min(total, Math.max(0, daysBetween(c.start_date, today) + 1)) : null;
  return `<div class="item" data-act="course-edit" data-id="${c.id}">
    <div class="feel">${c.is_kok ? '🌙' : '💊'}</div>
    <div class="body">
      <div class="title">${esc(m?.name || 'Препарат')} ${m?.strength ? `<span class="muted">${esc(m.strength)}</span>` : ''} ${hormTag(c)}</div>
      <div class="sub">${esc([m?.form, c.dose, c.per_day ? `${c.per_day} р/день` : ''].filter(Boolean).join(' · '))}${(c.times || []).length ? ' · ' + c.times.join(', ') : ''}</div>
      ${c.purpose ? `<div class="meta">${esc(c.purpose)}</div>` : ''}
      <div class="meta">${fmtDate(c.start_date)}${c.end_date ? ' – ' + fmtDate(c.end_date) : c.is_kok ? ' · постоянно' : ' · без даты окончания'}${c.doctor_id && doctor(c.doctor_id) ? ` · назначил ${esc(doctor(c.doctor_id).name)}` : ''}</div>
      ${c.active && total && left >= 0 ? `<div class="progress mt" style="height:6px"><div style="width:${(100 * done) / total}%"></div></div><div class="meta">${left === 0 ? 'последний день' : `осталось ${plural(left, 'день', 'дня', 'дней')}`}</div>` : ''}
    </div></div>`;
}
async function viewMeds() {
  const all = await GET('/api/courses');
  const today = todayStr();
  const active = all.filter(c => c.active && (!c.end_date || c.end_date >= today));
  const past = all.filter(c => !active.includes(c));
  render(`
    ${pageHead('Лекарства', `${plural(active.length, 'активный курс', 'активных курса', 'активных курсов')}`, addBtn('course-new', 'Курс') + ' <a class="btn small" href="#refs?tab=medications">Справочник</a>')}
    <div class="group-label">Принимаю сейчас</div>
    <div class="list">${active.length ? active.map(c => courseItem(c, today)).join('') : '<div class="empty">Нет активных курсов</div>'}</div>
    ${past.length ? `<div class="group-label">Завершённые</div><div class="list">${past.map(c => courseItem(c, today)).join('')}</div>` : ''}
    ${fab('course-new')}
  `);
}
function timesInputs(n, times = []) {
  const def = DEFAULT_TIMES[n] || DEFAULT_TIMES[1];
  return `<div class="field-label">Время приёма</div><div class="row wrap mb">${Array.from({ length: n }, (_, i) => `<input type="time" name="times[]" value="${esc(times[i] || def[i] || '')}" style="width:auto;flex:1;min-width:100px">`).join('')}</div>`;
}
async function courseForm(id, preset = {}) {
  const row = id ? await loadFull('courses', id) : { start_date: todayStr(), per_day: 1, times: DEFAULT_TIMES[1], active: 1, doctor_id: ls.get('last_doctor'), ...preset };
  const isKok = !!row.is_kok;
  openSheet({
    title: id ? 'Курс приёма' : 'Новый курс',
    body: `
      ${refSelect('medication', row.medication_id, 'Препарат')}
      <div class="field-row">${F.text('dose', 'Сколько за раз', row.dose, 'placeholder="1 таблетка, 5 мл, 1 саше"')}${F.number('per_day', 'Раз в день', row.per_day || 1, 'min="1" max="6" data-per-day')}</div>
      <div id="times-box">${timesInputs(row.per_day || 1, row.times)}</div>
      ${F.check('is_kok', 'Гормональная терапия — постоянный приём (КОК, гестагены при эндометриозе)', isKok, 'data-kok-toggle')}
      <div id="kok-box" class="inline-new" ${isKok ? '' : 'hidden'}>
        <div class="field-row">${F.select('pack_size', 'Таблеток в пачке', [21, 24, 28, 30, 84], row.pack_size || 28, { none: null })}${F.select('break_days', 'Режим', [[7, 'перерыв 7 дней'], [4, 'перерыв 4 дня'], [0, 'непрерывно']], row.break_days ?? 0, { none: null })}</div>
        <p class="small muted" style="padding-bottom:10px">Гестагены (диеногест / Визанна и др.) пьются непрерывно — выбери «непрерывно». Дата начала ниже — первая таблетка текущей пачки; на главной есть кнопка «Начать новую пачку».</p>
      </div>
      <div class="field-row">${F.date('start_date', isKok ? 'Первая таблетка пачки' : 'Начало', row.start_date, 'required')}${F.date('end_date', 'Окончание', row.end_date)}</div>
      ${F.text('purpose', 'От чего / зачем', row.purpose, 'placeholder="от цистита, контрацепция, витамины"')}
      ${refSelect('doctor', row.doctor_id, 'Назначил врач')}
      ${refSelect('episode', row.episode_id, 'Относится к болезни')}
      ${F.number('cost', 'Стоимость упаковки, ₽', row.cost ?? '', 'min="0"')}
      ${F.area('note', 'Заметка', row.note, 'До/после еды, побочки, что сказал врач')}
      ${id ? F.check('active', 'Курс активен (показывать на главной)', row.active) : ''}
    `,
    onSubmit: async (d, form) => {
      await resolveNew(d);
      if (!d.medication_id) throw toast('Выбери препарат', true);
      d.times = $$('input[name="times[]"]', form).map(i => i.value).filter(Boolean);
      if (!id) d.active = 1;
      if (!d.is_kok) { d.pack_size = null; d.break_days = null; }
      await save('courses', { ...d, id });
      if (d.doctor_id) ls.set('last_doctor', d.doctor_id);
      toast('Сохранено'); route();
    },
    onDelete: id ? async () => { await DEL(`/api/courses/${id}`); toast('Удалено'); route(); } : null,
  });
}

// ---------- Анализы ----------
const labsState = { mode: 'list', indicator: null, names: [] };
function labItem(l) {
  const p = place(l.place_id);
  return `<div class="item" data-act="lab-edit" data-id="${l.id}">${dateCol(l.date)}
    <div class="body"><div class="title">${esc(l.name)}</div>
      ${p ? `<div class="sub">📍 ${esc(p.name)}</div>` : ''}
      <div>${l.results_n ? `<span class="tag">${plural(l.results_n, 'показатель', 'показателя', 'показателей')}</span>` : ''}${l.out_n ? `<span class="tag danger">${l.out_n} вне нормы</span>` : ''}${l.files_n ? `<span class="tag">📎 ${l.files_n}</span>` : ''}${l.cost ? `<span class="tag">${money(l.cost)}</span>` : ''}${l.episode_id && episode(l.episode_id) ? `<span class="tag">🤒 ${esc(episode(l.episode_id).title)}</span>` : ''}</div>
      ${l.note ? `<div class="meta ellipsis">${esc(l.note)}</div>` : ''}
    </div></div>`;
}
async function viewLabs(params) {
  if (params.mode) labsState.mode = params.mode;
  const [labs, results, files, ind] = await Promise.all([GET('/api/labs'), GET('/api/lab_results'), GET('/api/files?entity_type=labs'), GET('/api/labs/indicators')]);
  for (const l of labs) {
    const rs = results.filter(r => r.lab_id === l.id);
    l.results_n = rs.length;
    l.out_n = rs.filter(r => r.value != null && ((r.ref_min != null && r.value < r.ref_min) || (r.ref_max != null && r.value > r.ref_max))).length;
    l.files_n = files.filter(f => f.entity_id === l.id).length;
  }
  const seg = `<div class="seg mb"><button class="${labsState.mode === 'list' ? 'on' : ''}" data-act="labs-mode" data-mode="list">Список</button><button class="${labsState.mode === 'chart' ? 'on' : ''}" data-act="labs-mode" data-mode="chart">Динамика</button></div>`;
  let body;
  if (labsState.mode === 'chart') {
    if (!labsState.indicator || !ind.find(i => i.indicator === labsState.indicator)) labsState.indicator = ind[0]?.indicator || null;
    const cur = ind.find(i => i.indicator === labsState.indicator);
    body = ind.length ? `
      <div class="card">
        ${F.select('__indicator', 'Показатель', ind.map(i => [i.indicator, `${i.indicator}${i.unit ? ' (' + i.unit + ')' : ''} · ${i.points.length}`]), labsState.indicator, { none: null, attrs: 'data-act="indicator"' })}
        ${cur ? lineChart(cur.points, { refMin: cur.points.at(-1).ref_min, refMax: cur.points.at(-1).ref_max, unit: cur.unit }) : ''}
        ${cur ? `<table class="results mt"><tr><th>Дата</th><th>Значение</th><th>Норма</th><th>Анализ</th></tr>${[...cur.points].reverse().map(p => {
          const out = (p.ref_min != null && p.value < p.ref_min) || (p.ref_max != null && p.value > p.ref_max);
          return `<tr data-act="lab-edit" data-id="${p.lab_id}" style="cursor:pointer"><td>${fmtDate(p.date)}</td><td class="${out ? 'out' : ''}">${p.value} ${esc(cur.unit || '')}</td><td class="muted">${p.ref_min ?? ''}${p.ref_min != null || p.ref_max != null ? ' – ' : ''}${p.ref_max ?? ''}</td><td class="muted">${esc(p.lab_name)}</td></tr>`;
        }).join('')}</table>` : ''}
      </div>` : '<div class="empty">Чтобы видеть динамику, добавь в анализ числовые показатели (гемоглобин, ферритин, лейкоциты…)</div>';
  } else {
    const groups = groupBy(labs, l => l.date.slice(0, 4));
    body = labs.length ? Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).map(([y, list]) => `<div class="group-label">${y}</div><div class="list">${list.map(labItem).join('')}</div>`).join('')
      : '<div class="empty">Анализов пока нет. Нажми ＋, прикрепи PDF и внеси ключевые показатели.</div>';
  }
  render(`${pageHead('Анализы', plural(labs.length, 'исследование', 'исследования', 'исследований'), addBtn('lab-new', 'Анализ'))}${seg}${body}${fab('lab-new')}`);
}
function resultRow(r = {}) {
  return `<div class="res-row">
    <input name="r_indicator[]" list="indicator-names" placeholder="Показатель" value="${esc(r.indicator || '')}">
    <input name="r_value[]" placeholder="Значение" value="${esc(r.value ?? r.value_text ?? '')}" inputmode="decimal">
    <input name="r_unit[]" class="desk" placeholder="Ед." value="${esc(r.unit || '')}">
    <input name="r_min[]" class="desk" placeholder="Норма от" value="${esc(r.ref_min ?? '')}" inputmode="decimal">
    <input name="r_max[]" class="desk" placeholder="до" value="${esc(r.ref_max ?? '')}" inputmode="decimal">
    <button type="button" class="icon-btn" data-del-result>✕</button></div>`;
}
async function labForm(id) {
  const [row, names] = await Promise.all([id ? loadFull('labs', id) : { date: todayStr(), place_id: ls.get('last_lab_place'), results: [] }, GET('/api/labs/indicator-names')]);
  labsState.names = names;
  openSheet({
    title: id ? 'Анализ / обследование' : 'Новый анализ',
    body: `
      ${F.datalist('lab-names', LAB_NAMES)}${F.datalist('indicator-names', names.map(n => n.indicator))}
      <div class="field-row">${F.date('date', 'Дата', row.date, 'required')}${F.text('name', 'Что сдавала', row.name, 'list="lab-names" required placeholder="Общий анализ мочи"')}</div>
      ${refSelect('place', row.place_id, 'Где (лаборатория, клиника)')}
      ${refSelect('doctor', row.doctor_id, 'Кто направил')}
      ${refSelect('episode', row.episode_id, 'Относится к болезни')}
      <div class="field-label">Показатели <span class="muted">(на телефоне: показатель и значение; норму можно заполнить с ноутбука)</span></div>
      <div id="results-box">${(row.results || []).map(resultRow).join('')}</div>
      <button type="button" class="btn small mb" data-add-result>＋ Показатель</button>
      <div class="field-row">${F.number('cost', 'Стоимость, ₽', row.cost ?? '', 'min="0"')}<div></div></div>
      ${F.area('note', 'Заметка / заключение', row.note, 'Что сказали по результатам')}
      ${filesBlock(row.files, 'Бланк результата (PDF, фото)')}
    `,
    onSubmit: async (d, form) => {
      await resolveNew(d);
      const rows = $$('.res-row', form);
      d.results = rows.map(r => {
        const g = (n) => r.querySelector(`[name="${n}[]"]`).value.trim();
        const raw = g('r_value').replace(',', '.');
        const num = raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null;
        const numOrNull = (s) => { s = s.replace(',', '.'); return s !== '' && !Number.isNaN(Number(s)) ? Number(s) : null; };
        // если норма не указана, но показатель уже встречался — подставим прошлую норму
        const known = labsState.names.find(n => n.indicator.toLowerCase() === g('r_indicator').toLowerCase());
        return { indicator: g('r_indicator'), value: num, value_text: num == null ? raw : null, unit: g('r_unit') || known?.unit || null,
          ref_min: numOrNull(g('r_min')) ?? (g('r_min') === '' ? known?.ref_min ?? null : null), ref_max: numOrNull(g('r_max')) ?? (g('r_max') === '' ? known?.ref_max ?? null : null) };
      }).filter(r => r.indicator);
      const saved = await save('labs', { ...d, id });
      await uploadFiles(form, 'labs', saved.id);
      if (d.place_id) ls.set('last_lab_place', d.place_id);
      toast('Сохранено'); route();
    },
    onDelete: id ? async () => { await DEL(`/api/labs/${id}`); toast('Удалено'); route(); } : null,
  });
}

// ---------- Цикл ----------
async function viewCycle() {
  const [cycles, t, diary] = await Promise.all([GET('/api/cycles'), GET('/api/today?date=' + todayStr()), GET('/api/diary')]);
  const open = cycles.find(c => !c.end_date);
  const lens = [];
  for (let i = 0; i + 1 < cycles.length; i++) lens.push(daysBetween(cycles[i + 1].start_date, cycles[i].start_date));
  // мигрени/головные боли по дням цикла
  const starts = cycles.map(c => c.start_date).sort();
  const buckets = Array(35).fill(0);
  let matched = 0;
  for (const d of diary) {
    if (!(d.symptoms || []).some(s => /мигрен|головн/i.test(s))) continue;
    const st = [...starts].reverse().find(s => s <= d.date);
    if (!st) continue;
    const day = daysBetween(st, d.date);
    if (day < 35) { buckets[day]++; matched++; }
  }
  const maxB = Math.max(...buckets, 1);
  render(`
    ${pageHead('Цикл', t.cycle ? `день ${t.cycle.day} · средняя длина ${t.cycle.avg_length}` : 'Отмечай начало месячных — появится статистика')}
    <div class="row wrap mb">
      ${open ? `<button class="btn primary" data-act="cycle-end">Закончились сегодня</button>` : `<button class="btn primary" data-act="cycle-start">🩸 Начались сегодня</button>`}
      <button class="btn" data-act="cycle-new">＋ Указать даты вручную</button>
    </div>
    ${t.cycle ? `<div class="grid3 mb">
      <div class="stat"><div class="v">${t.cycle.day}</div><div class="l">день цикла</div></div>
      <div class="stat"><div class="v">${t.cycle.avg_length}</div><div class="l">средняя длина</div></div>
      <div class="stat"><div class="v">${fmtDate(t.cycle.next_predicted)}</div><div class="l">следующие ~</div></div></div>` : ''}
    ${t.kok ? `<div class="card"><div class="card-title"><h2>🌙 ${esc(t.kok.name)}</h2><button class="btn small ghost" data-act="course-edit" data-id="${t.kok.course_id}">Изменить</button></div>
      <p>${t.kok.on_break ? `Перерыв, день ${t.kok.break_day} из ${t.kok.break_days}. Новая пачка — <b>${fmtDate(t.kok.next_pack)}</b>` : `Таблетка <b>${t.kok.pill} из ${t.kok.pack_size}</b>, последняя — ${fmtDate(t.kok.last_pill)}`}</p>
      ${t.kok.missed.length ? `<p class="small" style="color:var(--warn)">⚠️ Нет отметки за: ${t.kok.missed.map(d => fmtDate(d)).join(', ')}</p>` : '<p class="small muted">Пропусков в текущей пачке нет</p>'}
    </div>` : `<div class="card"><p class="muted">Принимаешь КОК или гестагены? <a href="#" data-act="course-new" data-kok="1">Добавь курс с галочкой «Гормональная терапия»</a> — здесь появится счётчик таблеток и пропусков.</p></div>`}
    <div class="card"><div class="card-title"><h2>Головная боль по дням цикла</h2><span class="muted small">${plural(matched, 'запись', 'записи', 'записей')}</span></div>
      ${matched ? `<div class="vbars" style="margin-bottom:22px">${buckets.map((n, i) => `<div style="height:${(100 * n) / maxB}%;opacity:${n ? 1 : 0.15}" title="день ${i + 1}: ${n}">${i % 5 === 0 ? `<span>${i + 1}</span>` : ''}</div>`).join('')}</div><p class="small muted">Если столбики выше в начале цикла или в перерыве КОК — это менструальная мигрень, стоит обсудить с гинекологом/неврологом.</p>` : '<p class="muted small">Отмечай в дневнике «Мигрень» или «Головная боль» — здесь будет видно, в какие дни цикла она чаще.</p>'}
    </div>
    <div class="group-label">История</div>
    <div class="list">${cycles.length ? cycles.map((c, i) => `<div class="item" data-act="cycle-edit" data-id="${c.id}">${dateCol(c.start_date)}<div class="body"><div class="title">${fmtDate(c.start_date)}${c.end_date ? ' – ' + fmtDate(c.end_date) : ' – …'}</div><div class="sub">${c.end_date ? plural(daysBetween(c.start_date, c.end_date) + 1, 'день', 'дня', 'дней') : 'идут'}${lens[i] != null ? ` · цикл ${lens[i]} дн.` : ''}${c.flow ? ' · ' + esc(c.flow) : ''}${c.note ? ' · ' + esc(c.note) : ''}</div></div></div>`).join('') : '<div class="empty">Записей нет</div>'}</div>
  `);
}
async function cycleForm(id) {
  const row = id ? await GET(`/api/cycles/${id}`) : { start_date: todayStr() };
  openSheet({
    title: id ? 'Месячные' : 'Месячные',
    body: `<div class="field-row">${F.date('start_date', 'Начало', row.start_date, 'required')}${F.date('end_date', 'Конец', row.end_date)}</div>
      ${F.select('flow', 'Интенсивность', ['Мазня', 'Скудные', 'Обычные', 'Обильные'], row.flow)}
      ${F.area('note', 'Заметка', row.note, 'Боли, самочувствие')}`,
    onSubmit: async (d) => { await save('cycles', { ...d, id }); toast('Сохранено'); route(); },
    onDelete: id ? async () => { await DEL(`/api/cycles/${id}`); route(); } : null,
  });
}

// ---------- Болезни (эпизоды) ----------
async function viewEpisodes() {
  const [eps, diary, visits, courses, labs] = await Promise.all([GET('/api/episodes'), GET('/api/diary'), GET('/api/visits'), GET('/api/courses'), GET('/api/labs')]);
  const today = todayStr();
  const item = (e) => {
    const n = (arr) => arr.filter(x => x.episode_id === e.id).length;
    const parts = [[n(diary), 'записей'], [n(visits), 'визитов'], [n(courses), 'курсов'], [n(labs), 'анализов']].filter(p => p[0]).map(p => `${p[0]} ${p[1]}`);
    const len = daysBetween(e.start_date, e.end_date || today) + 1;
    return `<div class="item" data-act="episode-edit" data-id="${e.id}">${dateCol(e.start_date)}<div class="body">
      <div class="title">${esc(e.title)} ${!e.end_date ? '<span class="tag warn">сейчас</span>' : ''}</div>
      <div class="sub">${fmtDate(e.start_date)} – ${e.end_date ? fmtDate(e.end_date) : '…'} · ${plural(len, 'день', 'дня', 'дней')}</div>
      ${e.diagnosis ? `<div class="meta"><b>Диагноз:</b> ${esc(e.diagnosis)}</div>` : ''}
      ${parts.length ? `<div class="meta">${parts.join(' · ')}</div>` : ''}
    </div></div>`;
  };
  const open = eps.filter(e => !e.end_date), closed = eps.filter(e => e.end_date);
  render(`
    ${pageHead('Болезни', 'история эпизодов: к каждому привязаны дневник, визиты, лекарства и анализы', addBtn('episode-new', 'Эпизод'))}
    ${open.length ? `<div class="group-label">Сейчас</div><div class="list">${open.map(item).join('')}</div>` : ''}
    <div class="group-label">История</div>
    <div class="list">${closed.length ? closed.map(item).join('') : '<div class="empty">Завершённых эпизодов нет</div>'}</div>
    ${fab('episode-new')}
  `);
}
async function episodeForm(id) {
  const row = id ? await GET(`/api/episodes/${id}`) : { start_date: todayStr() };
  openSheet({
    title: id ? 'Эпизод болезни' : 'Новая болезнь',
    body: `${F.text('title', 'Название', row.title, 'required placeholder="Цистит, ОРВИ, мигрень…"')}
      <div class="field-row">${F.date('start_date', 'Началось', row.start_date, 'required')}${F.date('end_date', 'Закончилось', row.end_date)}</div>
      ${F.text('diagnosis', 'Диагноз', row.diagnosis)}
      ${F.area('note', 'Заметка', row.note, 'Как протекало, что помогло')}
      ${id && !row.end_date ? `<button type="button" class="btn small mb" data-set-today="end_date">Закончилось сегодня</button>` : ''}
      ${filesBlock(row.files || [])}`,
    onSubmit: async (d, form) => { const s = await save('episodes', { ...d, id }); await uploadFiles(form, 'episodes', s.id); await loadRefs(); toast('Сохранено'); route(); },
    onDelete: id ? async () => { await DEL(`/api/episodes/${id}`); await loadRefs(); route(); } : null,
    deleteConfirm: 'Удалить эпизод? Связанные записи останутся, но отвяжутся от него.',
  });
}

// ---------- Расходы ----------
const expState = { year: todayStr().slice(0, 4) };
async function viewExpenses(params) {
  if (params.year) expState.year = params.year;
  const s = await GET('/api/expenses/summary?year=' + expState.year);
  const years = [...new Set([...s.years, todayStr().slice(0, 4)])].sort().reverse();
  const cats = Object.entries(s.by_category).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n, label: money(n) }));
  const months = Array.from({ length: 12 }, (_, i) => s.by_month[`${expState.year}-${String(i + 1).padStart(2, '0')}`] || 0);
  const maxM = Math.max(...months, 1);
  render(`
    ${pageHead('Расходы', 'визиты, анализы и лекарства с ценой попадают сюда сами', addBtn('expense-new', 'Расход'))}
    <div class="row between mb"><div class="seg">${years.map(y => `<button class="${y === expState.year ? 'on' : ''}" data-act="expense-year" data-year="${y}">${y}</button>`).join('')}</div></div>
    <div class="grid3 mb">
      <div class="stat"><div class="v">${money(s.total)}</div><div class="l">всего за ${expState.year}</div></div>
      <div class="stat"><div class="v">${money(s.deductible)}</div><div class="l">подходит под вычет</div></div>
      <div class="stat"><div class="v">${money(s.deductible * 0.13)}</div><div class="l">вернуть 13% (макс. 19 500 ₽*)</div></div>
    </div>
    <div class="card"><div class="card-title"><h2>По месяцам</h2></div><div class="vbars" style="margin-bottom:22px">${months.map((n, i) => `<div style="height:${(100 * n) / maxM}%;opacity:${n ? 1 : 0.15}" title="${money(n)}"><span>${MONTHS[i]}</span></div>`).join('')}</div></div>
    <div class="card"><div class="card-title"><h2>По категориям</h2></div>${hbars(cats)}</div>
    <p class="small muted">* Социальный вычет на лечение и лекарства — 13% от суммы до 150 000 ₽ в год (с 2024). Нужны чеки и справка об оплате медуслуг из клиники. Нажми на расход, чтобы прикрепить чек.</p>
    <div class="group-label">Список</div>
    <div class="list">${s.items.length ? s.items.map(e => `<div class="item" data-act="expense-edit" data-id="${e.id}">${dateCol(e.date)}<div class="body"><div class="title">${esc(e.title || e.category || 'Расход')}</div><div class="sub">${esc(e.category || '')}${e.place_id && place(e.place_id) ? ' · ' + esc(place(e.place_id).name) : ''}${!e.deductible ? ' · без вычета' : ''}${e.entity_type ? ' · авто' : ''}</div></div><div class="nowrap"><b>${money(e.amount)}</b></div></div>`).join('') : '<div class="empty">Расходов за этот год нет</div>'}</div>
    ${fab('expense-new')}
  `);
}
async function expenseForm(id) {
  const row = id ? await loadFull('expenses', id) : { date: todayStr(), deductible: 1, category: 'Лекарства' };
  const linked = row.entity_type ? { visits: 'визита', labs: 'анализа', courses: 'курса лекарств' }[row.entity_type] : null;
  openSheet({
    title: id ? 'Расход' : 'Новый расход',
    body: `${linked ? `<p class="small muted">Создан автоматически из ${linked}. Сумма и дата обновятся при его изменении.</p>` : ''}
      <div class="field-row">${F.date('date', 'Дата', row.date, 'required')}${F.number('amount', 'Сумма, ₽', row.amount ?? '', 'required min="0"')}</div>
      ${F.text('title', 'Что', row.title, 'placeholder="Канефрон, приём уролога…"')}
      ${F.select('category', 'Категория', EXPENSE_CATS, row.category, { none: null })}
      ${refSelect('place', row.place_id, 'Где')}
      ${F.check('deductible', 'Учитывать для налогового вычета', row.deductible)}
      ${F.area('note', 'Заметка', row.note)}
      ${filesBlock(row.files, 'Чек / справка об оплате')}`,
    onSubmit: async (d, form) => { await resolveNew(d); const s = await save('expenses', { ...d, id }); await uploadFiles(form, 'expenses', s.id); toast('Сохранено'); route(); },
    onDelete: id ? async () => { await DEL(`/api/expenses/${id}`); route(); } : null,
  });
}

// ---------- Напоминания ----------
async function reminderForm(id) {
  const row = id ? await GET(`/api/reminders/${id}`) : { date: todayStr() };
  openSheet({
    title: id ? 'Напоминание' : 'Новое напоминание',
    body: `${F.text('title', 'О чём', row.title, 'required placeholder="Сдать ОАМ, записаться к урологу, купить КОК"')}${F.date('date', 'Когда', row.date, 'required')}${F.area('note', 'Заметка', row.note)}${id ? F.check('done', 'Выполнено', row.done) : ''}`,
    onSubmit: async (d) => { await save('reminders', { ...d, id, kind: row.kind || 'manual' }); route(); },
    onDelete: id ? async () => { await DEL(`/api/reminders/${id}`); route(); } : null,
  });
}

// ---------- Справочники ----------
const refsState = { tab: 'doctors' };
async function viewRefs(params) {
  if (params.tab) refsState.tab = params.tab;
  await loadRefs();
  const tabs = [['doctors', 'Врачи'], ['places', 'Места'], ['medications', 'Препараты']];
  const seg = `<div class="seg mb">${tabs.map(([k, l]) => `<button class="${refsState.tab === k ? 'on' : ''}" data-act="refs-tab" data-tab="${k}">${l}</button>`).join('')}</div>`;
  let list;
  if (refsState.tab === 'doctors') list = refs.doctors.map(d => `<div class="item" data-act="doctor-edit" data-id="${d.id}"><div class="feel">👩‍⚕️</div><div class="body"><div class="title">${esc(d.name)}</div><div class="sub">${esc(d.specialty || '')}${d.place_id && place(d.place_id) ? ' · ' + esc(place(d.place_id).name) : ''}</div>${d.phone ? `<div class="meta"><a href="tel:${esc(d.phone)}">${esc(d.phone)}</a></div>` : ''}${d.note ? `<div class="meta">${esc(d.note)}</div>` : ''}</div></div>`);
  else if (refsState.tab === 'places') list = refs.places.map(p => `<div class="item" data-act="place-edit" data-id="${p.id}"><div class="feel">📍</div><div class="body"><div class="title">${esc(p.name)}</div><div class="sub">${esc(p.type || '')}${p.address ? ' · ' + esc(p.address) : ''}</div><div class="meta">${p.address ? `<a href="https://yandex.ru/maps/?text=${encodeURIComponent(p.address)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Открыть на карте</a>` : ''}${p.phone ? ` · <a href="tel:${esc(p.phone)}" onclick="event.stopPropagation()">${esc(p.phone)}</a>` : ''}</div></div></div>`);
  else list = refs.medications.map(m => `<div class="item" data-act="med-edit" data-id="${m.id}"><div class="feel">💊</div><div class="body"><div class="title">${esc(m.name)} ${m.strength ? `<span class="muted">${esc(m.strength)}</span>` : ''}</div><div class="sub">${esc(m.form || '')}</div>${m.note ? `<div class="meta">${esc(m.note)}</div>` : ''}</div></div>`);
  const addAct = { doctors: 'doctor-new', places: 'place-new', medications: 'med-new' }[refsState.tab];
  render(`${pageHead('Справочники', 'врачи, клиники и препараты — чтобы не вводить заново', addBtn(addAct, 'Добавить'))}${seg}<div class="list">${list.length ? list.join('') : '<div class="empty">Пока пусто. Записи появятся автоматически, когда добавишь визит или лекарство.</div>'}</div>${fab(addAct)}`);
}
async function doctorForm(id) {
  const row = id ? doctor(id) : {};
  openSheet({
    title: id ? 'Врач' : 'Новый врач',
    body: `${F.text('name', 'ФИО', row.name, 'required')}${F.select('specialty', 'Специальность', SPECIALTIES, row.specialty)}${F.text('phone', 'Телефон', row.phone, 'type="tel"')}${refSelect('place', row.place_id, 'Где принимает')}${F.area('note', 'Заметка', row.note, 'Впечатление, как записаться, стоимость приёма')}`,
    onSubmit: async (d) => { await resolveNew(d); await save('doctors', { ...d, id }); await loadRefs(); route(); },
    onDelete: id ? async () => { await DEL(`/api/doctors/${id}`); await loadRefs(); route(); } : null,
  });
}
async function placeForm(id) {
  const row = id ? place(id) : {};
  openSheet({
    title: id ? 'Место' : 'Новое место',
    body: `${F.text('name', 'Название', row.name, 'required')}${F.select('type', 'Тип', PLACE_TYPES, row.type)}${F.text('address', 'Адрес', row.address)}${F.text('phone', 'Телефон', row.phone, 'type="tel"')}${F.area('note', 'Заметка', row.note)}`,
    onSubmit: async (d) => { await save('places', { ...d, id }); await loadRefs(); route(); },
    onDelete: id ? async () => { await DEL(`/api/places/${id}`); await loadRefs(); route(); } : null,
  });
}
async function medForm(id) {
  const row = id ? med(id) : { form: 'Таблетки' };
  openSheet({
    title: id ? 'Препарат' : 'Новый препарат',
    body: `${F.text('name', 'Название', row.name, 'required')}<div class="field-row">${F.select('form', 'Форма', MED_FORMS, row.form, { none: null })}${F.text('strength', 'Дозировка', row.strength, 'placeholder="500 мг"')}</div>${F.area('note', 'Заметка', row.note, 'Побочки, аналоги, где покупала')}`,
    onSubmit: async (d) => { await save('medications', { ...d, id }); await loadRefs(); route(); },
    onDelete: id ? async () => { await DEL(`/api/medications/${id}`); await loadRefs(); route(); } : null,
  });
}

// ---------- Экспорт / отчёт ----------
const fmtBytes = (n) => n == null ? '—' : n < 1048576 ? Math.round(n / 1024) + ' КБ' : (n / 1048576).toFixed(1) + ' МБ';
async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  // на телефоне — системное меню «Поделиться» (Файлы, AirDrop, Telegram…), на компьютере — обычное скачивание
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  return true;
}
async function doBackup(withFiles) {
  const data = await window.localApi.exportData({ withFiles });
  const name = `health-backup-${todayStr()}${withFiles ? '-full' : ''}.json`;
  if (await shareOrDownload(new Blob([JSON.stringify(data)], { type: 'application/json' }), name)) toast('Копия сохранена');
}
function bindImportHandlers() {
  const imp = $('#import-file');
  if (imp) imp.onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!confirm('Восстановление ЗАМЕНИТ все текущие данные данными из файла. Продолжить?')) return;
    try { const data = JSON.parse(await f.text()); await POST('/api/import', data); await loadRefs(); toast('Данные восстановлены'); location.hash = '#today'; }
    catch (err) { toast('Не удалось прочитать файл: ' + err.message, true); }
    e.target.value = '';
  };
  const hi = $('#health-import');
  if (hi) hi.onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const st = $('#health-import-status'); st.textContent = `Читаю ${fmtBytes(f.size)}… это может занять минуту.`;
    try {
      const fd = new FormData(); fd.append('file', f);
      const r = await POST('/api/import/apple-health', fd);
      st.textContent = `Готово: записей в файле ${r.records}, дней месячных ${r.menses_days} → эпизодов ${r.episodes} (новых ${r.added}, обновлено ${r.updated}); дней мазни ${r.spotting_days} (добавлено в дневник ${r.spotting_added}).`;
      toast('Импорт завершён');
    } catch (err) { st.textContent = 'Ошибка импорта: ' + err.message; }
    e.target.value = '';
  };
}
const appleHealthCard = () => `<details class="card"><summary class="muted small" style="cursor:pointer">Дополнительно: импорт цикла из приложения «Здоровье» (export.xml)</summary>
      <p class="small mt">Здоровье → фото профиля → <b>Экспортировать все медданные</b> → сохранить ZIP в «Файлы» → нажать на него (распакуется) → выбрать здесь <code>export.xml</code>. Подтянутся дни месячных (как циклы) и межменструальные кровотечения (как «Мазня» в дневнике). Повторный импорт не дублирует. Если проще вести вручную — кнопка «Начались сегодня» в разделе «Цикл» делает то же самое.</p>
      <label class="btn">Загрузить export.xml<input type="file" accept=".xml,text/xml,application/xml" id="health-import" hidden></label>
      <p class="small muted mt" id="health-import-status"></p></details>`;
const reportCard = () => `<div class="card"><div class="card-title"><h2>📄 Отчёт для врача</h2></div>
      <p class="muted small">Одна страница: самочувствие, визиты, лекарства и анализы за период. Можно распечатать или сохранить в PDF (на iPhone — Поделиться → Напечатать → PDF).</p>
      <div class="field-row">${F.date('__from', 'С', addDays(todayStr(), -90))}${F.date('__to', 'По', todayStr())}</div>
      <button class="btn primary" data-act="report">Сформировать отчёт</button></div>`;

async function viewExport() { return LOCAL ? viewExportLocal() : viewExportServer(); }

async function viewExportLocal() {
  const info = await window.localApi.storageInfo();
  const t = await GET('/api/today?date=' + todayStr());
  render(`
    ${pageHead('Данные и копии')}
    ${reportCard()}
    <div class="card"><div class="card-title"><h2>📱 Где хранятся данные</h2></div>
      <p class="small">Всё лежит <b>внутри этого устройства</b> (в хранилище браузера), никуда не отправляется и работает без интернета. Занято: <b>${fmtBytes(info.usage)}</b>${info.files ? `, вложений: ${info.files}` : ''}${info.persisted === false ? ' · <span style="color:var(--warn)">хранилище не закреплено — добавь приложение на экран «Домой»</span>' : ''}.</p>
      <p class="small" style="color:var(--danger)"><b>Важно:</b> если удалить иконку приложения с экрана «Домой» или очистить данные Safari — база удалится вместе с ними. Поэтому раз в месяц сохраняй копию (напоминание появится на главной).${t.last_backup ? ` Последняя копия — ${fmtDate(t.last_backup)}.` : ''}</p>
      <div class="row wrap">
        <button class="btn primary" data-act="backup" data-files="1">Сохранить копию</button>
        <button class="btn" data-act="backup" data-files="0">Только данные, без файлов</button>
        <label class="btn">Восстановить из файла<input type="file" accept=".json,application/json" id="import-file" hidden></label></div>
      <p class="small muted mt">«Сохранить копию» — полный архив с прикреплёнными PDF и фото (на телефоне откроется меню «Поделиться» — отправь в «Файлы», iCloud или себе в мессенджер). «Только данные» — лёгкий файл без вложений.</p></div>
    ${appleHealthCard()}
    <div class="card"><div class="card-title"><h2>💻 Телефон и ноутбук</h2></div>
      <p class="small">На ноутбуке открой ту же ссылку — там будет своя, отдельная база. Чтобы перенести данные: на телефоне «Сохранить копию» → файл на ноутбук (iCloud, Telegram, почта) → на ноутбуке «Восстановить из файла». И в обратную сторону так же. Автоматической синхронизации в этом режиме нет — актуальной считай ту копию, где записывала последней.</p></div>
    <div class="card"><div class="card-title"><h2>🏠 Как поставить на iPhone</h2></div>
      <p class="small">Открой эту ссылку в Safari → кнопка «Поделиться» → «На экран Домой». Дальше открывай только с иконки: так данные хранятся надёжнее и приложение работает без сети.</p></div>
  `);
  bindImportHandlers();
}

async function viewExportServer() {
  const y = todayStr().slice(0, 4);
  render(`
    ${pageHead('Экспорт и резервные копии')}
    <div class="card"><div class="card-title"><h2>📄 Отчёт для врача</h2></div>
      <p class="muted small">Одна страница: самочувствие, визиты, лекарства и анализы за период. Можно распечатать или сохранить в PDF (на iPhone — Поделиться → Напечатать → PDF).</p>
      <div class="field-row">${F.date('__from', 'С', addDays(todayStr(), -90))}${F.date('__to', 'По', todayStr())}</div>
      <button class="btn primary" data-act="report">Сформировать отчёт</button></div>
    <div class="card"><div class="card-title"><h2>💾 Резервная копия</h2></div>
      <p class="muted small">Все данные одним JSON-файлом. Прикреплённые файлы лежат отдельно в папке <code>data/uploads</code> — копируй её вместе с бэкапом.</p>
      <div class="row wrap"><a class="btn" href="/api/export" download>Скачать копию</a>
      <label class="btn">Восстановить из файла<input type="file" accept=".json" id="import-file" hidden></label></div></div>
    <div class="card"><div class="card-title"><h2>🌙 Цикл из Apple Health / Flo</h2></div>
      <p class="small">Прямого API у Flo и «Здоровья» нет, но данные можно перенести файлом. В Flo включи синхронизацию с Apple Health (Flo → Настройки → Apple Health). Затем на iPhone: <b>Здоровье → фото профиля → Экспортировать медданные</b> → сохрани ZIP в «Файлы», нажми на него — распакуется папка, внутри <code>export.xml</code>. Загрузи его сюда: подтянутся дни месячных (как циклы) и межменструальные кровотечения (как записи «Мазня» в дневнике). Повторный импорт ничего не задублирует.</p>
      <label class="btn primary">Загрузить export.xml<input type="file" accept=".xml,text/xml,application/xml" id="health-import" hidden></label>
      <p class="small muted mt" id="health-import-status"></p></div>
    <div class="card"><div class="card-title"><h2>⚡ Автосинхронизация через «Команды»</h2></div>
      <p class="small">Чтобы цикл подтягивался сам, создай на iPhone автоматизацию в приложении «Команды»: <b>Автоматизация → Время суток (ежедневно) → Новая команда</b> с действиями:</p>
      <ol class="small" style="padding-left:18px;margin:0 0 8px">
        <li><b>Найти образцы здоровья</b> — тип «Менструация», фильтр: Дата начала — за последние 90 дней.</li>
        <li><b>Получить сведения об образце здоровья</b> → «Дата начала».</li>
        <li><b>Форматировать дату</b> → формат «Пользовательский», строка <code>yyyy-MM-dd</code>.</li>
        <li><b>Объединить текст</b> — через новую строку.</li>
        <li><b>Получить содержимое URL</b> — адрес <code id="sync-url"></code>, метод POST, заголовок <code>X-Api-Token</code> = токен ниже, тело запроса: файл/текст → объединённый текст.</li>
      </ol>
      <p class="small">Работает только если сайт доступен с телефона (хостинг или та же Wi-Fi сеть). Проверить результат можно на странице «Цикл».</p>
      <div class="row wrap"><code id="api-token" style="word-break:break-all;background:#f6f4ef;padding:6px 10px;border-radius:8px">…</code><button class="btn small" id="copy-token">Скопировать</button><button class="btn small ghost" id="regen-token">Сменить токен</button></div></div>
    <div class="card"><div class="card-title"><h2>📱 Как поставить на iPhone</h2></div>
      <p class="small">Открой этот адрес в Safari → кнопка «Поделиться» → «На экран Домой». Приложение откроется без адресной строки, как обычное.</p></div>
    <form method="post" action="/logout" class="mt"><button class="btn ghost">Выйти</button></form>
  `);
  $('#import-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!confirm('Восстановление ЗАМЕНИТ все текущие данные данными из файла. Продолжить?')) return;
    try { const data = JSON.parse(await f.text()); await POST('/api/import', data); await loadRefs(); toast('Данные восстановлены'); location.hash = '#today'; }
    catch (err) { toast('Не удалось прочитать файл: ' + err.message, true); }
  };
  $('#sync-url').textContent = location.origin + '/api/cycles/sync';
  GET('/api/settings/token').then(t => { $('#api-token').textContent = t.token; }).catch(() => {});
  $('#copy-token').onclick = async () => { try { await navigator.clipboard.writeText($('#api-token').textContent); toast('Токен скопирован'); } catch { toast('Скопируй вручную', true); } };
  $('#regen-token').onclick = async () => { if (!confirm('Старый токен перестанет работать, команду на iPhone нужно будет обновить. Сменить?')) return; const t = await POST('/api/settings/token'); $('#api-token').textContent = t.token; toast('Токен обновлён'); };
  $('#health-import').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const st = $('#health-import-status'); st.textContent = `Загружаю ${Math.round(f.size / 1048576)} МБ и разбираю… это может занять минуту.`;
    try {
      const fd = new FormData(); fd.append('file', f);
      const r = await POST('/api/import/apple-health', fd);
      st.textContent = `Готово: записей в файле ${r.records}, дней месячных ${r.menses_days} → эпизодов ${r.episodes} (новых ${r.added}, обновлено ${r.updated}); дней мазни ${r.spotting_days} (добавлено в дневник ${r.spotting_added}).`;
      toast('Импорт завершён');
    } catch (err) { st.textContent = 'Ошибка импорта: ' + err.message; }
    e.target.value = '';
  };
}
async function viewReport(params) {
  const from = params.from || addDays(todayStr(), -90), to = params.to || todayStr();
  const [diary, visits, courses, labs, results] = await Promise.all([
    GET(`/api/diary?from=${from}&to=${to}`), GET(`/api/visits?from=${from}&to=${to}`), GET('/api/courses'), GET(`/api/labs?from=${from}&to=${to}`), GET('/api/lab_results')]);
  const cs = courses.filter(c => c.start_date <= to && (!c.end_date || c.end_date >= from));
  const tr = (...cells) => `<tr>${cells.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`;
  render(`
    <div class="row between mb no-print"><a href="#export" class="btn small">← Назад</a><button class="btn primary small" data-act="print">🖨 Печать / PDF</button></div>
    <div class="report">
      <h1>Выписка из дневника здоровья</h1>
      <p class="muted">Период: ${fmtDate(from)} – ${fmtDate(to)}. Сформировано ${fmtDate(todayStr())}.</p>
      <h2>Самочувствие (${diary.length})</h2>
      ${diary.length ? `<table><tr><th>Дата</th><th>Самочувствие</th><th>Симптомы</th><th>Боль</th><th>t°</th><th>Заметка</th></tr>${[...diary].reverse().map(d => tr(fmtDate(d.date) + (d.time ? ' ' + d.time : ''), FEELINGS[d.feeling]?.[1], (d.symptoms || []).join(', '), d.severity ? d.severity + '/10' : '', d.temperature, esc(d.note))).join('')}</table>` : '<p class="muted">Нет записей</p>'}
      <h2>Визиты к врачам (${visits.length})</h2>
      ${visits.length ? `<table><tr><th>Дата</th><th>Врач</th><th>Где</th><th>Жалобы</th><th>Заключение / диагноз</th><th>Направления</th></tr>${[...visits].reverse().map(v => tr(fmtDate(v.date), esc(docLabel(doctor(v.doctor_id))), esc(place(v.place_id)?.name), esc(v.reason), esc([v.diagnosis, v.conclusion].filter(Boolean).join('. ')), esc(v.referrals))).join('')}</table>` : '<p class="muted">Нет визитов</p>'}
      <h2>Лекарства (${cs.length})</h2>
      ${cs.length ? `<table><tr><th>Препарат</th><th>Как принимать</th><th>Период</th><th>От чего</th><th>Назначил</th></tr>${cs.map(c => tr(esc(medLabel(med(c.medication_id))), esc([c.dose, c.per_day ? c.per_day + ' р/день' : ''].filter(Boolean).join(', ')), fmtDate(c.start_date) + ' – ' + (c.end_date ? fmtDate(c.end_date) : (c.is_kok ? 'постоянно' : 'по н.в.')), esc(c.purpose), esc(doctor(c.doctor_id)?.name))).join('')}</table>` : '<p class="muted">Нет курсов</p>'}
      <h2>Анализы и обследования (${labs.length})</h2>
      ${labs.length ? [...labs].reverse().map(l => { const rs = results.filter(r => r.lab_id === l.id); return `<p><b>${fmtDate(l.date)} — ${esc(l.name)}</b>${place(l.place_id) ? ', ' + esc(place(l.place_id).name) : ''}${l.note ? '. ' + esc(l.note) : ''}</p>${rs.length ? `<table><tr><th>Показатель</th><th>Значение</th><th>Норма</th></tr>${rs.map(r => { const out = r.value != null && ((r.ref_min != null && r.value < r.ref_min) || (r.ref_max != null && r.value > r.ref_max)); return tr(esc(r.indicator), `<span class="${out ? 'error' : ''}">${r.value ?? esc(r.value_text)} ${esc(r.unit || '')}</span>`, r.ref_min != null || r.ref_max != null ? `${r.ref_min ?? ''} – ${r.ref_max ?? ''}` : ''); }).join('')}</table>` : ''}`; }).join('') : '<p class="muted">Нет анализов</p>'}
    </div>`);
}

// ---------- Ещё (мобильное меню) ----------
function viewMore() {
  const links = [['#labs', '🧪', 'Анализы', 'результаты, PDF и графики показателей'], ['#cycle', '🌙', 'Цикл и гормоны', 'дни цикла, пачка, пропуски, импорт из Apple Health'], ['#episodes', '🤒', 'Болезни', 'история эпизодов'], ['#expenses', '₽', 'Расходы', 'траты и налоговый вычет'], ['#refs', '📇', 'Справочники', 'врачи, клиники, препараты'], ['#export', '💾', 'Экспорт', 'отчёт для врача, резервная копия']];
  render(`${pageHead('Ещё')}<div class="list">${links.map(([h, i, t, s]) => `<a class="item" href="${h}"><div class="feel">${i}</div><div class="body"><div class="title">${t}</div><div class="sub">${s}</div></div><span class="muted">›</span></a>`).join('')}</div>`);
}

// ===================== Действия =====================
const actions = {
  'diary-new': (d) => diaryForm({}, d.feeling ? { feeling: Number(d.feeling) } : {}),
  'diary-edit': async (d) => diaryForm(await GET(`/api/diary/${d.id}`)),
  'filter-sym': (d) => { diaryState.filter = d.sym || null; viewDiary(); },
  'visit-new': () => visitForm(), 'visit-edit': (d) => visitForm(d.id),
  'visit-plan': async (d) => { const v = await GET(`/api/visits/${d.id}`); visitForm(null, { date: v.next_date, doctor_id: v.doctor_id, place_id: v.place_id, episode_id: v.episode_id, reason: 'Повторный визит' }); },
  'course-new': (d) => courseForm(null, d.kok ? { is_kok: 1, pack_size: 28, break_days: 0 } : {}),
  'course-edit': (d) => courseForm(d.id),
  'toggle-intake': async (d, el) => { const r = await POST('/api/intakes/toggle', { course_id: Number(d.course), date: todayStr(), slot: Number(d.slot) }); el.classList.toggle('on', r.taken); el.textContent = (r.taken ? '✓ ' : '') + el.textContent.replace('✓ ', ''); },
  'new-pack': async (d) => { if (!confirm('Отметить, что сегодня — первая таблетка новой пачки?')) return; await POST(`/api/courses/${d.course}/new-pack`, { date: todayStr() }); toast('Новая пачка начата'); route(); },
  'lab-new': () => labForm(), 'lab-edit': (d) => labForm(d.id),
  'labs-mode': (d) => { labsState.mode = d.mode; viewLabs({}); },
  'cycle-start': async () => { await POST('/api/cycles', { start_date: todayStr() }); toast('Отмечено'); route(); },
  'cycle-end': async () => { const c = (await GET('/api/cycles')).find(x => !x.end_date); if (c) await PUT(`/api/cycles/${c.id}`, { end_date: todayStr() }); route(); },
  'cycle-new': () => cycleForm(), 'cycle-edit': (d) => cycleForm(d.id),
  'episode-new': () => episodeForm(), 'episode-edit': (d) => episodeForm(d.id),
  'expense-new': () => expenseForm(), 'expense-edit': (d) => expenseForm(d.id),
  'expense-year': (d) => { expState.year = d.year; viewExpenses({}); },
  'reminder-new': () => reminderForm(), 'reminder-edit': (d) => reminderForm(d.id),
  'reminder-done': async (d) => { await PUT(`/api/reminders/${d.id}`, { done: 1 }); toast('Готово'); route(); },
  'refs-tab': (d) => { refsState.tab = d.tab; viewRefs({}); },
  'doctor-new': () => doctorForm(), 'doctor-edit': (d) => doctorForm(d.id),
  'place-new': () => placeForm(), 'place-edit': (d) => placeForm(d.id),
  'med-new': () => medForm(), 'med-edit': (d) => medForm(d.id),
  'report': () => { location.hash = `#report?from=${$('[name="__from"]').value}&to=${$('[name="__to"]').value}`; },
  'backup-done': () => { setTimeout(route, 2000); },
  'backup': async (d) => { await doBackup(d.files === '1'); route(); },
  'print': () => window.print(),
};

view.addEventListener('click', (e) => {
  if (e.target.closest('a[href^="http"], a[href^="tel:"], a[href^="/files/"], a[href^="blob:"]')) return;
  const el = e.target.closest('[data-act]');
  if (!el || !view.contains(el)) return;
  if (el.tagName === 'SELECT') return;
  if (el.tagName === 'A' && !el.hasAttribute('download')) e.preventDefault();
  const fn = actions[el.dataset.act];
  if (fn) Promise.resolve().then(() => fn(el.dataset, el)).catch(err => { if (err && err.message !== 'auth') console.error(err); });
});
view.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.act === 'indicator') { labsState.indicator = el.value; viewLabs({}); }
});

// ---- поведение внутри формы (делегирование) ----
const sheetForm = $('#sheet-form');
sheetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!sheet.onSubmit) return;
  const btn = $('#sheet-foot button[type=submit]'); if (btn) btn.disabled = true;
  try { await sheet.onSubmit(formData(sheetForm), sheetForm); closeSheet(); }
  catch (err) { if (err && err.message !== 'auth') console.error(err); }
  finally { if (btn) btn.disabled = false; }
});
sheetForm.addEventListener('click', async (e) => {
  const t = e.target;
  const feel = t.closest('[data-feel]');
  if (feel) { $$('[data-feel]', sheetForm).forEach(b => b.classList.toggle('on', b === feel)); sheetForm.elements.feeling.value = feel.dataset.feel; return; }
  const chip = t.closest('#sym-chips .chip');
  if (chip) { chip.classList.toggle('on'); sheetForm.elements.symptoms.value = JSON.stringify($$('#sym-chips .chip.on', sheetForm).map(c => c.dataset.sym)); return; }
  if (t.closest('[data-add-result]')) { $('#results-box', sheetForm).insertAdjacentHTML('beforeend', resultRow()); $('#results-box .res-row:last-child input', sheetForm).focus(); return; }
  if (t.closest('[data-del-result]')) { t.closest('.res-row').remove(); return; }
  const setToday = t.closest('[data-set-today]');
  if (setToday) { sheetForm.elements[setToday.dataset.setToday].value = todayStr(); return; }
  const delFile = t.closest('[data-del-file]');
  if (delFile) { if (!confirm('Удалить файл?')) return; await DEL(`/api/files/${delFile.dataset.delFile}`); delFile.closest('.file').remove(); toast('Файл удалён'); }
});
sheetForm.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.inlineNew) { const box = sheetForm.querySelector(`[data-inline-for="${el.dataset.inlineNew}"]`); if (box) box.hidden = el.value !== '__new__'; if (el.value === '__new__') box?.querySelector('input')?.focus(); }
  if (el.name === 'doctor_id' && el.value && el.value !== '__new__') {
    // врач привязан к месту — подставим его, если место ещё не выбрано
    const d = doctor(el.value), ps = sheetForm.elements.place_id;
    if (d?.place_id && ps && !ps.value) ps.value = d.place_id;
  }
  if (el.dataset.perDay !== undefined) { const n = Math.min(6, Math.max(1, Number(el.value) || 1)); el.value = n; $('#times-box', sheetForm).innerHTML = timesInputs(n); }
  if (el.dataset.kokToggle !== undefined) { $('#kok-box', sheetForm).hidden = !el.checked; }
});
sheetForm.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.range) $('#' + el.dataset.range, sheetForm).textContent = el.value;
});
sheetForm.addEventListener('keydown', (e) => {
  const el = e.target;
  if (el.dataset.customSym !== undefined && e.key === 'Enter') {
    e.preventDefault();
    const v = el.value.trim(); if (!v) return;
    const chips = $('#sym-chips', sheetForm);
    if (!$$('.chip', chips).some(c => c.dataset.sym === v)) chips.insertAdjacentHTML('beforeend', `<span class="chip on" data-sym="${esc(v)}">${esc(v)}</span>`);
    else $$('.chip', chips).find(c => c.dataset.sym === v).classList.add('on');
    sheetForm.elements.symptoms.value = JSON.stringify($$('#sym-chips .chip.on', sheetForm).map(c => c.dataset.sym));
    el.value = '';
  }
});
$$('#sheet [data-close]').forEach(el => el.addEventListener('click', closeSheet));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

// ===================== Роутер =====================
const VIEWS = { today: viewToday, diary: viewDiary, visits: viewVisits, meds: viewMeds, labs: viewLabs, cycle: viewCycle, episodes: viewEpisodes, expenses: viewExpenses, refs: viewRefs, export: viewExport, report: viewReport, more: viewMore };
const MOB_TABS = new Set(['today', 'diary', 'visits', 'meds']);
async function route() {
  if (sheet.open) { sheet.pushed = false; closeSheet(true); } // переход по разделам закрывает открытую форму
  const hash = location.hash.slice(1) || 'today';
  const [name, qs] = hash.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  const fn = VIEWS[name] || viewToday;
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.tab === name || (a.dataset.tab === 'more' && !MOB_TABS.has(name) && !matchMedia('(min-width: 900px)').matches)));
  try { await fn(params); }
  catch (err) { if (err.message !== 'auth') { console.error(err); render(`<div class="empty">Не удалось загрузить: ${esc(err.message)}</div>`); } }
}
window.addEventListener('hashchange', route);
(async () => { try { await loadRefs(); } catch {} route(); })();
if (LOCAL && 'serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
