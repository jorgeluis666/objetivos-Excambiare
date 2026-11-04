# Inversiones Excambiare | Gasto publicitario 2026

Dashboard de Agencia Lima Retail para controlar la inversion publicitaria en Meta Ads de las tres marcas comerciales
de Inversiones Excambiare: **Sol y Tierra**, **Mex Cream** y **Gold Fusion**. Cada marca tiene su propia carpeta de
descargas y su carpeta de reportes; el tablero las muestra por separado (los resultados de una marca no se suman con
los de otra). Montos en soles (`CURRENCY` en `js/data-source.js`).

Version actual: `v2.8.1` (v1.x era el tablero anterior, sobre una hoja manual).

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
  - Grafico de cada cuadro: `Por dia` o `Por mes` (sin acumulado del mes: siempre sube y exagera el crecimiento)
    e indicadores resultado, inversion, impresiones, alcance y costo por resultado (inversion / resultados de cada
    dia o mes; un dia sin resultados queda como hueco). Cada punto lleva su valor (si dos etiquetas chocan, una baja
    bajo el punto o queda solo en el tooltip). Varios indicadores van en paneles apilados, cada uno con su escala, o
    con el boton `Un solo cuadro` todos juntos, un color por indicador y cada uno con su escala (sin eje: el valor
    va en el punto); uno solo va contra el mes anterior en el mismo dia. Indicadores, vista y un solo cuadro se
    recuerdan por objetivo.
- Anuncios: el mejor anuncio de cada objetivo (mas resultados y, a igual cantidad, menor costo por resultado) y la
  tabla de todos los anuncios del periodo con filtro por objetivo, densidad compacta y pantalla completa.
- Proyecciones: cierre de mes estimado por objetivo (resultados y gasto). Si el ultimo mes con datos ya termino,
  muestra su cierre real.
- Calculadora de Inversion: facturacion objetivo, ventas necesarias e inversion en mensajes por CPL.
- Historico de Campanas: todas las campanas de la marca, activas y finalizadas, con su gasto mes a mes.
- Archivo de Reportes: catalogo de la carpeta de reportes de la marca y validacion contra su Gasto publicitario.
  Nombres de los reportes: `SolyTierra_Octubre2026` (mensual) o `SolyTierra_1-13Oct2026` (parcial).
- Segmentacion: publicos de Meta Ads por marca y comparativo entre marcas (ver "Segmentacion").
  - Pestana Generacion de Reporte, dentro de Archivo de Reportes: el Reporte de Publicidad mensual de las tres marcas (evolucion, causas, artes, seguidores y proximos pasos) con el diseño del modelo de Excambiare y descarga en PDF (ver "Generacion de Reporte").
- Bitacora: checklist mensual de cambios, comentarios y decisiones de la cuenta.

El pie del panel lateral lleva el nombre de la cuenta, el WhatsApp de Agencia Lima Retail
(+51 937 409 733) y www.limaretail.com. El modulo "Usuarios y Claves" salio del tablero; el
directorio guardado sigue en el repositorio por si hace falta recuperarlo.

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
- Barra superior (como Royal Baby): queda fija al hacer scroll y su bajada repite la descripcion del modulo en el
  panel lateral. A la derecha, la pildora de sincronizacion dice "Sincronizado · hace 2 h" en verde; en ambar dice
  "Copia guardada · hace N h", "Aun no sincronizado" o lleva mas de un dia y medio sin barrido,
  o la carpeta de la marca elegida no se pudo leer;
  en rojo, "Sin conexion con Google"; y en ambar con el punto latiendo, "Recargando…" mientras corre Actualizar. Su
  title trae la linea completa (datos al dia N, origen y hora del barrido) y al pulsarla abre el detalle (datos
  cargados, ultimo barrido, proximo automatico, archivo del mes y fuente). Al lado esta el boton fantasma
  **Actualizar**, con icono de recarga que gira mientras dura el barrido.
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

Pestana que arma el "Reporte de Publicidad" de las tres marcas en un solo PDF, con el diseño del modelo de
Excambiare (`Modelo Reporte Inversiones Excambiare`): laminas 16:9 con fondo claro, tarjetas blancas de borde fino
y acentos en azul. No sigue a la marca elegida arriba: lleva MEX (Mex Cream), Gold Fusion y Sol y Tierra
(`ExcambiareData.brandSnapshot()`), asi que en esta pestana no aparece el selector de marca.

