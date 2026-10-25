import { useEffect, useId, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  siteKey: string;
  action: string;
  resetKey: number;
  onToken: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
};

type TurnstileApi = { render: (target: string, options: Record<string, unknown>) => string; remove: (widgetId: string) => void };

declare global { interface Window { turnstile?: TurnstileApi; } }

const SCRIPT_ID = 'zacapp-turnstile-script';

export function TurnstileChallenge({ siteKey, action, resetKey, onToken, onExpire, onError }: Props) {
  const reactId = useId().replace(/:/g, '');
  const containerId = `zacapp-turnstile-${reactId}`;
  const widgetId = useRef<string | undefined>(undefined);
  const callbacks = useRef({ onToken, onExpire, onError });

  useEffect(() => {
    callbacks.current = { onToken, onExpire, onError };
  }, [onError, onExpire, onToken]);

  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !document.getElementById(containerId)) return;
      if (widgetId.current) window.turnstile.remove(widgetId.current);
      widgetId.current = window.turnstile.render(`#${containerId}`, {
        sitekey: siteKey,
        action,
        theme: 'light',
        size: 'flexible',
        language: 'es',
        callback: (token: string) => callbacks.current.onToken(token),
        'expired-callback': () => callbacks.current.onExpire(),
        'error-callback': () => callbacks.current.onError()
      });
    };
    if (window.turnstile) render();
    else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', render, { once: true });
    }
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [action, containerId, resetKey, siteKey]);

  return <View style={styles.card}>
    <View style={styles.heading}><Ionicons name="shield-checkmark-outline" size={20} color={colors.secondary} /><View style={styles.headingCopy}><Text style={styles.title}>Verificación de seguridad</Text><Text style={styles.copy}>Confirma que eres una persona para continuar.</Text></View></View>
    <View nativeID={containerId} style={styles.widget} />
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.sm, gap: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  headingCopy: { flex: 1 },
  title: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 11, marginTop: 2 },
  widget: { minHeight: 65, width: '100%', alignItems: 'center', justifyContent: 'center' }
});
