---
name: Typograph
description: Type with intention. A minimalist system shaped by proportion and geometric construction.
colors:
  gray: '#8d8d8d'
  hover: '#444444'
  paper: '#fcfcfc'
  sheet: '#f7f7f7'
  soft: '#ededed'
  ink: '#242424'
  muted: '#666666'
  line: '#d8d8d8'
  accent: '#242424'
  accent-soft: '#dedede'
  dark-hover: '#dedede'
  dark-paper: '#242424'
  dark-sheet: '#292929'
  dark-soft: '#333333'
  dark-ink: '#fcfcfc'
  dark-muted: '#b6b4b4'
  dark-line: '#3d3d3d'
  dark-accent: '#fcfcfc'
  dark-accent-soft: '#424242'
  change-punctuation: '#f0a8a8'
  change-spacing: '#f9e2e2'
  change-spacing-stripe: '#df6868'
  change-hanging: '#e8e8e8'
  dark-change-punctuation: '#723131'
  dark-change-spacing: '#4f3030'
  dark-change-spacing-stripe: '#d86464'
  dark-change-hanging: '#424242'
typography:
  wordmark:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 1.25rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: normal
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: normal
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: normal
  annotation:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: normal
  code:
    fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: normal
  body-small:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: normal
  homepage-heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 1.625rem
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.015em
  homepage-reading:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: normal
  homepage-reading-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: normal
  homepage-proof:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 14cqi
    fontWeight: 450
    lineHeight: 1.1
    letterSpacing: -0.025em
  homepage-proof-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Helvetica Neue', Helvetica, 'Segoe UI', system-ui"
    fontSize: 13.2cqi
    fontWeight: 450
    lineHeight: 1.1
    letterSpacing: -0.015em
rounded:
  segmented-option: 0.25rem
  chat-bubble: 0.75rem
  control: 0.125rem
  track: 1rem
  circle: 50%
  annotation: 1px
  proof-mark: 0.06em
  segmented-control: 0.5rem
spacing:
  compact: 0.5rem
  inline: 0.75rem
  unit: 1rem
  label: 1.25rem
  group: 1.5rem
  panel: 2rem
  column: 3rem
  mobile-section: 3.5rem
  section: 6rem
components:
  switch:
    textColor: '{colors.ink}'
    size: 1.75rem 1rem
    rounded: '{rounded.track}'
  homepage-comparison-pane:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink}'
    typography: '{typography.homepage-reading}'
    padding: 1.5rem 2rem 1rem
---

# Design System: Typograph

## Product direction (fourth iteration, 25 September 2026, user-directed)

Typograph is presented as a product, with Apple and Stripe as the references. Where this conflicts with the sections below, it governs the homepage. It supersedes the third, Raycast-style dark iteration; the Gradient Blinds header and all decorative gradients are gone.

