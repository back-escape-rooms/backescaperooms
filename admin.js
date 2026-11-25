'use strict';

const sesion = DB.getSesion();
if (!sesion || sesion.rol !== 'admin') {
  window.location.href = 'acceso.html';
}

document.getElementById('adminNombreBadge').textContent = `Admin: ${sesion.nombre}`;
document.getElementById('btnLogout').addEventListener('click', (e) => {
  e.preventDefault();
  DB.logout();
});

const alertaAdmin = document.getElementById('alertaAdmin');
function notificar(texto, exito = true) {
  alertaAdmin.textContent = texto;
  alertaAdmin.className = 'respuesta ' + (exito ? 'ok' : 'fallo');
  alertaAdmin.hidden = false;
}

function renderSalas() {
  const salas = DB.getSalas();
  const tbody = document.getElementById('tbodySalas');
  const selectCita = document.getElementById('citaSala');
  const selectRep = document.getElementById('repSala');

  tbody.innerHTML = '';
  selectCita.innerHTML = '';
  selectRep.innerHTML = '';

  salas.forEach((sala) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${sala.codigo}</code></td>
      <td><strong>${sala.nombre}</strong></td>
      <td><span class="estado-pill estado-${sala.estado}">${sala.estado}</span></td>
      <td>
        <select class="select-estado">
          <option value="disponible" ${sala.estado === 'disponible' ? 'selected' : ''}>Disponible</option>
          <option value="mantenimiento" ${sala.estado === 'mantenimiento' ? 'selected' : ''}>En mantenimiento</option>
          <option value="cerrada" ${sala.estado === 'cerrada' ? 'selected' : ''}>Cerrada</option>
        </select>
      </td>
      <td><input type="number" class="input-precio" step="10" min="100" value="${sala.precio}" style="width:110px;"></td>
      <td><button type="button" class="btn-mini btn-guardar">Guardar</button></td>
    `;

    tr.querySelector('.btn-guardar').addEventListener('click', () => {
      const nuevoEstado = tr.querySelector('.select-estado').value;
      const nuevoPrecio = tr.querySelector('.input-precio').value;
      const res = DB.actualizarSala(sala.id, nuevoEstado, nuevoPrecio);
      notificar(res.mensaje, res.exito);
      renderSalas();
    });

    tbody.appendChild(tr);

    const opt1 = new Option(`${sala.nombre} (${sala.estado})`, sala.id);
    const opt2 = new Option(sala.nombre, sala.id);
    selectCita.add(opt1);
    selectRep.add(opt2);
  });
}

function renderClientes() {
  const selectCliente = document.getElementById('selectCliente');
  DB.getUsuarios()
    .filter((u) => u.rol === 'cliente')
    .forEach((cli) => {
      const opt = new Option(`${cli.nombre} (${cli.correo})`, cli.id);
      opt.dataset.nombre = cli.nombre;
      opt.dataset.correo = cli.correo;
      selectCliente.add(opt);
    });

  selectCliente.addEventListener('change', () => {
    const opt = selectCliente.selectedOptions[0];
    if (opt && opt.value !== '') {
      document.getElementById('citaNombre').value = opt.dataset.nombre || '';
      document.getElementById('citaCorreo').value = opt.dataset.correo || '';
    }
  });
}

function renderCitas() {
  const citas = DB.getCitas();
  const salasMap = Object.fromEntries(DB.getSalas().map((s) => [s.id, s.nombre]));
  const tbody = document.getElementById('tbodyCitas');

  if (citas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--gris);">Aún no hay citas registradas.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  citas.forEach((cita) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${cita.id}</td>
      <td><strong>${cita.cliente_nombre}</strong><br><small style="color:var(--gris);">${cita.cliente_correo}</small></td>
      <td>${salasMap[cita.sala_id] || cita.sala_id}</td>
      <td>${cita.fecha_cita} a las ${cita.hora_cita} hrs</td>
      <td>${cita.personas} pers.</td>
      <td><span class="estado-pill estado-${cita.estado_cita}">${cita.estado_cita}</span></td>
      <td>
        <button type="button" class="btn-mini btn-conf">Confirmar</button>
        <button type="button" class="btn-mini btn-rep">Reprogramar</button>
        <button type="button" class="btn-mini peligro btn-canc">Cancelar</button>
      </td>
    `;

    tr.querySelector('.btn-conf').addEventListener('click', () => {
      const res = DB.cambiarEstadoCita(cita.id, 'confirmada');
      notificar(res.mensaje, true);
      renderCitas();
    });

    tr.querySelector('.btn-canc').addEventListener('click', () => {
      const res = DB.cambiarEstadoCita(cita.id, 'cancelada');
      notificar(res.mensaje, true);
      renderCitas();
    });

    tr.querySelector('.btn-rep').addEventListener('click', () => {
      document.getElementById('repCitaId').value = cita.id;
      document.getElementById('repSala').value = cita.sala_id;
      document.getElementById('repFecha').value = cita.fecha_cita;
      document.getElementById('repHora').value = cita.hora_cita;
      document.getElementById('modalReprogramar').showModal();
    });

    tbody.appendChild(tr);
  });
}

document.getElementById('formAdminCita').addEventListener('submit', (e) => {
  e.preventDefault();
  const res = DB.crearCita({
    usuario_id: document.getElementById('selectCliente').value || null,
    sala_id: document.getElementById('citaSala').value,
    cliente_nombre: document.getElementById('citaNombre').value,
    cliente_correo: document.getElementById('citaCorreo').value,
    fecha_cita: document.getElementById('citaFecha').value,
    hora_cita: document.getElementById('citaHora').value,
    personas: document.getElementById('citaPersonas').value,
    notas: document.getElementById('citaNotas').value,
    estado_cita: 'confirmada'
  });
  notificar(res.mensaje, res.exito);
  e.target.reset();
  renderCitas();
});

const modal = document.getElementById('modalReprogramar');
document.getElementById('btnCerrarModal').addEventListener('click', () => modal.close());
document.getElementById('formReprogramar').addEventListener('submit', (e) => {
  e.preventDefault();
  const res = DB.reprogramarCita(
    document.getElementById('repCitaId').value,
    document.getElementById('repSala').value,
    document.getElementById('repFecha').value,
    document.getElementById('repHora').value
  );
  modal.close();
  notificar(res.mensaje, res.exito);
  renderCitas();
});

renderSalas();
renderClientes();
renderCitas();
