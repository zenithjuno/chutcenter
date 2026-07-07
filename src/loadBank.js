// Browser-side L2 loader: fetch manifest + every bank file it lists, return the
// manifest plus the flattened question array. Base-relative so it resolves under
// any deploy subpath (e.g. GitHub Pages /chutcenter/).

export async function loadBank(base = import.meta.env.BASE_URL) {
  const manifest = await (await fetch(base + 'data/manifest.json')).json();
  const collections = await Promise.all(
    manifest.collections.map(async (c) => ({
      year_be: c.year_be,
      questions: (await (await fetch(base + 'data/' + c.file)).json()).questions,
    })),
  );
  const bank = collections.flatMap((c) => c.questions);
  return { manifest, bank };
}
