/* =========================================================
   Memoria del archivo vinculado.

   La File System Access API entrega un "handle" (aquí, manija) que representa
   el archivo elegido. Ese objeto se puede guardar en IndexedDB y recuperarlo
   la próxima vez, pero NO en localStorage, porque no sobrevive a JSON.

   Es lo único para lo que se usa IndexedDB en este proyecto.
   ========================================================= */

const BASE = "panel-de-clases";
const ALMACEN = "manijas";
const CLAVE = "archivo";

function abrirBase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Este navegador no tiene IndexedDB."));
      return;
    }
    const solicitud = window.indexedDB.open(BASE, 1);
    solicitud.onupgradeneeded = () => {
      const bd = solicitud.result;
      if (!bd.objectStoreNames.contains(ALMACEN)) bd.createObjectStore(ALMACEN);
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error || new Error("No se pudo abrir IndexedDB."));
  });
}

function operar(modo, accion) {
  return abrirBase().then(
    (bd) =>
      new Promise((resolve, reject) => {
        const transaccion = bd.transaction(ALMACEN, modo);
        const peticion = accion(transaccion.objectStore(ALMACEN));
        transaccion.oncomplete = () => {
          bd.close();
          resolve(peticion ? peticion.result : undefined);
        };
        transaccion.onabort = transaccion.onerror = () => {
          bd.close();
          reject(transaccion.error || new Error("Falló la operación en IndexedDB."));
        };
      })
  );
}

export async function recordar(manija) {
  try {
    await operar("readwrite", (almacen) => almacen.put(manija, CLAVE));
  } catch {
    /* Si no se puede recordar, el vínculo solo dura esta sesión. */
  }
}

export async function recuperar() {
  try {
    return (await operar("readonly", (almacen) => almacen.get(CLAVE))) || null;
  } catch {
    return null;
  }
}

export async function olvidar() {
  try {
    await operar("readwrite", (almacen) => almacen.delete(CLAVE));
  } catch {
    /* nada que hacer */
  }
}
