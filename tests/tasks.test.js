const {
  createTask,
  completeTask,
  uncompleteTask,
  deleteTask,
  updateTask,
  getActive,
  getCompleted,
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
