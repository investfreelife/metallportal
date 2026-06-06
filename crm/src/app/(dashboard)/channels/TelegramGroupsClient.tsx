'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  Send,
  RefreshCw,
  Search,
  Trash2,
  ExternalLink,
  Pause,
  Play,
  Activity,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { fmtMsk } from '@/lib/tz';

interface Props {
  tenantName: string | null;
}

interface ChannelItem {
  id: string;
  name: string;
  username: string | null;
  link: string | null;
  members: number | null;
  country: string | null;
  found_query: string | null;
  city: string | null;
  is_group: boolean;
  status: string | null;
  needs_human: boolean | null;
  join_type: string | null;
  audience: string | null;
  work_status: string | null;
  can_post: boolean | null;
  post_via: string | null;
  ad_contact: string | null;
  ad_link: string | null;
  post_mode: string | null;
  about: string | null;
  joined: boolean | null;
  post_rejected: boolean | null;
  publish_ok: boolean | null;
  legal: string | null;
  threats_seen: string | null;
  rules: string | null;
  required_channel: string | null;
  required_link: string | null;
  source: string | null;
  last_sync_at: string | null;
}

interface ListResponse {
  items: ChannelItem[];
  summary: { total: number; small: number; mid: number; large: number; no_members: number; joined: number; postable: number; readonly: number; bot_paid: number; rejected: number; verified: number; needs_human: number };
  page: { page: number; per: number; total: number; pages: number };
}

interface ParserStatus {
  running?: boolean;
  paused?: boolean;
  last_query?: string;
  found_total?: number;
  found_small?: number;
  found_large?: number;
  cycle?: number;
  queries_done?: number;
  queries_total?: number;
  flood_until?: number; // unix seconds
  engine?: string;
  updated_at?: string;
}
interface ParserControl {
  paused?: boolean;
  paused_by?: string | null;
  paused_at?: string | null;
  resumed_at?: string | null;
}


function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU');
}

// Человекочитаемая метка стадии пайплайна группы.
const STATUS_LABELS: Record<string, string> = {
  found: '🔍 найдена',
  analyzed: '📋 разобрана',
  pending_admin: '⏳ ждём админа',
  negotiation: '💬 переговоры',
  pending: '🕒 неподтверждённая',
  paid: '💰 платная',
  diaspora: '🌐 диаспора',
  ready: '✅ готова',
  posting: '📤 постим',
  rejected: '🚫 стоп',
};
function fmtStatus(s: string | null | undefined): string {
  if (!s) return '—';
  return STATUS_LABELS[s] ?? '—';
}

