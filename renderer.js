let tasks = [];
let appSettings = {};
let activeCategory = 'today';
let activeView = 'task'; // 'task' | 'alldone' | 'stats' | 'settings'
let editingId = null;
let completedOpen = false;
let searchQuery = '';
let sortBy = localStorage.getItem('sortBy') || 'default';
let filterTag = null;
const expandedIds = new Set();
let dragSrcId = null;
const undoStack = [];
let focusedCardId = null;
let sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
let focusMode = false;
let habits = [];
let calendarDate = new Date().toISOString().slice(0, 10);
let calendarMode = 'week';

const activeTasksEl = document.getElementById('active-tasks');
const completedTasksEl = document.getElementById('completed-tasks');
const completedSectionEl = document.getElementById('completed-section');
const completedCountEl = document.getElementById('completed-count');
const completedToggleEl = document.getElementById('completed-toggle');
const formPanel = document.getElementById('form-panel');
const formTitle = document.getElementById('form-title');
const fTitle = document.getElementById('f-title');
const fCategory = document.getElementById('f-category');
const fPriority = document.getElementById('f-priority');
const fDue = document.getElementById('f-due');
const fRepeat = document.getElementById('f-repeat');
const fNotes = document.getElementById('f-notes');
const fEstimate = document.getElementById('f-estimate');
const fTags = document.getElementById('f-tags');
const fTime = document.getElementById('f-time');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const shortcutsBtn = document.getElementById('shortcuts-btn');
const shortcutsOverlay = document.getElementById('shortcuts-overlay');
const btnMinimize = document.getElementById('btn-minimize');
const btnMaximize = document.getElementById('btn-maximize');
const btnClose = document.getElementById('btn-close');
const sidebarEl = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const focusModeBtn = document.getElementById('focus-mode-btn');
const focusExitBtn = document.getElementById('focus-exit');
const tagFilterBar = document.getElementById('tag-filter-bar');

// ─── Theme ───
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('settings-theme-toggle');
  if (btn) btn.textContent = theme === 'light' ? '☾ Dark' : '☀ Light';
}
applyTheme(localStorage.getItem('theme') || 'dark');

// ─── Views ───
function switchView(view) {
  activeView = view;
  document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`${view}-view`);
  if (el) el.classList.add('active');
  if (view === 'alldone') renderAllDone();
  if (view === 'stats') renderStats();
  if (view === 'settings') renderSettings();
  if (view === 'task') renderTasks();
  if (view === 'habits') renderHabits();
  if (view === 'calendar') renderCalendar();
}

// ─── Sidebar collapse ───
function applyCollapsed() {
  sidebarEl.classList.toggle('collapsed', sidebarCollapsed);
  sidebarToggleBtn.innerHTML = sidebarCollapsed ? '&#x203A;' : '&#x2039;';
  sidebarToggleBtn.title = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
}
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
  applyCollapsed();
}
sidebarToggleBtn.addEventListener('click', toggleSidebar);
applyCollapsed();

// ─── Focus mode ───
function applyFocusMode() {
  document.body.classList.toggle('focus-mode', focusMode);
  focusModeBtn.classList.toggle('active', focusMode);
}
function toggleFocusMode() { focusMode = !focusMode; applyFocusMode(); }
focusModeBtn.addEventListener('click', toggleFocusMode);
focusExitBtn.addEventListener('click', () => { focusMode = false; applyFocusMode(); });

// ─── Shortcuts overlay ───
function openShortcuts() { shortcutsOverlay.classList.remove('hidden'); }
function closeShortcuts() { shortcutsOverlay.classList.add('hidden'); }
shortcutsBtn.addEventListener('click', openShortcuts);
document.getElementById('shortcuts-close').addEventListener('click', closeShortcuts);
shortcutsOverlay.addEventListener('click', e => { if (e.target === shortcutsOverlay) closeShortcuts(); });

// ─── Titlebar controls ───
btnMinimize.addEventListener('click', () => window.taskAPI.minimize());
btnMaximize.addEventListener('click', () => window.taskAPI.maximize());
btnClose.addEventListener('click', () => window.taskAPI.close());
window.taskAPI.onMaximized(isMax => {
  btnMaximize.title = isMax ? 'Restore' : 'Maximize';
  btnMaximize.innerHTML = isMax ? '&#x2750;' : '&#x25A1;';
});

// ─── Helpers ───
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function priorityLabel(p) {
  return { high: 'High', medium: 'Med', low: 'Low' }[p] || p;
}

function categoryLabel(cat) {
  return { today: 'Today', thisweek: 'This Week', backlog: 'Backlog', upcoming: 'Upcoming' }[cat] || cat;
}

