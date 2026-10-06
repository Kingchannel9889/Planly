/** Task actions and transparent deadline-risk calculation; no implicit rescheduling. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  Badge,
  Banner,
  Button,
  C,
  Card,
  Field,
  Row,
  Screen,
  Section,
  Txt,
} from '@/components/planner/ui';
import type { Entry } from '@/core/model';
import {
  dateLabel,
  duration,
  MINUTE,
  risk,
  timeLabel,
  unfinished,
  usableMinutes,
} from '@/core/planner';
import { usePlanner } from '@/store/planner-store';
import { PlannerSyncStatus } from '@/components/planner/sync-status';
export default function TaskScreen() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const { data, now, save, remove, change } = usePlanner();
  const entry = data.entries.find((e) => e.id === id);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [working, setWorking] = useState(false),
    [minutes, setMinutes] = useState('');
  const [confirmSwitch, setConfirmSwitch] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [deleted, setDeleted] = useState<Entry>();
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [promptEnd] = useState(() =>
    entry && unfinished(entry, now) && entry.acknowledgedEnd !== entry.end ? entry.end : undefined,
  );
  // Persist acknowledgment when the prompt is actually shown, so leaving it unanswered
  // does not reopen it on the next visit. The Unfinished state remains independent.
  useEffect(() => {
    if (!promptEnd || !entry || entry.acknowledgedEnd === promptEnd) return;
    void change((d) => ({
      ...d,
      entries: d.entries.map((e) =>
        e.id === id && e.end === promptEnd ? { ...e, acknowledgedEnd: promptEnd } : e,
      ),
    })).catch((e) => setError((e as Error).message));
  }, [promptEnd, entry, id, change]);
  async function run(action: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!entry)
    return (
      <Screen title={deleted ? 'Task deleted' : 'Task unavailable'} back>
        {deleted ? (
          <>
            <Banner text="Removed from your planner. You can undo this until you leave this screen." />
            <Button
              title="Undo deletion"
              busy={busy}
              onPress={() =>
                void run(async () => {
                  await change((d) => ({
                    ...d,
                    entries: [
                      ...d.entries.map((e) =>
                        deleted.inProgress ? { ...e, inProgress: false } : e,
                      ),
                      deleted,
                    ],
                  }));
                  setDeleted(undefined);
                })
              }
            />
          </>
        ) : (
          <Banner text="This task may have been deleted or replaced by a backup." />
        )}
        {error && <Banner warning text={error} />}
      </Screen>
    );
  const r = risk(entry, data.entries, data.settings, now),
    isTask = entry.kind === 'task';
  const needsPrompt = unfinished(entry, now) && entry.end === promptEnd && !promptDismissed;
  const current = data.entries.find((e) => e.inProgress && e.id !== entry.id);
  const complete = () =>
    run(() =>
      save({
        ...entry,
        completedAt: now.toISOString(),
        inProgress: false,
        acknowledgedEnd: entry.end,
      }),
    );
  const start = () => run(() => save({ ...entry, inProgress: true, acknowledgedEnd: entry.end }));
  const updateRemaining = () =>
    run(async () => {
      const amount = Number(minutes);
      if (!Number.isInteger(amount) || amount <= 0 || amount > 525600)
        throw new Error('Enter a positive whole number of minutes.');
      await save({ ...entry, remainingMinutes: amount, acknowledgedEnd: entry.end });
      setWorking(false);
      setPromptDismissed(true);
    });
  const clockMinutes = entry.deadline
    ? Math.max(0, (Date.parse(entry.deadline) - +now) / MINUTE)
    : 0;
  const sleepOnly = entry.deadline
    ? usableMinutes(now, new Date(entry.deadline), [], data.settings)
    : 0;
  return (
    <Screen title={isTask ? 'Task details' : 'Appointment'} back>
      {saved === '1' && (
        <Banner text="Created and saved on this device. You can always find this item in the Tasks tab. Today only shows items relevant to today." />
      )}
      <PlannerSyncStatus />
      <Card>
        <Row style={{ flexWrap: 'wrap' }}>
          <Badge
            label={
              entry.completedAt
                ? 'Completed'
                : isTask
                  ? r.level
                  : Date.parse(entry.end!) < +now
                    ? 'Past'
                    : 'Fixed'
            }
          />
          {unfinished(entry, now) && <Badge label="Unfinished" />}
        </Row>
        <Txt size={26} bold>
          {entry.title}
        </Txt>
        {!!entry.description && <Txt muted>{entry.description}</Txt>}
        <Row style={{ flexWrap: 'wrap' }}>
          <Txt size={13} muted>
            {entry.category}
          </Txt>
          {isTask && (
            <Txt size={13} muted>
              · {entry.priority} priority · {duration(entry.remainingMinutes)} remaining
            </Txt>
          )}
        </Row>
        {entry.start && (
          <Txt size={13}>
            Planned: {dateLabel(entry.start)} · {timeLabel(entry.start)} → {dateLabel(entry.end!)} ·{' '}
            {timeLabel(entry.end!)}
          </Txt>
        )}
        {!entry.start && entry.plannedDate && (
          <Txt size={13}>Planned for {entry.plannedDate} · No time assigned</Txt>
        )}
        {entry.deadline && (
          <Txt size={13} color={r.level === 'Overdue' ? C.red : C.navy}>
            Deadline: {dateLabel(entry.deadline)} · {timeLabel(entry.deadline)}
          </Txt>
        )}
      </Card>
      {needsPrompt && (
        <Card style={{ backgroundColor: '#F5F3FF', borderColor: '#DCD6FF' }}>
          <Txt bold size={20}>
            Still working on this?
          </Txt>
          <Txt muted size={13}>
            Your planned end time passed. Your deadline and remaining estimate are unchanged.
          </Txt>
          <Button title="Done" icon="check" busy={busy} onPress={() => void complete()} />
          <Button
            secondary
            title="Still working"
            onPress={() => {
              setWorking(true);
              setMinutes(String(entry.remainingMinutes));
            }}
          />
          <Button
            secondary
            title="Postpone"
            onPress={() =>
              router.push({ pathname: '/edit', params: { id: entry.id, postpone: '1' } })
            }
          />
          <Button
            secondary
            title="Dismiss for this occurrence"
            busy={busy}
            onPress={() => setPromptDismissed(true)}
          />
        </Card>
      )}
      {isTask && entry.deadline && !entry.completedAt && (
        <>
          <Section title="Deadline risk, explained" />
          <Card>
            {[
              ['Time until deadline', duration(clockMinutes)],
              ['Sleep time excluded', duration(clockMinutes - sleepOnly)],
              ['Fixed commitments excluded', duration(sleepOnly - r.usable)],
              ['Usable time across all gaps', duration(r.usable)],
              ['Remaining work', duration(entry.remainingMinutes)],
              ['Safety buffer', '30m'],
            ].map(([label, value]) => (
              <Row key={label} style={{ justifyContent: 'space-between' }}>
                <Txt muted size={13} style={{ flex: 1 }}>
                  {label}
                </Txt>
                <Txt bold size={14}>
                  {value}
                </Txt>
              </Row>
            ))}
            <View style={{ height: 1, backgroundColor: C.line }} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt bold>Attention level</Txt>
              <Badge label={r.level} />
            </Row>
            <Txt muted size={12}>
              Available time is an estimate across separate gaps, not a reserved schedule. Fixed
              commitments and sleep are counted only once where they overlap.
            </Txt>
          </Card>
        </>
      )}
      {isTask && !entry.deadline && !entry.completedAt && (
        <Banner text="No deadline. Attention is based on your selected priority." />
      )}
      {working && (
        <Card>
          <Field
            label="Estimated work remaining (minutes)"
            keyboardType="number-pad"
            value={minutes}
            onChangeText={setMinutes}
          />
          <Button
            title="Update remaining work"
            busy={busy}
            onPress={() => void updateRemaining()}
          />
          <Button secondary title="Cancel" onPress={() => setWorking(false)} />
        </Card>
      )}
      {isTask && !entry.completedAt && (
        <>
          <Button title="Mark as done" icon="check" busy={busy} onPress={() => void complete()} />
          <Button
            secondary
            title={entry.inProgress ? 'Pause current task' : 'Start this task'}
            icon={entry.inProgress ? 'pause' : 'play'}
            busy={busy}
            onPress={() => {
              if (entry.inProgress) void run(() => save({ ...entry, inProgress: false }));
              else if (current) setConfirmSwitch(true);
              else void start();
            }}
          />
          <Button
            secondary
            title="Update remaining work"
            icon="clock"
            onPress={() => {
              setWorking(true);
              setMinutes(String(entry.remainingMinutes));
            }}
          />
          <Button
            secondary
            title="Postpone"
            icon="corner-up-right"
            onPress={() =>
              router.push({ pathname: '/edit', params: { id: entry.id, postpone: '1' } })
            }
          />
        </>
      )}
      {confirmSwitch && (
        <Card>
          <Txt bold>Switch from {current?.title}?</Txt>
          <Txt muted>The current task will pause. Its estimate stays unchanged.</Txt>
          <Button
            title="Switch task"
            busy={busy}
            onPress={() =>
              void run(async () => {
                await save({ ...entry, inProgress: true });
                setConfirmSwitch(false);
              })
            }
          />
          <Button secondary title="Keep current task" onPress={() => setConfirmSwitch(false)} />
        </Card>
      )}
      {entry.completedAt && (
        <Button
          secondary
          title="Reopen task"
          icon="rotate-ccw"
          busy={busy}
          onPress={() =>
            void run(() =>
              save({
                ...entry,
                completedAt: undefined,
                inProgress: false,
                acknowledgedEnd: entry.end,
              }),
            )
          }
        />
      )}
      <Section title="Manage" />
      <Button
        secondary
        title="Edit details"
        icon="edit-2"
        onPress={() => router.push({ pathname: '/edit', params: { id: entry.id } })}
      />
      <Button
        secondary
        title="Duplicate"
        icon="copy"
        onPress={() => router.push({ pathname: '/edit', params: { duplicate: entry.id } })}
      />
      {confirmDelete ? (
        <Card>
          <Txt bold>Delete “{entry.title}”?</Txt>
          <Button
            danger
            title="Delete task"
            busy={busy}
            onPress={() =>
              void run(async () => {
                await remove(entry.id);
                setDeleted(entry);
              })
            }
          />
          <Button secondary title="Keep task" onPress={() => setConfirmDelete(false)} />
        </Card>
      ) : (
        <Button
          secondary
          danger
          title="Delete"
          icon="trash-2"
          onPress={() => setConfirmDelete(true)}
        />
      )}
      {error && <Banner warning text={error} />}
    </Screen>
  );
}
