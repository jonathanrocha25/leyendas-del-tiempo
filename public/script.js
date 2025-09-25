document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ced = (document.getElementById('cedula').value || '').trim();
    if (!/^\d{5,}$/.test(ced)) {
      alert('Por favor ingresa una cédula válida (solo números).');
      return;
    }
    window.location.href = `/empleado/${ced}`;
  });
});
