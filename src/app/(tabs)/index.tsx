/** Today's attention dashboard and manually planned timeline. */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  Badge,
  Banner,
  Brand,
  Button,
  C,
  Card,
  Empty,
  Icon,
  IconButton,
  Row,
  Screen,
  Section,
  Txt,
} from '@/components/planner/ui';
import { TaskCard } from '@/components/planner/task-card';
import { usePlanner } from '@/store/planner-store';
import { PlannerSyncStatus } from '@/components/planner/sync-status';
import {
  atTime,
  addDays,
  duration,
  ranked,
  risk,
  suggested,
  timeLabel,
  todayEntries,
  unfinished,
} from '@/core/planner';
export default function TodayScreen() {
  const { data, now, notificationError } = usePlanner();
  const today = todayEntries(data.entries, data.settings, now);
  const tasks = today.filter((e) => e.kind === 'task'),
    done = tasks.filter((e) => e.completedAt).length;
  const next = suggested(data.entries, data.settings, now),
    current = data.entries.find((e) => e.inProgress && !e.completedAt);
  const overdue = ranked(
    today.filter(
      (e) =>
        e.kind === 'task' &&
        !e.completedAt &&
        risk(e, data.entries, data.settings, now).level === 'Overdue',
    ),
    data.entries,
    data.settings,
    now,
  );
  const dayStart = +atTime(now, '00:00'),
    dayEnd = +addDays(atTime(now, '00:00'), 1);
  const timeline = today
    .filter((e) => e.start && e.end && Date.parse(e.start) < dayEnd && Date.parse(e.end) > dayStart)
    .sort((a, b) => a.start!.localeCompare(b.start!));
  const attention = ranked(
    today.filter((e) => e.kind === 'task' && !e.completedAt && !overdue.includes(e)),
    data.entries,
    data.settings,
    now,
  );
  const pendingPrompt = data.entries.find((e) => unfinished(e, now) && e.acknowledgedEnd !== e.end);
  const hour = now.getHours(),
    greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <Screen resetScrollOnFocus>
      <Row style={{ justifyContent: 'space-between', marginBottom: 7 }}>
        <Brand />
        <IconButton icon="plus" label="Add task" onPress={() => router.push('/quick-add')} />
      </Row>
      <View style={{ gap: 4 }}>
        <Txt size={27} bold>
          {greeting}
          {data.settings.name ? `, ${data.settings.name}` : ''}.
        </Txt>
        <Txt muted>
          {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </Txt>
      </View>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt bold>Today’s progress</Txt>
          <Txt bold color={C.blue}>
            {done} / {tasks.length}
          </Txt>
        </Row>
        <View style={{ height: 9, borderRadius: 9, backgroundColor: C.pale, overflow: 'hidden' }}>
          <View
            style={{
              height: 9,
              width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
              borderRadius: 9,
              backgroundColor: C.blue,
            }}
          />
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt muted size={12}>
            {done ? 'Small steps. Real progress.' : 'A little clarity goes a long way.'}
          </Txt>
          <Txt muted size={12}>
            {tasks.length - done} remaining
          </Txt>
        </Row>
      </Card>
      {notificationError ? <Banner warning text={notificationError} /> : null}
      <PlannerSyncStatus />
      {!data.settings.notifications && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')}>
          <Card style={{ padding: 13 }}>
            <Row>
              <Icon name="bell" size={18} />
              <Txt muted size={12} style={{ flex: 1 }}>
                Stay a step ahead. Enable reminders in Settings.
              </Txt>
              <Icon name="chevron-right" size={16} />
            </Row>
          </Card>
        </Pressable>
      )}
      {data.entries.length === 0 ? (
        <Empty
          title="Nothing planned yet."
          body="A clear day is a fresh start. Add your first task or appointment to get going."
          onAdd={() => router.push('/quick-add')}
        />
      ) : (
        <>
          {current && (
            <>
              <Section title="Current task" />
              <TaskCard entry={current} />
            </>
          )}
          {next && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/task', params: { id: next.id } })}
            >
              <LinearGradient
                colors={['#148CFF', '#0865EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 22, padding: 22, gap: 13 }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row>
                    <Icon name="zap" color="#FFF" size={17} />
                    <Txt color="#DCECFF" size={12} bold>
                      SUGGESTED NEXT
                    </Txt>
                  </Row>
                  <Icon name="arrow-up-right" color="#FFF" size={21} />
                </Row>
                <Txt size={24} bold color="#FFF">
                  {next.title}
                </Txt>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt color="#E7F2FF" size={13}>
                    {duration(next.remainingMinutes)} remaining
                  </Txt>
                  <Badge label={risk(next, data.entries, data.settings, now).level} />
                </Row>
              </LinearGradient>
            </Pressable>
          )}
          {pendingPrompt && (
            <Card style={{ borderColor: '#CAC7F8', backgroundColor: '#F5F3FF' }}>
              <Row>
                <Icon name="clock" color="#6355B6" />
                <View style={{ flex: 1 }}>
                  <Txt bold>Still working on this?</Txt>
                  <Txt size={13} muted>
                    {pendingPrompt.title}
                  </Txt>
                </View>
              </Row>
              <Button
                secondary
                title="Review unfinished task"
                onPress={() =>
                  router.push({
                    pathname: '/task',
                    params: { id: pendingPrompt.id, unfinished: '1' },
                  })
                }
              />
            </Card>
          )}
          {overdue.length > 0 && (
            <>
              <Section title={`Overdue · ${overdue.length}`} />
              {overdue.map((e) => (
                <TaskCard key={e.id} entry={e} />
              ))}
            </>
          )}
          {attention.length > 0 && (
            <>
              <Section
                title="Needs your attention"
                action="All tasks"
                onPress={() => router.push('/tasks')}
              />
              {attention.slice(0, 4).map((e) => (
                <TaskCard key={e.id} entry={e} />
              ))}
            </>
          )}
          <Section
            title="Today’s timeline"
            action="Add"
            onPress={() => router.push('/quick-add')}
          />
          {timeline.length ? (
            <Card>
              {timeline.map((e, index) => (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/task', params: { id: e.id } })}
                >
                  <Row style={{ alignItems: 'flex-start', paddingVertical: 8 }}>
                    <Txt size={11} muted style={{ width: 66, paddingTop: 2 }}>
                      {timeLabel(e.start!)}
                    </Txt>
                    <View style={{ alignItems: 'center', width: 13 }}>
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          marginTop: 5,
                          backgroundColor: e.completedAt ? C.teal : C.blue,
                        }}
                      />
                      {index < timeline.length - 1 && (
                        <View style={{ width: 2, minHeight: 51, backgroundColor: C.line }} />
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Txt bold>{e.title}</Txt>
                      <Txt size={12} muted>
                        {timeLabel(e.start!)} – {timeLabel(e.end!)} ·{' '}
                        {e.kind === 'appointment' ? 'Fixed' : duration(e.remainingMinutes)}
                      </Txt>
                    </View>
                  </Row>
                </Pressable>
              ))}
            </Card>
          ) : (
            <Card>
              <Txt muted>No time blocks today. Your unscheduled tasks stay in Tasks.</Txt>
            </Card>
          )}
        </>
      )}
      <Txt size={11} muted style={{ textAlign: 'center' }}>
        Your day, at your pace.
      </Txt>
    </Screen>
  );
}
