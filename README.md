# Inversiones Excambiare | Gasto publicitario 2026

Dashboard de Agencia Lima Retail para controlar la inversion publicitaria en Meta Ads de las tres marcas comerciales
de Inversiones Excambiare: **Sol y Tierra**, **Mex Cream** y **Gold Fusion**. Cada marca tiene su propia carpeta de
descargas y su carpeta de reportes; el tablero las muestra por separado (los resultados de una marca no se suman con
los de otra). Montos en soles (`CURRENCY` en `js/data-source.js`).

Version actual: `v2.0.1` (v1.x era el tablero anterior, sobre una hoja manual).

## Versionado

El proyecto usa la nomenclatura `vMAJOR.MINOR.PATCH`:

- `MAJOR`: cambios incompatibles o una nueva etapa del tablero.
- `MINOR`: nuevos modulos, indicadores o funciones compatibles.
- `PATCH`: correcciones visuales, de datos o funcionamiento.

La version vive en tres lugares: `package.json`, la etiqueta del panel lateral (`index.html`) y este README.

## Marcas

- En el menu hay un **Gasto publicitario por marca** (Sol y Tierra, Mex Cream, Gold Fusion).
- Anuncios, Proyecciones, Historico de Campanas y Archivo de Reportes muestran una marca a la vez: se elige con el
  selector de la barra superior. Es la misma marca activa en todo el tablero: abrir el Gasto publicitario de Mex
  Cream deja Mex Cream elegida en los demas modulos. Se recuerda en `localStorage` (`excambiare-brand`).
- Calculadora, Segmentacion, Bitacora y Usuarios y Claves son comunes a las tres marcas.
- Al cambiar de marca, Gasto publicitario y Anuncios vuelven al ultimo mes con datos de esa marca.
- La lista de marcas vive en `BRANDS` de `js/data-source.js` y de `scripts/google-sheets-sync.gs`; agregar una marca
  es sumarla en los dos y crear sus propiedades del script.

## Modulos activos

- Gasto publicitario (uno por marca): indicadores del reporte de Ads por mes, calculados con la descarga de Meta.
  - Pestanas de Enero a Diciembre y una pestana Anual con todos los meses con descarga.
  - Resumen del periodo: inversion, impresiones, alcance, frecuencia y CPM, con la variacion contra el mismo tramo
    del mes anterior (un mes cerrado se compara completo). En la vista Anual, promedio mensual de los meses cerrados.
  - Distribucion de la inversion por campana y un cuadro por objetivo (Interaccion, Reconocimiento, Trafico al
    perfil, Conversaciones IG...) con sus KPIs, su grafico, sus conjuntos de anuncios y sus anuncios.
- Anuncios: el mejor anuncio de cada objetivo (mas resultados y, a igual cantidad, menor costo por resultado) y la
  tabla de todos los anuncios del periodo con filtro por objetivo, densidad compacta y pantalla completa.
- Proyecciones: cierre de mes estimado por objetivo (resultados y gasto). Si el ultimo mes con datos ya termino,
  muestra su cierre real.
- Calculadora de Inversion: facturacion objetivo, ventas necesarias e inversion en mensajes por CPL.
- Historico de Campanas: todas las campanas de la marca, activas y finalizadas, con su gasto mes a mes.
- Archivo de Reportes: catalogo de la carpeta de reportes de la marca y validacion contra su Gasto publicitario.
  Nombres de los reportes: `SolyTierra_Octubre2026` (mensual) o `SolyTierra_1-13Oct2026` (parcial).
- Segmentacion: publicos de Meta Ads por marca y comparativo entre marcas (ver "Segmentacion").
- Generacion de Reporte: el reporte semanal de lunes a domingo, con el orden del ultimo reporte de la carpeta de Drive y descarga en PDF (ver "Generacion de Reporte").
- Bitacora: checklist mensual de cambios, comentarios y decisiones de la cuenta.
- Usuarios y Claves: directorio de quien tiene acceso al tablero, sin contrasenas.

