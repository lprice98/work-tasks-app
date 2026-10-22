let tasks = [];
let activeCategory = 'today';
let editingId = null;
let completedOpen = false;

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
const fNotes = document.getElementById('f-notes');

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

function renderTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');
  card.dataset.id = task.id;

  const due = task.dueDate ? `<span class="task-due">${escapeHtml(task.dueDate)}</span>` : '';
  const completedDate = task.completed && task.completedAt
    ? `<span class="completed-date">Done ${task.completedAt.slice(0, 10)}</span>` : '';

  card.innerHTML = `
    <div class="task-header">
      <div class="task-checkbox" data-action="toggle"></div>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="priority-badge priority-${task.priority}">${priorityLabel(task.priority)}</span>
      ${due}
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
  const active = getActive(tasks, activeCategory);
  const completed = getCompleted(tasks, activeCategory);

  activeTasksEl.innerHTML = '';
  active.forEach(t => activeTasksEl.appendChild(renderTaskCard(t)));

  completedTasksEl.innerHTML = '';
  completed.forEach(t => completedTasksEl.appendChild(renderTaskCard(t)));

  completedCountEl.textContent = completed.length;
  if (completed.length > 0) {
    completedSectionEl.classList.remove('hidden');
  } else {
    completedSectionEl.classList.add('hidden');
    completedOpen = false;
  }
  completedTasksEl.classList.toggle('hidden', !completedOpen);
  completedToggleEl.textContent = `${completedOpen ? '▼' : '▶'} Completed (${completed.length})`;
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
  renderTasks();
});

completedToggleEl.addEventListener('click', () => {
  completedOpen = !completedOpen;
  completedTasksEl.classList.toggle('hidden', !completedOpen);
  completedToggleEl.textContent = `${completedOpen ? '▼' : '▶'} Completed (${getCompleted(tasks, activeCategory).length})`;
});

function openAddForm() {
  editingId = null;
  formTitle.textContent = 'New Task';
  fTitle.value = '';
  fCategory.value = activeCategory;
  fPriority.value = 'medium';
  fDue.value = '';
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
      notes: fNotes.value,
    });
  } else {
    const task = createTask({
      title,
      category: fCategory.value,
      priority: fPriority.value,
      dueDate: fDue.value || null,
      notes: fNotes.value,
    });
    tasks = [...tasks, task];
  }

  await save();
  activeCategory = fCategory.value;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.category === activeCategory);
  });
  closeForm();
  renderTasks();
}

document.getElementById('add-btn').addEventListener('click', openAddForm);
document.getElementById('form-cancel').addEventListener('click', closeForm);
document.getElementById('form-save').addEventListener('click', saveForm);
fTitle.addEventListener('keydown', e => { if (e.key === 'Enter') saveForm(); });
