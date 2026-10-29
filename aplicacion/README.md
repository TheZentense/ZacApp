<div align="center">

# ZacApp

### Sistema de Reportes de Incidentes Comunitarios

Aplicación multiplataforma orientada al registro, seguimiento y gestión de incidentes comunitarios en Zacapa.

---

**React Native** · **Expo SDK 58** · **TypeScript** · **Supabase** · **PostgreSQL**

</div>

---

## Descripción general

ZacApp centraliza el proceso de reporte y atención de incidentes comunitarios. La plataforma permite registrar incidencias, consultar su progreso y documentar las acciones realizadas por las áreas responsables.

El proyecto utiliza una sola base de código para ofrecer compatibilidad con Android, web y una futura distribución para iOS.

---

## Tecnologías principales

| Tecnología | Propósito |
| --- | --- |
| React Native | Desarrollo de interfaces multiplataforma |
| Expo SDK 57 | Entorno de desarrollo y ejecución |
| Expo Router | Navegación basada en archivos |
| TypeScript | Tipado estático y mantenibilidad |
| Supabase Auth | Autenticación y administración de sesiones |
| Supabase Storage | Almacenamiento de evidencias |
| PostgreSQL | Persistencia principal de datos |

---

## Requisitos del entorno

Instalar o tener instalado:

- Node.js LTS
- npm
- Git
- Expo Go compatible con SDK 58
- Navegador web actualizado
- Android Studio, opcional para emulación local

Versiones principales utilizadas por el proyecto:

```text
Expo SDK: 58
React Native: 0.88.0
React: 19.3.0
TypeScript: 6
```

---

## Preparación del proyecto

Instalación de dependencias:

```bash
npm install
```

El proyecto utiliza `package-lock.json` para mantener versiones consistentes entre los entornos de desarrollo de todos los integrantes.

---

## Configuración del entorno

El archivo `.env.example` contiene la estructura de las variables requeridas:

```env
EXPO_PUBLIC_SUPABASE_URL=URL_DEL_PROYECTO
EXPO_PUBLIC_SUPABASE_ANON_KEY=CLAVE_PUBLICA_DEL_PROYECTO
```

Cada entorno local debe disponer de un archivo `.env` con los valores correspondientes. Los archivos `.env` contienen configuración local y no forman parte del repositorio.

---

## Ejecución

Servidor de desarrollo:

```bash
npm start
```

Ejecución web:

```bash
npm run web
```

Ejecución mediante emulador Android:

```bash
npm run android
```

Conexión móvil mediante túnel:

```bash
npm start -- --tunnel
```

El modo túnel puede utilizarse cuando la red local o el firewall impiden la comunicación directa entre el dispositivo móvil y el servidor de desarrollo.

---

## Comandos disponibles

| Comando | Función |
| --- | --- |
| `npm start` | Inicia el servidor de Expo |
| `npm run web` | Ejecuta la versión web |
| `npm run android` | Ejecuta la aplicación en Android |
| `npm run typecheck` | Verifica los tipos de TypeScript |
| `npm run lint` | Analiza la calidad y consistencia del código |

---

## Organización del código

```text
aplicacion/
├── app/
│   ├── (tabs)/
│   ├── report/
│   ├── _layout.tsx
│   ├── index.tsx
│   └── login.tsx
├── src/
│   ├── components/
│   ├── data/
│   ├── lib/
│   ├── theme/
│   └── types/
├── supabase/
│   └── migrations/
├── .env.example
├── .gitignore
├── app.json
├── package.json
├── package-lock.json
├── README.md
└── tsconfig.json
```

| Directorio | Contenido |
| --- | --- |
| `app/` | Pantallas, rutas y navegación |
| `src/components/` | Componentes reutilizables |
| `src/data/` | Datos locales y provisionales |
| `src/lib/` | Configuración de servicios |
| `src/theme/` | Colores, espaciado y estilos |
| `src/types/` | Tipos y entidades del dominio |
| `supabase/migrations/` | Versionamiento de la base de datos |

---

## Funcionalidades disponibles

La versión actual incorpora:

- Registro ciudadano inmediato, inicio y cierre de sesión.
- Recuperación y cambio de contraseña mediante Supabase Auth.
- Navegación y paneles diferenciados por rol.
- Registro ciudadano de incidentes con categoría, ubicación y fotografía.
- Consulta de reportes limitada por propietario, rol y departamento.
- Búsqueda y filtros por estado, prioridad y departamento.
- Asignación de prioridad, área responsable y personal disponible.
- Flujo controlado de estados con historial atómico y observaciones.
- Evidencias privadas almacenadas mediante Supabase Storage.
- Gestión administrativa de usuarios, accesos, categorías y departamentos.
- Bloqueo de acceso para cuentas inactivas.
- Consulta y edición protegida del perfil personal.
- Diseño adaptable para Android y web.
- Migraciones reproducibles y seguridad mediante Row Level Security.

---

## Base de datos y migraciones

Los archivos de `supabase/migrations/` forman parte de la aplicación y deben aplicarse en orden cronológico sobre la instancia de Supabase correspondiente antes de probar las funciones más recientes.

Las migraciones incluyen:

- Estructura de perfiles, reportes, categorías y departamentos.
- Políticas de acceso por usuario, rol y departamento.
- Storage privado para evidencias.
- Gestión administrativa de usuarios y catálogos.
- Protección de cuentas inactivas.
- Actualización segura del perfil.
- Transiciones atómicas de estado e historial.

Las credenciales administrativas, claves privadas y valores reales del entorno no deben guardarse en el repositorio.

---

## Roles contemplados

```text
Visitante
Ciudadano
Operador
Coordinador
Personal de mantenimiento
Supervisor
Administrador
Comunicación
```

Cada rol dispone de funciones y permisos relacionados con su participación en el proceso de atención de incidentes.

---

## Seguridad del repositorio

No deben registrarse:

```text
.env
.env.local
node_modules/
.expo/
dist/
web-build/
certificados
claves privadas
archivos de firma
compilaciones locales
```

El archivo `.env.example` puede mantenerse en el repositorio porque contiene únicamente los nombres de las variables requeridas, sin credenciales reales.

---

## Estado del proyecto

```text
Nombre: ZacApp
Versión: 0.1.0
Estado: En desarrollo
Plataformas: Android y web
SDK: Expo 57
Base de datos: PostgreSQL mediante Supabase
```

---

<div align="center">

**ZacApp**

Sistema de Reportes de Incidentes Comunitarios

Análisis de Sistemas II · 2026

</div>