## Datos

La fuente son las descargas de Meta Ads ("Raw Data Report": una fila por dia x edad x sexo x anuncio), una por mes en
la carpeta de Drive de cada marca.

- Cada archivo puede ser una Hoja de calculo de Google o un `.xlsx`. El `.xlsx` se lee con una copia temporal
  convertida (servicio avanzado Drive API del Apps Script) que se manda a la papelera al terminar.
- Nombre: el mes y, mejor, el ano (`Octubre 2026` o `Sol y Tierra - Octubre 2026`). Sin ano se asume el ano en curso
  (o el anterior si ese mes aun no llega): desde enero de 2027 el ano tiene que ir en el nombre. Un solo archivo por
  mes; si hay dos, se usa el editado mas recientemente y la validacion lo avisa.
- Columnas que usa el barrido (en espanol): Dia, Nombre de la campana, Nombre del conjunto de anuncios, Nombre del
  anuncio, Importe gastado (PEN) o Monto gastado (PEN), Impresiones, Alcance, Clics en el enlace, Tipo de resultado,
  Resultados, Conversaciones con mensajes iniciadas y Enlace de vista previa. Un resumen por conjunto de anuncios (sin
  la columna Dia) no se puede leer: el mes queda con error hasta que se reemplace por el Raw Data Report diario.
- El Web App de `scripts/google-sheets-sync.gs` lee las carpetas de las tres marcas, suma edad y sexo y guarda el
  barrido en un JSON de Drive con una entrada por marca. `js/data-source.js` (`window.ExcambiareData`) lo pide al
  abrir el tablero, cada hora y al volver a la pestana, y lo reparte a los modulos con el evento
  `excambiare:data-updated` (con `detail.brandChanged` cuando solo cambio la marca elegida).
- Barrido automatico: todos los dias entre 10:00 y 11:00 (hora de Lima), aunque nadie abra el tablero. El boton
  **Actualizar** hace un barrido en el momento. Un mes cerrado que no cambio se reutiliza sin abrir el archivo; si el
  primer barrido no alcanza a convertir todos los `.xlsx` antes del limite de Apps Script, el resto queda
  "Pendiente" y se lee en el barrido siguiente.
- El repo es publico, asi que ni la URL del Web App, ni los IDs de las carpetas, ni los datos de las marcas se
  guardan en el: `npm run build` toma la URL del secret `DATA_ENDPOINT`, baja el ultimo barrido y lo incrusta en
  `dist/index.html` (que solo se sirve cifrado). La copia queda tambien en `data/excambiare-meta.json`, que esta en
  `.gitignore`.
- Solo se muestra lo que tuvo gasto o impresiones en el periodo elegido (`hasActivity` en `js/data-source.js`).
- Objetivos: se deducen del nombre de la campana (`OBJECTIVES` en `js/data-source.js`): "interacc" -> Interaccion,
  "reconocimiento" -> Reconocimiento, "trafico al perfil" / "perfil" -> Trafico al perfil (IG), "conversacion" ->
  Conversaciones IG. Una campana que no encaje (por ejemplo "Campana de Alcance") toma el texto antes del primer `|`.
- Un mes anterior al mes en curso de Lima se trata como cerrado aunque su descarga no llegue al ultimo dia.
- El alcance es la suma de las filas de la descarga, igual que en los reportes de la agencia (no el alcance sin
  duplicar de Meta).

## Generacion de Reporte

Pestana que arma el reporte de la semana que acaba de pasar, de lunes a domingo, con el mismo orden del
ultimo reporte publicado en la carpeta Reportes de Drive: resumen del periodo, conversaciones por dia,
mejores anuncios, conjuntos y campanas, y conclusiones.

- **De donde salen los numeros:** de las mismas filas del barrido de Meta que usa Gasto publicitario (una
  fila por dia, campana, conjunto y anuncio). No hay una fuente nueva ni una lectura extra.
