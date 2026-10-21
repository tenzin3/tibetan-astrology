import {
  jdToGregorian, jdToTibetan, monthDays, monthFromCount, yearInfo,
} from './calendar.js';
import {
  FORCES, MEWA, RELATIONS, birthProfile, compatibility, dayAttributes, dayEnergy,
  monthObservances, moonPhase, todayJd, upcomingObservances, yearForecast,
} from './astrology.js';

// ---------- storage ----------

const KEYS = { profile: 'tibastro.profile', partners: 'tibastro.partners' };

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private window): keep working in memory.
  }
}

const state = {
  person: load(KEYS.profile, null), // { name, date: 'YYYY-MM-DD', time, place }
  partners: load(KEYS.partners, []), // [{ name, date }]
  calMonth: null,
  calSelected: null,
  matchIndex: 0,
};

// ---------- helpers ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const parseDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const profileOf = (person) => {
  const d = parseDate(person?.date);
  return d ? birthProfile(...d) : null;
};

const jsDate = (jd) => {
  const g = jdToGregorian(jd);
  return new Date(g.year, g.month - 1, g.day);
};

const fmt = (jd, opts) => jsDate(jd).toLocaleDateString('en-GB', opts);

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const monthName = ({ month, leap }) => `${leap ? 'Leap ' : ''}${ordinal(month)} month`;
const yearName = (y) => `${y.element} ${y.animal}`;

const GUIDANCE = {
  mother: 'A supportive day. Good for beginnings, study and asking for help.',
  same: 'A steady day. Good for continuing what you have already started.',
  friend: 'Your energy has the upper hand. Good for getting things done.',
  son: 'The day draws on your energy. Pace yourself and favour giving.',
  enemy: 'A challenging day. Avoid big decisions and new ventures if you can.',
};

function moonSvg(day, size = 88) {
  const { lit, waxing } = moonPhase(day);
  const r = size / 2 - 4;
  const c = size / 2;
  const rx = Math.abs(2 * lit - 1) * r;
  const sweep = lit > 0.5 ? 1 : 0;
  const path = `M${c} ${c - r} A${r} ${r} 0 0 1 ${c} ${c + r} A${rx} ${r} 0 0 ${sweep} ${c} ${c - r} Z`;
  const flip = waxing ? '' : ` transform="translate(${size} 0) scale(-1 1)"`;
  const label = `Moon ${Math.round(lit * 100)}% lit, ${waxing ? 'waxing' : 'waning'}`;
  return `<svg class="moon" role="img" aria-label="${label}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="#2A2F47"/>
    <path d="${path}" fill="#EDE8DC"${flip}/></svg>`;
}

const chevron = (dir) => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}"/></svg>`;

const pill = (relation) => `<span class="pill tone-${RELATIONS[relation].tone}">${RELATIONS[relation].label}</span>`;

// ---------- views ----------

function onboardingView() {
  const p = state.person ?? {};
  return `
    <div class="between">
      ${state.person ? `<a class="icon-btn" href="#signs" aria-label="Back">${chevron('left')}</a>` : '<span></span>'}
      <span></span>
    </div>
    <div class="stack" style="gap:8px">
      <h1>When were you born?</h1>
      <p class="muted">Your birth year sets your animal and elements. The Tibetan year begins at Losar, so early-year births can belong to the year before.</p>
    </div>
    <form id="birth-form" class="stack" style="gap:14px">
      <div class="field"><label for="f-name">Name (optional)</label><input id="f-name" name="name" autocomplete="given-name" value="${esc(p.name)}"></div>
      <div class="field"><label for="f-date">Date of birth</label><input id="f-date" name="date" type="date" required min="1900-01-01" max="2100-12-31" value="${esc(p.date)}"></div>
      <div class="grid2">
        <div class="field"><label for="f-time">Time (optional)</label><input id="f-time" name="time" type="time" value="${esc(p.time)}"></div>
        <div class="field"><label for="f-place">Place (optional)</label><input id="f-place" name="place" value="${esc(p.place)}"></div>
      </div>
      <div id="birth-preview" aria-live="polite">${birthPreview(p.date)}</div>
      <button class="btn" type="submit">${state.person ? 'Save' : 'See my signs'}</button>
    </form>`;
}

