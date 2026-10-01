/* =========================================================
   Modelo de datos y migración de respaldos.

   Estructura vigente (versión 2):

   {
     "version": 2,
     "tipos": ["podcast"],            // tipos propios, además de los de base
     "materias": [{
       id, clase, nombre, clave, carpeta, cuaderno,   // clase: curso | taller | ponencia
       ofimatica,                     // opcional: microsoft | google | ninguna
       sesiones: [{
         num, fecha, titulo, proposito, bitacora,
         recursos: [{ titulo, tipo, momento, url, nota, estado }]
       }]
     }]
   }

   Los respaldos anteriores (el prototipo de un solo archivo, sin campo
   "version") entran por migrar(): se les completan los campos que falten con
   valores por omisión y nunca se pierde información existente.
   ========================================================= */

import { aFecha, sumarDias } from "../util/fechas.js";
import { CLASES } from "./vocabulario.js";
import { SUITES } from "./nubes.js";

export const VERSION_DATOS = 2;

export const TIPOS_BASE = [
  "lectura", "artefacto", "presentación", "liga", "apunte", "video", "actividad",
];

export const ESTADOS = ["pendiente", "listo", "usado"];

/** Ciclo de tres pasos: pendiente → listo → usado → pendiente. */
export function siguienteEstado(estado) {
  const i = ESTADOS.indexOf(estado);
  return ESTADOS[(i + 1) % ESTADOS.length];
}

/** Error con mensaje legible para la usuaria, no para la consola. */
export class ErrorDeDatos extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "ErrorDeDatos";
  }
}

/* ---------- Normalización ---------- */

/** Devuelve siempre una cadena, aunque el respaldo traiga números u objetos. */
const texto = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

export const identificador = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const esObjeto = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** Solo las entradas que son objetos: la basura del respaldo se descarta en vez
 *  de convertirse en materias o recursos vacíos que aparentan ser buenos. */
const soloObjetos = (lista) => (Array.isArray(lista) ? lista.filter(esObjeto) : []);

function normalizarRecurso(entrada) {
  const r = entrada;
  const estado = texto(r.estado).toLowerCase();
  return {
    titulo: texto(r.titulo).trim() || "Recurso sin título",
    tipo: texto(r.tipo).trim().toLowerCase() || "liga",
    momento: texto(r.momento).trim(),
    url: texto(r.url).trim(),
    nota: texto(r.nota).trim(),
    estado: ESTADOS.includes(estado) ? estado : "pendiente",
  };
}

function normalizarSesion(entrada, posicion) {
  const s = entrada;
  const num = Number.parseInt(s.num, 10);
  // Se acepta también la forma con hora ("2026-09-08T10:00:00"): se recorta el día.
  const fecha = texto(s.fecha).trim().split("T")[0];
  return {
    num: Number.isFinite(num) && num > 0 ? num : posicion + 1,
    // Una fecha ilegible se vacía: el panel la marca en rojo y se puede corregir.
    fecha: aFecha(fecha) ? fecha : "",
    titulo: texto(s.titulo).trim() || "Sesión sin título",
    proposito: texto(s.proposito).trim(),
    bitacora: texto(s.bitacora),
    recursos: soloObjetos(s.recursos).map(normalizarRecurso),
  };
}

