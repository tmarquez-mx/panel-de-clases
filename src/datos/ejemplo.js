/* =========================================================
   Datos de ejemplo. Dos materias ficticias.

   No hay ninguna liga real: las ligas de la nube —OneDrive, SharePoint,
   Drive, Dropbox— llevan claves de uso compartido y apuntan a una cuenta
   concreta, así que nunca deben quedar escritas en el repositorio.

   Estos datos solo se usan la primera vez que se abre el panel, cuando no hay
   nada guardado. En cuanto se guarda algo, dejan de aparecer.
   ========================================================= */

export const DATOS_DE_EJEMPLO = {
  version: 2,
  tipos: [],
  materias: [
    {
      id: "ejemplo-seminario",
      nombre: "Seminario de ejemplo",
      clave: "Posgrado · Otoño 2026",
      carpeta: "",
      cuaderno: "",
      sesiones: [
        {
          num: 1,
          fecha: "2026-09-01",
          titulo: "Cómo está armado este panel",
          proposito: "Recorrer la sesión de ejemplo antes de cargar el respaldo propio.",
          bitacora: "Esta es la bitácora: se escribe aquí mismo y sale en la exportación a Markdown.",
          recursos: [
            {
              titulo: "Recurso con liga web",
              tipo: "liga",
              momento: "0:00–0:10",
              url: "https://example.org/lectura",
              nota: "Las ligas https abren en otra pestaña y entran en «Abrir todo».",
              estado: "listo",
            },
            {
              titulo: "Recurso con ruta local",
              tipo: "lectura",
              momento: "0:10–0:30",
              url: "file:///ruta/de/ejemplo/lectura.pdf",
              nota: "Sirve para ver el aviso de ruta local y lo que marca «Revisar enlaces».",
              estado: "pendiente",
            },
            {
              titulo: "Actividad sin liga",
              tipo: "actividad",
              momento: "0:30–0:50",
              url: "",
              nota: "No todo recurso necesita archivo. Este solo existe como indicación de clase.",
              estado: "pendiente",
            },
          ],
        },
        {
          num: 2,
          fecha: "2026-09-08",
          titulo: "Segunda sesión de ejemplo",
          proposito: "Mostrar el orden automático por fecha y la etiqueta «vigente».",
          bitacora: "",
          recursos: [
            {
              titulo: "Guion de la sesión",
              tipo: "apunte",
              momento: "referencia",
              url: "",
              nota: "Tiempos, preguntas de arranque y cierre.",
              estado: "pendiente",
            },
          ],
        },
      ],
    },
    {
      id: "ejemplo-taller",
      nombre: "Taller de ejemplo",
      clave: "Licenciatura · Otoño 2026",
      carpeta: "",
      cuaderno: "",
      sesiones: [
        {
          num: 1,
          fecha: "2026-09-03",
          titulo: "Una materia sin sesiones pasadas",
          proposito: "Comprobar que cada materia recuerda su propia sesión vigente.",
          bitacora: "",
          recursos: [
            {
              titulo: "Presentación de arranque",
              tipo: "presentación",
              momento: "0:00–0:15",
              url: "",
              nota: "Sustituir por la liga del archivo real, esté en la nube que esté.",
              estado: "pendiente",
            },
          ],
        },
      ],
    },
  ],
};
