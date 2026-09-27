/* Clasificación y validación de ligas.
   Nunca se hace fetch a las ligas: la restricción de origen cruzado lo impide
   y cualquier resultado sería un falso negativo. Se valida solo la forma. */

export const esLocal = (u) => /^file:\/\//i.test(String(u || "").trim());
export const esWeb = (u) => /^https?:\/\//i.test(String(u || "").trim());

/* Reconocer de qué nube es una liga vive en datos/nubes.js: esto era
   esNube(), que solo sabía de dominios de Microsoft y hacía que el panel
   etiquetara «OneDrive» cualquier liga de la nube, fuera de quien fuera. */

/* Esquemas que el panel acepta abrir o mostrar como enlace.
   Todo lo demás (javascript:, data:, vbscript:, blob:) se bloquea: un respaldo
   ajeno podría traer una liga preparada para ejecutar código en el panel. */
const ESQUEMAS_PERMITIDOS = new Set([
  "http:", "https:", "file:", "mailto:", "obsidian:", "onenote:", "zotero:",
  "ms-word:", "ms-powerpoint:", "ms-excel:", "ms-onenote:", "otpauth:",
]);

/** Esquemas de aplicación de escritorio: abren solo si el programa está instalado. */
const ESQUEMAS_DE_APP = new Set([
  "obsidian:", "onenote:", "zotero:", "ms-word:", "ms-powerpoint:", "ms-excel:", "ms-onenote:",
]);

/** Analiza la liga. Devuelve null si no tiene forma de URL. */
function analizar(u) {
  const texto = String(u || "").trim();
  if (!texto) return null;
  try {
    return new URL(texto);
  } catch {
    return null;
  }
}

/** true solo si la liga se puede abrir o poner en un href sin riesgo. */
export function urlSegura(u) {
  const url = analizar(u);
  return !!url && ESQUEMAS_PERMITIDOS.has(url.protocol.toLowerCase());
}

/**
 * Revisa la forma de una liga. Categorías:
 *  vacia       — no hay liga
 *  local       — file://, no abre con un clic ni existe en otra computadora
 *  malformada  — no tiene forma de URL (falta el https://, sobra un espacio)
 *  bloqueada   — esquema que el panel no abre por seguridad
 *  app         — abre solo si el programa está instalado en esa computadora
 *  ok          — http o https bien formada
 */
export function revisarUrl(u) {
  const texto = String(u || "").trim();
  if (!texto) return { clase: "vacia", mensaje: "Sin liga: el recurso no se puede abrir desde el panel." };

  const url = analizar(texto);
  if (!url) {
    return {
      clase: "malformada",
      mensaje: "No tiene forma de liga. Suele faltar el https:// al principio o sobrar un espacio.",
    };
  }

  const protocolo = url.protocol.toLowerCase();
  if (protocolo === "file:") {
    return {
      clase: "local",
      mensaje: "Ruta local: no abre con un clic desde el navegador y no existe en otra computadora.",
    };
  }
  if (!ESQUEMAS_PERMITIDOS.has(protocolo)) {
    return { clase: "bloqueada", mensaje: `El panel no abre ligas ${protocolo} por seguridad.` };
  }
  if (ESQUEMAS_DE_APP.has(protocolo)) {
    return {
      clase: "app",
      mensaje: "Liga de una aplicación de escritorio: abre solo si ese programa está instalado aquí.",
    };
  }
  return { clase: "ok", mensaje: "" };
}

/**
 * Procedencia legible de una liga: el dominio, o el nombre del archivo si es
 * una ruta local. Sirve para mostrar de dónde viene un recurso sin desplegar
 * una URL entera —las de la nube traen claves larguísimas—, sin perder el
 * acceso a la dirección completa, que sigue en el título y en «Copiar liga».
 */
export function procedencia(u) {
  const texto = String(u || "").trim();
  if (!texto) return "";
  if (esLocal(texto)) {
    const partes = texto.split(/[\\/]/).filter(Boolean);
    return partes[partes.length - 1] || "archivo local";
  }
  const url = analizar(texto);
  if (!url) return "";
  if (!/^https?:$/i.test(url.protocol)) return url.protocol.replace(":", "");
  return url.hostname.replace(/^www\./i, "");
}
