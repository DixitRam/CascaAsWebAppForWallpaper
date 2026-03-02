// Ultra-lightweight background service worker
// Only handles essential extension lifecycle events

const browserInstance = typeof browser === 'undefined' ? chrome : browser;

// Minimal message listener — can be extended if needed
browserInstance.runtime.onMessage.addListener((message, sender) => {
  if (sender.origin && !sender.origin.startsWith("chrome-extension://")) return;
  // No heavy features — pomodoro, site blocker, CORS stripping all removed
});