function formatEstimate(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDueDate(dueDate, today) {
  if (!dueDate) return null;
  const diff = Math.round(
    (new Date(dueDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  if (diff < -1) return `${-diff}d ago`;
  return dueDate;
}

function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function pushUndo() {
  undoStack.push(JSON.parse(JSON.stringify(tasks)));
  if (undoStack.length > 20) undoStack.shift();
}

function showToast(msg) {
  let toast = document.getElementById('undo-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'undo-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
}

function applySort(list) {
  if (sortBy === 'priority' || sortBy === 'group-priority') {
    const order = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
  }
  if (sortBy === 'dueDate') {
    return [...list].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }
  if (sortBy === 'title') {
    return [...list].sort((a, b) => a.title.localeCompare(b.title));
  }
  return list;
}

function restoreKbdFocus() {
  if (!focusedCardId) return;
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('kbd-focus'));
  const card = document.querySelector(`.task-card[data-id="${focusedCardId}"]`);
  if (card) card.classList.add('kbd-focus');
  else focusedCardId = null;
}

// ─── Export text (used by settings) ───
function formatTasksForExport() {
  const today = new Date().toISOString().slice(0, 10);
  const sections = [
    { label: 'TODAY',     items: tasks.filter(t => t.category === 'today'    && !t.completed) },
    { label: 'THIS WEEK', items: tasks.filter(t => t.category === 'thisweek' && !t.completed) },
    { label: 'BACKLOG',   items: tasks.filter(t => t.category === 'backlog'  && !t.completed) },
    { label: 'COMPLETED', items: tasks.filter(t => t.completed) },
  ];
  let out = `Work Tasks Export — ${today}\n\n`;
  for (const { label, items } of sections) {
    if (items.length === 0) continue;
    out += `${label}\n${'─'.repeat(label.length)}\n`;
    for (const t of items) {
      const check = t.completed ? '[x]' : '[ ]';
      const pri = t.priority !== 'medium' ? ` (${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)})` : '';
      const due = t.dueDate ? ` — Due: ${t.dueDate}` : '';
      const est = t.estimate ? ` — Est: ${formatEstimate(t.estimate)}` : '';
      const done = t.completedAt ? ` — Done: ${t.completedAt.slice(0, 10)}` : '';
      out += `${check} ${t.title}${pri}${due}${est}${done}\n`;
      for (const s of (t.subtasks || [])) {
        out += `    ${s.completed ? '[x]' : '[ ]'} ${s.title}\n`;
      }
    }
    out += '\n';
  }
  return out;
}

// ─── Card rendering ───
function renderTaskCard(task, { showCategory = false, draggable = false } = {}) {
  const card = document.createElement('div');
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !task.completed && task.dueDate && task.dueDate < today;
  card.className = 'task-card' + (task.completed ? ' completed' : '') + (isOverdue ? ' overdue' : '');
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;
  if (draggable) card.setAttribute('draggable', 'true');

  const dueFmt = formatDueDate(task.dueDate, today);
  let dueHtml = '';
  if (dueFmt) {
    const overdueCls = isOverdue ? ' task-due-overdue' : '';
    dueHtml = `<span class="task-due${overdueCls}">${escapeHtml(dueFmt)}</span>`;
  }

  const catBadge = showCategory ? `<span class="task-cat">${escapeHtml(categoryLabel(task.category))}</span>` : '';
  const repeatBadge = task.repeat ? `<span class="task-repeat">&#x21BB; ${task.repeat}</span>` : '';
  const completedDate = task.completed && task.completedAt
    ? `<span class="completed-date">Done ${task.completedAt.slice(0, 10)}</span>` : '';

  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter(s => s.completed).length;
  const subtaskBadge = subtasks.length > 0
    ? `<span class="subtask-progress">${doneCount}/${subtasks.length}</span>` : '';

  const subtaskRows = subtasks.map(s => `
    <div class="subtask${s.completed ? ' subtask-done' : ''}" data-subtask-id="${escapeHtml(s.id)}">
      <div class="subtask-check" data-action="toggle-subtask" data-subtask-id="${escapeHtml(s.id)}"></div>
      <span class="subtask-title">${escapeHtml(s.title)}</span>
      <button class="subtask-del" data-action="delete-subtask" data-subtask-id="${escapeHtml(s.id)}">&#xD7;</button>
    </div>
  `).join('');

  const subtaskSection = (subtasks.length > 0 || !task.completed) ? `
    <div class="subtask-list">
      ${subtaskRows}
      ${!task.completed ? `
        <div class="subtask-add-row">
          <input class="subtask-input" placeholder="Add subtask&hellip;">
          <button data-action="add-subtask">+</button>
        </div>
      ` : ''}
    </div>
  ` : '';

  const estimateBadge = task.estimate ? `<span class="task-estimate">${escapeHtml(formatEstimate(task.estimate))}</span>` : '';
  const pinBtn = `<button class="task-pin-btn${task.pinned ? ' pinned' : ''}" data-action="pin" title="${task.pinned ? 'Unpin' : 'Pin to top'}">&#x2B06;</button>`;

  const snoozeButtons = !task.completed ? `
    <button data-action="snooze-1" class="btn-snooze" title="Snooze 1 day">+1d</button>
    <button data-action="snooze-7" class="btn-snooze" title="Snooze 1 week">+7d</button>
  ` : '';

  const tags = task.tags || [];
  const tagHtml = tags.length > 0 ? `
    <div class="task-tags">
      ${tags.map(t => `<span class="tag-chip" data-action="filter-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}
    </div>
  ` : '';

  const notesHtml = task.notes ? `<div class="task-notes-section"><p class="task-notes">${renderMarkdown(task.notes)}</p></div>` : '';
  const notesBtn = task.notes ? `<button class="notes-toggle-btn" data-action="toggle-notes" title="Show notes">Notes &#x25BE;</button>` : '';

  card.innerHTML = `
    <div class="task-header">
      ${draggable ? '<span class="drag-handle" data-action="drag">&#x22EE;&#x22EE;</span>' : ''}
      <div class="task-checkbox" data-action="toggle"></div>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="priority-badge priority-${task.priority}">${priorityLabel(task.priority)}</span>
      ${catBadge}${dueHtml}${repeatBadge}${subtaskBadge}${estimateBadge}${pinBtn}${notesBtn}
    </div>
    ${notesHtml}
    <div class="task-body">
      ${tagHtml}
      ${subtaskSection}
      <div class="task-actions">
        <button data-action="edit">Edit</button>
        ${snoozeButtons}
        <button data-action="delete" class="btn-delete">Delete</button>
        ${completedDate}
      </div>
    </div>
  `;
  return card;
}

function reorderTasks(draggedId, targetId, insertBefore) {
  const dragged = tasks.find(t => t.id === draggedId);
  if (!dragged) return tasks;
  const without = tasks.filter(t => t.id !== draggedId);
  const targetIdx = without.findIndex(t => t.id === targetId);
  if (targetIdx === -1) return tasks;
  const result = [...without];
  result.splice(insertBefore ? targetIdx : targetIdx + 1, 0, dragged);
  return result;
}

function restoreExpanded(container) {
  expandedIds.forEach(id => {
    const card = container.querySelector(`[data-id="${id}"]`);
    if (card) {
      const body = card.querySelector('.task-body');
      if (body) body.classList.add('open');
    }
  });
}

function updateTagFilterBar(items) {
  if (!tagFilterBar) return;
  const allTags = [...new Set(items.flatMap(t => t.tags || []))].sort();
  if (allTags.length === 0) {
    tagFilterBar.innerHTML = '';
    tagFilterBar.classList.add('hidden');
    return;
  }
  tagFilterBar.classList.remove('hidden');
  tagFilterBar.innerHTML = allTags.map(tag => `
    <span class="tag-filter-chip${filterTag === tag ? ' active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>
  `).join('');
}

function renderTasks() {
  const today = new Date().toISOString().slice(0, 10);
  let active, completed, showCat = false;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    active = tasks.filter(t => !t.completed && t.title.toLowerCase().includes(q));
    completed = tasks.filter(t => t.completed && t.title.toLowerCase().includes(q));
    showCat = true;
  } else if (activeCategory === 'upcoming') {
    active = getUpcoming(tasks, today);
    completed = [];
  } else {
    active = getActive(tasks, activeCategory);
    completed = getCompleted(tasks, activeCategory);
  }

  if (filterTag) {
    active = active.filter(t => (t.tags || []).includes(filterTag));
    completed = completed.filter(t => (t.tags || []).includes(filterTag));
  }

  updateTagFilterBar([...active, ...completed]);
  active = applySort(active);

  const groupPriority = sortBy === 'group-priority';
  if (!groupPriority) {
    active = [...active.filter(t => t.pinned), ...active.filter(t => !t.pinned)];
  }

  const canDrag = sortBy === 'default' && !searchQuery && activeCategory !== 'upcoming';

  const timeTotalEl = document.getElementById('time-total');
  if (timeTotalEl) {
    const totalMin = active.reduce((s, t) => s + (t.estimate || 0), 0);
    if (totalMin > 0) {
      timeTotalEl.textContent = `Est. ${formatEstimate(totalMin)}`;
      timeTotalEl.classList.remove('hidden');
    } else {
      timeTotalEl.classList.add('hidden');
    }
  }

  activeTasksEl.innerHTML = '';
  if (active.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'empty-state';
    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    if (filterTag) {
      icon.textContent = '🏷';
      emptyEl.appendChild(icon);
      emptyEl.appendChild(document.createTextNode(`No tasks tagged "${filterTag}".`));
    } else if (searchQuery) {
      icon.textContent = '🔍';
      emptyEl.appendChild(icon);
      emptyEl.appendChild(document.createTextNode('No tasks match your search.'));
    } else if (activeCategory === 'upcoming') {
      icon.textContent = '📅';
      emptyEl.appendChild(icon);
      emptyEl.appendChild(document.createTextNode('No upcoming tasks with due dates.'));
    } else {
      icon.textContent = '✓';
      emptyEl.appendChild(icon);
      emptyEl.appendChild(document.createTextNode('All clear — press N to add a task.'));
    }
    activeTasksEl.appendChild(emptyEl);
  } else if (groupPriority) {
    const groups = [
      { key: 'high',   label: 'High Priority',  cls: 'group-header-high' },
      { key: 'medium', label: 'Medium Priority', cls: 'group-header-medium' },
      { key: 'low',    label: 'Low Priority',    cls: 'group-header-low' },
    ];
    for (const { key, label, cls } of groups) {
      const items = active.filter(t => t.priority === key);
      if (items.length === 0) continue;
      const header = document.createElement('div');
      header.className = `group-header ${cls}`;
      header.textContent = label;
      activeTasksEl.appendChild(header);
      items.forEach(t => activeTasksEl.appendChild(renderTaskCard(t, { showCategory: showCat, draggable: false })));
    }
  } else {
    active.forEach(t => activeTasksEl.appendChild(renderTaskCard(t, { showCategory: showCat, draggable: canDrag })));
  }

  completedTasksEl.innerHTML = '';
  completed.forEach(t => completedTasksEl.appendChild(renderTaskCard(t, { showCategory: showCat })));

  completedCountEl.textContent = completed.length;
  if (completed.length > 0) {
    completedSectionEl.classList.remove('hidden');
  } else {
    completedSectionEl.classList.add('hidden');
    completedOpen = false;
  }
  completedTasksEl.classList.toggle('hidden', !completedOpen);
  completedToggleEl.textContent = `${completedOpen ? '▼' : '▶'} Completed (${completed.length})`;

  restoreExpanded(activeTasksEl);
  restoreExpanded(completedTasksEl);
  updateTabBadges();
  restoreKbdFocus();
}

function updateTabBadges() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('.tab[data-category]').forEach(tab => {
    const badge = tab.querySelector('.tab-badge');
    const fill = tab.querySelector('.tab-progress-fill');
    const cat = tab.dataset.category;
    const activeList = cat === 'upcoming'
      ? getUpcoming(tasks, today)
      : getActive(tasks, cat);
    const total = activeList.length + (cat === 'upcoming' ? 0 : getCompleted(tasks, cat).length);
    const doneCount = cat === 'upcoming' ? 0 : getCompleted(tasks, cat).length;
    if (badge) badge.textContent = activeList.length > 0 ? activeList.length : '';
    if (fill) fill.style.width = total > 0 ? `${Math.round((doneCount / total) * 100)}%` : '0%';
  });
}

// ─── All Done view ───
function renderAllDone() {
  const listEl = document.getElementById('alldone-list');
  if (!listEl) return;
  const completed = tasks.filter(t => t.completed && t.completedAt);
  completed.sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  if (completed.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">✓</div>No completed tasks yet.</div>';
    return;
  }

  const groups = new Map();
  for (const t of completed) {
    const date = t.completedAt.slice(0, 10);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(t);
  }

  const today = new Date().toISOString().slice(0, 10);
  const yDate = new Date(today + 'T00:00:00');
  yDate.setDate(yDate.getDate() - 1);
  const yStr = yDate.toISOString().slice(0, 10);

  listEl.innerHTML = '';
  for (const [date, items] of groups) {
    const group = document.createElement('div');
    group.className = 'alldone-date-group';
    const label = date === today ? 'Today' : date === yStr ? 'Yesterday' : date;
    group.innerHTML = `<div class="alldone-date-label">${escapeHtml(label)} <span style="font-weight:400;opacity:0.6">(${items.length})</span></div>`;
    for (const t of items) {
      const row = document.createElement('div');
      row.className = 'alldone-task';
      row.innerHTML = `
        <span class="alldone-task-title">${escapeHtml(t.title)}</span>
        <span class="alldone-cat">${escapeHtml(categoryLabel(t.category))}</span>
        <span class="priority-badge priority-${t.priority}">${priorityLabel(t.priority)}</span>
      `;
      group.appendChild(row);
    }
    listEl.appendChild(group);
  }
}

// ─── Stats view ───
function renderStats() {
  const today = new Date().toISOString().slice(0, 10);
  const completed = tasks.filter(t => t.completed && t.completedAt);

  document.querySelector('#stat-total-done .stat-value').textContent = completed.length;

  const doneToday = completed.filter(t => t.completedAt.slice(0, 10) === today).length;
  document.querySelector('#stat-done-today .stat-value').textContent = doneToday;

  const weekAgo = new Date(today + 'T00:00:00');
  weekAgo.setDate(weekAgo.getDate() - 6);
  const doneWeek = completed.filter(t => t.completedAt.slice(0, 10) >= weekAgo.toISOString().slice(0, 10)).length;
  document.querySelector('#stat-done-week .stat-value').textContent = doneWeek;

  const doneDates = new Set(completed.map(t => t.completedAt.slice(0, 10)));
  let streak = 0;
  const d = new Date(today + 'T00:00:00');
  while (doneDates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  document.querySelector('#stat-streak .stat-value').textContent = streak;

  const chartEl = document.getElementById('stats-bar-chart');
  if (chartEl) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(today + 'T00:00:00');
      dd.setDate(dd.getDate() - i);
      const dStr = dd.toISOString().slice(0, 10);
      const count = completed.filter(t => t.completedAt.slice(0, 10) === dStr).length;
      const label = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dd.getDay()];
      days.push({ label, count });
    }
    const maxCount = Math.max(1, ...days.map(d => d.count));
    chartEl.innerHTML = days.map(({ label, count }) => `
      <div class="chart-bar-wrap">
        <div class="chart-bar-val">${count > 0 ? count : ''}</div>
        <div class="chart-bar" style="height:${Math.round((count / maxCount) * 72)}px"></div>
        <div class="chart-bar-label">${escapeHtml(label)}</div>
      </div>
    `).join('');
  }

  const priEl = document.getElementById('stats-priority-bars');
  if (priEl) {
    const priorities = [
      { key: 'high',   label: 'High', color: 'var(--high)' },
      { key: 'medium', label: 'Med',  color: 'var(--medium)' },
      { key: 'low',    label: 'Low',  color: 'var(--low)' },
    ];
    const maxPri = Math.max(1, ...priorities.map(p => completed.filter(t => t.priority === p.key).length));
    priEl.innerHTML = priorities.map(({ key, label, color }) => {
      const count = completed.filter(t => t.priority === key).length;
      const pct = Math.round((count / maxPri) * 100);
      return `
        <div class="priority-stat-row">
          <span class="priority-stat-label">${escapeHtml(label)}</span>
          <div class="priority-stat-bar-wrap">
            <div class="priority-stat-bar" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="priority-stat-count">${count}</span>
        </div>
      `;
    }).join('');
  }
}

