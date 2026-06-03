'use client';

import { useState } from 'react';
import { Plus, CheckCircle2, XCircle, Trash2, RefreshCw, Send, Network } from 'lucide-react';

interface ConnRow {
  id: string;
  platform: 'telegram' | 'vk';
  label: string;
  token: string;       // уже masked
  token_set: boolean;
  target_id: string;
  enabled: boolean;
  meta: { check_info?: string; last_checked_at?: string; last_error?: string } | null;
  created_at: string;
  updated_at: string;
}

const PLATFORM_LABEL = { telegram: 'Telegram', vk: 'VK' } as const;

export default function ConnectionsClient({ initial, tenantName }: { initial: ConnRow[]; tenantName: string | null }) {
  const [list, setList] = useState<ConnRow[]>(initial);
  const [editing, setEditing] = useState<ConnRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const r = await fetch('/api/content/connections');
    const j = await r.json();
    if (j.connections) setList(j.connections);
  }

  async function toggle(c: ConnRow) {
    setBusyId(c.id); setError(null);
    const r = await fetch(`/api/content/connections/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !c.enabled }),
    });
    const j = await r.json();
    setBusyId(null);
    if (j.error) return setError(j.error);
    await reload();
  }

  async function check(c: ConnRow) {
    setBusyId(c.id); setError(null);
    const r = await fetch(`/api/content/connections/${c.id}/check`, { method: 'POST' });
    const j = await r.json();
    setBusyId(null);
    if (!j.ok) setError(j.error || 'check failed');
    await reload();
  }

  async function remove(c: ConnRow) {
    if (!confirm(`Удалить связь "${c.label}"?`)) return;
    setBusyId(c.id);
    await fetch(`/api/content/connections/${c.id}`, { method: 'DELETE' });
    setBusyId(null);
    await reload();
  }

  return (
    <div className="p-6 max-w-5xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Network size={20} className="text-gray-600" />
            Связи
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Подключения к платформам публикации{tenantName ? ` · ${tenantName}` : ''} · Telegram + VK
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          <Plus size={14} />
          Добавить связь
        </button>
      </header>

      {error && (
        <div className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-[11px] font-medium text-gray-600 uppercase tracking-wide">
              <th className="px-3 py-2">Связь</th>
              <th className="px-3 py-2 w-24">Платформа</th>
              <th className="px-3 py-2 w-40">Target ID</th>
              <th className="px-3 py-2 w-32">Token</th>
              <th className="px-3 py-2 w-24 text-center">Активна</th>
              <th className="px-3 py-2 w-80">Проверка</th>
              <th className="px-3 py-2 w-32 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-400">
                Связей пока нет. Жми «Добавить связь».
              </td></tr>
            )}
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <button
                    onClick={() => setEditing(c)}
                    className="font-medium text-gray-900 text-sm hover:text-blue-600 text-left"
                  >
                    {c.label}
                  </button>
                </td>
                <td className="px-3 py-2 text-xs">{PLATFORM_LABEL[c.platform]}</td>
                <td className="px-3 py-2 text-xs font-mono text-gray-700">{c.target_id}</td>
                <td className="px-3 py-2 text-xs font-mono text-gray-500">{c.token_set ? c.token : '— не задан —'}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => toggle(c)}
                    disabled={busyId === c.id}
                    className={`inline-flex items-center w-9 h-5 rounded-full transition-colors ${
                      c.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                    } disabled:opacity-40`}
                  >
                    <span className={`inline-block w-4 h-4 bg-white rounded-full transition-transform ${
                      c.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-3 py-2 text-xs">
                  {c.meta?.last_error ? (
                    <span className="text-red-600 flex items-center gap-1"><XCircle size={12} />{c.meta.last_error}</span>
                  ) : c.meta?.check_info ? (
                    <span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12} />{c.meta.check_info}</span>
                  ) : (
                    <span className="text-gray-400">не проверена</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => check(c)}
                    disabled={busyId === c.id}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40"
                    title="Проверить связь"
                  >
                    <RefreshCw size={14} className={busyId === c.id ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => remove(c)}
                    disabled={busyId === c.id}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ConnectionForm
          editing={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(); }}
        />
      )}
    </div>
  );
}

function ConnectionForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: ConnRow | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [platform, setPlatform] = useState<'telegram' | 'vk'>(editing?.platform ?? 'telegram');
  const [label, setLabel] = useState(editing?.label ?? '');
  const [token, setToken] = useState('');
  const [targetId, setTargetId] = useState(editing?.target_id ?? '');
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      if (editing) {
        const body: Record<string, unknown> = { label: label.trim(), target_id: targetId.trim(), enabled };
        if (token.trim()) body.token = token.trim();
        const r = await fetch(`/api/content/connections/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
      } else {
        if (!token.trim()) throw new Error('Токен обязателен при создании');
        const r = await fetch('/api/content/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, label: label.trim(), token: token.trim(), target_id: targetId.trim(), enabled }),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
      }
      await onSaved();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{editing ? 'Изменить связь' : 'Новая связь'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-sm">×</button>
        </header>

        <div className="px-4 py-4 space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">{error}</div>}

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Платформа</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => !editing && setPlatform('telegram')}
                disabled={!!editing}
                className={`flex-1 px-3 py-1.5 text-sm border rounded-md ${
                  platform === 'telegram' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'
                } disabled:opacity-60`}
              >
                Telegram
              </button>
              <button
                onClick={() => !editing && setPlatform('vk')}
                disabled={!!editing}
                className={`flex-1 px-3 py-1.5 text-sm border rounded-md ${
                  platform === 'vk' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'
                } disabled:opacity-60`}
              >
                VK
              </button>
            </div>
            {editing && <p className="text-[10px] text-gray-400 mt-1">Платформа фиксирована для существующей связи</p>}
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Имя</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Например: «Столица — основной канал»"
              className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              {platform === 'telegram' ? 'Bot token' : 'Access token'}
              {editing && <span className="text-gray-400"> (пусто = не менять)</span>}
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={editing ? '••••' : (platform === 'telegram' ? '1234567:AAH...' : 'vk1.a.xxx...')}
              autoComplete="off"
              className="mt-1 w-full px-2.5 py-1.5 text-sm font-mono border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              {platform === 'telegram' ? 'Chat / channel ID' : 'Group ID'}
            </label>
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder={platform === 'telegram' ? '@my_channel или -1001234567890' : '123456789'}
              className="mt-1 w-full px-2.5 py-1.5 text-sm font-mono border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
            {platform === 'telegram' && (
              <p className="text-[10px] text-gray-400 mt-1">Бот должен быть админом в чате/канале.</p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded text-blue-600"
            />
            <label htmlFor="enabled" className="text-xs text-gray-700">Активна (использовать для публикации)</label>
          </div>
        </div>

        <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-md">Отмена</button>
          <button
            onClick={save}
            disabled={saving || !label.trim() || !targetId.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </footer>
      </div>
    </div>
  );
}
