function createTask({ title, category, priority, dueDate = null, notes = '', repeat = null, estimate = null, pinned = false, tags = [], time = null }) {
  return {
    id: crypto.randomUUID(),
    title,
    category,
    priority,
    dueDate,
    time,
    notes,
    repeat,
    estimate,
    pinned,
    tags,
    subtasks: [],
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function addSubtask(tasks, taskId, title) {
  return tasks.map(t => t.id !== taskId ? t : {
    ...t,
    subtasks: [...(t.subtasks || []), { id: crypto.randomUUID(), title, completed: false }],
  });
}

function toggleSubtask(tasks, taskId, subtaskId) {
  return tasks.map(t => t.id !== taskId ? t : {
    ...t,
    subtasks: (t.subtasks || []).map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s),
  });
}

function deleteSubtask(tasks, taskId, subtaskId) {
  return tasks.map(t => t.id !== taskId ? t : {
    ...t,
    subtasks: (t.subtasks || []).filter(s => s.id !== subtaskId),
  });
}

function completeTask(tasks, id) {
  return tasks.map(t =>
    t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t
  );
}

function uncompleteTask(tasks, id) {
  return tasks.map(t =>
    t.id === id ? { ...t, completed: false, completedAt: null } : t
  );
}

function deleteTask(tasks, id) {
  return tasks.filter(t => t.id !== id);
}

function updateTask(tasks, id, fields) {
  return tasks.map(t => t.id === id ? { ...t, ...fields } : t);
}

function getActive(tasks, category) {
  return tasks.filter(t => t.category === category && !t.completed);
}

function getCompleted(tasks, category) {
  return tasks.filter(t => t.category === category && t.completed);
}

function getUpcoming(tasks, today) {
  return tasks
    .filter(t => !t.completed && t.dueDate && t.dueDate > today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function rolloverTasks(tasks, today) {
  return tasks.map(t => {
    if (!t.completed && t.dueDate && t.dueDate <= today && t.category !== 'today') {
      return { ...t, category: 'today' };
    }
    return t;
  });
}

function getNextDueDate(dueDate, repeat) {
  const base = dueDate ? new Date(dueDate + 'T00:00:00') : new Date();
  if (repeat === 'daily') base.setDate(base.getDate() + 1);
  else if (repeat === 'weekly') base.setDate(base.getDate() + 7);
  else if (repeat === 'monthly') base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 10);
}

function createRecurringInstance(task) {
  return createTask({
    title: task.title,
    category: task.category,
    priority: task.priority,
    dueDate: getNextDueDate(task.dueDate, task.repeat),
    notes: task.notes,
    repeat: task.repeat,
  });
}

if (typeof module !== 'undefined') {
  module.exports = { createTask, completeTask, uncompleteTask, deleteTask, updateTask, getActive, getCompleted, getUpcoming, rolloverTasks, getNextDueDate, createRecurringInstance, addSubtask, toggleSubtask, deleteSubtask };
}