// ─── Settings view ───
async function renderSettings() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const themeBtn = document.getElementById('settings-theme-toggle');
  if (themeBtn) themeBtn.textContent = theme === 'light' ? '☾ Dark' : '☀ Light';

  const autoStartEl = document.getElementById('settings-auto-start');
  if (autoStartEl) {
    try { autoStartEl.checked = await window.taskAPI.getAutoStart(); } catch {}
  }

  const rolloverEl = document.getElementById('settings-auto-rollover');
  if (rolloverEl) rolloverEl.checked = appSettings.autoRollover !== false;

  const notifyEl = document.getElementById('settings-notify-enabled');
  if (notifyEl) notifyEl.checked = appSettings.notifyEnabled !== false;

  const notifyHourEl = document.getElementById('settings-notify-hour');
  if (notifyHourEl) notifyHourEl.value = appSettings.notifyHour ?? 9;

  const defaultSortEl = document.getElementById('settings-default-sort');
  if (defaultSortEl) defaultSortEl.value = appSettings.defaultSort || 'default';

  const defaultCatEl = document.getElementById('settings-default-category');
  if (defaultCatEl) defaultCatEl.value = appSettings.defaultCategory || 'today';

  const confirmDeleteEl = document.getElementById('settings-confirm-delete');
  if (confirmDeleteEl) confirmDeleteEl.checked = !!appSettings.confirmDelete;
}

