import { fetchWithRetry, escapeHtml, truncate } from '../utils.js';
import { getSourceState, setSourceState, isFirstRun } from '../state.js';
import { formatSection } from '../telegram.js';

const RSS_URL = 'https://status.anthropic.com/history.rss';
const KEY = 'statusPage';

export async function checkStatusPage() {
  try {
    const res = await fetchWithRetry(RSS_URL);
    const xml = await res.text();

    const items = parseRssItems(xml);
    if (items.length === 0) return null;

    const firstRun = isFirstRun(KEY);
    const prev = getSourceState(KEY);

    const latestPubDate = items[0].pubDate;
    const latestGuid = items[0].guid;

    setSourceState(KEY, { lastGuid: latestGuid, lastPubDate: latestPubDate });

    if (firstRun) {
      console.log(`[${KEY}] First run — initialized at ${latestPubDate}`);
      return null;
    }

    // Find new incidents since last check
    const prevDate = new Date(prev.lastPubDate);
    const newItems = items.filter(i => new Date(i.pubDate) > prevDate);

    if (newItems.length === 0) return null;

    const lines = newItems.slice(0, 5).map(item => {
      const date = new Date(item.pubDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const title = escapeHtml(truncate(item.title, 80));
      return `- ${date}: ${title}`;
    });

    if (newItems.length > 5) {
      lines.push(`<i>...and ${newItems.length - 5} more</i>`);
    }

    lines.push(`<a href="https://status.anthropic.com/">Status page</a>`);

    return formatSection('Status Incidents', lines);
  } catch (err) {
    console.warn(`[${KEY}] Failed: ${err.message}`);
    return null;
  }
}

/** Simple RSS parser — extracts <item> elements using regex. */
function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const guid = extractTag(block, 'guid');
    const description = extractTag(block, 'description');

    if (title && pubDate) {
      items.push({ title, link, pubDate, guid: guid || link, description });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return null;
  return (match[1] || match[2] || '').trim();
}
