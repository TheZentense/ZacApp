# ZacApp — base del MVP

Aplicación universal para reportar y dar seguimiento a incidentes comunitarios de Zacapa.

## Tecnología

- React Native + Expo + TypeScript
- Expo Router para navegación Android, iOS y web
- Supabase: Auth, PostgreSQL, Storage y Realtime
- SQLite se incorporará después del MVP para borradores y sincronización offline

## Inicio rápido

1. Instala Node.js LTS.
2. Ejecuta `npm install`.
3. Copia `.env.example` como `.env` y agrega las credenciales públicas de Supabase.
4. Ejecuta `npm start` y abre con Expo Go, Android o navegador.

La aplicación funciona inicialmente con información demostrativa aun sin Supabase.

## Alcance actual v0.1

- Acceso de demostración
- Inicio ciudadano
- Formulario básico de reporte
- Listado y estados de reportes
- Perfil
- Tokens visuales oficiales de ZacApp
- Cliente Supabase preparado
- Migración SQL inicial con RLS

## Próximos incrementos

1. Autenticación real y perfiles/roles.
2. Fotografías comprimidas y Supabase Storage.
3. Ubicación y mapa.
4. Paneles de Operador, Coordinador, Mantenimiento y Supervisor.
5. Historial, órdenes de trabajo y Realtime.
6. Caché/borradores offline con SQLite.