| Pagina | Contenido |
| --- | --- |
| Portada | Logo de Lima Retail, "Reporte de Publicidad", cliente, marcas y periodo. |
| Resumen ejecutivo | Inversion total, alcance, seguidores de pauta y costo por seguidor con su variacion; tabla marca x objetivo (inversion, resultados y costo por resultado con su variacion y la lectura: mejoro o empeoro, por los artes o por el CPM); "Lectura del mes". |
| Crecimiento de seguidores | Nuevos, bajas, netos, de pauta y costo por seguidor con su variacion; tabla por marca (nuevos, bajas, netos, de pauta, organico, inversion de trafico, costo por seguidor); "Clave". |
| Evolucion de seguidores | Seguidores de pauta y costo por seguidor por mes y por marca (ultimos 4 meses), tabla mes a mes y "Evolucion" (que movio el costo: mas o menos seguidores o mas o menos inversion). |
| Por marca y objetivo: evolucion | 6 KPIs con su variacion contra el mes anterior con datos (inversion, resultados, costo por resultado, CPM, alcance —en Trafico al perfil, seguidores— y resultados por mil impresiones); grafico de inversion, resultados y costo por mes con el valor en cada punto (un mes sin datos queda marcado); tabla mes a mes con la comparacion contra el promedio de los meses anteriores; "Por que cambio". |
| Por marca y objetivo: artes | Hasta 6 artes con miniatura (o el icono de su formato), formato, nuevo, inversion, resultados, costo, comparacion contra el promedio y veredicto (Replicar, Mantener, Ajustar, Renovar, Descartar, Poca data); en Interaccion, el desglose de cada arte (solo las columnas que trae la descarga); en Trafico, los seguidores y el costo por seguidor de cada arte; resultado por formato y "Que funciona" (el mejor arte, el mas eficiente, el que hay que cortar, nuevos contra los que siguieron y el formato, por importancia hasta lo que cabe en la lamina). |
| Conclusiones | Seguidores, artes para replicar (y el formato que domina) y que movio los costos; nota del periodo. |
| Que replicar, que descartar y proximos pasos | Una columna por marca con los artes a replicar, los que hay que descartar o ajustar y lo que toca el mes siguiente. |
| Cierre | Logo y firma de Lima Retail. |

- **Periodo:** se elige el mes; el en curso va del 1 al ultimo dia con datos de cualquiera de las marcas y los
  meses anteriores se comparan en esa misma ventana (1-18 de cada mes). Un mes cerrado va completo. La evolucion son
  los ultimos 4 meses; la variacion es contra el mes anterior con datos de cada objetivo (si falta un mes, se dice
  contra cual se compara).
- **Por que cambio el costo:** costo por resultado = CPM ÷ resultados por mil impresiones. Si el que mas se movio es
  el CPM, la causa es la subasta o el publico; si son los resultados por mil impresiones, la causa son los artes.
  Ademas compara inversion contra resultados y el costo contra el promedio de los meses anteriores.
- **Veredicto de cada arte:** su costo por resultado contra el del objetivo en el mes. Replicar = 20% o mas barato;
  Ajustar = 15% o mas caro; Descartar = 50% o mas caro con al menos el 5% de la inversion (o sin resultados);
  Renovar = ya corria el mes anterior y su costo subio 40% o mas; Poca data = menos de S/ 3 o 500 impresiones.
  Nuevo = no corrio el mes inmediato anterior. Umbrales en `VERDICT` de `js/report-week.js`. En Trafico al perfil,
  con 10 seguidores o mas en el mes (`MIN_FOLLOWS`), lo que se busca son seguidores: los artes se ordenan por
  seguidores y el veredicto y "vs prom." van por el costo por seguidor; un arte sin seguidores se juzga recien cuando
  gasto lo que cuestan 1.5 seguidores al promedio.
- **Formato:** con token de Meta en el Web App (ver "Meta en el Web App") llega el exacto (reel, video, carrusel o
  imagen) y la miniatura. Sin el, se deduce de las reproducciones de 3 s: Video o Estatico.
- **Seguidores:** de pauta = seguidores que trajeron los anuncios de todas las campañas (columna Seguimientos de
  Instagram); costo por seguidor = inversion de Trafico al perfil ÷ seguidores de pauta; netos = nuevos − bajas;
  organico = nuevos − pauta (sin descontar bajas). Nuevos y bajas llegan de Instagram si el Web App esta conectado; si
  no, se escriben con un clic en la tabla de seguidores (por marca y por mes) y lo escrito gana sobre Instagram. Las
  cifras quedan guardadas en el navegador junto con los textos (`excambiare-report-notes-v2`); "Restablecer textos"
  no las borra.
