# Panel de clases

Organiza los materiales de un curso por materia y por sesión, y durante la clase deja
avanzar recurso por recurso sin buscar nada.

Está pensado para quien da clase con material disperso: PDFs, presentaciones, ligas,
artefactos hechos con IA, apuntes y actividades, repartidos entre la nube, el disco y
media docena de pestañas. El panel no guarda los archivos: guarda **el orden en que
los vas a usar**, y los abre cuando toca.

**Demostración: https://panel-de-clases.netlify.app** — se abre con dos materias de
ejemplo; nada de lo que escribas ahí sale de tu navegador.

- Sin servidor, sin cuentas, sin analítica. Todo corre en el cliente.
- Sin dependencias en tiempo de ejecución: ni frameworks, ni CSS de terceros, ni
  fuentes web. La página construida es **un solo archivo HTML** que funciona sin conexión.
- En español: la interfaz, el código y los comentarios.

---

## Cómo se usa

### Materias y sesiones

En la barra lateral se crean las **materias** (nombre, periodo, y las ligas fijas del
curso: la carpeta en la nube y el cuaderno de notas). Dentro de cada materia van las
**sesiones**, con número, fecha, título y propósito.

De forma predeterminada solo se ve **la sesión vigente**, que es la primera cuya fecha
todavía no pasa; si ya pasaron todas, la última. Lleva una etiqueta «vigente». Con
*Ver las N sesiones del curso* se despliega el temario completo, y se vuelve a plegar.
Las sesiones se ordenan solas por fecha; las que no tienen fecha se marcan en rojo.

### Recursos

Cada sesión cuelga sus recursos de un riel vertical. Un recurso tiene título, tipo,
momento de la sesión, liga y una nota que dice **para qué sirve en clase** — que suele
importar más que el archivo mismo.

- **Tipos**: lectura, artefacto, presentación, liga, apunte, video, actividad. Se
  pueden agregar tipos propios desde el mismo formulario, con «Otro tipo…».
- **Estado** en tres pasos: pendiente → listo → usado. El punto del riel cambia de
  color y los usados se atenúan, para ver de un vistazo qué falta preparar.
- **Ligas de la nube**: las de OneDrive, SharePoint y OneNote se detectan solas y se
  marcan con una etiqueta.
- **Rutas locales** (`file://`): se avisa que no abren con un clic desde el navegador y
  que no existen en otra computadora. Al presionar «Abrir», la ruta se copia al
  portapapeles para pegarla en el explorador de archivos.
- **Mover a…** pasa un recurso a otra sesión de la misma materia, con su liga, su nota
  y su estado.
- **Abrir todo** abre en pestañas todas las ligas web de la sesión, previa confirmación.

### El orden de los recursos

El orden de la lista es el orden de la clase. Se fija de tres maneras, y conviven:

- **Por los minutos.** Si el campo «Momento de la sesión» empieza con un tiempo
  (`0:15–0:40`, `1:05`, `45`), el recurso se acomoda solo en ese punto de la clase al
  guardar. Cambiar los minutos lo mueve al lugar que le toca.
- **A mano.** Subir y Bajar mueven cualquier recurso. Ese orden se respeta: solo se
  rehace cuando vuelves a cambiar los minutos de algún recurso.
- **A pedido.** El botón **Ordenar por minutos** acomoda la sesión entera de una vez.

Lo que no lleva minuto («previa», «referencia», «cierre») no se va al final: se queda
pegado al recurso con minuto al que sigue y viaja con él.

### Modo clase

Pantalla completa en negro, un recurso a la vez, con barra de progreso segmentada.
Flechas izquierda y derecha para avanzar, **Escape** para salir, y un botón para abrir
el recurso visible sin salir del modo. El resto de la página queda fuera del recorrido
del teclado mientras dura.

Arriba a la derecha corre el **reloj de la sesión**: los minutos transcurridos desde
que entraste, comparados con el minuto planeado del recurso que tienes enfrente. Dice
«a tiempo», «N min antes de lo planeado» o «N min de retraso», este último en rojo.

### Bitácora

