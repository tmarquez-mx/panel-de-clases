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
   Copias de seguridad rotativas.

   Se guardan las últimas tres versiones distintas, para poder volver atrás si
   se importa el respaldo equivocado o si se descubre tarde que faltaba algo.
   No se archiva con cada tecla: solo al abrir el panel y antes de las
   operaciones que sustituyen todo.

   Este archivo de copias nunca debe estorbar al guardado normal: si no cabe,
   se sacrifican las copias viejas, y si aun así no cabe, se abandona en
   silencio. Perder una copia es un inconveniente; perder el guardado, no.
   --------------------------------------------------------- */

const CLAVE_COPIAS = "panel-de-clases:copias";
const MAXIMO_COPIAS = 3;

export function leerCopias() {
  try {
    const crudo = JSON.parse(window.localStorage.getItem(CLAVE_COPIAS));
    return Array.isArray(crudo) ? crudo : [];
  } catch {
    return [];
  }
}

function escribirCopias(copias) {
  let lista = copias.slice(0, MAXIMO_COPIAS);
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

/** Archiva el estado actual, si es distinto del último archivado. */
export function archivarCopia(datos, motivo) {
  if (!datos || !disponible()) return;
  try {
    const copias = leerCopias();
    const texto = JSON.stringify(datos);
    if (copias.length && JSON.stringify(copias[0].datos) === texto) return;
    copias.unshift({ fecha: new Date().toISOString(), motivo, datos: JSON.parse(texto) });
    escribirCopias(copias);
  } catch {
    /* el archivo de copias es un extra: nunca detiene nada */
  }
}
