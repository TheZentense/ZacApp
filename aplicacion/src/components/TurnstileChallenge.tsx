import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  siteKey: string;
  action: string;
  resetKey: number;
  onToken: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
};

export function TurnstileChallenge({ siteKey, action, resetKey, onToken, onExpire, onError }: Props) {
  const baseUrl = process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL?.trim() || 'https://zacapp.77.237.246.163.sslip.io';
  const html = useMemo(() => `<!doctype html>
<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
<style>html,body{margin:0;background:#fff;font-family:system-ui}#captcha{display:flex;justify-content:center;padding:8px 0}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script></head>
<body><div id="captcha"></div><script>
window.onload=function(){turnstile.render('#captcha',{sitekey:${JSON.stringify(siteKey)},action:${JSON.stringify(action)},theme:'light',size:'flexible',language:'es',callback:function(token){window.ReactNativeWebView.postMessage(JSON.stringify({type:'token',token:token}))},'expired-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'expired'}))},'error-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error'}))}})};
</script></body></html>`, [action, resetKey, siteKey]);

  return <View style={styles.card}>
    <View style={styles.heading}><Ionicons name="shield-checkmark-outline" size={20} color={colors.secondary} /><View style={styles.headingCopy}><Text style={styles.title}>Verificación de seguridad</Text><Text style={styles.copy}>Confirma que eres una persona para continuar.</Text></View></View>
    <WebView
      key={resetKey}
      source={{ html, baseUrl }}
      originWhitelist={['https://*']}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      style={styles.webView}
      onMessage={({ nativeEvent }) => {
        try {
          const message = JSON.parse(nativeEvent.data) as { type?: string; token?: string };
          if (message.type === 'token' && message.token) onToken(message.token);
          else if (message.type === 'expired') onExpire();
          else if (message.type === 'error') onError();
        } catch { onError(); }
      }}
      onError={onError}
    />
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.sm, gap: spacing.xs },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  headingCopy: { flex: 1 },
  title: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 11, marginTop: 2 },
  webView: { height: 82, backgroundColor: colors.white }
});
