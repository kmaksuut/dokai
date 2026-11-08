<script lang="ts">
  import { onMount } from 'svelte';
  import { openUrl } from '@tauri-apps/plugin-opener';

  let { children } = $props();

  onMount(() => {
    function handleGlobalLinkClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Handle in-page section hash anchors smoothly
      if (href.startsWith('#')) {
        event.preventDefault();
        const elementId = href.substring(1);
        const targetEl = document.getElementById(elementId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      // Ignore javascript voids
      if (href.startsWith('javascript:')) {
        event.preventDefault();
        return;
      }

      // For all external and web links: NEVER navigate inside WebView!
      event.preventDefault();
      event.stopPropagation();

      // Ensure standard external attributes
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');

      // Open in system default web browser (Chrome, Edge, Firefox, etc.)
      openUrl(href).catch(() => {
        window.open(href, '_blank', 'noopener,noreferrer');
      });
    }

    // Capture phase intercepts all clicks before browser default navigation
    window.addEventListener('click', handleGlobalLinkClick, true);

    return () => {
      window.removeEventListener('click', handleGlobalLinkClick, true);
    };
  });
</script>

{@render children()}

