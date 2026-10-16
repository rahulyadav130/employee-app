// Server-side validation. Never trust the browser alone: the front-end
// checks are for user experience, this is the real safety net.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9 ()-]{7,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DEPARTMENTS = ['Engineering', 'DevOps', 'Human Resources', 'Finance', 'Sales', 'Marketing', 'Operations'];

function validateEmployee(input) {
  const errors = [];
  const data = {
    first_name: String(input.first_name || '').trim(),
    last_name: String(input.last_name || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    phone: String(input.phone || '').trim(),
    department: String(input.department || '').trim(),
    designation: String(input.designation || '').trim(),
    date_of_joining: String(input.date_of_joining || '').trim(),
  };

  if (!data.first_name || data.first_name.length > 80) errors.push('First name is required (max 80 characters).');
  if (!data.last_name || data.last_name.length > 80) errors.push('Last name is required (max 80 characters).');
  if (!EMAIL_RE.test(data.email) || data.email.length > 190) errors.push('A valid email is required.');
  if (data.phone && !PHONE_RE.test(data.phone)) errors.push('Phone number format is invalid.');
  if (!DEPARTMENTS.includes(data.department)) errors.push('Please select a valid department.');
  if (!data.designation || data.designation.length > 120) errors.push('Designation is required (max 120 characters).');
  if (!DATE_RE.test(data.date_of_joining) || Number.isNaN(Date.parse(data.date_of_joining))) {
    errors.push('Date of joining must be a valid date (YYYY-MM-DD).');
  }

  return { errors, data };
}

module.exports = { validateEmployee, DEPARTMENTS };
