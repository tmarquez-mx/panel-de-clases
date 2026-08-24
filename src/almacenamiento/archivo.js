/* =========================================================
   Guardado en un archivo .json del disco (File System Access API).

   Disponible en Chrome y Edge, en contexto seguro (https o localhost).
   No existe en Firefox, en Safari ni al abrir el panel con doble clic
   (file://). El gestor consulta soportado() antes de ofrecerlo.

   Misma interfaz que local.js, más las funciones de vínculo.
   ========================================================= */

import * as manijas from "./manijas.js";

const TIPOS_DE_ARCHIVO = [
  { description: "Respaldo del panel de clases", accept: { "application/json": [".json"] } },
];

export function soportado() {
  return (
    typeof window.showSaveFilePicker === "function" &&
    typeof window.showOpenFilePicker === "function" &&
    window.isSecureContext === true
  );
}

/** Pide al usuario un archivo nuevo donde escribir. Devuelve la manija o null si canceló. */
export async function elegirNuevo(nombreSugerido = "panel-de-clases.json") {
  try {
    return await window.showSaveFilePicker({
      suggestedName: nombreSugerido,
      types: TIPOS_DE_ARCHIVO,
    });
  } catch (error) {
    if (error?.name === "AbortError") return null;
    throw error;
  }
}

/** Pide un archivo existente para abrirlo y seguir escribiendo en él. */
export async function elegirExistente() {
  try {
    const [manija] = await window.showOpenFilePicker({ types: TIPOS_DE_ARCHIVO, multiple: false });
    return manija || null;
  } catch (error) {
    if (error?.name === "AbortError") return null;
    throw error;
  }
}

/**
 * Estado del permiso sobre la manija: "granted", "prompt" o "denied".
 * Con pedir=true se le solicita al usuario, lo que exige un gesto suyo
 * (un clic): si se llama al cargar la página, el navegador lo rechaza.
 */
export async function permiso(manija, pedir = false) {
  if (!manija?.queryPermission) return "denied";
  const opciones = { mode: "readwrite" };
  let estado = await manija.queryPermission(opciones);
  if (estado === "prompt" && pedir) estado = await manija.requestPermission(opciones);
  return estado;
}

export async function leer(manija) {
  const archivo = await manija.getFile();
  const texto = await archivo.text();
  return texto.trim() ? JSON.parse(texto) : null;
}

export async function escribir(manija, datos) {
  const flujo = await manija.createWritable();
  try {
    await flujo.write(JSON.stringify(datos, null, 2));
  } finally {
    await flujo.close();
  }
}

/* El vínculo se recuerda solo cuando el gestor adopta el archivo, nunca al
   elegirlo: si el archivo resulta no ser un respaldo, no debe quedar recordado. */
export const recordar = manijas.recordar;
export const recordada = manijas.recuperar;
export const olvidar = manijas.olvidar;
