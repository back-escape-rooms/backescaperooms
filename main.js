// Lógica cliente: validación de correo, teléfono y campos obligatorios
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  iniciarValidacionesFormularios();
});

const REGEX_EMAIL = /^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const REGEX_TELEFONO = /^[0-9]{10}$/;

function validarEmail(correo) {
  return REGEX_EMAIL.test(String(correo || '').trim());
}

function validarTelefono(telefono) {
  const soloDigitos = String(telefono || '').replace(/\D/g, '');
  return REGEX_TELEFONO.test(soloDigitos);
}

function mostrarMensajeVisual(elementoAlerta, texto, esValido) {
  if (!elementoAlerta) return;
  elementoAlerta.textContent = texto;
  elementoAlerta.className = 'respuesta ' + (esValido ? 'ok' : 'fallo');
  elementoAlerta.hidden = false;
  elementoAlerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function iniciarValidacionesFormularios() {
  // Permite solo hasta 10 dígitos en campos de teléfono
  const inputsTelefono = document.querySelectorAll('input[type="tel"]');
  inputsTelefono.forEach((input) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 10);
    });
  });

  // Validación del formulario de reservación
  const formReserva = document.getElementById('formReservaContacto');
  const alertaReserva = document.getElementById('alertaContacto');

  if (formReserva) {
    formReserva.addEventListener(
      'submit',
      (e) => {
        const nombre = document.getElementById('cliente_nombre')?.value.trim() || '';
        const correo = document.getElementById('cliente_correo')?.value.trim() || '';
        const inputTel = document.getElementById('cliente_telefono');
        const telefono = inputTel ? inputTel.value.trim() : '';

        if (nombre.length < 3) {
          e.preventDefault();
          e.stopImmediatePropagation();
          mostrarMensajeVisual(alertaReserva, 'Campo obligatorio: ingresa tu nombre completo (mínimo 3 caracteres).', false);
          document.getElementById('cliente_nombre')?.focus();
          return;
        }

        if (!validarEmail(correo)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          mostrarMensajeVisual(alertaReserva, 'Correo electrónico inválido: verifica el formato (ejemplo@dominio.com).', false);
          document.getElementById('cliente_correo')?.focus();
          return;
        }

        if (inputTel && !validarTelefono(telefono)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          mostrarMensajeVisual(alertaReserva, 'Teléfono inválido: ingresa un número de 10 dígitos sin espacios ni guiones.', false);
          inputTel.focus();
          return;
        }
      },
      true
    );
  }

  // Validación del formulario de mensaje directo
  const formMensaje = document.getElementById('formMensajeContacto');
  const alertaMensaje = document.getElementById('alertaMensaje');

  if (formMensaje) {
    formMensaje.addEventListener(
      'submit',
      (e) => {
        const nombre = document.getElementById('msgNombre')?.value.trim() || '';
        const correo = document.getElementById('msgCorreo')?.value.trim() || '';
        const inputTelMsg = document.getElementById('msgTelefono');
        const telefono = inputTelMsg ? inputTelMsg.value.trim() : '';
        const texto = document.getElementById('msgTexto')?.value.trim() || '';

        if (nombre.length < 3) {
          e.preventDefault();
          e.stopImmediatePropagation();
          mostrarMensajeVisual(alertaMensaje, 'Campo obligatorio: escribe tu nombre completo.', false);
          document.getElementById('msgNombre')?.focus();
          return;
        }

        if (!validarEmail(correo)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          mostrarMensajeVisual(alertaMensaje, 'Correo electrónico inválido: ingresa un correo válido.', false);
          document.getElementById('msgCorreo')?.focus();
          return;
        }

        if (inputTelMsg && !validarTelefono(telefono)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          mostrarMensajeVisual(alertaMensaje, 'Teléfono inválido: ingresa un número de contacto a 10 dígitos.', false);
          inputTelMsg.focus();
          return;
        }

        if (texto.length < 10) {
          e.preventDefault();
          e.stopImmediatePropagation();
          mostrarMensajeVisual(alertaMensaje, 'Campo obligatorio: escribe un mensaje de al menos 10 caracteres.', false);
          document.getElementById('msgTexto')?.focus();
        }
      },
      true
    );
  }
}