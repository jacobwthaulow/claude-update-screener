const MAX_MESSAGE_LENGTH = 4096;

/**
 * Send one or more Telegram messages.
 * Splits on section boundaries if content exceeds 4096 chars.
 */
export async function sendTelegramMessage(sections) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  }

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const header = `<b>Claude Updates — ${date}</b>\n`;
  const messages = buildMessages(header, sections);

  for (const msg of messages) {
    await sendWithRetry(token, chatId, msg);
  }
}

/**
 * Pack sections into messages that fit within the 4096-char limit.
 * Never splits mid-section.
 */
function buildMessages(header, sections) {
  const messages = [];
  let current = header;

  for (const section of sections) {
    const block = '\n' + section;

    if (current.length + block.length > MAX_MESSAGE_LENGTH) {
      // Current message is full — push it and start a new one
      if (current.trim().length > 0) {
        messages.push(current);
      }
      // If a single section exceeds the limit, truncate it
      current = block.length > MAX_MESSAGE_LENGTH
        ? block.slice(0, MAX_MESSAGE_LENGTH - 3) + '...'
        : block;
    } else {
      current += block;
    }
  }

  if (current.trim().length > 0) {
    messages.push(current);
  }

  return messages;
}

async function sendWithRetry(token, chatId, text, retries = 1) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (res.ok) return;

    const body = await res.text();
    console.error(`Telegram send failed (attempt ${attempt + 1}): ${res.status} ${body}`);

    if (attempt < retries) {
      await new Promise(r => setTimeout(r, 2000));
    } else {
      throw new Error(`Telegram send failed after ${retries + 1} attempts: ${res.status}`);
    }
  }
}

/**
 * Format a source section for the Telegram message.
 * Returns an HTML string block, or null if no updates.
 */
export function formatSection(title, items) {
  if (!items || items.length === 0) return null;
  return `<b>${title}</b>\n${items.join('\n')}`;
}