- **Que semana muestra:** la ultima de lunes a domingo ya cerrada (en hora de Lima). El selector deja ver
  las 12 anteriores. La semana en curso no se lista: el reporte es de semana completa.
- **Cada lunes se puebla solo:** el tablero relee el barrido al abrirse y con Actualizar, y el workflow de Pages vuelve a publicar todos los dias despues del barrido.
- **Si la descarga del mes no llega al domingo**, el reporte lo avisa arriba y nombra los dias que faltan:
  los totales pueden subir cuando se suba la descarga nueva.
- **Resultados:** cada objetivo mide el suyo (ThruPlay, interacciones, contactos...), asi que no se suman
  entre si. Con columna de conversaciones, ese es el numero que encabeza; si no, encabeza el tipo con mas inversion y los demas van en el desglose. El reporte sigue a la marca elegida arriba (Sol y Tierra, Mex Cream o Gold Fusion) y la nombra en la portada.
- **Conclusiones:** las dos primeras vienen propuestas con lo que dice la semana y se editan en la pestana;
  quedan guardadas por semana en el navegador (`excambiare-week-notes-v1`), no se publican con el tablero.
- **Descargar PDF** abre el dialogo de impresion con el reporte solo (sin panel lateral ni barra superior)
  y el nombre del archivo ya armado.

El modulo es `js/report-week.js` y es el mismo archivo en todos los tableros de marca: lo unico que cambia
es el bloque `CONFIG` de arriba. Sus estilos y los de impresion estan al final de `css/dashboard.css`.

## Calculadora de Inversion

- Ventas necesarias = (facturacion objetivo - facturacion ya realizada) / ticket promedio.
- Inversion = mensajes objetivo x costo por lead de cada conjunto de anuncios.
- "Usar CPL real" toma el costo por conversacion de las campanas de Conversaciones IG de la marca activa en su ultimo
  mes con datos; se oculta si ese mes no tuvo esa campana.
- Los valores se guardan en `localStorage` (`excambiare_messages_calculator_v1`) de ese navegador.

## Bitacora y Usuarios y Claves

Las versiones publicadas son `data/excambiare-bitacora.json` y `data/excambiare-usuarios.json` (el build las incrusta
como `window.EXCAMBIARE_BITACORA` y `window.EXCAMBIARE_USUARIOS`). Se editan en el tablero como borrador
(`localStorage`), **Exportar** descarga el JSON, se reemplaza en `data/`, commit y push a `main`.

Ojo: mientras el repo sea publico, lo que se publique en estos dos archivos tambien lo es. El tablero se abre con
una sola clave para todos (secret `DASHBOARD_PASSWORD`); aqui nunca se guarda ninguna clave.

## Segmentacion

`js/segmentation.js` lee `data/excambiare-segmentation.json` (el build lo incrusta como
`window.EXCAMBIARE_SEGMENTATION`), transcrito del documento "Segmentaciones Excambiare". Cada marca guarda
ubicaciones, exclusiones, rango de edad, tipo de segmentacion, intereses, comportamientos y tipo de publico. Si el
documento cambia, se actualiza el JSON y `source.syncedAt`. Ojo: el JSON esta en el repo publico.

## Configuracion del Web App (Google Apps Script)

La cuenta duena del proyecto de Apps Script es la de Lima Retail que tiene acceso a las seis carpetas de Drive. Si
esa cuenta pierde el acceso, el barrido se detiene.

1. En [script.google.com](https://script.google.com) crear un proyecto independiente (Nuevo proyecto, no desde una
   hoja), pegar `scripts/google-sheets-sync.gs` y poner la zona horaria del proyecto en America/Lima.
