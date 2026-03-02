import re

with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 1. Edit mode banner flex updates
css = re.sub(
    r'.edit-banner {\s*display: none.*?}',
    '''.edit-banner {
  display: none; align-items: center; justify-content: space-between;
  padding: 12px 24px;
  background: rgba(30, 35, 55, 0.85); backdrop-filter: blur(16px);
  border: 1px solid var(--accent); border-radius: var(--radius-sm);
  font-size: 13px; color: white; font-weight: 500;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}''',
    css, flags=re.DOTALL
)

# Add widget-remove-btn styles
remove_btn_css = '''
/* ===== WIDGET REMOVE BUTTON ===== */
.widget-remove-btn {
  display: none;
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  background: #a855f7; /* purple */
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  z-index: 40;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.main-grid.edit-mode .widget-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
.widget-remove-btn:hover { background: #9333ea; transform: scale(1.1); }
'''

# 2. Kanban Priority Bars
kanban_css = '''
/* Priority Bars */
.task-card::after {
  content: '';
  position: absolute;
  top: 8px; right: 8px; bottom: 8px;
  width: 10px;
  background-image: repeating-linear-gradient(90deg, currentColor 0px, currentColor 1.5px, transparent 1.5px, transparent 3px);
  display: none;
}
.task-card.priority-high::after { display: block; color: rgba(251, 191, 36, 0.8); }
.task-card.priority-urgent::after { display: block; color: rgba(239, 68, 68, 0.8); }
.task-card {
  position: relative;
  overflow: hidden;
}
'''
css = re.sub(r'\.task-card {', kanban_css, css, count=1)

# 3. Settings Panel Redesign
new_settings_css = '''/* ===== SETTINGS MODAL ===== */
.settings-panel {
  position: fixed; inset: 0; z-index: 300;
  margin: auto; width: 680px; height: 460px;
  background: rgba(30, 35, 55, 0.95); backdrop-filter: blur(24px);
  border: 1px solid var(--card-border); border-radius: var(--radius);
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  display: none; flex-direction: row; overflow: hidden;
  animation: modalIn 0.2s ease;
}
.settings-panel.open { display: flex; }

.settings-sidebar {
  width: 200px; background: rgba(0,0,0,0.2); 
  border-right: 1px solid var(--divider);
  padding: 32px 0; display: flex; flex-direction: column;
}
.settings-header {
  font-size: 15px; font-weight: 700; color: white;
  padding: 0 24px; margin-bottom: 24px; letter-spacing: 0.5px;
}
.settings-tab {
  background: none; border: none; text-align: left;
  padding: 12px 24px; font-size: 13px; color: var(--text-secondary);
  cursor: pointer; font-family: inherit; font-weight: 500;
  transition: all 0.2s;
}
.settings-tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
.settings-tab.active { color: var(--accent); background: var(--accent-light); border-right: 3px solid var(--accent); }

.settings-content {
  flex: 1; padding: 32px 40px; position: relative; overflow-y: auto; display: flex; flex-direction: column;
}
.settings-close-x {
  position: absolute; top: 16px; right: 20px;
  background: none; border: none; color: var(--text-dim);
  font-size: 20px; cursor: pointer; transition: 0.2s;
}
.settings-close-x:hover { color: white; }

.stab-pane { display: none; flex-direction: column; flex: 1; }
.stab-pane.active { display: flex; }
.stab-pane h5 { font-size: 18px; font-weight: 600; margin-bottom: 24px; color: white; }

.widget-toggles-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
}
.toggle-row {
  display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-primary); cursor: pointer;
}
.toggle-row input[type="checkbox"] {
  width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer;
}
.settings-footer {
  margin-top: auto; padding-top: 24px; text-align: right;
  border-top: 1px solid var(--divider);
}
.settings-save {
  padding: 10px 24px; background: var(--accent); color: white; border: none;
  border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer;
}
.settings-save:hover { filter: brightness(1.15); }
'''

css = re.sub(
    r'/\* ===== SETTINGS PANEL ===== \*/.*?(?=/\* ===== FADE IN ===== \*/)',
    new_settings_css,
    css,
    flags=re.DOTALL
)

# 4. Search Clear
search_css = '''
.search-clear {
  position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: var(--text-dim);
  font-size: 16px; cursor: pointer; padding: 4px; z-index: 5;
}
.search-clear:hover { color: white; }
'''
css = css + search_css + remove_btn_css

# 5. DevTo Edit placeholder 
devto_edit_css = '''
.devto-edit-overlay {
  display: none;
  position: absolute; inset: 0; z-index: 20;
  background: rgba(30, 35, 55, 0.4);
  backdrop-filter: blur(8px);
  align-items: center; justify-content: center;
  border-radius: var(--radius);
}
.main-grid.edit-mode [data-widget="devto"] .devto-edit-overlay {
  display: flex; pointer-events: auto;
}
.devto-edit-btn {
  padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px; color: white; padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
  backdrop-filter: blur(12px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); transition: 0.2s;
}
.devto-edit-btn:hover { background: rgba(255,255,255,0.2); transform: translateY(-2px); }
'''
css = css + devto_edit_css

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("css patched")
