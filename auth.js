'use strict';

const REGEX_CORREO = /^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const tabLogin = document.getElementById('tabLogin');
const tabRegistro = document.getElementById('tabRegistro');
const formLogin = document.getElementById('formLogin');
const formRegistro = document.getElementById('formRegistro');
const formRecuperar = document.getElementById('formRecuperar');

function cambiarTab(mostrarRegistro) {
  tabLogin.classList.toggle('activo', !mostrarRegistro);
  tabLogin.setAttribute('aria-selected', String(!mostrarRegistro));
  tabRegistro.classList.toggle('activo', mostrarRegistro);
  tabRegistro.setAttribute('aria-selected', String(mostrarRegistro));
  formLogin.hidden = mostrarRegistro;
  formRegistro.hidden = !mostrarRegistro;
  if (formRecuperar) formRecuperar.hidden = true;
}

tabLogin.addEventListener('click', () => cambiarTab(false));
tabRegistro.addEventListener('click', () => cambiarTab(true));

const linkOlvidePass = document.getElementById('linkOlvidePass');
const linkVolverLogin = document.getElementById('linkVolverLogin');

if (linkOlvidePass && formRecuperar) {
  linkOlvidePass.addEventListener('click', (e) => {
    e.preventDefault();
    formLogin.hidden = true;
    formRegistro.hidden = true;
    formRecuperar.hidden = false;
    document.getElementById('respRecuperar').hidden = true;
    if (loginCorreo.value.trim()) {
      recCorreo.value = loginCorreo.value.trim();
    }
  });
}

if (linkVolverLogin && formRecuperar) {
  linkVolverLogin.addEventListener('click', (e) => {
    e.preventDefault();
    cambiarTab(false);
  });
}

function validarCampoCorreo(input, cajaError) {
  const valor = input.value.trim();
  if (valor === '') {
    input.classList.add('invalido');
    input.classList.remove('valido');
    cajaError.textContent = 'Escribe tu correo electrónico.';
    cajaError.hidden = false;
    return false;
  }
  const valido = REGEX_CORREO.test(valor);
  input.classList.toggle('valido', valido);
  input.classList.toggle('invalido', !valido);
  cajaError.textContent = valido ? '' : 'Formato requerido: nombre@dominio.com';
  cajaError.hidden = valido;
  return valido;
}

const loginCorreo = document.getElementById('loginCorreo');
const errorLoginCorreo = document.getElementById('errorLoginCorreo');
loginCorreo.addEventListener('input', () => validarCampoCorreo(loginCorreo, errorLoginCorreo));

const regCorreo = document.getElementById('regCorreo');
const errorRegCorreo = document.getElementById('errorRegCorreo');
regCorreo.addEventListener('input', () => validarCampoCorreo(regCorreo, errorRegCorreo));

const recCorreo = document.getElementById('recCorreo');
const errorRecCorreo = document.getElementById('errorRecCorreo');
if (recCorreo && errorRecCorreo) {
  recCorreo.addEventListener('input', () => validarCampoCorreo(recCorreo, errorRecCorreo));
}

function mostrarRespuesta(caja, texto, exito) {
  caja.textContent = texto;
  caja.className = 'respuesta ' + (exito ? 'ok' : 'fallo');
  caja.hidden = false;
}

let procesandoAuth = false;

formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  if (procesandoAuth) return;

  const resp = document.getElementById('respLogin');
  const passInput = document.getElementById('loginPass');
  resp.hidden = true;

  const correoOk = validarCampoCorreo(loginCorreo, errorLoginCorreo);
  const passOk = passInput.value.trim().length >= 4;
  passInput.classList.toggle('invalido', !passOk);

  if (!correoOk || !passOk) {
    mostrarRespuesta(resp, 'Verifica tu correo y contraseña.', false);
    return;
  }

  const resultado = DB.login(loginCorreo.value, passInput.value);
  mostrarRespuesta(resp, resultado.mensaje, resultado.exito);

  if (resultado.exito) {
    procesandoAuth = true;
    document.getElementById('btnLogin').disabled = true;
    setTimeout(() => {
      window.location.href = resultado.rol === 'admin' ? 'admin.html' : 'mis_reservas.html';
    }, 550);
  }
});

