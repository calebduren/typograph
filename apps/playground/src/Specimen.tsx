import { useMemo, useState, type ComponentProps, type CSSProperties } from 'react';
import { Streamdown, defaultRemarkPlugins } from 'streamdown';
import hangingPunctuation from '@calebduren/typograph/hanging';
import { remarkPreview, previewRehypePlugins } from './chat-preview';
import { Slider } from './Slider';
import { Toggle } from './Toggle';
import type { TypographySettings } from './integration-settings';

const defaults = Object.values(defaultRemarkPlugins);
const allowedTags = { mark: [] };
const hangingPlugins: ComponentProps<typeof Streamdown>['rehypePlugins'] = [
  ...previewRehypePlugins,
  [hangingPunctuation, { locale: 'en' }],
];

// Original specimen prose in the spirit of Greek philosophy: varied Markdown
// lets the page exercise a real renderer without borrowing copyrighted writing.
const specimenText = `# "At the edge of the olive grove"

At first light, cicadas begin above the sea. A student remembers the old instruction: "Look again." In 30 min, the light will change.

## The practice of attention

Socrates asked questions in the city, but a question also belongs beside a stream: *what is this thing, and what does it ask of us?* Keep **the useful distinction** clear, and let *a quieter observation* remain quiet.

> "A mind becomes spacious when it has learned to notice."

### Things carried on the walk

- A small notebook, 20 cm wide, with a pressed olive leaf.
- A cup of water kept near the shade.
- A [field guide](https://www.loc.gov/) opened only after the bird has gone.

1. Name the thing you see.
2. Describe its change.
3. Ask, "What remains?"

---

#### A small table of particulars

| Matter | Observation |
| --- | --- |
| Time | "30 min" belongs together. |
| Record | \`const leaf = "olive";\` remains literal. |

##### Marginal forms

An <abbr title="example">example</abbr> may be <em>quiet</em>, <strong>firm</strong>, or <del>revised</del> <ins>restored</ins>. The <q>short quotation</q> is distinct from a <cite>named work</cite>; a <time datetime="2026-09-22">date</time>, H<sub>2</sub>O, and 2<sup>nd</sup> each keep their own small logic.

### The changing weather

Aristotle began with the world as it appears: seeds, animals, rain, and the habits of a place. A swallow cuts through the afternoon air without consulting a map. The clouds gather above the ridge; below it, the thyme keeps its silver green.

> "Nature is never in a hurry, yet the season is always arriving."

### The shore at noon

By noon the stones hold their warmth. A lizard waits at the edge of a wall, motionless until the shadow of a hawk passes. The sea makes a regular sound against the lower rocks, then changes its mind at the next gust. Nothing in this small scene asks to be improved. It only asks to be seen before the mind puts a name over it.

The old philosophers liked a clear distinction: a thing itself, and the story told about it. The cypress has a scent; the path has dust; the water has a temperature that changes against the ankle. These are not symbols until someone makes them so. For now, they are enough.

### A measure for the day

Keep a few observations close together: 8 km before the spring, 15 min beneath the plane tree, 3 small birds crossing east. Numbers are not dry when they belong to a lived thing. They tell the body where it is, and they give a later reader a way back to the same place.

- The bright side of a leaf turns toward the sun.
- A bee pauses at each flower without hurrying the next.
- A stone path records rain long after the clouds have moved on.

> "The patient eye finds more than the searching one."

### On returning

At dusk, the grove becomes a darker shape against the sky. The walk is not a lesson to carry home intact. It is a practice of returning: to the room, to the page, and to the next ordinary detail that deserves a second look.

### A final observation

To read with care is to notice what a sentence joins, what it leaves separate, and where it gives the eye room to rest.

###### The close

<dl><dt>Purpose</dt><dd>To make the reading surface test real text.</dd><dt>Method</dt><dd>Let changes remain visible.</dd></dl>

<p>Original prose; <kbd>Tab</kbd> reaches controls. <code>code</code>, <samp>output</samp>, and <var>x</var> remain literal.</p>

<address>Printed for the reader<br />Typograph specimen desk</address>`;

