// Tibetan (Phugpa) calendar engine.
//
// Implements the formulas in Svante Janson, "Tibetan calendar mathematics"
// (arXiv:1401.6285), sections 5–8, using the E1987 epoch (beta* = 0).
// All astronomical quantities are computed with exact rational arithmetic
// (BigInt fractions) so that day boundaries never depend on float rounding.

// ---------- exact fractions ----------

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

function frac(n, d = 1n) {
  n = BigInt(n);
  d = BigInt(d);
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}

const add = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => frac(a.n * b.n, a.d * b.d);

function floorBig(a) {
  const q = a.n / a.d;
  return a.n < 0n && q * a.d !== a.n ? q - 1n : q;
}

const mod1 = (a) => sub(a, frac(floorBig(a)));

// ---------- integer helpers ----------

const floorDiv = (a, b) => Math.floor(a / b);
const ceilDiv = (a, b) => Math.ceil(a / b);
const mod = (a, b) => ((a % b) + b) % b;
/** "amod": like mod but returns b instead of 0. */
export const amod = (a, b) => mod(a - 1, b) + 1;

// ---------- epoch E1987 constants (Janson §5, §7) ----------

const Y0 = 1987;
const M0 = 3;
const BETA_STAR = 0;
const BETA = 184 - BETA_STAR;

const MEAN_MONTH = frac(167025, 5656); // m1
const MEAN_DAY = frac(11135, 11312); // m2
const MEAN_EPOCH = frac(2446914n * 707n + 135n, 707n); // m0
const SUN_MONTH = frac(65, 804); // s1
const SUN_DAY = frac(13, 4824); // s2 (s0 = 0 for E1987)
const ANOM_MONTH = frac(253, 3528); // a1
const ANOM_DAY = frac(1, 28); // a2
const ANOM_EPOCH = frac(38, 49); // a0
const QUARTER = frac(1, 4);
const SIXTY = frac(60);

const MOON_TAB = [0, 5, 10, 15, 19, 22, 24, 25];
const SUN_TAB = [0, 6, 10, 11];

function moonTab(i) {
  i = mod(i, 28);
  if (i <= 7) return MOON_TAB[i];
  if (i <= 14) return MOON_TAB[14 - i];
  if (i <= 21) return -MOON_TAB[i - 14];
  return -MOON_TAB[28 - i];
}

function sunTab(i) {
  i = mod(i, 12);
  if (i <= 3) return SUN_TAB[i];
  if (i <= 6) return SUN_TAB[6 - i];
  if (i <= 9) return -SUN_TAB[i - 6];
  return -SUN_TAB[12 - i];
}

/** Linear interpolation in a table indexed by integers, at exact fraction x. */
function interpolate(tab, x) {
  const i = Number(floorBig(x));
  const r = sub(x, frac(i));
  const lo = tab(i);
  const hi = tab(i + 1);
  return add(frac(lo), mul(r, frac(hi - lo)));
}

/** Exact true date (JD + fraction) at the end of lunar day d of true month n. */
export function trueDate(d, n) {
  const N = frac(n);
  const D = frac(d);
  const meanDate = add(add(mul(N, MEAN_MONTH), mul(D, MEAN_DAY)), MEAN_EPOCH);
  const meanSun = mod1(add(mul(N, SUN_MONTH), mul(D, SUN_DAY)));
  const anomMoon = mod1(add(add(mul(N, ANOM_MONTH), mul(D, ANOM_DAY)), ANOM_EPOCH));
  const anomSun = mod1(sub(meanSun, QUARTER));
  const moonEqu = interpolate(moonTab, mul(frac(28), anomMoon));
  const sunEqu = interpolate(sunTab, mul(frac(12), anomSun));
  return sub(add(meanDate, mul(moonEqu, frac(1, 60))), mul(sunEqu, frac(1, 60)));
}

/** Julian day number of the calendar day in which lunar day d of month n ends. */
export function lunarDayEndJd(d, n) {
  return Number(floorBig(trueDate(d, n)));
}

// ---------- months (Janson §5) ----------

/** True month count n for month M (1–12) of Tibetan year Y. */
export function monthCount(year, month, leap = false) {
  const mStar = 12 * (year - Y0) + month - M0;
  return floorDiv(67 * mStar + BETA_STAR + 17, 65) - (leap ? 1 : 0);
}

