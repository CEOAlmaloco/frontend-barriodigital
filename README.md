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

   `bffBaseUrl` es la URL del BFF. Toda llamada a esa URL sale con el token de acceso; ajústala cuando el BFF tenga su puerto definido.

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

Hoy hay 45 tests en 10 archivos: `AppComponent`, `AuthService`, los guards, la configuración de MSAL (incluido el interceptor HTTP), la lectura de claims del token, `LoginComponent`, `DashboardComponent`, `HeaderComponent`, `RequestsService` y `RequestsComponent`.

## Estructura

```
src/
├── app/
│   ├── core/          Servicios únicos de la app. Hoy: auth/ (configuración de MSAL, AuthService con sesión y roles, guards) y layout/ (contenedor de las rutas autenticadas)
│   ├── shared/        Componentes, pipes y modelos compartidos entre features. Hoy: components/header y models/ (roles y trámites)
│   └── features/      Una carpeta por dominio: login/, dashboard/ (placeholder de /inicio) y requests/ (vista de trámites en /tramites)
├── styles/            _tokens.scss (paleta, tipografía, espaciado), _material-theme.scss y styles.scss global
└── environments/      Configuración por entorno: Microsoft Entra ID y URL del BFF
```

Los componentes importan los tokens con `@use 'tokens' as *;`, sin colores ni tamaños escritos a mano.

Las rutas privadas van como hijas del layout de rutas autenticadas en `app.routes.ts`: ese layout monta el header y aplica `authGuard`, así que una ruta nueva queda protegida solo por estar ahí. Si además es solo para ciertos roles, se le agrega `canActivate: [roleGuard]` y `data: { roles: [...] }`, como `/tramites` con `REQUESTS_ROLES`.

## Estado actual

Implementado:

- Login con MSAL (redirect) contra Microsoft Entra ID, con estados de carga, error y redirección a `/inicio` si ya hay sesión.
- Sesión compartida entre pestañas y ventanas; dura hasta cerrar el navegador o cerrar sesión.
- Rutas privadas bajo un layout protegido con `authGuard`, que delega en `MsalGuard`. Sin sesión, llevan al login (`/`). `roleGuard` restringe una ruta a los roles de su `data.roles`.
- Las llamadas `HttpClient` a `bffBaseUrl` llevan `Authorization: Bearer <accessToken>` con el scope `access_as_user`, que trae el claim `roles`. Las demás URLs salen sin token.
- Roles del usuario leídos del claim `roles` del accessToken: `AuthService.roles()` y `AuthService.hasRole(Role.Admin)`, con los nombres de rol en `shared/models/role.ts`.
- Header compartido en todas las rutas autenticadas: navegación según rol (Trámites solo para Vecino y Funcionario), nombre de la cuenta y cierre de sesión. Bajo 768px la navegación se colapsa en un menú.
- `/inicio` como placeholder: título Inicio, saludo con el nombre de la cuenta y un ejemplo temporal de contenido para Admin y para Vecino.
- Vista de trámites en `/tramites` (EP1-08), con datos mock: el Vecino ingresa trámites y ve solo los suyos; el Funcionario ve todos, con filtros de estado y fechas y el nombre del solicitante. Admin y Auditor no tienen acceso.

El resto de la aplicación se construye issue por issue según el tablero del proyecto.

## Deuda técnica

- **RequestsService usa datos mock (EP1-08).** El backend real de trámites
  (ms-barriodigital-requests, vía el BFF) todavía no estaba disponible al
  implementar la vista de trámites. El servicio simula las respuestas con la
  misma forma de datos que tendrá la API real. Pendiente: reemplazar el
  cuerpo de `getRequests()` y `createRequest()` en
  `src/app/features/requests/requests.service.ts` por llamadas HttpClient
  reales, y aprovechar esa primera llamada real para cerrar la verificación
  pendiente de EP1-06 (confirmar en DevTools > Network que el request lleva
  el header `Authorization` con el accessToken).
- **Tipos de trámite con lista fija provisional (EP1-08).** El catálogo
  dinámico de tipos de trámite (ms-barriodigital-catalog) todavía no estaba
  disponible. La lista vive hardcodeada en
  `src/app/features/requests/requests.constants.ts`. Pendiente: reemplazar
  por un servicio de catálogo real cuando el microservicio esté listo.
- **Nombre del solicitante ficticio (EP1-08).** La columna Solicitante de la
  vista del Funcionario muestra `solicitanteNombre`; `solicitanteId` (el Object
  ID de Entra ID) se sigue usando solo para filtrar los trámites del Vecino. El
  campo `solicitanteNombre` se completa con datos ficticios en el mock. Cuando
  exista el backend real, debe devolver el nombre o correo real del solicitante
  (por ejemplo vía Microsoft Graph o claims del token), no solo el id.

## Mejoras futuras

- **Header: menú de cuenta como desplegable (post EP1-08).** Hoy la zona de
  cuenta del header muestra el nombre en texto plano y un botón "Cerrar
  sesión" directo, porque es la única acción disponible. Cuando existan más
  acciones asociadas a la cuenta, migrar a un desplegable disparado por un
  círculo con las iniciales del usuario, reemplazando el nombre en texto
  plano (no conviviendo con él).
