<script>
  import { onNavigate } from '$app/navigation';
  
  // Svelte 5 layout children prop declaration using Runes
  let { children } = $props();

  // Native SPA Page transitions utilizing SvelteKit's navigation lifecycle 
  // and the browser's Document View Transitions API
  onNavigate((navigation) => {
    if (!document.startViewTransition) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<div class="theme-shell">
  <!-- Dynamic, Hardware-Accelerated background styling -->
  <div class="radial-glow"></div>
  
  <main class="app-shell-container">
    <!-- Render Svelte 5 Route Page content -->
    {@render children()}
  </main>
</div>

<style>
  /* Base Reset & Cyberpunk Cinematic Dark-Theme Configuration */
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #05080e;
    color: #e2e8f0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    user-select: none;
    -webkit-user-select: none;
  }

  /* Global Scrollbar Customization to match UVTT v2 Neon UI accents */
  :global(::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }
  :global(::-webkit-scrollbar-track) {
    background: #090d16;
  }
  :global(::-webkit-scrollbar-thumb) {
    background: #1e293b;
    border-radius: 3px;
  }
  :global(::-webkit-scrollbar-thumb:hover) {
    background: #00f0ff;
    box-shadow: 0 0 8px #00f0ff;
  }

  /* Structural Viewport Constraints for uninterrupted CAD Canvas usage */
  .theme-shell {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #05080e 0%, #0c111d 100%);
  }

  /* Glowing ambient atmospheric vector backing to break up dark spaces */
  .radial-glow {
    position: absolute;
    top: -20%;
    left: -20%;
    width: 140%;
    height: 140%;
    background: radial-gradient(circle at 50% 30%, rgba(0, 240, 255, 0.03) 0%, rgba(5, 8, 14, 0) 60%);
    pointer-events: none;
    z-index: 0;
  }

  .app-shell-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    z-index: 1;
  }

  /* Global styling rules for HUD components, overlay cards & contextual menus */
  :global(.glass-hud) {
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
  }

  :global(.neon-accent-blue) {
    color: #00f0ff;
    text-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
  }

  :global(.neon-accent-green) {
    color: #4caf50;
    text-shadow: 0 0 10px rgba(76, 175, 80, 0.4);
  }

  :global(.neon-accent-orange) {
    color: #ff9800;
    text-shadow: 0 0 10px rgba(255, 152, 0, 0.4);
  }

  /* Modern CSS View Transitions implementation rules */
  :global(::view-transition-old(root)) {
    animation: 150ms cubic-bezier(0.4, 0, 1, 1) both fade-out;
  }
  :global(::view-transition-new(root)) {
    animation: 250ms cubic-bezier(0, 0, 0.2, 1) both fade-in;
  }

  @keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
