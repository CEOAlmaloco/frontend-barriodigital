# BarrioDigital · Frontend

Aplicación web de BarrioDigital, la plataforma municipal de trámites y atención vecinal. Los usuarios inician sesión con su cuenta de Microsoft Entra ID; el backend (microservicios Spring Boot) vive en otros repositorios.

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

Las pruebas cubren `AppComponent`, `AuthService`, los guards, la configuración de MSAL (incluido el interceptor HTTP), la lectura de claims del token, `LoginComponent`, `DashboardComponent`, `HeaderComponent`, `RequestsService`, `CatalogService`, `RequestsComponent`, `RequestDetailComponent` (por rol, estados de carga, error y 404, estados terminales, privacidad y actualización tras cada acción) y las rutas protegidas por rol.

## Estructura

```
src/
├── app/
│   ├── core/          Servicios únicos de la app: auth/ (MSAL, sesión, roles y guards), catalog/ (catálogo vía BFF) y layout/ (contenedor de las rutas autenticadas)
│   ├── shared/        Componentes, pipes y modelos compartidos entre features. Hoy: components/header y models/ (roles, trámites y tipos de trámite)
│   └── features/      Una carpeta por dominio: login/, no-access/ (sesión sin un rol válido), dashboard/ (placeholder de /inicio) y requests/ (listado en /tramites y detalle en /tramites/:id)
├── styles/            _tokens.scss (paleta, tipografía, espaciado), _material-theme.scss y styles.scss global
└── environments/      Configuración por entorno: Microsoft Entra ID y URL del BFF
```

Los componentes importan los tokens con `@use 'tokens' as *;`, sin colores ni tamaños escritos a mano.

Las rutas privadas van como hijas del layout de rutas autenticadas en `app.routes.ts`: ese layout monta el header y aplica `authGuard` y `accessGuard`, así que una ruta nueva queda protegida solo por estar ahí. Si además es solo para ciertos roles, se le agrega `canActivate: [roleGuard]` y `data: { roles: [...] }`, como `/reports` con `OVERSIGHT_ROLES`, y el ítem del header con los mismos roles.

## Despliegue

- **Backend**: BFF y `ms-barriodigital-requests` corren en una instancia EC2 (AWS Academy Learner Lab) vía Docker Compose. Solo el puerto del BFF está expuesto al exterior; `requests` solo es alcanzable dentro de la red interna de Docker, nunca directo desde internet.
- **API Gateway**: HTTP API (`barriodigital-api`) delante del BFF, con un JWT Authorizer que valida issuer y audience contra Microsoft Entra ID antes de reenviar la petición. Rutas protegidas: `GET/POST /api/requests`, `GET /api/requests/{id}` y `GET /api/requests/{id}/attachment`.
- **Verificación**: login, creación y listado de trámites probados de punta a punta contra la infraestructura real en AWS, con el header `Authorization` confirmado en las peticiones al backend.
- **Frontend**: desplegado en AWS Amplify Hosting (deploy manual, sin repositorio Git conectado), con una regla de rewrite (`404-200` a `/index.html`) para que las rutas de Angular funcionen al recargar o acceder directo por URL. Se descartó CloudFront + S3 porque `cloudfront:CreateDistribution` no está permitido en el rol del Learner Lab de AWS Academy.

## Funcionalidades

### Sesión, roles y navegación

- Login con MSAL (redirect) contra Microsoft Entra ID, con estados de carga, error y redirección a `/inicio` si ya hay sesión.
- Sesión compartida entre pestañas y ventanas; dura hasta cerrar el navegador o cerrar sesión.
- Rutas privadas bajo un layout protegido con `authGuard`, que delega en `MsalGuard`. Sin sesión, llevan al login (`/`). `accessGuard` exige exactamente uno de los cuatro roles y `roleGuard` restringe una ruta a los roles de su `data.roles`; un rol válido sin permiso para la ruta vuelve a `/inicio`.
- Las llamadas `HttpClient` a `bffBaseUrl` llevan `Authorization: Bearer <accessToken>` con el scope `access_as_user`, que trae el claim `roles`. Las demás URLs salen sin token.
- Rol del usuario leído del claim `roles` del accessToken con `resolveAccess` (`shared/models/role.ts`), con el mismo criterio que el BFF: cuenta solo Admin, Funcionario, Vecino y Auditor, e ignora otros App Roles. `AuthService.access()` entrega el resultado y `AuthService.role()` el único rol.
- Pantalla `/no-access`, fuera del layout y sin navegación, para una sesión sin rol, con más de un rol o con el token sin leer. Explica el motivo, muestra la cuenta en uso y ofrece ingresar con otra cuenta o contactar a soporte. Si el token no se pudo leer, no culpa a la cuenta: ofrece reintentar y, si ahora trae un solo rol, lleva a `/inicio`.
- Header compartido en todas las rutas autenticadas: navegación del único rol (Vecino y Funcionario: Inicio y Trámites; Admin: además Administración, Reportes y Auditoría; Auditor: además Reportes y Auditoría), nombre de la cuenta con su rol y cierre de sesión. Bajo 768px la navegación se colapsa en un menú.
- `/inicio` como placeholder: título Inicio, saludo con el nombre de la cuenta y un ejemplo temporal de contenido para Admin y para Vecino.

