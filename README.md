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

   Abre `http://localhost:4200` e inicia sesión con una cuenta del tenant de BarrioDigital. Esa URL tiene que estar registrada en Entra ID como redirect URI de tipo *Single-page application*.

## Tests

```bash
npm test                      # modo watch
npm test -- --watch=false     # una sola ejecución
```

Las pruebas cubren `AppComponent`, `AuthService`, los guards, la configuración de MSAL (incluido el interceptor HTTP), la lectura de claims del token, `LoginComponent`, `DashboardComponent`, `HeaderComponent`, `RequestsService`, `CatalogService` y `RequestsComponent`.

## Estructura

```
src/
├── app/
│   ├── core/          Servicios únicos de la app: auth/ (MSAL, sesión, roles y guards), catalog/ (catálogo vía BFF) y layout/ (contenedor de las rutas autenticadas)
│   ├── shared/        Componentes, pipes y modelos compartidos entre features. Hoy: components/header y models/ (roles, trámites y tipos de trámite)
│   └── features/      Una carpeta por dominio: login/, dashboard/ (placeholder de /inicio) y requests/ (vista de trámites en /tramites)
├── styles/            _tokens.scss (paleta, tipografía, espaciado), _material-theme.scss y styles.scss global
└── environments/      Configuración por entorno: Microsoft Entra ID y URL del BFF
```

Los componentes importan los tokens con `@use 'tokens' as *;`, sin colores ni tamaños escritos a mano.

Las rutas privadas van como hijas del layout de rutas autenticadas en `app.routes.ts`: ese layout monta el header y aplica `authGuard`, así que una ruta nueva queda protegida solo por estar ahí. Si además es solo para ciertos roles, se le agrega `canActivate: [roleGuard]` y `data: { roles: [...] }`, como `/tramites` con `REQUESTS_ROLES`.

## Despliegue

- **Backend**: BFF y `ms-barriodigital-requests` corren en una instancia EC2 (AWS Academy Learner Lab) vía Docker Compose. Solo el puerto del BFF está expuesto al exterior; `requests` solo es alcanzable dentro de la red interna de Docker, nunca directo desde internet.
- **API Gateway**: HTTP API (`barriodigital-api`) delante del BFF, con un JWT Authorizer que valida issuer y audience contra Microsoft Entra ID antes de reenviar la petición. Rutas protegidas: `GET/POST /api/requests`, `GET /api/requests/{id}`.
- **Frontend**: desplegado en AWS Amplify Hosting (deploy manual, sin repositorio Git conectado), con una regla de rewrite (`404-200` a `/index.html`) para que las rutas de Angular funcionen al recargar o acceder directo por URL. Se descartó CloudFront + S3 porque `cloudfront:CreateDistribution` no está permitido en el rol del Learner Lab de AWS Academy.

## Estado actual

Implementado:

