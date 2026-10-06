/** Reusable, accessible entry summary shared by Today, Tasks, and tomorrow's review. */
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { Entry } from '@/core/model';
import { dateLabel, duration, risk, timeLabel, unfinished } from '@/core/planner';
import { usePlanner } from '@/store/planner-store';
import { Badge, C, Icon, Row, styles, Txt } from './ui';
export function TaskCard({ entry }: { entry: Entry }) {
  const { data, now } = usePlanner();
  const level = risk(entry, data.entries, data.settings, now).level;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${entry.title}`}
      onPress={() => router.push({ pathname: '/task', params: { id: entry.id } })}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Row style={{ alignItems: 'flex-start' }}>
        <View
          style={{
            backgroundColor: entry.completedAt ? '#E6F7F2' : C.pale,
            borderRadius: 11,
            padding: 10,
          }}
        >
          <Icon
            name={
              entry.completedAt
                ? 'check'
                : entry.kind === 'appointment'
                  ? 'calendar'
                  : 'check-square'
            }
            size={18}
            color={entry.completedAt ? C.teal : C.blue}
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Txt
            bold
            style={
              entry.completedAt ? { textDecorationLine: 'line-through', color: C.muted } : undefined
            }
          >
            {entry.title}
          </Txt>
          <Txt size={12} muted>
            {entry.category}
            {entry.kind === 'task'
              ? ` · ${duration(entry.remainingMinutes)} remaining`
              : ' · Fixed appointment'}
          </Txt>
        </View>
        <Icon name="chevron-right" size={17} color={C.muted} />
      </Row>
      <Row style={{ flexWrap: 'wrap' }}>
        <Badge
          label={
            entry.completedAt
              ? 'Completed'
              : entry.kind === 'appointment'
                ? Date.parse(entry.end!) < +now
                  ? 'Past'
                  : 'Fixed'
                : level
          }
        />
        {unfinished(entry, now) && <Badge label="Unfinished" />}
        {entry.inProgress && (
          <Txt size={11} color={C.blue} bold>
            IN PROGRESS
          </Txt>
        )}
      </Row>
      {(entry.start || entry.deadline || entry.plannedDate) && (
        <Row style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {entry.start ? (
            <Txt size={12} muted>
              {dateLabel(entry.start)} · {timeLabel(entry.start)} – {timeLabel(entry.end!)}
            </Txt>
          ) : entry.plannedDate ? (
            <Txt size={12} muted>
              Planned {entry.plannedDate}
            </Txt>
          ) : null}
          {entry.deadline && (
            <Txt size={12} color={level === 'Overdue' ? C.red : C.muted}>
              Due {dateLabel(entry.deadline)} · {timeLabel(entry.deadline)}
            </Txt>
          )}
        </Row>
      )}
    </Pressable>
  );
}
