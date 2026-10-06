/** Search and filter local tasks; FlatList keeps large personal lists responsive. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { TaskCard } from '@/components/planner/task-card';
import {
  Button,
  C,
  Chips,
  Empty,
  Field,
  Icon,
  IconButton,
  Screen,
  Txt,
} from '@/components/planner/ui';
import { SettingsSheet } from '@/components/planner/settings-ui';
import { ranked } from '@/core/planner';
import type { Entry } from '@/core/model';
import {
  taskViews,
  attentionFilters,
  inTaskView,
  matchesAttention,
  matchesPriority,
  priorityFilters,
  type PriorityFilter,
  type TaskView,
  type AttentionFilter,
} from '@/core/task-views';
import { usePlanner } from '@/store/planner-store';
import { PlannerSyncStatus } from '@/components/planner/sync-status';
export default function TasksScreen() {
  const { data, now } = usePlanner();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<TaskView>('All');
  const [filter, setFilter] = useState<AttentionFilter>('Any');
  const [priority, setPriority] = useState<PriorityFilter>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilter, setDraftFilter] = useState<AttentionFilter>('Any');
  const [draftPriority, setDraftPriority] = useState<PriorityFilter>('All');
  const listRef = useRef<FlatList<Entry>>(null);
  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);
  useFocusEffect(scrollToTop);
  // Change the result set without carrying over the previous list's scroll position.
  useEffect(scrollToTop, [view, priority, filter, query, scrollToTop]);
  const activeCount = Number(priority !== 'All') + Number(filter !== 'Any');
  const openFilters = () => {
    setDraftFilter(filter);
    setDraftPriority(priority);
    setShowFilters(true);
  };
  const groups = Object.fromEntries(
    taskViews.map((name) => [
      name,
      data.entries.filter((entry) => inTaskView(entry, name, data.entries, data.settings, now)),
    ]),
  ) as Record<TaskView, typeof data.entries>;
  const entries = ranked(
    groups[view].filter(
      (entry) =>
        `${entry.title} ${entry.description} ${entry.category}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()) &&
        matchesPriority(entry, priority) &&
        matchesAttention(entry, filter, data.entries, data.settings, now),
    ),
    data.entries,
    data.settings,
    now,
  );
  return (
    <Screen
      scroll={false}
      title="Your tasks"
      subtitle="Make room for what matters."
      action={<IconButton icon="plus" label="Add task" onPress={() => router.push('/quick-add')} />}
    >
      <PlannerSyncStatus />
      <Field
        label="Search tasks"
        placeholder="Search by title, notes, or category…"
        value={query}
        onChangeText={setQuery}
      />
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 3 }}
        >
          {taskViews.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: view === name }}
              onPress={() => setView(name)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: view === name ? C.blue : C.line,
                backgroundColor: view === name ? C.blue : '#FFF',
              }}
            >
              <Txt bold size={12} color={view === name ? '#FFF' : C.navy}>
                {name} ({groups[name].length})
              </Txt>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Txt size={12} muted>
            {entries.length} {entries.length === 1 ? 'item' : 'items'}
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More filters, ${activeCount} applied`}
            onPress={openFilters}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: C.pale,
            }}
          >
            <Icon name="sliders" size={16} color={C.blue} />
            <Txt bold size={13} color={C.blue}>
              More filters{activeCount ? ` (${activeCount})` : ''}
            </Txt>
          </Pressable>
        </View>
        {(activeCount > 0 || query !== '') && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {[
              ...(priority !== 'All'
                ? [{ label: `${priority} priority`, clear: () => setPriority('All') }]
                : []),
              ...(filter !== 'Any' ? [{ label: filter, clear: () => setFilter('Any') }] : []),
              ...(query !== '' ? [{ label: `Search: ${query}`, clear: () => setQuery('') }] : []),
            ].map(({ label, clear }) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${label} filter`}
                onPress={clear}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 44,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: C.line,
                  backgroundColor: '#FFF',
                }}
              >
                <Txt size={12} color={C.blue}>
                  {label.length > 28 ? `${label.slice(0, 28)}…` : label}
                </Txt>
                <Icon name="x" size={14} color={C.blue} />
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPriority('All');
                setFilter('Any');
                setQuery('');
              }}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}
            >
              <Txt size={12} bold color={C.blue}>
                Clear all
              </Txt>
            </Pressable>
          </ScrollView>
        )}
      </View>
      <FlatList
        ref={listRef}
        style={{ flex: 1, minHeight: 0 }}
        data={entries}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <TaskCard entry={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ paddingBottom: 15 }}
        ListEmptyComponent={
          <Empty
            title="A little breathing room."
            body={
              query
                ? 'No matching tasks. Try a different search.'
                : `No items in ${view.toLowerCase()}${filter !== 'Any' || priority !== 'All' ? ' matching these filters. Clear the filters to see more items.' : '. Try All to see every saved item.'}`
            }
            onAdd={!data.entries.length ? () => router.push('/quick-add') : undefined}
          />
        }
      />
      {showFilters && (
        <SettingsSheet title="Filter tasks" onClose={() => setShowFilters(false)}>
          <Txt muted size={13}>
            Choose filters, then apply to return to your tasks. Closing keeps your current filters.
          </Txt>
          <Txt bold size={13}>
            Priority
          </Txt>
          <Chips values={priorityFilters} value={draftPriority} onChange={setDraftPriority} />
          <Txt bold size={13}>
            Status / type
          </Txt>
          <Chips values={attentionFilters} value={draftFilter} onChange={setDraftFilter} />
          {draftFilter === 'Appointments' && draftPriority !== 'All' && (
            <Txt muted size={12}>
              Appointments have no priority. Choose All priorities to include them.
            </Txt>
          )}
          <Button
            title="Apply filters"
            onPress={() => {
              setPriority(draftPriority);
              setFilter(draftFilter);
              setShowFilters(false);
            }}
          />
          <Button
            secondary
            title="Reset selections"
            onPress={() => {
              setDraftPriority('All');
              setDraftFilter('Any');
            }}
          />
          <Button secondary title="Cancel" onPress={() => setShowFilters(false)} />
        </SettingsSheet>
      )}
    </Screen>
  );
}