- **Warm paper, olive ink.** Light by default: paper #ebebe7, cards #f2f2ee to white, olive-black ink #2b3222, grays with an olive cast. Dark mode follows the system: ground #121410, ink #eceee5. Surfaces use a hairline ring and a soft, long shadow, never a border and never a gradient.
- **One accent.** Lime appears only where Typograph changed text: a translucent highlight behind each changed glyph, a short deep-lime bar beneath a no-break space, and small accent text. The primary button and the “New” tag are ink on paper, which inverts in dark mode; there is no separate brand olive or lime.
- **Type.** Hedvig Letters Serif (roman, optical size 24) for headings and the wordmark only, at zero tracking so its ligatures (fi, fl, ff, ft, tt) render. Headings are one color; no accent words. Display type set at text spacing reads loose, so every letter pair in a serif heading is kerned by hand with letter-spacing spans (`src/Kern.tsx`): each pair is pulled toward 0.05em of clear space by 30% of its distance from it, never tightening more than 0.035em and never closer than 0.02em, so loose pairs such as `Yo`, `ol`, and `he` tighten most. `scripts/measure-hedvig-kerning.py` measures the outlines and generates `src/kerning.ts` from every `<Kern>` string; ligatures are never split, and since a span drops the font's kern on both sides, each value restores it. Inter Variable, with its default glyphs (double-story a), for everything else, including every demonstrated reply. Monospace only for code and commands.
- **Mark and header.** A seven-stroke burst (`src/LogoMark.tsx`; hovering the header wordmark spins each stroke half a turn in sequence, easing in and out, which lands exactly on the resting mark) beside the serif wordmark on the left; Changelog, GitHub, and Install on the right. The changelog lives at `/changelog`, typeset from `CHANGELOG.md` by the package.
- **Elevation.** Raised surfaces carry a 0.5px hairline ring inside their shadow, never a border beside a shadow; the dark ring uses much more alpha because it paints over the page. Copy button labels change with the transitions-dev text swap, inside a frame sized to the widest label, so the button never changes width.
- **Controls.** Pill-shaped buttons, command, and segmented controls. The segmented thumb is a raised white pill positioned by `src/segments.ts`.
- **The stream story.** The hero pins and recedes (scale to 1.16, blur to 18px, fade to 6%) as two plain columns rise and scale into place on an ease-out curve, trailing the scroll and then settling: model output, and the same tokens under the typograph logo, in light (350) Inter with no cards, backgrounds, or caret. The reply is a short daily brief dated today in the visitor's clock. The stream waits until 18% of the section's scroll and finishes by 84%, shortly after the columns pin, so the complete reply holds before the page moves on. Each frame eases toward the token count the scroll sets, so a fast scroll streams fast, a pause stops mid-sentence, and scrolling back rewinds. The right column is `typesetText` in its streaming phase on each prefix, and the last token uses the complete phase. Paragraphs that hang an opening quote start on a straight-sided capital (E, D, R, P…), never `"A`, whose hung pair sets too loose. Both columns mark the same characters. Reduced motion removes pinning and zoom and shows the finished reply.
- **Specimen.** `/specimen` shares the site header and is one white sheet: a control bar (switches, face, size, leading), three columns of prose clipped at the right edge with dashed column rules for hanging quotes, and a legend footer. Serif mode uses Hedvig; sans mode uses Inter.
- **Motion.** Two shared curves: `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`) for anything arriving or responding, `--ease-in-out` (`cubic-bezier(0.77, 0, 0.175, 1)`) for motion that stays on screen, and plain `ease` for color. Every pressable control scales to 0.97 on press over 160ms. Tooltips grow from the edge that meets their word, open after 120ms in 150ms, close in 100ms, and hand off instantly between adjacent terms; hover opens them only on hover-capable pointers. Hover decoration (the logo spin) runs only for a real mouse, never for touch or keyboard focus. No bounce except the slider's small overshoot after an over-drag. Reduced motion keeps fades and color changes and makes every movement instant; reduced transparency makes the header solid.
- **Honesty.** The Live Proof Rule below still holds for every demonstration on the page.

## Overview

**Creative North Star: "Type with intention"**

Typograph uses geometric construction, asymmetric proportion, a monochrome palette, and restrained tonal emphasis. The identity follows the approved minimalist/Bauhaus direction. A small, medium-weight wordmark stands alone; typography supplies the expression.

The interface uses a clear sans serif voice. The current homepage applies this established identity to an English chat comparison with ruled sections and equal reading columns. These are Typograph’s own brand choices; integrations preserve the identity of the product where they are used.

**Key Characteristics:**

- A plain wordmark, a large display headline, and a live punctuation specimen.
- Monospace for technical facts: code points, calls, timings, byte counts, and file names.
- Every demonstration runs the published package in the visitor's browser; nothing is pre-rendered.
- Sentence-case labels with natural tracking.
- Asymmetric layouts and grouped space.
- Flat surfaces, visible controls, and inspectable text.

## Colors

