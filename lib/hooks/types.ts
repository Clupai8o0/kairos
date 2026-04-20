// Client-safe types mirroring API response shapes. No drizzle imports.

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  durationMins: number | null;
  deadline: string | null;
  scheduledAt: string | null;
  scheduledEnd: string | null;
  gcalEventId: string | null;
  schedulable: boolean;
  timeLocked: boolean;
  bufferMins: number;
  minChunkMins: number | null;
  isSplittable: boolean;
  dependsOn: string[];
  recurrenceRule: Record<string, unknown> | null;
  preferredTemplateId: string | null;
  parentTaskId: string | null;
  recurrenceIndex: number | null;
  createdAt: string;
  updatedAt: string;
  tags: Pick<Tag, 'id' | 'name' | 'color'>[];
}

export interface WindowTemplate {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlackoutBlock {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  recurrenceRule: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface View {
  id: string;
  userId: string;
  name: string;
  filters: Record<string, unknown>;
  sort: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleCalendar {
  id: string;
  userId: string;
  googleAccountId: string;
  calendarId: string;
  name: string;
  color: string | null;
  selected: boolean;
  showAsBusy: boolean;
  isWriteCalendar: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateTask {
  title: string;
  description?: string | null;
  durationMins?: number | null;
  deadline?: string | null;
  priority: number;
  tags: string[];
}

export interface Scratchpad {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  inputType: 'text' | 'url' | 'share' | 'voice' | 'file';
  pluginName: string | null;
  processed: boolean;
  parseResult: {
    pluginName: string;
    tasks: CandidateTask[];
    warnings: string[];
  } | null;
  extractedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  summary: string | null;
  description: string | null;
  start: string;
  end: string;
  calendarId: string;
  calendarColor: string | null;
  calendarName: string;
  isAllDay: boolean;
}

export interface Plugin {
  name: string;
  version: string;
  displayName: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown>;
  rulesets: Record<string, unknown>[];
}
