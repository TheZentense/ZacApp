// Enable only after the deployed schema, grants and RLS have been reviewed.
// These are deliberately not public environment switches.
export const backendCapabilities: Readonly<Record<BackendCapability, boolean>> = Object.freeze({
  profileEditing: false,
  userAdministration: false,
  catalogAdministration: false,
  reportAssignment: false,
  atomicTransitions: false,
  staffEvidence: true
});

export type BackendCapability = 'profileEditing' | 'userAdministration' | 'catalogAdministration' | 'reportAssignment' | 'atomicTransitions' | 'staffEvidence';

export const backendPendingMessage = 'Pendiente de habilitación segura. Esta función todavía no permite guardar cambios.';

export function requireBackendCapability(capability: BackendCapability) {
  if (!backendCapabilities[capability]) throw new Error(backendPendingMessage);
}