if (formRecuperar) {
  formRecuperar.addEventListener('submit', (e) => {
    e.preventDefault();
    const resp = document.getElementById('respRecuperar');
    const telInput = document.getElementById('recTelefono');
    const passInput = document.getElementById('recNuevaPass');
    resp.hidden = true;

    const correoOk = validarCampoCorreo(recCorreo, errorRecCorreo);
    const digitosTel = telInput.value.replace(/\D/g, '');
    const telOk = digitosTel.length === 10;
    const passOk = passInput.value.length >= 6;

    telInput.classList.toggle('invalido', !telOk);
    passInput.classList.toggle('invalido', !passOk);

    if (!correoOk) {
      mostrarRespuesta(resp, 'Ingresa un correo electrónico válido.', false);
      return;
    }

    if (!telOk) {
      mostrarRespuesta(resp, 'Ingresa los 10 dígitos del teléfono registrado.', false);
      return;
    }

    if (!passOk) {
      mostrarRespuesta(resp, 'La nueva contraseña debe tener al menos 6 caracteres.', false);
      return;
    }

    const resultado = DB.recuperarPassword(recCorreo.value, digitosTel, passInput.value);
    mostrarRespuesta(resp, resultado.mensaje, resultado.exito);

    if (resultado.exito) {
      const correoGuardado = recCorreo.value.trim();
      formRecuperar.reset();
      setTimeout(() => {
        cambiarTab(false);
        loginCorreo.value = correoGuardado;
        document.getElementById('loginPass').focus();
      }, 1100);
    }
  });
}

formRegistro.addEventListener('submit', (e) => {
  e.preventDefault();
  if (procesandoAuth) return;

  const resp = document.getElementById('respRegistro');
  const nombre = document.getElementById('regNombre');
  const telefono = document.getElementById('regTelefono');
  const pass = document.getElementById('regPass');
  resp.hidden = true;

  const nombreOk = nombre.value.trim().length >= 3;
  const digitosTel = telefono.value.replace(/\D/g, '');
  const telOk = digitosTel.length === 10;
  const correoOk = validarCampoCorreo(regCorreo, errorRegCorreo);
  const passOk = pass.value.length >= 6;

  nombre.classList.toggle('invalido', !nombreOk);
  telefono.classList.toggle('invalido', !telOk);
  pass.classList.toggle('invalido', !passOk);

  if (!nombreOk) {
    mostrarRespuesta(resp, 'Escribe tu nombre completo (mínimo 3 caracteres).', false);
    return;
  }

  if (!telOk) {
    mostrarRespuesta(resp, 'El teléfono debe tener exactamente 10 dígitos.', false);
    return;
  }

  if (!correoOk) {
    mostrarRespuesta(resp, 'Escribe un correo electrónico válido (ejemplo@dominio.com).', false);
    return;
  }

  if (!passOk) {
    mostrarRespuesta(resp, 'La contraseña debe tener al menos 6 caracteres.', false);
    return;
  }

  const correoIngresado = regCorreo.value.trim();
  const resultado = DB.registrar(nombre.value, digitosTel, correoIngresado, pass.value);
  mostrarRespuesta(resp, resultado.mensaje, resultado.exito);

  if (resultado.exito) {
    procesandoAuth = true;
    document.getElementById('btnRegistro').disabled = true;
    formRegistro.reset();
    setTimeout(() => {
      window.location.href = 'mis_reservas.html';
    }, 650);
  } else if (resultado.yaExiste) {
    setTimeout(() => {
      cambiarTab(false);
      loginCorreo.value = correoIngresado;
      document.getElementById('loginPass').focus();
    }, 1300);
  }
});
