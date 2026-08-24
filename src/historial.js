/* =========================================================
   Deshacer la última eliminación.

   Guarda una copia completa de los datos justo antes de borrar algo. Es una
   sola copia: deshacer sirve para el arrepentimiento inmediato, no para
   recorrer la historia. Para eso están las copias de seguridad rotativas
   (src/almacenamiento/local.js) y los respaldos en archivo.
   ========================================================= */

import { estado, actualizar } from "./estado.js";

const copiar = (datos) => JSON.parse(JSON.stringify(datos));

let respaldo = null;

/** Se llama SIEMPRE antes de la eliminación, nunca después. */
export function recordarParaDeshacer() {
  respaldo = {
    datos: copiar(estado.datos),
    materiaActiva: estado.materiaActiva,
    sesionActiva: estado.sesionActiva,
  };
}

export const hayQueDeshacer = () => !!respaldo;

/** Devuelve todo al momento anterior a la eliminación, con la misma vista. */
export function deshacer() {
  if (!respaldo) return;
  estado.datos = respaldo.datos;
  estado.materiaActiva = respaldo.materiaActiva;
  estado.sesionActiva = respaldo.sesionActiva;
  respaldo = null;
  actualizar();
}

/** Se olvida la copia: lo borrado ya no se puede recuperar por esta vía. */
export function olvidarDeshacer() {
  respaldo = null;
}
