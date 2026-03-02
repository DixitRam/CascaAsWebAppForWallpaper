// ============================================
//  CASCA LITE — Dashboard Logic
// ============================================

const STORE_KEY = 'casca_lite_v3';
const LAYOUT_KEY = 'casca_widget_layout';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_FULL = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const WK = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const ENGINES = { Google:'https://www.google.com/search?q=', Bing:'https://www.bing.com/search?q=', DuckDuckGo:'https://duckduckgo.com/?q=' };
const LABEL_COLORS = [
  '#ff6b6b','#ffa07a','#ffd93d','#a8e6cf','#88d8b0','#b8c0ff','#c9b1ff','#9d8df1','#f8a5c2','#f3c4fb'
];
const NOTE_COLORS = ['#f5e960','#a8e6cf','#a8d8ea','#ffb7b2','#c9b1ff'];

// ===== STATE & PERSISTENCE =====
let S = {};
let calM, calY;
let LAYOUT_FILE_DATA = { state: {}, layout: {} };

// ===== SILENT STORAGE (LocalStorage + IndexedDB + Cache API) =====
const SilentStorage = {
  cacheName: 'casca-silent-v1',
  dbName: 'CascaDB',
  dbStore: 'DashboardState',
  dataUrl: 'https://casca.internal/state.json',

  _dbPromise: null,
  getDB() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.dbStore)) {
          db.createObjectStore(this.dbStore);
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });
    return this._dbPromise;
  },

  async save(key, data) {
    // 1. LocalStorage
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e){}

    // 2. IndexedDB
    const db = await this.getDB();
    if (db) {
      const tx = db.transaction(this.dbStore, 'readwrite');
      tx.objectStore(this.dbStore).put(data, key);
    }

    // 3. Cache API
    if ('caches' in window) {
      try {
        const cache = await caches.open(this.cacheName);
        const response = new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' }
        });
        await cache.put(this.dataUrl + '?key=' + key, response);
      } catch (e) { console.warn("Cache save failed", e); }
    }
  },

  async load(key) {
    // 1. Try LocalStorage
    const local = localStorage.getItem(key);
    if (local) try { return JSON.parse(local); } catch(e){}

    // 2. Try IndexedDB
    const db = await this.getDB();
    if (db) {
      const val = await new Promise(r => {
        const tx = db.transaction(this.dbStore, 'readonly');
        const req = tx.objectStore(this.dbStore).get(key);
        req.onsuccess = () => r(req.result);
        req.onerror = () => r(null);
      });
      if (val) return val;
    }

    // 3. Try Cache API Fallback
    if ('caches' in window) {
      try {
        const cache = await caches.open(this.cacheName);
        const response = await cache.match(this.dataUrl + '?key=' + key);
        if (response) return await response.json();
      } catch (e) { console.warn("Cache load failed", e); }
    }
    return null;
  }
};

