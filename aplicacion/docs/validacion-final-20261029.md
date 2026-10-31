# Validación final de ZacApp

Fecha de revisión: 29 de octubre de 2026.

## Código y compilación

- Rama revisada desde `origin/main`, después de la fusión del Pull Request 28.
- Revisión de TypeScript completada sin errores.
- ESLint completado sin errores.
- Exportación web completada con 21 rutas estáticas.
- 114 pruebas automatizadas aprobadas, sin fallos ni pruebas omitidas.
- No se detectaron credenciales, claves privadas ni archivos locales registrados en Git.

## Supabase y roles

- Supabase Auth respondió correctamente por HTTPS.
- El catálogo público de categorías respondió correctamente.
- Se validaron 14 cuentas privadas de QA sin registrar sus credenciales en este documento.
- Los perfiles comprobados incluyen ciudadano, administrador, mantenimiento y operadores.
- Cada cuenta devolvió el rol, estado activo y departamento esperado.
- Las pruebas automatizadas cubren RLS, aislamiento departamental, evidencias privadas, asignaciones, estados y operaciones atómicas.

## Aplicación pública

- `https://zacapp.freeddns.org/` respondió correctamente.
- Las rutas `/login` y `/report/new` respondieron correctamente.
- La interfaz móvil del operador mostró tareas, métricas, navegación y sesión protegida.
- GitHub Pages respondió correctamente para la presentación pública.
- El enlace permanente del APK respondió correctamente y entregó un paquete Android.
- La presentación incluye el código QR de descarga.

## VPS y respaldos

- El VPS se encontró activo y con espacio disponible suficiente.
- Los contenedores web, Expo, Coolify y Supabase se encontraron activos.
- El contenedor web informó estado saludable.
- El respaldo más reciente incluyó PostgreSQL, objetos de Storage, metadatos y manifiesto SHA-256.
- Todos los archivos del respaldo superaron la verificación de integridad.
- La tarea automática se ejecuta cada hora y el propio script limita la copia diaria a las 21:00 de Guatemala.
- El respaldo valida el contenido de PostgreSQL con `pg_restore` y el archivo de Storage antes de declararse completo.

## Validación pendiente en dispositivo físico

La automatización no sustituye la prueba manual del APK en un teléfono Android. Antes de declarar cerrado el MVP debe comprobarse en un dispositivo real:

1. Instalación limpia y actualización sobre una versión anterior.
2. Inicio de sesión, cierre de sesión y desbloqueo biométrico.
3. Cámara, selección de una a cinco fotografías y permisos.
4. GPS y visualización del punto del incidente.
5. Creación conectada de un reporte ciudadano.
6. Creación sin conexión, persistencia local y sincronización posterior.
7. Recepción del reporte por administración y departamento correcto.
8. Asignación a empleado, cambio de estados y evidencia final opcional.
9. Consulta del estado final desde la cuenta ciudadana.
10. Descarga mediante el enlace permanente y el código QR.

## Elementos excluidos del cierre actual

- SMTP, confirmación y recuperación por correo se mantienen fuera del alcance inmediato.
- La restauración completa debe ensayarse en un entorno aislado; no debe probarse sobre la instancia pública en operación.
- La publicación para iOS no forma parte del alcance solicitado.
