/** Task/appointment editor. Conflicts require acknowledgment but never block an intentional plan. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { DateField } from '@/components/planner/date-field';
import {
  Banner,
  Button,
  C,
  Card,
  Chips,
  Field,
  Row,
  Screen,
  Section,
  Txt,
} from '@/components/planner/ui';
import { categories, newEntry, priorities, type Entry } from '@/core/model';
import { addDays, atTime, conflicts, dayKey, MINUTE, moveToDay, unschedule } from '@/core/planner';
import { usePlanner } from '@/store/planner-store';
export default function EditScreen() {
  const { id, duplicate, postpone, quickTitle, quickMinutes, quickDay } = useLocalSearchParams<{
    id?: string;
    duplicate?: string;
    postpone?: string;
    quickTitle?: string;
    quickMinutes?: string;
    quickDay?: string;
  }>();
  const { data, save } = usePlanner();
  const original = data.entries.find((e) => e.id === (duplicate || id));
  const [draft, setDraft] = useState<Entry>(() => {
    if (original && duplicate)
      return {
        ...newEntry(original.estimatedMinutes),
        kind: original.kind,
        title: original.title,
        description: original.description,
        category: original.category,
        priority: original.priority,
      };
    return original
      ? { ...original }
      : {
          ...newEntry(data.settings.defaultDuration, data.settings.defaultPriority),
          title: quickTitle ?? '',
          plannedDate: quickDay || undefined,
        };
  });
  const [estimate, setEstimate] = useState(quickMinutes ?? String(draft.estimatedMinutes)),
    [remaining, setRemaining] = useState(quickMinutes ?? String(draft.remainingMinutes));
  const [error, setError] = useState(''),
    [warnings, setWarnings] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const patch = (p: Partial<Entry>) => {
    setDraft((d) => ({ ...d, ...p }));
    setWarnings([]);
  };
  const start = draft.start
    ? new Date(draft.start)
    : atTime(draft.plannedDate ? new Date(`${draft.plannedDate}T12:00:00`) : new Date(), '09:00');
  const end = draft.end ? new Date(draft.end) : new Date(+start + Number(estimate || 30) * MINUTE);
  const deadline = draft.deadline ? new Date(draft.deadline) : atTime(new Date(), '23:59');
  const setStart = (date: Date) => {
    const length = +end - +start;
    patch({
      start: date.toISOString(),
      end: new Date(+date + length).toISOString(),
      plannedDate: dayKey(date),
    });
  };
  async function submit(force = false) {
    setError('');
    if (!draft.title.trim()) {
      setError('Give this task a title.');
      return;
    }
    if (
      ![Number(estimate), Number(remaining)].every(
        (v) => Number.isInteger(v) && v > 0 && v <= 525600,
      )
    ) {
      setError('Duration must be a positive whole number of minutes.');
      return;
    }
    if (draft.kind === 'appointment' && (!draft.start || !draft.end)) {
      setError('Appointments need a start and end time.');
      return;
    }
    if (draft.start && (!draft.end || Date.parse(draft.end) <= Date.parse(draft.start))) {
      setError('The end must be after the start.');
      return;
    }
    const next = {
      ...draft,
      title: draft.title.trim(),
      estimatedMinutes: Number(estimate),
      remainingMinutes: Number(remaining),
      acknowledgedEnd: original?.end === draft.end ? draft.acknowledgedEnd : undefined,
    };
    const found = conflicts(next, data.entries, data.settings);
    if (found.length && !force) {
      setWarnings(found);
      return;
    }
    setBusy(true);
    try {
      await save(next);
      if (id && router.canGoBack()) router.back();
      else router.replace({ pathname: '/task', params: { id: next.id, saved: '1' } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (id && !original)
    return (
      <Screen title="Task unavailable" back>
        <Banner text="This task was deleted or replaced by an import." />
      </Screen>
    );
  return (
    <Screen
      title={
        postpone
          ? 'Postpone task'
          : duplicate
            ? 'Duplicate task'
            : id
              ? 'Edit task'
              : 'Make a little time'
      }
      subtitle={postpone ? 'Your deadline stays the same.' : 'One thing at a time.'}
      back
    >
      {!id && (
        <Chips
          values={['Task', 'Fixed appointment']}
          value={draft.kind === 'task' ? 'Task' : 'Fixed appointment'}
          onChange={(v) =>
            patch({
              kind: v === 'Task' ? 'task' : 'appointment',
              deadline: undefined,
              start: v === 'Task' ? undefined : start.toISOString(),
              end: v === 'Task' ? undefined : end.toISOString(),
              inProgress: false,
              completedAt: undefined,
            })
          }
        />
      )}
      {postpone && (
        <Card>
          <Button
            secondary
            title="Later today"
            onPress={() => {
              const later = new Date(Date.now() + 60 * MINUTE);
              setDraft(moveToDay(draft, later));
              setStart(later);
            }}
          />
          <Button
            secondary
            title="Tomorrow"
            onPress={() => {
              setDraft(moveToDay(draft, addDays(new Date(), 1)));
              setWarnings([]);
            }}
          />
          <Button
            secondary
            title="Leave unscheduled"
            onPress={() => {
              setDraft(unschedule(draft));
              setWarnings([]);
            }}
          />
          <Txt muted size={12}>
            Choose a new time below, then save. Your original deadline is preserved.
          </Txt>
        </Card>
      )}
      <Card>
        <Field
          label="Title"
          value={draft.title}
          onChangeText={(title) => patch({ title })}
          placeholder="What would you like to get done?"
          maxLength={200}
        />
        <Field
          label="Notes (optional)"
          value={draft.description}
          onChangeText={(description) => patch({ description })}
          multiline
          placeholder="A little context for your future self…"
          maxLength={4000}
        />
        <Txt size={13} bold>
          Category
        </Txt>
        <Chips
          values={categories}
          value={draft.category}
          onChange={(category) => patch({ category })}
        />
        {draft.kind === 'task' && (
          <>
            <Txt size={13} bold>
              Your priority
            </Txt>
            <Chips
              values={priorities}
              value={draft.priority}
              onChange={(priority) => patch({ priority })}
            />
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Original estimate (min)"
                  value={estimate}
                  keyboardType="number-pad"
                  onChangeText={(v) => {
                    setEstimate(v);
                    if (!id) setRemaining(v);
                    setWarnings([]);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Remaining work (min)"
                  value={remaining}
                  keyboardType="number-pad"
                  onChangeText={(v) => {
                    setRemaining(v);
                    setWarnings([]);
                  }}
                />
              </View>
            </Row>
            <Txt muted size={12}>
              Remaining work helps assess risk. It does not resize your planned block.
            </Txt>
          </>
        )}
      </Card>
      <Section title="Make space in your day" />
      <Card>
        {draft.kind === 'task' && (
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt bold>Plan for a day</Txt>
            <Switch
              accessibilityLabel="Plan for a day"
              trackColor={{ true: C.blue }}
              value={!!draft.plannedDate || !!draft.start}
              onValueChange={(v) =>
                v ? patch({ plannedDate: dayKey(new Date()) }) : setDraft(unschedule(draft))
              }
            />
          </Row>
        )}
        {(draft.plannedDate || draft.start || draft.kind === 'appointment') && (
          <>
            <DateField
              label="Planned date"
              mode="date"
              value={start}
              onChange={(d) => (draft.start ? setStart(d) : patch({ plannedDate: dayKey(d) }))}
            />
            {draft.kind === 'task' && (
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt>Assign a time block</Txt>
                <Switch
                  accessibilityLabel="Assign a time block"
                  value={!!draft.start}
                  trackColor={{ true: C.blue }}
                  onValueChange={(v) =>
                    patch(
                      v
                        ? { start: start.toISOString(), end: end.toISOString() }
                        : { start: undefined, end: undefined },
                    )
                  }
                />
              </Row>
            )}
            {(draft.start || draft.kind === 'appointment') && (
              <>
                <DateField label="Start time" mode="time" value={start} onChange={setStart} />
                <DateField
                  label="End date"
                  mode="date"
                  value={end}
                  onChange={(d) => patch({ end: d.toISOString() })}
                />
                <DateField
                  label="End time"
                  mode="time"
                  value={end}
                  onChange={(d) => patch({ end: d.toISOString() })}
                />
              </>
            )}
          </>
        )}
      </Card>
      {draft.kind === 'task' && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt bold>Has a deadline</Txt>
            <Switch
              accessibilityLabel="Has a deadline"
              value={!!draft.deadline}
              trackColor={{ true: C.blue }}
              onValueChange={(v) => patch({ deadline: v ? deadline.toISOString() : undefined })}
            />
          </Row>
          {draft.deadline && (
            <>
              <DateField
                label="Deadline date"
                mode="date"
                value={deadline}
                onChange={(d) => patch({ deadline: d.toISOString() })}
              />
              <DateField
                label="Deadline time"
                mode="time"
                value={deadline}
                onChange={(d) => patch({ deadline: d.toISOString() })}
              />
              <Txt muted size={12}>
                Date-only deadlines default to 11:59 PM. Editing a deadline resets its risk alerts.
              </Txt>
            </>
          )}
        </Card>
      )}
      {error && <Banner warning text={error} />}
      {warnings.length > 0 && (
        <Card style={{ borderColor: '#F2D1A9' }}>
          <Txt bold>Scheduling conflict</Txt>
          {warnings.map((w) => (
            <Txt key={w} size={13}>
              {w}
            </Txt>
          ))}
          <Button secondary title="Save anyway" busy={busy} onPress={() => void submit(true)} />
        </Card>
      )}
      <Button
        title={id ? 'Save changes' : 'Save task'}
        icon="check"
        busy={busy}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
