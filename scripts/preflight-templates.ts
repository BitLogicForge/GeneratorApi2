import { loadTemplateCatalog } from '../src/templates/catalog.ts';

try {
  const catalog = await loadTemplateCatalog();
  console.log(
    JSON.stringify(
      { templates: catalog.map((entry) => entry.metadata) },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    'Template preflight failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
}
