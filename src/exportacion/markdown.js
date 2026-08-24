/* Exportación de la materia activa a Markdown. */

import { descargar, nombreLimpio } from "./descargar.js";
import { fechaLarga } from "../util/fechas.js";

export function exportarMarkdown(materia) {
  const lineas = [`# ${materia.nombre}`, ""];
  if (materia.clave) lineas.push(`_${materia.clave}_`, "");
  if (materia.carpeta) lineas.push(`Carpeta del curso: ${materia.carpeta}`);
  if (materia.cuaderno) lineas.push(`Cuaderno del curso: ${materia.cuaderno}`);

  materia.sesiones.forEach((s, i) => {
    const num = String(s.num || i + 1).padStart(2, "0");
    lineas.push("", `## Sesión ${num} · ${fechaLarga(s.fecha)}`, "", `**${s.titulo}**`, "");
    if (s.proposito) lineas.push(s.proposito, "");

    if (!s.recursos.length) lineas.push("_Sin recursos._", "");
    for (const r of s.recursos) {
      lineas.push(`- [${r.tipo}] **${r.titulo}**${r.momento ? ` (${r.momento})` : ""}`);
      if (r.url) lineas.push(`  - ${r.url}`);
      if (r.nota) lineas.push(`  - ${r.nota}`);
    }

    if (s.bitacora) {
      lineas.push("");
      // Cada renglón de la bitácora lleva su propio ">" para que la cita no se rompa.
      for (const renglon of s.bitacora.split("\n")) lineas.push(`> ${renglon}`);
    }
  });

  descargar(
    `${nombreLimpio(materia.nombre, materia.id)}.md`,
    lineas.join("\n") + "\n",
    "text/markdown;charset=utf-8"
  );
}