2. Servicios > + > **Drive API** > Agregar: hace falta para leer los `.xlsx`.
3. Configuracion del proyecto > Propiedades del script, una carpeta de descargas y una de reportes por marca (los IDs
   nunca van en el repo):

   | Propiedad | Carpeta |
   | --- | --- |
   | `DATA_FOLDER_SOL_Y_TIERRA` | descargas de Meta de Sol y Tierra |
   | `DATA_FOLDER_MEX_CREAM` | descargas de Meta de Mex Cream |
   | `DATA_FOLDER_GOLD_FUSION` | descargas de Meta de Gold Fusion |
   | `REPORTS_FOLDER_SOL_Y_TIERRA` | reportes de Sol y Tierra |
   | `REPORTS_FOLDER_MEX_CREAM` | reportes de Mex Cream |
   | `REPORTS_FOLDER_GOLD_FUSION` | reportes de Gold Fusion |
4. Ejecutar una vez `installSweepTriggers()`: programa el barrido diario de las 10:00 y hace el primero.
   `probarBarrido()` muestra en el registro las filas, el gasto y el rango de fechas de cada mes.
5. Implementar > Nueva implementacion > Aplicacion web, ejecutar como "Yo" y acceso "Cualquier persona". Quien
   tenga la URL puede leer los numeros: la URL solo se guarda como secret.
6. Guardar la URL `https://script.google.com/macros/s/.../exec` en GitHub > Settings > Secrets and variables >
   Actions como `DATA_ENDPOINT`. Al cambiar el codigo del script: Implementar > Administrar implementaciones >
   editar > Nueva version (la URL no cambia).

| Que | Donde |
| --- | --- |
| Carpetas de descargas de Meta y de reportes | Propiedades del script `DATA_FOLDER_<MARCA>` y `REPORTS_FOLDER_<MARCA>` |
| URL del Web App | secret de GitHub `DATA_ENDPOINT` |
| Clave de acceso al tablero | secret de GitHub `DASHBOARD_PASSWORD` |
| Logo y favicon | `assets/logo-excambiare.png`, `assets/favicon.png` |
| Color de marca | `--brand*` en `css/dashboard.css` |

## Desarrollo

```
npm install
npm run dev      # live-server en el puerto 3000 (usa la copia data/excambiare-meta.json, sin lectura en vivo)
npm run build    # genera dist/ con todo incrustado (con DATA_ENDPOINT baja los datos y activa la lectura en vivo)
```

`dist/` lleva `index.html` (CSS, JS y datos incrustados), `assets/`, `CNAME` y `robots.txt`. Nada mas: `scripts/`,
`data/` y el resto del repo nunca se publican. Con `DASHBOARD_PASSWORD=<clave> npm run build` el `index.html` sale
cifrado, como en GitHub Pages. Detener live-server antes de compilar si esta sirviendo `dist/`.

## Publicacion en inversiones.limaretail.com (GitHub Pages)

URL publica: **https://inversiones.limaretail.com**. Cada push a `main` la actualiza y ademas se vuelve a publicar
todos los dias a las 11:30 de Lima con el barrido del dia (`.github/workflows/deploy-pages.yml`).

- Settings > Pages > Source: GitHub Actions. El dominio propio se guarda en **Settings > Pages > Custom domain**
  (con Actions el archivo `CNAME` no basta) y luego **Enforce HTTPS**.
- DNS en Banahosting (cPanel > Zone Editor > `limaretail.com`): registro **CNAME** `inversiones` ->
  `jorgeluis666.github.io`.
- **Clave:** `scripts/build.js` cifra el tablero completo (datos, JS y URL del Web App) con AES-256-GCM y una llave
  PBKDF2-SHA256 (600 000 iteraciones) derivada del secret **`DASHBOARD_PASSWORD`** (minimo 8 caracteres, sin
  saltos de linea; se ignoran los espacios de los extremos). `deploy/pages-gate.html` pide la clave y lo descifra
  en el navegador. Si falta un secret, el workflow falla en vez de publicar. Despues del build el workflow
  comprueba que no quede nada en claro.
- Para cambiar la clave: editar el secret `DASHBOARD_PASSWORD` y volver a ejecutar el workflow (Actions >
  Publicar en GitHub Pages > Run workflow).
- Tras entrar, la llave (no la clave) queda en `sessionStorage` de esa pestana y se pierde al cerrarla.
