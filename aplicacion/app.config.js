// EAS evaluates this with the selected build profile's env. Keep the normal
// app.json identity for local development and stable builds.
module.exports = ({ config }) => {
  if (process.env.ZACAPP_BUILD_VARIANT !== 'biometric-test') return config;

  const expectedHost = 'supabasekong-zkh1ndvdzgbhadhdf8xgvtxr.77.237.246.163.sslip.io';
  let endpoint;
  try { endpoint = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || ''); }
  catch { throw new Error('biometric-test necesita la URL pública del Supabase del VPS.'); }
  if (endpoint.origin !== `https://${expectedHost}` || endpoint.pathname !== '/'
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('biometric-test apunta a un Supabase distinto del VPS esperado.');
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    throw new Error('biometric-test necesita la clave anon pública de Supabase en preview.');
  }
  if (process.env.EXPO_PUBLIC_GUEST_REPORT_TURNSTILE_ENFORCED !== 'false') {
    throw new Error('biometric-test debe mantener desactivado Turnstile por reporte hasta validar el backend.');
  }

  return {
    ...config,
    name: 'ZacApp Biometría',
    scheme: 'zacapp-biometric-test',
    android: {
      ...config.android,
      package: 'gt.edu.zacapp.biometrictest'
    }
  };
};
