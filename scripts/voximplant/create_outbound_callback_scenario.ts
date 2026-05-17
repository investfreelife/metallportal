/**
 * c024 — Outbound callback scenario для CRM click-to-call.
 *
 * Pattern: server-initiated «callback» — manager нажимает Call в CRM,
 * server triggers a Voximplant scenario via StartScenarios API, scenario:
 *   1. Calls manager's phone (e.g. Sergey's +79013617775)
 *   2. Когда manager picks up → calls client phone
 *   3. Bridges both legs + records
 *   4. POSTs к webhook on Disconnected с recording_url
 *
 * Why callback (not WebSDK click-to-call):
 *   - No WebRTC / WebSDK / SIP user infrastructure required (deferred к v2)
 *   - Manager uses любой phone (mobile / desk) — нет browser/mic/headset deps
 *   - Same recording + webhook pipeline как inbound forwarding
 *   - Server controls initiation → CRM auth gate works
 *
 * Idempotent: re-running detects existing scenario by name and updates
 * the script. Adds `outbound-callback` rule к metallportal-inbound app
 * с pattern matching the trigger phone (special unused number serving
 * as «callback bus»). When `StartScenarios` API call is made с rule_id,
 * Voximplant fires this scenario passing custom_data.
 *
 * Required env (same as inbound):
 *   - VOXIMPLANT_SERVICE_ACCOUNT_BASE64
 *   - VOXIMPLANT_WEBHOOK_SECRET
 *   - VOXIMPLANT_WEBHOOK_URL (default: harlansteel.ru/api/voximplant/webhook)
 *
 * Run:
 *   cd metallportal
 *   npx ts-node scripts/voximplant/create_outbound_callback_scenario.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import jwt from 'jsonwebtoken'

const APP_NAME = 'metallportal-inbound'
const SCENARIO_NAME = 'outbound-callback'
const RULE_NAME = 'outbound-callback-trigger'
const OWN_CLI = '74993253969'
const VOX_HOST = 'https://api.voximplant.com'

function loadEnv() {
  for (const path of ['.env.local']) {
    try {
      const env = readFileSync(join(process.cwd(), path), 'utf-8')
      for (const line of env.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[k]) process.env[k] = v
      }
    } catch { /* env optional */ }
  }
}

type Creds = { account_email: string; account_id: number; key_id: string; private_key: string }

function loadCreds(): Creds {
  const b64 = process.env.VOXIMPLANT_SERVICE_ACCOUNT_BASE64
  if (!b64) throw new Error('VOXIMPLANT_SERVICE_ACCOUNT_BASE64 not set')
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as Creds
}

function authHeader(creds: Creds): string {
  const now = Math.floor(Date.now() / 1000)
  const token = jwt.sign(
    { iss: creds.account_id, iat: now, exp: now + 60 },
    creds.private_key,
    { algorithm: 'RS256', header: { alg: 'RS256', kid: creds.key_id } },
  )
  return `Bearer ${token}`
}

async function voxApi(
  creds: Creds,
  cmd: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    body.set(k, String(v))
  }
  const res = await fetch(`${VOX_HOST}/platform_api/${cmd}/`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(creds),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  const json = (await res.json()) as { error?: { code: number; msg: string } } & Record<string, unknown>
  if (json.error) {
    throw new Error(`Voximplant ${cmd}: ${json.error.code} ${json.error.msg}`)
  }
  return json
}