// ===== LAYOUT MANAGER =====
const LayoutManager = (() => {
  const grid = document.getElementById('main-grid');
  const overlay = document.getElementById('drag-overlay');
  const banner = document.getElementById('edit-banner');
  const editBtn = document.getElementById('edit-layout-btn');
  const doneBtn = document.getElementById('edit-done-btn');
  const widgets = Array.from(grid.querySelectorAll('.widget'));

  let editing = false;
  let dragTarget = null, resizeTarget = null;
  let startX, startY, startLeft, startTop, startW, startH;

  function getLayout() {
    const fileLayout = LAYOUT_FILE_DATA.layout || {};
    const local = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
    return { ...fileLayout, ...local };
  }
  async function getLayoutAsync() {
    const fileLayout = LAYOUT_FILE_DATA.layout || {};
    const stored = await SilentStorage.load(LAYOUT_KEY) || {};
    return { ...fileLayout, ...stored };
  }
  function saveLayout(layout) {
    SilentStorage.save(LAYOUT_KEY, layout);
  }

  // Snapshot current bounding rects relative to grid
  function snapshotPositions(force = false) {
    const gridRect = grid.getBoundingClientRect();
    const layout = getLayout();
    
    widgets.forEach(w => {
      const id = w.id;
      const pos = layout[id];
      
      // If force is true OR no valid position data, calculate from DOM
      const isInvalid = !pos || typeof pos.x !== 'number' || (pos.x === 0 && pos.y === 0 && w.id !== 'widget-calendar');

      if (force || isInvalid) {
        const wasHidden = w.style.display === 'none';
        if (wasHidden) {
          w.style.visibility = 'hidden';
          w.style.display = 'block';
        }
        const r = w.getBoundingClientRect();
        layout[id] = {
          x: Math.round(r.left - gridRect.left),
          y: Math.round(r.top - gridRect.top),
          w: Math.round(r.width),
          h: Math.round(r.height)
        };
        if (wasHidden) {
          w.style.display = 'none';
          w.style.visibility = '';
        }
      }
    });
    saveLayout(layout);
    return layout;
  }

  function applyLayout(layout) {
    if (!layout) return;
    widgets.forEach(w => {
      const pos = layout[w.id];
      if (pos && typeof pos.x === 'number') {
        w.style.left = pos.x + 'px';
        w.style.top = pos.y + 'px';
        w.style.width = pos.w + 'px';
        w.style.height = pos.h + 'px';
      }
    });
  }

  function clearInlineStyles() {
    widgets.forEach(w => {
      w.style.left = '';
      w.style.top = '';
      w.style.width = '';
      w.style.height = '';
    });
  }

  function enterEditMode() {
    editing = true;
    const isFirstTime = !grid.classList.contains('has-layout');
    const layout = snapshotPositions(isFirstTime);
    grid.classList.add('has-layout', 'edit-mode');
    applyLayout(layout);
    banner.classList.add('visible');
    editBtn.classList.add('active');
  }

  function exitEditMode() {
    editing = false;
    const layout = getLayout();
    widgets.forEach(w => {
      if (w.style.display !== 'none' && w.style.left) {
        layout[w.id] = {
          x: parseInt(w.style.left) || 0,
          y: parseInt(w.style.top) || 0,
          w: w.offsetWidth,
          h: w.offsetHeight
        };
      }
    });
    saveLayout(layout);

    // Remove edit chrome but KEEP has-layout for absolute positioning
    grid.classList.remove('edit-mode');
    banner.classList.remove('visible');
    editBtn.classList.remove('active');

    // Re-apply full positions (x, y, w, h) — keeps absolute layout
    applyLayout(layout);
  }

  // Toggle
  editBtn.addEventListener('click', () => {
    if (editing) exitEditMode();
    else enterEditMode();
  });
  doneBtn.addEventListener('click', () => exitEditMode());
  
  const editWidgetsBtn = document.getElementById('edit-widgets-btn');
  if (editWidgetsBtn) {
    editWidgetsBtn.addEventListener('click', () => {
      document.getElementById('settings-panel').classList.add('open');
      document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
      const ts = document.querySelector('[data-stab="widgets"]');
      if (ts) ts.classList.add('active');
      document.querySelectorAll('.stab-pane').forEach(p => p.classList.remove('active'));
      const ps = document.getElementById('stab-widgets');
      if (ps) ps.classList.add('active');
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
        // Also remove from S to remember
        if (!S.hiddenWidgets) S.hiddenWidgets = [];
        if (!S.hiddenWidgets.includes(widgetId)) {
          S.hiddenWidgets.push(widgetId);
          save();
        }
      }
    });
  });

  // ===== DRAG TO MOVE =====
  widgets.forEach(w => {
    const handle = w.querySelector('.widget-drag-handle');
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();

      dragTarget = w;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(w.style.left) || 0;
      startTop = parseFloat(w.style.top) || 0;

      w.classList.add('is-dragging');
      overlay.style.display = 'block';
      overlay.classList.add('dragging');
    });
  });

  // ===== RESIZE =====
  document.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();

      const widgetId = handle.dataset.resize;
      resizeTarget = document.getElementById(widgetId);
      if (!resizeTarget) return;

      startX = e.clientX;
      startY = e.clientY;
      startW = resizeTarget.offsetWidth;
      startH = resizeTarget.offsetHeight;

      resizeTarget.classList.add('is-dragging');
      overlay.style.display = 'block';
      overlay.classList.add('resizing');
    });
  });

  // Mouse move — handles both drag and resize
  document.addEventListener('mousemove', (e) => {
    if (dragTarget) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      dragTarget.style.left = (startLeft + dx) + 'px';
      dragTarget.style.top = (startTop + dy) + 'px';
    }
    if (resizeTarget) {
      const newW = Math.max(120, startW + (e.clientX - startX));
      const newH = Math.max(60, startH + (e.clientY - startY));
      resizeTarget.style.width = newW + 'px';
      resizeTarget.style.height = newH + 'px';
    }
  });

  // Mouse up — end drag or resize
  document.addEventListener('mouseup', () => {
    if (dragTarget) {
      dragTarget.classList.remove('is-dragging');
      dragTarget = null;
    }
    if (resizeTarget) {
      resizeTarget.classList.remove('is-dragging');
      resizeTarget = null;
    }
    overlay.style.display = 'none';
    overlay.classList.remove('dragging', 'resizing');
  });

  // On load: if there's a saved layout, apply full positions
  const saved = getLayout();
  if (Object.keys(saved).length > 0) {
    grid.classList.add('has-layout');
    applyLayout(saved);
  }

  return { enterEditMode, exitEditMode, getLayout, applyLayout };
})();

