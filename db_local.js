'use strict';

/* db_local.js — Base de datos local, generador QR nativo, pagos y sincronización */
const DB = (() => {
  const KEYS = {
    USUARIOS: 'ber_usuarios_v1',
    SALAS: 'ber_salas_v1',
    CITAS: 'ber_citas_v1',
    SESION: 'ber_sesion_v1'
  };

  const SALAS_INICIALES = [
    { id: 'nivel-0',   codigo: 'ARCHIVO #LVL-000', nombre: 'Nivel 0: El Vestíbulo Amarillo',   estado: 'disponible',    precio: 450 },
    { id: 'nivel-1',   codigo: 'ARCHIVO #LVL-001', nombre: 'Nivel 1: Zona Habitable',          estado: 'disponible',    precio: 550 },
    { id: 'nivel-2',   codigo: 'ARCHIVO #LVL-002', nombre: 'Nivel 2: Sueños de Tuberías',      estado: 'disponible',    precio: 580 },
    { id: 'nivel-3',   codigo: 'ARCHIVO #LVL-003', nombre: 'Nivel 3: Estación Eléctrica',      estado: 'disponible',    precio: 680 },
    { id: 'nivel-4',   codigo: 'ARCHIVO #LVL-004', nombre: 'Nivel 4: Oficina Abandonada',      estado: 'disponible',    precio: 480 },
    { id: 'nivel-5',   codigo: 'ARCHIVO #LVL-005', nombre: 'Nivel 5: Hotel del Terror',        estado: 'disponible',    precio: 650 },
    { id: 'nivel-37',  codigo: 'ARCHIVO #LVL-037', nombre: 'Nivel 37: Subliminal (Poolrooms)', estado: 'disponible',    precio: 620 },
    { id: 'nivel-run', codigo: 'ARCHIVO #LVL-RUN', nombre: 'Nivel !: ¡Corre por tu Vida!',     estado: 'mantenimiento', precio: 720 }
  ];

  const USUARIOS_INICIALES = [
    {
      id: 1,
      nombre: 'Administrador M.E.G.',
      correo: 'admin@backescaperooms.mx',
      telefono: '4770000000',
      password: 'password',
      rol: 'admin'
    }
  ];

  function normalizarTelefono10(tel) {
    const digitos = String(tel || '').replace(/\D/g, '');
    return digitos.length > 10 ? digitos.slice(-10) : digitos;
  }

  function init() {
    if (!localStorage.getItem(KEYS.USUARIOS)) {
      localStorage.setItem(KEYS.USUARIOS, JSON.stringify(USUARIOS_INICIALES));
    }
    if (!localStorage.getItem(KEYS.SALAS)) {
      localStorage.setItem(KEYS.SALAS, JSON.stringify(SALAS_INICIALES));
    }
    if (!localStorage.getItem(KEYS.CITAS)) {
      localStorage.setItem(KEYS.CITAS, JSON.stringify([]));
    }
  }

  init();

  /* Generador nativo de Código QR escaneable (Versiones 1–6, ECC L, Byte Mode) */
  function generarQRDataURL(texto) {
    const raw = Array.from(new TextEncoder().encode(String(texto)));
    const specs = [
      [1, 21, 26, 19, 7, 1],
      [2, 25, 44, 34, 10, 1],
      [3, 29, 70, 55, 15, 1],
      [4, 33, 100, 80, 20, 1],
      [5, 37, 134, 108, 26, 1],
      [6, 41, 172, 136, 18, 2]
    ];
    const alignCoords = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

    const needed = raw.length + 2;
    const spec = specs.find((s) => s[3] >= needed) || specs[specs.length - 1];
    const [ver, size, totalCw, dataCw, eccLen, blocks] = spec;
    const bytes = raw.slice(0, dataCw - 2);

    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };

    pushBits(0b0100, 4);
    pushBits(bytes.length, 8);
    bytes.forEach((b) => pushBits(b, 8));
    pushBits(0, Math.min(4, dataCw * 8 - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);

    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      cw.push(v);
    }

    const padBytes = [0xec, 0x11];
    let pIdx = 0;
    while (cw.length < dataCw) {
      cw.push(padBytes[pIdx % 2]);
      pIdx++;
    }

    const gfMul = (x, y) => {
      let r = 0;
      for (let i = 0; i < 8; i++) if ((y >> i) & 1) r ^= x << i;
      for (let i = 7; i >= 0; i--) if ((r >> (i + 8)) & 1) r ^= 0x11d << i;
      return r;
    };

    const rsPoly = (nsym) => {
      let g = [1];
      for (let i = 0; i < nsym; i++) {
        let a = 1;
        for (let k = 0; k < i; k++) a = gfMul(a, 2);
        const ng = new Array(g.length + 1).fill(0);
        for (let j = 0; j < g.length; j++) {
          ng[j] ^= g[j];
          ng[j + 1] ^= gfMul(g[j], a);
        }
        g = ng;
      }
      return g;
    };

    const rsRem = (data, gen) => {
      const res = data.concat(new Array(gen.length - 1).fill(0));
      for (let i = 0; i < data.length; i++) {
        const coef = res[i];
        if (coef !== 0) {
          for (let j = 1; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef);
        }
      }
      return res.slice(data.length);
    };

    const gen = rsPoly(eccLen);
    const blockSize = Math.floor(dataCw / blocks);
    const dataBlocks = [];
    const eccBlocks = [];
    for (let b = 0; b < blocks; b++) {
      const chunk = cw.slice(b * blockSize, (b + 1) * blockSize);
      dataBlocks.push(chunk);
      eccBlocks.push(rsRem(chunk, gen));
    }

    const finalCw = [];
    for (let i = 0; i < blockSize; i++) {
      for (let b = 0; b < blocks; b++) finalCw.push(dataBlocks[b][i]);
    }
    for (let i = 0; i < eccLen; i++) {
      for (let b = 0; b < blocks; b++) finalCw.push(eccBlocks[b][i]);
    }

    const grid = Array.from({ length: size }, () => new Array(size).fill(0));
    const func = Array.from({ length: size }, () => new Array(size).fill(false));

    const setFunc = (r, c, val) => {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        grid[r][c] = val ? 1 : 0;
        func[r][c] = true;
      }
    };

    [[0, 0], [0, size - 7], [size - 7, 0]].forEach(([fr, fc]) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const inOuter = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) || (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6));
          setFunc(fr + dr, fc + dc, inOuter || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        }
      }
    });

    const coords = alignCoords[ver];
    coords.forEach((ar) => {
      coords.forEach((ac) => {
        if (func[ar][ac]) return;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            setFunc(ar + dr, ac + dc, Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
          }
        }
      });
    });

    for (let i = 8; i < size - 8; i++) {
      setFunc(6, i, i % 2 === 0);
      setFunc(i, 6, i % 2 === 0);
    }

    setFunc(size - 8, 8, true);
    for (let i = 0; i < 9; i++) {
      if (!func[8][i]) setFunc(8, i, false);
      if (!func[i][8]) setFunc(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      if (!func[8][size - 1 - i]) setFunc(8, size - 1 - i, false);
      if (!func[size - 1 - i][8]) setFunc(size - 1 - i, 8, false);
    }

    const dataBits = [];
    finalCw.forEach((byte) => {
      for (let b = 7; b >= 0; b--) dataBits.push((byte >> b) & 1);
    });

    let bitIdx = 0;
    let dir = -1;
    for (let col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < size; step++) {
        const r = dir === -1 ? size - 1 - step : step;
        for (let dx = 0; dx < 2; dx++) {
          const c = col - dx;
          if (!func[r][c]) {
            const bit = bitIdx < dataBits.length ? dataBits[bitIdx] : 0;
            bitIdx++;
            const mask = (r + c) % 2 === 0 ? 1 : 0;
            grid[r][c] = bit ^ mask;
          }
        }
      }
      dir *= -1;
    }

    const fmt = 0x77c4;
    const tlCoords = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    for (let k = 0; k < 15; k++) {
      const bit = (fmt >> (14 - k)) & 1;
      const [r1, c1] = tlCoords[k];
      grid[r1][c1] = bit;
      if (k < 7) {
        grid[size - 1 - k][8] = bit;
      } else {
        grid[8][size - 15 + k] = bit;
      }
    }

    const quiet = 4;
    const total = size + quiet * 2;
    let rects = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === 1) {
          rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
        }
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><g fill="#000000">${rects}</g></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  return {
    generarQRDataURL,
    getUsuarios() {
      return JSON.parse(localStorage.getItem(KEYS.USUARIOS)) || [];
    },
    registrar(nombre, telefono, correo, password) {
      const usuarios = this.getUsuarios();
      const correoNorm = String(correo || '').trim().toLowerCase();
      const telNorm = normalizarTelefono10(telefono);

      if (usuarios.some((u) => String(u.correo || '').trim().toLowerCase() === correoNorm)) {
        return {
          exito: false,
          yaExiste: true,
          mensaje: 'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.'
        };
      }

      const nuevo = {
        id: Date.now(),
        nombre: String(nombre || '').trim(),
        telefono: telNorm,
        correo: correoNorm,
        password: String(password || ''),
        rol: 'cliente'
      };

      usuarios.push(nuevo);
      localStorage.setItem(KEYS.USUARIOS, JSON.stringify(usuarios));
      localStorage.setItem(KEYS.SESION, JSON.stringify({
        id: nuevo.id,
        nombre: nuevo.nombre,
        correo: nuevo.correo,
        rol: nuevo.rol
      }));
      return { exito: true, mensaje: 'Registro previo completado. Redirigiendo...', rol: 'cliente' };
    },
    login(correo, password) {
      const correoNorm = String(correo || '').trim().toLowerCase();
      const passStr = String(password || '');
      const usuario = this.getUsuarios().find(
        (u) => String(u.correo || '').trim().toLowerCase() === correoNorm && u.password === passStr
      );
      if (!usuario) {
        return { exito: false, mensaje: 'Correo o contraseña incorrectos.' };
      }
      localStorage.setItem(KEYS.SESION, JSON.stringify({
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol
      }));
      const destino = usuario.rol === 'admin' ? 'Panel de Administración' : 'Portal de Cliente';
      return { exito: true, mensaje: `Bienvenido, ${usuario.nombre}. Abriendo ${destino}...`, rol: usuario.rol };
    },
    recuperarPassword(correo, telefono, nuevaPassword) {
      const usuarios = this.getUsuarios();
      const correoNorm = String(correo || '').trim().toLowerCase();
      const telLimpio = normalizarTelefono10(telefono);

      const usuario = usuarios.find(
        (u) => String(u.correo || '').trim().toLowerCase() === correoNorm
      );

      if (!usuario) {
        return { exito: false, mensaje: 'No existe ninguna cuenta registrada con ese correo.' };
      }

      const telGuardado = normalizarTelefono10(usuario.telefono);
      if (telGuardado !== telLimpio) {
        return { exito: false, mensaje: 'El teléfono ingresado no coincide con el registrado en esta cuenta.' };
      }

      usuario.password = String(nuevaPassword || '');
      localStorage.setItem(KEYS.USUARIOS, JSON.stringify(usuarios));
      return { exito: true, mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' };
    },
    getSesion() {
      return JSON.parse(localStorage.getItem(KEYS.SESION));
    },
    logout() {
      localStorage.removeItem(KEYS.SESION);
      window.location.href = 'acceso.html';
    },
    getSalas() {
      return JSON.parse(localStorage.getItem(KEYS.SALAS)) || SALAS_INICIALES;
    },
    actualizarSala(id, estado, precio) {
      const salas = this.getSalas().map((s) =>
        s.id === id ? { ...s, estado, precio: Number(precio) } : s
      );
      localStorage.setItem(KEYS.SALAS, JSON.stringify(salas));
      return { exito: true, mensaje: `Sala (${id}) actualizada a: ${estado.toUpperCase()}.` };
    },
    getCitas() {
      return JSON.parse(localStorage.getItem(KEYS.CITAS)) || [];
    },
    crearCita(datos) {
      const citas = this.getCitas();
      const salas = this.getSalas();
      const salaObj = salas.find((s) => s.id === datos.sala_id);

      if (!salaObj || (salaObj.estado !== 'disponible' && !datos.es_admin)) {
        const motivo = salaObj
          ? (salaObj.estado === 'mantenimiento' ? 'en mantenimiento' : 'cerrada')
          : 'no disponible';
        return {
          exito: false,
          mensaje: `No es posible reservar: ${salaObj ? salaObj.nombre : 'esta sala'} se encuentra ${motivo}.`
        };
      }

      const precioUnitario = Number(salaObj.precio) || 450;
      const personas = Number(datos.personas) || 2;
      const total = precioUnitario * personas;
      const nuevoId = citas.length > 0 ? Math.max(...citas.map((c) => c.id)) + 1 : 101;
      const metodoPago = datos.metodo_pago || 'sucursal';

      let estadoPago = 'pendiente_sucursal';
      if (metodoPago === 'tarjeta') estadoPago = 'pagado';
      if (metodoPago === 'transferencia') estadoPago = 'en_validacion';

      const nueva = {
        id: nuevoId,
        codigo_qr: `BER-${nuevoId}-${datos.sala_id.toUpperCase()}`,
        usuario_id: datos.usuario_id || null,
        cliente_nombre: datos.cliente_nombre,
        cliente_correo: datos.cliente_correo.toLowerCase(),
        sala_id: datos.sala_id,
        fecha_cita: datos.fecha_cita,
        hora_cita: datos.hora_cita,
        personas,
        total,
        metodo_pago: metodoPago,
        estado_pago: datos.estado_pago || estadoPago,
        referencia_pago: datos.referencia_pago || `REF-${nuevoId}`,
        estado_cita: datos.estado_cita || (metodoPago === 'tarjeta' ? 'confirmada' : 'pendiente'),
        notas: datos.notas || ''
      };

      citas.push(nueva);
      localStorage.setItem(KEYS.CITAS, JSON.stringify(citas));
      return { exito: true, mensaje: `Reservación #${nueva.id} generada con pase QR.`, cita: nueva };
    },
    reprogramarCita(id, salaId, fecha, hora) {
      const citas = this.getCitas().map((c) =>
        c.id === Number(id)
          ? {
              ...c,
              sala_id: salaId,
              fecha_cita: fecha,
              hora_cita: hora,
              codigo_qr: `BER-${id}-${salaId.toUpperCase()}`,
              estado_cita: 'reprogramada'
            }
          : c
      );
      localStorage.setItem(KEYS.CITAS, JSON.stringify(citas));
      return { exito: true, mensaje: `Cita #${id} reprogramada y código QR actualizado.` };
    },
    cambiarEstadoCita(id, estado) {
      const citas = this.getCitas().map((c) =>
        c.id === Number(id) ? { ...c, estado_cita: estado } : c
      );
      localStorage.setItem(KEYS.CITAS, JSON.stringify(citas));
      return { exito: true, mensaje: `Cita #${id} marcada como ${estado.toUpperCase()}.` };
    },
    marcarPagado(id) {
      const citas = this.getCitas().map((c) =>
        c.id === Number(id) ? { ...c, estado_pago: 'pagado', estado_cita: 'confirmada' } : c
      );
      localStorage.setItem(KEYS.CITAS, JSON.stringify(citas));
      return { exito: true, mensaje: `Pago de la cita #${id} confirmado.` };
    }
  };
})();

