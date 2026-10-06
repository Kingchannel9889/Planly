/** Explicit tomorrow preparation: moving planning dates never rewrites a deadline. */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TaskCard } from '@/components/planner/task-card';
import {
  Banner,
  Button,
  C,
  Card,
  Empty,
  Icon,
  Row,
  Screen,
  Section,
  Txt,
} from '@/components/planner/ui';
import type { Entry } from '@/core/model';
import {
  addDays,
  atTime,
  conflicts,
  dayKey,
  duration,
  moveToDay,
  onDay,
  risk,
  todayEntries,
  usableMinutes,
} from '@/core/planner';
import { usePlanner } from '@/store/planner-store';
export default function ReviewScreen() {
  const { data, now, save, change } = usePlanner();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [proposed, setProposed] = useState<Entry>(),
    [warnings, setWarnings] = useState<string[]>([]);
  const tomorrow = addDays(now, 1),
    key = dayKey(tomorrow);
  const planned = data.entries
    .filter((e) => onDay(e, tomorrow))
    .sort((a, b) => (a.start ?? 'z').localeCompare(b.start ?? 'z'));
  const incomplete = todayEntries(data.entries, data.settings, now).filter(
    (e) => e.kind === 'task' && !e.completedAt && !planned.some((p) => p.id === e.id),
  );
  const tasks = planned.filter((e) => e.kind === 'task' && !e.completedAt),
    workload = tasks.reduce((sum, e) => sum + e.remainingMinutes, 0);
  const available = usableMinutes(
    atTime(tomorrow, '00:00'),
    atTime(addDays(tomorrow, 1), '00:00'),
    data.entries,
    data.settings,
  );
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function propose(entry: Entry) {
    const moved = moveToDay(entry, tomorrow),
      found = conflicts(moved, data.entries, data.settings);
    if (found.length) {
      setProposed(moved);
      setWarnings(found);
    } else void run(() => save(moved));
  }
  return (
    <Screen
      resetScrollOnFocus
      title="Tomorrow’s plan"
      subtitle={tomorrow.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
    >
      <Card style={{ backgroundColor: '#EAF3FF' }}>
        <Row>
          <Icon name="moon" size={26} />
          <View style={{ flex: 1 }}>
            <Txt size={20} bold>
              A clearer tomorrow.
            </Txt>
            <Txt muted size={13}>
              A few minutes now. A calmer start later.
            </Txt>
          </View>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          {[
            [String(tasks.length), 'Tasks'],
            [duration(workload), 'Workload'],
            [duration(Math.max(0, available - workload)), 'Spare time'],
          ].map(([value, label]) => (
            <View key={label} style={{ alignItems: 'center' }}>
              <Txt size={23} bold color={C.blue}>
                {value}
              </Txt>
              <Txt muted size={11}>
                {label}
              </Txt>
            </View>
          ))}
        </Row>
        <Txt muted size={12}>
          {
            tasks.filter((e) =>
              ['Critical', 'Overdue'].includes(
                risk(e, data.entries, data.settings, atTime(tomorrow, data.settings.wake)).level,
              ),
            ).length
          }{' '}
          critical or overdue at wake time · {duration(available)} available before flexible work
        </Txt>
      </Card>
      {workload > available && (
        <Banner
          warning
          text="Tomorrow’s workload exceeds your available time. Consider changing planned dates; deadlines stay unchanged."
        />
      )}
      <Section title="Already on your day" action="Add task" onPress={() => router.push('/edit')} />
      {planned.length ? (
        planned.map((e) => <TaskCard key={e.id} entry={e} />)
      ) : (
        <Empty
          title="Room for a fresh start."
          body="Nothing is planned for tomorrow yet. Move unfinished work below or add a task."
        />
      )}
      <Section title="Unfinished work to consider" />
      {incomplete.length ? (
        incomplete.map((e) => (
          <View key={e.id} style={{ gap: 8 }}>
            <TaskCard entry={e} />
            <Row>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  title="Move to tomorrow"
                  disabled={busy}
                  onPress={() => propose(e)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  title="Choose time"
                  onPress={() =>
                    router.push({ pathname: '/edit', params: { id: e.id, postpone: '1' } })
                  }
                />
              </View>
            </Row>
          </View>
        ))
      ) : (
        <Card>
          <Txt muted>No unfinished work to carry forward.</Txt>
        </Card>
      )}
      {proposed && (
        <Card>
          <Txt bold>Scheduling conflict</Txt>
          {warnings.map((w) => (
            <Txt key={w}>{w}</Txt>
          ))}
          <Button
            title="Move anyway"
            busy={busy}
            onPress={() =>
              void run(async () => {
                await save(proposed);
                setProposed(undefined);
              })
            }
          />
          <Button secondary title="Keep unchanged" onPress={() => setProposed(undefined)} />
        </Card>
      )}
      <Banner text="Moving a task changes its plan, not its deadline. Leave anything untouched to keep its current plan." />
      {error && <Banner warning text={error} />}
      <Button
        title={
          data.reviewedDate === key ? 'Plan reviewed · Return to Today' : 'Confirm tomorrow’s plan'
        }
        icon="check"
        busy={busy}
        onPress={() =>
          void run(async () => {
            await change((d) => ({ ...d, reviewedDate: key }));
            router.replace('/');
          })
        }
      />
    </Screen>
  );
}
