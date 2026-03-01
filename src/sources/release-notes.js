import { fetchWithRetry, escapeHtml } from '../utils.js';
import { getSourceState, setSourceState, isFirstRun } from '../state.js';
import { formatSection } from '../telegram.js';

const SOURCES = [
  {
    key: 'apiReleaseNotes',
    label: 'API Platform',
    url: 'https://docs.anthropic.com/en/release-notes/overview',
  },
  {
    key: 'claudeAppsNotes',
    label: 'Claude Apps',
    url: 'https://docs.anthropic.com/en/release-notes/claude-apps',
  },
  {
    key: 'systemPrompts',
    label: 'System Prompts',
    url: 'https://docs.anthropic.com/en/release-notes/system-prompts',
  },
];

export async function checkReleaseNotes() {
  const sections = [];

  for (const source of SOURCES) {
    try {
      const section = await checkSource(source);
      if (section) sections.push(section);
    } catch (err) {
      console.warn(`[${source.key}] Failed: ${err.message}`);
    }
  }

  return sections;
}

async function checkSource({ key, label, url }) {
  const res = await fetchWithRetry(url);
  const html = await res.text();

  const firstRun = isFirstRun(key);
  const prev = getSourceState(key);

  // These pages are CSR — hashing the full HTML doesn't work (nonces, chunk hashes change).
  // Instead, compare the extracted date list which represents the actual content.
  const dates = extractDatesFromHtml(html);

  setSourceState(key, { dates });

  if (firstRun) {
    console.log(`[${key}] First run — initialized with ${dates.length} dates (latest: ${dates[0] || 'none'})`);
    return null;
  }

  const prevDates = prev.dates || [];
  const prevSet = new Set(prevDates);
  const newDates = dates.filter(d => !prevSet.has(d));

  if (newDates.length === 0) return null;

  const items = newDates.map(d => `- ${escapeHtml(d)}`);
  items.push(`<a href="${url}">View all</a>`);

  return formatSection(label, items);
}

/**
 * Extract date headings from embedded React Server Component data.
 * The pages are CSR — dates appear in <script> tags as JSON like:
 * "headingLevel":3,"children":"February 19, 2026"
 */
function extractDatesFromHtml(html) {
  const datePattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}/g;
  const matches = html.match(datePattern);
  if (!matches) return [];

  const seen = new Set();
  const unique = [];
  for (const m of matches) {
    if (!seen.has(m)) {
      seen.add(m);
      unique.push(m);
    }
  }
  return unique;
}
