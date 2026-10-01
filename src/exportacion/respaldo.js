/* «Descargar mis datos» (todo, en JSON) y la descarga de «Duplicar materia». */

import { descargar, nombreLimpio } from "./descargar.js";
import { VERSION_DATOS, copiaDeMateria } from "../datos/modelo.js";

/** Respaldo completo: todo lo que hay en el panel, tal cual. */
export function exportarRespaldo(datos) {
  descargar("panel-de-clases.json", JSON.stringify(datos, null, 2), "application/json");
}

/**
 * Descarga una copia de la materia, según las opciones (ver copiaDeMateria en
 * datos/modelo.js): «semestre» conserva los recursos con sus ligas para volver a
 * dar el mismo curso, y «estructura» deja solo el esqueleto, sin ninguna liga,
 * para empezar otro curso o un taller, o para compartirla sin filtrar
 * direcciones. Antes había una sola, la de estructura, y aun así dejaba las
 * ligas que estaban escritas dentro de las notas.
 */
export function exportarPlantilla(materia, opciones = {}) {
  const copia = copiaDeMateria(materia, opciones);
  const plantilla = {
    version: VERSION_DATOS,
    tipos: [...new Set(copia.sesiones.flatMap((s) => s.recursos.map((r) => r.tipo)))].sort(),
    materias: [copia],
  };

  const prefijo = opciones.modo === "estructura" ? "estructura" : "copia";
  descargar(
    `${prefijo}-${nombreLimpio(copia.nombre, copia.id)}.json`,
    JSON.stringify(plantilla, null, 2),
    "application/json"
  );
  return copia;
}
