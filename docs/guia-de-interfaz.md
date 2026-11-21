# Guía de interfaz

Reglas de diseño y de frontend de BarrioDigital. Sirve para construir vistas nuevas y para revisar PR. Los valores concretos (colores, tamaños, espaciado) viven en el código y aquí solo se enlazan:

- [`src/styles/_tokens.scss`](../src/styles/_tokens.scss): paleta base, tipografía, espaciado, radio, sombra, tamaño táctil y breakpoints.
- [`src/styles/_accessibility.scss`](../src/styles/_accessibility.scss): variables `--bd-*` y cómo cambian en cada opción del control de accesibilidad.
- [`src/styles/_material-theme.scss`](../src/styles/_material-theme.scss): tema de Angular Material.

Los ejemplos de cada sección muestran usos habituales y no son listas cerradas. Si un caso nuevo no calza, se decide por la intención de la regla. Si la guía queda corta, se corrige en el mismo PR que necesita el cambio.

## 1. Principios

1. **Institucional y sobria.** Es una plataforma municipal: claridad y confianza antes que decoración. Cada color, ícono, sombra o animación tiene que comunicar algo.
2. **Solo lo que el sistema sabe.** Un dato ausente no es 0: se muestra «No disponible» o «—». No se inventan valores, estados ni causas, y un texto no promete algo que la vista no hace.
3. **Accesible y móvil desde el inicio.** WCAG 2.2 AA y todas las opciones del control de accesibilidad se consideran al diseñar, no al final.
4. **Reutilizar antes de crear.** Primero un componente o patrón existente; después, extender uno si la responsabilidad calza; recién entonces, uno nuevo.
5. **Consistencia.** Un mismo problema se resuelve igual en toda la aplicación. Antes de diseñar, se mira cómo lo resuelve el módulo de trámites, que es la referencia visual.

## 2. Tokens

- Los componentes importan `@use 'tokens' as *;` para espaciado, tipografía, radios, sombra y breakpoints.
- Los colores se toman siempre de las variables `--bd-*`. Los `$color-*` de Sass no cambian con los modos de contraste, así que no se usan en componentes.
- No se escriben colores, tamaños de fuente ni espaciados a mano. Un valor que falta se agrega como token.
- Los tamaños de letra se multiplican por la escala del control: `calc(#{$font-body} * var(--bd-text-scale, 1))`.

## 3. Color

El color comunica jerarquía o significado. Si no comunica nada, el elemento queda neutro.

| Rol        | Variables                                                     | Intención                                                                        | Ejemplos                                                                             |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Primario   | `--bd-primary`, `--bd-primary-dark`, `--bd-primary-container` | Identidad de la marca, acción principal y el elemento más importante de un grupo | Botón principal, pestaña activa, total principal de un resumen, enlaces              |
| Secundario | `--bd-secondary`, `--bd-secondary-container`                  | Información de apoyo que debe distinguirse del primario sin competir con él      | Métricas de apoyo de un resumen, estado «En terreno», ubicación, indicador «en vivo» |
| Acento     | `--bd-accent`, `--bd-accent-text`, `--bd-accent-container`    | Aviso informativo: algo que conviene revisar, sin ser un error                   | Datos desactualizados, cupo agotado, plazo por vencer, retraso de consumo            |
| Éxito      | `--bd-success`, `--bd-success-container`                      | Resultado o estado correcto                                                      | Tipo activo, réplicas sincronizadas, operación completada                            |
| Error      | `--bd-error`, `--bd-error-container`                          | Falla, bloqueo o acción destructiva                                              | Servicio caído, mensajes en DLQ, «Eliminar»                                          |
| Neutro     | `--bd-text-muted`, `--bd-background`, `--bd-border`           | Sin valor o sin novedad; texto de apoyo                                          | Indicador en 0, «Sin plazo», etiquetas de campo                                      |

Reglas:

