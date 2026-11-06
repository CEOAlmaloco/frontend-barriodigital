# Política de seguridad

BarrioDigital es la plataforma de trámites municipales del equipo. Este repositorio centraliza
las issues de todos los servicios, por lo que esta política aplica a la plataforma completa.

## Versiones soportadas

| Rama                                 | Soporte                                       |
| ------------------------------------ | --------------------------------------------- |
| `main` (entrega vigente)             | Sí                                            |
| `develop` (integración)              | Sí, las correcciones se integran aquí primero |
| Ramas de tarea y entregas anteriores | No                                            |

## Alcance

Incluye el frontend y los servicios de la plataforma:

- `frontend-barriodigital`
- `ms-barriodigital-bff`
- `ms-barriodigital-requests`
- `ms-barriodigital-catalog`
- `ms-barriodigital-notify`
- `ms-barriodigital-mq-admin`
- `ms-barriodigital-kafka-admin`
- `ms-barriodigital-audit`
- `ms-barriodigital-report`
- `barriodigital-infra`

Quedan fuera las fallas propias de los proveedores (Microsoft Entra ID, AWS, Oracle Cloud).
Si afectan a la plataforma, igual puedes avisarnos.

## Cómo reportar una vulnerabilidad

1. **No abras una issue pública** ni publiques el detalle antes de que esté corregido.
2. Repórtala de forma privada desde la pestaña **Security** de este repositorio, con
   **Report a vulnerability** (_private vulnerability reporting_ de GitHub).
3. Incluye el servicio y la ruta afectados, los pasos para reproducirla, el impacto esperado
   (por ejemplo, acceso a trámites de otro vecino o escalamiento de rol) y, si puedes, una
   propuesta de corrección.
4. **No incluyas datos personales reales** de vecinos ni de funcionarios en el reporte. Usa
   datos de prueba.

## Qué esperar

- Acuse de recibo dentro de 5 días hábiles.
- Una evaluación inicial, con la severidad y si se acepta o no, dentro de 10 días hábiles.
- Si se acepta, la corrección se integra en `develop` y luego en `main`, y se publica un aviso
  de seguridad en el repositorio. Si quieres, te damos crédito en ese aviso.
- Si no se acepta, te explicamos por qué.

## Buenas prácticas al investigar

- Prueba solo con cuentas propias o de prueba y no accedas a datos de terceros.
- No hagas pruebas de denegación de servicio ni envíos masivos de solicitudes.
- Si accedes a datos personales sin querer, detente, no los guardes y avísanos en el reporte.
