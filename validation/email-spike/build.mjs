// Builds the email rendering spike (brief 007, M3): one message with every
// hanging-punctuation variant, each beside a dashed guide at the text edge.
// Run after `npm run build:chat`: node validation/email-spike/build.mjs
import { writeFileSync } from 'node:fs';
import { typeset } from '../../packages/chat-typography/dist/static.js';

const brief = `"Good morning." Here's your brief for Thursday.

"Acme" signed the renewal; it's worth 12 % more than last year and closes in 30 days.

A plain paragraph without an opening quote, for comparison with the edge.`;

const options = { locale: 'en', spacing: true };
const email = await typeset(brief, { target: 'email', ...options });
const web = await typeset(brief, { target: 'web', ...options });

// Leading curly quote at the start of each paragraph, captured for the variants.
const opening = /<p>([“‘])/g;
const variants = [
  {
    id: 'A',
    name: 'Control: email target, no hanging markup',
    html: email,
  },
  {
    id: 'B',
    name: 'Current web markup with hanging.css inlined (inline-block, zero width, translateX)',
    html: web
      .replaceAll(' data-typograph-hanging=""', '')
      .replaceAll(
        '<span class="typograph-opening"><span>',
        '<span style="display:inline-block;width:0;white-space:nowrap"><span style="display:inline-block;transform:translateX(-100%)">',
      ),
  },
  {
    id: 'C',
    name: 'Negative margin on the quote (margin-left: -0.42em)',
    html: email.replace(opening, '<p><span style="margin-left:-0.42em">$1</span>'),
  },
  {
    id: 'D',
    name: 'Negative text-indent on the paragraph (text-indent: -0.42em)',
    html: email.replace(opening, '<p style="text-indent:-0.42em">$1'),
  },
  {
    id: 'E',
    name: 'Native CSS (hanging-punctuation: first), WebKit only',
    html: email.replaceAll('<p>', '<p style="hanging-punctuation:first">'),
  },
];

const font =
  "font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.45;color:#111";
const section = ({ id, name, html }) => `
<tr><td style="padding:24px 0 6px 0;font-family:Arial,sans-serif;font-size:13px;color:#666">
  <strong style="color:#c00">${id}</strong> — ${name}
</td></tr>
<tr><td style="padding:0 0 0 32px">
  <div style="border-left:1px dashed #e33;padding:0;${font}">
${html.replace(/<p(?: style="([^"]*)")?>/g, (_, style) => `<p style="margin:0 0 12px 0${style ? `;${style}` : ''}">`)}
  </div>
</td></tr>`;

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Typograph email spike</title></head>
<body style="margin:0;padding:24px;background:#fff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
<tr><td style="font-family:Arial,sans-serif;font-size:15px;color:#111;padding-bottom:8px">
  <strong>Typograph email spike.</strong> In each section, a hanging quote should sit just left of the dashed red line,
  with the words starting on the line. A pass also requires that a variant which does not hang shows an ordinary,
  unclipped quote at the line.
</td></tr>${variants.map(section).join('')}
</table></body></html>
`;

writeFileSync(new URL('./spike.html', import.meta.url), page);
console.log('Wrote validation/email-spike/spike.html');
