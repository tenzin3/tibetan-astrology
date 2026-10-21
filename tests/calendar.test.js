import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gregorianToJd, jdToGregorian, jdToTibetan, losarJd, monthCount, monthFromCount,
  hasLeapMonth, monthDays, monthStartJd, monthEndJd, observanceJd, yearInfo, weekday,
} from '../js/calendar.js';

const iso = (jd) => {
  const g = jdToGregorian(jd);
  return `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`;
};

test('Gregorian <-> JD round-trips and matches known values', () => {
  assert.equal(gregorianToJd(2000, 1, 1), 2451545);
  assert.equal(gregorianToJd(2001, 2, 10), 2451951); // example in Janson §7
  for (let jd = 2440000; jd < 2470000; jd += 37) {
    const g = jdToGregorian(jd);
    assert.equal(gregorianToJd(g.year, g.month, g.day), jd);
  }
  assert.equal(weekday(2451545), 6); // 1 Jan 2000 was a Saturday
});

test('Losar falls on the published dates', () => {
  const published = {
    2000: '2000-02-06', // first day of leap month 1 (Janson, Remark 17)
    2021: '2021-02-12',
    2022: '2022-03-03',
    2023: '2023-02-21',
    2024: '2024-02-10',
    2025: '2025-02-28',
    2026: '2026-02-18',
  };
  for (const [year, date] of Object.entries(published)) {
    assert.equal(iso(losarJd(Number(year))), date, `Losar ${year}`);
    const t = jdToTibetan(losarJd(Number(year)));
    assert.equal(t.year, Number(year));
    assert.equal(t.month, 1);
  }
});

test('year 2000 starts with a leap first month', () => {
  assert.ok(hasLeapMonth(2000, 1));
  const t = jdToTibetan(losarJd(2000));
  assert.equal(t.leapMonth, true);
});

test('month count and its inverse agree', () => {
  for (let year = 1950; year <= 2100; year++) {
    for (let month = 1; month <= 12; month++) {
      assert.deepEqual(monthFromCount(monthCount(year, month)), { year, month, leap: false });
      if (hasLeapMonth(year, month)) {
        assert.deepEqual(monthFromCount(monthCount(year, month, true)), { year, month, leap: true });
      }
    }
  }
});

test('leap months follow the 65-year cycle: 24 per cycle', () => {
  let count = 0;
  for (let year = 1987; year < 1987 + 65; year++) {
    for (let month = 1; month <= 12; month++) if (hasLeapMonth(year, month)) count++;
  }
  assert.equal(count, 24);
});

test('every month is 29 or 30 calendar days with consistent numbering', () => {
  const first = monthCount(1990, 1);
  for (let n = first; n < first + 600; n++) {
    const days = monthDays(n);
    assert.ok(days.length === 29 || days.length === 30, `month ${n} has ${days.length} days`);
    assert.equal(days[0].jd, monthStartJd(n));
    assert.equal(days.at(-1).jd, monthEndJd(n));
    for (let i = 1; i < days.length; i++) {
      const a = days[i - 1];
      const b = days[i];
      assert.equal(b.monthCount, n);
      // Numbers increase by 1, except a repeated date (0) or a skipped one (2).
      const step = b.day - a.day;
      assert.ok(step === 0 || step === 1 || step === 2, `bad step ${a.day} -> ${b.day}`);
      if (step === 0) assert.ok(a.leapDay && !b.leapDay);
      if (step === 2) assert.ok(a.skippedNext);
    }
  }
});

test('observances on skipped or repeated dates follow Janson §11', () => {
  const first = monthCount(2020, 1);
  for (let n = first; n < first + 120; n++) {
    const days = monthDays(n);
    for (const day of [8, 10, 15, 25]) {
      const jd = observanceJd(n, day);
      const label = days.find((d) => d.jd === jd);
      // The day carries the date itself, or the preceding date when it is skipped.
      assert.ok(label.day === day || (label.day === day - 1 && label.skippedNext));
      if (label.day === day && label.leapDay === false) {
        assert.ok(!days.some((d) => d.day === day && d.leapDay && d.jd !== jd));
      }
    }
  }
});

test('year names', () => {
  assert.deepEqual(
    [yearInfo(2007).element, yearInfo(2007).animal, yearInfo(2007).rabjung, yearInfo(2007).rabjungYear],
    ['Fire', 'Pig', 17, 21],
  );
  assert.equal(`${yearInfo(2026).element} ${yearInfo(2026).animal}`, 'Fire Horse');
  assert.equal(yearInfo(2026).royalYear, 2153);
  assert.equal(yearInfo(2026).gender, 'male');
});
