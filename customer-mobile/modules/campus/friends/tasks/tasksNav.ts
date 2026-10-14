import { createContext, useContext } from 'react';
import type { MyTasksTab, Task, TaskMeta } from '../api/tasksApi';

/** Screens inside Friends > Tasks (an in-tab stack so the sub-tab bar stays visible). */
export type TasksRoute = { name: 'task'; id: string; task?: Task | null } | { name: 'mine'; tab?: MyTasksTab };

export interface TasksNav {
  push: (r: TasksRoute) => void;
  back: () => void;
  /** Open the composer: new task, or edit one of mine (open, nobody selected). */
  openComposer: (edit?: Task | null) => void;
  /** Task chat: the existing campus chat screen with the task's conversation. */
  openChat: (conversationId: string, name: string) => void;
  /** Task history and ratings of a student (no reviewer identities). */
  openReputation: (userId: string, name: string) => void;
  /** Refetch Friends eligibility (guidelines / flag / sanction changed under us). */
  onGateError: (e: any) => void;
  /** Share a fresh task copy with every list and the detail screen. */
  publish: (task: Task) => void;
  onBlocked: (userId: string) => void;
  meta: TaskMeta | null;
  me: string | null;
}

const noop = () => {};
export const TasksNavContext = createContext<TasksNav>({
  push: noop,
  back: noop,
  openComposer: noop,
  openChat: noop,
  openReputation: noop,
  onGateError: noop,
  publish: noop,
  onBlocked: noop,
  meta: null,
  me: null,
});

export const useTasksNav = () => useContext(TasksNavContext);
