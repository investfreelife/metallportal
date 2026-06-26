import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/agent — единый шлюз для 3 ИИ-агентов проекта Таксопарк-Машина
 * (copywriter / marketer / seller-HR) + brain (мозг проекта).
 *
 * Task 058 (taksopark-machine, sergey-coder).
 *
 * Принцип: агенты живут в песочнице без service-role. Приходят с узким
 * токеном роли → сервер проверяет матрицу (роль, table, op) и записывает
 * через service-role, принудительно подставляя tenant_id и фильтруя поля
 * по белому списку. HUMAN-LOCK: что согласовано человеком — НЕ редактируем.
 *
 * Запрос:
 *   Authorization: Bearer <AGENT_TOKEN_*>
 *   Body: { op: 'get'|'insert'|'patch'|'request', table?, id?, query?, data? }
 *
 * Ответы:
 *   200 { ok:true, rows | row | requested:true }
 *   400 { ok:false, error }
 *   401 { ok:false, error: 'unknown token' }
 *   403 { ok:false, error: 'forbidden: role X cannot Y on Z' }
 *   423 { ok:false, error: 'human-lock: ...' }
 *
 * Безопасность:
 *   - tenant_id серверный, клиент не переопределяет;
 *   - service-role только на сервере, токены ролей не светят;
 *   - delete запрещён всем НЕ-brain;
 *   - `id`/`tenant_id` нельзя менять через patch.
 */
export const dynamic = 'force-dynamic';

const TENANT = '66fe829e-22e8-4eda-8f9c-e8a131117a65';

type Role = 'copywriter' | 'marketer' | 'seller' | 'brain';
type Op = 'get' | 'insert' | 'patch' | 'request';

interface TableRule {
  get: boolean;
  insert: boolean;
  patch: boolean;
  request: boolean;
  fields?: string[];                   // белый список полей для insert/patch
  configKinds?: string[];              // для channels — только эти kind разрешены
}

// Матрица прав §2 — keys table, value RuleSet per role.
const MATRIX: Record<Role, Record<string, TableRule>> = {
  copywriter: {
    ad_variants: { get: true, insert: true, patch: true, request: true,
                   fields: ['label', 'text', 'photo_url', 'status', 'note', 'campaign_id'] },
    campaigns:   { get: true, insert: false, patch: false, request: true },
  },
  marketer: {
    campaigns: { get: true, insert: true, patch: true, request: true,
                 fields: ['name', 'segment', 'portrait', 'objective', 'audience', 'status', 'seg_order', 'note'] },
    ad_variants: { get: true, insert: true, patch: true, request: true,
                   fields: ['label', 'text', 'photo_url', 'status', 'note', 'campaign_id'] },
    channels: { get: true, insert: false, patch: true, request: true,
                fields: ['config'],
                configKinds: ['program_doc', 'launch_checklist', 'source_codes', 'traction_channels', 'mkt_tools', 'mkt_backlog'] },
    content_posts: { get: true, insert: true, patch: true, request: true,
                     fields: ['text', 'photo_url', 'scheduled_at', 'status', 'channel', 'note', 'title', 'body', 'channels_sel'] },
    dialog_messages: { get: true, insert: false, patch: false, request: true },
  },
  seller: {
    dialog_messages: { get: true, insert: true, patch: true, request: true,
                       fields: ['text', 'stage', 'note', 'chat_id', 'who', 'username', 'direction'] },
    dialog_handoff: { get: true, insert: true, patch: true, request: true,
                      fields: ['chat_id', 'active', 'taken_by', 'note'] },
    contacts: { get: true, insert: true, patch: true, request: true,
                fields: ['full_name', 'segment', 'city', 'has_car', 'stage', 'next_touch_at',
                         'objections', 'promises', 'ready_date', 'lost_reason',
                         'do_not_contact', 'note', 'notes', 'type', 'source', 'source_code',
                         'entry_segment', 'telegram_chat_id', 'experience', 'touch_count',
                         'last_direction'] },
    pending_questions: { get: true, insert: true, patch: true, request: true,
                         fields: ['chat_id', 'question', 'answer', 'status', 'who', 'username', 'source'] },
    campaigns: { get: true, insert: false, patch: false, request: true },
    ad_variants: { get: true, insert: false, patch: false, request: true },
  },
  brain: {}, // brain: матрица не применяется — see allowAll() ниже
};

// Жёсткие глобальные запреты — никому из НЕ-brain.
const FORBIDDEN_TABLES = new Set([
  'categories', 'products', 'product_variants', 'orders', 'order_items', // каталог metallportal
  'auth.users', 'storage.objects', 'pg_catalog',                          // системные
]);

function roleByToken(token: string | null): Role | null {
  if (!token) return null;
  // Сравниваем токен с каждым из 4 env-значений. Нет env → роль не зарегистрирована.
  if (token === process.env.AGENT_TOKEN_COPYWRITER) return 'copywriter';
  if (token === process.env.AGENT_TOKEN_MARKETER) return 'marketer';
  if (token === process.env.AGENT_TOKEN_SELLER) return 'seller';
  if (token === process.env.AGENT_TOKEN_BRAIN) return 'brain';
  return null;
}

function brainAllowed(table: string): boolean {
  // brain: всё разрешено, кроме явных системных таблиц
  return !table.includes('.') && table !== 'pg_catalog';
}

function getRule(role: Role, table: string): TableRule | null {
  if (role === 'brain') {
    if (!brainAllowed(table)) return null;
    return { get: true, insert: true, patch: true, request: true };
  }
  if (FORBIDDEN_TABLES.has(table)) return null;
  return MATRIX[role][table] ?? null;
}

