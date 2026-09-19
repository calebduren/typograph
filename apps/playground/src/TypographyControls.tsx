import { Toggle } from './Toggle';
import type { TypographySettings } from './integration-settings';

export function TypographyControls({
  settings,
  onSettingsChange,
}: {
  settings: TypographySettings;
  onSettingsChange: (settings: TypographySettings) => void;
}) {
  return (
    <div className="typography-settings-switches">
      <Toggle
        label="Smart punctuation"
        checked={settings.punctuation}
        onChange={(punctuation) => onSettingsChange({ ...settings, punctuation })}
      />
      <Toggle
        label="Non-breaking spaces"
        checked={settings.spacing}
        onChange={(spacing) => onSettingsChange({ ...settings, spacing })}
      />
      <Toggle
        label="Hanging punctuation"
        checked={settings.hanging}
        onChange={(hanging) => onSettingsChange({ ...settings, hanging })}
      />
    </div>
  );
}
