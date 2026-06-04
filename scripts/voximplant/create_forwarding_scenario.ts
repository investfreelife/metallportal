/**
 * c021 Block 4 — Voximplant inbound-forwarding setup.
 *
 * Creates an Application + Scenario + Rule + binds Voximplant rented number
 * к the Application so incoming PSTN calls на 74993253969 forward к Sergey's
 * personal mobile (`SERGEY_MOBILE_E164`).
 *
 * Idempotent — re-running detects existing Application/Scenario/Rule by name
 * and skips creation. Scenario script is updated in-place to allow editing.
 *
 * NOTE: not using `@voximplant/apiclient-nodejs` SDK because it relies on
 * `form-data` v3 which uses deprecated `util.isArray` removed in Node 24+
 * — every API call throws `TypeError: Cannot read properties of undefined`.
 * Instead, sign JWT manually + call REST endpoint with url-encoded body.
 *
 * Required env (from `metallportal/.env.local` или `harlan-ai/.env`):
 *   - VOXIMPLANT_SERVICE_ACCOUNT_BASE64   — base64 of credentials.json
 *                                           ({account_email, account_id, key_id, private_key})
 *   - SERGEY_MOBILE_E164                  — `+79XXXXXXXXX`
 *
 * Run:
 *   cd metallportal
 *   npx tsx scripts/voximplant/create_forwarding_scenario.ts
 *
 * Reference: https://voximplant.com/docs/api/voximplant-api-overview
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import jwt from 'jsonwebtoken'

// ── Constants ────────────────────────────────────────────────────────────
const APP_NAME = 'metallportal-inbound'
const SCENARIO_NAME = 'inbound-forward-to-sergey'
const RULE_NAME = 'forward-499-to-sergey'
const PHONE_NUMBER = '74993253969' // E.164 без `+`, как Voximplant хранит
const VOX_HOST = 'https://api.voximplant.com'

// ── Env loading ──────────────────────────────────────────────────────────
function loadEnv() {
  for (const path of ['.env.local', '../harlan-ai/.env']) {
    try {
      const env = readFileSync(join(process.cwd(), path), 'utf-8')
      for (const line of env.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        const k = t.slice(0, eq).trim()
        const v = t
          .slice(eq + 1)
          .trim()
          .replace(/^["']|["']$/g, '')
        if (!process.env[k]) process.env[k] = v
      }
    } catch {
      /* env file optional */
    }
  }
}

// ── Auth: sign JWT с account's private key ──────────────────────────────
type Creds = {
  account_email: string
  account_id: number
  key_id: string
  private_key: string
}

function loadCreds(): Creds {
  const b64 = process.env.VOXIMPLANT_SERVICE_ACCOUNT_BASE64
  if (!b64) throw new Error('VOXIMPLANT_SERVICE_ACCOUNT_BASE64 not set')
  const decoded = Buffer.from(b64, 'base64').toString('utf-8')
  const c = JSON.parse(decoded) as Creds
  if (!c.private_key || !c.key_id || !c.account_id) {
    throw new Error('credentials.json missing required fields')
  }
  return c
}

function signAuthHeader(creds: Creds): string {
  const now = Math.floor(Date.now() / 1000)
  const token = jwt.sign(
    { iss: creds.account_id, iat: now, exp: now + 60 },
    creds.private_key,
    { algorithm: 'RS256', header: { alg: 'RS256', kid: creds.key_id } },
  )
  return `Bearer ${token}`
}

// ── REST API client (replaces SDK) ───────────────────────────────────────
type VoxResponse = {
  result?: unknown
  error?: { code: number; msg: string }
  count?: number
  totalCount?: number
  [key: string]: unknown
}