### Trámites

- Listado en `/tramites`, conectado al BFF (`GET` y `POST /api/requests`): el Vecino ingresa trámites y ve solo los suyos, que el servidor filtra según el token; el Funcionario, el Admin y el Auditor ven todos; el Auditor sin acciones. La respuesta es paginada (`mat-paginator` de 10, 20 o 50 filas), con búsqueda por folio, descripción o dirección, filtros de estado, tipo, sector y fechas para todos los roles, y orden por folio, estado y fecha. Búsqueda, filtros, bandeja, orden y página quedan en la URL para compartir o recargar la vista; un valor inválido en la URL se descarta.
- Fila del listado: tipo con su folio (enlace al detalle), descripción recortada con «Ver más» cuando no cabe, solicitante y responsable para el personal, estado con un menú rápido (detalle, actividad, motivo, imagen y mapa) y fecha. Bajo 1280 px el personal ve tarjetas; el Vecino, bajo 768 px.
- Asignación desde el listado: el Funcionario toma un trámite sin responsable, reasigna los suyos desde el menú de acciones y solo lee los de otro funcionario. El Admin asigna y reasigna desde la fila. Un diálogo ofrece la lista de funcionarios con búsqueda y pide el motivo solo al reasignar; si otra persona tomó el trámite mientras tanto, muestra el responsable nuevo y pide el motivo. La bandeja «Todos», «Mis asignados» y «Sin asignar» filtra por responsable; «Mis asignados» no aparece para Admin ni Auditor, que nunca son responsables.
- Detalle en `/tramites/:id`, con acceso directo para los cuatro roles; requests responde 404 cuando el trámite no existe o es ajeno al Vecino. Muestra folio (copiable), tipo, estado con su avance, plazo en días hábiles si tiene, datos de la solicitud, el punto en un mapa que se arrastra y se acerca con sus botones (la rueda no hace zoom, para no atrapar el scroll de la página), la imagen adjunta ampliable y el historial de `/actividad`, del más reciente al más antiguo. La carga, el error con reintento y el 404 tienen pantalla propia; el historial y la imagen cargan y fallan por separado del trámite.
- Acciones del detalle según rol y responsable: el Funcionario toma un trámite abierto sin responsable y, como responsable, cambia el estado, rechaza, registra gestiones y lo reasigna; si otro funcionario es el responsable, solo lee. El Admin asigna un trámite sin responsable, reasigna cualquiera y opera cualquier trámite abierto, con un motivo de intervención obligatorio y de uso interno, distinto del motivo de rechazo. El Auditor no tiene acciones. Un trámite resuelto, rechazado o cancelado no ofrece acciones. Tras cada acción el detalle usa el trámite que devuelve el backend y vuelve a pedir el historial y los tiempos; si el backend avisa que otro funcionario lo tomó o lo reasignó, recarga el trámite.
- Datos por rol en el detalle: el Vecino ve «En atención» sin el nombre del responsable, los eventos del personal como «Municipalidad» y el motivo si su trámite fue rechazado. El personal ve el responsable, el solicitante, los tiempos, las gestiones y las marcas internas; el motivo de intervención solo se muestra al personal, y el Auditor no ve el correo del solicitante.
- Ubicación del trámite: el Vecino puede indicar sector, referencia y punto (GPS, mapa o coordenadas) al reportarlo. El personal la ve en el detalle y abre el mapa desde el menú de la fila; los campos adicionales son opcionales.
- Imagen de respaldo opcional al crear un trámite: una sola imagen JPEG, PNG o WebP de hasta 5 MB. Se revisan dimensiones y lectura en el navegador; WebP se convierte a PNG. La petición multipart y la descarga/preview de la imagen usan el BFF autenticado; requests vuelve a validar los bytes, guarda una copia sin metadatos en Oracle y limita la descarga al titular o al personal municipal. Funcionario puede abrir la preview dentro de la vista de trámites y descargarla desde ese diálogo.
- Solicitante en el listado: solo el personal ve el nombre persistido del creador en tabla y tarjetas. Los valores ausentes o vacíos muestran «Sin nombre»; los respaldos no vacíos entregados por el backend se conservan. El nombre se mantiene al recargar después de cambiar el estado.
- Admisión: el diálogo distingue errores por `code` del BFF, incluyendo falta de cupo y tipo inexistente. Ante reserva/cambio inciertos, respuesta de éxito ilegible o compensación no confirmada conserva la información y bloquea otro envío desde ese diálogo; permite cerrar y actualizar el listado o el trámite, según desde dónde se abrió. También protege una admisión con error de red sin respuesta del BFF. Recargar no garantiza recuperar cupo ni resolver la coordinación; no hay reintentos automáticos de PUT. Los errores antiguos conservan su presentación.

