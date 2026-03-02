import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Edit Mode additions (Widget removal, Settings jump)
js = re.sub(
    r'const editBtn = document.getElementById\('edit-layout-btn'\);\s*const doneBtn = document.getElementById\('edit-done-btn'\);',
    '''const editBtn = document.getElementById('edit-layout-btn');
  const doneBtn = document.getElementById('edit-done-btn');
  const editWidgetsBtn = document.getElementById('edit-widgets-btn');''',
    js, flags=re.DOTALL
)

js = re.sub(
    r"doneBtn.addEventListener\('click', \(\) => exitEditMode\(\)\);.*?(?=\s+// ===== DRAG TO MOVE =====)",
    '''doneBtn.addEventListener('click', () => exitEditMode());
  if (editWidgetsBtn) {
    editWidgetsBtn.addEventListener('click', () => {
      document.getElementById('settings-panel').classList.add('open');
      document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-stab="widgets"]').classList.add('active');
      document.querySelectorAll('.stab-pane').forEach(p => p.classList.remove('active'));
      document.getElementById('stab-widgets').classList.add('active');
    });
  }

  // Widget Removal
  document.querySelectorAll('.widget-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const widgetId = btn.dataset.remove;
      const widget = document.getElementById(widgetId);
      if (widget) {
        // Find toggle and uncheck it
        const widgetType = widget.dataset.widget;
        if (widgetType) {
          const toggle = document.getElementById('t-' + widgetType);
          if (toggle) toggle.checked = false;
        }
        widget.style.display = 'none';
        const layout = getLayout();
        delete layout[widgetId];
        saveLayout(layout);
        // Also remove from S to remember
        if (!S.hiddenWidgets) S.hiddenWidgets = [];
        if (!S.hiddenWidgets.includes(widgetId)) {
          S.hiddenWidgets.push(widgetId);
          save();
        }
      }
    });
  });''',
    js, flags=re.DOTALL
)

# 2. Add devto edit overlay dynamically, handle hidden widgets on load
init_js = '''
// Handle hidden widgets on load
if (!S.hiddenWidgets) S.hiddenWidgets = [];
S.hiddenWidgets.forEach(wid => {
  const w = document.getElementById(wid);
  if (w) w.style.display = 'none';
  const wType = w ? w.dataset.widget : null;
  if (wType) {
    const t = document.getElementById('t-' + wType);
    if (t) t.checked = false;
  }
});

// DevTo Edit Overlay
const devtoWidget = document.getElementById('widget-devto');
if (devtoWidget && !devtoWidget.querySelector('.devto-edit-overlay')) {
  const overlay = document.createElement('div');
  overlay.className = 'devto-edit-overlay';
  overlay.innerHTML = '<button class="devto-edit-btn">Edit Feed</button>';
  devtoWidget.appendChild(overlay);
  overlay.querySelector('button').addEventListener('click', () => {
    alert("Devto feed settings coming soon!");
  });
}
'''

js = re.sub(
    r'let S = loadState\(\);',
    'let S = loadState();\n' + init_js,
    js, flags=re.DOTALL
)

# 3. Search Bar Clear functionality
search_js = '''
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
searchInput.addEventListener('input', () => {
  searchClear.style.display = searchInput.value.length > 0 ? 'block' : 'none';
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  searchInput.focus();
});
searchInput.addEventListener('keydown', (e) => {
'''

js = re.sub(
    r"document.getElementById\('search-input'\).addEventListener\('keydown', \(e\) => {",
    search_js,
    js, flags=re.DOTALL
)

