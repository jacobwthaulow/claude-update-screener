import * as cheerio from 'cheerio';
import { fetchWithRetry, escapeHtml } from '../utils.js';
import { getSourceState, setSourceState, isFirstRun } from '../state.js';
import { formatSection } from '../telegram.js';

const BLOG_URL = 'https://www.anthropic.com/news';
const KEY = 'anthropicBlog';

export async function checkAnthropicBlog() {
  try {
    const res = await fetchWithRetry(BLOG_URL);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract post entries — look for links to /news/slug
    const posts = [];
    $('a[href^="/news/"]').each((_, el) => {
      const href = $(el).attr('href');
      const slug = href.replace('/news/', '').replace(/\/$/, '');

      // Skip non-article slugs (empty, fragments, category pages)
      if (!slug || slug.includes('/') || slug.startsWith('#')) return;

      // Get the text content of the link or its parent card
      const title = $(el).text().trim() ||
                    $(el).find('h2, h3, h4').first().text().trim() ||
                    slug.replace(/-/g, ' ');

      // Dedupe by slug
      if (!posts.find(p => p.slug === slug)) {
        posts.push({ slug, title, url: `https://www.anthropic.com/news/${slug}` });
      }
    });

    // Safety: if we extracted zero posts, something broke — don't wipe state
    if (posts.length === 0) {
      console.warn(`[${KEY}] Zero posts extracted — possible page structure change`);
      return null;
    }

    const firstRun = isFirstRun(KEY);
    const prev = getSourceState(KEY);
    const currentSlugs = posts.map(p => p.slug);

    setSourceState(KEY, { knownSlugs: currentSlugs });

    if (firstRun) {
      console.log(`[${KEY}] First run — initialized with ${currentSlugs.length} posts`);
      return null;
    }

    const prevSlugs = new Set(prev.knownSlugs || []);
    const newPosts = posts.filter(p => !prevSlugs.has(p.slug));

    if (newPosts.length === 0) return null;

    const items = newPosts.map(p =>
      `- <a href="${p.url}">${escapeHtml(p.title)}</a>`
    );

    return formatSection('Anthropic Blog', items);
  } catch (err) {
    console.warn(`[${KEY}] Failed: ${err.message}`);
    return null;
  }
}
