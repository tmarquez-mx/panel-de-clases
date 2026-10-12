/* Copiar y pegar. El portapapeles solo está disponible en contextos seguros
   (https o localhost). Desde file:// el navegador lo bloquea y se degrada
   a un cuadro de diálogo o a un aviso. */

import { avisar } from "./dom.js";

/** Copia texto y confirma en el propio botón.
 *  Se usa el portapapeles de la ventana donde está el botón: en el modo
 *  clase puede ser la ventanita flotante, y el navegador solo deja escribir
 *  en el portapapeles a la ventana que tiene el foco. */
export function copiar(texto, boton, mensaje = "Copiada") {
  const vista = boton?.ownerDocument?.defaultView || window;
  const original = boton?.textContent;
  const listo = () => {
    if (!boton) return;
    boton.textContent = mensaje;
    vista.setTimeout(() => {
      boton.textContent = original;
    }, 1400);
  };
  const respaldo = () => vista.prompt("Copia la liga:", texto);

  if (vista.navigator.clipboard?.writeText) {
    vista.navigator.clipboard.writeText(texto).then(listo, respaldo);
  } else {
    respaldo();
  }
}

/** Lee el portapapeles y lo pone en un campo. */
export async function pegarEn(campo) {
  try {
    const texto = await navigator.clipboard.readText();
    if (texto) campo.value = texto.trim();
    campo.focus();
  } catch {
    campo.focus();
    avisar("El navegador no permitió leer el portapapeles. Pega con Ctrl+V o Cmd+V en el campo.");
  }
}
