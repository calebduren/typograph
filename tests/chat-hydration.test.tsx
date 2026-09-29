// @vitest-environment jsdom
import React, { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Streamdown, defaultRemarkPlugins } from 'streamdown';
import { expect, it, vi } from 'vitest';
import remarkTypography from '../packages/chat-typography/src/index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('hydrates server-rendered typography without mismatches', async () => {
  const element = (
    <Streamdown
      mode="static"
      controls={false}
      remarkPlugins={[
        ...Object.values(defaultRemarkPlugins),
        [remarkTypography, { locale: 'en', phase: 'complete', spacing: true }],
      ]}
    >
      {'"Hello," she said. Wait 30 **min** and keep `const x = "hi"`.'}
    </Streamdown>
  );
  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  document.body.appendChild(container);

  const errors: string[] = [];
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, element, { onRecoverableError: (e) => errors.push(String(e)) });
    });
    expect(errors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.textContent).toContain('“Hello,”');
    expect(container.textContent).toContain(' min');
  } finally {
    await act(async () => root?.unmount());
    consoleError.mockRestore();
    container.remove();
  }
});