function initSettingsHandlers() {
  document.getElementById('settings-theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });

  document.getElementById('settings-auto-start')?.addEventListener('change', async e => {
    try { await window.taskAPI.setAutoStart(e.target.checked); } catch {}
  });

  async function saveSetting(key, value) {
    appSettings[key] = value;
    try { await window.taskAPI.writeSettings({ [key]: value }); } catch {}
  }

  document.getElementById('settings-auto-rollover')?.addEventListener('change', e => saveSetting('autoRollover', e.target.checked));
  document.getElementById('settings-notify-enabled')?.addEventListener('change', e => saveSetting('notifyEnabled', e.target.checked));
  document.getElementById('settings-notify-hour')?.addEventListener('change', e => saveSetting('notifyHour', parseInt(e.target.value, 10) || 9));
  document.getElementById('settings-default-sort')?.addEventListener('change', e => saveSetting('defaultSort', e.target.value));
  document.getElementById('settings-default-category')?.addEventListener('change', e => saveSetting('defaultCategory', e.target.value));
  document.getElementById('settings-confirm-delete')?.addEventListener('change', e => saveSetting('confirmDelete', e.target.checked));

  document.getElementById('settings-export-excel')?.addEventListener('click', async () => {
    const result = await window.taskAPI.exportExcel(tasks);
    if (result?.success) showToast('Exported to Excel');
    else if (result?.error) showToast('Export failed: ' + result.error);
  });

  document.getElementById('settings-export-txt')?.addEventListener('click', async () => {
    const result = await window.taskAPI.exportTasks(formatTasksForExport());
    if (result?.success) showToast('Exported to text file');
  });

  document.getElementById('settings-import')?.addEventListener('click', async () => {
    const result = await window.taskAPI.importTasks();
    if (result?.cancelled) return;
    if (result?.error) { showToast('Import error: ' + result.error); return; }
    if (result?.rows?.length > 0) {
      showImportMapper(result.rows);
    } else {
      showToast('No rows found in file');
    }
  });
}

// ─── Import column mapper ───
function showImportMapper(rows) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const fields = [
    { key: 'title',    label: 'Title (required)' },
    { key: 'priority', label: 'Priority' },
    { key: 'category', label: 'Category' },
    { key: 'dueDate',  label: 'Due Date (YYYY-MM-DD)' },
    { key: 'notes',    label: 'Notes' },
    { key: 'tags',     label: 'Tags (comma-separated)' },
    { key: 'estimate', label: 'Est. minutes' },
  ];

  const modal = document.createElement('div');
  modal.id = 'import-mapper';
  modal.innerHTML = `
    <div id="import-modal">
      <h3>Map Columns</h3>
      <p>${rows.length} row(s) found. Match your file columns to task fields:</p>
      ${fields.map(f => `
        <div class="import-map-row">
          <label>${escapeHtml(f.label)}</label>
          <select data-field="${escapeHtml(f.key)}">
            <option value="">(skip)</option>
            ${columns.map(c => `<option value="${escapeHtml(c)}"${c.toLowerCase() === f.key.toLowerCase() ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
      `).join('')}
      <div id="import-modal-actions">
        <button id="import-cancel-btn">Cancel</button>
        <button id="import-confirm">Import</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#import-cancel-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('#import-confirm').addEventListener('click', () => {
    const mapping = {};
    modal.querySelectorAll('select[data-field]').forEach(sel => {
      if (sel.value) mapping[sel.dataset.field] = sel.value;
    });
    if (!mapping.title) { showToast('Please map the Title column'); return; }

    const catMap = { today: 'today', 'this week': 'thisweek', thisweek: 'thisweek', backlog: 'backlog', upcoming: 'upcoming' };
    const priMap = { high: 'high', medium: 'medium', med: 'medium', low: 'low' };

    pushUndo();
    let added = 0;
    for (const row of rows) {
      const title = String(row[mapping.title] || '').trim();
      if (!title) continue;
      const catRaw = mapping.category ? String(row[mapping.category] || '').toLowerCase().trim() : '';
      const category = catMap[catRaw] || 'backlog';
      const priRaw = mapping.priority ? String(row[mapping.priority] || '').toLowerCase().trim() : '';
      const priority = priMap[priRaw] || 'medium';
      const dueDateRaw = mapping.dueDate ? String(row[mapping.dueDate] || '') : '';
      const dueDateMatch = dueDateRaw.match(/\d{4}-\d{2}-\d{2}/);
      const dueDate = dueDateMatch ? dueDateMatch[0] : null;
      const notes = mapping.notes ? String(row[mapping.notes] || '').trim() : '';
      const tagsRaw = mapping.tags ? String(row[mapping.tags] || '').trim() : '';
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
      const estimate = mapping.estimate ? (parseInt(row[mapping.estimate], 10) || null) : null;

      tasks = [...tasks, createTask({ title, category, priority, dueDate, notes, tags, estimate })];
      added++;
    }

    save();
    switchView('task');
    renderTasks();
    modal.remove();
    showToast(`Imported ${added} task${added !== 1 ? 's' : ''}`);
  });
}

