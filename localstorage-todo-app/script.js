const STORAGE_KEY = 'todos';
let todos = [];

function loadTodos() {
    const stored = localStorage.getItem(STORAGE_KEY);
    todos = stored ? JSON.parse(stored) : [];
    renderTodos();
}

function saveTodos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function renderTodos() {
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = '';

    if (todos.length === 0) {
        todoList.innerHTML = '<p class="empty-message">No tasks yet. Add one above!</p>';
        return;
    }

    todos.forEach((todo, index) => {
        const taskElement = document.createElement('div');
        taskElement.className = 'task';
        taskElement.innerHTML = `
            <div class="task-content">
                <div class="task-title">${todo.title}</div>
                ${todo.description ? `<div class="task-description">${todo.description}</div>` : ''}
            </div>
            <button class="delete-btn" data-index="${index}">Delete</button>
        `;
        todoList.appendChild(taskElement);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            deleteTodo(index);
        });
    });
}

function addTodo(title, description) {
    const todo = {
        id: Date.now(),
        title: title,
        description: description
    };
    todos.push(todo);
    saveTodos();
    renderTodos();
}

function deleteTodo(index) {
    todos.splice(index, 1);
    saveTodos();
    renderTodos();
}

document.addEventListener('DOMContentLoaded', loadTodos);

document.getElementById('todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('todo-title');
    const descriptionInput = document.getElementById('todo-description');
    
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (title) {
        addTodo(title, description);
        titleInput.value = '';
        descriptionInput.value = '';
    }
});