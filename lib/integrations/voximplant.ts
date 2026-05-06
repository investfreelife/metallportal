/**
 * Voximplant CPaaS integration (read-only показывает status в admin UI).
 *
 * Auth: service-account (env-based). 4 vars уже стоят в Vercel из c014a:
 *  - VOXIMPLANT_ACCOUNT_ID    (10910378)
 *  - VOXIMPLANT_KEY_ID        (UUID)
 *  - VOXIMPLANT_ACCOUNT_EMAIL (7909885@mail.ru)
 *  - VOXIMPLANT_SERVICE_ACCOUNT_BASE64  (private key для JWT signing)
 *
 * Connect-flow в admin UI:
 *  - Если все 4 env vars присутствуют → status='connected', metadata показывает
 *    account ID + phone number.
 *  - Если что-то missing → status='pending' + alert "Set Vercel env vars".
 *
 * Pavel #c021b делает actual call-forwarding scenarios. n004 — только UI status.
 */

export interface VoximplantStatus {
  configured: boolean;
  accountId: string | null;
  email: string | null;
  hasPrivateKey: boolean;
}

/** Static status check — без сетевых вызовов, только env presence. */
export function getVoximplantStatus(): VoximplantStatus {
  const accountId = process.env.VOXIMPLANT_ACCOUNT_ID || null;
  const keyId = process.env.VOXIMPLANT_KEY_ID || null;
  const email = process.env.VOXIMPLANT_ACCOUNT_EMAIL || null;
  const hasPrivateKey = Boolean(process.env.VOXIMPLANT_SERVICE_ACCOUNT_BASE64);

  return {
    configured: Boolean(accountId && keyId && email && hasPrivateKey),
    accountId,
    email,
    hasPrivateKey,
  };
}