/* Sincronización de disponibilidad, precios y botones de reserva en el sitio público */
function sincronizarSitioPublico() {
  const salas = DB.getSalas();
  const salasMap = Object.fromEntries(salas.map((s) => [s.id, s]));

  const palabrasClave = {
    'nivel-0': ['nivel 0', 'vestíbulo', 'vestibulo'],
    'nivel-1': ['nivel 1', 'zona habitable'],
    'nivel-2': ['nivel 2', 'tuberías', 'tuberias'],
    'nivel-3': ['nivel 3', 'estación eléctrica', 'estacion electrica'],
    'nivel-4': ['nivel 4', 'oficina'],
    'nivel-5': ['nivel 5', 'hotel'],
    'nivel-37': ['nivel 37', 'subliminal', 'poolrooms'],
    'nivel-run': ['nivel !', 'corre por tu vida', 'lvl-run']
  };

  function detectarSalaEnElemento(el) {
    const attr = el.getAttribute('data-tema') || el.getAttribute('data-nivel') || el.getAttribute('data-sala') || el.id;
    if (attr && salasMap[attr]) return salasMap[attr];

    const enlace = el.querySelector('a[href*="sala.html"], a[href*="contacto.html"]');
    if (enlace) {
      const href = enlace.getAttribute('href') || '';
      for (const id of Object.keys(salasMap)) {
        if (href.includes(id)) return salasMap[id];
      }
    }

    const texto = el.textContent.toLowerCase();
    for (const [id, pistas] of Object.entries(palabrasClave)) {
      if (pistas.some((p) => texto.includes(p))) return salasMap[id];
    }
    return null;
  }

  function aplicarEstadoBadge(badge, sala) {
    if (!badge || !sala) return;
    const disponible = sala.estado === 'disponible';
    badge.textContent = disponible
      ? 'Disponible'
      : (sala.estado === 'mantenimiento' ? 'En mantenimiento' : 'Cerrada');

    if (badge.classList.contains('estado-badge')) {
      badge.className = `estado-badge ${disponible ? 'estado-disponible' : 'estado-mantenimiento'}`;
    } else {
      badge.style.color = disponible ? '#4ade80' : '#f87171';
    }
  }

  function configurarBotonReserva(btn, sala) {
    if (!btn || !sala) return;
    btn.dataset.btnReservaSync = '1';
    const disponible = sala.estado === 'disponible';

    if (disponible) {
      btn.href = `contacto.html?sala=${encodeURIComponent(sala.id)}`;
      btn.textContent = btn.dataset.textoOriginal || 'Reservar Sala';
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';
      btn.removeAttribute('aria-disabled');
    } else {
      if (!btn.dataset.textoOriginal) {
        btn.dataset.textoOriginal = btn.textContent.trim();
      }
      btn.href = '#';
      btn.textContent = sala.estado === 'mantenimiento' ? 'No disponible (Mantenimiento)' : 'Sala Cerrada';
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.45';
      btn.setAttribute('aria-disabled', 'true');
    }
  }

  const posiblesTarjetas = document.querySelectorAll('.tarjeta-archivo, .tarjeta, .card, .sala-card, article, [data-tema], [data-nivel]');
  posiblesTarjetas.forEach((tarjeta) => {
    const sala = detectarSalaEnElemento(tarjeta);
    if (!sala) return;

    let badge = tarjeta.querySelector('.estado-badge, .badge, .estado, [data-estado]');
    if (!badge) {
      badge = Array.from(tarjeta.querySelectorAll('span, p, small, strong, div')).find((el) =>
        el.children.length === 0 && /^(disponible|no disponible|en mantenimiento|cerrada)$/i.test(el.textContent.trim())
      );
    }
    aplicarEstadoBadge(badge, sala);

    const precioEl = tarjeta.querySelector('.precio-sala, .precio, [data-precio]');
    if (precioEl) precioEl.textContent = `$${sala.precio} MXN`;

    const btnDirecto = tarjeta.querySelector('a[href*="contacto.html"], a[data-btn-reserva-sync]');
    if (btnDirecto) configurarBotonReserva(btnDirecto, sala);
  });

  const params = new URLSearchParams(window.location.search);
  const idUrl = params.get('nivel') || params.get('sala') || params.get('id');
  if (idUrl && salasMap[idUrl]) {
    const salaActual = salasMap[idUrl];
    const estaDisponible = salaActual.estado === 'disponible';

    const badgeSala = document.querySelector('#sala-estado, .estado-badge, .badge, [data-estado]');
    if (badgeSala) {
      badgeSala.textContent = estaDisponible
        ? 'Disponible'
        : (salaActual.estado === 'mantenimiento' ? 'No disponible (En mantenimiento)' : 'Cerrada temporalmente');
      if (badgeSala.classList.contains('estado-badge')) {
        badgeSala.className = `estado-badge ${estaDisponible ? 'estado-disponible' : 'estado-mantenimiento'}`;
      }
    }

    const precioSala = document.getElementById('sala-precio');
    if (precioSala) precioSala.textContent = `$${salaActual.precio} MXN / persona`;

    const btnReservar = document.querySelector('#btn-reservar, main a[href*="contacto.html"], main a[data-btn-reserva-sync]');
    if (btnReservar) {
      btnReservar.dataset.textoOriginal = 'Solicitar Reservación de esta Sala';
      configurarBotonReserva(btnReservar, salaActual);
    }
  }
}