- **Antes de descargar el PDF:** un recuadro (que no sale en el PDF) avisa lo que falta o esta mal en los datos: un
  mes sin descarga en la carpeta, una descarga que no se pudo leer o que no llega al ultimo dia del mes, una descarga
  sin la columna de seguidores, el mismo anuncio (mismo ID de Meta) en las descargas de dos marcas (una trae filas de
  la otra), y si faltan los nuevos y bajas o el token de Meta.
- **Textos:** "Lectura del mes", "Clave", "Evolucion", "Por que cambio", "Que funciona", las conclusiones y los
  proximos pasos vienen propuestos con lo que dicen los numeros y se editan con un clic sobre la lamina (`**texto**`
  va en negrita).
- **Descargar PDF** abre el dialogo de impresion con las laminas solas, una por hoja de 13.33 x 7.5 in (el tamaño
  del modelo), y el nombre del archivo ya armado. Activar "Graficos de fondo" si el navegador no lo hace solo.

El modulo es `js/report-week.js` y su template es propio de Excambiare: cada tablero de marca tiene el suyo,
adaptado por la marca. Sus estilos y los de impresion estan al final de `css/dashboard.css`.

### Columnas opcionales del barrido

`scripts/google-sheets-sync.gs` (version de barrido 3) suma, ademas de las columnas de siempre, estas de la
descarga de Meta si vienen (cabeceras sin tildes ni mayusculas; se acepta cualquiera de la lista):

| Campo | Cabecera de la descarga |
| --- | --- |
| `follows` | Seguimientos de Instagram / Seguidores de Instagram |
| `plays3s` | Reproducciones de video de 3 segundos |
| `reactions` | Reacciones a la publicacion / Reacciones |
| `saves` | Publicaciones guardadas / Guardados de publicaciones |
| `shares` | Veces que se compartieron las publicaciones / Publicaciones compartidas |
| `comments` | Comentarios en publicaciones / Comentarios |

Cada mes del barrido trae `found` con las que encontro en su archivo. Para que lleguen: agregar esas columnas al
informe de Meta Ads antes de descargarlo, y publicar el script nuevo (Implementar > Administrar implementaciones >
editar > Nueva version). Si Meta las nombra distinto, se agrega el nombre a `RAW_COLUMNS`.

### Meta en el Web App (opcional)

Con la propiedad del script `META_TOKEN` el barrido suma a cada marca, para los anuncios de los ultimos 4 meses, la
miniatura, el formato y el enlace de cada arte (`creatives`, por el ID del anuncio que trae el enlace de vista previa)
y, con `IG_USER_SOL_Y_TIERRA`, `IG_USER_MEX_CREAM` e `IG_USER_GOLD_FUSION` (ID de la cuenta profesional de
Instagram de cada marca), los seguidores nuevos y las bajas de cada mes (`instagram`, metrica
`follows_and_unfollows`) y el total de seguidores al ultimo barrido. Las miniaturas de Meta vencen a los pocos dias:
cada barrido diario las vuelve a pedir. Un error de Meta deja lo del barrido anterior y se avisa en `metaError`.

- Token: de un usuario del sistema del Business Manager de Lima Retail con acceso a las tres cuentas publicitarias y
  a las tres cuentas de Instagram, con los permisos `ads_read`, `instagram_basic`, `instagram_manage_insights` y
  `pages_read_engagement`. Nunca va en el repo.
- Despues de poner las propiedades, ejecutar `probarMeta()` en el editor: muestra cuantos artes trajo con miniatura
  y los seguidores de cada mes, sin guardar nada.

## Calculadora de Inversion

- Ventas necesarias = (facturacion objetivo - facturacion ya realizada) / ticket promedio.
- Inversion = mensajes objetivo x costo por lead de cada conjunto de anuncios.
- "Usar CPL real" toma el costo por conversacion de las campanas de Conversaciones IG de la marca activa en su ultimo
  mes con datos; se oculta si ese mes no tuvo esa campana.
- Los valores se guardan en `localStorage` (`excambiare_messages_calculator_v1`) de ese navegador.


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
| Token de Meta y cuentas de Instagram (opcional) | Propiedades del script `META_TOKEN` e `IG_USER_<MARCA>` |
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
