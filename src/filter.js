// Pure filter/count logic over the L2 question bank — no I/O, no DOM.
// Shared by the browser UI (main.js) and the parity test. The browser IS the
// independent counter (F4): it reads L2 bank files directly and counts here,
// rather than trusting any pre-computed coverage matrix.

/** Flatten the per-year bank collections into one question array. */
export function flattenBank(collections) {
  // collections: array of { year_be, questions: [...] }
  return collections.flatMap((c) => c.questions);
}

/**
 * Filter questions by topic / source / inclusive year range.
 * - topic 'all' or a topic_slug
 * - source 'all' or a source slug
 * - yearFrom / yearTo: inclusive พ.ศ. bounds (null = unbounded). A range that
 *   spans void years (2562–2564, which simply have no questions) is not an
 *   error — those years contribute zero.
 */
export function filterQuestions(bank, { topic = 'all', source = 'all', yearFrom = null, yearTo = null } = {}) {
  return bank.filter(
    (q) =>
      (topic === 'all' || q.topic_slug === topic) &&
      (source === 'all' || q.source === source) &&
      (yearFrom === null || q.year_be >= yearFrom) &&
      (yearTo === null || q.year_be <= yearTo),
  );
}

export function countQuestions(bank, criteria) {
  return filterQuestions(bank, criteria).length;
}
