import type { Element } from 'hast';

/** Inherited per element: whether its text is English prose and meant for translation. */
export type State = { english: boolean; translate: boolean };

export function inherit(element: Element, state: State): State {
  const { lang, translate } = element.properties ?? {};
  return {
    // An empty lang means unknown, which is not English.
    english: typeof lang === 'string' ? /^en(?:-|$)/i.test(lang.trim()) : state.english,
    translate:
      typeof translate === 'string'
        ? translate.trim().toLowerCase() !== 'no'
        : translate === false
          ? false
          : state.translate,
  };
}