/* Menú Hamburguesa Interactivo para Móvil (Evento Click) */
function inicializarMenuHamburguesa() {
  const viejoStyle = document.getElementById('ber-menu-movil-css');
  if (viejoStyle) viejoStyle.remove();

  const style = document.createElement('style');
  style.id = 'ber-menu-movil-css';
  style.textContent = `
    .btn-hamburguesa {
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 5px;
      width: 42px;
      height: 42px;
      padding: 8px;
      background: #0d0c09;
      border: 1px solid #e6c64c;
      border-radius: 8px;
      cursor: pointer;
      z-index: 1005;
      margin-left: auto;
    }
    .btn-hamburguesa span {
      display: block;
      width: 22px;
      height: 2px;
      background-color: #e6c64c;
      border-radius: 2px;
      transition: transform 0.25s ease, opacity 0.2s ease;
    }
    .btn-hamburguesa.activo span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .btn-hamburguesa.activo span:nth-child(2) { opacity: 0; }
    .btn-hamburguesa.activo span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    @media (max-width: 768px) {
      header, .barra-superior {
        position: relative !important;
        flex-wrap: wrap !important;
        overflow: visible !important;
      }
      .btn-hamburguesa {
        display: inline-flex !important;
      }
      nav[data-ber-nav] {
        display: none !important;
        width: 100% !important;
        flex-basis: 100% !important;
      }
      nav[data-ber-nav].menu-abierto {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;
        margin-top: 12px !important;
        padding: 12px !important;
        background: #14120d !important;
        border: 1px solid #3a3423 !important;
        border-radius: 10px !important;
        z-index: 1004 !important;
      }
      nav[data-ber-nav].menu-abierto ul {
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        gap: 8px !important;
        margin: 0 !important;
        padding: 0 !important;
        list-style: none !important;
      }
      nav[data-ber-nav].menu-abierto a {
        display: block !important;
        width: 100% !important;
        padding: 10px 12px !important;
        border-radius: 6px !important;
        background: #0d0c09 !important;
        color: #f5f2e8 !important;
        text-align: left !important;
      }
    }
  `;
  document.head.appendChild(style);

  const header = document.querySelector('header');
  const nav = header
    ? (header.querySelector('nav') || (header.nextElementSibling && header.nextElementSibling.tagName === 'NAV' ? header.nextElementSibling : null))
    : document.querySelector('nav');

  if (!header || !nav) return;

  nav.setAttribute('data-ber-nav', '1');

  let btn = header.querySelector('.btn-hamburguesa');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-hamburguesa';
    btn.setAttribute('aria-label', 'Abrir menú de navegación');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    if (header.contains(nav)) {
      header.insertBefore(btn, nav);
    } else {
      header.appendChild(btn);
    }
  }

  if (btn.dataset.clickListo) return;
  btn.dataset.clickListo = '1';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const abierto = nav.classList.toggle('menu-abierto');
    btn.classList.toggle('activo', abierto);
    btn.setAttribute('aria-expanded', String(abierto));
  });

  nav.querySelectorAll('a').forEach((enlace) => {
    enlace.addEventListener('click', () => {
      nav.classList.remove('menu-abierto');
      btn.classList.remove('activo');
      btn.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!header.contains(e.target) && !nav.contains(e.target) && nav.classList.contains('menu-abierto')) {
      nav.classList.remove('menu-abierto');
      btn.classList.remove('activo');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    sincronizarSitioPublico();
    inicializarMenuHamburguesa();
  });
} else {
  sincronizarSitioPublico();
  inicializarMenuHamburguesa();
}
setTimeout(sincronizarSitioPublico, 150);

window.addEventListener('storage', (e) => {
  if (e.key === 'ber_salas_v1') sincronizarSitioPublico();
});