- Login con MSAL (redirect) contra Microsoft Entra ID, con estados de carga, error y redirección a `/inicio` si ya hay sesión.
- Sesión compartida entre pestañas y ventanas; dura hasta cerrar el navegador o cerrar sesión.
- Rutas privadas bajo un layout protegido con `authGuard`, que delega en `MsalGuard`. Sin sesión, llevan al login (`/`). `roleGuard` restringe una ruta a los roles de su `data.roles`.
- Las llamadas `HttpClient` a `bffBaseUrl` llevan `Authorization: Bearer <accessToken>` con el scope `access_as_user`, que trae el claim `roles`. Las demás URLs salen sin token.
- Roles del usuario leídos del claim `roles` del accessToken: `AuthService.roles()` y `AuthService.hasRole(Role.Admin)`, con los nombres de rol en `shared/models/role.ts`.
- Header compartido en todas las rutas autenticadas: navegación según rol (Trámites solo para Vecino y Funcionario), nombre de la cuenta y cierre de sesión. Bajo 768px la navegación se colapsa en un menú.
- `/inicio` como placeholder: título Inicio, saludo con el nombre de la cuenta y un ejemplo temporal de contenido para Admin y para Vecino.
- `/reports` (EP1.5-21), solo para Admin mediante `roleGuard`, con enlace «Reportes» junto a Administración en escritorio y móvil. Pantalla provisional con el título «Reportes» y un mensaje sobre los futuros indicadores comunales al implementar el procesamiento de eventos con Kafka; no realiza consultas HTTP ni depende de un servicio de reportes.
- `/audit` (EP1.5-22), solo para usuarios con rol Auditor mediante `roleGuard`, con enlace «Auditoría» en escritorio y móvil. Pantalla provisional del futuro historial de eventos de los trámites al implementar la integración con Kafka; no realiza consultas HTTP ni depende de un servicio de auditoría.
- Vista de trámites en `/tramites` (EP1-08), conectada al BFF (`GET` y `POST /api/requests`): el Vecino ingresa trámites y ve solo los suyos, que el servidor filtra según el token; el Funcionario ve todos, con filtros de estado y fechas. Admin y Auditor no tienen acceso.
- Solicitante en Trámites (EP1.5-25): solo Funcionario ve el nombre persistido del creador en tabla y tarjetas. Los valores ausentes o vacíos muestran «Sin nombre»; los respaldos no vacíos entregados por el backend se conservan. El nombre se mantiene al recargar después de cambiar el estado.
- Catálogo real de tipos de trámite (EP1.5-14), obtenido con `GET /api/catalog/procedures` mediante el BFF para Vecino y Funcionario. El formulario ofrece solo tipos activos; los labels del listado y diálogos usan el catálogo completo, con el código como respaldo. La carga y el reintento son independientes del listado y las transiciones. Los errores conservan los textos del formulario; una recarga fallida conserva los últimos labels, pero bloquea la creación. El BFF vuelve a validar el tipo al crear. No se muestran cupos.
- Administración de tipos de trámite (EP1.5-15 y EP1.5-19), solo para Admin: catálogo completo con tabla y tarjetas, creación sin límite diario y edición de nombre, actividad y cupo. El código se presenta en un campo de solo lectura al editar y es inmutable; cada PUT envía el cupo explícitamente. Se muestra «Cupo disponible hoy» con el dato del backend: número, «Agotado», «Sin límite» o «No disponible» ante datos ausentes o inconsistentes. «Actualizar» consulta solo el catálogo, sin cálculo local ni actualización periódica, conservando los últimos datos durante la carga y ante errores. Los diálogos conservan los datos ante errores y las recargas fallidas después de guardar permiten reintentar solo el GET; en error, «Reintentar» es la única acción de recuperación.
- Admisión (EP1.5-18): el diálogo distingue errores por `code` del BFF, incluyendo falta de cupo y tipo inexistente. Ante reserva/cambio inciertos, respuesta de éxito ilegible o compensación no confirmada conserva la información y bloquea otro envío desde ese diálogo; permite cerrar y actualizar solo el listado. También protege una admisión con error de red sin respuesta del BFF. Recargar no garantiza recuperar cupo ni resolver la coordinación; no hay reintentos automáticos de PUT. Los errores antiguos conservan su presentación.
- Flujo verificado de punta a punta contra la infraestructura real en AWS: login, creación y listado de trámites, con el header `Authorization` confirmado en las peticiones al backend real (cierra la verificación pendiente de EP1-06).

El resto de la aplicación se construye issue por issue según el tablero del proyecto.

## Mejoras futuras

- **Header: menú de cuenta como desplegable (post EP1-08).** Hoy la zona de
  cuenta del header muestra el nombre en texto plano y un botón "Cerrar
  sesión" directo, porque es la única acción disponible. Cuando existan más
  acciones asociadas a la cuenta, migrar a un desplegable disparado por un
  círculo con las iniciales del usuario, reemplazando el nombre en texto
  plano (no conviviendo con él).
