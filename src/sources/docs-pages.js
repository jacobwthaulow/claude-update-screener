import { fetchWithRetry, escapeHtml } from '../utils.js';
import { getSourceState, setSourceState, isFirstRun } from '../state.js';
import { formatSection } from '../telegram.js';

export async function checkDocsPages() {
  const sections = [];

  try {
    const s = await checkModelsPage();
    if (s) sections.push(s);
  } catch (err) {
    console.warn(`[modelsPage] Failed: ${err.message}`);
  }

  return sections;
}

async function checkModelsPage() {
  const key = 'modelsPage';
  const url = 'https://docs.anthropic.com/en/docs/about-claude/models/all-models';

  const res = await fetchWithRetry(url);
  const html = await res.text();
  const models = extractModelIds(html);

  const firstRun = isFirstRun(key);
  const prev = getSourceState(key);

  setSourceState(key, { models });

  if (firstRun) {
    console.log(`[${key}] First run — initialized with ${models.length} models`);
    return null;
  }

  const prevModels = new Set(prev.models || []);
  const newModels = models.filter(id => !prevModels.has(id));
  const removedModels = (prev.models || []).filter(id => !models.includes(id));

  if (newModels.length === 0 && removedModels.length === 0) return null;

  const items = [];
  if (newModels.length > 0) {
    items.push(`New: ${newModels.map(m => `<code>${escapeHtml(m)}</code>`).join(', ')}`);
  }
  if (removedModels.length > 0) {
    items.push(`Removed: ${removedModels.map(m => `<code>${escapeHtml(m)}</code>`).join(', ')}`);
  }
  items.push(`<a href="${url}">View models</a>`);

  return formatSection('Models', items);
}

/**
 * Extract model API IDs from the raw HTML via regex.
 * Pages are CSR — content is embedded in React Server Component payloads.
 */
function extractModelIds(html) {
  const ids = new Set();
  const pattern = /claude-(?:opus|sonnet|haiku)-[\w.-]+/g;
  const matches = html.match(pattern);

  if (!matches) return [];

  for (const m of matches) {
    if (m.includes('release') || m.includes('blog') || m.includes('notes')) continue;
    ids.add(m);
  }

  return [...ids].sort();
}