function normalizarMateria(entrada, posicion) {
  const m = entrada;
  // Los respaldos anteriores no traen «clase»: todo lo que existía era un
  // curso, así que ese es el valor por omisión y nada se pierde al migrar.
  const clase = CLASES.includes(texto(m.clase).trim()) ? texto(m.clase).trim() : "curso";

  /* La suite de ofimática es opcional, y ausente significa algo: que se
     deduzca de la carpeta vinculada. Por eso solo se conserva si es una de
     las tres válidas, y si no lo es simplemente no se escribe, en vez de
     inventar un valor. Este campo se perdía al recargar porque migrar()
     copia campo por campo y nadie se lo enseñó: todo lo que la interfaz
     escribe en una materia tiene que aparecer aquí, o no sobrevive a la
     siguiente carga. Object.hasOwn y no «in»: «constructor» está en cualquier
     objeto y no es una suite. */
  const ofimatica = texto(m.ofimatica).trim();
  const materia = {
    id: texto(m.id).trim() || identificador(),
    clase,
    nombre: texto(m.nombre).trim() || `Materia ${posicion + 1}`,
    clave: texto(m.clave).trim(),
    carpeta: texto(m.carpeta).trim(),
    cuaderno: texto(m.cuaderno).trim(),
    ...(Object.hasOwn(SUITES, ofimatica) ? { ofimatica } : {}),
    sesiones: soloObjetos(m.sesiones).map(normalizarSesion),
  };
  ordenarSesiones(materia);
  return materia;
}

/**
 * Acepta cualquier respaldo del panel, de esta versión o de la anterior,
 * y devuelve datos completos en la versión vigente.
 * Lanza ErrorDeDatos con un mensaje legible si el archivo no es un respaldo.
 */
export function migrar(entrada) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    throw new ErrorDeDatos("El archivo no tiene datos de Pauta: se esperaba un objeto JSON.");
  }
  if (!Array.isArray(entrada.materias)) {
    throw new ErrorDeDatos('El archivo no tiene la lista "materias". No son datos de Pauta.');
  }
  if (entrada.materias.length === 0) {
    throw new ErrorDeDatos("El archivo no tiene ninguna materia. No se cargó nada para no borrar lo que ya tienes.");
  }

  const materias = soloObjetos(entrada.materias).map(normalizarMateria);
  if (!materias.length) {
    throw new ErrorDeDatos("Ninguna materia del archivo se pudo leer: está dañado.");
  }

  // Tipos propios: los declarados en el respaldo más los que aparezcan en los
  // recursos y no estén entre los de base. Así nunca se pierde un tipo propio.
  const declarados = Array.isArray(entrada.tipos) ? entrada.tipos.map((t) => texto(t).trim().toLowerCase()) : [];
  const usados = materias.flatMap((m) => m.sesiones.flatMap((s) => s.recursos.map((r) => r.tipo)));
  const tipos = [...new Set([...declarados, ...usados])].filter((t) => t && !TIPOS_BASE.includes(t)).sort();

  return { version: VERSION_DATOS, tipos, materias };
}

/* ---------- Operaciones sobre el modelo ---------- */

/** Todos los tipos disponibles: los de base más los propios. */
export function tiposDisponibles(datos) {
  return [...TIPOS_BASE, ...(datos?.tipos || [])];
}

/** Registra un tipo propio si aún no existe. Devuelve el tipo normalizado. */
export function registrarTipo(datos, nombre) {
  const tipo = texto(nombre).trim().toLowerCase();
  if (!tipo) return "";
  if (!TIPOS_BASE.includes(tipo) && !datos.tipos.includes(tipo)) {
    datos.tipos.push(tipo);
    datos.tipos.sort();
  }
  return tipo;
}

/**
 * Minutos desde el inicio de la sesión que declara un campo "momento".
 * Reconoce "0:15–0:40", "1:05", "45 min" y "45". Devuelve null cuando el texto
 * no empieza con un tiempo ("previa", "referencia", "cierre", vacío).
 */
export function minutosDe(momento) {
  const texto = String(momento || "").trim();
  if (!texto) return null;

  const conHoras = texto.match(/^(\d{1,2})\s*[:.]\s*([0-5]?\d)/);
  if (conHoras) return Number(conHoras[1]) * 60 + Number(conHoras[2]);

  const soloMinutos = texto.match(/^(\d{1,3})(?!\s*[:.]?\d)/);
  return soloMinutos ? Number(soloMinutos[1]) : null;
}