export default function TelegramGroupsClient({ tenantName }: Props) {
  const [resp, setResp] = useState<ListResponse | null>(null);
  const [status, setStatus] = useState<ParserStatus | null>(null);
  const [control, setControl] = useState<ParserControl | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [size, setSize] = useState<'' | 'small' | 'mid' | 'large'>('');
  const [joinedF, setJoinedF] = useState<'' | 'yes' | 'no'>('');
  const [hasMembers, setHasMembers] = useState<'' | 'yes' | 'no'>('');
  const [postF, setPostF] = useState<'' | 'yes' | 'no' | 'paid' | 'rejected' | 'verified'>('');
  const [needsHuman, setNeedsHuman] = useState(false);
  const [sort, setSort] = useState<'members' | 'name'>('members');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const per = 50;

  const reloadList = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('q', search.trim());
      if (size) qs.set('size', size);
      if (joinedF) qs.set('joined', joinedF);
      if (hasMembers) qs.set('has_members', hasMembers);
      if (postF) qs.set('post', postF);
      if (needsHuman) qs.set('needs_human', '1');
      qs.set('sort', sort);
      qs.set('dir', dir);
      qs.set('page', String(page));
      qs.set('per', String(per));
      const j = await safeFetchJson<ListResponse>(`/api/recruit/parser-channels?${qs.toString()}`);
      setResp(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, size, joinedF, hasMembers, postF, needsHuman, sort, dir, page]);

  const reloadStatus = useCallback(async () => {
    try {
      const j = await safeFetchJson<{ status: ParserStatus | null; control: ParserControl | null }>(
        '/api/recruit/parser-status'
      );
      setStatus(j.status);
      setControl(j.control);
    } catch (e) {
      // не валим страницу
      console.error('parser-status:', e);
    }
  }, []);

  // Дебаунс поиска
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); reloadList(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Прочие фильтры/sort — мгновенно
  useEffect(() => { setPage(1); reloadList(); /* eslint-disable-next-line */ }, [size, joinedF, hasMembers, postF, needsHuman, sort, dir]);
  // Page changes
  useEffect(() => { reloadList(); /* eslint-disable-next-line */ }, [page]);

  useEffect(() => {
    reloadStatus();
    const id = setInterval(reloadStatus, 10_000); // парсер апдейтит часто
    return () => clearInterval(id);
  }, [reloadStatus]);

  async function setPaused(paused: boolean) {
    try {
      const j = await safeFetchJson<{ control: ParserControl }>(
        '/api/recruit/parser-control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paused }),
        }
      );
      setControl(j.control);
      // подтянуть статус заодно
      reloadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeRow(item: ChannelItem) {
    if (!confirm(`Удалить «${item.name}» из списка?\n(локально, в Telegram не повлияет.)`)) return;
    try {
      await safeFetchJson(`/api/recruit/parser-channels/${item.id}`, { method: 'DELETE' });
      reloadList(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const items = resp?.items ?? [];
  const summary = resp?.summary ?? { total: 0, small: 0, mid: 0, large: 0, no_members: 0, joined: 0, postable: 0, readonly: 0, bot_paid: 0, rejected: 0, verified: 0, needs_human: 0 };
  const pageInfo = resp?.page ?? { page: 1, per, total: 0, pages: 1 };

  // Эффективное состояние паузы: control.paused приоритетнее, иначе status.paused.
  const effectivePaused = control?.paused ?? status?.paused ?? false;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Send size={20} className="text-gray-600" />
            Каналы{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Спарсенные Telegram-группы и каналы (доноры для рекрутинга) + панель парсера. Время МСК.
          </p>
        </div>
        <button
          onClick={() => { reloadList(); reloadStatus(); }}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </header>

      {/* ── Панель парсера ───────────────────────────────────────────── */}
      <ParserPanel
        status={status}
        control={control}
        effectivePaused={effectivePaused}
        onPause={() => setPaused(true)}
        onResume={() => setPaused(false)}
      />

      {/* ── Сводка по списку ──────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3 px-6 py-3 bg-white border-b border-gray-100">
        <TotalCard label="Всего" value={fmtNum(summary.total)} />
        <TotalCard label="Мелких <1k" value={fmtNum(summary.small)} hint="до 1000 участников" />
        <TotalCard label="Средних 1k–10k" value={fmtNum(summary.mid)} />
        <TotalCard label="Крупных >10k" value={fmtNum(summary.large)} />
        <TotalCard label="Подписан" value={fmtNum(summary.joined)} hint={`${summary.no_members} без members`} />
      </div>

      {/* ── Пояснение «как это работает» (чтобы было понятно) ──────── */}
      <div className="mx-6 mt-3 mb-1 text-xs bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-gray-700 leading-relaxed">
        <div className="font-semibold text-gray-900 mb-1">📌 Как машина тут работает (тебе руками ничего делать не надо)</div>
        <div className="grid sm:grid-cols-3 gap-2 mt-2">
          <div><span className="text-emerald-700 font-medium">🟢 Вступи и пиши</span> — чтобы постить в группу, надо в неё <b>вступить</b>. Машина вступает <b>медленно сама</b> (анти-бан, несколько в день) и публикует твои согласованные посты. Постить во все сразу нельзя — это спам и бан, поэтому только в хорошие и по чуть-чуть.</div>
          <div><span className="text-amber-700 font-medium">🤖 Платно (бот/админ)</span> — размещение за деньги через рекламного бота/админа (так делают Озон, Х5, Магнит). Жмёшь контакт в колонке «Платно через» → машина пишет ему, узнаёт цену. <b>Оплату подтверждаешь только ты.</b></div>
          <div><span className="text-rose-600 font-medium">🔴 Только чтение</span> — писать нельзя и платный контакт не нашёлся. Пропускаем.</div>
        </div>
        <div className="mt-2 text-[11px] text-gray-500">Сами посты ты согласовываешь во вкладке <b>Контент</b>. Здесь — только база каналов, куда машина их разносит.</div>
      </div>

      {/* ── Разделы «Где могу писать» (главное) ───────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 mr-1">Где могу писать:</span>
        <SectionTab
          active={postF === 'yes'}
          onClick={() => setPostF(postF === 'yes' ? '' : 'yes')}
          color="emerald"
          label={`🟢 Вступи и пиши · ${fmtNum(summary.postable)}`}
        />
        <SectionTab
          active={postF === 'paid'}
          onClick={() => setPostF(postF === 'paid' ? '' : 'paid')}
          color="amber"
          label={`🤖 Платно (бот/админ) · ${fmtNum(summary.bot_paid)}`}
        />
        <SectionTab
          active={postF === 'no'}
          onClick={() => setPostF(postF === 'no' ? '' : 'no')}
          color="rose"
          label={`🔴 Только чтение · ${fmtNum(summary.readonly)}`}
        />
        <SectionTab
          active={postF === 'rejected'}
          onClick={() => setPostF(postF === 'rejected' ? '' : 'rejected')}
          color="red"
          label={`🚫 Отклонённые · ${fmtNum(summary.rejected)}`}
        />
        <SectionTab
          active={postF === 'verified'}
          onClick={() => setPostF(postF === 'verified' ? '' : 'verified')}
          color="green"
          label={`✅ Проверена · ${fmtNum(summary.verified)}`}
        />
        <SectionTab
          active={needsHuman}
          onClick={() => setNeedsHuman((v) => !v)}
          color="amber"
          label={`🙋 Требуется человек · ${fmtNum(summary.needs_human)}`}
        />
        <SectionTab
          active={postF === ''}
          onClick={() => setPostF('')}
          color="gray"
          label="Все"
        />
        <span className="text-[11px] text-gray-400 ml-2 w-full">
          🟢 — вступаешь в группу и пишешь бесплатно (осторожно, анти-спам) · 🤖 — размещение через бота/админа (платно), контакт в колонке «Платно через» · 🔴 — постинг запрещён, контакт не найден
        </span>
      </div>

      {/* ── Фильтры ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100 flex-wrap">
        <div className="relative w-80">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию / @username / запросу…"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
          />
        </div>
        <FilterChip
          label="Размер:"
          value={size}
          onChange={(v) => setSize(v as typeof size)}
          opts={[['', 'все'], ['small', 'мелкие <1k'], ['mid', 'средние'], ['large', 'крупные >10k']]}
        />
        <FilterChip
          label="Подписан:"
          value={joinedF}
          onChange={(v) => setJoinedF(v as typeof joinedF)}
          opts={[['', 'все'], ['yes', 'да'], ['no', 'нет']]}
        />
        <FilterChip
          label="Members:"
          value={hasMembers}
          onChange={(v) => setHasMembers(v as typeof hasMembers)}
          opts={[['', 'все'], ['yes', 'есть'], ['no', 'нет']]}
        />
        <div className="flex-1" />
        <span className="text-[11px] text-gray-500">
          Показано {pageInfo.total > 0 ? `${(pageInfo.page - 1) * pageInfo.per + 1}–${Math.min(pageInfo.page * pageInfo.per, pageInfo.total)} из ${fmtNum(pageInfo.total)}` : '0'}
        </span>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Таблица ───────────────────────────────────────────── */}
      {/* Sergey directive 2026-06-06: правая колонка «Подписан» обрезается,
          нужен видимый h-скролл (тот же hscroll, что на /funnel-stages). */}
      <div className="hscroll flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Ничего не найдено.</p>
        ) : (
          <table className="min-w-[1500px] text-sm">
            <thead className="bg-gray-50 border-y border-gray-200 sticky top-0">
              <tr className="text-left text-[11px] font-medium text-gray-600 uppercase tracking-wide">
                <th className="px-3 py-2 w-8" />
                <SortableTh
                  label="Название"
                  active={sort === 'name'}
                  dir={dir}
                  onClick={() => {
                    if (sort === 'name') setDir(dir === 'asc' ? 'desc' : 'asc');
                    else { setSort('name'); setDir('asc'); }
                  }}
                />
                <th className="px-3 py-2 w-28">Город</th>
                <th className="px-3 py-2 w-24">Страна</th>
                <SortableTh
                  label="Участников"
                  active={sort === 'members'}
                  dir={dir}
                  align="right"
                  onClick={() => {
                    if (sort === 'members') setDir(dir === 'asc' ? 'desc' : 'asc');
                    else { setSort('members'); setDir('desc'); }
                  }}
                  width="w-28"
                />
                <th className="px-3 py-2 w-20">Тип</th>
                <th className="px-3 py-2 w-32">Статус</th>
                <th className="px-3 py-2 w-24 text-center">Можно постить</th>
                <th className="px-3 py-2 w-36">Платно через</th>
                <th className="px-3 py-2 w-12 text-center">Правила</th>
                <th className="px-3 py-2 w-20 text-center">Подписан</th>
                <th className="px-3 py-2 w-24 text-center">Профиль</th>
                <th className="px-3 py-2 w-24">Источник</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 max-w-md">
                    {it.link ? (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                        title="Открыть в Telegram"
                      >
                        <span className="truncate">{it.name}</span>
                        <ExternalLink size={11} className="flex-shrink-0 opacity-50" />
                      </a>
                    ) : (
                      <span className="text-gray-900 font-medium">{it.name}</span>
                    )}
                    {it.username && (
                      <div className="text-[10px] text-gray-400">@{it.username.replace(/^@/, '')}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{it.city || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{it.country || '—'}</td>
                  <td className="px-3 py-2 text-xs text-right font-medium tabular-nums">{fmtNum(it.members)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{it.is_group ? 'группа' : 'канал'}</td>
                  <td
                    className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap"
                    title={`Вход: ${it.join_type ?? '—'} · ЦА: ${it.audience ?? '—'} · ${it.work_status ?? '—'}`}
                  >
                    <span>{fmtStatus(it.status)}</span>
                    {it.needs_human && <span className="ml-1" title="требует взгляда человека">🙋</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-center text-gray-700">
                    {it.post_rejected ? (
                      <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-300 rounded font-medium" title="в этой группе наши посты удаляют / нас забанили">🚫 удаляют наши посты</span>
                    ) : it.can_post === true ? (
                      <span className="text-emerald-600 font-medium" title={it.post_via ?? 'свободно'}>🟢 можно</span>
                    ) : it.can_post === false ? (
                      <span className="text-rose-500" title={it.post_via ?? 'постинг запрещён участникам'}>🔴 нельзя</span>
                    ) : (
                      <span className="text-gray-400" title="не размечено парсером">—</span>
                    )}
                    {it.required_channel && (
                      <div className="mt-0.5">
                        <a
                          href={it.required_link ?? `https://t.me/${it.required_channel.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-amber-700 hover:underline"
                          title="для записи в группу требуется подписка на этот канал"
                        >
                          🔒 нужна подписка @{it.required_channel.replace(/^@/, '')}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {it.ad_contact && it.ad_link ? (
                      <a
                        href={it.ad_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-700 hover:underline inline-flex items-center gap-1 font-medium"
                        title={it.about ?? 'контакт для платного размещения'}
                      >
                        🤖 {it.ad_contact}
                        <ExternalLink size={10} className="opacity-50" />
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-center">
                    {it.rules ? (
                      <span className="cursor-help" title={it.rules}>📋</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-center">
                    {it.joined === true ? <span className="text-emerald-600">✓</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-center">
                    {it.publish_ok === true ? (
                      <span
                        className="inline-block px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-300 rounded font-medium"
                        title={`Страна: ${it.country ?? '—'} · Легально: ${it.legal ?? '—'} · Угрозы: ${it.threats_seen ?? '—'}`}
                      >
                        ✅ готова
                      </span>
                    ) : it.post_rejected ? (
                      <span className="text-red-600" title="наши посты удаляют / нас забанили">🚫</span>
                    ) : (
                      <span className="text-gray-400" title="ещё не проверена">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-500">{it.source ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => removeRow(it)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Удалить из списка"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Пагинация ─────────────────────────────────────────── */}
      {pageInfo.pages > 1 && (
        <div className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-t border-gray-200">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageInfo.page <= 1}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-gray-700 tabular-nums">
            страница {pageInfo.page} из {pageInfo.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageInfo.pages, p + 1))}
            disabled={pageInfo.page >= pageInfo.pages}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Parser Panel ─────────────────────────────────────────────────────
function ParserPanel({
  status,
  control,
  effectivePaused,
  onPause,
  onResume,
}: {
  status: ParserStatus | null;
  control: ParserControl | null;
  effectivePaused: boolean;
  onPause: () => void;
  onResume: () => void;
}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const floodActive = (status?.flood_until ?? 0) > nowSec;
  const floodUntilIso = floodActive && status?.flood_until
    ? new Date(status.flood_until * 1000).toISOString()
    : null;

  let statusBadge: { color: string; label: string };
  if (effectivePaused) {
    statusBadge = { color: 'bg-gray-200 text-gray-800 border-gray-300', label: '⏸ Пауза вручную' };
  } else if (floodActive) {
    statusBadge = {
      color: 'bg-amber-100 text-amber-800 border-amber-300',
      label: `🟡 Флуд-пауза до ${fmtMsk(floodUntilIso!, true)} МСК`,
    };
  } else if (status?.running) {
    statusBadge = { color: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: '🟢 Работает' };
  } else {
    statusBadge = { color: 'bg-gray-100 text-gray-600 border-gray-200', label: '— нет статуса' };
  }

  const progressPct = (() => {
    const done = status?.queries_done ?? 0;
    const total = status?.queries_total ?? 0;
    if (!total) return 0;
    return Math.min(100, Math.round((done / total) * 100));
  })();

  return (
    <div className="px-6 py-3 bg-white border-b border-gray-200">
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <Activity size={16} className="text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">Парсер</h2>
            <span className={`inline-block text-[11px] px-2 py-0.5 border rounded ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            {status?.engine && (
              <span className="text-[10px] text-gray-500">движок: {status.engine}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {effectivePaused ? (
              <button
                onClick={onResume}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700"
              >
                <Play size={12} />
                Продолжить
              </button>
            ) : (
              <button
                onClick={onPause}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white text-xs font-medium rounded-md hover:bg-gray-800"
              >
                <Pause size={12} />
                Пауза
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <PStat label="Текущий запрос" value={status?.last_query ?? '—'} mono />
          <PStat label="Цикл" value={status?.cycle != null ? `№${status.cycle}` : '—'} />
          <PStat label="Найдено всего" value={fmtNum(status?.found_total ?? null)} />
          <PStat label="Мелких <1k" value={fmtNum(status?.found_small ?? null)} />
          <PStat label="Крупных >10k" value={fmtNum(status?.found_large ?? null)} />
          <PStat
            label="Запросов"
            value={`${fmtNum(status?.queries_done ?? null)} / ${fmtNum(status?.queries_total ?? null)}`}
          />
        </div>

        {(status?.queries_total ?? 0) > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
              <div
                className={`h-full transition-all ${
                  effectivePaused ? 'bg-gray-500' : floodActive ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-between">
              <span>прогресс очереди: {progressPct}%</span>
              {status?.updated_at && (
                <span>обновлено {fmtMsk(status.updated_at, true)} МСК</span>
              )}
            </div>
          </div>
        )}

        {control?.paused && control.paused_by && (
          <div className="mt-2 text-[10px] text-gray-500">
            Поставлено на паузу: <strong>{control.paused_by}</strong>
            {control.paused_at && <> · {fmtMsk(control.paused_at, true)} МСК</>}
          </div>
        )}
      </div>
    </div>
  );
}

function PStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-medium text-gray-900 truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function TotalCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-gray-400">{hint}</div>}
    </div>
  );
}

function FilterChip({
  label,
  value,
  onChange,
  opts,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-gray-700">
      <span className="text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-1.5 py-1 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none bg-white"
      >
        {opts.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function SectionTab({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: 'emerald' | 'rose' | 'gray' | 'amber' | 'red' | 'green';
}) {
  const palette = {
    emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    rose: active ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100',
    amber: active ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    red: active ? 'bg-red-700 text-white border-red-700' : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100',
    green: active ? 'bg-green-600 text-white border-green-600' : 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100',
    gray: active ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
  }[color];
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${palette}`}
    >
      {label}
    </button>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  align,
  width,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  align?: 'right';
  width?: string;
}) {
  return (
    <th
      className={`px-3 py-2 cursor-pointer select-none hover:text-gray-900 ${width ?? ''} ${align === 'right' ? 'text-right' : ''}`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (dir === 'asc' ? <ArrowUp size={9} /> : <ArrowDown size={9} />)}
      </span>
    </th>
  );
}
