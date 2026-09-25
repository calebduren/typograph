/**
 * Slides each segmented control's thumb (its ::before) under the pressed button. Positions are
 * written as CSS variables on the control, so React's markup is never touched. Without this
 * script, the pressed button draws its own raised surface instead.
 */
export function startSegmentThumbs(): void {
  const sync = () => {
    for (const control of document.querySelectorAll<HTMLElement>('.segmented-control')) {
      const pressed = control.querySelector<HTMLElement>(':scope > button[aria-pressed="true"]');
      if (!pressed || pressed.offsetParent === null) {
        control.style.setProperty('--thumb-o', '0');
        continue;
      }
      control.style.setProperty('--thumb-x', `${pressed.offsetLeft}px`);
      control.style.setProperty('--thumb-w', `${pressed.offsetWidth}px`);
      control.style.setProperty('--thumb-o', '1');
      if (!control.dataset.thumb) {
        // Place the thumb first, then enable its transition, so it never slides in from 0.
        control.dataset.thumb = 'placed';
        requestAnimationFrame(() => (control.dataset.thumb = 'ready'));
      }
    }
  };

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  };
  const touchesControl = (node: Node) =>
    node instanceof Element &&
    (node.closest('.segmented-control') !== null || node.querySelector('.segmented-control'));

  // Streaming text mutates the page constantly; only react to changes that affect a control.
  new MutationObserver((mutations) => {
    if (
      mutations.some(
        (mutation) =>
          mutation.type === 'attributes' || [...mutation.addedNodes].some(touchesControl),
      )
    ) {
      schedule();
    }
  }).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'hidden'],
  });
  window.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
}
