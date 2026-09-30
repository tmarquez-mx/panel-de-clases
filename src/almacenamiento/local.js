/* =========================================================
   Guardado en el navegador (localStorage).

   Interfaz común de la capa de almacenamiento:
     disponible()  -> boolean
     leer()        -> objeto | null
     escribir(datos)
     borrar()

   localStorage no está disponible en todos lados: Safari lo bloquea en
   navegación privada y algunos navegadores lo desactivan en file://.
   Por eso cada llamada va dentro de try/catch y el panel degrada a memoria.
   ========================================================= */

const CLAVE = "panel-de-clases:datos";

export function disponible() {
  try {
    const prueba = "panel-de-clases:prueba";
    window.localStorage.setItem(prueba, "1");
    window.localStorage.removeItem(prueba);
    return true;
  } catch {
    return false;
  }
}

export function leer() {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    // JSON corrupto o acceso bloqueado: se ignora y se sigue sin datos previos.
    return null;
  }
}

export function escribir(datos) {
  window.localStorage.setItem(CLAVE, JSON.stringify(datos));
}

export function borrar() {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    /* nada que hacer */
  }
}

/* ---------------------------------------------------------
   Última versión en que el archivo vinculado y este navegador coincidieron.

   Es lo que permite saber QUIÉN cambió algo. Con solo dos versiones, la del
   archivo y la del navegador, no se puede distinguir «la otra computadora
   guardó» de «yo escribí sin conexión»: las dos se ven como «distinta». Con
   una tercera, la de la última vez que coincidieron, sí: si el archivo se
   apartó de ella cambió afuera, y si el navegador se apartó cambió aquí.

   Se guarda aparte y no dentro de los datos porque es del vínculo con un
   archivo, no de la planeación: no debe viajar en un respaldo ni en la
   plantilla de un curso.

   Devuelve null cuando no hay nada guardado. El cero es un valor válido:
   significa «el archivo estaba vacío».
   --------------------------------------------------------- */

const CLAVE_BASE = "panel-de-clases:sello-base";

export function leerBase() {
  try {
    const crudo = window.localStorage.getItem(CLAVE_BASE);
    if (crudo === null) return null;
    const n = Number(crudo);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function escribirBase(sello) {
  try {
    window.localStorage.setItem(CLAVE_BASE, String(sello));
  } catch {
    /* sin espacio: se pierde la referencia y el gestor cae a comparar sellos */
  }
}

export function borrarBase() {
  try {
    window.localStorage.removeItem(CLAVE_BASE);
  } catch {
    /* nada que hacer */
  }
}

/* ---------------------------------------------------------
   Copias de seguridad rotativas.

   Sirven para volver atrás: se importó el respaldo equivocado, se borró algo
   sin darse cuenta, o se descubre el martes que el lunes faltaba media sesión.

   El reparto importa más que el número. Guardar una copia con cada dato que
   se captura suena a más seguridad y es lo contrario: en diez minutos de
   trabajo las tres ranuras quedarían ocupadas por tres versiones casi
   idénticas de hace un rato, y el estado de ayer —el único al que de verdad
   se querría volver— ya se habría perdido. Por eso se conserva en dos
   tramos:

     · las últimas seis versiones, densas, para deshacer lo reciente;
     · una por día de los siete días anteriores, para volver más atrás.

   Mientras se trabaja se archiva sola cada pocos minutos, no con cada tecla.
   Antes de una operación que sustituye todo se archiva siempre, sin esperar.

   Este archivo de copias nunca debe estorbar al guardado normal: si no cabe,
   se sacrifican las copias viejas, y si aun así no cabe, se abandona en
   silencio. Perder una copia es un inconveniente; perder el guardado, no.
   --------------------------------------------------------- */

const CLAVE_COPIAS = "panel-de-clases:copias";
const MAXIMO_RECIENTES = 6;
const DIAS_CONSERVADOS = 7;

/** Minutos mínimos entre dos copias tomadas mientras se trabaja. */
export const MINUTOS_ENTRE_COPIAS = 4;

export function leerCopias() {
  try {
    const crudo = JSON.parse(window.localStorage.getItem(CLAVE_COPIAS));
    return Array.isArray(crudo) ? crudo : [];
  } catch {
    return [];
  }
}

const diaDe = (iso) => String(iso || "").slice(0, 10); // AAAA-MM-DD

/** Deja las recientes completas y, de lo anterior, la última de cada día. */
function podar(copias) {
  const recientes = copias.slice(0, MAXIMO_RECIENTES);
  const diasYaVistos = new Set(recientes.map((c) => diaDe(c.fecha)));
  const porDia = [];

  for (const copia of copias.slice(MAXIMO_RECIENTES)) {
    const dia = diaDe(copia.fecha);
    if (diasYaVistos.has(dia)) continue; // ya hay una de ese día
    diasYaVistos.add(dia);
    porDia.push(copia);
    if (porDia.length >= DIAS_CONSERVADOS) break;
  }
  return [...recientes, ...porDia];
}

function escribirCopias(copias) {
  let lista = podar(copias);
  while (lista.length) {
    try {
      window.localStorage.setItem(CLAVE_COPIAS, JSON.stringify(lista));
      return;
    } catch {
      lista = lista.slice(0, -1); // sin espacio: se suelta la más vieja
    }
  }
  try {
    window.localStorage.removeItem(CLAVE_COPIAS);
  } catch {
    /* nada que hacer */
  }
}

/**
 * Archiva el estado actual, si es distinto del último archivado.
 * @param {object} datos
 * @param {string} motivo        qué provocó la copia, para la lista
 * @param {number} minutosMinimos  si ya hay una copia más nueva que esto, no
 *                                 se archiva. Cero o sin valor: archiva siempre.
 * @returns {boolean} si llegó a archivar
 */
export function archivarCopia(datos, motivo, minutosMinimos = 0) {
  if (!datos || !disponible()) return false;
  try {
    const copias = leerCopias();

    if (minutosMinimos > 0 && copias.length) {
      const desde = Date.now() - new Date(copias[0].fecha).getTime();
      if (desde < minutosMinimos * 60_000) return false;
    }

    const texto = JSON.stringify(datos);
    if (copias.length && JSON.stringify(copias[0].datos) === texto) return false;

    copias.unshift({ fecha: new Date().toISOString(), motivo, datos: JSON.parse(texto) });
    escribirCopias(copias);
    return true;
  } catch {
    /* el archivo de copias es un extra: nunca detiene nada */
    return false;
  }
}
