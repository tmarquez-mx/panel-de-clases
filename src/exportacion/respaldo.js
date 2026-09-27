/* Respaldo completo en JSON y plantilla de curso para compartir. */

import { descargar, nombreLimpio } from "./descargar.js";
import { VERSION_DATOS } from "../datos/modelo.js";

/** Respaldo completo: todo lo que hay en el panel, tal cual. */
export function exportarRespaldo(datos) {
  descargar("panel-de-clases.json", JSON.stringify(datos, null, 2), "application/json");
}

/**
 * Plantilla de una materia: la estructura del curso sin nada privado.
 * Se quitan las ligas (llevan tokens de uso compartido de la cuenta
 * institucional), las bitácoras y los estados. Queda lo que sirve a alguien
 * más: sesiones, fechas, títulos, propósitos, tipos, momentos y notas de uso.
 */
export function exportarPlantilla(materia) {
  const plantilla = {
    version: VERSION_DATOS,
    tipos: [...new Set(materia.sesiones.flatMap((s) => s.recursos.map((r) => r.tipo)))].sort(),
    materias: [
      {
        id: materia.id,
        // La clase viaja con la plantilla: un taller compartido debe llegar
        // como taller, no convertirse en curso al importarlo.
        clase: materia.clase || "curso",
        nombre: materia.nombre,
        clave: materia.clave,
        carpeta: "",
        cuaderno: "",
        sesiones: materia.sesiones.map((s) => ({
          num: s.num,
          fecha: s.fecha,
          titulo: s.titulo,
          proposito: s.proposito,
          bitacora: "",
          recursos: s.recursos.map((r) => ({
            titulo: r.titulo,
            tipo: r.tipo,
            momento: r.momento,
            url: "",
            nota: r.nota,
            estado: "pendiente",
          })),
        })),
      },
    ],
  };

  descargar(
    `plantilla-${nombreLimpio(materia.nombre, materia.id)}.json`,
    JSON.stringify(plantilla, null, 2),
    "application/json"
  );
}
