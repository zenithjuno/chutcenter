// F4 parity test: the filter.js counts (what the UI shows) must equal an
// INDEPENDENT recount computed here with a separate implementation, over every
// topic × source × year-range combination — including ranges that cross the
// void years 2562–2564. No coverage matrix is trusted; truth is the L2 files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { filterQuestions } from '../src/filter.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'public', 'data');
const manifest = JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8'));

// Load the flattened bank straight from disk (same L2 files the browser fetches).
const bank = manifest.collections.flatMap(
  (c) => JSON.parse(readFileSync(join(dataDir, c.file), 'utf8')).questions,
);

const topics = ['all', ...manifest.topics.map((t) => t.slug)];
const sources = ['all', ...manifest.sources.map((s) => s.slug)];
const years = manifest.collections.map((c) => c.year_be);
const minY = Math.min(...years);
const maxY = Math.max(...years);

// Independent counter — deliberately a different shape from filter.js.
function independentCount(topic, source, yearFrom, yearTo) {
  let n = 0;
  for (const q of bank) {
    if (topic !== 'all' && q.topic_slug !== topic) continue;
    if (source !== 'all' && q.source !== source) continue;
    if (q.year_be < yearFrom || q.year_be > yearTo) continue;
    n += 1;
  }
  return n;
}

test('bank loaded: exactly 210 questions across 7 real years', () => {
  assert.equal(bank.length, 210);
  assert.deepEqual([...new Set(bank.map((q) => q.year_be))].sort(), [2559, 2560, 2561, 2565, 2566, 2567, 2568]);
});

test('void years 2562–2564 have zero questions and do not error', () => {
  for (const y of [2562, 2563, 2564]) {
    assert.equal(filterQuestions(bank, { yearFrom: y, yearTo: y }).length, 0);
  }
  // a range straddling the void gap counts only the real years inside it
  assert.equal(
    filterQuestions(bank, { yearFrom: 2561, yearTo: 2565 }).length,
    independentCount('all', 'all', 2561, 2565),
  );
});

test('fixed oracle spot-checks', () => {
  assert.equal(filterQuestions(bank, {}).length, 210);
  assert.equal(filterQuestions(bank, { topic: 'statistics' }).length, 23);
  assert.equal(filterQuestions(bank, { topic: 'linear-programming' }).length, 2);
  assert.equal(filterQuestions(bank, { yearFrom: 2559, yearTo: 2559 }).length, 30);
});

test('filter.js == independent counter for every topic×source×year-range combo', () => {
  let combos = 0;
  for (const topic of topics) {
    for (const source of sources) {
      for (let yf = minY; yf <= maxY; yf++) {
        for (let yt = yf; yt <= maxY; yt++) {
          const got = filterQuestions(bank, { topic, source, yearFrom: yf, yearTo: yt }).length;
          const want = independentCount(topic, source, yf, yt);
          assert.equal(got, want, `mismatch topic=${topic} source=${source} ${yf}-${yt}: ${got} != ${want}`);
          combos += 1;
        }
      }
    }
  }
  assert.ok(combos > 1800, `expected >1800 combos, ran ${combos}`);
});
