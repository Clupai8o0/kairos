'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useScheduleWindows, useSetScheduleWindows, type WindowInput, type ScheduleWindow } from '@/lib/hooks/use-schedule-windows';
import { useWindowTemplates, useCreateWindowTemplate, useUpdateWindowTemplate, useDeleteWindowTemplate } from '@/lib/hooks/use-window-templates';
import type { WindowTemplate } from '@/lib/hooks/types';

/* ───────── shared helpers ───────── */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';
const WEEKDAY_DOWS = [1, 2, 3, 4, 5];

type DayState = { enabled: boolean; startTime: string; endTime: string };

function buildDayStates(windows: Array<{ dayOfWeek: number; startTime: string; endTime: string }>): DayState[] {
  return DAYS.map((_, dow) => {
    const match = windows.find((w) => w.dayOfWeek === dow);
    return match
      ? { enabled: true, startTime: match.startTime, endTime: match.endTime }
      : { enabled: false, startTime: DEFAULT_START, endTime: DEFAULT_END };
  });
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        'relative w-9 h-5 rounded-full transition-colors shrink-0',
        checked ? 'bg-brand' : 'bg-surface-3',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

/* ───────── Per-template day editor ───────── */

type TemplateEditorProps = {
  templateId: string;
  templateWindows: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  allWindows: ScheduleWindow[];
  onSaved: () => void;
};

function TemplateEditor({ templateId, templateWindows, allWindows, onSaved }: TemplateEditorProps) {
  const setWindows = useSetScheduleWindows();
  const [days, setDays] = useState<DayState[]>(() => buildDayStates(templateWindows));
  const [dirty, setDirty] = useState(false);
  const [copySource, setCopySource] = useState<number | null>(null);
  const [copyTargets, setCopyTargets] = useState<Set<number>>(new Set());

  function updateDay(dow: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, i) => (i === dow ? { ...d, ...patch } : d)));
    setDirty(true);
  }

  function openCopy(dow: number) {
    setCopySource(dow);
    setCopyTargets(new Set(days.map((d, i) => ({ d, i })).filter(({ d, i }) => d.enabled && i !== dow).map(({ i }) => i)));
  }

  function toggleCopyTarget(dow: number) {
    setCopyTargets((prev) => {
      const n = new Set(prev);
      if (n.has(dow)) n.delete(dow); else n.add(dow);
      return n;
    });
  }

  function applyAndClose() {
    if (copySource === null) return;
    const src = days[copySource];
    setDays((prev) => prev.map((d, i) => copyTargets.has(i) ? { enabled: true, startTime: src.startTime, endTime: src.endTime } : d));
    setDirty(true);
    setCopySource(null);
    setCopyTargets(new Set());
  }

  function handleSave() {
    // Build windows for THIS template
    const thisTemplateWindows: WindowInput[] = days
      .map((d, dow) => ({ enabled: d.enabled, dayOfWeek: dow, startTime: d.startTime, endTime: d.endTime }))
      .filter((d) => d.enabled)
      .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime, templateId }));

    // Keep windows for OTHER templates unchanged
    const otherWindows: WindowInput[] = allWindows
      .filter((w) => w.templateId !== templateId)
      .map((w) => ({ dayOfWeek: w.dayOfWeek, startTime: w.startTime, endTime: w.endTime, templateId: w.templateId! }));

    const p = setWindows.mutateAsync([...otherWindows, ...thisTemplateWindows]);
    toast.promise(p, { loading: 'Saving schedule…', success: 'Schedule saved', error: (e) => e?.message ?? 'Failed' });
    p.then(() => { setDirty(false); onSaved(); }).catch(() => {});
  }

  return (
    <>
      <div className="rounded-lg border border-wire-2 overflow-hidden">
        {DAYS.map((label, dow) => {
          const d = days[dow];
          const isCopyOpen = copySource === dow;
          return (
            <div key={dow} className="border-b border-wire-2 last:border-b-0">
              <div className="flex items-center gap-3 px-4 py-2">
                <Toggle checked={d.enabled} onChange={(v) => { updateDay(dow, { enabled: v }); if (!v && copySource === dow) setCopySource(null); }} />
                <span className={`w-8 text-sm font-[510] shrink-0 ${d.enabled ? 'text-fg-2' : 'text-fg-4'}`}>{label}</span>
                {d.enabled ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <input type="time" value={d.startTime} onChange={(e) => updateDay(dow, { startTime: e.target.value })}
                      className="bg-surface-2 border border-wire rounded px-2 py-1 text-xs text-fg-2 focus:outline-none focus:border-brand" />
                    <span className="text-fg-4 text-xs">–</span>
                    <input type="time" value={d.endTime} onChange={(e) => updateDay(dow, { endTime: e.target.value })}
                      className="bg-surface-2 border border-wire rounded px-2 py-1 text-xs text-fg-2 focus:outline-none focus:border-brand" />
                    <button onClick={() => isCopyOpen ? setCopySource(null) : openCopy(dow)} title="Copy timing to other days"
                      className={['ml-1 p-1 rounded transition-colors', isCopyOpen ? 'text-brand bg-surface-2' : 'text-fg-4 hover:text-fg-2 hover:bg-surface-2'].join(' ')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <span className="ml-auto text-xs text-fg-4">off</span>
                )}
              </div>
              {isCopyOpen && (
                <div className="px-4 pb-3 pt-0 border-t border-wire-2 bg-surface-2">
                  <div className="flex items-center gap-2 flex-wrap pt-2.5">
                    <span className="text-fg-4 text-xs shrink-0">Copy to:</span>
                    {DAYS.map((dl, tdow) => tdow === dow ? null : (
                      <button key={tdow} onClick={() => toggleCopyTarget(tdow)}
                        className={['px-2 py-0.5 rounded text-xs font-[510] border transition-colors', copyTargets.has(tdow) ? 'bg-brand text-white border-brand' : 'text-fg-3 border-wire hover:border-wire-2'].join(' ')}>
                        {dl}
                      </button>
                    ))}
                    <button onClick={() => setCopyTargets(new Set(WEEKDAY_DOWS.filter((d) => d !== dow)))}
                      className="px-2 py-0.5 rounded text-xs font-[510] border border-wire hover:border-wire-2 text-fg-3 transition-colors">Weekdays</button>
                    <button onClick={applyAndClose} disabled={copyTargets.size === 0}
                      className="ml-auto px-3 py-0.5 rounded text-xs font-[510] bg-brand text-white hover:opacity-90 transition-opacity disabled:opacity-40">Apply</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {dirty && (
        <button onClick={handleSave} disabled={setWindows.isPending}
          className="mt-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-[510] hover:opacity-90 transition-opacity disabled:opacity-50">
          Save schedule
        </button>
      )}
    </>
  );
}

/* ───────── Template card (header + inline rename) ───────── */

function TemplateCard({
  template,
  isExpanded,
  onToggle,
  allWindows,
  onSaved,
}: {
  template: WindowTemplate;
  isExpanded: boolean;
  onToggle: () => void;
  allWindows: ScheduleWindow[];
  onSaved: () => void;
}) {
  const updateTemplate = useUpdateWindowTemplate();
  const deleteTemplate = useDeleteWindowTemplate();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(template.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const windowsForTemplate = allWindows.filter((w) => w.templateId === template.id);
  const windowCount = windowsForTemplate.length;

  function handleRename() {
    if (!name.trim() || name.trim() === template.name) { setRenaming(false); return; }
    const p = updateTemplate.mutateAsync({ id: template.id, name: name.trim() });
    toast.promise(p, { loading: 'Renaming…', success: 'Renamed', error: (e) => e?.message ?? 'Failed' });
    p.then(() => setRenaming(false)).catch(() => {});
  }

  function handleDelete() {
    const p = deleteTemplate.mutateAsync(template.id);
    toast.promise(p, { loading: 'Deleting…', success: 'Template deleted', error: (e) => e?.message ?? 'Failed' });
    p.then(() => setConfirmDelete(false)).catch(() => {});
  }

  function handleSetDefault() {
    const p = updateTemplate.mutateAsync({ id: template.id, isDefault: true });
    toast.promise(p, { loading: 'Setting default…', success: 'Default updated', error: (e) => e?.message ?? 'Failed' });
  }

  return (
    <div className="rounded-lg border border-wire-2 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ghost transition-colors text-left"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className={`text-fg-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        {renaming ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setName(template.name); setRenaming(false); } }}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-2 border border-brand rounded px-2 py-0.5 text-sm text-fg font-[510] focus:outline-none"
            autoFocus
          />
        ) : (
          <span className="text-sm font-[510] text-fg-2">{template.name}</span>
        )}
        {template.isDefault && (
          <span className="text-[10px] text-fg-4 bg-surface-3 px-1.5 py-0.5 rounded-full">default</span>
        )}
        <span className="text-[11px] text-fg-4 ml-auto mr-2">
          {windowCount} {windowCount === 1 ? 'day' : 'days'}
        </span>
      </button>

      {/* Actions bar */}
      {isExpanded && (
        <>
          <div className="flex items-center gap-2 px-4 py-2 border-t border-wire-2 bg-ghost">
            <button onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
              className="text-[11px] text-fg-3 hover:text-fg transition-colors">Rename</button>
            {!template.isDefault && (
              <>
                <span className="text-wire-2">·</span>
                <button onClick={(e) => { e.stopPropagation(); handleSetDefault(); }}
                  className="text-[11px] text-fg-3 hover:text-fg transition-colors">Set as default</button>
                <span className="text-wire-2">·</span>
                {confirmDelete ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px] text-danger">Delete?</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                      className="text-[11px] font-[510] text-danger hover:text-danger/80 transition-colors">Yes</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                      className="text-[11px] text-fg-4 hover:text-fg transition-colors">No</button>
                  </span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                    className="text-[11px] text-fg-4 hover:text-danger transition-colors">Delete</button>
                )}
              </>
            )}
          </div>
          <div className="px-4 py-3 border-t border-wire-2">
            <TemplateEditor
              templateId={template.id}
              templateWindows={windowsForTemplate}
              allWindows={allWindows}
              onSaved={onSaved}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ───────── Main section ───────── */

export function ScheduleSection() {
  const { data: savedWindows = [], isLoading } = useScheduleWindows();
  const { data: templates = [], isLoading: templatesLoading } = useWindowTemplates();
  const createTemplate = useCreateWindowTemplate();

  // Auto-create default template if missing
  const defaultTemplate = templates.find((t) => t.isDefault);
  const [ensured, setEnsured] = useState(false);
  if (!templatesLoading && !defaultTemplate && !ensured && !createTemplate.isPending) {
    createTemplate.mutate({ name: 'Default', isDefault: true }, { onSuccess: () => setEnsured(true) });
  }

  const loading = isLoading || templatesLoading || (!defaultTemplate && !ensured);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const toggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  function handleAdd() {
    if (!newName.trim()) return;
    const p = createTemplate.mutateAsync({ name: newName.trim() });
    toast.promise(p, { loading: 'Creating…', success: 'Template created', error: (e) => e?.message ?? 'Failed' });
    p.then(() => { setNewName(''); setAdding(false); }).catch(() => {});
  }

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-fg-3 text-[11px] font-[510] uppercase tracking-wide">Schedule</h2>
          <p className="text-fg-4 text-xs mt-0.5">Window templates define when Kairos can place tasks.</p>
        </div>
        <button onClick={() => setAdding(true)}
          className="text-xs font-[510] text-fg-3 hover:text-fg border border-wire hover:border-wire-2 px-2.5 py-1 rounded transition-colors">
          + Template
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 mb-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Template name"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
            className="flex-1 bg-surface-2 border border-wire rounded px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-brand"
            autoFocus />
          <button onClick={handleAdd} disabled={!newName.trim() || createTemplate.isPending}
            className="px-3 py-1.5 rounded text-xs font-[510] bg-brand text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
            Create
          </button>
          <button onClick={() => { setAdding(false); setNewName(''); }}
            className="text-xs text-fg-4 hover:text-fg transition-colors">Cancel</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-ghost rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isExpanded={expandedId === t.id}
              onToggle={() => toggle(t.id)}
              allWindows={savedWindows}
              onSaved={() => {}}
            />
          ))}
          {templates.length === 0 && (
            <div className="px-4 py-5 rounded-lg bg-ghost border border-wire-2 text-center">
              <p className="text-fg-4 text-sm">No templates yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