function initPersistence() {
  // 1. Load from savedLayout.json as "Base Defaults" (if exists)
  fetch('savedLayout.json')
    .then(res => res.ok ? res.json() : { state: {}, layout: {} })
    .catch(() => ({ state: {}, layout: {} }))
    .then(async (fileData) => {
      LAYOUT_FILE_DATA = fileData;
      
      // 2. Try Silent Storage (LocalStorage -> Cache API)
      const storedState = await SilentStorage.load(STORE_KEY);
      S = loadState(storedState);
      
      // Apply hidden widgets on load
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

      // Apply layout if exists
      const saved = await LayoutManager.getLayoutAsync();
      if (Object.keys(saved).length > 0) {
        document.getElementById('main-grid').classList.add('has-layout');
        LayoutManager.applyLayout(saved);
      }

      // Final Dashboard Init
      initCal();
      applyWallpaper();
      renderKanban();
      renderNotes();
      fetchDev();
    });
}

function loadState(stored) {
  const defaults = {
    wallpaper: '',
    engine: 'Google',
    tasks: { todo: [], wip: [], done: [] },
    labels: [
      { id: 1, name: 'LABEL 1', color: '#ff6b6b' },
      { id: 2, name: 'LABEL 2', color: '#b8c0ff' },
    ],
    nextLabelId: 3,
    notes: [
      { id: 1, text: 'Type here...', color: '#f5e960', x: 670, y: 350 },
    ],
    nextNoteId: 2,
    hiddenWidgets: []
  };

  const fileState = LAYOUT_FILE_DATA.state || {};
  let baseState = { ...defaults, ...fileState };
  
  if (!stored) return baseState;
  return { ...baseState, ...stored };
}

function save() { 
  SilentStorage.save(STORE_KEY, S); 
}

