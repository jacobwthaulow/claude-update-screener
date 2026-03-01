import { loadState, saveState } from './state.js';
import { sendTelegramMessage } from './telegram.js';
import { checkGitHubReleases } from './sources/github-releases.js';
import { checkAnthropicBlog } from './sources/anthropic-blog.js';
import { checkReleaseNotes } from './sources/release-notes.js';
import { checkStatusPage } from './sources/status-page.js';
import { checkDocsPages } from './sources/docs-pages.js';

async function main() {
  console.log('Starting Claude Updates check...');

  loadState();

  const allSections = [];

  // Run each source checker sequentially to avoid rate limit issues
  const checkers = [
    { name: 'GitHub Releases', fn: checkGitHubReleases },
    { name: 'Anthropic Blog', fn: checkAnthropicBlog },
    { name: 'Release Notes', fn: checkReleaseNotes },
    { name: 'Status Page', fn: checkStatusPage },
    { name: 'Docs Pages', fn: checkDocsPages },
  ];

  for (const { name, fn } of checkers) {
    try {
      console.log(`Checking ${name}...`);
      const result = await fn();

      // Sources return a single section string or an array of sections
      if (Array.isArray(result)) {
        const filtered = result.filter(Boolean);
        if (filtered.length > 0) console.log(`  -> ${name}: ${filtered.length} update(s)`);
        allSections.push(...filtered);
      } else if (result) {
        console.log(`  -> ${name}: 1 update`);
        allSections.push(result);
      }
    } catch (err) {
      console.error(`[${name}] Error: ${err.message}`);
    }
  }

  // Save state regardless of whether we send notifications
  // This persists first-run initialization and successful checks
  saveState();
  console.log('State saved.');

  if (allSections.length === 0) {
    console.log('No updates found. No notification sent.');
    return;
  }

  console.log(`Found ${allSections.length} update section(s). Sending Telegram message...`);

  try {
    await sendTelegramMessage(allSections);
    console.log('Telegram message sent.');
  } catch (err) {
    console.error(`Failed to send Telegram message: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
