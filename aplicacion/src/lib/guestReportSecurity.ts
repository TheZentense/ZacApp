// Enable only after the Edge Function and permit migration are deployed
// together. Keeping this off preserves guest reports in the biometric test APK.
export function guestReportProtectionEnabled(): boolean {
  return typeof process !== 'undefined' && process.env.EXPO_PUBLIC_GUEST_REPORT_TURNSTILE_ENFORCED === 'true';
}