- **Cualquier rol puede usarse fuera de sus ejemplos** si su intención aplica. Lo que no cambia es el significado: un rojo siempre indica falla o peligro.
- **El color nunca es la única señal.** Va acompañado de texto, ícono o forma, para que funcione en escala de grises y con daltonismo.
- **Tono según el valor.** Si un elemento existe para llamar la atención (un indicador, una insignia de estado), lleva su tono solo cuando hay algo que mostrar; en 0 o sin dato queda neutro.
- **Pocos acentos por vista.** Si todo tiene color, nada destaca.
- **Fondos tintados con las variables `-container`**, nunca con opacidades calculadas a mano.
- El gris neutro indica ausencia o reposo. No se usa en controles activos, porque se lee como deshabilitado.

## 4. Superficies y elevación

| Nivel                   | Cuándo                                                                                                                  | Estilo                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Página                  | Fondo general                                                                                                           | `--bd-background`                                                                       |
| Tarjeta de primer nivel | Elemento que va directo sobre el fondo de la página: tablas, tarjetas de listado, indicadores, estados de error o vacío | `--bd-surface`, borde `--bd-container-border`, radio `$radius-base`, `$shadow-elevated` |
| Superficie anidada      | Dentro de otra tarjeta: ítems, métricas de un detalle, formularios internos, tablas de un diálogo                       | Plana, borde `--bd-border`, radio `$radius-base`                                        |
| Flotante                | Diálogos, menús, toggletips                                                                                             | Sombra propia de Material, más marcada                                                  |

`--bd-container-border` es transparente en el modo claro y visible en alto contraste y negativo. Por eso las tarjetas lo llevan aunque no se vea siempre.

## 5. Tipografía y cifras

- **Jerarquía:** un `h1` por página, `h2` por sección y `h3` por bloque dentro de una sección. No se salta un nivel por el tamaño: el tamaño se ajusta con estilos.
- **Títulos, etiquetas y botones** van sin punto final y con mayúscula inicial. Los párrafos y mensajes, con punto.
- **Monoespaciada** solo para identificadores técnicos que se copian o se comparan carácter a carácter: exchanges, routing keys, claves de configuración, JSON, nombres de excepción. Los nombres que funcionan como título de una fila (una cola, un tópico) van en la fuente normal.
- **`font-variant-numeric: tabular-nums`** para cifras que se comparan en vertical o que cambian en el lugar: valores grandes de indicadores, horas que se actualizan, columnas numéricas alineadas a la derecha. No se usa en celdas que mezclan cifras y texto alineadas a la izquierda, porque las cifras tabulares de Inter (como el «1» con base) se ven como otra fuente.
- **Fechas y horas** en hora de Chile, con `RequestDatePipe` o `formatClock`, nunca en ISO crudo.

## 6. Layout y responsive

- **Móvil primero.** Breakpoints de `_tokens.scss`: `sm` 480, `md` 768, `lg` 1024 y `xl` 1280 px.
- **Ancho máximo:** 1200 px en vistas de contenido y 1440 px en vistas con tablas anchas, centradas, con relleno `$space-6` que sube a `$space-12` desde `lg`.
- **La página nunca tiene scroll horizontal.** Una tabla ancha se desplaza dentro de su propio contenedor.
- **Listados:** tabla desde `md` (o desde `xl` si las columnas no caben) y tarjetas apiladas en móvil, con los mismos datos y acciones.
- **Barras de herramientas** (búsqueda, filtros, contador) con `flex-wrap`. Los grupos de botones de alternancia ocupan el ancho completo bajo `sm`.
- **Áreas táctiles** de al menos `$size-touch-target` (44 px) en controles principales y nunca menores a 24 px (WCAG 2.5.8).

## 7. Patrones de pantalla

### Encabezados

- **Página:** `h1` y una línea que dice para qué sirve, sin repetir el título.
- **Sección:** `h2`, descripción breve y, a la derecha, las acciones de la sección. «Actualizar» es un botón de ícono con tooltip y nombre accesible, y la acción principal un botón relleno. Si los datos se consultan a demanda, se muestra «Actualizado a las HH:MM».

### Resúmenes e indicadores

Referencias: indicadores del mapa (`report-map-summary`), de Reportes (`report-kpi-tiles`) y de Administración (`AdminKpiComponent`).

