const {
  createTask,
  completeTask,
  uncompleteTask,
  deleteTask,
  updateTask,
  getActive,
  getCompleted,
  getUpcoming,
  rolloverTasks,
  getNextDueDate,
  createRecurringInstance,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
} = require('../src/tasks');

describe('createTask', () => {
  test('creates task with required fields and defaults', () => {
    const t = createTask({ title: 'Fix bug', category: 'today', priority: 'high' });
    expect(t.title).toBe('Fix bug');
    expect(t.category).toBe('today');
    expect(t.priority).toBe('high');
    expect(t.dueDate).toBeNull();
    expect(t.notes).toBe('');
    expect(t.completed).toBe(false);
    expect(t.completedAt).toBeNull();
    expect(t.subtasks).toEqual([]);
    expect(typeof t.id).toBe('string');
    expect(t.id.length).toBeGreaterThan(0);
    expect(typeof t.createdAt).toBe('string');
  });

  test('uses provided dueDate and notes', () => {
    const t = createTask({ title: 'T', category: 'backlog', priority: 'low', dueDate: '2026-11-01', notes: 'context' });
    expect(t.dueDate).toBe('2026-11-01');
    expect(t.notes).toBe('context');
  });
});

describe('completeTask', () => {
  test('marks task completed with timestamp', () => {
    const tasks = [createTask({ title: 'A', category: 'today', priority: 'medium' })];
    const result = completeTask(tasks, tasks[0].id);
    expect(result[0].completed).toBe(true);
    expect(typeof result[0].completedAt).toBe('string');
  });

  test('does not mutate original array', () => {
    const tasks = [createTask({ title: 'A', category: 'today', priority: 'medium' })];
    completeTask(tasks, tasks[0].id);
    expect(tasks[0].completed).toBe(false);
  });

  test('returns unchanged array if id not found', () => {
    const tasks = [createTask({ title: 'A', category: 'today', priority: 'medium' })];
    const result = completeTask(tasks, 'nonexistent');
    expect(result[0].completed).toBe(false);
  });
});

describe('uncompleteTask', () => {
  test('marks task not completed and clears timestamp', () => {
    const tasks = [createTask({ title: 'A', category: 'today', priority: 'medium' })];
    const completed = completeTask(tasks, tasks[0].id);
    const result = uncompleteTask(completed, completed[0].id);
    expect(result[0].completed).toBe(false);
    expect(result[0].completedAt).toBeNull();
  });
});

describe('deleteTask', () => {
  test('removes task by id', () => {
    const t1 = createTask({ title: 'A', category: 'today', priority: 'low' });
    const t2 = createTask({ title: 'B', category: 'today', priority: 'low' });
    const result = deleteTask([t1, t2], t1.id);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('B');
  });

  test('returns unchanged array if id not found', () => {
    const tasks = [createTask({ title: 'A', category: 'today', priority: 'low' })];
    expect(deleteTask(tasks, 'nope')).toHaveLength(1);
  });
});

describe('updateTask', () => {
  test('updates specified fields without mutating', () => {
    const tasks = [createTask({ title: 'A', category: 'today', priority: 'low' })];
    const result = updateTask(tasks, tasks[0].id, { title: 'Updated', priority: 'high' });
    expect(result[0].title).toBe('Updated');
    expect(result[0].priority).toBe('high');
    expect(result[0].category).toBe('today');
    expect(tasks[0].title).toBe('A');
  });
});

describe('getActive', () => {
  test('returns only incomplete tasks for given category', () => {
    const t1 = createTask({ title: 'A', category: 'today', priority: 'low' });
    const t2 = createTask({ title: 'B', category: 'today', priority: 'low' });
    const t3 = createTask({ title: 'C', category: 'thisweek', priority: 'low' });
    const updated = completeTask([t1, t2, t3], t1.id);
    const result = getActive(updated, 'today');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('B');
  });
});

describe('getCompleted', () => {
  test('returns only completed tasks for given category', () => {
    const t1 = createTask({ title: 'A', category: 'today', priority: 'low' });
    const t2 = createTask({ title: 'B', category: 'today', priority: 'low' });
    const updated = completeTask([t1, t2], t1.id);
    const result = getCompleted(updated, 'today');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
  });
});

describe('getUpcoming', () => {
  test('returns incomplete tasks with dueDate in the future, sorted ascending', () => {
    const t1 = createTask({ title: 'Far', category: 'thisweek', priority: 'low', dueDate: '2030-01-15' });
    const t2 = createTask({ title: 'Near', category: 'today', priority: 'low', dueDate: '2030-01-01' });
    const t3 = createTask({ title: 'Past', category: 'backlog', priority: 'low', dueDate: '2020-01-01' });
    const t4 = createTask({ title: 'NoDue', category: 'today', priority: 'low' });
    const result = getUpcoming([t1, t2, t3, t4], '2026-10-23');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Near');
    expect(result[1].title).toBe('Far');
  });

  test('excludes completed tasks', () => {
    const t = createTask({ title: 'A', category: 'today', priority: 'low', dueDate: '2030-01-01' });
    const done = completeTask([t], t.id);
    expect(getUpcoming(done, '2026-10-23')).toHaveLength(0);
  });

  test('returns empty array when no upcoming tasks', () => {
    expect(getUpcoming([], '2026-10-23')).toHaveLength(0);
  });
});

