# tibetan-astrology

A Tibetan astrology web app: today's Tibetan date and day energy, the lunar
calendar with holy days, your birth signs, and compatibility.

## Run

```bash
npm start
```

Then open http://localhost:5180. No dependencies are needed (Node 20+ for tests, Python 3 for the dev server).

```bash
npm test
```

```bash
npm run build
```

`npm run build` copies the static app into `dist/`.

## Layout

- `js/calendar.js`: Phugpa calendar engine (true month and date, leap months, repeated and skipped days, Losar, year names).
- `js/astrology.js`: year elements (sok, lü, wangthang, lungta, la), mewa, day attributes, element relations, observances, compatibility.
- `js/app.js`, `index.html`, `css/style.css`: the app's screens.
- `tests/`: checks against published Losar dates and the paper's tables.

## Sources

Calendar and astrology formulas follow Svante Janson, *Tibetan calendar
mathematics* ([arXiv:1401.6285](https://arxiv.org/abs/1401.6285)), sections 4–9, 11 and Appendix E.
The compatibility score and the daily guidance text are this app's own
simplification of the traditional element relations, not a full reading.
Birth parkha is not implemented yet.
