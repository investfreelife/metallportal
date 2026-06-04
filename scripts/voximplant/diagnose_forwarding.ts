/**
 * c021b diagnose — pull call history + verify app/scenario/rule/phone state
 * after Sergey reported "сбой вызова" on test call to +74993253969.
 *
 * No state changes — read-only API calls.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import jwt from 'jsonwebtoken'

const PHONE_NUMBER = '74993253969'
const APP_NAME = 'metallportal-inbound'
const SCENARIO_NAME = 'inbound-forward-to-sergey'
const RULE_NAME = 'forward-499-to-sergey'
const VOX_HOST = 'https://api.voximplant.com'

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

function signAuthHeader(creds: Creds): string {
  const now = Math.floor(Date.now() / 1000)
  const token = jwt.sign(
    { iss: creds.account_id, iat: now, exp: now + 60 },
    creds.private_key,
    { algorithm: 'RS256', header: { alg: 'RS256', kid: creds.key_id } },
  )
  return `Bearer ${token}`
}

async function voxApi(creds: Creds, cmd: string, params: Record<string, string | number | boolean | undefined>) {
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
  const json = await res.json()
  if (json.error) {
    console.error(`! ${cmd}: code ${json.error.code} ${json.error.msg}`)
    return json
  }
  return json
}

async function main() {
  loadEnv()
  const creds = loadCreds()

  console.log('=== c021b DIAGNOSE — read-only ===\n')

  // 1) Account state
  const acc = await voxApi(creds, 'GetAccountInfo', {})
  console.log('§1 Account')
  console.log('   email:        ', acc.result?.account_email)
  console.log('   active:       ', acc.result?.active)
  console.log('   billing addr: ', acc.result?.billing_address_country_code)
  console.log('   live_balance: ', acc.result?.live_balance)
  console.log('   billing_lim:  ', acc.result?.account_first_name, '/', acc.result?.api_key_count)
  console.log()

  // 2) Phone state
  const phones = await voxApi(creds, 'GetPhoneNumbers', { phone_number: PHONE_NUMBER })
  console.log('§2 Phone +' + PHONE_NUMBER)
  const ph = (phones.result ?? [])[0]
  if (ph) {
    console.log('   phone_id:                ', ph.phone_id)
    console.log('   phone_number:            ', ph.phone_number)
    console.log('   deactivated:             ', ph.deactivated)
    console.log('   verified:                ', ph.verified)
    console.log('   application_id (bound):  ', ph.application_id ?? 'NOT BOUND')
    console.log('   application_name:        ', ph.application_name ?? '-')
    console.log('   incoming_sms_enabled:    ', ph.incoming_sms_enabled)
    console.log('   issues:                  ', JSON.stringify(ph.issues ?? null))
  } else {
    console.log('   ⚠ phone not found in account')
  }
  console.log()

  // 3) Application — match on FQDN prefix (Voximplant suffixes acc-name)
  const apps = await voxApi(creds, 'GetApplications', { count: 200 })
  const app = ((apps.result ?? []) as Array<Record<string, unknown>>).find(
    (a) => a.application_name === APP_NAME || (a.application_name as string ?? '').startsWith(APP_NAME + '.'),
  )
  console.log('§3 Application "' + APP_NAME + '"')
  if (app) {
    console.log('   id:           ', app.application_id)
    console.log('   modified:     ', app.modified)
    console.log('   secure_record:', app.secure_record_storage)
  } else {
    console.log('   ⚠ application not found')
  }
  console.log()

  // 4) Scenario (with script) — filter by name first to find id, then fetch with script
  const list = await voxApi(creds, 'GetScenarios', {})
  const meta = ((list.result ?? []) as Array<Record<string, unknown>>).find((s) => s.scenario_name === SCENARIO_NAME)
  let scenario: Record<string, unknown> | undefined
  if (meta?.scenario_id) {
    const detail = await voxApi(creds, 'GetScenarios', { scenario_id: meta.scenario_id as number, with_script: true })
    scenario = ((detail.result ?? []) as Array<Record<string, unknown>>)[0]
  }
  console.log('§4 Scenario "' + SCENARIO_NAME + '"')
  if (scenario) {
    console.log('   id:        ', scenario.scenario_id)
    console.log('   modified:  ', scenario.modified)
    console.log('   script:')
    const script = String(scenario.scenario_script ?? '').split('\n')
    for (const ln of script) console.log('     ' + ln)
  } else {
    console.log('   ⚠ scenario not found')
  }
  console.log()

  // 5) Rules on application + their scenario bindings
  if (app && app.application_id) {
    const rules = await voxApi(creds, 'GetRules', {
      application_id: app.application_id as number,
      with_scenarios: true,
    })
    console.log('§5 Rules on application ' + app.application_id)
    const arr = (rules.result ?? []) as Array<Record<string, unknown>>
    for (const r of arr) {
      console.log('   - rule_id:   ', r.rule_id)
      console.log('     rule_name: ', r.rule_name)
      console.log('     pattern:   ', r.rule_pattern)
      console.log('     scenarios: ', JSON.stringify(r.scenarios ?? []))
    }
    if (arr.length === 0) console.log('   ⚠ no rules on application')
    console.log()
  }

  // 6) Recent calls к the phone (last 20, last 24h)
  // Voximplant requires `yyyy-MM-dd HH:mm:ss` (no T, no Z)
  const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19)
  console.log('§6 Recent call history (last 24h)')
  const hist = await voxApi(creds, 'GetCallHistory', {
    from_date: fmt(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    to_date: fmt(new Date()),
    count: 20,
    with_calls: true,
    with_records: false,
    with_other_resources: false,
    desc_order: true,
  })
  const sessions = ((hist.result ?? []) as Array<Record<string, unknown>>)
  if (sessions.length === 0) {
    console.log('   ⚠ no sessions in last 24h')
  } else {
    for (const s of sessions.slice(0, 10)) {
      console.log('   --- session', s.call_session_history_id, '---')
      console.log('     start_date:    ', s.start_date)
      console.log('     duration:      ', s.duration)
      console.log('     application:   ', s.application_name, '(id=' + s.application_id + ')')
      console.log('     rule:          ', s.rule_name)
      console.log('     scenario_log:  ', String(s.log_file_url ?? '').slice(0, 100))
      const calls = (s.calls ?? []) as Array<Record<string, unknown>>
      for (const c of calls) {
        console.log('     call: type=' + c.incoming + ' caller=' + c.local_number + ' → ' + c.remote_number +
                    '  cost=' + c.cost + '  duration=' + c.duration + '  disc_reason=' + c.disconnect_reason)
      }
    }
  }
  console.log()

  // 7) Session log url for last failed call (if any)
  const lastSession = sessions[0]
  if (lastSession && lastSession.log_file_url) {
    console.log('§7 Last session VoxEngine log URL:')
    console.log('   ', lastSession.log_file_url)
    console.log('   (fetch with auth=null to retrieve)')
  }
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  if (e instanceof Error && e.stack) console.error(e.stack)
  process.exit(1)
})