/**
 * Acomoda los recursos de la sesión según el minuto que declara cada uno.
 *
 * Los que no declaran minuto ("previa", "referencia") no se van al final: se
 * quedan pegados al recurso con minuto que los precede, y viajan con él. Los
 * que están antes de cualquier minuto se quedan al principio.
 *
 * El orden es estable: entre dos recursos con el mismo minuto se respeta el
 * orden que ya tenían, que es el que se fijó con Subir y Bajar.
 */
export function ordenarRecursosPorMomento(sesion) {
  if (!sesion?.recursos?.length) return;

  let heredado = -1; // antes del primer minuto declarado
  const marcados = sesion.recursos.map((recurso, orden) => {
    const propio = minutosDe(recurso.momento);
    if (propio !== null) heredado = propio;
    return { recurso, clave: propio !== null ? propio : heredado, orden };
  });

  marcados.sort((a, b) => a.clave - b.clave || a.orden - b.orden);
  sesion.recursos = marcados.map((m) => m.recurso);
}

/**
 * Mete un recurso en la sesión, en el lugar que le toca por sus minutos, sin
 * reacomodar nada más: el orden que la sesión ya tenía se queda como estaba.
 * Un recurso sin minutos se va al final. Devuelve la posición en que quedó.
 */
export function insertarPorMomento(sesion, recurso) {
  const minutos = minutosDe(recurso.momento);
  if (minutos === null) {
    sesion.recursos.push(recurso);
    return sesion.recursos.length - 1;
  }

  let heredado = -1;
  const claves = sesion.recursos.map((r) => {
    const propio = minutosDe(r.momento);
    if (propio !== null) heredado = propio;
    return heredado;
  });

  const siguiente = claves.findIndex((clave) => clave > minutos);
  const posicion = siguiente === -1 ? sesion.recursos.length : siguiente;
  sesion.recursos.splice(posicion, 0, recurso);
  return posicion;
}

