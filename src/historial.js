/* =========================================================
   Deshacer una eliminación.

   Cada eliminación deja una función que la revierte, y solo esa: vuelve a
   poner lo que se quitó en el lugar donde estaba. Antes se guardaba una foto
   de TODO el panel y deshacer la restauraba entera, lo que tenía una
   consecuencia que nadie veía: el aviso dura 25 segundos, y todo lo que se
   escribiera en ese tiempo —una bitácora, otro recurso— desaparecía sin
   decir nada en cuanto se pulsaba «Deshacer».

   Como la función vive en el propio aviso y no en una variable de módulo, no
   hay estado global que se quede viejo: cada «Deshacer» conoce su eliminación
   y ninguna otra.

   Sirve para el arrepentimiento inmediato, no para recorrer la historia. Para
   eso están las copias de seguridad rotativas (src/almacenamiento/local.js)
   y los respaldos en archivo.
   ========================================================= */

import { estado, actualizar, irAMateria, irASesion } from "./estado.js";
import { mostrarAviso } from "./vistas/aviso.js";

/**
 * Devuelve la acción «Deshacer» de una eliminación.
 *
 * @param {() => boolean|void} restaurar  vuelve a poner lo eliminado. Debe
 *        devolver false, sin tocar nada, si ya no se puede: por ejemplo
 *        porque lo que lo contenía también se eliminó, o porque se cargó un
 *        respaldo y los datos son otros.
 */
export function prepararDeshacer(restaurar) {
  let vigente = true; // un segundo clic sobre el mismo aviso no repone dos veces
  return () => {
    if (!vigente) return;
    vigente = false;
    if (restaurar() === false) {
      mostrarAviso("Ya no se puede deshacer: lo que estaba ahí cambió después de quitarlo.");
      return;
    }
    actualizar();
  };
}

/* ---------- Ayudas para escribir las funciones de restauración ---------- */

/** Una posición válida dentro de una lista que pudo haber cambiado de tamaño. */
export const posicionEn = (lista, indice) => Math.max(0, Math.min(indice, lista.length));

/** La materia sigue en el panel. Falso si se cargó un respaldo o se eliminó. */
export const materiaSigue = (materia) => estado.datos.materias.includes(materia);

/** La sesión sigue en esa materia, y la materia en el panel. */
export const sesionSigue = (materia, sesion) => materiaSigue(materia) && materia.sesiones.includes(sesion);

/** Lleva la vista a lo restaurado, para que se vea que volvió. */
export function mostrar(materia, sesion = null) {
  irAMateria(estado.datos.materias.indexOf(materia));
  if (sesion) irASesion(materia.sesiones.indexOf(sesion));
}