- **Cada indicador es una tarjeta de primer nivel.** El grupo es un `dl` y cada indicador, un `div` con `dt` (etiqueta) y `dd` (valor).
- **Orden:** ícono a la izquierda; etiqueta, valor y, si existe, una línea de contexto apilados a su derecha. Esa línea va solo si aporta un dato real (período, porcentaje), nunca como relleno.
- **Ícono** cuando hay tres o más indicadores distintos lado a lado: ayuda a ubicarlos. Va oculto a lectores de pantalla y la etiqueta siempre está.
- **Tono:** primario para el total principal, secundario para las métricas de apoyo, y éxito, acento o error según lo que signifique el valor. Se aplica solo con valor mayor que 0; en 0 o sin dato el indicador queda neutro.
- **Enlace** solo si lleva a una vista que muestra exactamente ese subconjunto. Si el filtro está en la misma vista, el enlace sobra.

### Búsqueda y filtros

- **Búsqueda** con `mat-form-field`, ícono de búsqueda, `mat-label` y botón para borrar con nombre accesible.
- **Filtros excluyentes** con `mat-button-toggle-group`. Si hay más opciones, `mat-select` dentro de un panel de filtros (ver `request-list-filters`).
- **Contador de resultados** con `role="status"` y singular o plural correcto.
- **Estado en la URL** cuando se quiere compartir o recargar sin perderlo: filtros, pestaña o vista (`?section=`, `?range=`, `?view=`). Un valor inválido se descarta.

### Listados y acciones

- **`mat-table`** dentro de una tarjeta de primer nivel, con cambio de fondo al pasar el cursor.
- **Identificación de la fila:** el nombre arriba y el código o identificador atenuado debajo, en la misma celda.
- **Acción principal** visible como botón contorneado. Las acciones destructivas o poco frecuentes van en un `mat-menu` con botón de ícono («Más acciones para …») y piden confirmación.
- **Si el backend prohíbe una acción** (por ejemplo, la topología del sistema), la interfaz no la ofrece y lo explica en el detalle.

### Insignias

- **Siempre con texto.** El color refuerza, no reemplaza.
- **Tono por significado:** éxito para activo o correcto, error para falla, acento para aviso, primario para identidad («Sistema», «Inactivo»), neutro para datos informativos.
- **Separadas del texto que acompañan** (`margin-inline-start`).

### Estados

Cada vista y cada fuente de datos cubren todos sus estados, y cada fuente falla por separado.

| Estado             | Cómo se muestra                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Cargando sin datos | Spinner centrado o silueta (`report-skeleton`), con `aria-busy` en la región                                                               |
| Cargando con datos | Datos visibles y spinner pequeño en línea; el botón Actualizar gira                                                                        |
| Vacío              | Tarjeta centrada con ícono neutro y título: «Todavía no hay …»                                                                             |
| Vacío por filtro   | Igual, con «Limpiar búsqueda y filtro»                                                                                                     |
| Error sin datos    | Tarjeta centrada con ícono de error, título según la causa, texto con qué hacer y «Reintentar»                                             |
| Error con datos    | Se conservan los datos y aparece un aviso de acento: «No pudimos actualizar … Se muestran los últimos datos disponibles», con «Reintentar» |
| Sin permiso        | Igual que el error, sin «Reintentar»                                                                                                       |

- **La causa se lee con `failureKind`** (`shared/utils/http-failure.ts`): 503 es «no está disponible», 403 es «no tienes acceso» y lo demás es «no pudimos cargar».
- **Las tarjetas centradas reutilizan** el mixin `feedback-state` (`styles/_feedback-state.scss`), que ya usan Reportes y `AdminStateComponent`. Dentro de un bloque de Inicio se usa `HomeStateComponent`, su variante compacta.
- **El error se anuncia** con `role="alert"`. La carga y los cambios de resultado, con `aria-live="polite"` o `role="status"`.

### Detalles y diálogos

