/* =========================================================
   Vocabulario según lo que se esté planeando.

   La estructura es la misma para los tres casos —algo que contiene
   encuentros, y cada encuentro contiene recursos—, pero las palabras no:
   un curso tiene sesiones, un taller tiene bloques y una ponencia se da
   una o varias veces ante públicos distintos. Llamarle «Sesión 01» a una
   ponencia es lo que hace que la herramienta se sienta ajena a quien no
   da clase frente a grupo.

   Solo cambian rótulos y textos de ayuda. Ni los datos ni las vistas
   saben de esto: piden la palabra que toca y siguen.
   ========================================================= */

export const CLASES = ["curso", "taller", "ponencia"];

const VOCES = {
  curso: {
    etiqueta: "Curso",
    plural: "Materias",
    nueva: "Nueva materia",
    campoNombre: "Nombre de la materia",
    campoClave: "Nivel y periodo",
    ejemploClave: "Posgrado · Otoño 2026",
    encuentro: "Sesión",
    encuentros: "Sesiones",
    encuentrosDe: "Sesiones del curso",
    vigente: "Sesión vigente",
    nuevoEncuentro: "+ Sesión",
    verTodos: "Ver todas las sesiones del curso",
    verVigente: "Mostrar solo la sesión vigente",
    vistaGeneral: "Vista de semestre",
    tituloVistaGeneral: "Vista de semestre",
    resumenVistaGeneral: "Todas las sesiones de la materia, para revisar el temario completo de un vistazo.",
    sinEncuentros: "Sin sesiones todavía",
    primerEncuentro: "Agrega la primera sesión desde el panel de la izquierda.",
  },
  taller: {
    etiqueta: "Taller",
    plural: "Talleres",
    nueva: "Nuevo taller",
    campoNombre: "Nombre del taller",
    campoClave: "Sede y fecha",
    ejemploClave: "IBERO CDMX · marzo 2027",
    encuentro: "Bloque",
    encuentros: "Bloques",
    encuentrosDe: "Bloques del taller",
    vigente: "Bloque en curso",
    nuevoEncuentro: "+ Bloque",
    verTodos: "Ver todos los bloques del taller",
    verVigente: "Mostrar solo el bloque en curso",
    vistaGeneral: "Vista del taller",
    tituloVistaGeneral: "Vista del taller",
    resumenVistaGeneral: "Todos los bloques del taller, para revisar el recorrido completo de un vistazo.",
    sinEncuentros: "Sin bloques todavía",
    primerEncuentro: "Agrega el primer bloque desde el panel de la izquierda.",
  },
  ponencia: {
    etiqueta: "Ponencia",
    plural: "Ponencias",
    nueva: "Nueva ponencia",
    campoNombre: "Título de la ponencia",
    campoClave: "Evento y sede",
    ejemploClave: "Congreso AMIC · Guadalajara",
    // Una ponencia puede darse más de una vez: cada presentación es una
    // ocasión distinta, con su fecha, su público y su propia bitácora.
    encuentro: "Presentación",
    encuentros: "Presentaciones",
    encuentrosDe: "Presentaciones de esta ponencia",
    vigente: "Próxima presentación",
    nuevoEncuentro: "+ Presentación",
    verTodos: "Ver todas las presentaciones",
    verVigente: "Mostrar solo la próxima presentación",
    vistaGeneral: "Ver todas las presentaciones",
    tituloVistaGeneral: "Presentaciones",
    resumenVistaGeneral: "Todas las ocasiones en que se ha dado o se dará esta ponencia.",
    sinEncuentros: "Sin presentaciones todavía",
    primerEncuentro: "Agrega la primera presentación desde el panel de la izquierda.",
  },
};

/** Las palabras de una materia. Lo desconocido cae en «curso». */
export function voz(materia) {
  return VOCES[materia?.clase] || VOCES.curso;
}

/** Rótulo de la lista lateral, que puede mezclar las tres clases. */
export function rotuloDeLaLista(materias = []) {
  const clases = new Set(materias.map((m) => m?.clase || "curso"));
  if (clases.size === 1) return VOCES[[...clases][0]].plural;
  return "Actividades";
}