// Backup helpers (Optional Rescue)
document.getElementById('btn-export-json').addEventListener('click', () => {
  const data = { state: S, layout: LayoutManager.getLayout() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'casca_backup.json';
  a.click();
});

document.getElementById('btn-paste-clipboard').addEventListener('click', () => {
  const val = prompt("Paste backup JSON here:");
  if (val) {
    try {
      const data = JSON.parse(val);
      if (data.state) S = { ...S, ...data.state };
      if (data.layout) SilentStorage.save(LAYOUT_KEY, data.layout);
      save();
      window.location.reload();
    } catch (e) { alert("Invalid backup format"); }
  }
});

// Debug Console Helper (F12 Keyboard Event Trigger)
const debugBtn = document.getElementById('btn-debug-console');
if (debugBtn) {
  debugBtn.addEventListener('click', () => {
    // Dispatch F12 keyboard event to attempt opening the console
    const f12Event = new KeyboardEvent('keydown', {
      key: 'F12',
      keyCode: 123,
      which: 123,
      code: 'F12',
      location: 0,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      repeat: false,
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(f12Event);
    
    // Provide visual feedback
    const originalText = debugBtn.textContent;
    debugBtn.textContent = "F12 Triggered!";
    setTimeout(() => { debugBtn.textContent = originalText; }, 2000);
    
    // Close settings
    settingsPanel.classList.remove('open');
  });
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  document.getElementById('clock-time').innerHTML =
    `${h}:${m}<span class="clock-ampm">${ampm}</span>`;
}
updateClock();
setInterval(updateClock, 1000);

// ===== CALENDAR =====
function initCal() {
  const now = new Date();
  calM = now.getMonth();
  calY = now.getFullYear();
  renderCal();
}

function renderCal() {
  const now = new Date();
  const todayD = now.getDate(), todayM = now.getMonth(), todayY = now.getFullYear();
  document.getElementById('cal-month-text').textContent = `${MONTHS[calM]} ${calY}`;
  const smallHeader = document.getElementById('cal-small-header');
  if (smallHeader) smallHeader.textContent = MONTHS[calM].toUpperCase();
  const dayName = calM === todayM && calY === todayY ? DAYS_FULL[now.getDay()] : '';
  document.getElementById('cal-day-name').textContent = dayName;
  document.getElementById('cal-day-big').textContent =
    calM === todayM && calY === todayY ? todayD : '';

  const first = new Date(calY, calM, 1);
  let startDay = first.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const prevDays = new Date(calY, calM, 0).getDate();

  const grid = document.getElementById('cal-grid');
  let html = WK.map((d, i) =>
    `<div class="cal-wk${i >= 5 ? ' we' : ''}">${d}</div>`
  ).join('');

  for (let i = 0; i < startDay; i++) {
    html += `<div class="cal-d om">${prevDays - startDay + 1 + i}</div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (startDay + d - 1) % 7;
    const isWe = dow >= 5;
    const isToday = d === todayD && calM === todayM && calY === todayY;
    html += `<div class="cal-d${isToday ? ' today' : ''}${isWe ? ' we' : ''}">${d}</div>`;
  }
  const totalCells = startDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-d om">${i}</div>`;
  }
  grid.innerHTML = html;
}

document.getElementById('cal-prev').addEventListener('click', () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); });
document.getElementById('cal-next').addEventListener('click', () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); });


// ===== KANBAN =====
function renderKanban() {
  ['todo', 'wip', 'done'].forEach(col => {
    const elId = col === 'todo' ? 'k-todo' : col === 'wip' ? 'k-wip' : 'k-done';
    const container = document.getElementById(elId);
    const tasks = S.tasks[col];

    if (tasks.length === 0) {
      container.innerHTML = '<div class="kanban-empty">No tasks</div>';
    } else {
      container.innerHTML = tasks.map((t, i) => {
        const labelsHtml = (t.labels || []).map(lId => {
          const l = S.labels.find(lb => lb.id === lId);
          if (!l) return '';
          return `<span class="task-label" style="background:${l.color};color:#fff">${l.name}</span>`;
        }).join('');
        const priorClass = t.priority && t.priority !== 'normal' ? ' priority-' + t.priority : '';
        return `<div class="task-card${priorClass}" draggable="true" data-col="${col}" data-idx="${i}">
          <div class="task-top">${labelsHtml}<span class="task-drag">⋮⋮</span></div>
          <div class="task-title">${t.title}</div>
        </div>`;
      }).join('');
    }

    // Drag and drop between columns
    container.addEventListener('dragover', (e) => { e.preventDefault(); container.classList.add('drag-over'); });
    container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      const fromCol = e.dataTransfer.getData('col');
      const fromIdx = parseInt(e.dataTransfer.getData('idx'));
      if (fromCol && !isNaN(fromIdx)) {
        const task = S.tasks[fromCol].splice(fromIdx, 1)[0];
        if (task) { S.tasks[col].push(task); save(); renderKanban(); }
      }
    });
  });

  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('col', card.dataset.col);
      e.dataTransfer.setData('idx', card.dataset.idx);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
}

