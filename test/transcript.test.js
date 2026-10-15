import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, formatTranscript } from '../src/transcript.js';

test('htmlToText keeps breaks and decodes entities', () => {
  assert.equal(
    htmlToText(
      '<p>Hi&nbsp;there,</p><p>Line 1<br>Line &amp; 2 &#39;ok&#39;</p><ul><li>a</li></ul>',
    ),
    "Hi there,\nLine 1\nLine & 2 'ok'\n\n- a",
  );
});

test('formatTranscript orders oldest first and shows authors', () => {
  const text = formatTranscript({
    id: 1,
    number: 7,
    subject: 'Help',
    status: 'active',
    _embedded: {
      threads: [
        {
          type: 'message',
          createdAt: '2026-01-02T00:00:00Z',
          createdBy: { first: 'Ann', last: 'B' },
          body: '<p>Reply</p>',
        },
        {
          type: 'customer',
          createdAt: '2026-01-01T00:00:00Z',
          customer: { email: 'c@x.com' },
          body: 'Question',
        },
        {
          type: 'lineitem',
          createdAt: '2026-01-03T00:00:00Z',
          action: { text: 'closed the conversation' },
        },
      ],
    },
  });
  assert.match(text, /^#7 Help/);
  assert.ok(text.indexOf('Question') < text.indexOf('Reply'));
  assert.match(text, /customer from c@x\.com/);
  assert.match(text, /message from Ann B/);
  assert.match(text, /closed the conversation/);
});

test('htmlToText trims whitespace on both sides of each line', () => {
  assert.equal(
    htmlToText('<p>   Thanks mate,  </p>\n    <p>\tBoth variants. </p>'),
    'Thanks mate,\n\nBoth variants.',
  );
});
