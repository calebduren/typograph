import { useCallback, useEffect, type RefObject } from 'react';

/** Scroll-edge cues without React updates during scrolling or streaming. */
export function useScrollFade(ref: RefObject<HTMLElement | null>, mountKey?: string) {
  const update = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const remaining = Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
    const top = element.clientHeight ? Math.min(96, Math.max(0, element.scrollTop)) : 0;
    const bottom = element.clientHeight ? Math.min(96, remaining) : 0;
    element.style.setProperty('--scroll-fade-top', `${top}px`);
    element.style.setProperty('--scroll-fade-bottom', `${bottom}px`);
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [ref, update, mountKey]);

  // Source edits, new stream chunks, and recipe changes can change scrollHeight
  // without resizing the scroll container (including a native textarea).
  useEffect(update);
}
