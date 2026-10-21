import test from 'node:test';
import assert from 'node:assert/strict';
import { gregorianToJd, jdToGregorian, monthCount } from '../js/calendar.js';
import {
  birthProfile, compatibility, dayAttributes, elementRelation, monthObservances, yearElements, yearMewa,
} from '../js/astrology.js';

test('year elements match Janson Table 23', () => {
  // [year, power-animal, life, body, fortune, spirit]
  const rows = [
    [1984, 'Wood', 'Water', 'Iron', 'Wood', 'Iron'],
    [1988, 'Earth', 'Earth', 'Wood', 'Wood', 'Fire'],
    [1990, 'Iron', 'Fire', 'Earth', 'Iron', 'Wood'],
    [1992, 'Water', 'Iron', 'Iron', 'Wood', 'Earth'],
    [1995, 'Wood', 'Water', 'Fire', 'Fire', 'Iron'],
    [1998, 'Earth', 'Wood', 'Earth', 'Iron', 'Water'],
  ];
  for (const [year, power, life, body, fortune, spirit] of rows) {
    assert.deepEqual(yearElements(year), { power, life, body, fortune, spirit }, `year ${year}`);
  }
});

test('mewa numbers decrease by one each year (E.3–E.5)', () => {
  assert.equal(yearMewa(2000).birth.number, 9);
  assert.equal(yearMewa(2001).birth.number, 8);
  assert.equal(yearMewa(2009).birth.number, 9);
  const m = yearMewa(2026);
  assert.equal(m.life.number, (m.birth.number + 6) % 9 || 9);
  assert.equal(m.power.number, (m.birth.number + 3) % 9 || 9);
});

test('births before Losar belong to the previous Tibetan year', () => {
  const early = birthProfile(2000, 1, 20); // Losar 2000 was 6 Feb
  assert.equal(early.beforeLosar, true);
  assert.equal(`${early.year.element} ${early.year.animal}`, 'Earth Rabbit');
  const late = birthProfile(2000, 5, 14);
  assert.equal(late.beforeLosar, false);
  assert.equal(`${late.year.element} ${late.year.animal}`, 'Iron Dragon');
  assert.equal(late.elements.life, 'Earth');
});

test('element relations', () => {
  assert.equal(elementRelation('Wood', 'Water'), 'mother');
  assert.equal(elementRelation('Wood', 'Fire'), 'son');
  assert.equal(elementRelation('Wood', 'Earth'), 'friend');
  assert.equal(elementRelation('Wood', 'Iron'), 'enemy');
  assert.equal(elementRelation('Wood', 'Wood'), 'same');
});

test('day attributes follow the 60-day cycle', () => {
  const a = dayAttributes(2461335);
  const b = dayAttributes(2461335 + 60);
  assert.deepEqual(a, { ...b, weekday: a.weekday, mewa: a.mewa });
  assert.equal(a.weekday.name, 'Wednesday'); // 21 Oct 2026
});

test('compatibility uses animal groups and opposites', () => {
  const dragon = birthProfile(2000, 5, 14);
  const monkey = birthProfile(1992, 6, 1);
  const dog = birthProfile(1994, 6, 1);
  assert.equal(compatibility(dragon, monkey).animal, 'harmonious');
  assert.equal(compatibility(dragon, dog).animal, 'opposite');
  assert.ok(compatibility(dragon, monkey).score > compatibility(dragon, dog).score);
});

test('Lhabab Düchen 2026 and Losar observances', () => {
  const lhabab = [...monthObservances(monthCount(2026, 9))].find(([, l]) => l.some((o) => o.name === 'Lhabab Düchen'));
  assert.deepEqual(jdToGregorian(lhabab[0]), { year: 2026, month: 11, day: 1 });
  const losar = [...monthObservances(monthCount(2026, 1))].find(([, l]) => l.some((o) => o.name === 'Losar'));
  assert.equal(losar[0], gregorianToJd(2026, 2, 18));
  // 2000 began with a leap month 1: Losar is in it, not in the regular month.
  const inLeap = [...monthObservances(monthCount(2000, 1, true))].some(([, l]) => l.some((o) => o.name === 'Losar'));
  const inRegular = [...monthObservances(monthCount(2000, 1))].some(([, l]) => l.some((o) => o.name === 'Losar'));
  assert.deepEqual([inLeap, inRegular], [true, false]);
});