// Create Task Modal
const taskModal = document.getElementById('task-modal');
let selectedLabels = [];

document.getElementById('kanban-add').addEventListener('click', () => {
  selectedLabels = [];
  document.getElementById('task-title-input').value = '';
  document.getElementById('task-url-input').value = '';
  document.getElementById('task-desc-input').value = '';
  document.getElementById('task-priority').value = 'normal';
  renderTaskLabels();
  taskModal.classList.add('open');
});

function renderTaskLabels() {
  const container = document.getElementById('task-label-chips');
  container.innerHTML = S.labels.map(l => {
    const sel = selectedLabels.includes(l.id) ? ' selected' : '';
    return `<span class="label-chip${sel}" data-lid="${l.id}" style="background:${l.color};color:#fff">${l.name}</span>`;
  }).join('');
  container.querySelectorAll('.label-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const lid = parseInt(chip.dataset.lid);
      if (selectedLabels.includes(lid)) {
        selectedLabels = selectedLabels.filter(id => id !== lid);
      } else {
        selectedLabels.push(lid);
      }
      renderTaskLabels();
    });
  });
}

document.getElementById('task-modal-close').addEventListener('click', () => taskModal.classList.remove('open'));
document.getElementById('task-create-btn').addEventListener('click', () => {
  const title = document.getElementById('task-title-input').value.trim();
  if (!title) return;
  S.tasks.todo.push({
    title,
    labels: [...selectedLabels],
    url: document.getElementById('task-url-input').value.trim(),
    desc: document.getElementById('task-desc-input').value.trim(),
    priority: document.getElementById('task-priority').value,
  });
  save(); renderKanban();
  taskModal.classList.remove('open');
});

// Clear done
document.getElementById('kanban-clear').addEventListener('click', () => {
  S.tasks.done = []; save(); renderKanban();
});

// Label modal
const labelModal = document.getElementById('label-modal');
let selLabelColor = LABEL_COLORS[0];

document.getElementById('open-label-modal').addEventListener('click', () => {
  document.getElementById('label-name-input').value = '';
  selLabelColor = LABEL_COLORS[0];
  renderLabelColors();
  labelModal.classList.add('open');
});

function renderLabelColors() {
  const container = document.getElementById('label-color-circles');
  container.innerHTML = LABEL_COLORS.map(c => {
    const sel = c === selLabelColor ? ' selected' : '';
    return `<div class="color-circle${sel}" data-color="${c}" style="background:${c}"></div>`;
  }).join('');
  container.querySelectorAll('.color-circle').forEach(circle => {
    circle.addEventListener('click', () => {
      selLabelColor = circle.dataset.color;
      renderLabelColors();
    });
  });
}

document.getElementById('label-modal-close').addEventListener('click', () => labelModal.classList.remove('open'));
document.getElementById('label-create-btn').addEventListener('click', () => {
  const name = document.getElementById('label-name-input').value.trim();
  if (!name) return;
  S.labels.push({ id: S.nextLabelId++, name, color: selLabelColor });
  save(); renderTaskLabels();
  labelModal.classList.remove('open');
});

