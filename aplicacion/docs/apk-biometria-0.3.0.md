# APK Android de prueba de ZacApp 0.3.0

Este procedimiento está preparado, pero **no se ha ejecutado**. El perfil
`biometric-test` hereda la distribución interna y el APK de `preview`, utiliza
el canal `biometric-test` y mantiene desactivado el flujo invitado que depende
de la migración Turnstile aún no aplicada. `app.config.js` le asigna el paquete
Android `gt.edu.zacapp.biometrictest`, el esquema `zacapp-biometric-test` y el
nombre **ZacApp Biometría**. Así puede instalarse junto a la app estable
`gt.edu.zacapp`, con almacenamiento local independiente. Es necesario iniciar
sesión de nuevo en la variante de prueba.

## Resultado de precompilación local (26 de octubre de 2026)

| Comprobación | Resultado |
| --- | --- |
| Rama | `codex/permissions-privacy-zacapp`, sin commit ni push |
| TypeScript, ESLint y pruebas | Correctos; 89 de 89 pruebas |
| Exportación JS Android/Hermes de `biometric-test` | Correcta; no genera APK |
| Dependencias nativas | `expo-local-authentication` y `expo-secure-store` 58.0.2 presentes |
| Identidad Android de prueba | `gt.edu.zacapp.biometrictest`, distinta de la estable |
| EAS `preview` remoto y clave pública | Sin verificar: CLI no disponible por DNS |
| `versionCode` Android | Lo administra EAS (`appVersionSource: remote`); valor remoto sin consultar |
| Huella, roles y login contra Supabase real | Pendientes de APK instalada y cuentas de prueba |

**Estado:** falta confirmar las variables remotas de EAS antes de autorizar la
compilación. Las comprobaciones locales no validan una APK instalada.

## Antes de generar el APK

- Confirmar en **Expo → proyecto ZacApp → Environment variables → preview** que
  `EXPO_PUBLIC_SUPABASE_URL` corresponde al host
  `supabasekong-zkh1ndvdzgbhadhdf8xgvtxr.77.237.246.163.sslip.io` y que
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` existe y pertenece a ese mismo Supabase.
  Verificarlo en la sesión propia de Expo; no pegar claves en el chat.
  `app.config.js` interrumpe esta variante si el host no coincide, si falta la
  clave pública o si Turnstile por reporte está activo. Esta comprobación no
  demuestra por sí sola que una clave pública presente sea la correcta.
  La clave pública debe ser legible durante el build (`plain text` o
  `sensitive` en EAS); `secret` no puede resolverse al evaluar la configuración
  localmente. Comprobar también que el valor no corresponde a otro proyecto.
  Nunca colocar `service_role` ni el secreto Turnstile en Expo.
- Si Supabase Auth ya exige CAPTCHA para login o sesiones anónimas, configurar
  allí `EXPO_PUBLIC_TURNSTILE_SITE_KEY` y un
  `EXPO_PUBLIC_TURNSTILE_BASE_URL` cuyo hostname esté permitido por Cloudflare.
  Los archivos `.env` locales no garantizan esas variables en EAS.
- Confirmar que el teléfono Android tiene una huella u otra biometría fuerte
  configurada. El permiso `USE_BIOMETRIC` lo declara automáticamente
  `expo-local-authentication`; `expo-secure-store` ya figura en `app.json`.
- El perfil usa `preview` de EAS, distribución interna, APK y canal de
  actualizaciones `biometric-test`. La variante no sustituye la app estable
  instalada. EAS tendrá que preparar la firma para este identificador Android
  nuevo al realizar la primera compilación autorizada.
- La instalación de módulos nativos requiere un APK nuevo. Una actualización
  JavaScript no añade biometría ni SecureStore a un APK antiguo.

## Comandos de PowerShell

```powershell
cd C:\Users\DIOVARES\Desktop\ZacApp\aplicacion
npm ci
npm run typecheck
npm run lint
node --test tests/*.test.cjs
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile biometric-test
```

El último comando inicia una compilación remota en EAS y crea un enlace de
distribución interna. Ejecutarlo solo después de aprobar la generación del APK.
No usar `eas submit`, `eas update` ni el perfil `production` para esta prueba.
La última revisión no pudo leer el entorno remoto `preview`: EAS CLI no estaba
instalada y `npx` recibió `getaddrinfo ENOTFOUND registry.npmjs.org`. Antes de
autorizar ese último comando, revisar las variables en la sesión de Expo. El
host correcto y la presencia de una clave no comprueban todavía que esa clave
sea válida frente a Supabase; eso se verifica con el login real en la APK.

## Validación en el teléfono

1. Iniciar sesión con correo y contraseña en una cuenta registrada activa.
2. En Perfil → Seguridad de la cuenta, activar biometría fuerte.
3. Enviar la app a segundo plano y volver; comprobar el bloqueo y la huella.
4. Comprobar contraseña alternativa, rol y reportes visibles.
5. Repetir tras diez minutos fuera de la app; debe exigir sesión nueva.
6. Cerrar sesión; la huella por sí sola no debe restaurar el acceso.
7. Probar una cuenta invitada y la versión web por separado.

La variante usa un esquema de enlaces distinto. Para probar recuperación de
contraseña dentro de este APK habría que autorizar ese nuevo redirect en
Supabase Auth; no se cambió la configuración del VPS para esta precompilación.

La función Edge `supabase/functions/verify-guest-report` y la migración
`20261026130000_require_guest_turnstile_per_report.sql` están preparadas
localmente. El cliente valida un desafío nuevo **antes** de subir fotografías;
el permiso queda ligado al UUID del reporte y a la cuenta invitada, vence tras
15 minutos y se consume durante la inserción. El servidor vuelve a verificar
el token con Cloudflare Siteverify, la acción y el hostname permitido.

Para habilitarlo en el VPS se requiere una operación coordinada y aprobada:
configurar `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_HOSTNAMES` y
`ZACAPP_ALLOWED_ORIGINS` solo en la función Edge; configurar la site key pública
en `EXPO_PUBLIC_TURNSTILE_SITE_KEY`; desplegar y probar la función; aplicar la
migración después de un respaldo; y publicar un cliente con
`EXPO_PUBLIC_GUEST_REPORT_TURNSTILE_ENFORCED=true`. No aplicar el trigger de la
migración antes de tener el cliente y la función listos: bloquearía los envíos
invitados antiguos. El APK `biometric-test` mantiene ese valor en `false` y
no ejecuta ninguna de esas operaciones.