async function save() {
  await window.taskAPI.writeTasks(tasks);
}

async function init() {
  tasks = await window.taskAPI.readTasks();
  try { appSettings = (await window.taskAPI.readSettings()) || {}; } catch { appSettings = {}; }
  try { habits = (await window.taskAPI.readHabits()) || []; } catch { habits = []; }

  if (!localStorage.getItem('sortBy') && appSettings.defaultSort) {
    sortBy = appSettings.defaultSort;
    sortSelect.value = sortBy;
  }

  renderTasks();
  initSettingsHandlers();
  initHabitHandlers();
  initCalendarHandlers();
}

init();

sortSelect.value = sortBy;
sortSelect.addEventListener('change', () => {
  sortBy = sortSelect.value;
  localStorage.setItem('sortBy', sortBy);
  renderTasks();
});

// Tag filter bar
if (tagFilterBar) {
  tagFilterBar.addEventListener('click', e => {
    const chip = e.target.closest('.tag-filter-chip');
    if (!chip) return;
    const tag = chip.dataset.tag;
    filterTag = filterTag === tag ? null : tag;
    renderTasks();
  });
}

// ─── Tab navigation ───
document.getElementById('tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  if (tab.dataset.view) {
    switchView(tab.dataset.view);
  } else if (tab.dataset.category) {
    activeCategory = tab.dataset.category;
    completedOpen = false;
    searchInput.value = '';
    searchQuery = '';
    filterTag = null;
    focusedCardId = null;
    switchView('task');
  }
});

completedToggleEl.addEventListener('click', () => {
  completedOpen = !completedOpen;
  const count = searchQuery
    ? tasks.filter(t => t.completed && t.title.toLowerCase().includes(searchQuery.toLowerCase())).length
    : getCompleted(tasks, activeCategory).length;
  completedTasksEl.classList.toggle('hidden', !completedOpen);
  completedToggleEl.textContent = `${completedOpen ? '▼' : '▶'} Completed (${count})`;
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  filterTag = null;
  focusedCardId = null;
  renderTasks();
});

function openAddForm(prefill = {}) {
  editingId = null;
  formTitle.textContent = 'New Task';
  fTitle.value = '';
  const defCat = appSettings.defaultCategory || 'today';
  fCategory.value = (activeCategory === 'upcoming' || !activeCategory) ? defCat : activeCategory;
  fPriority.value = 'medium';
  fDue.value = prefill.date || '';
  if (fTime) fTime.value = prefill.time || '';
  fRepeat.value = '';
  fNotes.value = '';
  fEstimate.value = '';
  if (fTags) fTags.value = '';
  formPanel.classList.add('open');
  fTitle.focus();
}

function openEditForm(task) {
  editingId = task.id;
  formTitle.textContent = 'Edit Task';
  fTitle.value = task.title;
  fCategory.value = task.category;
  fPriority.value = task.priority;
  fDue.value = task.dueDate || '';
  if (fTime) fTime.value = task.time || '';
  fRepeat.value = task.repeat || '';
  fNotes.value = task.notes || '';
  fEstimate.value = task.estimate || '';
  if (fTags) fTags.value = (task.tags || []).join(', ');
  formPanel.classList.add('open');
  fTitle.focus();
}

function closeForm() {
  formPanel.classList.remove('open');
  editingId = null;
}

async function saveForm() {
  const title = fTitle.value.trim();
  if (!title) { fTitle.focus(); return; }

  const estimate = parseInt(fEstimate.value, 10) || null;
  const tags = fTags ? fTags.value.split(',').map(t => t.trim()).filter(Boolean) : [];
  const time = fTime && fTime.value ? fTime.value : null;

  if (editingId) {
    tasks = updateTask(tasks, editingId, {
      title,
      category: fCategory.value,
      priority: fPriority.value,
      dueDate: fDue.value || null,
      time,
      repeat: fRepeat.value || null,
      notes: fNotes.value,
      estimate,
      tags,
    });
  } else {
    const task = createTask({
      title,
      category: fCategory.value,
      priority: fPriority.value,
      dueDate: fDue.value || null,
      time,
      repeat: fRepeat.value || null,
      notes: fNotes.value,
      estimate,
      tags,
    });
    tasks = [...tasks, task];
  }

  await save();
  if (!searchQuery) {
    activeCategory = fCategory.value;
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.category === activeCategory);
    });
  }
  closeForm();
  switchView('task');
  renderTasks();
}

document.getElementById('add-btn').addEventListener('click', openAddForm);
document.getElementById('form-cancel').addEventListener('click', closeForm);
document.getElementById('form-save').addEventListener('click', saveForm);
fTitle.addEventListener('keydown', e => { if (e.key === 'Enter') saveForm(); });

document.getElementById('due-quick-picks').addEventListener('click', e => {
  const btn = e.target.closest('.quick-date-btn');
  if (!btn) return;
  const d = new Date();
  d.setDate(d.getDate() + parseInt(btn.dataset.days, 10));
  fDue.value = d.toISOString().slice(0, 10);
});