describe('rolloverTasks', () => {
  test('moves overdue non-today tasks to today', () => {
    const t = createTask({ title: 'Old', category: 'thisweek', priority: 'low', dueDate: '2026-10-01' });
    const result = rolloverTasks([t], '2026-10-23');
    expect(result[0].category).toBe('today');
  });

  test('does not move today tasks', () => {
    const t = createTask({ title: 'A', category: 'today', priority: 'low', dueDate: '2026-10-01' });
    const result = rolloverTasks([t], '2026-10-23');
    expect(result[0].category).toBe('today');
  });

  test('does not move completed tasks', () => {
    const t = createTask({ title: 'A', category: 'backlog', priority: 'low', dueDate: '2026-10-01' });
    const done = completeTask([t], t.id);
    const result = rolloverTasks(done, '2026-10-23');
    expect(result[0].category).toBe('backlog');
  });

  test('does not move tasks with no due date', () => {
    const t = createTask({ title: 'A', category: 'backlog', priority: 'low' });
    const result = rolloverTasks([t], '2026-10-23');
    expect(result[0].category).toBe('backlog');
  });

  test('does not move tasks with future due date', () => {
    const t = createTask({ title: 'A', category: 'thisweek', priority: 'low', dueDate: '2030-01-01' });
    const result = rolloverTasks([t], '2026-10-23');
    expect(result[0].category).toBe('thisweek');
  });

  test('moves task due exactly today', () => {
    const t = createTask({ title: 'A', category: 'backlog', priority: 'low', dueDate: '2026-10-23' });
    const result = rolloverTasks([t], '2026-10-23');
    expect(result[0].category).toBe('today');
  });

  test('does not mutate original tasks', () => {
    const t = createTask({ title: 'A', category: 'thisweek', priority: 'low', dueDate: '2026-10-01' });
    const original = [t];
    rolloverTasks(original, '2026-10-23');
    expect(original[0].category).toBe('thisweek');
  });
});

describe('getNextDueDate', () => {
  test('adds 1 day for daily', () => {
    expect(getNextDueDate('2026-10-23', 'daily')).toBe('2026-10-24');
  });

  test('adds 7 days for weekly', () => {
    expect(getNextDueDate('2026-10-23', 'weekly')).toBe('2026-10-30');
  });

  test('adds 1 month for monthly', () => {
    expect(getNextDueDate('2026-10-23', 'monthly')).toBe('2026-11-23');
  });

  test('handles month rollover for daily', () => {
    expect(getNextDueDate('2026-10-31', 'daily')).toBe('2026-11-01');
  });
});

describe('createRecurringInstance', () => {
  test('creates new task with next due date and same repeat', () => {
    const t = createTask({ title: 'Stand-up', category: 'today', priority: 'high', dueDate: '2026-10-23', repeat: 'daily' });
    const next = createRecurringInstance(t);
    expect(next.title).toBe('Stand-up');
    expect(next.dueDate).toBe('2026-10-24');
    expect(next.repeat).toBe('daily');
    expect(next.completed).toBe(false);
    expect(next.id).not.toBe(t.id);
  });

  test('preserves category and priority', () => {
    const t = createTask({ title: 'A', category: 'thisweek', priority: 'medium', dueDate: '2026-10-23', repeat: 'weekly' });
    const next = createRecurringInstance(t);
    expect(next.category).toBe('thisweek');
    expect(next.priority).toBe('medium');
  });
});

describe('addSubtask', () => {
  test('adds a subtask to the correct task', () => {
    const t = createTask({ title: 'A', category: 'today', priority: 'low' });
    const result = addSubtask([t], t.id, 'Step 1');
    expect(result[0].subtasks).toHaveLength(1);
    expect(result[0].subtasks[0].title).toBe('Step 1');
    expect(result[0].subtasks[0].completed).toBe(false);
    expect(typeof result[0].subtasks[0].id).toBe('string');
  });

  test('does not mutate other tasks', () => {
    const t1 = createTask({ title: 'A', category: 'today', priority: 'low' });
    const t2 = createTask({ title: 'B', category: 'today', priority: 'low' });
    const result = addSubtask([t1, t2], t1.id, 'Step 1');
    expect(result[1].subtasks).toHaveLength(0);
  });
});

describe('toggleSubtask', () => {
  test('toggles subtask completed state', () => {
    const t = createTask({ title: 'A', category: 'today', priority: 'low' });
    const withSub = addSubtask([t], t.id, 'Step 1');
    const subId = withSub[0].subtasks[0].id;
    const toggled = toggleSubtask(withSub, t.id, subId);
    expect(toggled[0].subtasks[0].completed).toBe(true);
    const toggled2 = toggleSubtask(toggled, t.id, subId);
    expect(toggled2[0].subtasks[0].completed).toBe(false);
  });
});

describe('deleteSubtask', () => {
  test('removes the correct subtask', () => {
    const t = createTask({ title: 'A', category: 'today', priority: 'low' });
    let tasks = addSubtask([t], t.id, 'Step 1');
    tasks = addSubtask(tasks, t.id, 'Step 2');
    const subId = tasks[0].subtasks[0].id;
    const result = deleteSubtask(tasks, t.id, subId);
    expect(result[0].subtasks).toHaveLength(1);
    expect(result[0].subtasks[0].title).toBe('Step 2');
  });
});
