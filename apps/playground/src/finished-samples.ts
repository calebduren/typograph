import type { InputKind } from './finished';

// Starting points only: every sample is plain, untypeset text that you can replace.
export const samples: Record<InputKind, { file: string; text: string }> = {
  text: {
    file: 'notifications.txt',
    text: `Your brief is ready: "Q3 pipeline review" takes 12 min to read.

Dr. Patel's team shipped 3 fixes. J. R. Okafor reviews them at 9 a.m.

'Til Friday, the rollout stays at 25 %.`,
  },
  markdown: {
    file: 'brief.md',
    text: `# Thursday brief

"Good morning." Here's what changed overnight.

- **Acme** signed the renewal; it's worth 12 % more than last year.
- The "Atlas" migration finished in 42 min, 18 min faster than Tuesday's run.
- Dr. Chen's review is due Friday.

| Account | Status |
| --- | --- |
| "Northwind" | Won't renew until Q1 |

Run \`npm run check\` before you merge, and read [the guide](https://typograph.dev/integration.md) if you haven't yet.
`,
  },
  html: {
    file: 'email.html',
    text: `<!DOCTYPE html>
<html lang="en">
<head><title>Thursday brief</title></head>
<body>
<table role="presentation" width="100%">
<tr><td style="font-family: Georgia, serif; font-size: 17px; line-height: 1.5">
<h1 style="font-size: 22px">&quot;Good morning,&quot; Sam</h1>
<p>Here&#39;s your brief. Acme signed the renewal; it&#39;s worth 12 % more than last year.</p>
<p>The &quot;Atlas&quot; migration finished in 42 min. <a href="https://example.com/it's-done">Read the report</a>.</p>
<!--[if mso]><p>"Shown only in Outlook"</p><![endif]-->
<p lang="fr">&quot;Bonne journée&quot; de l'équipe de Paris.</p>
</td></tr>
</table>
</body>
</html>
`,
  },
};