/** Whether month M of year Y is preceded by a leap (duplicate) month. */
export function hasLeapMonth(year, month) {
  const mStar = 12 * (year - Y0) + month - M0;
  const ix = mod(2 * mStar + BETA_STAR, 65);
  return ix === 48 || ix === 49;
}

/** Inverse of monthCount: { year, month, leap } for true month count n. */
export function monthFromCount(n) {
  const x = ceilDiv(65 * n + BETA, 67);
  const month = amod(x, 12);
  const year = ceilDiv(x, 12) - 1 + Y0;
  const r = mod(65 * n + BETA, 67);
  return { year, month, leap: r === 1 || r === 2 };
}

export const monthStartJd = (n) => lunarDayEndJd(30, n - 1) + 1;
export const monthEndJd = (n) => lunarDayEndJd(30, n);

/** JD of Losar, the first day of Tibetan year Y. */
export const losarJd = (year) => monthEndJd(monthCount(year - 1, 12)) + 1;

// ---------- Gregorian <-> JD ----------

export function gregorianToJd(y, m, d) {
  const a = floorDiv(14 - m, 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + floorDiv(153 * m2 + 2, 5) + 365 * y2 + floorDiv(y2, 4) - floorDiv(y2, 100) + floorDiv(y2, 400) - 32045;
}

export function jdToGregorian(jd) {
  const a = jd + 32044;
  const b = floorDiv(4 * a + 3, 146097);
  const c = a - floorDiv(146097 * b, 4);
  const d = floorDiv(4 * c + 3, 1461);
  const e = c - floorDiv(1461 * d, 4);
  const m = floorDiv(5 * e + 2, 153);
  return {
    day: e - floorDiv(153 * m + 2, 5) + 1,
    month: m + 3 - 12 * floorDiv(m, 10),
    year: 100 * b + d - 4800 + floorDiv(m, 10),
  };
}

export const dateToJd = (date) => gregorianToJd(date.getFullYear(), date.getMonth() + 1, date.getDate());

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (jd) => mod(jd + 1, 7);

// ---------- days (Janson §6, §8) ----------

// Lunar days are indexed t = 30n + d with d in 1..30.
const tEnd = (t) => {
  const n = floorDiv(t - 1, 30);
  return lunarDayEndJd(t - 30 * n, n);
};

/**
 * Tibetan date of the calendar day with Julian day number jd.
 * A calendar day takes the number of the first lunar day ending in it;
 * a day in which no lunar day ends is the first of a repeated date (leapDay).
 */
export function jdToTibetan(jd) {
  let t = Math.floor((jd - 2446914.19) / 0.984353) + 1;
  while (tEnd(t) >= jd) t--;
  while (tEnd(t) < jd) t++;
  // t is now the first lunar day ending on or after jd.
  const n = floorDiv(t - 1, 30);
  const day = t - 30 * n;
  const end = tEnd(t);
  const { year, month, leap } = monthFromCount(n);
  return {
    jd,
    year,
    month,
    leapMonth: leap,
    day,
    leapDay: end > jd,
    skippedNext: end === jd && tEnd(t + 1) === jd,
    monthCount: n,
  };
}

/** Every calendar day of true month n, in order. */
export function monthDays(n) {
  const days = [];
  for (let jd = monthStartJd(n); jd <= monthEndJd(n); jd++) days.push(jdToTibetan(jd));
  return days;
}

/**
 * JD on which an observance fixed to lunar day D of month n falls:
 * a skipped date moves to the preceding day, a repeated one to the first.
 */
export function observanceJd(n, day) {
  const end = lunarDayEndJd(day, n);
  const prev = day > 1 ? lunarDayEndJd(day - 1, n) : lunarDayEndJd(30, n - 1);
  return end - prev === 2 ? end - 1 : end;
}

// ---------- years (Janson §4) ----------

export const ELEMENTS = ['Wood', 'Fire', 'Earth', 'Iron', 'Water'];
export const ANIMALS = ['Mouse', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Sheep', 'Monkey', 'Bird', 'Dog', 'Pig'];

/** Name parts of Tibetan year Y (numbered by the Gregorian year it starts in). */
export function yearInfo(year) {
  const z = amod(year - 3, 10);
  return {
    year,
    element: ELEMENTS[Math.ceil(z / 2) - 1],
    animal: ANIMALS[amod(year - 3, 12) - 1],
    gender: z % 2 === 1 ? 'male' : 'female',
    rabjung: Math.ceil((year - 1026) / 60),
    rabjungYear: amod(year - 1026, 60),
    royalYear: year + 127,
  };
}