function handleTaskAction(e) {
  const action = e.target.dataset.action;
  if (!action || action === 'drag') return;

  if (action === 'filter-tag') {
    const tag = e.target.dataset.tag;
    filterTag = filterTag === tag ? null : tag;
    renderTasks();
    return;
  }

  const card = e.target.closest('.task-card');
  if (!card) return;
  const id = card.dataset.id;

  if (action === 'toggle') {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    pushUndo();
    if (!task.completed && task.repeat) {
      tasks = completeTask(tasks, id);
      tasks = [...tasks, createRecurringInstance(task)];
    } else {
      tasks = task.completed ? uncompleteTask(tasks, id) : completeTask(tasks, id);
    }
    save(); renderTasks();
    return;
  }

  if (action === 'toggle-subtask') {
    tasks = toggleSubtask(tasks, id, e.target.dataset.subtaskId);
    save(); renderTasks();
    return;
  }

  if (action === 'delete-subtask') {
    tasks = deleteSubtask(tasks, id, e.target.dataset.subtaskId);
    save(); renderTasks();
    return;
  }

  if (action === 'add-subtask') {
    const input = card.querySelector('.subtask-input');
    const title = input ? input.value.trim() : '';
    if (!title) return;
    tasks = addSubtask(tasks, id, title);
    save(); renderTasks();
    return;
  }

  if (action === 'snooze-1' || action === 'snooze-7') {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    pushUndo();
    const days = action === 'snooze-1' ? 1 : 7;
    const today = new Date().toISOString().slice(0, 10);
    const base = task.dueDate && task.dueDate >= today ? task.dueDate : today;
    const d = new Date(base + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().slice(0, 10);
    tasks = updateTask(tasks, id, { dueDate: newDate });
    save(); renderTasks();
    showToast(`Snoozed to ${formatDueDate(newDate, today)}`);
    return;
  }

  if (action === 'delete') {
    if (card.dataset.confirming === 'true') {
      pushUndo();
      tasks = deleteTask(tasks, id);
      if (focusedCardId === id) focusedCardId = null;
      save(); renderTasks();
    } else if (appSettings.confirmDelete) {
      card.dataset.confirming = 'true';
      const actionsEl = card.querySelector('.task-actions');
      actionsEl.innerHTML = `
        <span class="delete-confirm-msg">Delete this task?</span>
        <button data-action="delete">Yes, delete</button>
        <button data-action="cancel-delete">Cancel</button>
      `;
    } else {
      pushUndo();
      tasks = deleteTask(tasks, id);
      if (focusedCardId === id) focusedCardId = null;
      save(); renderTasks();
    }
    return;
  }

  if (action === 'cancel-delete') {
    const task = tasks.find(t => t.id === id);
    if (task) card.replaceWith(renderTaskCard(task, { showCategory: !!searchQuery }));
    return;
  }

  if (action === 'pin') {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    tasks = updateTask(tasks, id, { pinned: !task.pinned });
    save(); renderTasks();
    return;
  }

  if (action === 'inline-edit') {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const titleEl = card.querySelector('.task-title');
    if (!titleEl) return;
    const input = document.createElement('input');
    input.className = 'task-title-input';
    input.value = task.title;
    titleEl.replaceWith(input);
    input.focus();
    input.select();
    input.addEventListener('click', ev => ev.stopPropagation());
    let committed = false;
    function commitInlineEdit() {
      if (committed) return;
      committed = true;
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== task.title) {
        tasks = updateTask(tasks, id, { title: newTitle });
        save(); renderTasks();
      } else {
        input.replaceWith(titleEl);
      }
    }
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.stopPropagation(); commitInlineEdit(); }
      if (ev.key === 'Escape') { ev.stopPropagation(); committed = true; input.replaceWith(titleEl); }
    });
    input.addEventListener('blur', commitInlineEdit);
    return;
  }

  if (action === 'toggle-notes') {
    const notesSection = card.querySelector('.task-notes-section');
    const btn = e.target.closest('[data-action="toggle-notes"]');
    if (notesSection) {
      const isOpen = notesSection.classList.toggle('open');
      if (btn) btn.classList.toggle('open', isOpen);
    }
    return;
  }

  if (action === 'edit') {
    const task = tasks.find(t => t.id === id);
    if (task) openEditForm(task);
  }
}

function handleTaskExpand(e) {
  if (e.target.dataset.action) return;
  const header = e.target.closest('.task-header');
  if (!header) return;
  const card = header.closest('.task-card');
  if (!card) return;
  const body = header.nextElementSibling;
  if (body && body.classList.contains('task-body')) {
    const isOpen = body.classList.toggle('open');
    if (isOpen) expandedIds.add(card.dataset.id);
    else expandedIds.delete(card.dataset.id);
  }
}

function handleSubtaskKey(e) {
  if (e.key !== 'Enter') return;
  const input = e.target;
  if (!input.classList.contains('subtask-input')) return;
  const card = input.closest('.task-card');
  if (!card) return;
  const title = input.value.trim();
  if (!title) return;
  tasks = addSubtask(tasks, card.dataset.id, title);
  save(); renderTasks();
}

activeTasksEl.addEventListener('click', e => { handleTaskAction(e); handleTaskExpand(e); });
completedTasksEl.addEventListener('click', e => { handleTaskAction(e); handleTaskExpand(e); });
activeTasksEl.addEventListener('keydown', handleSubtaskKey);
completedTasksEl.addEventListener('keydown', handleSubtaskKey);

// ─── Drag to reorder ───
activeTasksEl.addEventListener('dragstart', e => {
  const card = e.target.closest('.task-card');
  if (!card) return;
  dragSrcId = card.dataset.id;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcId);
});

activeTasksEl.addEventListener('dragover', e => {
  e.preventDefault();
  const card = e.target.closest('.task-card');
  if (!card || card.dataset.id === dragSrcId) return;
  const rect = card.getBoundingClientRect();
  const insertBefore = e.clientY < rect.top + rect.height / 2;
  activeTasksEl.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
  card.classList.add(insertBefore ? 'drag-over-top' : 'drag-over-bottom');
  e.dataTransfer.dropEffect = 'move';
});

activeTasksEl.addEventListener('dragleave', e => {
  if (!activeTasksEl.contains(e.relatedTarget)) {
    activeTasksEl.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
  }
});

activeTasksEl.addEventListener('drop', e => {
  e.preventDefault();
  const targetCard = e.target.closest('.task-card');
  if (!targetCard || !dragSrcId || targetCard.dataset.id === dragSrcId) return;
  const rect = targetCard.getBoundingClientRect();
  const insertBefore = e.clientY < rect.top + rect.height / 2;
  pushUndo();
  tasks = reorderTasks(dragSrcId, targetCard.dataset.id, insertBefore);
  save(); renderTasks();
});

