let tasks = [];
let activeCategory = 'today';
let editingId = null;
let completedOpen = false;
let searchQuery = '';

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
const searchInput = document.getElementById('search-input');

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
  return { today: 'Today', thisweek: 'This Week', backlog: 'Backlog' }[cat] || cat;
}

function renderTaskCard(task, { showCategory = false } = {}) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;

  const due = task.dueDate ? `<span class="task-due">${escapeHtml(task.dueDate)}</span>` : '';
  const catBadge = showCategory ? `<span class="task-cat">${escapeHtml(categoryLabel(task.category))}</span>` : '';
  const repeatBadge = task.repeat ? `<span class="task-repeat">↻ ${task.repeat}</span>` : '';
  const completedDate = task.completed && task.completedAt
    ? `<span class="completed-date">Done ${task.completedAt.slice(0, 10)}</span>` : '';

  card.innerHTML = `
    <div class="task-header">
      <div class="task-checkbox" data-action="toggle"></div>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="priority-badge priority-${task.priority}">${priorityLabel(task.priority)}</span>
      ${catBadge}${due}${repeatBadge}
    </div>
    <div class="task-body">
      ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ''}
      <div class="task-actions">
        <button data-action="edit">Edit</button>
        <button data-action="delete" class="btn-delete">Delete</button>
        ${completedDate}
      </div>
    </div>
  `;
  return card;
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

  activeTasksEl.innerHTML = '';
  if (active.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'empty-state';
    if (searchQuery) {
      emptyEl.textContent = 'No tasks match your search.';
    } else if (activeCategory === 'upcoming') {
      emptyEl.textContent = 'No upcoming tasks with due dates.';
    } else {
      emptyEl.textContent = 'No tasks here — press N to add one.';
    }
    activeTasksEl.appendChild(emptyEl);
  } else {
    active.forEach(t => activeTasksEl.appendChild(renderTaskCard(t, { showCategory: showCat })));
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

  updateTabBadges();
}

function updateTabBadges() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('.tab').forEach(tab => {
    const badge = tab.querySelector('.tab-badge');
    if (!badge) return;
    const cat = tab.dataset.category;
    const count = cat === 'upcoming'
      ? getUpcoming(tasks, today).length
      : getActive(tasks, cat).length;
    badge.textContent = count > 0 ? count : '';
  });
}

async function save() {
  await window.taskAPI.writeTasks(tasks);
}

async function init() {
  tasks = await window.taskAPI.readTasks();
  renderTasks();
}

init();

document.getElementById('tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeCategory = tab.dataset.category;
  completedOpen = false;
  searchInput.value = '';
  searchQuery = '';
  renderTasks();
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
  renderTasks();
});

function openAddForm() {
  editingId = null;
  formTitle.textContent = 'New Task';
  fTitle.value = '';
  fCategory.value = activeCategory === 'upcoming' ? 'today' : activeCategory;
  fPriority.value = 'medium';
  fDue.value = '';
  fRepeat.value = '';
  fNotes.value = '';
  formPanel.classList.remove('hidden');
  fTitle.focus();
}

function openEditForm(task) {
  editingId = task.id;
  formTitle.textContent = 'Edit Task';
  fTitle.value = task.title;
  fCategory.value = task.category;
  fPriority.value = task.priority;
  fDue.value = task.dueDate || '';
  fRepeat.value = task.repeat || '';
  fNotes.value = task.notes || '';
  formPanel.classList.remove('hidden');
  fTitle.focus();
}

function closeForm() {
  formPanel.classList.add('hidden');
  editingId = null;
}

async function saveForm() {
  const title = fTitle.value.trim();
  if (!title) { fTitle.focus(); return; }

  if (editingId) {
    tasks = updateTask(tasks, editingId, {
      title,
      category: fCategory.value,
      priority: fPriority.value,
      dueDate: fDue.value || null,
      repeat: fRepeat.value || null,
      notes: fNotes.value,
    });
  } else {
    const task = createTask({
      title,
      category: fCategory.value,
      priority: fPriority.value,
      dueDate: fDue.value || null,
      repeat: fRepeat.value || null,
      notes: fNotes.value,
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
  renderTasks();
}

document.getElementById('add-btn').addEventListener('click', openAddForm);
document.getElementById('form-cancel').addEventListener('click', closeForm);
document.getElementById('form-save').addEventListener('click', saveForm);
fTitle.addEventListener('keydown', e => { if (e.key === 'Enter') saveForm(); });

function handleTaskAction(e) {
  const action = e.target.dataset.action;
  if (!action) return;
  const card = e.target.closest('.task-card');
  if (!card) return;
  const id = card.dataset.id;

  if (action === 'toggle') {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (!task.completed && task.repeat) {
      tasks = completeTask(tasks, id);
      tasks = [...tasks, createRecurringInstance(task)];
    } else {
      tasks = task.completed ? uncompleteTask(tasks, id) : completeTask(tasks, id);
    }
    save();
    renderTasks();
    return;
  }

  if (action === 'delete') {
    if (card.dataset.confirming === 'true') {
      tasks = deleteTask(tasks, id);
      save();
      renderTasks();
    } else {
      card.dataset.confirming = 'true';
      const actionsEl = card.querySelector('.task-actions');
      actionsEl.innerHTML = `
        <span class="delete-confirm-msg">Delete this task?</span>
        <button data-action="delete">Yes, delete</button>
        <button data-action="cancel-delete">Cancel</button>
      `;
    }
    return;
  }

  if (action === 'cancel-delete') {
    const task = tasks.find(t => t.id === id);
    if (task) card.replaceWith(renderTaskCard(task, { showCategory: !!searchQuery }));
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
  const body = header.nextElementSibling;
  if (body && body.classList.contains('task-body')) {
    body.classList.toggle('open');
  }
}

activeTasksEl.addEventListener('click', e => { handleTaskAction(e); handleTaskExpand(e); });
completedTasksEl.addEventListener('click', e => { handleTaskAction(e); handleTaskExpand(e); });

document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.key === 'Escape') {
    if (!formPanel.classList.contains('hidden')) {
      closeForm();
    } else if (searchQuery) {
      searchInput.value = '';
      searchQuery = '';
      renderTasks();
    }
    return;
  }

  if (inInput) return;

  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openAddForm(); }
  if (e.key === '/') { e.preventDefault(); searchInput.focus(); }
});