// ── Outbound callback scenario ───────────────────────────────────────────
// Receives custom_data via VoxEngine.customData() — JSON string with
// { manager_phone, client_phone }. Calls manager first; on Connected — calls
// client; bridges; records both legs; POSTs webhook on Disconnected.
//
// Lessons applied (c021b/c024):
//   - No `require(Modules.PhoneNumber)` — empty module argument runtime quirk
//   - No e.call.answer() before easyProcess (auto-answer in easyProcess)
//   - Use own Voximplant number as CLI on outbound legs (no spoofing)
function buildScenarioScript(opts: {
  webhookUrl: string
  webhookSecret: string
}): string {
  const { webhookUrl, webhookSecret } = opts
  return `var managerPhone = '';
var clientPhone = '';
var startedAt = new Date().toISOString();
var sessionId = String(VoxEngine.sessionLogId || '');
var recordUrl = '';

VoxEngine.addEventListener(AppEvents.Started, function() {
  var raw = VoxEngine.customData() || '';
  Logger.write('Outbound callback start: customData=' + raw);
  try {
    var d = JSON.parse(raw);
    managerPhone = String(d.manager_phone || '');
    clientPhone = String(d.client_phone || '');
  } catch (e) {
    Logger.write('Failed to parse customData: ' + e.message);
    VoxEngine.terminate();
    return;
  }

  if (!managerPhone || !clientPhone) {
    Logger.write('Missing manager/client phone — terminating');
    VoxEngine.terminate();
    return;
  }

  // 1. Call manager first
  var managerCall = VoxEngine.callPSTN(managerPhone, '${OWN_CLI}');
  Logger.write('Calling manager: ' + managerPhone);

  managerCall.addEventListener(CallEvents.Failed, function(e) {
    Logger.write('Manager call failed: ' + e.code + ' ' + e.reason);
    VoxEngine.terminate();
  });

  managerCall.addEventListener(CallEvents.Connected, function() {
    Logger.write('Manager picked up — calling client: ' + clientPhone);

    // 2. Call client (own CLI = +7 (499) 325-39-69 — semantically «звонит metallportal»)
    var clientCall = VoxEngine.callPSTN(clientPhone, '${OWN_CLI}');

    clientCall.addEventListener(CallEvents.Failed, function(e) {
      Logger.write('Client call failed: ' + e.code + ' ' + e.reason);
      managerCall.hangup();
      VoxEngine.terminate();
    });

    clientCall.addEventListener(CallEvents.Connected, function() {
      Logger.write('Client connected — bridging + recording');
      managerCall.record();
    });

    clientCall.addEventListener(CallEvents.RecordStarted, function(ev) {
      if (ev && ev.url) { recordUrl = ev.url; Logger.write('record_url=' + recordUrl); }
    });
    managerCall.addEventListener(CallEvents.RecordStarted, function(ev) {
      if (ev && ev.url && !recordUrl) { recordUrl = ev.url; }
    });

    // 3. Bridge media
    VoxEngine.easyProcess(managerCall, clientCall, function() {
      Logger.write('Outbound bridged successfully');
    });
  });

  // 4. Webhook on disconnect of manager leg (covers happy path и failure)
  managerCall.addEventListener(CallEvents.Disconnected, function(event) {
    var url = recordUrl || (managerCall.record_url) || '';
    Logger.write('Disconnected: dur=' + event.duration + ' rec=' + (url ? 'yes' : 'no'));

    var params = [
      'direction=outbound',
      'voximplant_call_id=' + encodeURIComponent(managerCall.id() || ''),
      'voximplant_session_id=' + encodeURIComponent(sessionId),
      'from_number=' + encodeURIComponent('${OWN_CLI}'),
      'to_number=' + encodeURIComponent(clientPhone),
      'forwarded_to=' + encodeURIComponent(managerPhone),
      'duration=' + (event.duration || 0),
      'recording_url=' + encodeURIComponent(url),
      'started_at=' + encodeURIComponent(startedAt),
      'ended_at=' + encodeURIComponent(new Date().toISOString())
    ].join('&');

    Net.httpRequestAsync('${webhookUrl}', {
      method: 'POST',
      headers: [
        'Content-Type: application/x-www-form-urlencoded',
        'X-Voximplant-Secret: ${webhookSecret}'
      ],
      postData: params
    });
  });
});`
}

async function ensureApplication(creds: Creds): Promise<number> {
  const list = await voxApi(creds, 'GetApplications', { count: 200 })
  const arr = (list.result as Array<{ application_name?: string; application_id?: number }>) ?? []
  const found = arr.find(
    (a) =>
      a.application_name === APP_NAME ||
      (a.application_name ?? '').startsWith(APP_NAME + '.'),
  )
  if (!found || !found.application_id) {
    throw new Error(
      `Application "${APP_NAME}" not found — run create_forwarding_scenario.ts first`,
    )
  }
  return found.application_id
}

async function ensureScenario(creds: Creds, script: string): Promise<number> {
  const list = await voxApi(creds, 'GetScenarios', {})
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
  // Pattern `outbound-trigger-.*` — никогда не матчит реальные PSTN dialed numbers,
  // используется ТОЛЬКО как target для StartScenarios API (server-initiated).
  const added = await voxApi(creds, 'AddRule', {
    application_id: applicationId,
    rule_name: RULE_NAME,
    rule_pattern: 'outbound-trigger-.*',
  })
  const id = added.rule_id as number
  console.log(`✓ Rule created (id=${id}, pattern=outbound-trigger-.*)`)
  return id
}

async function bindScenarioToRule(
  creds: Creds,
  scenarioId: number,
  ruleId: number,
) {
  await voxApi(creds, 'BindScenario', { scenario_id: scenarioId, rule_id: ruleId })
  console.log(`✓ Scenario bound к rule (scenarioId=${scenarioId} → ruleId=${ruleId})`)
}

async function main() {
  loadEnv()

  const webhookUrl =
    process.env.VOXIMPLANT_WEBHOOK_URL ??
    'https://www.harlansteel.ru/api/voximplant/webhook'
  const webhookSecret = process.env.VOXIMPLANT_WEBHOOK_SECRET ?? ''
  if (!webhookSecret) {
    throw new Error('VOXIMPLANT_WEBHOOK_SECRET not set')
  }

  const creds = loadCreds()
  const script = buildScenarioScript({ webhookUrl, webhookSecret })

  console.log('=== Voximplant outbound-callback setup ===')
  console.log(`Webhook URL: ${webhookUrl}`)
  console.log(`Account:     ${creds.account_email} (id=${creds.account_id})`)
  console.log()

  const applicationId = await ensureApplication(creds)
  const scenarioId = await ensureScenario(creds, script)
  const ruleId = await ensureRule(creds, applicationId)
  await bindScenarioToRule(creds, scenarioId, ruleId)

  console.log()
  console.log('=== ✅ OUTBOUND CALLBACK READY ===')
  console.log(`Application:  ${applicationId}`)
  console.log(`Scenario:     ${scenarioId} (${SCENARIO_NAME})`)
  console.log(`Rule:         ${ruleId} (${RULE_NAME})`)
  console.log()
  console.log('Trigger via StartScenarios API:')
  console.log('  POST /platform_api/StartScenarios/')
  console.log(`  rule_id=${ruleId}`)
  console.log('  script_custom_data={"manager_phone":"+79013617775","client_phone":"+79XXXXXXXXX"}')
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  if (e instanceof Error && e.stack) console.error(e.stack)
  process.exit(1)
})