Cada sesión tiene un campo de texto libre, sobre la lista de recursos, para escribir
durante o después de la clase: qué funcionó, qué quedó pendiente, con qué empezar la
próxima vez. Se guarda con los datos y sale en la exportación a Markdown.

### Vista de semestre e impresión

**Vista de semestre** lista todas las sesiones del curso con su fecha, título,
propósito y cuántos recursos tiene cada una, para revisar el temario de un vistazo.

**Imprimir guion** (o `Ctrl/Cmd + P`) produce un guion de papel de la sesión abierta,
sin botones ni interfaz: momentos, recursos, notas y bitácora. Desde la vista de
semestre, imprime el temario completo.

### Revisar enlaces

Antes de la clase, **Revisar enlaces** recorre toda la materia y marca lo que va a
fallar: ligas vacías, rutas `file://`, ligas mal formadas, esquemas que el panel no
abre y ligas de programas de escritorio.

Revisa **la forma**, no la existencia. No se hace ninguna petición a las ligas: la
restricción de origen cruzado del navegador lo impide y devolvería errores donde no los
hay. Que una liga esté bien formada no garantiza que el archivo exista ni que tengas
permiso para abrirlo.

### Deshacer y copias de seguridad

Eliminar un recurso, una sesión o una materia se puede **deshacer**: abajo a la
izquierda aparece un aviso con el botón durante unos segundos, y devuelve todo al
momento anterior al borrado. Es una sola marcha atrás.

Además, el panel archiva por su cuenta las **últimas tres versiones distintas**: una al
abrir y una antes de cada operación que sustituye todo. Se ven y se restauran desde
*Vincular archivo*, al final de esa ventana. Es la red contra el error que no tiene
vuelta: importar el respaldo equivocado encima del bueno.

---

## Instalación

