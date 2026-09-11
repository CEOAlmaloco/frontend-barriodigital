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

2. Revisa la configuración de Microsoft Entra ID en `src/environments/`:

   - `environment.development.ts` lo usa `npm start`.
   - `environment.ts` lo usa el build de producción.

   Ambos archivos ya traen los valores de la app registrada. La fuente de verdad es `barriodigital-infra/docs/decisiones.md`: si esos valores cambian, cópialos desde ahí a los dos archivos.

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

Hoy hay 12 tests en 4 archivos: `AppComponent`, `AuthService`, la configuración de MSAL y `LoginComponent`.

## Estructura

```
src/
├── app/
│   ├── core/          Servicios únicos de la app. Hoy: auth/ con la configuración de MSAL, AuthService y el guard del login
│   ├── shared/        Componentes, pipes y modelos compartidos entre features. Aún no existe, se crea con el primer elemento compartido
│   └── features/      Una carpeta por dominio: login/ (pantalla de inicio de sesión) y dashboard/ (placeholder de /inicio)
├── styles/            _tokens.scss (paleta, tipografía, espaciado), _material-theme.scss y styles.scss global
└── environments/      Configuración por entorno, incluida la de Microsoft Entra ID
```

Los componentes importan los tokens con `@use 'tokens' as *;`, sin colores ni tamaños escritos a mano.

## Estado actual

Implementado:

- Login con MSAL (redirect) contra Microsoft Entra ID, con estados de carga, error y redirección a `/inicio` si ya hay sesión.
- Sesión compartida entre pestañas y ventanas; dura hasta cerrar el navegador o cerrar sesión.
- `/inicio` como placeholder: muestra la cuenta activa y permite cerrar sesión.

Lo próximo es proteger las rutas y adjuntar el token a las llamadas al backend (`MsalGuard` y `MsalInterceptor`). El resto de la aplicación se construye issue por issue según el tablero del proyecto.