# 4. Settings Modal Tab Navigation & Close
settings_modal_js = '''
// ===== SETTINGS MODAL =====
const settingsPanel = document.getElementById('settings-panel');
document.getElementById('settings-btn').addEventListener('click', () => {
  settingsPanel.classList.add('open');
  document.getElementById('s-city').value = S.city || '';
  document.getElementById('s-wall').value = S.wallpaper || '';
  document.getElementById('s-engine').value = S.engine || 'Google';
  document.getElementById('s-lang').value = S.lang || 'en';
  document.getElementById('s-24h').checked = !!S.use24h;
  
  // check toggles
  if (S.hiddenWidgets) {
    ['clock', 'calendar', 'kanban', 'notes', 'devto', 'search'].forEach(w => {
      const toggle = document.getElementById('t-' + w);
      if (toggle) {
        toggle.checked = !S.hiddenWidgets.includes('widget-' + (w==='notes'?'stickies':w)); // rough heuristic 
      }
    });
  }
});

document.querySelectorAll('.settings-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.stab-pane').forEach(p => p.classList.remove('active'));
    const target = 'stab-' + tab.dataset.stab;
    document.getElementById(target).classList.add('active');
  });
});

document.getElementById('settings-close-x').addEventListener('click', () => {
  settingsPanel.classList.remove('open');
});

document.getElementById('settings-save').addEventListener('click', () => {
  S.city = document.getElementById('s-city').value.trim();
  S.wallpaper = document.getElementById('s-wall').value.trim();
  S.engine = document.getElementById('s-engine').value;
  S.lang = document.getElementById('s-lang').value;
  S.use24h = document.getElementById('s-24h').checked;
  
  // Hidden widgets processing
  S.hiddenWidgets = [];
  const map = {
    'clock': 'widget-clock',
    'calendar': 'widget-calendar',
    'kanban': 'widget-kanban',
    'notes': 'widget-notes-header',
    'stickies': 'widget-stickies',
    'devto': 'widget-devto',
    'search': 'search-input'
  };
  ['clock', 'calendar', 'kanban', 'notes', 'devto'].forEach(w => {
    const toggle = document.getElementById('t-' + w);
    if (toggle && !toggle.checked) {
      if (w === 'notes') {
        S.hiddenWidgets.push(map['notes']);
        S.hiddenWidgets.push(map['stickies']);
      } else {
        S.hiddenWidgets.push(map[w]);
      }
    }
  });
  
  save();
  applyWallpaper();
  fetchWeather();
  updateClock();
  
  // Apply hidden widgets now
  document.querySelectorAll('.widget').forEach(w => w.style.display = 'block');
  S.hiddenWidgets.forEach(wid => {
    const w = document.getElementById(wid);
    if(w) w.style.display = 'none';
  });
  
  settingsPanel.classList.remove('open');
});

// Optional: close on outside click if possible
document.addEventListener('click', (e) => {
  // if (!settingsPanel.contains(e.target) && e.target !== document.getElementById('settings-btn') &&
  //    !document.getElementById('settings-btn').contains(e.target) && settingsPanel.classList.contains('open')) {
  //  // don't close automatically with complex tabs and clicking things inside
  // }
});
'''

# We will replace the entire Settings portion
js = re.sub(
    r'// ===== SETTINGS =====.*?// ===== INIT =====',
    settings_modal_js + '\n// ===== INIT =====',
    js, flags=re.DOTALL
)

# 5. Kanban priority classes
kanban_render_js = '''
        const priorClass = t.priority && t.priority !== 'normal' ? ' priority-' + t.priority : '';
        return `<div class="task-card${priorClass}" draggable="true" data-col="${col}" data-idx="${i}">
'''

js = re.sub(
    r'return `<div class="task-card" draggable="true" data-col="\$\{col\}" data-idx="\$\{i\}">',
    kanban_render_js,
    js, flags=re.DOTALL
)

# 6. Sticky Note Color Palette (Adding Palette button & behavior)
notes_js = '''
  container.innerHTML = S.notes.map(n => `
    <div class="sticky-note" data-nid="${n.id}" style="background:${n.color};left:${n.x}px;top:${n.y}px">
      <div class="sticky-actions" style="position: absolute; top:4px; right:6px; display:flex; gap:4px; opacity:0; transition:opacity 0.2s;">
        <button class="sticky-color-btn" data-colorbtn="${n.id}" style="background:none; border:none; cursor:pointer; font-size:12px; opacity:0.6;">🎨</button>
        <button class="sticky-delete" data-del="${n.id}" style="background:none; border:none; cursor:pointer; font-size:12px; opacity:0.6; position:static;">✕</button>
      </div>
      <textarea data-ntext="${n.id}" style="margin-top:10px;">${n.text}</textarea>
    </div>
  `).join('');

  container.querySelectorAll('.sticky-note').forEach(note => {
    note.onmouseenter = () => { note.querySelector('.sticky-actions').style.opacity = '1'; };
    note.onmouseleave = () => { note.querySelector('.sticky-actions').style.opacity = '0'; };
    
    // palette handling
    const colorBtn = note.querySelector('.sticky-color-btn');
    if (colorBtn) {
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nid = parseInt(colorBtn.dataset.colorbtn);
        const n = S.notes.find(n => n.id === nid);
        if (n) {
          const idx = NOTE_COLORS.indexOf(n.color);
          n.color = NOTE_COLORS[(idx + 1) % NOTE_COLORS.length];
          note.style.background = n.color;
          save();
        }
      });
    }
'''

js = re.sub(
    r"container.innerHTML = S.notes.map\(n => `.*?<textarea data-ntext=\"\$\{n.id\}\">\$\{n.text\}</textarea>\s*</div>\s*`\).join\(''\);.*?container.querySelectorAll\('.sticky-note'\).forEach\(note => {",
    notes_js,
    js, flags=re.DOTALL
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("app.js patched")