- **El detalle de un elemento de un listado se abre en un diálogo** (`MatDialog`), no al final de la página, porque ahí el usuario no lo ve. Lleva el nombre del elemento como título, el contenido en secciones con `h3` y el botón «Cerrar». Se puede pasar una `ng-template` del mismo componente.
- **Confirmación** antes de toda acción destructiva o difícil de deshacer: dice qué pasará y sobre qué, con el botón de confirmar en error si destruye.
- **Foco:** al abrir, va al título. Al cerrar, vuelve al control que lo abrió o, si ya no existe, al título de la sección.

### Gráficos

- **Solo si muestran algo que una tabla no muestra igual de bien:** tendencias en el tiempo, proporciones o comparaciones entre muchas categorías. Un gráfico que repite la tabla de al lado sobra.
- **Con alternativa textual** (tabla o lista) y sin depender solo del color: patrones o formas además del tono, como el tramo rayado de Reportes.
- **Series de tiempo con datos históricos del backend,** no reconstruidas consultando desde el navegador.
- **Reutilizar** `report-trend-chart` y `report-ranking` antes de crear uno nuevo.

### Datos que cambian

- **Actualización automática solo donde el contrato la permite.** Se hace con `polledResource`, que se detiene con la pestaña oculta o al salir, espera más entre intentos ante errores y ofrece pausar (WCAG 2.2.2).
- **En el resto,** `loadedResource` o una consulta al entrar, con botón «Actualizar» y la hora de la consulta.

## 8. Textos

- **Español claro y directo.** Sin relleno, sin frases de cortesía y sin repetir lo que ya dice un título o un botón.
- **Un mensaje de error dice qué pasó y qué hacer,** sin culpar a la persona ni exponer detalles técnicos internos.
- **Términos técnicos** en español cuando existe uno claro («grupos de consumo», «mensajes en espera»). Siglas establecidas (DLQ, DLT, TTL) se mantienen.
- **Singular y plural correctos** («1 cola», «2 colas»).
- **Etiquetas de botones** con verbo en infinitivo («Reintentar», «Vaciar cola»). Si el contexto no basta, el nombre accesible lo completa: «Editar Bache en calle (bache)».

## 9. Accesibilidad

### WCAG 2.2 AA en la práctica

- **HTML semántico** (`main`, `section` con `aria-labelledby`, `nav`, `dl`, `table`) y ARIA solo cuando el HTML no alcanza.
- **Todo se puede usar con teclado,** en un orden lógico y con foco visible. El foco se lleva a un lugar con sentido después de abrir, cerrar o recargar.
- **Botones de solo ícono** con `aria-label` y tooltip. Los íconos decorativos, con `aria-hidden="true"`.
- **Contraste mínimo** 4,5:1 en texto y 3:1 en componentes e íconos con significado, en todos los modos.
- **Campos con `mat-label`** visible; el placeholder no reemplaza la etiqueta.

### Control de accesibilidad

Toda vista nueva se revisa con cada opción:

| Opción                                   | Qué hace                         | Qué exige                                                                             |
| ---------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Tamaño de texto (−1 a +4)                | Cambia `--bd-text-scale`         | Tamaños con `calc(... * var(--bd-text-scale, 1))`, sin alturas fijas que corten texto |
| Contraste: claro, oscuro, alto, negativo | Redefine las variables `--bd-*`  | Solo variables `--bd-*` y bordes con `--bd-container-border`                          |
| Escala de grises                         | Quita el color                   | El estado se entiende sin color                                                       |
| Fuente legible                           | Cambia a Atkinson Hyperlegible   | Sin anchos fijos que dependan de la fuente                                            |
| Subrayar enlaces                         | Subraya los enlaces              | Enlaces como `a`, no botones disfrazados                                              |
| Pausar animaciones                       | Anula animaciones y transiciones | Ninguna información depende de una animación                                          |

**Especificidad.** La escala global (`html[data-bd-scale] .app-shell :is(p, li, dt, dd, h2, …)`) pesa (0,2,2). Para fijar otro tamaño en uno de esos elementos, el selector necesita (0,3,0) o más. Con encapsulación, alcanza con `:host .clase`; sin encapsulación, con tres clases.

### Movimiento