The palette is anchored by #242424 ink, #8d8d8d gray, and #fcfcfc paper. Structural surfaces and supporting text remain neutral grays. The annotation colors are the sole functional exception: dusty rose for smart punctuation, a pale red background with diagonal red stripes for non-breaking spaces, and neutral gray for hanging quotes. Dark mode keeps the same hue family, lifting those washes off paper instead of introducing a separate blue/amber/lilac palette. Paper is the page, sheet is the reading surface, soft is the inset panel, muted is supporting text, and line is the fine boundary. The homepage uses muted for supporting text. Ink carries the complete hero heading. The soft neutral accent remains the selection color, named `--selected` on the homepage. The hero and both preview columns use faint dashed guides that extend 40px above and below the text and fade to transparent across each extension. Preview padding reserves that space even when guides are hidden, so Highlight changes cannot alter layout. The homepage proof and optional preview highlights use the dedicated `change-*` tokens; hanging gray takes precedence on a hanging quote. Text-bearing highlights use backgrounds on negative-layer pseudo-elements within an isolated prose/proof container, preserving the neighboring glyphs even with close letter-spacing. Legend swatches retain ordinary backgrounds. Preview annotation markup stays mounted; Highlight changes only reveals its backgrounds and absolute rulers. The legend always reserves its layout space, becoming invisible and hidden from accessibility when disabled, so highlighting cannot change glyph geometry, reading height, or scroll position. Dark-prefixed tokens are the automatic dark-mode values, activated by `prefers-color-scheme`.

**The Monochrome Rule.** Use neutral tones derived from the three palette anchors. Avoid pure black, pure white, and decorative colored accents. The documented functional change annotations are permitted in the homepage proof, preview, and legend. Use ink for reading and active states; reserve middle gray for large type and accents.

## Typography

San Francisco carries the interface on Apple platforms; Inter Variable supplies the equivalent voice on Windows and other platforms. Apple-specific system aliases precede Inter, while Helvetica Neue, Helvetica, Segoe UI, and the generic system face follow it. Code uses native monospace families. No font is synthesized.

The two bundled Inter 4.1 WOFF2 files provide roman and italic faces, weights 100–900, and automatic optical sizing from 14–32. Body text uses 400 and emphasis uses 600. Semantic italics request the actual italic face. System fonts are resolved by the browser without user-agent detection; no Apple or Microsoft font files are distributed.

**Redesign, 25 September 2026 (user-directed).** The homepage now uses a display scale: the hero headline reaches 4.875rem (`clamp(2.625rem, 5.6vw, 4.875rem)`, weight 500, −0.045em), section headings reach 2.625rem (−0.035em), and the live specimen reaches 9.25rem. Interface and reading type keep the compact ceiling below. Technical labels use the native monospace stack at 0.75–0.8125rem. The rest of this paragraph describes the compact scale that still governs interface and reading type. The site’s interface and reading type scale tops out at 1.625rem, about 26px at the default root size. Reading headings share this ceiling; reading headings, lead text, and Markdown headings use capped relative sizes. The wordmark is 1.25rem at weight 500 across widths. The user-requested punctuation illustration is the sole oversized exception, reaching 6rem on wide screens and scaling to its container on mobile. Browser zoom and reader text preferences remain effective because the cap is relative. The site has no tracked-uppercase styling. The root uses `font-synthesis: none` and normal caps. There are no visible font credits. The bundled files retain their SIL Open Font License.

The `homepage-*` roles record the current reading, heading, and proof styles. Homepage headings use medium weight and slightly tight tracking. The unprocessed and formatted responses use the same renderer and reading role. The original pane defaults to rendered text; its Markdown tab exposes the editable source. Formatted blocks have a 1.25em gap; the editor preserves source newlines. Reading drops to its mobile role at 520px. The wordmark retains its established size and weight, with -0.035em tracking on this route. The enlarged homepage proof uses its own recorded role, scaling with its container to a 6rem maximum, with a 1.875rem minimum on phones. Code retains the native monospace stack; integration recipes use a 1.75 line-height. The homepage does not compile Tailwind. Streamdown's emitted utility names are not style dependencies: scoped `.response-prose` rules target semantic elements and `data-streamdown` hooks. These explicitly style its strong spans, block-level code lines, inline code, lists, headings, rules, and tables. Code and table height caps are disabled so long blocks remain inside the shared comparison scroller; only horizontal overflow is local to those blocks.

