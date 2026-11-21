# BarrioDigital · Frontend

Aplicación web de BarrioDigital, la plataforma municipal de trámites y atención vecinal. Los usuarios inician sesión con su cuenta de Microsoft Entra ID; el backend (microservicios Spring Boot) vive en otros repositorios.

## Contratos

Contratos vigentes en `barriodigital-infra` ([índice](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/contratos/README.md)):

- [Capacidades por rol y navegación](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/contratos/capacidades-roles.md)
- [Cambio de estado del trámite](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/contratos/requests-estado.md)
- [Historial, gestiones, ubicación e imágenes](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/contratos/requests-actividad.md)
- [Comentario y fotos del vecino](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/contratos/requests-comentario.md)
- [Encuesta de satisfacción](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/contratos/requests-encuesta.md)
- [Aviso de posible duplicado](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/contratos/requests-duplicados.md)
- [Exportación CSV del listado](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/contratos/requests-csv.md)
- [Reportes y auditoría](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/contratos/report-audit.md)
- [App Registration y roles de Entra ID](https://github.com/CEOAlmaloco/barriodigital-infra/blob/develop/docs/decisiones.md)

## Stack

- **Angular 21** (21.2.x) con componentes standalone, sin NgModules
- **Angular Material 21** para componentes funcionales y **SCSS** propio sobre tokens de diseño
- **MSAL**: `@azure/msal-angular` 6.2 y `@azure/msal-browser` 5.21, flujo redirect contra Microsoft Entra ID
- **Vitest 4** para tests unitarios, mediante el builder de Angular
- **TypeScript 5.9**

## Requisitos previos

- **Node.js** `^20.19`, `^22.12` o `>=24`, que es lo que exige Angular 21. Probado con Node 22.18.0.
- **npm** 10.9 o superior. Probado con 10.9.3 y 11.

## Levantar el proyecto en local

1. Instala las dependencias:

   ```bash
   npm install
   ```

   Si npm 10 falla con `Cannot read properties of null (reading 'edgesOut')`, es un bug del resolvedor de npm 10.9.x. Instala con npm 11:

   ```bash
   npx npm@11 install
   ```

2. Revisa la configuración en `src/environments/`:

   - `environment.development.ts` lo usa `npm start`.
   - `environment.ts` lo usa el build de producción.

   Ambos archivos ya traen los valores de la app registrada en Microsoft Entra ID. La fuente de verdad es `barriodigital-infra/docs/decisiones.md`: si esos valores cambian, cópialos desde ahí a los dos archivos.

   `bffBaseUrl` es la URL del BFF y toda llamada a esa URL sale con el token de acceso. En `environment.development.ts` apunta al BFF local (`http://localhost:8080`); en `environment.ts`, a la Invoke URL del API Gateway (`barriodigital-api`), que protege las rutas con un JWT Authorizer antes de reenviar al BFF en la EC2.

3. Levanta el servidor de desarrollo:

   ```bash
   npm start
   ```

   Abre `http://localhost:4200` e inicia sesión con una cuenta del tenant de BarrioDigital. Esa URL tiene que estar registrada en Entra ID como redirect URI de tipo _Single-page application_.

## Tests

```bash
npm test                      # modo watch
npm test -- --watch=false     # una sola ejecución
```

Las pruebas cubren `AppComponent`, `AuthService`, los guards, la configuración de MSAL (incluido el interceptor HTTP), la lectura de claims del token, `LoginComponent`, el logo (cada versión, nombre accesible y colores por clase), `HomeComponent` (bloques por rol, fallo aislado de cada fuente, vacío distinto del error, paginación de plazos y polling de los KPIs del Admin), `HeaderComponent`, `RequestsService`, `CatalogService`, `RequestsComponent` (incluido el alta con el aviso de privacidad, el aviso de posibles duplicados y el selector de imagen: advertencia, vista previa, errores y foco), `RequestDetailComponent` (por rol, estados de carga, error y 404, estados terminales, privacidad, actualización tras cada acción y comentario del vecino), el formulario y la foto del comentario, el aviso y la lista de posibles duplicados, la línea de tiempo, la preparación de imágenes, `ReportService`, `polledResource`, `loadedResource` y `ReportsComponent` (ciclo de polling, pestaña oculta, pausa, respuestas lentas, fallos por fuente, cambio de período y 503) y las rutas protegidas por rol, el bloque «Requiere atención» del Admin y los paneles de Administración (catálogo, RabbitMQ, Kafka e indicadores: estados por causa de falla, filtros, datos ausentes, acciones protegidas, reinicio de offsets y reenvío desde la DLT).

## Estructura

```
src/
├── app/
│   ├── core/          Servicios únicos de la app: auth/ (MSAL, sesión, roles y guards), accessibility/ (preferencias del control de accesibilidad), catalog/, report/, audit/, mq/ y kafka/ (un servicio por backend vía BFF) y layout/ (contenedor de las rutas autenticadas)
│   ├── shared/        Componentes, pipes y modelos compartidos entre features. Hoy: components/header, components/brand-logo (logo oficial), components/info-toggletip (ayuda breve que se abre con clic o teclado), models/ (roles, trámites, tipos de trámite y reportes) y utils/ (entre ellas, el polling de polled-resource y la carga única de loaded-resource)
│   └── features/      Una carpeta por dominio: login/, no-access/ (sesión sin un rol válido), home/ (inicio por rol en /inicio), requests/ (listado en /tramites y detalle en /tramites/:id), admin/ (catálogo, RabbitMQ y Kafka en /administracion), reports/ (indicadores en /reportes y mapa de trámites en /reportes/mapa), audit/ (/auditoria) y legal/ (aviso de privacidad, accesibilidad y condiciones de uso en /legal)
├── styles/            _tokens.scss (paleta, tipografía, espaciado), _accessibility.scss (variables --bd-* por modo), _feedback-state.scss (estados centrados), _material-theme.scss y styles.scss global
└── environments/      Configuración por entorno: Microsoft Entra ID y URL del BFF
```

Los componentes importan los tokens con `@use 'tokens' as *;`, sin colores ni tamaños escritos a mano. Las reglas de diseño, accesibilidad y código frontend están en la [guía de interfaz](docs/guia-de-interfaz.md).

### Logo

El logo oficial está en SVG dentro de la app, no como imagen: así sus colores salen de los tokens `--bd-brand-*` (en `_accessibility.scss`), que apuntan a la paleta y cambian con cada modo de contraste.

- `<app-brand-logo variant="horizontal">` en el header desde 1024 px y entre 480 y 767 px; `variant="symbol"` en el resto de los anchos.
- `<app-brand-logo-vertical>` en el login y la pantalla sin acceso. Va en un componente aparte para que su dibujo no entre al bundle inicial.
- La altura la fija quien lo usa (`height` en la clase del host); el ancho sigue la proporción. Con `decorative` queda fuera del árbol de accesibilidad, para cuando un enlace o un título ya nombran la marca.
- `public/favicon.svg` (claro u oscuro según el navegador), `favicon.ico` de 16, 32 y 48 px y `apple-touch-icon.png` de 180 px usan el símbolo.
- No se deforma, no se le cambian los colores fuera de los tokens y no va sobre fotos. Tamaño mínimo: 16 px de alto el símbolo y 24 px la versión horizontal.

El original (`bd_logo.png`) queda como referencia en `barriodigita-info/imagenes`.

Las rutas de la interfaz van en español (`/tramites`, `/reportes/mapa`); las de la API, en inglés. Las rutas anteriores en inglés redirigen a las nuevas. Las rutas privadas van como hijas del layout de rutas autenticadas en `app.routes.ts`: ese layout monta el header y aplica `authGuard` y `accessGuard`, así que una ruta nueva queda protegida solo por estar ahí. Si además es solo para ciertos roles, se le agrega `canActivate: [roleGuard]` y `data: { roles: [...] }`, como `/auditoria` con `OVERSIGHT_ROLES`, y el ítem del header con los mismos roles. Con `data.deniedRedirect`, el rol sin acceso va a esa ruta en vez de a `/inicio`: así el Funcionario que abre `/reportes` llega a `/reportes/mapa`.

## Despliegue

- **Backend**: BFF y `ms-barriodigital-requests` corren en una instancia EC2 (AWS Academy Learner Lab) vía Docker Compose. Solo el puerto del BFF está expuesto al exterior; `requests` solo es alcanzable dentro de la red interna de Docker, nunca directo desde internet.
- **API Gateway**: HTTP API (`barriodigital-api`) delante del BFF, con un JWT Authorizer que valida issuer y audience contra Microsoft Entra ID antes de reenviar la petición. Rutas protegidas: `GET/POST /api/requests`, `GET /api/requests/{id}` y `GET /api/requests/{id}/attachment`.
- **Verificación**: login, creación y listado de trámites probados de punta a punta contra la infraestructura real en AWS, con el header `Authorization` confirmado en las peticiones al backend.
- **Frontend**: desplegado en AWS Amplify Hosting (deploy manual, sin repositorio Git conectado), con una regla de rewrite (`404-200` a `/index.html`) para que las rutas de Angular funcionen al recargar o acceder directo por URL. Se descartó CloudFront + S3 porque `cloudfront:CreateDistribution` no está permitido en el rol del Learner Lab de AWS Academy.
- **Encabezados de seguridad**: `customHttp.yml` define HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options` y `Referrer-Policy`. Con deploy manual, Amplify no lee el archivo del repositorio: su contenido se copia en los encabezados personalizados de la app en la consola de Amplify cada vez que cambia. Si cambia la URL del API Gateway, se actualiza también `connect-src`.
- **CI**: `ci.yml` corre las pruebas y el build de producción. `security.yml` busca secretos con gitleaks, falla si un PR agrega una dependencia con una vulnerabilidad crítica o si las dependencias de producción tienen una, y comprueba con `scripts/check-security-headers.mjs` que el CSP no bloquee el login, el BFF, el mapa ni las fuentes, y que no permita scripts inline sin autorizar.

## Funcionalidades

### Sesión, roles y navegación

- Login con MSAL (redirect) contra Microsoft Entra ID, con estados de carga, error y redirección a `/inicio` si ya hay sesión.
- Sesión compartida entre pestañas y ventanas; dura hasta cerrar el navegador o cerrar sesión.
- Rutas privadas bajo un layout protegido con `authGuard`, que delega en `MsalGuard`. Sin sesión, llevan al login (`/`). `accessGuard` exige exactamente uno de los cuatro roles y `roleGuard` restringe una ruta a los roles de su `data.roles`; un rol válido sin permiso para la ruta vuelve a `/inicio`.
- Las llamadas `HttpClient` a `bffBaseUrl` llevan `Authorization: Bearer <accessToken>` con el scope `access_as_user`, que trae el claim `roles`. Las demás URLs salen sin token.
- Rol del usuario leído del claim `roles` del accessToken con `resolveAccess` (`shared/models/role.ts`), con el mismo criterio que el BFF: cuenta solo Admin, Funcionario, Vecino y Auditor, e ignora otros App Roles. `AuthService.access()` entrega el resultado y `AuthService.role()` el único rol.
- Pie del sitio en todas las pantallas, con o sin sesión: enlaces a «Privacidad», «Accesibilidad», «Condiciones de uso» y «Soporte». Las tres páginas viven en `/legal`, se leen sin iniciar sesión y no piden aceptación: BarrioDigital no usa cookies de publicidad ni de medición.
- Pantalla `/sin-acceso`, fuera del layout y sin navegación, para una sesión sin rol, con más de un rol o con el token sin leer. Explica el motivo, muestra la cuenta en uso y ofrece ingresar con otra cuenta o contactar a soporte. Si el token no se pudo leer, no culpa a la cuenta: ofrece reintentar y, si ahora trae un solo rol, lleva a `/inicio`.
- Header compartido en todas las rutas autenticadas: navegación del único rol (Vecino y Funcionario: Inicio y Trámites; Admin: además Administración, Reportes y Auditoría; Auditor: además Reportes y Auditoría), nombre de la cuenta con su rol y cierre de sesión. Bajo 768px la navegación se colapsa en un menú.
- `/inicio` según el rol (EP3-04, sección 7). Cada bloque carga, falla y se actualiza por separado: si report o audit no responden, ese bloque muestra «No disponible» y el resto sigue funcionando; un bloque sin datos tiene su propio estado vacío. Los bloques muestran la hora de la consulta y, si vienen de report, «Datos al» con su `lastEventAt`. Cada uno enlaza a su vista completa con los filtros en la URL.
  - Vecino: «Nuevo trámite», que abre el formulario de `/tramites` con el foco en él; sus trámites abiertos más recientes, con «En atención» si tienen responsable, y los conteos de abiertos y cerrados.
  - Funcionario: plazos vencidos y por vencer de sus trámites, paginados en el bloque porque el listado no se filtra por plazo; «Mis asignados» y «Sin asignar», abiertos y del más antiguo al más nuevo.
  - Admin: «Requiere atención» primero, solo cuando hay tipos activos con el cupo diario agotado o mensajes en las DLQ de RabbitMQ, o cuando una de esas consultas falla, con enlace a la sección de Administración ya filtrada; indicadores de las últimas 24 horas, que se actualizan cada 5 s con «Pausar», los mismos de `/reportes`; plazos vencidos de toda la comuna, con el responsable; y trámites sin asignar.
  - Auditor: intervenciones del Admin de los últimos 7 días, con su motivo, y los últimos eventos de auditoría, con la fecha cuando no son de hoy.

### Trámites

- Listado en `/tramites`, conectado al BFF (`GET` y `POST /api/requests`): el Vecino ingresa trámites y ve solo los suyos, que el servidor filtra según el token; el Funcionario, el Admin y el Auditor ven todos; el Auditor sin acciones. La respuesta es paginada (`mat-paginator` de 10, 20 o 50 filas), con búsqueda por folio, descripción o dirección, filtros de situación (abiertos o cerrados), estado, tipo, sector y fechas para todos los roles, y orden por folio, estado y fecha. Búsqueda, filtros, bandeja, orden y página quedan en la URL para compartir o recargar la vista; un valor inválido en la URL se descarta.
- Fila del listado: tipo con su folio (enlace al detalle), descripción recortada con «Ver más» cuando no cabe, solicitante y responsable para el personal, estado con un menú rápido (detalle, actividad, motivo, imagen y mapa) y fecha. Bajo 1280 px el personal ve tarjetas; el Vecino, bajo 768 px.
- Estado del plazo para el personal: con los ids de cada página, el listado pide `GET /api/report/sla/batch` y muestra el estado de report bajo el estado del trámite (en la tabla comparten celda, para no quitarle espacio a la descripción) o como campo «Plazo» en las tarjetas. En un trámite abierto acompaña el vencimiento («Venció el 10 nov», «Vence mañana») y en uno cerrado y evaluado, la fecha comprometida. «Sin plazo» va como texto neutro; «—» es un trámite que report no conoce. Si report no responde, el listado se muestra igual, el plazo dice «No disponible» y un aviso permite reintentar solo los plazos. El Vecino no consulta report.
- Asignación desde el listado: el Funcionario toma un trámite sin responsable, reasigna los suyos desde el menú de acciones y solo lee los de otro funcionario. El Admin asigna y reasigna desde la fila. Un diálogo ofrece la lista de funcionarios con búsqueda y pide el motivo solo al reasignar; si otra persona tomó el trámite mientras tanto, muestra el responsable nuevo y pide el motivo. La bandeja «Todos», «Mis asignados» y «Sin asignar» filtra por responsable; «Mis asignados» no aparece para Admin ni Auditor, que nunca son responsables. «Contacto pendiente», solo para staff, deja los trámites con un reintento de contacto vencido o de hoy; se combina con la bandeja y los filtros, viaja en la URL y la exportación, y se quita con «Limpiar filtros».
- Detalle en `/tramites/:id`, con acceso directo para los cuatro roles; requests responde 404 cuando el trámite no existe o es ajeno al Vecino. Muestra folio (copiable), tipo, estado con su avance, plazo en días hábiles si tiene (en el panel de atención, con una ayuda que explica cómo se cuenta según el rol y, para el personal, el estado de report y su vencimiento, que cargan y fallan aparte del trámite), datos de la solicitud, el punto en un mapa que se arrastra y se acerca con sus botones (la rueda no hace zoom, para no atrapar el scroll de la página), la imagen adjunta ampliable y el historial de `/actividad`, del más reciente al más antiguo. La carga, el error con reintento y el 404 tienen pantalla propia; el historial y la imagen cargan y fallan por separado del trámite.
- Acciones del detalle según rol y responsable: el Funcionario toma un trámite abierto sin responsable y, como responsable, cambia el estado, rechaza, registra gestiones y lo reasigna; si otro funcionario es el responsable, solo lee. El Admin asigna un trámite sin responsable, reasigna cualquiera y opera cualquier trámite abierto, con un motivo de intervención obligatorio y de uso interno, distinto del motivo de rechazo. El Auditor no tiene acciones. Un trámite resuelto, rechazado o cancelado no ofrece acciones. El Vecino titular ve la encuesta de satisfacción en un trámite `RESUELTO` aún no calificado y solo puede enviarla una vez; después el detalle muestra la nota. Tras cada acción el detalle usa el trámite que devuelve el backend y vuelve a pedir el historial y los tiempos; si el backend avisa que otro funcionario lo tomó o lo reasignó, recarga el trámite.
- Datos por rol en el detalle: el Vecino ve «En atención» sin el nombre del responsable, los eventos del personal como «Municipalidad» y el motivo si su trámite fue rechazado. El personal ve el responsable, el solicitante, los tiempos, las gestiones y las marcas internas; el motivo de intervención solo se muestra al personal, y el Auditor no ve el correo del solicitante.
- Comentario del vecino: en un trámite abierto, el titular agrega desde el historial un texto de 1 a 500 caracteres y una foto opcional, con las mismas reglas que la imagen del alta. Un trámite admite 20; cerca del tope el formulario dice cuántos quedan y, al llegar, el botón se reemplaza por un aviso. El comentario aparece en el historial para el titular y el personal, que puede filtrarlo; su foto se pide al acercarse a la pantalla. Si requests responde que el trámite se cerró o llegó al tope, el formulario se cierra y el detalle se recarga. requests no tiene códigos para estos errores: solo el 413 se muestra en la imagen, y un 400 se muestra en el formulario, porque también puede venir del texto o del cuerpo.
- Ubicación del trámite: el Vecino puede indicar sector, referencia y punto (GPS, mapa o coordenadas) al reportarlo. El personal la ve en el detalle y abre el mapa desde el menú de la fila; los campos adicionales son opcionales.
- Posibles duplicados al crear un trámite: con el tipo y un punto dentro de la comuna o un sector comparable ("Otro sector de la comuna" no cuenta), el bloque Ubicación consulta `GET /api/requests/duplicates` medio segundo después del último cambio y muestra los trámites abiertos que podrían estar relacionados: tipo, estado, folio, cercanía y fecha, sin datos del solicitante. No bloquea el ingreso. Sobre tres resultados, la lista parte con dos y se despliega. Uno propio se abre en otra pestaña, filtrado por folio, para no perder el formulario. Si la consulta falla, lo dice y ofrece reintentar; un 403 oculta el aviso.
- Imagen de respaldo opcional al crear un trámite: una sola imagen JPEG, PNG o WebP de hasta 5 MB. Se revisan dimensiones y lectura en el navegador; WebP se convierte a PNG. La petición multipart y la descarga/preview de la imagen usan el BFF autenticado; requests vuelve a validar los bytes, guarda una copia sin metadatos en Oracle y limita la descarga al titular o al personal municipal. Funcionario puede abrir la preview dentro de la vista de trámites y descargarla desde ese diálogo. La imagen del alta, la de un comentario y la seleccionada se amplían en el mismo diálogo (`shared/components/image-preview-dialog`).
- Solicitante en el listado: solo el personal ve el nombre persistido del creador en tabla y tarjetas. Los valores ausentes o vacíos muestran «Sin nombre»; los respaldos no vacíos entregados por el backend se conservan. El nombre se mantiene al recargar después de cambiar el estado.
- Admisión: el diálogo distingue errores por `code` del BFF, incluyendo falta de cupo y tipo inexistente. Ante reserva/cambio inciertos, respuesta de éxito ilegible o compensación no confirmada conserva la información y bloquea otro envío desde ese diálogo; permite cerrar y actualizar el listado o el trámite, según desde dónde se abrió. También protege una admisión con error de red sin respuesta del BFF. Recargar no garantiza recuperar cupo ni resolver la coordinación; no hay reintentos automáticos de PUT. Los errores antiguos conservan su presentación.

### Catálogo y administración

- Catálogo real de tipos de trámite, obtenido con `GET /api/catalog/procedures` mediante el BFF para los cuatro roles. El formulario ofrece solo tipos activos; el nombre del tipo en el listado, sus diálogos, el detalle y el inicio sigue un solo criterio: el nombre actual del catálogo completo, luego el guardado al crear el trámite y, al final, el código. `CatalogService.labels` se actualiza con cualquier consulta del catálogo, así que el detalle y el inicio solo lo piden si nadie lo cargó en la sesión, sin esperarlo; la auditoría conserva el nombre histórico. La carga y el reintento son independientes del listado y las transiciones. Los errores conservan los textos del formulario; una recarga fallida conserva los últimos labels, pero bloquea la creación. El BFF vuelve a validar el tipo al crear. No se muestran cupos.
- Administración de tipos de trámite, solo para Admin: catálogo completo con tabla y tarjetas, búsqueda por código o nombre y filtro por estado, creación sin límite diario y edición de nombre, actividad, cupo y plazo de atención. El diálogo se ordena en Identificación, Disponibilidad y Límites de atención; el código, inmutable, se muestra como dato al editar. Cupo y plazo usan el mismo patrón: un campo numérico y la opción «Sin límite diario» o «Sin plazo» (de 1 a 120 días hábiles, también al crear). Cada PUT envía el cupo y el plazo explícitamente, porque catalog reemplaza ambos: sin el plazo, el tipo quedaría sin plazo. La tabla y las tarjetas muestran el «Plazo de atención». Se muestra «Disponible hoy» con el dato del backend: número, «Agotado», «Sin límite» o «No disponible» ante datos ausentes o inconsistentes. «Actualizar» consulta solo el catálogo, sin cálculo local ni actualización periódica, conservando los últimos datos durante la carga y ante errores. Los diálogos conservan los datos ante errores y las recargas fallidas después de guardar permiten reintentar solo el GET; en error, «Reintentar» es la única acción de recuperación.
- Las tres secciones de `/administracion` (Catálogo, RabbitMQ y Kafka) son pestañas cuya selección queda en la URL (`?seccion=`). Cada una muestra sus indicadores, búsqueda y filtros, tabla o tarjetas en móvil, y el detalle de cada elemento en un diálogo. Se consultan al entrar y con «Actualizar», sin actualización automática. Sin datos, un error explica si el servicio no responde (503), si falta permiso (403) o si falló otra cosa; con datos, se conservan y un aviso ofrece reintentar.
- RabbitMQ (`/api/mq/queues` vía BFF) lista las colas con mensajes en espera, sin confirmar, consumidores y destino de mensajes muertos; el filtro (todas, con mensajes o DLQ) queda en la URL como `?mostrar=`. Vaciar y eliminar piden confirmación y no se ofrecen en la topología del sistema (`q.cmd.*`), que mq-admin rechaza. Si mq-admin no envía el desglose de mensajes, se muestra «No disponible» y no 0.
- Kafka (`/api/kafka/*` vía BFF) muestra tópicos con el estado de sus réplicas, grupos de consumo con su retraso (una partición sin offset se informa como tal, no como 0) y los mensajes de cada DLT. El reinicio de offsets al inicio exige simular primero y no se ofrece con miembros conectados; el reenvío desde la DLT es por selección y con confirmación.

### Reportes y auditoría

- `/reportes`, para Admin y Auditor mediante `roleGuard`, con enlace «Reportes» en escritorio y móvil y dos pestañas: «Indicadores» y «Mapa de trámites». La pestaña «Indicadores» muestra los indicadores de `ms-barriodigital-report` vía BFF (`/api/report/kpis` y `/api/report/top-procedures`): trámites abiertos, ingresados, tiempo medio de resolución y cumplimiento de plazo; altas por hora o por día en hora de Chile, con tabla alternativa; estados activos y los cinco tipos más demandados. El período (`last24h` o `last7d`) queda en la URL como `?range=`.
- Se actualiza cada 5 s con `polledResource` (`shared/utils/polled-resource.ts`): la consulta siguiente se agenda al terminar la anterior, no corre con la pestaña oculta y se detiene al salir. Cada fuente tiene su propia hora de consulta y su espera creciente ante errores (hasta 60 s), y conserva sus últimos datos con un aviso si una actualización falla; los datos de otro período nunca se muestran como del elegido. «Pausar» detiene la actualización automática; «Actualizar» y el cambio de período consultan sin reanudarla. «Datos al» es el `lastEventAt` de report y «Consultado», la hora de la respuesta más antigua en pantalla.
- `/reportes/mapa`, para Funcionario, Admin y Auditor. El Funcionario no ve los indicadores: su enlace «Mapa de trámites» abre el mapa sin pestañas. Consulta `/api/report/map-points` cada 30 s con el mismo `polledResource`, filtrado por período (7 días por defecto), estados y tipo, que quedan en la URL (`?range=`, `?status=`, `?type=`) junto con la vista (`?view=list`).
  - Mapa Leaflet de la comuna con `leaflet.markercluster`: los puntos cercanos o con la misma coordenada se agrupan y se abren al acercarse o en abanico. Cada marcador es un botón con folio, tipo y estado, y abre una ficha con enlace al detalle. Abiertos rellenos y cerrados huecos, con una forma por grupo («Otros abiertos», «En terreno», «Resuelto», «Rechazado o cancelado»), para que el estado no dependa del color. Las actualizaciones automáticas conservan el zoom, la posición y la ficha abierta; el mapa se reencuadra solo al cambiar de filtro.
  - Totales de trámites, con ubicación y sin ubicación, y concentración por sector, que consideran todos los trámites filtrados. Un aviso indica cuándo report recortó los puntos a los 1000 más recientes. La vista «Lista» muestra los mismos trámites en una tabla paginada, como alternativa al mapa para teclado y lectores de pantalla.
  - Si el catálogo no carga, el filtro de tipo se deshabilita, conserva el tipo activo y ofrece reintentar; «Actualizar» también lo vuelve a pedir.
- `/auditoria`, para Admin y Auditor mediante `roleGuard`, con enlace «Auditoría» en escritorio y móvil. De solo lectura, consulta `ms-barriodigital-audit` vía BFF en dos pestañas. Filtros, pestaña y página quedan en la URL y un valor inválido se descarta. No se actualiza sola: «Actualizar» vuelve a consultar y muestra la hora de la consulta.
  - «Eventos» (`/api/audit/events`): búsqueda paginada por rol del actor, actor, recurso, tipos de evento y fechas. Abre con los últimos 7 días, que se pueden quitar (`?period=all`); fechas y horas se leen en hora de Chile. Cada evento se despliega con su detalle legible, `before` y `after` en los cambios de configuración, la IP de origen cuando existe y los datos originales.
  - «Por trámite» (`?view=timeline`, `/api/audit/timeline`): historial completo de un folio, del más antiguo al más reciente, con el motivo de intervención del Admin. El detalle de un trámite lo abre con «Ver en auditoría».

### Accesibilidad

- Los colores semánticos (primario, secundario, éxito, error, acento, sus fondos y el borde de los controles) son variables `--bd-*` de `styles/_accessibility.scss`, redefinidas en cada modo de contraste del widget. Los componentes del detalle del trámite los toman de esas variables y no de colores fijos, para que los modos oscuro, alto contraste y negativo se apliquen sin reglas por componente. En alto contraste y negativo, `--bd-container-border` dibuja el borde de avisos, chips y tarjetas que en el modo claro se distinguen solo por el fondo.
- Los estados no dependen solo del color: el avance del trámite marca cada paso con ícono y texto para lectores de pantalla, el tramo en curso de los reportes va rayado y las animaciones se omiten con `prefers-reduced-motion` o con la opción de pausar animaciones.
- Los reportes que se actualizan solos no se anuncian en cada ciclo; el lector de pantalla recibe el resultado de Actualizar, del cambio de período y de la pausa, y cada paso entre fallo y recuperación. La escala de texto del widget se aplica también a los valores y ejes de los reportes.

## Mejoras futuras

- **Header: menú de cuenta como desplegable (post EP1-08).** Hoy la zona de
  cuenta del header muestra el nombre en texto plano y un botón "Cerrar
  sesión" directo, porque es la única acción disponible. Cuando existan más
  acciones asociadas a la cuenta, migrar a un desplegable disparado por un
  círculo con las iniciales del usuario, reemplazando el nombre en texto
  plano (no conviviendo con él).
