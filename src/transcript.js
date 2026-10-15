/**
 * Render a conversation and its threads as a readable plain-text transcript.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Convert thread body HTML to plain text, keeping line and paragraph breaks. */
export function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code =
          e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isNaN(code) ? m : String.fromCodePoint(code);
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function personName(p) {
  if (!p) return '';
  const name = `${p.first ?? ''} ${p.last ?? ''}`.trim();
  if (name && p.email) return `${name} <${p.email}>`;
  return name || p.email || '';
}

/** Threads come newest first from the API; the transcript reads oldest first. */
export function formatTranscript(conversation) {
  const threads = [...(conversation?._embedded?.threads ?? [])].sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt)),
  );
  const lines = [
    `#${conversation.number} ${conversation.subject ?? ''}`.trim(),
    `ID ${conversation.id} | ${conversation.status} | ${threads.length} thread(s)`,
  ];
  for (const t of threads) {
    lines.push('', '-'.repeat(72));
    if (t.type === 'lineitem') {
      lines.push(`${t.createdAt}  ${t.action?.text ?? 'event'}`);
      continue;
    }
    const author = personName(t.createdBy) || personName(t.customer);
    lines.push(`${t.createdAt}  ${t.type}${author ? ` from ${author}` : ''}`);
    if (t.to?.length) lines.push(`To: ${t.to.join(', ')}`);
    if (t.cc?.length) lines.push(`Cc: ${t.cc.join(', ')}`);
    const files = t._embedded?.attachments ?? [];
    if (files.length) lines.push(`Attachments: ${files.map((f) => f.filename).join(', ')}`);
    lines.push('', htmlToText(t.body) || '(no body)');
  }
  return lines.join('\n');
}
