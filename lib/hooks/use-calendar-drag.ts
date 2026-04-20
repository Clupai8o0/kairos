'use client';

import { useState, useCallback, type RefObject, type PointerEvent } from 'react';

// --- Constants ---
export const HOUR_PX = 64;
export const SNAP_MINS = 15;
export const SNAP_PX = HOUR_PX / 4; // 16px
export const MIN_DURATION_MINS = 15;
export const TIME_COL_PX = 52;

const AUTO_SCROLL_ZONE = 40; // px from edge
const AUTO_SCROLL_SPEED = 6; // px per frame
const RESIZE_HANDLE_PX = 8;
const DEFAULT_CREATE_MINS = 30;
const DRAG_THRESHOLD_PX = 4; // minimum movement before a drag is considered real

// --- Types ---
export interface DragState {
  mode: 'move' | 'resize' | 'create';
  sourceId?: string;
  sourceType?: 'task' | 'event';
  dayIndex: number;
  startMins: number;
  endMins: number;
  originalDayIndex?: number;
  originalStartMins?: number;
  originalEndMins?: number;
}

export interface DragResult {
  dayIndex: number;
  startMins: number;
  endMins: number;
}

export interface UseCalendarDragOptions {
  gridRef: RefObject<HTMLDivElement | null>;
  onMoveEnd?: (sourceId: string, sourceType: 'task' | 'event', result: DragResult) => void;
  onResizeEnd?: (sourceId: string, sourceType: 'task' | 'event', result: DragResult) => void;
  onCreateEnd?: (result: DragResult) => void;
}

export interface UseCalendarDragReturn {
  dragState: DragState | null;
  handleBlockPointerDown: (
    e: PointerEvent,
    id: string,
    type: 'task' | 'event',
    dayIndex: number,
    startMins: number,
    endMins: number,
  ) => void;
  handleGridPointerDown: (e: PointerEvent) => void;
}

// --- Helpers ---
function snapMins(mins: number): number {
  return Math.round(mins / SNAP_MINS) * SNAP_MINS;
}

function pxToMins(px: number): number {
  return snapMins((px / HOUR_PX) * 60);
}

function pxToDayIndex(clientX: number, gridRect: DOMRect): number {
  const dayAreaWidth = gridRect.width - TIME_COL_PX;
  const rel = clientX - gridRect.left - TIME_COL_PX;
  const idx = Math.floor((rel / dayAreaWidth) * 7);
  return Math.max(0, Math.min(6, idx));
}

function clampMins(mins: number): number {
  return Math.max(0, Math.min(1440, mins));
}

// --- Hook ---
export function useCalendarDrag(options: UseCalendarDragOptions): UseCalendarDragReturn {
  const { gridRef, onMoveEnd, onResizeEnd, onCreateEnd } = options;
  const [dragState, setDragState] = useState<DragState | null>(null);

  const autoScroll = useCallback((clientY: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    if (clientY - rect.top < AUTO_SCROLL_ZONE) {
      grid.scrollTop -= AUTO_SCROLL_SPEED;
    } else if (rect.bottom - clientY < AUTO_SCROLL_ZONE) {
      grid.scrollTop += AUTO_SCROLL_SPEED;
    }
  }, [gridRef]);

  const getGridY = useCallback((clientY: number): number => {
    const grid = gridRef.current;
    if (!grid) return 0;
    const rect = grid.getBoundingClientRect();
    return clientY - rect.top + grid.scrollTop;
  }, [gridRef]);

  const getGridRect = useCallback((): DOMRect | null => {
    return gridRef.current?.getBoundingClientRect() ?? null;
  }, [gridRef]);

  const handleBlockPointerDown = useCallback((
    e: PointerEvent,
    id: string,
    type: 'task' | 'event',
    dayIndex: number,
    startMins: number,
    endMins: number,
  ) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isResize = e.clientY > rect.bottom - RESIZE_HANDLE_PX;
    const mode = isResize ? 'resize' : 'move';
    const initY = getGridY(e.clientY);
    const duration = endMins - startMins;

    const initClientX = e.clientX;
    const initClientY = e.clientY;
    let hasDragged = false;

    const state: DragState = {
      mode, sourceId: id, sourceType: type,
      dayIndex, startMins, endMins,
      originalDayIndex: dayIndex, originalStartMins: startMins, originalEndMins: endMins,
    };
    setDragState(state);
    target.setPointerCapture(e.pointerId);

    let latestBlock = { dayIndex, startMins, endMins };

    const onMove = (ev: globalThis.PointerEvent) => {
      if (!hasDragged) {
        const dx = ev.clientX - initClientX;
        const dy = ev.clientY - initClientY;
        if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        hasDragged = true;
      }
      autoScroll(ev.clientY);
      const gridRect = getGridRect();
      if (!gridRect) return;
      const curY = getGridY(ev.clientY);

      if (mode === 'move') {
        const deltaMins = pxToMins(curY - initY);
        const newStart = clampMins(snapMins(startMins + deltaMins));
        const newEnd = clampMins(newStart + duration);
        const newDay = pxToDayIndex(ev.clientX, gridRect);
        latestBlock = { dayIndex: newDay, startMins: newStart, endMins: newEnd };
        setDragState(s => s ? { ...s, ...latestBlock } : s);
      } else {
        const newEnd = clampMins(Math.max(pxToMins(curY), startMins + MIN_DURATION_MINS));
        latestBlock = { dayIndex, startMins, endMins: newEnd };
        setDragState(s => s ? { ...s, endMins: newEnd } : s);
      }
    };

    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      setDragState(null);
      if (!hasDragged) return;
      const moved = latestBlock.dayIndex !== dayIndex
        || latestBlock.startMins !== startMins
        || latestBlock.endMins !== endMins;
      if (!moved) return;
      const result: DragResult = latestBlock;
      if (mode === 'move') onMoveEnd?.(id, type, result);
      else onResizeEnd?.(id, type, result);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }, [autoScroll, getGridY, getGridRect, onMoveEnd, onResizeEnd]);

  const handleGridPointerDown = useCallback((e: PointerEvent) => {
    const gridRect = getGridRect();
    if (!gridRect) return;
    const y = getGridY(e.clientY);
    const dayIndex = pxToDayIndex(e.clientX, gridRect);
    const clickMins = clampMins(pxToMins(y));
    const initMins = clickMins;
    const target = e.currentTarget as HTMLElement;

    setDragState({
      mode: 'create', dayIndex,
      startMins: clickMins, endMins: clampMins(clickMins + DEFAULT_CREATE_MINS),
    });
    target.setPointerCapture(e.pointerId);

    let latestCreate = { dayIndex, startMins: clickMins, endMins: clampMins(clickMins + DEFAULT_CREATE_MINS) };

    const onMove = (ev: globalThis.PointerEvent) => {
      autoScroll(ev.clientY);
      const curMins = clampMins(pxToMins(getGridY(ev.clientY)));
      const start = Math.min(initMins, curMins);
      const end = Math.max(initMins, curMins);
      const gridR = getGridRect();
      const day = gridR ? pxToDayIndex(ev.clientX, gridR) : dayIndex;
      latestCreate = { dayIndex: day, startMins: start, endMins: Math.max(end, start + MIN_DURATION_MINS) };
      setDragState(s => s ? { ...s, ...latestCreate } : s);
    };

    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      setDragState(null);
      if (latestCreate.endMins - latestCreate.startMins >= MIN_DURATION_MINS) {
        onCreateEnd?.(latestCreate);
      }
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }, [autoScroll, getGridY, getGridRect, onCreateEnd]);

  return { dragState, handleBlockPointerDown, handleGridPointerDown };
}
