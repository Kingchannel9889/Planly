/** Shared setup fields; routine times follow device-local time. */
import { View } from 'react-native';
import type { Settings } from '@/core/model';
import { atTime } from '@/core/planner';
import { DateField } from './date-field';
import { Field, Row, Txt } from './ui';
export function SettingsForm({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (settings: Settings) => void;
}) {
  const clock = (key: 'wake' | 'sleep' | 'review', date: Date) =>
    onChange({
      ...value,
      [key]: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    });
  return (
    <>
      <Field
        label="Your name (optional)"
        placeholder="What should we call you?"
        value={value.name}
        maxLength={60}
        onChangeText={(name) => onChange({ ...value, name })}
        autoCapitalize="words"
      />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <DateField
            label="Wake time"
            mode="time"
            value={atTime(new Date(), value.wake)}
            onChange={(d) => clock('wake', d)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateField
            label="Sleep time"
            mode="time"
            value={atTime(new Date(), value.sleep)}
            onChange={(d) => clock('sleep', d)}
          />
        </View>
      </Row>
      <DateField
        label="Evening review"
        mode="time"
        value={atTime(new Date(), value.review)}
        onChange={(d) => clock('review', d)}
      />
      <Txt muted size={12}>
        Your sleep hours are protected when calculating available time.
      </Txt>
    </>
  );
}
