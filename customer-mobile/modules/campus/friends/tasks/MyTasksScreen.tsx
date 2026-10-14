import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { ClipboardList, Send, Handshake, CheckCircle2 } from 'lucide-react-native';
import { FriendsColors, FS, fui } from '../friendsTheme';
import { FriendsSkeleton } from '../shared/FriendsSkeleton';
import { FriendsEmpty, FriendsError } from '../shared/FriendsEmpty';
import { MyTasksTab, Task, fetchMyTasks } from '../api/tasksApi';
import { TaskCard } from './TaskCard';
import { TaskChips, TaskHeader, TaskSoftError } from './TasksUi';
import { taskErrorMessage } from './tasksShared';
import { useTaskPaged } from './useTaskPaged';
import { useTasksNav } from './tasksNav';

const TABS: { key: MyTasksTab; label: string }[] = [
  { key: 'posted', label: 'Posted' },
  { key: 'helping', label: 'Accepted' },
  { key: 'applied', label: 'Applied' },
  { key: 'completed', label: 'Completed' },
];

/** Which tasks belong in a My Tasks tab (so a transition elsewhere moves it out of this list). */
const keepIn = (tab: MyTasksTab) => (t: Task) => {
  if (tab === 'posted') return t.myRole === 'poster' && t.status !== 'completed';
  if (tab === 'helping') return t.myRole === 'helper' && t.status !== 'completed';
  if (tab === 'completed') return t.status === 'completed';
  return t.myRole === 'applicant' || !!t.myApplication;
};

const EMPTY: Record<MyTasksTab, { title: string; subtitle: string }> = {
  posted: { title: 'Nothing posted yet', subtitle: 'Need notes, a printout, a quick explanation or an errand? Ask your campus.' },
  helping: { title: 'Not helping on anything yet', subtitle: "Tasks you've accepted show here with the chat, deadline and next step." },
  applied: { title: 'No applications', subtitle: "Apply to tasks on the board. You'll see here when you're chosen." },
  completed: { title: 'No completed tasks yet', subtitle: 'Finished tasks and your mutual reviews show here.' },
};

/** My Tasks: Posted / Accepted (helping) / Applied / Completed, with state, deadline and next step. */
export const MyTasksScreen: React.FC<{ initialTab?: MyTasksTab }> = ({ initialTab = 'posted' }) => {
  const nav = useTasksNav();
  const [tab, setTab] = useState<MyTasksTab>(initialTab);
  const [counts, setCounts] = useState<Partial<Record<MyTasksTab, number>>>({});

  useEffect(() => setTab(initialTab), [initialTab]);

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const r = await fetchMyTasks(tab, cursor);
      if (!cursor) setCounts(r.counts || {});
      return { items: r.items, nextCursor: r.nextCursor };
    },
    [tab]
  );

  const paged = useTaskPaged(`mine:${tab}`, fetchPage, { onError: nav.onGateError, keep: keepIn(tab) });
  const open = useCallback((t: Task) => nav.push({ name: 'task', id: t.id, task: t }), [nav]);
  const empty = EMPTY[tab];
  const EmptyIcon = tab === 'posted' ? ClipboardList : tab === 'helping' ? Handshake : tab === 'applied' ? Send : CheckCircle2;

  return (
    <View style={fui.screen}>
      <TaskHeader title="My tasks" subtitle="Everything you've posted, applied to or helped with" onBack={nav.back} />
      <TaskChips
        label="My tasks"
        value={tab}
        onChange={setTab}
        options={TABS.map((x) => ({ key: x.key, label: x.label, count: x.key === 'completed' ? undefined : counts[x.key] }))}
      />
      {paged.loading ? (
        <FriendsSkeleton rows={3} />
      ) : paged.error ? (
        <FriendsError message={taskErrorMessage(paged.error, "Couldn't load your tasks.")} onRetry={paged.reload} />
      ) : (
        <FlatList
          data={paged.items}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TaskCard task={item} onPress={open} showPoster={tab !== 'posted'} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Sep}
          onEndReached={paged.loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={paged.refreshing} onRefresh={paged.refresh} tintColor={FriendsColors.accent} colors={[FriendsColors.accent]} progressBackgroundColor={FriendsColors.card} />
          }
          ListHeaderComponent={paged.softError ? <TaskSoftError error={paged.softError} onRetry={paged.refresh} /> : null}
          ListEmptyComponent={
            <FriendsEmpty
              icon={<EmptyIcon size={22} color={FriendsColors.accent} />}
              title={empty.title}
              subtitle={empty.subtitle}
              actionLabel={tab === 'posted' ? 'Ask for help' : undefined}
              onAction={tab === 'posted' ? () => nav.openComposer(null) : undefined}
            />
          }
          ListFooterComponent={paged.loadingMore ? <ActivityIndicator color={FriendsColors.accent} style={{ marginVertical: FS.lg }} /> : null}
        />
      )}
    </View>
  );
};

const Sep = () => <View style={{ height: FS.md }} />;

const styles = StyleSheet.create({
  list: { padding: FS.lg, paddingTop: FS.sm, paddingBottom: 120, flexGrow: 1 },
});