activeTasksEl.addEventListener('dragend', () => {
  activeTasksEl.querySelectorAll('.task-card').forEach(c => c.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom'));
  dragSrcId = null;
});

document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    if (undoStack.length === 0) { showToast('Nothing to undo'); return; }
    tasks = undoStack.pop();
    save(); renderTasks();
    showToast('Undone');
    return;
  }

  if (e.key === 'Escape') {
    if (focusMode) {
      focusMode = false; applyFocusMode();
    } else if (!shortcutsOverlay.classList.contains('hidden')) {
      closeShortcuts();
    } else if (formPanel.classList.contains('open')) {
      closeForm();
    } else if (searchQuery) {
      searchInput.value = '';
      searchQuery = '';
      filterTag = null;
      focusedCardId = null;
      renderTasks();
    }
    return;
  }

  if (inInput) return;

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const cards = [...activeTasksEl.querySelectorAll('.task-card')];
    if (cards.length === 0) return;
    const currentIdx = focusedCardId ? cards.findIndex(c => c.dataset.id === focusedCardId) : -1;
    const nextIdx = e.key === 'ArrowDown'
      ? (currentIdx < cards.length - 1 ? currentIdx + 1 : 0)
      : (currentIdx > 0 ? currentIdx - 1 : cards.length - 1);
    cards.forEach(c => c.classList.remove('kbd-focus'));
    cards[nextIdx].classList.add('kbd-focus');
    focusedCardId = cards[nextIdx].dataset.id;
    cards[nextIdx].scrollIntoView({ block: 'nearest' });
    return;
  }

  if (e.key === ' ') {
    if (!focusedCardId) return;
    e.preventDefault();
    const task = tasks.find(t => t.id === focusedCardId);
    if (!task) return;
    pushUndo();
    if (!task.completed && task.repeat) {
      tasks = completeTask(tasks, focusedCardId);
      tasks = [...tasks, createRecurringInstance(task)];
    } else {
      tasks = task.completed ? uncompleteTask(tasks, focusedCardId) : completeTask(tasks, focusedCardId);
    }
    save(); renderTasks();
    return;
  }

  if (e.key === 'e' || e.key === 'E') {
    if (!focusedCardId) return;
    e.preventDefault();
    const task = tasks.find(t => t.id === focusedCardId);
    if (task && !task.completed) openEditForm(task);
    return;
  }

  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openAddForm(); }
  if (e.key === '/') { e.preventDefault(); searchInput.focus(); }
  if (e.key === '?') { e.preventDefault(); openShortcuts(); }
});

// ─── Habits ───────────────────────────────────────────────────────────────

let editingHabitId = null;
let selectedHabitColor = '#4a9eff';

function getHabitStreak(completions) {
  const today = new Date().toISOString().slice(0, 10);
  const set = new Set(completions);
  let streak = 0;
  const d = new Date(today + 'T00:00:00');
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

async function persistHabits() {
  await window.taskAPI.writeHabits(habits);
}

function renderHabits() {
  const listEl = document.getElementById('habits-list');
  const today = new Date().toISOString().slice(0, 10);
  if (!listEl) return;

  const total = habits.length;
  const done = habits.filter(h => h.completions.includes(today)).length;
  const labelEl = document.getElementById('habit-today-label');
  const fillEl = document.getElementById('habit-today-fill');
  if (labelEl) labelEl.textContent = 'Today: ' + done + ' / ' + total;
  if (fillEl) fillEl.style.width = total > 0 ? Math.round((done / total) * 100) + '%' : '0%';

  listEl.innerHTML = '';

  if (habits.length === 0) {
    const emp = document.createElement('div');
    emp.className = 'empty-state';
    emp.innerHTML = '<div class="empty-icon">&#x25C9;</div>No habits yet — click “+ Add Habit” to start.';
    listEl.appendChild(emp);
    return;
  }

  for (const habit of habits) {
    const doneToday = habit.completions.includes(today);
    const streak = getHabitStreak(habit.completions);

    const heatCells = [];
    for (let i = 27; i >= 0; i--) {
      const dd = new Date(today + 'T00:00:00');
      dd.setDate(dd.getDate() - i);
      const ds = dd.toISOString().slice(0, 10);
      const isDone = habit.completions.includes(ds);
      heatCells.push('<div class="habit-heat-cell' + (isDone ? ' done' : '') + '" style="' + (isDone ? 'background:' + escapeHtml(habit.color) : '') + '" title="' + ds + '"></div>');
    }

    const card = document.createElement('div');
    card.className = 'habit-card';
    card.innerHTML =
      '<div class="habit-card-main">' +
        '<div class="habit-color-dot" style="background:' + escapeHtml(habit.color) + '"></div>' +
        '<span class="habit-name">' + escapeHtml(habit.name) + '</span>' +
        '<span class="habit-streak' + (streak > 0 ? ' has-streak' : '') + '">🔥 ' + streak + ' day' + (streak !== 1 ? 's' : '') + '</span>' +
        '<label class="habit-checkbox-wrap" title="' + (doneToday ? 'Unmark today' : 'Mark done today') + '">' +
          '<input type="checkbox" class="habit-today-chk" data-id="' + escapeHtml(habit.id) + '"' + (doneToday ? ' checked' : '') + '>' +
          '<span class="habit-chk-custom" style="' + (doneToday ? 'background:' + escapeHtml(habit.color) + ';border-color:' + escapeHtml(habit.color) : '') + '"></span>' +
        '</label>' +
        '<button class="habit-action-btn" data-action="edit-habit" data-id="' + escapeHtml(habit.id) + '" title="Edit">&#x270E;</button>' +
        '<button class="habit-action-btn habit-del" data-action="delete-habit" data-id="' + escapeHtml(habit.id) + '" title="Delete">&#xD7;</button>' +
      '</div>' +
      '<div class="habit-heatmap">' + heatCells.join('') + '</div>';
    listEl.appendChild(card);
  }
}

function openAddHabitForm() {
  editingHabitId = null;
  selectedHabitColor = '#4a9eff';
  document.getElementById('habit-form-title').textContent = 'New Habit';
  document.getElementById('hf-name').value = '';
  updateHabitColorBtns();
  document.getElementById('habit-form-panel').classList.add('open');
  document.getElementById('hf-name').focus();
}

function openEditHabitForm(habit) {
  editingHabitId = habit.id;
  selectedHabitColor = habit.color;
  document.getElementById('habit-form-title').textContent = 'Edit Habit';
  document.getElementById('hf-name').value = habit.name;
  updateHabitColorBtns();
  document.getElementById('habit-form-panel').classList.add('open');
  document.getElementById('hf-name').focus();
}

function closeHabitForm() {
  document.getElementById('habit-form-panel').classList.remove('open');
  editingHabitId = null;
}

function updateHabitColorBtns() {
  document.querySelectorAll('.hf-color-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === selectedHabitColor);
  });
}

async function saveHabitForm() {
  const name = document.getElementById('hf-name').value.trim();
  if (!name) { document.getElementById('hf-name').focus(); return; }

  if (editingHabitId) {
    habits = habits.map(h => h.id === editingHabitId ? { ...h, name, color: selectedHabitColor } : h);
  } else {
    habits = [...habits, {
      id: crypto.randomUUID(),
      name,
      color: selectedHabitColor,
      frequency: 'daily',
      completions: [],
      createdAt: new Date().toISOString(),
    }];
  }

  await persistHabits();
  closeHabitForm();
  renderHabits();
}