/** Ordena las sesiones por fecha. Las que no tienen fecha quedan al final. */
export function ordenarSesiones(materia) {
  if (!materia?.sesiones) return;
  materia.sesiones.sort((a, b) => {
    const da = aFecha(a.fecha);
    const db = aFecha(b.fecha);
    if (da && db) return da - db;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
}

/** La sesión vigente es la primera cuya fecha aún no pasa.
 *  Si todas ya pasaron, es la última. Si ninguna tiene fecha, la primera. */
export function indiceVigente(materia) {
  const sesiones = materia?.sesiones || [];
  if (!sesiones.length) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const i = sesiones.findIndex((s) => {
    const d = aFecha(s.fecha);
    return d && d >= hoy;
  });
  return i >= 0 ? i : sesiones.length - 1;
}

/** Copia una sesión con sus recursos, con los estados reiniciados. */
export function copiaDeSesion(sesion, { num, fecha, titulo }) {
  return {
    num,
    fecha: fecha || "",
    titulo: titulo || sesion.titulo,
    proposito: sesion.proposito,
    bitacora: "",
    recursos: sesion.recursos.map((r) => ({ ...r, estado: "pendiente" })),
  };
}

export function materiaNueva(campos) {
  return { id: identificador(), sesiones: [], ...campos };
}

/* ---------- Copiar una materia ---------- */

/* Las dos maneras de copiar una materia sirven a usos opuestos:
 *
 *   semestre    — volver a dar el mismo curso otro semestre. Conserva los
 *                 recursos CON sus ligas, y también la carpeta, el cuaderno y
 *                 la suite de ofimática: es tuyo y quieres los mismos
 *                 materiales.
 *   estructura  — empezar otro curso o un taller, o compartir el esqueleto.
 *                 Quita TODAS las ligas y deja sesiones, propósitos, títulos,
 *                 tipos, momentos y notas de uso.
 *
 * En las dos las bitácoras se quedan fuera y todos los recursos vuelven a
 * «pendiente»: son de la vez anterior. */

export const MARCA_DE_LIGA_QUITADA = "[liga quitada]";

/* Ligas web y de aplicación de escritorio. Se reconocen por el esquema, no por
   el dominio: lo que se quiere es no dejar ninguna dirección, sea de quien sea. */
const LIGA_EN_TEXTO =
  /(?:onenote:)?(?:https?|file):\/\/[^\s<>"]+|(?:obsidian|zotero|ms-word|ms-powerpoint|ms-excel|ms-onenote|onenote):\/\/[^\s<>"]+|mailto:[^\s<>"]+/gi;

/**
 * Quita las direcciones escritas DENTRO de un texto libre. Antes la plantilla
 * vaciaba el campo «liga» de cada recurso pero dejaba las que la usuaria
 * había pegado en una nota o en un propósito, y la promesa era «sin filtrar
 * tus URLs». Queda una marca en su lugar para que la nota se siga leyendo
 * («Lee esto: [liga quitada]») y se note que allí había algo.
 * La puntuación que cierra la frase se conserva.
 */
export function quitarLigasDeTexto(crudo) {
  return String(crudo ?? "").replace(LIGA_EN_TEXTO, (liga) => {
    const cola = liga.match(/[.,;:)]+$/)?.[0] || "";
    return MARCA_DE_LIGA_QUITADA + cola;
  });
}

/** Cuántos días hay que mover las fechas para que la primera caiga en `primeraFecha`. */
function desplazamientoDeFechas(sesiones, primeraFecha) {
  const destino = aFecha(primeraFecha);
  const fechas = sesiones.map((s) => aFecha(s.fecha)).filter(Boolean);
  if (!destino || !fechas.length) return 0;
  const primera = new Date(Math.min(...fechas));
  return Math.round((destino - primera) / 86_400_000); // el redondeo absorbe el cambio de horario
}

/**
 * Copia de una materia, lista para agregarse al panel o para descargarse.
 * No modifica la original. Opciones:
 *   modo          "semestre" (por omisión) o "estructura"
 *   nombre, clave, clase   para poner otros; si faltan se conservan
 *   primeraFecha  «AAAA-MM-DD»: mueve todas las fechas para que la primera
 *                 sesión caiga ese día, conservando los intervalos. Sin ella,
 *                 las fechas se conservan tal cual.
 */
export function copiaDeMateria(materia, opciones = {}) {
  const conRecursos = opciones.modo !== "estructura";
  const libre = (t) => (conRecursos ? texto(t) : quitarLigasDeTexto(t));
  const dias = desplazamientoDeFechas(materia.sesiones || [], opciones.primeraFecha);
  const mover = (fecha) => (dias && aFecha(fecha) ? sumarDias(fecha, dias) : texto(fecha));

  return {
    id: identificador(),
    clase: CLASES.includes(opciones.clase) ? opciones.clase : materia.clase || "curso",
    nombre: texto(opciones.nombre).trim() || materia.nombre,
    clave: opciones.clave === undefined ? materia.clave : texto(opciones.clave).trim(),
    carpeta: conRecursos ? texto(materia.carpeta) : "",
    cuaderno: conRecursos ? texto(materia.cuaderno) : "",
    ...(conRecursos && Object.hasOwn(SUITES, materia.ofimatica) ? { ofimatica: materia.ofimatica } : {}),
    sesiones: (materia.sesiones || []).map((s) => ({
      num: s.num,
      fecha: mover(s.fecha),
      titulo: libre(s.titulo),
      proposito: libre(s.proposito),
      bitacora: "",
      recursos: (s.recursos || []).map((r) => ({
        titulo: libre(r.titulo),
        tipo: r.tipo,
        momento: r.momento,
        url: conRecursos ? texto(r.url) : "",
        nota: libre(r.nota),
        estado: "pendiente",
      })),
    })),
  };
}