function FormattedText({ settings, changes }: { settings: TypographySettings; changes: boolean }) {
  const remarkPlugins = useMemo<ComponentProps<typeof Streamdown>['remarkPlugins']>(
    () =>
      settings.punctuation || settings.spacing
        ? [...defaults, [remarkPreview, { ...settings, highlight: true }]]
        : defaults,
    [settings],
  );
  // Refresh Streamdown when the plugin configuration changes.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- intentionally refresh plugin identity when settings change
  const plugins = useMemo(() => ({}), [remarkPlugins, settings.hanging]);
  return (
    <Streamdown
      className={`specimen-prose response-prose${changes ? ' show-changes' : ''}`}
      remarkPlugins={remarkPlugins}
      plugins={plugins}
      rehypePlugins={settings.hanging ? hangingPlugins : previewRehypePlugins}
      allowedTags={allowedTags}
      controls={false}
    >
      {specimenText}
    </Streamdown>
  );
}

export function Specimen() {
  const [settings, setSettings] = useState<TypographySettings>({
    punctuation: true,
    spacing: true,
    hanging: true,
  });
  const [family, setFamily] = useState<'sans' | 'serif'>('sans');
  const [size, setSize] = useState(18);
  const [leading, setLeading] = useState(1.7);
  const [changes, setChanges] = useState(true);

  return (
    <main className="specimen-page">
      <section
        className={`specimen-sheet specimen-${family}`}
        style={{ '--specimen-size': `${size}px`, '--specimen-leading': leading } as CSSProperties}
        aria-label="Typography specimen"
      >
        <aside className="specimen-controls" aria-label="Specimen controls">
          <a className="wordmark specimen-wordmark" href="/">
            Typograph
          </a>
          <div className="specimen-control-title">
            <p>Live typesetting</p>
            <span>Every switch touches the copy.</span>
          </div>
          <div className="typography-settings-switches">
            <Toggle
              label="Smart punctuation"
              checked={settings.punctuation}
              onChange={(punctuation) => setSettings({ ...settings, punctuation })}
            />
            <Toggle
              label="Non-breaking spaces"
              checked={settings.spacing}
              onChange={(spacing) => setSettings({ ...settings, spacing })}
            />
            <Toggle
              label="Hanging punctuation"
              checked={settings.hanging}
              onChange={(hanging) => setSettings({ ...settings, hanging })}
            />
            <Toggle label="Highlight changes" checked={changes} onChange={setChanges} />
          </div>
          <div className="specimen-field">
            <span>Face</span>
            <div className="segmented-control" role="group" aria-label="Typeface">
              <button aria-pressed={family === 'serif'} onClick={() => setFamily('serif')}>
                Serif
              </button>
              <button aria-pressed={family === 'sans'} onClick={() => setFamily('sans')}>
                Sans serif
              </button>
            </div>
          </div>
          <label className="specimen-field">
            Size <output>{size}px</output>
            <Slider
              label="Specimen font size"
              min={10}
              max={22}
              value={size}
              onChange={setSize}
              valueText={`${size}px`}
            />
          </label>
          <label className="specimen-field">
            Leading <output>{leading.toFixed(2)}</output>
            <Slider
              label="Specimen line height"
              min={1.1}
              max={1.7}
              step={0.02}
              value={leading}
              onChange={setLeading}
              valueText={leading.toFixed(2)}
            />
          </label>
          <p className="specimen-key">
            <i data-change="punctuation" /> punctuation <i data-change="spacing" /> joined space{' '}
            <i data-change="hanging" /> hanging quote
          </p>
        </aside>
        <article className="specimen-reading">
          <div
            className="specimen-guides"
            aria-hidden="true"
            hidden={!changes || !settings.hanging}
          >
            <span />
            <span />
            <span />
          </div>
          <FormattedText settings={settings} changes={changes} />
        </article>
      </section>
    </main>
  );
}