// ===== STICKY NOTES =====
let notesVisible = true;
function renderNotes() {
  // Remove existing loose notes first
  document.querySelectorAll('.sticky-note-loose').forEach(n => n.remove());
  if (!notesVisible) return;
  
  const container = document.getElementById('main-grid');
  
  S.notes.forEach(n => {
    const noteEl = document.createElement('div');
    noteEl.className = 'sticky-note sticky-note-loose';
    noteEl.dataset.nid = n.id;
    noteEl.style.background = n.color;
    noteEl.style.position = 'fixed'; // Float over everything safely
    noteEl.style.left = n.x + 'px';
    noteEl.style.top = n.y + 'px';
    noteEl.style.zIndex = 40;
    
    noteEl.innerHTML = `
      <div class="sticky-actions" style="position: absolute; top:4px; right:6px; display:flex; gap:4px; opacity:0; transition:opacity 0.2s;">
        <button class="sticky-color-btn" data-colorbtn="${n.id}" style="background:none; border:none; cursor:pointer; font-size:12px; opacity:0.6;">🎨</button>
        <button class="sticky-delete" data-del="${n.id}" style="background:none; border:none; cursor:pointer; font-size:12px; opacity:0.6; position:static;">✕</button>
      </div>
      <textarea data-ntext="${n.id}" style="margin-top:10px;">${n.text}</textarea>
    `;
    container.appendChild(noteEl);

    noteEl.onmouseenter = () => { noteEl.querySelector('.sticky-actions').style.opacity = '1'; };
    noteEl.onmouseleave = () => { noteEl.querySelector('.sticky-actions').style.opacity = '0'; };
    
    // palette
    const colorBtn = noteEl.querySelector('.sticky-color-btn');
    if (colorBtn) {
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nid = parseInt(colorBtn.dataset.colorbtn);
        const n = S.notes.find(nn => nn.id === nid);
        if (n) {
          const idx = NOTE_COLORS.indexOf(n.color);
          n.color = NOTE_COLORS[(idx + 1) % NOTE_COLORS.length];
          noteEl.style.background = n.color;
          save();
        }
      });
    }

    let isDragging = false, sx, sy, nx, ny;
    let clickTarget = null;
    noteEl.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
      isDragging = true;
      clickTarget = e.target;
      sx = e.clientX; sy = e.clientY;
      nx = parseFloat(noteEl.style.left);
      ny = parseFloat(noteEl.style.top);
      noteEl.style.zIndex = 50;
      noteEl.style.cursor = 'grabbing';
      e.preventDefault(); // crucial to prevent text selection while dragging
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      noteEl.style.left = (nx + e.clientX - sx) + 'px';
      noteEl.style.top = (ny + e.clientY - sy) + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      noteEl.style.zIndex = 40;
      noteEl.style.cursor = 'grab';
      const nid = parseInt(noteEl.dataset.nid);
      const n = S.notes.find(n => n.id === nid);
      if (n) { n.x = parseFloat(noteEl.style.left); n.y = parseFloat(noteEl.style.top); save(); }
    });

    const delBtn = noteEl.querySelector('.sticky-delete');
    if(delBtn) {
      delBtn.addEventListener('click', () => {
        const id = parseInt(delBtn.dataset.del);
        S.notes = S.notes.filter(n => n.id !== id);
        save(); renderNotes();
      });
    }

    const ta = noteEl.querySelector('textarea[data-ntext]');
    if(ta) {
      ta.addEventListener('input', () => {
        const id = parseInt(ta.dataset.ntext);
        const n = S.notes.find(n => n.id === id);
        if (n) { n.text = ta.value; save(); }
      });
    }
  });
}

document.getElementById('note-add').addEventListener('click', () => {
  S.notes.push({
    id: S.nextNoteId++,
    text: '',
    color: NOTE_COLORS[S.notes.length % NOTE_COLORS.length],
    x: Math.random() * (window.innerWidth - 220),
    y: 100 + Math.random() * (window.innerHeight - 320),
  });
  save(); renderNotes();
});
document.getElementById('note-toggle').addEventListener('click', () => {
  notesVisible = !notesVisible;
  renderNotes();
});

// ===== DEV.TO FEED =====
let devArticles = [];

