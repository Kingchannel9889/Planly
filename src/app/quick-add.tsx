import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Card, Chips, Field, Screen, Txt } from '@/components/planner/ui';
import { DateField } from '@/components/planner/date-field';
import { newEntry } from '@/core/model';
import { addDays, dayKey } from '@/core/planner';
import { usePlanner } from '@/store/planner-store';

export default function QuickAddScreen() {
  const { data, save } = usePlanner();
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(String(data.settings.defaultDuration));
  const [when, setWhen] = useState<'Unscheduled' | 'Today' | 'Tomorrow' | 'Choose date'>('Today');
  const [date, setDate] = useState(new Date());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  function draft() {
    if (!title.trim()) throw new Error('Give your task a title.');
    const duration = Number(minutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 525600)
      throw new Error('Enter a positive whole number of minutes.');
    return {
      ...newEntry(duration, data.settings.defaultPriority),
      title: title.trim(),
      plannedDate:
        when === 'Unscheduled'
          ? undefined
          : dayKey(
              when === 'Today' ? new Date() : when === 'Tomorrow' ? addDays(new Date(), 1) : date,
            ),
    };
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const entry = draft();
      await save(entry);
      router.replace({ pathname: '/task', params: { id: entry.id, saved: '1' } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Quick add" subtitle="Capture it now. Plan the details later." back>
      <Card>
        <Field
          label="Task title"
          placeholder="What needs doing?"
          autoFocus
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          editable={!busy}
        />
        <Txt bold size={13}>
          Planned day
        </Txt>
        <Chips
          values={['Unscheduled', 'Today', 'Tomorrow', 'Choose date'] as const}
          value={when}
          onChange={(value) => {
            if (!busy) setWhen(value);
          }}
        />
        {when === 'Choose date' && (
          <DateField label="Planned date" mode="date" value={date} onChange={setDate} />
        )}
        <Field
          label="Estimated duration (minutes)"
          value={minutes}
          onChangeText={setMinutes}
          keyboardType="number-pad"
          editable={!busy}
        />
        <Txt muted size={12}>
          The planned day is optional and does not set a deadline.
        </Txt>
      </Card>
      {error && <Banner warning text={error} />}
      <Button title="Save task" icon="check" busy={busy} onPress={() => void submit()} />
      <Button
        secondary
        title="More options / appointment"
        disabled={busy}
        onPress={() =>
          router.replace({
            pathname: '/edit',
            params: {
              quickTitle: title,
              quickMinutes: minutes,
              quickDay:
                when === 'Unscheduled'
                  ? ''
                  : dayKey(
                      when === 'Today'
                        ? new Date()
                        : when === 'Tomorrow'
                          ? addDays(new Date(), 1)
                          : date,
                    ),
            },
          })
        }
      />
    </Screen>
  );
}