### Catálogo y administración

- Catálogo real de tipos de trámite, obtenido con `GET /api/catalog/procedures` mediante el BFF para los cuatro roles. El formulario ofrece solo tipos activos; los labels del listado y diálogos usan el catálogo completo, con el código como respaldo. La carga y el reintento son independientes del listado y las transiciones. Los errores conservan los textos del formulario; una recarga fallida conserva los últimos labels, pero bloquea la creación. El BFF vuelve a validar el tipo al crear. No se muestran cupos.
- Administración de tipos de trámite, solo para Admin: catálogo completo con tabla y tarjetas, creación sin límite diario y edición de nombre, actividad y cupo. El código se presenta en un campo de solo lectura al editar y es inmutable; cada PUT envía el cupo explícitamente. Se muestra «Cupo disponible hoy» con el dato del backend: número, «Agotado», «Sin límite» o «No disponible» ante datos ausentes o inconsistentes. «Actualizar» consulta solo el catálogo, sin cálculo local ni actualización periódica, conservando los últimos datos durante la carga y ante errores. Los diálogos conservan los datos ante errores y las recargas fallidas después de guardar permiten reintentar solo el GET; en error, «Reintentar» es la única acción de recuperación.

### Reportes y auditoría

- `/reports`, para Admin y Auditor mediante `roleGuard`, con enlace «Reportes» en escritorio y móvil. Pantalla provisional con el título «Reportes» y un mensaje sobre los futuros indicadores comunales al implementar el procesamiento de eventos con Kafka; no realiza consultas HTTP ni depende de un servicio de reportes.
- `/audit`, para Admin y Auditor mediante `roleGuard`, con enlace «Auditoría» en escritorio y móvil. Pantalla provisional del futuro historial de eventos de los trámites al implementar la integración con Kafka; no realiza consultas HTTP ni depende de un servicio de auditoría.

### Accesibilidad

- Los colores semánticos (primario, secundario, éxito, error, acento, sus fondos y el borde de los controles) son variables `--bd-*` de `styles/_accessibility.scss`, redefinidas en cada modo de contraste del widget. Los componentes del detalle del trámite los toman de esas variables y no de colores fijos, para que los modos oscuro, alto contraste y negativo se apliquen sin reglas por componente. En alto contraste y negativo, `--bd-container-border` dibuja el borde de avisos, chips y tarjetas que en el modo claro se distinguen solo por el fondo.
- Los estados no dependen solo del color: el avance del trámite marca cada paso con ícono y texto para lectores de pantalla, y las animaciones se omiten con `prefers-reduced-motion` o con la opción de pausar animaciones.

## Mejoras futuras

- **Header: menú de cuenta como desplegable (post EP1-08).** Hoy la zona de
  cuenta del header muestra el nombre en texto plano y un botón "Cerrar
  sesión" directo, porque es la única acción disponible. Cuando existan más
  acciones asociadas a la cuenta, migrar a un desplegable disparado por un
  círculo con las iniciales del usuario, reemplazando el nombre en texto
  plano (no conviviendo con él).
