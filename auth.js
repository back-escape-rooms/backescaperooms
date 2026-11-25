'use strict';

const REGEX_CORREO = /^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const tabLogin = document.getElementById('tabLogin');
const tabRegistro = document.getElementById('tabRegistro');
const formLogin = document.getElementById('formLogin');
const formRegistro = document.getElementById('formRegistro');

function cambiarTab(mostrarRegistro) {
  tabLogin.classList.toggle('activo', !mostrarRegistro);
  tabLogin.setAttribute('aria-selected', String(!mostrarRegistro));
  tabRegistro.classList.toggle('activo', mostrarRegistro);
  tabRegistro.setAttribute('aria-selected', String(mostrarRegistro));
  formLogin.hidden = mostrarRegistro;
  formRegistro.hidden = !mostrarRegistro;
}

tabLogin.addEventListener('click', () => cambiarTab(false));
tabRegistro.addEventListener('click', () => cambiarTab(true));

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

function mostrarRespuesta(caja, texto, exito) {
  caja.textContent = texto;
  caja.className = 'respuesta ' + (exito ? 'ok' : 'fallo');
  caja.hidden = false;
}

formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
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
    setTimeout(() => {
      window.location.href = resultado.rol === 'admin' ? 'admin.html' : 'mis_reservas.html';
    }, 550);
  }
});

formRegistro.addEventListener('submit', (e) => {
  e.preventDefault();
  const resp = document.getElementById('respRegistro');
  const nombre = document.getElementById('regNombre');
  const telefono = document.getElementById('regTelefono');
  const pass = document.getElementById('regPass');
  resp.hidden = true;

  const nombreOk = nombre.value.trim() !== '';
  const telOk = telefono.value.trim().length >= 7;
  const correoOk = validarCampoCorreo(regCorreo, errorRegCorreo);
  const passOk = pass.value.length >= 6;

  nombre.classList.toggle('invalido', !nombreOk);
  telefono.classList.toggle('invalido', !telOk);
  pass.classList.toggle('invalido', !passOk);

  if (!nombreOk || !telOk || !correoOk || !passOk) {
    mostrarRespuesta(resp, 'Completa todos los campos (contraseña mínimo 6 caracteres).', false);
    return;
  }

  const resultado = DB.registrar(nombre.value, telefono.value, regCorreo.value, pass.value);
  mostrarRespuesta(resp, resultado.mensaje, resultado.exito);

  if (resultado.exito) {
    formRegistro.reset();
    setTimeout(() => {
      window.location.href = 'mis_reservas.html';
    }, 650);
  }
});
