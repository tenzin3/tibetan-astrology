// Elemental (jung-tsi) astrology built on the calendar engine.
//
// Year elements and mewa numbers follow Janson, "Tibetan calendar
// mathematics", Appendix E (tables 16, 18–22 and formulas E.2–E.5, E.12).
// The compatibility score is this app's own heuristic built from the
// traditional animal groups and element relations.

import {
  ANIMALS, ELEMENTS, amod, dateToJd, gregorianToJd, jdToTibetan, monthDays,
  monthFromCount, losarJd, observanceJd, weekday, yearInfo,
} from './calendar.js';

// ---------- elements ----------

// Generation ("mother -> son") and domination ("conquers") cycles.
const MOTHER_OF = { Wood: 'Fire', Fire: 'Earth', Earth: 'Iron', Iron: 'Water', Water: 'Wood' };
const CONQUERS = { Wood: 'Earth', Earth: 'Water', Water: 'Fire', Fire: 'Iron', Iron: 'Wood' };

export const RELATIONS = {
  mother: { label: 'Mother', tone: 'good', summary: 'nourishes you' },
  same: { label: 'Same', tone: 'good', summary: 'stands with you' },
  friend: { label: 'Friend', tone: 'neutral', summary: 'is yours to direct' },
  son: { label: 'Son', tone: 'neutral', summary: 'draws on your energy' },
  enemy: { label: 'Enemy', tone: 'hard', summary: 'works against you' },
};

/** How element `other` relates to element `self`. */
export function elementRelation(self, other) {
  if (self === other) return 'same';
  if (MOTHER_OF[other] === self) return 'mother';
  if (MOTHER_OF[self] === other) return 'son';
  if (CONQUERS[self] === other) return 'friend';
  return 'enemy';
}

// ---------- year attributes (Janson Appendix E.1) ----------

// Indexed by animal (Mouse … Pig), Table 18.
const LIFE = ['Water', 'Earth', 'Wood', 'Wood', 'Earth', 'Fire', 'Fire', 'Earth', 'Iron', 'Iron', 'Earth', 'Water'];
const SPIRIT = ['Iron', 'Fire', 'Water', 'Water', 'Fire', 'Wood', 'Wood', 'Fire', 'Earth', 'Earth', 'Fire', 'Iron'];
// Indexed by animal amod 4, Table 19.
const FORTUNE = ['Wood', 'Water', 'Iron', 'Fire'];
// Indexed by (Y - 3) amod 30, Table 22.
const BODY = [
  'Iron', 'Iron', 'Fire', 'Fire', 'Wood', 'Wood', 'Earth', 'Earth', 'Iron', 'Iron',
  'Fire', 'Fire', 'Water', 'Water', 'Earth', 'Earth', 'Iron', 'Iron', 'Wood', 'Wood',
  'Water', 'Water', 'Earth', 'Earth', 'Fire', 'Fire', 'Wood', 'Wood', 'Water', 'Water',
];

export const FORCES = [
  { key: 'life', name: 'Life force', tibetan: 'Sok' },
  { key: 'body', name: 'Body', tibetan: 'Lü' },
  { key: 'power', name: 'Power', tibetan: 'Wangthang' },
  { key: 'fortune', name: 'Wind horse', tibetan: 'Lungta' },
  { key: 'spirit', name: 'Soul', tibetan: 'La' },
];

/** The five elements of Tibetan year Y. */
export function yearElements(year) {
  const animal = amod(year - 3, 12);
  return {
    power: yearInfo(year).element,
    life: LIFE[animal - 1],
    body: BODY[amod(year - 3, 30) - 1],
    fortune: FORTUNE[amod(animal, 4) - 1],
    spirit: SPIRIT[animal - 1],
  };
}

// ---------- mewa (Table 16, E.3–E.5) ----------

export const MEWA = [
  null,
  { number: 1, color: 'White', element: 'Iron', direction: 'North' },
  { number: 2, color: 'Black', element: 'Water', direction: 'Southwest' },
  { number: 3, color: 'Blue', element: 'Water', direction: 'East' },
  { number: 4, color: 'Green', element: 'Wood', direction: 'Southeast' },
  { number: 5, color: 'Yellow', element: 'Earth', direction: 'Centre' },
  { number: 6, color: 'White', element: 'Iron', direction: 'Northwest' },
  { number: 7, color: 'Red', element: 'Fire', direction: 'West' },
  { number: 8, color: 'White', element: 'Iron', direction: 'Northeast' },
  { number: 9, color: 'Red', element: 'Fire', direction: 'South' },
];

export function yearMewa(year) {
  return {
    birth: MEWA[amod(2 - year, 9)],
    life: MEWA[amod(8 - year, 9)],
    power: MEWA[amod(5 - year, 9)],
  };
}

// ---------- people ----------

/** Full profile for someone born on the given Gregorian date. */
export function birthProfile(year, month, day) {
  const jd = gregorianToJd(year, month, day);
  const tibetan = jdToTibetan(jd);
  const ty = tibetan.year;
  return {
    jd,
    tibetan,
    beforeLosar: ty < year,
    year: yearInfo(ty),
    elements: yearElements(ty),
    mewa: yearMewa(ty),
  };
}

/** How the current Tibetan year's elements meet each of a person's own. */
export function yearForecast(profile, year) {
  const now = yearElements(year);
  return FORCES.map((f) => ({
    ...f,
    own: profile.elements[f.key],
    year: now[f.key],
    relation: elementRelation(profile.elements[f.key], now[f.key]),
  }));
}

// Animal groups of mutual friendship (the same groups as Table 19).
const animalGroup = (index) => amod(index, 4);

