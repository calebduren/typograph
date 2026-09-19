import { memo, useMemo } from 'react';
import { defaultRemarkPlugins } from 'streamdown';
import typography from '@calebduren/typograph';
import { MessageResponse, type MessageResponseProps } from './components/ai-elements/message';

export const TypographyResponse = memo(function TypographyResponse({
  text,
  locale,
  spacing,
  streaming,
}: {
  text: string;
  locale: string;
  spacing: boolean;
  streaming: boolean;
}) {
  const remarkPlugins = useMemo<MessageResponseProps['remarkPlugins']>(
    () => [...Object.values(defaultRemarkPlugins), [typography, { locale, spacing }]],
    [locale, spacing],
  );

  return (
    <MessageResponse remarkPlugins={remarkPlugins} isAnimating={streaming}>
      {text}
    </MessageResponse>
  );
});
