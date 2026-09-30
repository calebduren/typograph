# Product Marketing Context

**Document version:** v2
**Last updated:** 2026-09-30

Items marked _[confirm]_ are inferred from the repo rather than stated by the owner.

## Product Overview

**One-liner:** Careful English typography for AI-generated text, applied where you render it.
**What it does:** `@calebduren/typograph` is a small, MIT-licensed TypeScript package that turns the straight quotes, apostrophes, and loose spacing in model output into proper typography while the reply is still streaming, without changing the stored message. One engine ships through several entry points: a Remark plugin for streamed chat (Streamdown, AI Elements, generic unified pipelines), `typeset()` for finished Markdown or HTML (web, email, or Markdown output), and `typesetText()` for plain strings such as titles and notifications. Code, math, URLs, link destinations, and raw HTML stay literal.
**Product category:** Markdown/Remark plugin; text-rendering utility for AI chat and AI-generated content. Developers search for "smart quotes streaming markdown," "remark typography plugin," "AI chat typography," "curly quotes LLM output."
**Product type:** Open-source npm package with a marketing/demo site at typograph.dev.
**Business model:** Free, MIT. No paid tier, no telemetry, no hosted service. The goal is adoption and reputation, not revenue. _[confirm]_

## Target Audience

**Target companies:** Teams shipping AI chat interfaces or AI-written artifacts in JavaScript/TypeScript: AI SDK and AI Elements users, Cloudflare Agents users, Next.js/React product teams, and anyone rendering model output with Streamdown or a unified/remark pipeline. Solo builders through mid-size product teams. _[confirm]_
**Decision-makers:** The frontend or design engineer who owns the message renderer. They can adopt it without asking anyone.
**Primary use case:** Make streamed assistant replies read like typeset prose instead of raw ASCII, without touching the model, the transport, or the stored text.
**Jobs to be done:**

- Fix the "straight quotes and dumb apostrophes" look in a chat UI in one afternoon, with no risk to code blocks, links, or math.
- Typeset finished AI output (daily briefs, emails, notifications, HTML templates) with the same rules as the chat surface.
- Keep related words together (`30 min`, `Dr. Smith`, `Fig. 2`) so lines don't break awkwardly, opt-in.
  **Use cases:**
- Assistant text parts in an AI Elements / shadcn chat, streaming token by token.
- Scheduled brief or digest rendered to web HTML or email HTML.
- Plain strings in product UI: notification copy, generated titles, toasts.
- Node scripts and CLIs that post-process Markdown or HTML in one call.

## Personas

Single-persona product: the engineer who evaluates, installs, and configures it is the same person. No separate champion or financial buyer.

| Persona                                     | Cares about                                             | Challenge                                                                                          | Value we promise                                                                                             |
| ------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Frontend / design engineer on an AI product | Polish, correctness, tiny bundle, no new infrastructure | Model output looks unfinished; existing smartypants-style tools break on streaming, code, or links | Typographically correct prose as tokens arrive, with original text preserved and protected content untouched |

## Problems & Pain Points

**Core problem:** LLMs emit straight ASCII punctuation. Rendered in a well-designed product, that reads as cheap and unfinished, and the usual fixes were built for static blog Markdown, not for text that is still arriving.
**Why alternatives fall short:**

- Static smart-quote plugins decide on the whole document at once; on a streaming prefix they flip quotes the wrong way or churn as tokens land.
- Post-processing the model's stored text rewrites the source of truth and breaks original-text copy.
- Prompting the model to use curly quotes is unreliable and burns tokens.
- Hand-rolled regexes eventually mangle code, URLs, inch marks, or escaped punctuation.
  **What it costs them:** Either accept a visibly rough reading surface, or spend engineering time on a fragile in-house pass and its edge cases.
  **Emotional tension:** Designers and design engineers notice this constantly and feel it undercuts the craft of the rest of the product. _[confirm]_

## Competitive Landscape

