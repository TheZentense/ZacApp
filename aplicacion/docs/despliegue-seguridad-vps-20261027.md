# ZacApp - Despliegue de seguridad del VPS
Fecha: 27 de octubre de 2026

## Cambios aplicados

Se ejecuto correctamente la migracion:
20261026120000_scope_profiles_and_reporter_contact.sql

Resultados confirmados:
- Funcion get_incident_reporter_contact creada.
- Lectura directa de reporter_name y reporter_email restringida.
- Politica de lectura de perfiles limitada por rol y departamento.
- Funciones assign_incident y transition_incident presentes.
- Realtime publicado para incidents e incident_history.
- Politicas RLS de evidencias e historial presentes.
- Creacion de reportes como ciudadano invitado probada en la aplicacion.

## Respaldo

Se crearon y verificaron copias de PostgreSQL en el VPS y en un equipo local.
Los respaldos no se incluyen en Git.

## Pendiente

- Pruebas funcionales de asignacion, estados e historial.
- Verificar permisos con sesiones reales de cada rol.
- Coordinar la integracion de Turnstile para invitados.
- Verificar Storage y realizar pruebas de restauracion.
- Generar APK cuando el backend este validado.