export function animalRelation(a, b) {
  const ia = ANIMALS.indexOf(a) + 1;
  const ib = ANIMALS.indexOf(b) + 1;
  if (ia === ib) return 'same';
  if (Math.abs(ia - ib) === 6) return 'opposite';
  if (animalGroup(ia) === animalGroup(ib)) return 'harmonious';
  return 'neutral';
}

const ANIMAL_TEXT = {
  same: 'Same sign',
  harmonious: 'Harmonious group',
  neutral: 'Neutral',
  opposite: 'Opposite · clashing',
};

/** App heuristic: 1–5 from the animal bond and life-force elements. */
export function compatibility(a, b) {
  const animal = animalRelation(a.year.animal, b.year.animal);
  const element = elementRelation(a.elements.life, b.elements.life);
  let score = 3;
  score += { harmonious: 1, same: 0, neutral: 0, opposite: -2 }[animal];
  score += { mother: 1, same: 1, friend: 0, son: 0, enemy: -1 }[element];
  score = Math.max(1, Math.min(5, score));
  return {
    score,
    animal,
    animalText: ANIMAL_TEXT[animal],
    element,
    elementText: `${RELATIONS[element].label} · their ${b.elements.life.toLowerCase()} ${RELATIONS[element].summary}`,
  };
}

// ---------- days ----------

export const WEEKDAYS = [
  { name: 'Sunday', tibetan: 'Nyima', planet: 'Sun' },
  { name: 'Monday', tibetan: 'Dawa', planet: 'Moon' },
  { name: 'Tuesday', tibetan: 'Mikmar', planet: 'Mars' },
  { name: 'Wednesday', tibetan: 'Lhakpa', planet: 'Mercury' },
  { name: 'Thursday', tibetan: 'Phurbu', planet: 'Jupiter' },
  { name: 'Friday', tibetan: 'Pasang', planet: 'Venus' },
  { name: 'Saturday', tibetan: 'Penpa', planet: 'Saturn' },
];

/** Elemental attributes of the calendar day jd (E.12). */
export function dayAttributes(jd) {
  const animalIndex = amod(jd + 2, 12);
  return {
    weekday: WEEKDAYS[weekday(jd)],
    element: ELEMENTS[amod(Math.ceil(jd / 2), 5) - 1],
    animal: ANIMALS[animalIndex - 1],
    lifeElement: LIFE[animalIndex - 1],
    mewa: MEWA[amod(-jd, 9)],
  };
}

/** How the day's element meets a person's life force. */
export function dayEnergy(profile, jd) {
  const day = dayAttributes(jd);
  const relation = elementRelation(profile.elements.life, day.element);
  return { day, relation, ...RELATIONS[relation] };
}

// ---------- observances ----------

const MONTHLY = {
  8: { name: 'Medicine Buddha day', text: 'A day for healing practices and prayers for long life.' },
  10: { name: 'Guru Rinpoche day', text: 'Tsok offerings and prayers to Padmasambhava.' },
  15: { name: 'Full moon · Amitabha day', text: 'The effect of positive and negative actions is multiplied.' },
  25: { name: 'Dakini day', text: 'Offerings and practices of the wisdom dakinis.' },
  30: { name: 'New moon · Buddha Shakyamuni day', text: 'A day for purification and renewing vows.' },
};

const ANNUAL = {
  1: { 15: { name: 'Chötrul Düchen', text: 'Day of Miracles, closing the first fifteen days of the year.' } },
  4: { 15: { name: 'Saga Dawa Düchen', text: 'The Buddha’s birth, enlightenment and parinirvana.' } },
  6: { 4: { name: 'Chökhor Düchen', text: 'The Buddha’s first teaching at Sarnath.' } },
  9: { 22: { name: 'Lhabab Düchen', text: 'The Buddha’s descent from the god realm.' } },
};

/** Observances in true month n, as a map from JD to a list of entries. */
export function monthObservances(n) {
  const { year, month, leap } = monthFromCount(n);
  const byJd = new Map();
  const put = (jd, entry) => byJd.set(jd, [...(byJd.get(jd) ?? []), entry]);
  for (const [day, info] of Object.entries(MONTHLY)) put(observanceJd(n, Number(day)), { ...info, kind: 'monthly' });
  // Annual düchen are not kept in leap months (Janson §11).
  if (!leap) {
    for (const [day, info] of Object.entries(ANNUAL[month] ?? {})) {
      put(observanceJd(n, Number(day)), { ...info, kind: 'annual' });
    }
  }
  // Losar is the first day of the year even when month 1 is a leap month.
  if (month === 1) {
    const losar = losarJd(year);
    if (monthDays(n).some((d) => d.jd === losar)) put(losar, { name: 'Losar', text: 'Tibetan New Year.', kind: 'annual' });
  }
  return byJd;
}

/** The next observances on or after jd (looks a few months ahead). */
export function upcomingObservances(jd, count = 3) {
  const out = [];
  let n = jdToTibetan(jd).monthCount;
  while (out.length < count) {
    const days = monthDays(n);
    for (const [ojd, list] of [...monthObservances(n)].sort((a, b) => a[0] - b[0])) {
      if (ojd < jd) continue;
      const tib = days.find((d) => d.jd === ojd);
      for (const o of list) out.push({ ...o, jd: ojd, tibetan: tib });
    }
    n++;
  }
  return out.slice(0, count);
}

/** Illuminated fraction (0–1) and whether the moon is waxing, by lunar day. */
export function moonPhase(day) {
  return { lit: (1 - Math.cos((2 * Math.PI * day) / 30)) / 2, waxing: day < 15 };
}

export const todayJd = () => dateToJd(new Date());