**The Platform Font Rule.** Keep the requested system/Inter stacks. Never add Arial. Inter is an explicit product choice, including when generic design heuristics flag common faces.

**The Compact Scale Rule.** Keep interface and reading type at or below 1.625rem while preserving reader scaling. The hero headline, section headings, and the live specimen are the only display sizes. Establish hierarchy within the interface through weight, spacing, and structure.

**The Real Forms Rule.** Assume true small caps are unavailable. Never synthesize small caps, and use the weights and italics actually loaded.

**The Relationship Rule.** Choose size, measure, leading, and paragraph space together, then inspect actual text. Do not overlay a repeating grid on mixed-size prose. The single-line hero specimen is the one place a faint twelve-column grid appears.

**The Live Proof Rule.** Anything the page shows as Typograph's output must be computed by the published package at view time: the hero specimen, the workbench, and the streaming comparison. Timings are measured in the visitor's browser and labelled as such.

## Layout

The current homepage at `/` uses a 1320px maximum frame with `clamp(20px, 4vw, 56px)` side gutters. Each section opens with a full-width ink rule, a heading in the left five of twelve columns, and a lede in the right seven. The finished-text workbench and the streaming comparison share one bordered, rounded frame style with mono pane bars. Fine rules organize the header, hero, controls, and supporting sections. Desktop comparison panes have equal widths; one shared control sets their maximum reading measure from 28–64ch, initially 48ch. The measure scales with the font’s zero glyph; it is not an exact character count. Each pane clamps to available space. At 800px, the same comparison becomes a single visible pane with an Original/With Typograph switch; supporting sections also stack. The hero remains stacked, with its enlarged sample on three lines below the introduction. The proof uses its own inline-size container so its type scales with the available space. The complete route sequence and interaction contract live in LANDING_PAGE_BRIEF.md.

Keep repeated role spacing consistent while allowing each reading context its own rhythm. Preserve native text resizing and reflow. Desktop-only breaks require explicit word spaces for the narrow layout. An absolute center rule belongs to the comparison frame, outside the scrolling alpha mask, and remains visible across both faded edges. It is hidden with the two-column layout on mobile. The comparison scrolls as one region; code retains local horizontal overflow when its literal content cannot wrap.

## Elevation & Depth

**The Flat Surface Rule.** Use tonal surfaces and fine boundaries to group content. The implemented system has no box shadows.

The homepage comparison, source editor, and recipe panel establish grouping through tone and fine rules. Its static punctuation proof shows a pale red fill for smart punctuation, a red diagonal stripe pattern behind the non-breaking space in 30 min, and a gray hanging opening quote, with faint vertical reading guides. The preview and its legend reuse those distinct textures; highlights are absolute decoration and never affect text geometry. The sample reads “The quick brown fox says, ‘I’ll be back in 30 min.’” with no before-state or caption. Preview guides appear only with both Highlight changes and Hanging punctuation enabled; they use ink at 12% opacity in light mode and paper at 14% in dark mode.

## Shapes

The wordmark has no adjacent symbol. Panels are rectangular; buttons and native selects have slight corner relief using the control radius. Rounded switch tracks and circular thumbs describe an on/off mechanism. Preserve that functional exception instead of rounding unrelated panels.

## Components