function fetchDev(tag = '') {
  const url = tag ? `https://dev.to/api/articles?tag=${tag}&per_page=5` : 'https://dev.to/api/articles?per_page=5';
  fetch(url)
    .then(r => r.json())
    .then(articles => {
      devArticles = articles;
      renderDev();
    })
    .catch(() => {
      document.getElementById('devto-articles').innerHTML =
        '<div style="color:var(--text-dim);text-align:center;padding:20px;font-size:12px">Unable to load articles</div>';
    });
}

function renderDev() {
  const container = document.getElementById('devto-articles');
  container.innerHTML = devArticles.slice(0, 5).map(a => `
    <div class="devto-article">
      <img class="devto-avatar" src="${a.user?.profile_image_90 || ''}" alt="" loading="lazy">
      <div class="devto-content">
        <div class="devto-author">${a.user?.name || 'Author'} · ${a.readable_publish_date || ''}</div>
        <div class="devto-title"><a href="${a.url}" target="_blank">${a.title}</a></div>
        <div class="devto-meta">
          <span>${a.reading_time_minutes || '?'} min read</span>
          <span>${a.tag_list?.join(', ') || ''}</span>
          <span>${a.comments_count || 0} comments</span>
        </div>
      </div>
      <div class="devto-votes">▲ ${a.public_reactions_count || 0}</div>
    </div>
  `).join('');
}

document.querySelectorAll('.devto-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.devto-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    if (tab === 'fresh') fetchDev('javascript');
    else if (tab === 'rising') fetchDev('webdev');
    else fetchDev();
  });
});

// ===== SEARCH =====
const engineNames = Object.keys(ENGINES);
let engineIdx = engineNames.indexOf(S.engine) >= 0 ? engineNames.indexOf(S.engine) : 0;

const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
if (searchInput && searchClear) {
  searchInput.addEventListener('input', () => {
    searchClear.style.display = searchInput.value.length > 0 ? 'block' : 'none';
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchInput.focus();
  });
}

document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q) {
      const searchModal = document.getElementById('search-modal');
      const searchIframe = document.getElementById('search-iframe');
      if(searchModal && searchIframe) {
        // Prevent generic 'X-Frame-Options: SAMEORIGIN' blocks on modern search engines
        // Note: For full production use with Google/Bing, a backend proxy is required
        // due to strict X-Frame-Options policies. We'll use Bing for the demo.
        let finalUrl = 'https://www.bing.com/copilotsearch?q=' + encodeURIComponent(q);
        
        searchIframe.src = finalUrl;
        searchModal.classList.add('open');
      }
    }
  }
});

const searchCloseBtn = document.getElementById('search-modal-close');
if(searchCloseBtn) {
  searchCloseBtn.addEventListener('click', () => {
    document.getElementById('search-modal').classList.remove('open');
    document.getElementById('search-iframe').src = '';
  });
}

// ===== WALLPAPER =====
function applyWallpaper() {
  const bg = document.getElementById('bg-wallpaper');
  if (S.wallpaper) {
    // If it's a local file path, ensure it's wrapped correctly
    const url = S.wallpaper.startsWith('file://') ? S.wallpaper : S.wallpaper;
    bg.style.backgroundImage = `url('${url}')`;
  }
}

// ===== SETTINGS =====
const settingsPanel = document.getElementById('settings-panel');
document.getElementById('settings-btn').addEventListener('click', () => {
  settingsPanel.classList.add('open');
  document.getElementById('s-wall').value = S.wallpaper || '';
  document.getElementById('s-engine').value = S.engine || 'Google';
  document.getElementById('s-lang').value = S.lang || 'en';
  const h = document.getElementById('s-24h');
  if(h) h.checked = !!S.use24h;
  
  if (S.hiddenWidgets) {
    const widgetTypes = ['clock', 'calendar', 'kanban', 'notes', 'devto', 'search'];
    widgetTypes.forEach(w => {
      const toggle = document.getElementById('t-' + w);
      if (toggle) {
        let id;
        if (w === 'notes') id = 'widget-notes-header';
        else if (w === 'search') id = 'search-footer';
        else id = 'widget-' + w;
        toggle.checked = !S.hiddenWidgets.includes(id);
      }
    });
  }
});