Animaciones y transiciones solo como respuesta a una acción u orientación (un ícono que gira mientras se actualiza, un cambio de fondo al pasar el cursor), dentro de `@media (prefers-reduced-motion: no-preference)`. Nunca decorativas.

## 10. Código frontend

### Estructura y reutilización

| Lugar                 | Qué va                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `core/`               | Servicios únicos que hablan con el BFF y estado global: autenticación, accesibilidad, un servicio por backend             |
| `shared/`             | Lo que usan dos o más dominios: componentes, directivas, utilidades y modelos                                             |
| `features/<dominio>/` | Vistas y componentes de un dominio. Un componente que nace en un dominio y luego se necesita en otro se mueve a `shared/` |
| `styles/`             | Tokens, tema, accesibilidad y mixins compartidos por varios dominios                                                      |

- **Angular Material primero** (tabla, formularios, diálogos, menús, alternancias, pestañas). No se reimplementa un control que Material ya tiene.
- **Un componente, una responsabilidad.** Cuando un marcado se repite con la misma lógica, se extrae; por ejemplo, `AdminKpiComponent` reemplaza 14 indicadores escritos a mano.
- **Mixins de Sass** para patrones visuales compartidos (`feedback-state`, `report-card`, `links.forward-arrow`).

### Componentes

- **Standalone, `ChangeDetectionStrategy.OnPush`, signals** (`signal`, `computed`, `input`, `output`) y control de flujo nativo (`@if`, `@for`, `@switch`).
- **Lógica de presentación en `computed`,** no en métodos que la plantilla llama muchas veces.
- **Suscripciones** con `takeUntilDestroyed`.
- **Estilos encapsulados por defecto.** `ViewEncapsulation.None` solo para clases compartidas con un prefijo propio que no choque con otras vistas, como `admin-*` en Administración.
- **Presupuestos de `angular.json`:** 4 kB de advertencia y 10 kB de error por hoja de estilos de componente. Cerca del límite, se extrae un componente o un mixin.

### Datos

- **Los modelos siguen el contrato** de `barriodigital-infra/docs/contratos`. Un campo que el backend puede omitir se tipa como opcional y se trata como desconocido, no como 0.
- **Cada fuente se consulta y falla por separado:** `forkJoin` sin `catchError` por fuente hace caer toda la vista por una sola falla.

### Convenciones

- **Nombres en inglés:** componentes, clases, archivos, campos, rutas de API y parámetros de URL con sus valores (`?section=catalog`, `?show=dlq`, `?view=list`).
- **En español:** rutas de la interfaz (`/tramites`, `/administracion`), valores de enums de dominio en mayúsculas (`EN_TERRENO`, también como valor de un parámetro: `?status=EN_TERRENO`) y textos visibles.
- **Comentarios** breves y solo para lo que el código no explica: una restricción, una decisión o un caso borde.
- **Prettier** en archivos nuevos. En archivos existentes se respeta su formato, sin reformatear carpetas completas.

### Pruebas

- **Se prueba el comportamiento visible:** texto, estado, llamadas al servicio y foco, no detalles internos.
- **Se cubren los estados de la tabla de la sección 7** y los casos borde: nulo, vacío, 0, singular y plural, 403 y 503.
- **Una prueba falla si la condición no se cumple:** sin pasos «si existe» (`?.click()`), sin recorrer listas que pueden venir vacías y sin aserciones que comparan una constante consigo misma.

## 11. Antes de abrir el PR

- [ ] Reutiliza componentes y mixins existentes; lo nuevo está en el lugar correcto de la estructura.
- [ ] Solo tokens y variables `--bd-*`; ningún color ni tamaño a mano.
- [ ] Superficies, color e insignias siguen las secciones 3 y 4.
- [ ] Cubre carga, vacío, vacío por filtro, error sin datos, error con datos, sin permiso y contenido largo.
- [ ] Funciona en 360 px, 768 px y escritorio, sin scroll horizontal de página.
- [ ] Probado con teclado y con cada opción del control de accesibilidad.
- [ ] Los textos no afirman lo que el sistema no sabe ni repiten lo evidente.
- [ ] Pruebas, `npm run build` sin errores de presupuesto y Prettier en los archivos nuevos.