**Direct:** `remark-smartypants` / `retext-smartypants` — the standard unified plugin. Falls short because it assumes complete text, handles dashes and ellipses the product deliberately leaves alone, and has no streaming phase, no protection guarantees, and no plain-string or email entry.
**Direct:** Typehug — excellent no-break spacing engine (and Typograph's credited dependency for spacing). Falls short as a whole solution because it doesn't do punctuation or streaming integration; Typograph packages it behind one API.
**Secondary:** Renderer built-ins (Streamdown, react-markdown defaults) and CSS (`text-wrap: pretty`, `hanging-punctuation`). Fall short because they don't change the characters, and native hanging punctuation has patchy browser support.
**Indirect:** Prompting the model for typographic output, or doing nothing. Prompting is unreliable and costs tokens; doing nothing is the status quo Typograph exists to replace.

## Differentiation

**Key differentiators:**

- Built for streaming: a `streaming` phase that never commits to a decision the next token could reverse, and a `complete` phase for final-edge refinements.
- Original text is never mutated. Edits are length-preserving substitutions in rendered text nodes; storage and copy stay literal.
- Hard protection guarantees: code, math, URLs, link destinations, raw HTML, and escaped punctuation are untouched, and running it twice is a no-op.
- One engine, several entry points: chat, finished Markdown, HTML, plain strings, scripts.
- Tiny and dependency-light: about 4 KB gzip including Typehug, one runtime dependency, no network, no telemetry, no install scripts.
- English-only on purpose, with a safe apostrophes-only preset when the response language is unknown.
  **How we do it differently:** Operates at the presentation layer inside the existing Remark/Rehype pipeline the app already runs, rather than rewriting the model output or wrapping the renderer.
  **Why that's better:** No new infrastructure, no lifecycle bookkeeping, no risk to stored messages, and the same rules everywhere text appears.
  **Why customers choose us:** It is the only option designed around text that hasn't finished arriving, and it says exactly what it will and won't touch.

## Objections

| Objection                                    | Response                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Isn't this what smartypants does?"          | Smartypants assumes finished text. Typograph has a streaming phase, protects code/links/math by contract, is idempotent, and adds email, HTML, and plain-string entries. |
| "I don't want to alter what the model said." | It doesn't. Rendered nodes get character substitutions; the stored message and original-text copy are unchanged.                                                         |
| "Our users aren't all English."              | Correct, and the package says so. Pass the response locale when known, or use the apostrophes-only preset, which is safe across Latin-script languages.                  |
| "Will it break my code blocks / inch marks?" | Code, math, URLs, and raw HTML are protected. Ambiguous inch marks inside quotes are documented; write a prime character or opt out for literal intent.                  |

**Anti-persona:** Products that need multilingual quotation conventions, dash or ellipsis conversion, or language detection. Anyone wanting a hosted service or a "taste" score.

## Switching Dynamics

**Push:** Rough-looking chat output; an in-house regex pass that keeps breaking; smartypants flickering on streams.
**Pull:** Live before/after on typograph.dev showing the exact changes; drop-in Remark plugin; copyable agent prompts and tested AI Elements / Cloudflare Agents recipes.
**Habit:** "It's just punctuation, nobody complains"; fear of adding anything to the render path.
**Anxiety:** Corrupting model output, breaking copy-paste, surprising behavior on non-English replies, bundle size. Each is answered explicitly in the docs.

## Customer Language

**How they describe the problem:** _[confirm — no verbatim customer quotes collected yet]_

- "The quotes are all straight."
- "It looks like raw markdown."
- "Smart quotes flip while it's streaming."
  **How they describe us:**
- "Curly quotes for AI chat."
- "Smartypants but for streaming."
  **Words to use:** typeset, careful, conservative, house style, presentation layer, preserves the original, protected content, English only, no network, one engine.
  **Words to avoid:** "AI-powered" (it isn't), "beautify," "fixes your writing," "auto-correct," "sanitizer," language-detection claims, unqualified speed or adoption claims, "small caps."
  **Glossary:**
  | Term                    | Meaning                                                                                          |
  | ----------------------- | ------------------------------------------------------------------------------------------------ |
  | Streaming phase         | Default mode; makes only decisions the next token cannot reverse                                 |
  | Complete phase          | Opt-in mode for a finished message; permits final-edge refinements                               |
  | Spacing / no-break      | Optional Typehug-powered non-breaking spaces for units, initials, abbreviations                  |
  | Hanging punctuation     | Optional Rehype helper that hangs opening quotes at the start of English paragraphs and headings |
  | Apostrophes-only preset | Safe configuration when the response language is unknown                                         |
  | Protected content       | Code, math, URLs, link destinations, raw HTML, escaped punctuation: never changed                |

## Brand Voice

**Tone:** Quiet, exact, confident. Minimalist / Bauhaus in visual direction, and the copy matches: short claims backed by a live specimen.
**Style:** Direct and technical. States limits as plainly as capabilities. Sentence case. No ornamental eyebrows, no hype adjectives, no invented numbers.
**Personality:** Precise, honest, restrained, craft-focused, unhurried.
Tagline: "Type with intention." Current hero: "Your AI writes, typograph polishes."

## Proof Points

**Metrics:** About 4 KB gzip including Typehug; one runtime dependency; zero network requests; per-call time measured live in the visitor's browser; Node 22+ and modern browsers; semver-frozen API since 1.0.0 (2026-09-29).
**Customers:** None to cite yet. Do not invent adoption. _[confirm]_
**Testimonials:** None yet.
**Value themes:**

| Theme                         | Proof                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Safe on streams               | Streaming vs complete phases; model-reply tests check length preservation and idempotency at every streaming prefix   |
| Never touches your source     | Length-preserving substitutions in rendered nodes; original Markdown kept for storage and copy                        |
| Protected content by contract | Documented guarantees for code, math, URLs, raw HTML, escapes; versioning policy ties output changes to release notes |
| Drop-in                       | Tested recipes for AI Elements/shadcn, Cloudflare Agents, generic Remark; copyable agent prompts                      |
| Honest scope                  | English only, stated up front; apostrophes-only preset for unknown languages                                          |

## Goals

**Business goal:** Adoption and reputation: become the default typography layer for AI chat and AI-written content in the JS ecosystem, and showcase Caleb's craft. _[confirm]_
**Conversion action:** `npm install @calebduren/typograph` (copy the install command on typograph.dev), then a working integration. Secondary: GitHub star, trying the workbench with their own text.
**Current metrics:** Cloudflare Web Analytics is installed on typograph.dev (the beacon is allowed in the CSP and present in the rendered page). npm downloads and GitHub stars are the other signals. As of 2026-09-30 the site was not yet in the search index and Search Console was not verified; see `docs/seo-audit-2026-09-30.md`.

## Changelog

_Newest first. One line per revision: what changed and why._

- v2 (2026-09-30) — Corrected Goals: the site runs Cloudflare Web Analytics, and index status was recorded from the SEO audit.
- v1 (2026-09-30) — Initial context, auto-drafted from PRODUCT.md, README, package README, landing brief, DESIGN.md, and CHANGELOG. Items marked _[confirm]_ are inferred.