function birthPreview(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  const prof = birthProfile(...d);
  return `<div class="card"><div class="row">
      <div class="el-disc el-${prof.year.element}">${prof.year.animal[0]}</div>
      <div class="stack">
        <span class="eyebrow">You are</span>
        <span class="serif" style="font-size:28px;line-height:1">${yearName(prof.year)}</span>
        <span class="muted small">Tibetan year ${prof.year.royalYear} · life force ${prof.elements.life}</span>
      </div></div>
      ${prof.beforeLosar ? `<p class="small muted">Born before Losar ${d[0]}, so you belong to the ${d[0] - 1} year.</p>` : ''}
    </div>`;
}

function todayView() {
  const prof = profileOf(state.person);
  const jd = todayJd();
  const t = jdToTibetan(jd);
  const y = yearInfo(t.year);
  const energy = dayEnergy(prof, jd);
  const todays = monthObservances(t.monthCount).get(jd) ?? [];
  const upcoming = upcomingObservances(jd + 1, 3);
  const greeting = state.person?.name ? `Tashi delek, ${esc(state.person.name)}` : 'Tashi delek';
  return `
    <div class="stack">
      <span class="eyebrow">${fmt(jd, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <h1>${greeting}</h1>
    </div>
    <section class="card" aria-label="Tibetan date">
      <div class="row" style="gap:18px">
        ${moonSvg(t.day)}
        <div class="stack" style="gap:6px">
          <span class="eyebrow" style="color:var(--accent)">Tibetan date</span>
          <span class="serif" style="font-size:30px;line-height:1">Day ${t.day}${t.leapDay ? ' (first)' : ''}</span>
          <span class="muted small" style="line-height:1.4">${monthName({ month: t.month, leap: t.leapMonth })} · ${yearName(y)} year<br>Rabjung ${y.rabjung}, year ${y.rabjungYear} · ${y.royalYear}</span>
        </div>
      </div>
      ${todays.map((o) => `<p style="color:var(--accent);font-weight:500">${esc(o.name)}</p><p class="small muted">${esc(o.text)}</p>`).join('')}
    </section>
    <section class="card" aria-label="Day energy">
      <div class="between"><span class="eyebrow">Day energy for you</span>${pill(energy.relation)}</div>
      <div class="row" style="justify-content:space-around">
        <div class="stack" style="align-items:center;text-align:center;gap:6px">
          <div class="el-disc el-${energy.day.element}">${energy.day.element[0]}</div>
          <span class="small">${energy.day.element}</span>
          <span class="muted" style="font-size:11px">${energy.day.animal} day</span>
        </div>
        <span class="muted small">${RELATIONS[energy.relation].summary}</span>
        <div class="stack" style="align-items:center;text-align:center;gap:6px">
          <div class="el-disc el-${prof.elements.life}">${prof.elements.life[0]}</div>
          <span class="small">${prof.elements.life}</span>
          <span class="muted" style="font-size:11px">Your life force · Sok</span>
        </div>
      </div>
      <p style="color:var(--text-2)">${GUIDANCE[energy.relation]}</p>
      <p class="small muted">${energy.day.weekday.name} is ${energy.day.weekday.tibetan}, the day of ${energy.day.weekday.planet}. Day mewa ${energy.day.mewa.number} ${energy.day.mewa.color}.</p>
    </section>
    <section class="card" aria-label="Coming up">
      <span class="eyebrow">Coming up</span>
      ${upcoming.map((o) => `
        <a class="event" href="#calendar" data-goto="${o.jd}" style="text-decoration:none;color:var(--text)">
          <div class="datebox"><span>Day</span><b>${o.tibetan.day}</b></div>
          <div class="stack" style="flex:1">
            <span style="font-weight:500">${esc(o.name)}</span>
            <span class="muted small">${fmt(o.jd, { weekday: 'short', day: 'numeric', month: 'short' })} · in ${o.jd - jd} day${o.jd - jd === 1 ? '' : 's'}</span>
          </div>
        </a>`).join('')}
    </section>`;
}

