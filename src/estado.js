/* =========================================================
   Estado de la aplicación: los datos y lo que está seleccionado.

   Las vistas leen de aquí y llaman a actualizar() cuando cambian algo.
   actualizar() hace dos cosas: manda guardar y vuelve a pintar.
   Así ninguna vista necesita saber dónde se guarda ni qué otras vistas hay.
   ========================================================= */

import { indiceVigente } from "./datos/modelo.js";

export const estado = {
  datos: { version: 2, tipos: [], materias: [] },
  materiaActiva: 0,
  sesionActiva: 0,
  verTodasLasSesiones: false,
  vistaSemestre: false,
  busqueda: "",
  filtroTipo: "",
};

const oyentes = [];
let persistir = () => {};

/** Registra una función que se ejecuta cada vez que hay que repintar. */
export function suscribir(fn) {
  oyentes.push(fn);
}

/** Repinta sin guardar. Para cambios que no tocan los datos (búsqueda, filtros). */
export function repintar() {
  for (const fn of oyentes) fn();
}

/** Conecta el guardado. Lo llama main.js al arrancar. */
export function registrarPersistencia(fn) {
  persistir = fn;
}

/** Cambió algo de los datos: guardar y repintar. */
export function actualizar() {
  persistir(estado.datos);
  repintar();
}

/** Cambió algo de los datos, pero no hay que repintar (bitácora al escribir). */
export function soloGuardar() {
  persistir(estado.datos);
}

export const materia = () => estado.datos.materias[estado.materiaActiva] || null;
export const sesion = () => materia()?.sesiones[estado.sesionActiva] || null;
export const haySesion = () => !!sesion();

/* Ir a una materia o a una sesión significa querer verla: si se estaba en la
   vista de semestre, se sale de ella. La regla vive aquí y no en cada botón
   que navega, porque repartida entre las vistas ya se olvidó una vez —elegir
   una sesión desde el lateral dejaba la tabla del semestre encima y los
   recursos fuera de alcance. */
function salirDeVistasQueTapan() {
  estado.vistaSemestre = false;
}

/** Deja los índices dentro de rango y selecciona la sesión vigente. */
export function irAMateria(indice) {
  const total = estado.datos.materias.length;
  estado.materiaActiva = total ? Math.min(Math.max(indice, 0), total - 1) : 0;
  estado.verTodasLasSesiones = false;
  estado.sesionActiva = indiceVigente(materia());
  salirDeVistasQueTapan();
}

export function irASesion(indice) {
  const total = materia()?.sesiones.length || 0;
  estado.sesionActiva = total ? Math.min(Math.max(indice, 0), total - 1) : 0;
  salirDeVistasQueTapan();
}