Hace falta [Node.js](https://nodejs.org) 18 o más nuevo.

```bash
git clone https://github.com/tmarquez-mx/panel-de-clases.git
cd panel-de-clases
npm install
```

Para trabajar en el código, con recarga automática:

```bash
npm run dev
```

Para generar la versión final:

```bash
npm run build
```

Queda `dist/index.html`, **un solo archivo** con el CSS y el JavaScript adentro. Ese
archivo es todo lo que hay que publicar o copiar. Con `npm run preview` se revisa antes
de publicarlo.

### Dependencias

Una sola, y solo para construir: **Vite**. No hay ninguna biblioteca en la página
publicada. El empaquetado en un archivo único lo hace un plugin propio de veinte
líneas, escrito dentro de `vite.config.js`, en lugar de agregar otra dependencia.

---

## Configuración

### Dónde se guardan los datos

El panel guarda solo, con cada cambio. Arriba a la derecha siempre dice dónde y a qué
hora guardó por última vez. Hay tres modos, de más a menos duradero:

| Modo | Cuándo entra | Qué significa |
|---|---|---|
| **Archivo** | Chrome o Edge, servido por `https` o `localhost`, con un archivo vinculado | Cada cambio se escribe en un `.json` que tú controlas. Además queda copia en el navegador. |
| **Navegador** | El caso normal, en cualquier navegador | Se guarda en `localStorage`. Sobrevive a cerrar la ventana, pero vive solo en esa computadora y ese navegador. |
| **Memoria** | El navegador no permite almacenamiento (navegación privada, algunos casos de `file://`) | No se guarda nada. El panel lo dice con todas sus letras y hay que exportar un respaldo antes de cerrar. |

Cada guardado deja en los datos un campo `guardadoEn`. Sirve para una sola cosa: si al
abrir hay copia en el archivo y copia en el navegador, se abre la más reciente.

### Vincular un archivo (Chrome y Edge)

**Vincular archivo** usa la File System Access API para escribir directamente en un
`.json` del disco. Si ese archivo está en una carpeta sincronizada con la nube, el
mismo respaldo llega a las demás computadoras donde uses el panel.

- Solo existe hoy en Chrome y Edge, y solo en contexto seguro (`https` o `localhost`).
  En Firefox y Safari el botón queda desactivado y explica por qué.
- El navegador recuerda el archivo entre sesiones, pero cada tanto vuelve a pedir
  permiso. Cuando pasa, el indicador lo dice y se reconecta desde el mismo botón.
- El vínculo se recuerda en IndexedDB. Es lo único para lo que se usa.

### Qué se pierde al abrir con doble clic (`file://`)

El panel abre y funciona: se ven las materias, se edita, se entra a modo clase. Pero el
navegador aplica restricciones a las páginas locales:

- **No hay «Vincular archivo»**: la File System Access API exige contexto seguro.
- **El guardado automático puede no estar**: Chrome permite `localStorage` en `file://`,
  Safari no. Si no está, el panel entra en modo memoria y lo avisa.
- **Copiar y pegar puede fallar**: el portapapeles también exige contexto seguro.

Para uso diario conviene publicarlo y abrirlo desde una dirección `https`.

### Empezar con datos propios

La primera vez, el panel abre con dos materias de ejemplo (`src/datos/ejemplo.js`).
En cuanto guardas algo, dejan de aparecer. Para arrancar de cero, elimina las materias
de ejemplo; para arrancar desde otro curso, usa *Importar respaldo*.

### Colores y marca

La paleta está en variables CSS al principio de `src/estilos/base.css`, y la palabra
del encabezado es la regla `.marca` en `src/estilos/componentes.css` más su línea en
`index.html`. Cambiar ambas cosas es todo lo que hace falta para adaptarlo a otra
institución. No se cargan fuentes web: el panel debe abrir sin conexión.

---

## Publicar

La aplicación construida es estática: sirve cualquier hosting.

**Netlify.** El repositorio trae un `netlify.toml` con el comando (`npm run build`), la
carpeta publicada (`dist`) y la versión de Node. Conectando el repositorio a un sitio de
Netlify, cada `git push` a `main` reconstruye y publica solo.

**GitHub Pages.** `npm run build` y publica el contenido de `dist/` en la rama
`gh-pages`, o cópialo a `docs/` y activa Pages sobre esa carpeta. El proyecto usa rutas
relativas (`base: "./"`), así que funciona igual en un subdirectorio que en la raíz.

**Cualquier otro lado.** Copia `dist/index.html` donde quieras. Es un archivo suelto y
autónomo; incluso sirve mandarlo por correo.

---

## Datos y privacidad

El panel no manda nada a ningún servidor, no tiene analítica y no pide cuentas. Lo que
escribes vive en tu navegador y, si lo vinculas, en tu archivo.

**Cuidado con los respaldos.** Las ligas de OneDrive y SharePoint llevan claves de uso
compartido y apuntan a una cuenta institucional: un respaldo publicado es una llave
publicada.

- El `.gitignore` excluye cualquier `.json` de datos, `datos-locales/` y `respaldos/`.
- Los datos de ejemplo del repositorio son ficticios y no tienen ninguna liga real.
- No subas tu respaldo a un repositorio abierto. Para compartir la estructura de un
  curso está **Plantilla del curso**, que exporta la materia **sin ligas y sin
  bitácoras**: quedan las sesiones, fechas, títulos, propósitos, tipos, momentos y las
  notas de uso, para que quien la reciba cuelgue sus propios archivos.
- El panel no abre ligas con esquemas peligrosos (`javascript:`, `data:`): si un
  respaldo ajeno trae una, la muestra como texto y avisa.

### Formato del respaldo

*Guardar respaldo* descarga un `.json` con esta estructura:

```json
{
  "version": 2,
  "tipos": ["podcast"],
  "materias": [{
    "id": "artificios",
    "nombre": "Artificios e inteligencias",
    "clave": "Posgrado · Otoño 2026",
    "carpeta": "URL de la carpeta del curso",
    "cuaderno": "URL del cuaderno del curso",
    "sesiones": [{
      "num": 3,
      "fecha": "2026-09-08",
      "titulo": "La inteligencia como categoría cargada de valor",
      "proposito": "Una o dos líneas sobre qué busca la sesión",
      "bitacora": "Texto libre",
      "recursos": [{
        "titulo": "Cave, S. (2020). The problem with intelligence",
        "tipo": "lectura",
        "momento": "0:15–0:40",
        "url": "https://…",
        "nota": "Para qué sirve este recurso en clase",
        "estado": "pendiente"
      }]
    }]
  }]
}
```

*Importar respaldo* valida la estructura antes de tocar nada, dice cuántas materias y
sesiones trae y pide confirmación, porque sustituye todo. Acepta respaldos de versiones
anteriores: los campos que falten se completan con valores por omisión.

---

## Limitaciones conocidas, dichas de frente

- **Rutas locales (`file://`)**: no abren con un clic desde ningún navegador, por
  seguridad. El panel las detecta y las marca; la solución de fondo es subir el archivo
  a la nube y sustituir la liga.
- **«Revisar enlaces» revisa la forma, no la existencia.** No hay ninguna petición de
  red, y por lo tanto no puede saber si un archivo existe o si tienes permiso.
- **Autenticación de la nube**: el panel no sabe si tu sesión está abierta. Si no lo
  está, la liga te llevará a iniciarla.
- **Incrustar no siempre se puede**: OneDrive, SharePoint y muchos sitios prohíben que
  otra página los muestre dentro de un marco. Por eso el panel abre pestañas.
- **«Abrir todo» y el bloqueador de ventanas emergentes**: la primera vez el navegador
  bloqueará las pestañas; hay que permitirlas para esa página.
- **Deshacer llega hasta la última eliminación**, no más atrás.
- **La búsqueda abarca la sesión abierta**, no el curso entero. El filtro de tipos sí
  ofrece los tipos de toda la materia.
- **Sin integración con Microsoft Graph.** La capa `src/almacenamiento/` está hecha para
  que entre después como un módulo más, sin tocar las vistas.

---

## Estructura del código

```
index.html                  Todo el marcado de la página
vite.config.js              Configuración y el plugin de un solo archivo
netlify.toml                Ajustes de construcción para Netlify
src/
  main.js                   Arranque: monta las vistas y conecta el guardado
  estado.js                 Qué materia y qué sesión están activas; avisa a las vistas
  historial.js              Deshacer la última eliminación
  datos/
    modelo.js               Estructura, migración de respaldos y operaciones
    ejemplo.js              Dos materias ficticias, sin ligas reales
  almacenamiento/
    gestor.js               Decide dónde se guarda y en qué modo está
    local.js                localStorage y copias de seguridad rotativas
    archivo.js              File System Access API
    manijas.js              Recuerda el archivo vinculado (IndexedDB)
  vistas/
    lateral.js              Materias, enlaces del curso y sesiones
    sesion.js               Cabecera, controles, bitácora y riel de recursos
    semestre.js             Todas las sesiones de un vistazo
    modoClase.js            Pantalla completa, un recurso a la vez, con reloj
    dialogos.js             Formularios de recurso, sesión, duplicar, mover y materia
    revision.js             Revisión de la forma de las ligas
    aviso.js                Aviso flotante con la acción para revertir
  exportacion/              Markdown, respaldo completo, plantilla y descarga
  util/                     Fechas, ligas, portapapeles y atajos del DOM
  estilos/                  base, componentes e impresión
```

Regla del proyecto: las vistas leen de `estado.js` y llaman a `actualizar()` cuando
cambian algo. `actualizar()` guarda y repinta. Ninguna vista sabe dónde se guarda ni
qué otras vistas existen.

---

## Accesibilidad

- Todo se puede usar con el teclado, y el foco siempre se ve.
- Cada botón explica su función al dejar el puntero encima.
- En modo clase, el resto de la página queda fuera del recorrido del teclado y del
  lector de pantalla; al salir, el foco vuelve al botón de origen.
- Los formularios son `<dialog>` nativos, con etiqueta asociada en cada campo.
- El indicador de guardado es una región `aria-live`.
- Se respeta `prefers-reduced-motion`.

---

## Créditos

Diseñado por Teresa Márquez y desarrollado mediante vibecoding con Claude Opus 5.
Agosto, 2026.

Los colores del encabezado son los de la Universidad Iberoamericana. Quien reutilice el
proyecto en otro contexto debe cambiar la paleta y la palabra del encabezado: la
identidad gráfica de una institución no se hereda con el código.