function calendarView() {
  const prof = profileOf(state.person);
  const today = todayJd();
  const n = state.calMonth ?? jdToTibetan(today).monthCount;
  const info = monthFromCount(n);
  const days = monthDays(n);
  const obs = monthObservances(n);
  const selected = state.calSelected && days.some((d) => d.jd === state.calSelected) ? state.calSelected : (days.some((d) => d.jd === today) ? today : days[0].jd);
  const sel = days.find((d) => d.jd === selected);
  const selObs = obs.get(selected) ?? [];
  const attrs = dayAttributes(selected);
  const energy = dayEnergy(prof, selected);
  const notes = [];
  if (sel.leapDay) notes.push(`Day ${sel.day} is repeated this month; this is the first of the two.`);
  if (sel.skippedNext) notes.push(`Day ${sel.day + 1} is skipped this month.`);
  return `
    <div class="between">
      <button class="icon-btn" data-action="month" data-delta="-1" aria-label="Previous month">${chevron('left')}</button>
      <div class="stack" style="align-items:center;text-align:center">
        <h1 style="font-size:30px">${monthName(info)}</h1>
        <span class="muted small">${yearName(yearInfo(info.year))} · ${fmt(days[0].jd, { day: 'numeric', month: 'short' })} – ${fmt(days.at(-1).jd, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      <button class="icon-btn" data-action="month" data-delta="1" aria-label="Next month">${chevron('right')}</button>
    </div>
    <div class="days" role="group" aria-label="Days of the month">
      ${days.map((d) => {
        const list = obs.get(d.jd) ?? [];
        const kind = list.some((o) => o.kind === 'annual') ? 'annual' : list.length ? 'monthly' : '';
        const cls = ['day', d.jd === today ? 'today' : '', d.jd < today ? 'past' : ''].join(' ');
        const label = `Day ${d.day}${d.leapDay ? ' (first)' : ''}, ${fmt(d.jd, { day: 'numeric', month: 'long' })}${list.length ? ', ' + list.map((o) => o.name).join(', ') : ''}`;
        return `<button class="${cls}" data-action="select" data-jd="${d.jd}" aria-pressed="${d.jd === selected}" aria-label="${esc(label)}">
          <span class="n">${d.day}${d.leapDay ? '′' : ''}</span><span class="g">${jdToGregorian(d.jd).day}</span><span class="mark ${kind}"></span></button>`;
      }).join('')}
    </div>
    <div class="legend">
      <span><i class="el-dot" style="background:var(--accent);width:8px;height:8px"></i>Monthly holy day</span>
      <span><i class="el-dot" style="background:var(--teal);width:8px;height:8px"></i>Düchen / Losar</span>
      <span>′ first of a repeated day</span>
    </div>
    <section class="card" aria-live="polite">
      <div class="between">
        <h2>Day ${sel.day}</h2>
        <span class="muted small">${fmt(selected, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      ${selObs.map((o) => `<div class="stack"><span style="font-weight:500;color:${o.kind === 'annual' ? 'var(--teal)' : 'var(--accent)'}">${esc(o.name)}</span><span class="small" style="color:var(--text-2)">${esc(o.text)}</span></div>`).join('')}
      <div class="between"><span class="small muted">${attrs.element} ${attrs.animal} day · ${attrs.weekday.tibetan}</span>${pill(energy.relation)}</div>
      <p class="small" style="color:var(--text-2)">${GUIDANCE[energy.relation]}</p>
      ${notes.map((x) => `<p class="small muted">${x}</p>`).join('')}
    </section>`;
}