function initHabitHandlers() {
  document.getElementById('add-habit-btn')?.addEventListener('click', openAddHabitForm);
  document.getElementById('hf-cancel')?.addEventListener('click', closeHabitForm);
  document.getElementById('hf-save')?.addEventListener('click', saveHabitForm);
  document.getElementById('hf-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveHabitForm();
    if (e.key === 'Escape') closeHabitForm();
  });

  document.getElementById('hf-colors')?.addEventListener('click', e => {
    const btn = e.target.closest('.hf-color-btn');
    if (!btn) return;
    selectedHabitColor = btn.dataset.color;
    updateHabitColorBtns();
  });

  document.getElementById('habits-list')?.addEventListener('click', async e => {
    const actionEl = e.target.closest('[data-action]');
    const action = actionEl?.dataset.action;
    const id = actionEl?.dataset.id;

    if (action === 'edit-habit') {
      const habit = habits.find(h => h.id === id);
      if (habit) openEditHabitForm(habit);
      return;
    }
    if (action === 'delete-habit') {
      habits = habits.filter(h => h.id !== id);
      await persistHabits();
      renderHabits();
      return;
    }

    const chk = e.target.closest('.habit-today-chk');
    if (chk) {
      const hid = chk.dataset.id;
      const today = new Date().toISOString().slice(0, 10);
      habits = habits.map(h => {
        if (h.id !== hid) return h;
        const completions = h.completions.includes(today)
          ? h.completions.filter(d => d !== today)
          : [...h.completions, today];
        return { ...h, completions };
      });
      await persistHabits();
      renderHabits();
    }
  });
}

// ─── Calendar ─────────────────────────────────────────────────────────────

function getWeekDates(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd.toISOString().slice(0, 10);
  });
}

function fmtCalTitle(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function renderCalendar() {
  const today = new Date().toISOString().slice(0, 10);
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am-10pm
  const dates = calendarMode === 'day' ? [calendarDate] : getWeekDates(calendarDate);

  const titleEl = document.getElementById('cal-title');
  if (titleEl) {
    titleEl.textContent = calendarMode === 'day'
      ? fmtCalTitle(calendarDate)
      : 'Week of ' + fmtCalTitle(dates[0]);
  }

  // All-day row
  const alldayEl = document.getElementById('cal-allday-content');
  if (alldayEl) {
    alldayEl.innerHTML = '';
    alldayEl.style.gridTemplateColumns = 'repeat(' + dates.length + ', 1fr)';
    for (const date of dates) {
      const cell = document.createElement('div');
      cell.className = 'cal-allday-cell';
      const dayTasks = tasks.filter(t => !t.completed && t.dueDate === date && !t.time);
      for (const t of dayTasks) {
        const chip = document.createElement('div');
        chip.className = 'cal-chip cal-chip-' + t.priority;
        chip.textContent = t.title;
        chip.title = t.title;
        chip.addEventListener('click', () => { openEditForm(t); switchView('task'); });
        cell.appendChild(chip);
      }
      alldayEl.appendChild(cell);
    }
  }

  // Time grid
  const gridEl = document.getElementById('cal-time-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = '52px repeat(' + dates.length + ', 1fr)';

  // Day headers row
  const corner = document.createElement('div');
  corner.className = 'cal-corner';
  gridEl.appendChild(corner);
  for (const date of dates) {
    const hdr = document.createElement('div');
    hdr.className = 'cal-day-header' + (date === today ? ' is-today' : '');
    const d = new Date(date + 'T00:00:00');
    const nameEl = document.createElement('span');
    nameEl.textContent = dayNames[d.getDay()];
    const numEl = document.createElement('span');
    numEl.className = 'cal-day-num';
    numEl.textContent = d.getDate();
    hdr.appendChild(nameEl);
    hdr.appendChild(numEl);
    gridEl.appendChild(hdr);
  }

  // Hour rows
  for (const hour of HOURS) {
    const h12 = hour % 12 || 12;
    const ampm = hour < 12 ? 'am' : 'pm';
    const lbl = document.createElement('div');
    lbl.className = 'cal-time-label';
    lbl.textContent = h12 + ampm;
    gridEl.appendChild(lbl);

    for (const date of dates) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell' + (date === today ? ' is-today-col' : '');
      cell.addEventListener('click', () => {
        const timeStr = String(hour).padStart(2, '0') + ':00';
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.tab[data-category="today"]')?.classList.add('active');
        activeCategory = 'today';
        switchView('task');
        openAddForm({ date, time: timeStr });
      });

      const hourTasks = tasks.filter(t => {
        if (t.completed || t.dueDate !== date || !t.time) return false;
        return parseInt(t.time.split(':')[0], 10) === hour;
      });
      for (const t of hourTasks) {
        const block = document.createElement('div');
        block.className = 'cal-task-block cal-block-' + t.priority;
        const timeSpan = '<span class="cal-block-time">' + escapeHtml(t.time) + '</span>';
        const titleSpan = '<span class="cal-block-title">' + escapeHtml(t.title) + '</span>';
        const estSpan = t.estimate ? '<span class="cal-block-est">' + escapeHtml(formatEstimate(t.estimate)) + '</span>' : '';
        block.innerHTML = timeSpan + titleSpan + estSpan;
        block.addEventListener('click', e => {
          e.stopPropagation();
          openEditForm(t);
          switchView('task');
        });
        cell.appendChild(block);
      }
      gridEl.appendChild(cell);
    }
  }
}

function initCalendarHandlers() {
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    const d = new Date(calendarDate + 'T00:00:00');
    d.setDate(d.getDate() - (calendarMode === 'week' ? 7 : 1));
    calendarDate = d.toISOString().slice(0, 10);
    renderCalendar();
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    const d = new Date(calendarDate + 'T00:00:00');
    d.setDate(d.getDate() + (calendarMode === 'week' ? 7 : 1));
    calendarDate = d.toISOString().slice(0, 10);
    renderCalendar();
  });
  document.getElementById('cal-today-btn')?.addEventListener('click', () => {
    calendarDate = new Date().toISOString().slice(0, 10);
    renderCalendar();
  });
  document.getElementById('cal-day-btn')?.addEventListener('click', () => {
    calendarMode = 'day';
    document.getElementById('cal-day-btn').classList.add('active');
    document.getElementById('cal-week-btn').classList.remove('active');
    renderCalendar();
  });
  document.getElementById('cal-week-btn')?.addEventListener('click', () => {
    calendarMode = 'week';
    document.getElementById('cal-week-btn').classList.add('active');
    document.getElementById('cal-day-btn').classList.remove('active');
    renderCalendar();
  });
}
