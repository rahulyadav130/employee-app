const form = document.getElementById('employee-form');
const message = document.getElementById('form-message');
const submitBtn = document.getElementById('submit-btn');
const rows = document.getElementById('employee-rows');
const countEl = document.getElementById('count');

// Escape user-provided text before inserting it into HTML (prevents XSS)
function esc(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function showMessage(text, isError) {
  message.textContent = text;
  message.className = isError ? 'error' : 'success';
}

async function loadDepartments() {
  const res = await fetch('/api/config');
  const { departments } = await res.json();
  const select = form.elements.department;
  departments.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
}

async function loadEmployees() {
  try {
    const res = await fetch('/api/employees');
    if (!res.ok) throw new Error('Failed to load employees');
    const employees = await res.json();
    countEl.textContent = `(${employees.length})`;

    if (employees.length === 0) {
      rows.innerHTML = '<tr><td colspan="7" class="muted">No employees yet.</td></tr>';
      return;
    }

    rows.innerHTML = employees.map((e) => `
      <tr>
        <td>${esc(e.first_name)} ${esc(e.last_name)}</td>
        <td>${esc(e.email)}</td>
        <td>${esc(e.phone)}</td>
        <td>${esc(e.department)}</td>
        <td>${esc(e.designation)}</td>
        <td>${esc(e.date_of_joining)}</td>
        <td><button class="danger" data-id="${Number(e.id)}">Delete</button></td>
      </tr>`).join('');
  } catch (err) {
    rows.innerHTML = `<tr><td colspan="7" class="error">${esc(err.message)}</td></tr>`;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  showMessage('Saving...', false);

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      showMessage((body.errors || ['Save failed.']).join(' '), true);
      return;
    }

    showMessage(`Saved ${body.first_name} ${body.last_name} (ID ${body.id}).`, false);
    form.reset();
    loadEmployees();
  } catch (err) {
    showMessage('Network error. Is the server running?', true);
  } finally {
    submitBtn.disabled = false;
  }
});

rows.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;
  if (!confirm('Delete this employee?')) return;

  const res = await fetch(`/api/employees/${button.dataset.id}`, { method: 'DELETE' });
  if (res.ok) {
    loadEmployees();
  } else {
    showMessage('Could not delete the employee.', true);
  }
});

loadDepartments();
loadEmployees();