function signsView() {
  const prof = profileOf(state.person);
  const now = jdToTibetan(todayJd()).year;
  const forecast = yearForecast(prof, now);
  const square = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  const t = prof.tibetan;
  return `
    <div class="stack" style="align-items:center;text-align:center;gap:10px">
      <div class="el-disc el-${prof.year.element}" style="width:96px;height:96px;border-radius:48px;font-size:40px">${prof.year.animal[0]}</div>
      <h1>${yearName(prof.year)}</h1>
      <p class="muted">${prof.year.gender === 'male' ? 'Male' : 'Female'} ${prof.year.element.toLowerCase()} year ${prof.year.royalYear}.<br>
        Born on day ${t.day} of the ${monthName({ month: t.month, leap: t.leapMonth })}.</p>
      <a href="#onboarding" class="small">Edit birth details</a>
    </div>
    <section class="card" aria-label="Your elements">
      <div class="between"><span class="eyebrow">Your elements</span><span class="eyebrow">In ${yearName(yearInfo(now))} year</span></div>
      ${forecast.map((f) => `
        <div class="force">
          <i class="el-dot el-${f.own}"></i>
          <div class="stack" style="gap:1px"><span>${f.name} · ${f.own}</span><span class="small muted">${f.tibetan} · meets ${f.year.toLowerCase()} this year</span></div>
          ${pill(f.relation)}
        </div>`).join('')}
    </section>
    <section class="card" aria-label="Mewa">
      <span class="eyebrow">Mewa</span>
      <div class="row" style="gap:18px;align-items:flex-start">
        <div class="mewa-grid" role="img" aria-label="Magic square with ${prof.mewa.birth.number} highlighted">
          ${square.map((k) => `<i class="${k === prof.mewa.birth.number ? 'on' : ''}"></i>`).join('')}
        </div>
        <div class="stack" style="gap:8px;flex:1">
          ${[['Birth', prof.mewa.birth], ['Life', prof.mewa.life], ['Power', prof.mewa.power]].map(([label, m]) => `
            <div class="between"><span class="muted small">${label}</span><span>${m.number} ${m.color} · ${m.element}</span></div>`).join('')}
        </div>
      </div>
      <p class="small muted">Your birth mewa sits in the ${MEWA[prof.mewa.birth.number].direction.toLowerCase()} of the nine-square.</p>
    </section>`;
}

