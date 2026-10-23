function createTask({ title, category, priority, dueDate = null, notes = '' }) {
  return {
    id: crypto.randomUUID(),
    title,
    category,
    priority,
    dueDate,
    notes,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
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

if (typeof module !== 'undefined') {
  module.exports = { createTask, completeTask, uncompleteTask, deleteTask, updateTask, getActive, getCompleted, getUpcoming, rolloverTasks };
}
