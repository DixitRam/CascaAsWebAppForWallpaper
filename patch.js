const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Header Left
html = html.replace(
  /<div class="space-label">[\s\S]*?<\/div>\s*<div class="weather-pill">/,
  `<div class="space-label">
          <div class="space-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 12 12"/></svg>
          </div>
          Space 2
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-left:4px;"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div class="weather-pill">`
);

html = html.replace(
  /<\/div>\s*<\/div>\s*<div class="header-right">/,
  `</div>
        <button class="icon-btn edit-weather-btn" id="edit-weather-btn" style="width:28px;height:28px;border-radius:8px;background:var(--accent);color:white;border:none;" title="Edit Weather">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>
      <div class="header-right">`
);

// 2. Edit Mode Banner
html = html.replace(
  /<div class="edit-banner" id="edit-banner">[\s\S]*?<\/div>/,
  `<div class="edit-banner" id="edit-banner">
      <span>✏️ Edit Mode — Drag widgets to reposition, resize from corners</span>
      <div class="edit-banner-actions">
        <button class="btn-primary" id="edit-widgets-btn" style="padding: 6px 14px; border-radius: 6px;">+ Widgets & Settings</button>
        <button class="edit-done-btn" id="edit-done-btn" style="background: rgba(255,255,255,0.15); color: white;">✓ Done</button>
      </div>
    </div>`
);

// 3. Widget Remove Buttons
const widgets = ['widget-calendar', 'widget-notes-header', 'widget-devto', 'widget-clock', 'widget-stickies', 'widget-kanban'];
widgets.forEach(id => {
  html = html.replace(
    new RegExp(\`<div class="widget(.*?)" id="\${id}"(.*?)(<div class="widget-drag-handle"><\\/div>|\\s*<div class="widget-drag-handle"><\\/div>)\`),
    \`<div class="widget$1" id="\${id}"$2$3
        <button class="widget-remove-btn" data-remove="\${id}">✕</button>\`
  );
});

// 4. Search Bar
html = html.replace(
  /<div class="search-icon">[\s\S]*?<\/div>\s*<input type="text" class="search-input" id="search-input"(.*?)>/,
  `<div class="search-icon">
          <span style="font-size:16px;">✨</span>
        </div>
        <input type="text" class="search-input" id="search-input"$1>
        <button class="search-clear" id="search-clear" style="display:none;">✕</button>`
);

// 5. Settings Panel
html = html.replace(
  /<div class="settings-panel" id="settings-panel">[\s\S]*?<\/div>/,
  `<div class="settings-panel" id="settings-panel">
    <div class="settings-sidebar">
      <div class="settings-header">⚙ Settings</div>
      <button class="settings-tab active" data-stab="common">Common Settings</button>
      <button class="settings-tab" data-stab="wallpapers">Wallpapers</button>
      <button class="settings-tab" data-stab="widgets">Widgets</button>
      <button class="settings-tab" data-stab="experimental">Experimental</button>
    </div>
    <div class="settings-content">
      <button class="settings-close-x" id="settings-close-x">✕</button>
      
      <div id="stab-common" class="stab-pane active">
        <h5>Common Settings</h5>
        <div class="settings-row">
          <label>City (for weather)</label>
          <input id="s-city" placeholder="City name">
        </div>
        <div class="settings-row">
          <label>Search Engine</label>
          <select id="s-engine" class="form-select">
            <option value="Google">Google</option>
            <option value="Bing">Bing</option>
            <option value="DuckDuckGo">DuckDuckGo</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Language</label>
          <select id="s-lang" class="form-select">
            <option value="en">English (US)</option>
            <option value="en-gb">English (UK)</option>
          </select>
        </div>
      </div>
      
      <div id="stab-wallpapers" class="stab-pane" style="display:none;">
        <h5>Wallpapers</h5>
        <div class="settings-row">
          <label>Custom wallpaper URL</label>
          <input id="s-wall" placeholder="https://...">
        </div>
      </div>
      
      <div id="stab-widgets" class="stab-pane" style="display:none;">
        <h5>Widgets</h5>
        <div id="widget-toggles" class="widget-toggles-grid">
          <label class="toggle-row"><input type="checkbox" id="t-clock" checked> Digital Clock</label>
          <label class="toggle-row"><input type="checkbox" id="t-calendar" checked> Calendar</label>
          <label class="toggle-row"><input type="checkbox" id="t-kanban" checked> Todo List</label>
          <label class="toggle-row"><input type="checkbox" id="t-notes" checked> Sticky Notes</label>
          <label class="toggle-row"><input type="checkbox" id="t-devto" checked> DevTo Feed</label>
          <label class="toggle-row"><input type="checkbox" id="t-search" checked> Search Bar</label>
        </div>
      </div>
      
      <div id="stab-experimental" class="stab-pane" style="display:none;">
        <h5>Experimental</h5>
        <p style="font-size:12px;color:var(--text-dim);">Advanced features like "Blur effects" and "Widget animations"</p>
      </div>

      <div class="settings-footer">
        <button class="settings-save" id="settings-save">Save changes</button>
      </div>
    </div>
  </div>`
);

fs.writeFileSync('index.html', html);
console.log('Patch complete.');
