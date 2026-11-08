import { showToast } from '../stores/toastStore.svelte';

export type AiTaskKind = 'generate' | 'enhance-section' | 'enhance-doc' | 'audit';
export type AiTaskStatus = 'running' | 'completed' | 'error' | 'cancelled';

export interface AiTaskItem {
  id: string;
  kind: AiTaskKind;
  title: string;
  stepText: string;
  progress: number;
  status: AiTaskStatus;
  error: string | null;
  createdAt: number;
  completedAt?: number;
}

interface AiTaskManagerState {
  tasks: AiTaskItem[];
  isRunning: boolean;
  kind: AiTaskKind | null;
  title: string;
  stepText: string;
  progress: number;
  error: string | null;
}

export const aiTaskState = $state<AiTaskManagerState>({
  tasks: [],
  isRunning: false,
  kind: null,
  title: '',
  stepText: '',
  progress: 0,
  error: null
});

const abortControllers = new Map<string, AbortController>();
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
let smoothTimer: ReturnType<typeof setInterval> | null = null;

function syncLegacySummaryFields() {
  const runningTasks = aiTaskState.tasks.filter((t) => t.status === 'running');
  const latestRunning = runningTasks[0] || null;
  if (latestRunning) {
    aiTaskState.isRunning = true;
    aiTaskState.kind = latestRunning.kind;
    aiTaskState.title = latestRunning.title;
    aiTaskState.stepText = latestRunning.stepText;
    aiTaskState.progress = latestRunning.progress;
    aiTaskState.error = null;
  } else {
    aiTaskState.isRunning = false;
    aiTaskState.kind = null;
    aiTaskState.title = '';
    aiTaskState.stepText = '';
    aiTaskState.progress = 0;
  }
}

function ensureSmoothTicker() {
  if (smoothTimer) return;
  smoothTimer = setInterval(() => {
    const running = aiTaskState.tasks.filter((t) => t.status === 'running');
    if (running.length === 0) {
      if (smoothTimer) {
        clearInterval(smoothTimer);
        smoothTimer = null;
      }
      syncLegacySummaryFields();
      return;
    }

    for (const task of running) {
      const cur = task.progress;
      if (cur < 45) {
        task.progress = Math.min(45, Math.round((cur + 2.2) * 10) / 10);
      } else if (cur < 75) {
        task.progress = Math.min(75, Math.round((cur + 0.9) * 10) / 10);
      } else if (cur < 93) {
        task.progress = Math.min(93, Math.round((cur + 0.3) * 10) / 10);
      }
    }
    syncLegacySummaryFields();
  }, 260);
}

/**
 * Starts a tracked AI task (supports multiple concurrent tasks in the TitleBar Tasks queue).
 * Returns `{ taskId, signal }`.
 */
export function startAiTask(
  kind: AiTaskKind,
  title: string,
  initialStep: string
): { taskId: string; signal: AbortSignal } {
  const taskId = 'aitask-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const controller = new AbortController();
  abortControllers.set(taskId, controller);

  const newTask: AiTaskItem = {
    id: taskId,
    kind,
    title,
    stepText: initialStep,
    progress: 6,
    status: 'running',
    error: null,
    createdAt: Date.now()
  };

  aiTaskState.tasks = [newTask, ...aiTaskState.tasks];
  syncLegacySummaryFields();
  ensureSmoothTicker();

  return { taskId, signal: controller.signal };
}

/**
 * Updates the step description and monotonic progress for a specific task (or latest running task).
 */
export function updateAiTaskProgress(stepText: string, milestonePct?: number, taskId?: string) {
  const target = taskId
    ? aiTaskState.tasks.find((t) => t.id === taskId)
    : aiTaskState.tasks.find((t) => t.status === 'running');

  if (!target || target.status !== 'running') return;

  if (stepText) {
    target.stepText = stepText;
  }
  if (typeof milestonePct === 'number') {
    if (milestonePct >= 100) {
      target.progress = 100;
    } else if (milestonePct > target.progress) {
      target.progress = Math.min(95, milestonePct);
    }
  }
  syncLegacySummaryFields();
}

/**
 * Marks a task as completed, shows a success toast, and automatically removes it from the Tasks list after 15 seconds.
 */
export function completeAiTask(taskId?: string, summaryMessage?: string) {
  const target = taskId
    ? aiTaskState.tasks.find((t) => t.id === taskId)
    : aiTaskState.tasks.find((t) => t.status === 'running');

  if (!target) return;

  abortControllers.delete(target.id);
  target.status = 'completed';
  target.progress = 100;
  target.stepText = summaryMessage || 'Completed ✓';
  target.completedAt = Date.now();
  syncLegacySummaryFields();

  showToast({
    type: 'success',
    title: target.title,
    message: summaryMessage || 'AI task completed successfully.',
    durationMs: 30000
  });

  // Automatically remove the completed task from the TitleBar Tasks queue after 15 seconds
  const timer = setTimeout(() => {
    removeAiTask(target.id);
  }, 15000);
  cleanupTimers.set(target.id, timer);
}

/**
 * Marks a task as failed, shows a 30-second dismissible error toast on the right, and cleans up after 15 seconds.
 */
export function failAiTask(errorMsg: string, taskId?: string) {
  const target = taskId
    ? aiTaskState.tasks.find((t) => t.id === taskId)
    : aiTaskState.tasks.find((t) => t.status === 'running');

  const isUserAbort =
    errorMsg.toLowerCase().includes('cancelled') ||
    errorMsg.toLowerCase().includes('iptal edildi') ||
    errorMsg.toLowerCase().includes('aborted');

  if (target) {
    abortControllers.delete(target.id);
    if (isUserAbort) {
      removeAiTask(target.id);
      syncLegacySummaryFields();
      return;
    }
    target.status = 'error';
    target.error = errorMsg;
    target.stepText = 'Failed';
    target.completedAt = Date.now();

    const timer = setTimeout(() => {
      removeAiTask(target.id);
    }, 15000);
    cleanupTimers.set(target.id, timer);
  }

  aiTaskState.error = errorMsg;
  syncLegacySummaryFields();

  if (!isUserAbort) {
    showToast({
      type: 'error',
      title: target ? `AI Error — ${target.title}` : 'AI Task Error',
      message: errorMsg,
      durationMs: 30000
    });
  }
}

/**
 * Cancels a specific task by ID (or the latest running task if omitted).
 */
export function cancelAiTask(taskId: string) {
  const target = aiTaskState.tasks.find((t) => t.id === taskId);
  const controller = abortControllers.get(taskId);
  if (controller) {
    controller.abort();
    abortControllers.delete(taskId);
  }
  removeAiTask(taskId);
  syncLegacySummaryFields();

  if (target) {
    showToast({
      type: 'warning',
      title: 'Task Cancelled',
      message: `"${target.title}" was cancelled.`,
      durationMs: 30000
    });
  }
}

export function cancelActiveAiTask(taskId?: string) {
  const target = taskId
    ? aiTaskState.tasks.find((t) => t.id === taskId)
    : aiTaskState.tasks.find((t) => t.status === 'running');

  if (target) {
    cancelAiTask(target.id);
  }
}

export function removeAiTask(taskId: string) {
  const timer = cleanupTimers.get(taskId);
  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(taskId);
  }
  abortControllers.delete(taskId);
  aiTaskState.tasks = aiTaskState.tasks.filter((t) => t.id !== taskId);
  syncLegacySummaryFields();
}

export function clearAiTaskError() {
  aiTaskState.error = null;
}