async function voxApi(
  creds: Creds,
  cmd: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<VoxResponse> {
  const body = new URLSearchParams()
  body.set('cmd', cmd)
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    body.set(k, String(v))
  }
  const res = await fetch(`${VOX_HOST}/platform_api/${cmd}/`, {
    method: 'POST',
    headers: {
      Authorization: signAuthHeader(creds),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  const json = (await res.json()) as VoxResponse
  if (json.error) {
    throw new Error(`Voximplant ${cmd}: ${json.error.code} ${json.error.msg}`)
  }
  return json
}

// ── Scenario template ────────────────────────────────────────────────────
// Reference: https://voximplant.com/docs/guides/calls/callforwarding
//
// IMPORTANT (lessons hard-earned 2026-05-06):
// 1. NO `require(Modules.PhoneNumber)` — runtime errors with
//    `JS error: empty module argument!` at scenario load time, breaks
//    scenario before AppEvents.CallAlerting fires (Voximplant log:
//    `inbound-forward-to-sergey:1:8`). We don't use any PhoneNumber
//    utility — `VoxEngine.callPSTN` + `easyProcess` live в core
//    VoxEngine, no require needed.
// 2. Do NOT call `e.call.answer()` — `VoxEngine.easyProcess` answers
//    the inbound leg itself when outbound connects. Pre-answering puts
//    the call в ANSWERED state and breaks the forward.
// 3. CallerID для outbound leg должен быть СОБСТВЕННЫМ Voximplant
//    номером, не `e.callerid` (т.е. external caller's CLI). Voximplant
//    blocks CLI spoofing с code 403 Forbidden ("Sent event ... Call.Failed
//    ; code = 403 ; reason = Forbidden"). Solution: pass own rented number
//    как CallerID — мобильный увидит «Звонок с +7 (499) 325-39-69», что
//    логично для forward'а с сайтового номера.
function buildScenarioScript(forwardTo: string, ownCli: string): string {
  return `VoxEngine.addEventListener(AppEvents.CallAlerting, function(e) {
  Logger.write('Incoming call from ' + e.callerid + ' to ' + e.destination);
  var newCall = VoxEngine.callPSTN('${forwardTo}', '${ownCli}');
  VoxEngine.easyProcess(e.call, newCall, function() {
    Logger.write('Call forwarded successfully (origCLI=' + e.callerid + ')');
  });
});`
}

// ── Idempotent ensure-helpers ────────────────────────────────────────────

async function ensureApplication(creds: Creds): Promise<number> {
  // Voximplant stores app names как FQDN: `metallportal-inbound.<acc>.voximplant.com`.
  // Listing with `application_name=<short>` filter returns nothing → match on
  // prefix через full enumeration.
  const list = await voxApi(creds, 'GetApplications', { count: 200 })
  const arr = (list.result as Array<{ application_name?: string; application_id?: number }>) ?? []
  const found = arr.find(
    (a) =>
      a.application_name === APP_NAME ||
      (a.application_name ?? '').startsWith(APP_NAME + '.'),
  )
  if (found && found.application_id) {
    console.log(`✓ Application reuse (id=${found.application_id}, name=${found.application_name})`)
    return found.application_id
  }
  const added = await voxApi(creds, 'AddApplication', {
    application_name: APP_NAME,
  })
  const id = added.application_id as number
  console.log(`✓ Application created (id=${id})`)
  return id
}

async function ensureScenario(creds: Creds, script: string): Promise<number> {
  const list = await voxApi(creds, 'GetScenarios', { with_script: false })
  const arr = (list.result as Array<{ scenario_name?: string; scenario_id?: number }>) ?? []
  const found = arr.find((s) => s.scenario_name === SCENARIO_NAME)
  if (found && found.scenario_id) {
    await voxApi(creds, 'SetScenarioInfo', {
      scenario_id: found.scenario_id,
      scenario_script: script,
    })
    console.log(`✓ Scenario updated (id=${found.scenario_id}, name=${SCENARIO_NAME})`)
    return found.scenario_id
  }
  const added = await voxApi(creds, 'AddScenario', {
    scenario_name: SCENARIO_NAME,
    scenario_script: script,
  })
  const id = added.scenario_id as number
  console.log(`✓ Scenario created (id=${id}, name=${SCENARIO_NAME})`)
  return id
}

async function ensureRule(creds: Creds, applicationId: number): Promise<number> {
  const list = await voxApi(creds, 'GetRules', { application_id: applicationId })
  const arr = (list.result as Array<{ rule_name?: string; rule_id?: number }>) ?? []
  const found = arr.find((r) => r.rule_name === RULE_NAME)
  if (found && found.rule_id) {
    console.log(`✓ Rule reuse (id=${found.rule_id})`)
    return found.rule_id
  }
  const added = await voxApi(creds, 'AddRule', {
    application_id: applicationId,
    rule_name: RULE_NAME,
    rule_pattern: '.*',
  })
  const id = added.rule_id as number
  console.log(`✓ Rule created (id=${id}, pattern=.*)`)
  return id
}

async function bindScenarioToRule(creds: Creds, scenarioId: number, ruleId: number) {
  await voxApi(creds, 'BindScenario', { scenario_id: scenarioId, rule_id: ruleId })
  console.log(`✓ Scenario bound к rule (scenarioId=${scenarioId} → ruleId=${ruleId})`)
}

async function bindPhoneToApp(creds: Creds, applicationId: number) {
  // Use phone_number вместо phone_id — works regardless of internal numeric ID.
  await voxApi(creds, 'BindPhoneNumberToApplication', {
    phone_number: PHONE_NUMBER,
    application_id: applicationId,
  })
  console.log(`✓ Phone +${PHONE_NUMBER} bound к application id=${applicationId}`)
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  loadEnv()

  const forwardTo = process.env.SERGEY_MOBILE_E164
  if (!forwardTo) {
    throw new Error('SERGEY_MOBILE_E164 not set (expected `+79XXXXXXXXX`)')
  }
  if (!/^\+\d{10,15}$/.test(forwardTo)) {
    throw new Error(`SERGEY_MOBILE_E164 must be E.164 (got "${forwardTo}")`)
  }

  const creds = loadCreds()
  // Use Voximplant phone (no `+` prefix in body, как Voximplant хранит) as
  // outbound CallerID — passing external `e.callerid` triggers code 403
  // Forbidden (CLI spoofing).
  const script = buildScenarioScript(forwardTo, PHONE_NUMBER)

  console.log('=== Voximplant inbound forwarding setup ===')
  console.log(`Phone:       +${PHONE_NUMBER}`)
  console.log(`Forward to:  ${forwardTo}`)
  console.log(`Account:     ${creds.account_email} (id=${creds.account_id})`)
  console.log()

  const applicationId = await ensureApplication(creds)
  const scenarioId = await ensureScenario(creds, script)
  const ruleId = await ensureRule(creds, applicationId)
  await bindScenarioToRule(creds, scenarioId, ruleId)
  await bindPhoneToApp(creds, applicationId)

  console.log()
  console.log('=== ✅ FORWARDING LIVE ===')
  console.log(`+${PHONE_NUMBER} → ${forwardTo}`)
  console.log()
  console.log('Test: позвоните на +7 (499) 325-39-69 — звонок упадёт на Sergey mobile')
  console.log('Logs: https://manage.voximplant.com → Звонки')
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  if (e instanceof Error && e.stack) console.error(e.stack)
  process.exit(1)
})