function matchView() {
  const me = profileOf(state.person);
  const partners = state.partners.map((p) => ({ ...p, profile: profileOf(p) })).filter((p) => p.profile);
  const i = Math.min(state.matchIndex, Math.max(0, partners.length - 1));
  const them = partners[i];
  const result = them ? compatibility(me, them.profile) : null;
  return `
    <div class="stack" style="gap:6px">
      <h1>Compatibility</h1>
      <p class="muted">Compare by animal sign and life-force element.</p>
    </div>
    ${partners.length ? `
      <div class="chips" role="group" aria-label="People">
        ${partners.map((p, k) => `<button class="chip" data-action="partner" data-index="${k}" aria-pressed="${k === i}">
          <span style="font-weight:500">${esc(p.name || p.profile.year.animal)}</span>
          <span style="font-size:11px;opacity:.8">${yearName(p.profile.year)}</span></button>`).join('')}
      </div>
      <section class="card">
        <div class="between">
          <div class="stack" style="align-items:center;text-align:center;width:110px;gap:6px">
            <div class="el-disc el-${me.elements.life}">${me.year.animal[0]}</div>
            <span class="small">${yearName(me.year)}</span><span class="muted" style="font-size:12px">Sok · ${me.elements.life}</span>
          </div>
          <div class="stack" style="align-items:center"><span class="score">${result.score}</span><span class="muted small">of 5</span></div>
          <div class="stack" style="align-items:center;text-align:center;width:110px;gap:6px">
            <div class="el-disc el-${them.profile.elements.life}">${them.profile.year.animal[0]}</div>
            <span class="small">${yearName(them.profile.year)}</span><span class="muted" style="font-size:12px">Sok · ${them.profile.elements.life}</span>
          </div>
        </div>
        <div style="height:1px;background:var(--line)"></div>
        <div class="between"><span class="muted small">Animal bond</span><span class="small" style="text-align:right">${result.animalText}</span></div>
        <div class="between"><span class="muted small">Element relation</span><span class="small" style="text-align:right">${result.elementText}</span></div>
        <button class="btn ghost" data-action="remove" data-index="${i}" style="height:44px;font-size:14px">Remove ${esc(them.name || 'this person')}</button>
      </section>` : '<p class="muted">Add someone to compare your signs.</p>'}
    <form id="partner-form" class="card">
      <span class="eyebrow">Add someone</span>
      <div class="field"><label for="p-name">Name</label><input id="p-name" name="name" required></div>
      <div class="field"><label for="p-date">Date of birth</label><input id="p-date" name="date" type="date" required min="1900-01-01" max="2100-12-31"></div>
      <button class="btn" type="submit">Compare</button>
    </form>
    <p class="small muted">The score is a simple guide combining traditional animal groups and element relations, not a full reading.</p>`;
}

// ---------- routing ----------

const VIEWS = { onboarding: onboardingView, today: todayView, calendar: calendarView, signs: signsView, match: matchView };

function render() {
  let route = location.hash.slice(1) || 'today';
  if (!VIEWS[route]) route = 'today';
  if (!profileOf(state.person)) route = 'onboarding';
  const view = document.getElementById('view');
  view.innerHTML = VIEWS[route]();
  const tabs = document.getElementById('tabs');
  tabs.hidden = route === 'onboarding';
  for (const a of tabs.querySelectorAll('a')) {
    if (a.dataset.tab === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  return view;
}

function navigate() {
  render();
  window.scrollTo(0, 0);
}

// ---------- events ----------

document.addEventListener('click', (e) => {
  const goto = e.target.closest('[data-goto]');
  if (goto) {
    const jd = Number(goto.dataset.goto);
    state.calMonth = jdToTibetan(jd).monthCount;
    state.calSelected = jd;
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  if (action === 'month') {
    state.calMonth = (state.calMonth ?? jdToTibetan(todayJd()).monthCount) + Number(el.dataset.delta);
    state.calSelected = null;
  } else if (action === 'select') {
    state.calSelected = Number(el.dataset.jd);
  } else if (action === 'partner') {
    state.matchIndex = Number(el.dataset.index);
  } else if (action === 'remove') {
    state.partners.splice(Number(el.dataset.index), 1);
    state.matchIndex = 0;
    save(KEYS.partners, state.partners);
  }
  const focusKey = el.dataset.jd ? `[data-jd="${el.dataset.jd}"]` : el.dataset.delta ? `[data-delta="${el.dataset.delta}"]` : null;
  const view = render();
  if (focusKey) view.querySelector(focusKey)?.focus();
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'f-date') document.getElementById('birth-preview').innerHTML = birthPreview(e.target.value);
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  if (!parseDate(data.date)) return;
  if (e.target.id === 'birth-form') {
    state.person = { name: data.name.trim(), date: data.date, time: data.time, place: data.place.trim() };
    save(KEYS.profile, state.person);
    location.hash = '#signs';
    render();
  } else if (e.target.id === 'partner-form') {
    state.partners.push({ name: data.name.trim(), date: data.date });
    state.matchIndex = state.partners.length - 1;
    save(KEYS.partners, state.partners);
    render();
  }
});

window.addEventListener('hashchange', navigate);
render();