On the homepage, actions are compact text links or transparent buttons, usually with a 2.75rem minimum height. Icons support explicit labels; integration copy actions include a text label and a 2.75rem target. Native selects use the existing control radius, paper surface, fine border, and a 2.5rem minimum height. All three refinements and Highlight changes start enabled on the homepage; the package keeps spacing opt-in. Three switches above the preview select smart punctuation, non-breaking spaces, and hanging punctuation for the formatted preview and generated integration code/prompts. “Highlight changes” is a separate switch inside the formatted pane and affects only preview highlighting. Reuse the shared button-based Toggle with role="switch", aria-checked, a pill track, and a circular thumb. The user prefers switches over checkbox visuals. Sliders show shared playback progress and reading width. Both use native range inputs over a separate visual track, inspired by the React Bits elastic slider. Tracks grow gently during interaction; dragging past an endpoint stretches only the visual track, capped at 12px, and release returns it to rest. Values stay clamped and keyboard, touch, focus, and disabled behavior remain native. Reduced motion removes the stretch and transitions. No animation dependency is added. Focus is a 2px ink outline with 5px offset; disabled controls use 0.45 opacity. The skip link becomes visible on keyboard focus.

A single substantial example is shared by Text and Conversation, with no example picker. The original pane defaults to unprocessed rendered text and offers a Markdown editor tab. Switching tabs preserves edits and the full source; during replay both rendered panes show the same accumulated prefix. The editor remains capped at 12,000 characters. A Reset example text action appears only after editing. Both comparison columns live inside one native vertical scroll container. There is no JavaScript scroll synchronization and no per-column vertical scrolling. The Markdown textarea grows with a hidden CSS grid sizing mirror, so it shares that same viewport. Mobile keeps the simple Original/With Typograph switch within the existing scroller. Replay follows arriving text until the visitor scrolls back in the shared viewport.

The comparison workspace runs from the refinement switches through the caption at 100dvh, with a 48rem desktop minimum. At 800px and below the workspace uses natural height, 16px base type, stacked refinement switches, full-width view selectors, and touch targets of at least 44px. Its single reading viewport is clamp(24rem, 60svh, 36rem). Its heading sits above the workspace. Only the typography switches and their helper line stay sticky on desktop; on mobile all controls scroll with the page. The Text/AI Conversation buttons and mobile pane selector remain in normal page flow and scroll away. The shared reading viewport flexes to take the remaining height; pane headings, playback controls, and captions stay outside it. The page does not force scroll snapping. The shared comparison viewport and agent-prompt region use 96px alpha-mask fades with a smoothstep opacity curve. Each edge disappears when that boundary is reached or the content fits. Source focus stays on the field; other masked regions have inset focus outlines. Black RGB values in alpha stops encode opacity only, not a displayed palette color.

Every view selector uses the same button-like segmented control: a soft surface with a fine boundary and 0.5rem corners; the active option has a paper fill, fine border, and 0.25rem corners. This applies to Text/Conversation, Text/Markdown, mobile Original/With Typograph, integration stack, and Agent prompt/Code. These remain groups of pressed-state buttons. The integration panel appears directly after the preview and before “Careful where it counts.” Its three switches reuse the preview controls and share the same settings; either set updates the preview, code, and copied prompts immediately. Agent prompt/Code are the primary integration controls. Stack buttons appear beneath them only in Code mode. The single agent prompt asks the agent to identify the existing renderer and choose the appropriate integration. Copy success lives in its button; failure adds a manual-copy alert. The scope limits are always visible at 0.8125rem. The footer keeps the wordmark, signature, and author link; integration documentation remains linked in the integration section. Motion remains limited to smooth anchor scrolling, pointer-operated switch thumbs, and the slider interaction; reduced motion removes these. Streaming starts only after user action. External and resource links open in a new tab with noopener/noreferrer; section navigation stays in the current tab. The phone header retains every navigation link in a separate row.

## Do's and Don'ts

### Do

- Do use the semantic light and dark colors together.
- Do keep headings and labels in sentence case and preserve real acronyms.
- Do connect spacing to the local reading rhythm.
- Do preserve word boundaries when responsive line breaks disappear.
- Do show observable changes and explain font or browser limitations.

### Don’t

- Don’t use pure black, pure white, or decorative colored accents. Reserve the three annotation colors for explaining actual refinements.
- Don’t add mascots or decorative landscape imagery.
- Don’t add tracked uppercase eyebrows or synthetic small caps.
- Don’t treat a valid CSS declaration as proof that a font contains the feature.
- Don’t impose this site’s visual identity on products using the package.
