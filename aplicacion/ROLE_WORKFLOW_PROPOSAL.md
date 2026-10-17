# Propuesta de responsabilidades: primera fase

Pendiente de confirmar con el equipo. No modifica roles ni perfiles reales.

## Alcance de la penúltima entrega universitaria

Se estabilizan navegación por rol, consulta real de reportes, estados, prioridades
numéricas, departamentos, indicadores derivados de reportes y mensajes de carga,
error y ausencia de datos. Se conserva el registro ciudadano y la fotografía ya
probada manualmente. Un error de consulta no se presenta como cero reportes.

Para la demostración: acceso por cuenta existente, registro ciudadano con cámara
o galería, consulta general/departamental, filtros y seguimiento autorizado. Las
opciones pendientes se identifican expresamente y no guardan cambios.

Quedan para la entrega final: GPS automático y trabajo geográfico PostgreSQL/PostGIS
del equipo de infraestructura, cuadrillas, dificultad, asignaciones individuales,
RPC de transición y edición administrativa de usuarios. No se añaden dependencias,
permisos, columnas geográficas ni migraciones en esta fase. Tampoco se despliega.

| Perfil existente | Función propuesta |
| --- | --- |
| administrador | Administración general: revisión, canalización y cierre. |
| mantenimiento | Encargado departamental: consulta del área, responsables y verificación. |
| operador | Empleado operativo: únicamente sus tareas y su seguimiento autorizado. |
| ciudadano | Registro, fotografías propias y seguimiento de sus reportes. |

La apariencia visual no concede permisos. Los demás roles reconocidos no reciben
permisos nuevos; su consulta de reportes queda pendiente de definición.
Confirmar quién ejerce realmente de encargado antes de habilitar facultades nuevas.

## Alcance implementado

- Consulta general del administrador y consulta departamental de mantenimiento.
- El servicio verifica el usuario autenticado y su perfil. Las consultas de ciudadano
  y departamento incluyen sus restricciones en la petición al servidor, además de RLS.
- La bandeja del operador consulta únicamente tareas donde
  `assigned_to = auth.uid()` y conserva ese mismo alcance en historial y evidencias.
- El bloqueo se aplica también al servicio de listado, historial y URLs de evidencia;
  no se descargan reportes generales para filtrarlos visualmente como tareas propias.
- `assigned_department_id` identifica el área; `assigned_to`, el perfil responsable.
  Si existe responsable se muestra su ID real; no se inventan nombres ni empleados.
- La evidencia del personal está habilitada para reportes visibles; las demás
  capacidades opcionales conservan su protección independiente.
- Se retira la escritura antigua de estados e historial. No se usa como alternativa
  a una operación transaccional pendiente. Las acciones de gestión permanecen inactivas.
- Se conservan prioridad numérica 1–4 y las correcciones de cámara, galería y JPEG.

## Requisitos para la siguiente fase

El equipo debe revisar el esquema desplegado y todas sus políticas y privilegios:

1. Relación verificada del perfil con su departamento y protección contra su edición
   no autorizada. Confirmar el mecanismo real de cuentas activas antes de utilizarlo.
2. Lectura del operador limitada en el servidor a sus tareas. Historial y evidencias
   deben heredar esa misma autorización; no basta un filtro en la aplicación.
3. Consulta mínima de empleados asignables del departamento, sin exponer otros perfiles.
4. Operación transaccional de asignación/reasignación que valide actor, departamento,
   empleado, estado actual y concurrencia; conserve responsables y fechas anteriores.
5. Verificación explícita del encargado y cierre exclusivo de administración mediante
   operaciones del servidor, con observaciones y auditoría en la misma transacción.
6. Políticas de Storage que autoricen la evidencia de atención por incidente y actor,
   conservando el bucket privado y sin otorgar lectura general a todo el personal.
7. Pruebas negativas entre empleados, departamentos y roles antes de habilitar funciones.

Reutilizar las tablas confirmadas. La tabla `assignments` de la propuesta del compañero
no se presupone desplegada. No importar sus migraciones completas: contienen contratos
distintos de prioridad y evidencias. Cuadrillas y dificultad quedan para otra fase;
no se consultan ni simulan columnas o equipos inexistentes.

Este cambio limita el comportamiento del cliente y no corrige por sí mismo permisos
amplios que pudieran existir en producción. No se han ejecutado migraciones ni
operaciones de producción para validarlo.