document.querySelectorAll('.settings-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.stab-pane').forEach(p => p.classList.remove('active'));
    const ts = document.getElementById('stab-' + tab.dataset.stab);
    if(ts) ts.classList.add('active');
  });
});

const closeX = document.getElementById('settings-close-x');
if(closeX) closeX.addEventListener('click', () => {
  settingsPanel.classList.remove('open');
});

document.getElementById('settings-save').addEventListener('click', () => {
  try {
    S.wallpaper = document.getElementById('s-wall').value.trim();
    const eng = document.getElementById('s-engine');
    if(eng) S.engine = eng.value;
    const lang = document.getElementById('s-lang');
    if(lang) S.lang = lang.value;
    const h = document.getElementById('s-24h');
    if(h) S.use24h = h.checked;
    
    S.hiddenWidgets = [];
    const widgetTypes = ['clock', 'calendar', 'kanban', 'notes', 'devto', 'search'];
    widgetTypes.forEach(w => {
      const toggle = document.getElementById('t-' + w);
      if (toggle && !toggle.checked) {
        if (w === 'notes') {
          S.hiddenWidgets.push('widget-notes-header');
          notesVisible = false;
          renderNotes();
        } else if (w === 'search') {
          S.hiddenWidgets.push('search-footer');
        } else {
          S.hiddenWidgets.push('widget-' + w);
        }
      } else if (w === 'notes' && toggle && toggle.checked) {
        notesVisible = true;
        renderNotes();
      }
    });
    
    save();
    applyWallpaper();
    updateClock();
    
    // Show all first
    document.querySelectorAll('.widget').forEach(w => w.style.display = 'block');
    const searchFooter = document.querySelector('.search-footer');
    if (searchFooter) searchFooter.style.display = 'flex';

    // Hide ones in S.hiddenWidgets
    S.hiddenWidgets.forEach(wid => {
      let el = document.getElementById(wid);
      if(!el && wid === 'search-footer') el = document.querySelector('.search-footer');
      if(el) el.style.display = 'none';
    });
    
    if (document.getElementById('main-grid').classList.contains('has-layout')) {
      LayoutManager.applyLayout(LayoutManager.getLayout());
    }
  } catch (err) {
    console.error("Error saving settings:", err);
  } finally {
  // ALWAYS close the panel
    settingsPanel.classList.remove('open');
  }
});

document.getElementById('s-reset-layout').addEventListener('click', () => {
  if (confirm('Are you sure you want to reset the layout to defaults? This will clear all custom positions and show all widgets.')) {
    // 1. Clear layout store
    localStorage.removeItem(LAYOUT_KEY);
    
    // 2. Reset visibility state
    S.hiddenWidgets = [];
    notesVisible = true;
    save();
    
    // 3. Reset inline styles (absolute positions/sizes)
    document.querySelectorAll('.widget').forEach(w => {
      w.style.left = '';
      w.style.top = '';
      w.style.width = '';
      w.style.height = '';
      w.style.display = 'block';
    });
    
    const searchFooter = document.getElementById('search-footer');
    if (searchFooter) searchFooter.style.display = 'flex';
    
    // 4. Reset grid class
    document.getElementById('main-grid').classList.remove('has-layout');
    
    // 5. Sync settings UI toggles
    const widgetTypes = ['clock', 'calendar', 'kanban', 'notes', 'devto', 'search'];
    widgetTypes.forEach(w => {
      const toggle = document.getElementById('t-' + w);
      if (toggle) toggle.checked = true;
    });
    
    // 6. Refresh components
    applyWallpaper();
    updateClock();
    renderNotes();
    
    // 7. Close settings
    settingsPanel.classList.remove('open');
    
    // Optional: Refresh page to be absolutely sure or just let the DOM updates handle it
    // location.reload(); 
  }
});

// ===== INIT =====
initPersistence();
