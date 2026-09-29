import type { Root, Nodes } from 'hast';

const linkSchemes = /^(https?|ircs?|mailto|xmpp)$/i;
const imageSchemes = /^https?$/i;

/** Same test as micromark's `sanitizeUri`, which the CommonMark reference renderer uses. */
function isSafe(value: string, schemes: RegExp): boolean {
  const colon = value.indexOf(':');
  const questionMark = value.indexOf('?');
  const numberSign = value.indexOf('#');
  const slash = value.indexOf('/');
  return (
    colon < 0 ||
    (slash > -1 && colon > slash) ||
    (questionMark > -1 && colon > questionMark) ||
    (numberSign > -1 && colon > numberSign) ||
    schemes.test(value.slice(0, colon))
  );
}

/** Drop link and image URLs with protocols outside the CommonMark allow-list. */
export function dropUnsafeUrls(tree: Root): void {
  const stack: Nodes[] = [tree];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.type === 'element') {
      const { properties } = node;
      if (node.tagName === 'a' && typeof properties.href === 'string') {
        if (!isSafe(properties.href, linkSchemes)) delete properties.href;
      } else if (node.tagName === 'img' && typeof properties.src === 'string') {
        if (!isSafe(properties.src, imageSchemes)) delete properties.src;
      }
    }
    if ('children' in node) for (const child of node.children) stack.push(child);
  }
}

/** Unified plugin form of {@link dropUnsafeUrls}. */
export default function rehypeDropUnsafeUrls() {
  return dropUnsafeUrls;
}
