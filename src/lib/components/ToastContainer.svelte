<script lang="ts">
  import { toastState, dismissToast } from '../stores/toastStore.svelte';
  import { t } from '../i18n/index.svelte';

  function getIcon(type: 'error' | 'success' | 'warning' | 'info'): string {
    switch (type) {
      case 'error':
        return '⚠️';
      case 'success':
        return '✅';
      case 'warning':
        return '⚡';
      default:
        return 'ℹ️';
    }
  }
</script>

{#if toastState.items.length > 0}
  <div class="toast-stack-right" aria-live="polite">
    {#each toastState.items as item (item.id)}
      <div class="toast-card type-{item.type}" role="alert">
        <div class="toast-top">
          <div class="toast-title-row">
            <span class="toast-icon">{getIcon(item.type)}</span>
            <span class="toast-title">{item.title}</span>
          </div>
          <button
            type="button"
            class="toast-close-btn"
            onclick={() => dismissToast(item.id)}
            title={t('common.close', 'Dismiss')}
          >
            ✕
          </button>
        </div>

        <p class="toast-message">{item.message}</p>

        {#if item.durationMs > 0}
          <div class="toast-timer-track">
            <div
              class="toast-timer-bar"
              style="animation-duration: {item.durationMs}ms;"
            ></div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-stack-right {
    position: fixed;
    top: 54px;
    right: 16px;
    z-index: 3000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 380px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    pointer-events: none;
    padding-bottom: 8px;
  }

  .toast-card {
    pointer-events: auto;
    background: var(--bg-surface, #0a0a0a);
    border: 1px solid var(--border-color, #222);
    border-left-width: 4px;
    border-radius: 10px;
    padding: 12px 14px 14px 14px;
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.65);
    position: relative;
    overflow: hidden;
    animation: slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(28px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .toast-card.type-error {
    border-left-color: #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, var(--bg-surface, #0a0a0a) 55%);
  }

  .toast-card.type-success {
    border-left-color: #10b981;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, var(--bg-surface, #0a0a0a) 55%);
  }

  .toast-card.type-warning {
    border-left-color: #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, var(--bg-surface, #0a0a0a) 55%);
  }

  .toast-card.type-info {
    border-left-color: #6366f1;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, var(--bg-surface, #0a0a0a) 55%);
  }

  .toast-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .toast-title-row {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .toast-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .toast-title {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-primary, #ededed);
    line-height: 1.3;
  }

  .toast-close-btn {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary, #888);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .toast-close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--border-color, #222);
    color: var(--text-primary, #fff);
  }

  .toast-message {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary, #aaa);
    word-break: break-word;
    white-space: pre-wrap;
    max-height: 140px;
    overflow-y: auto;
  }

  .toast-timer-track {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }

  .toast-timer-bar {
    height: 100%;
    width: 100%;
    transform-origin: left center;
    animation-name: shrinkCountdown;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }

  .type-error .toast-timer-bar {
    background: #ef4444;
  }

  .type-success .toast-timer-bar {
    background: #10b981;
  }

  .type-warning .toast-timer-bar {
    background: #f59e0b;
  }

  .type-info .toast-timer-bar {
    background: #6366f1;
  }

  @keyframes shrinkCountdown {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }
</style>