interface Row { [k: string]: unknown }

/** Проверка human-lock на ОДНОЙ строке (для НЕ-brain).
 *  Истина = заблокировано (НЕЛЬЗЯ редактировать). */
function isHumanLocked(table: string, row: Row | null | undefined): boolean {
  if (!row) return false;
  if (row.human_locked === true) return true;
  if (table === 'ad_variants' || table === 'content_posts') {
    if (row.status === 'approved') return true;
  }
  if (table === 'channels') {
    const cfg = row.config as Row | undefined;
    if (cfg && cfg.locked === true) return true;
    // в launch_checklist все done-пункты считаем замкнутыми (но это блокирует весь
    // checklist на запись — что и нужно: правка done-пунктов через op:request).
    if (cfg?.kind === 'launch_checklist' && Array.isArray(cfg.items)) {
      const items = cfg.items as Row[];
      if (items.some((it) => it.done === true)) return true;
    }
  }
  return false;
}

function filterFields(rule: TableRule, role: Role, data: Row): Row {
  if (role === 'brain') return data; // brain пишет всё (под мою ответственность)
  const out: Row = {};
  const allowed = new Set(rule.fields ?? []);
  for (const [k, v] of Object.entries(data)) {
    if (k === 'tenant_id' || k === 'id') continue;       // запрет на смену
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

interface AgentBody {
  op?: string;
  table?: string;
  id?: string;
  query?: string;
  data?: Row;
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    const role = roleByToken(token);
    if (!role) {
      return NextResponse.json({ ok: false, error: 'unknown token' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as AgentBody;
    const op = body.op as Op | undefined;
    const table = body.table || '';
    const id = body.id || '';
    const data = (body.data || {}) as Row;

    if (!op || !['get', 'insert', 'patch', 'request'].includes(op)) {
      return NextResponse.json({ ok: false, error: 'op обязателен: get|insert|patch|request' }, { status: 400 });
    }

    // op: request — агент НЕ пишет, а просит человека.
    if (op === 'request') {
      const reqRow = {
        tenant_id: TENANT, type: 'tracking',
        name: `agent_request:${role}`,
        config: {
          kind: 'agent_request',
          role,
          target_table: table || null,
          target_id: id || null,
          what: String(data.what ?? body.query ?? ''),
          why: String(data.why ?? ''),
          status: 'new',
          ts: new Date().toISOString(),
        },
      };
      const supabase = await createClient();
      const { error } = await supabase.from('channels').insert(reqRow);
      console.log(`agent=${role} op=request table=${table} id=${id}`);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, requested: true });
    }

    if (!table) {
      return NextResponse.json({ ok: false, error: 'table обязателен' }, { status: 400 });
    }
    const rule = getRule(role, table);
    if (!rule || !rule[op]) {
      return NextResponse.json({
        ok: false,
        error: `forbidden: role ${role} cannot ${op} on ${table}`,
      }, { status: 403 });
    }

    const supabase = await createClient();
    console.log(`agent=${role} op=${op} table=${table} id=${id}`);

    if (op === 'get') {
      // ?query=column.op.value,column2.op2.value2 — PostgREST style
      let q = supabase.from(table).select('*').eq('tenant_id', TENANT);
      if (id) q = q.eq('id', id);
      const sp = (body.query || '').split(',').map((s) => s.trim()).filter(Boolean);
      for (const term of sp) {
        // Простейший разбор «col.eq.val» — используем .eq().
        const m = /^([a-zA-Z_][a-zA-Z0-9_]*)\.eq\.(.*)$/.exec(term);
        if (m) q = q.eq(m[1], m[2]);
      }
      const { data: rows, error } = await q.limit(500);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, rows: rows ?? [] });
    }

    if (op === 'insert') {
      // Для channels (marketer) — проверка config.kind.
      if (table === 'channels' && rule.configKinds) {
        const k = String((data.config as Row | undefined)?.kind ?? '');
        if (!rule.configKinds.includes(k)) {
          return NextResponse.json({
            ok: false, error: `channels insert: разрешены только config.kind ∈ {${rule.configKinds.join(', ')}}`,
          }, { status: 403 });
        }
      }
      const payload = { ...filterFields(rule, role, data), tenant_id: TENANT };
      const { data: ins, error } = await supabase.from(table).insert(payload).select().single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, row: ins });
    }

    if (op === 'patch') {
      if (!id) return NextResponse.json({ ok: false, error: 'id обязателен для patch' }, { status: 400 });

      // Тянем существующую строку для human-lock и configKinds.
      const { data: existing } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .eq('tenant_id', TENANT)
        .single();
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'не найдено' }, { status: 404 });
      }

      if (role !== 'brain' && isHumanLocked(table, existing as Row)) {
        return NextResponse.json({
          ok: false,
          error: 'human-lock: согласовано человеком, изменения только через op:request',
        }, { status: 423 });
      }

      if (table === 'channels' && rule.configKinds) {
        const k = String(((existing as Row).config as Row | undefined)?.kind ?? '');
        if (!rule.configKinds.includes(k)) {
          return NextResponse.json({
            ok: false, error: `channels patch: разрешены только config.kind ∈ {${rule.configKinds.join(', ')}}`,
          }, { status: 403 });
        }
      }

      const patch = filterFields(rule, role, data);
      if (!Object.keys(patch).length) {
        return NextResponse.json({ ok: false, error: 'нет разрешённых полей в data' }, { status: 400 });
      }
      const { data: upd, error } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', TENANT)
        .select()
        .single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, row: upd });
    }

    return NextResponse.json({ ok: false, error: 'unknown op' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
