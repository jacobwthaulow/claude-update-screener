import { fetchWithRetry, escapeHtml, truncate } from '../utils.js';
import { getSourceState, setSourceState, isFirstRun } from '../state.js';
import { formatSection } from '../telegram.js';

const REPOS = [
  { key: 'githubClaudeCode', owner: 'anthropics', repo: 'claude-code', label: 'Claude Code' },
  { key: 'githubClaudeCodeAction', owner: 'anthropics', repo: 'claude-code-action', label: 'Claude Code Action' },
];

export async function checkGitHubReleases() {
  const sections = [];

  for (const { key, owner, repo, label } of REPOS) {
    try {
      const section = await checkRepo(key, owner, repo, label);
      if (section) sections.push(section);
    } catch (err) {
      console.warn(`[${key}] Failed: ${err.message}`);
    }
  }

  return sections;
}

async function checkRepo(key, owner, repo, label) {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`;
  const headers = {};

  // Use GITHUB_TOKEN if available for higher rate limits
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetchWithRetry(url, { headers });
  const releases = await res.json();

  if (!Array.isArray(releases) || releases.length === 0) return null;

  const firstRun = isFirstRun(key);
  const prev = getSourceState(key);
  const latestTag = releases[0].tag_name;

  // Update state with the latest tag
  setSourceState(key, { lastTag: latestTag });

  if (firstRun) {
    console.log(`[${key}] First run — initialized at ${latestTag}`);
    return null;
  }

  if (prev.lastTag === latestTag) return null;

  // Find all releases newer than the last seen tag
  const newReleases = [];
  for (const release of releases) {
    if (release.tag_name === prev.lastTag) break;
    newReleases.push(release);
  }

  if (newReleases.length === 0) return null;

  const items = newReleases.map(r => {
    const tag = escapeHtml(r.tag_name);
    const lines = [];
    lines.push(`<code>${tag}</code>`);

    // Extract key changes from release body
    if (r.body) {
      const bulletPoints = extractBullets(r.body, 5);
      for (const bp of bulletPoints) {
        lines.push(`- ${escapeHtml(bp)}`);
      }
    }

    lines.push(`<a href="${r.html_url}">Release notes</a>`);
    return lines.join('\n');
  });

  return formatSection(label, items);
}

/** Extract up to `max` bullet points from a GitHub release markdown body. */
function extractBullets(body, max) {
  const lines = body.split('\n');
  const bullets = [];

  for (const line of lines) {
    const match = line.match(/^[\s]*[-*]\s+(.+)/);
    if (match) {
      const text = match[1]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // strip markdown links
        .replace(/`([^`]+)`/g, '$1')                // strip inline code
        .replace(/\*\*([^*]+)\*\*/g, '$1')          // strip bold
        .trim();
      if (text.length > 0) {
        bullets.push(truncate(text, 120));
      }
    }
    if (bullets.length >= max) break;
  }

  return bullets;
}
