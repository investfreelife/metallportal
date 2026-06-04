'use client';

import { useEffect, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { X, Plus, Search, Check, AlertCircle, UserPlus } from 'lucide-react';
import { FUNNEL_COLUMNS } from '@/lib/recruit/types';

interface ContactHit {
  id: string;
  full_name: string | null;
  phone: string | null;
  telegram: string | null;
  telegram_chat_id: string | null;
  type: string | null;
  status: string | null;
  source: string | null;
}

interface Props {
  onClose: () => void;
  onAdded: (info: { contact_id: string; chat_id: string; stage: string }) => void | Promise<void>;
}


const SOURCES = [
  { v: 'tg',       label: 'Telegram-бот' },
  { v: 'vk',       label: 'VK' },
  { v: 'personal', label: 'Личный контакт' },
  { v: 'other',    label: 'Другое' },
];
const TRANSPORTS = [
  { v: 'auto', label: '🚗 Авто' },
  { v: 'bike', label: '🚲 Велосипед' },
  { v: 'foot', label: '🚶 Пешком' },
  { v: 'other', label: 'Другое' },
];

export default function AddCandidateModal({ onClose, onAdded }: Props) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  // Поля для нового
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [source, setSource] = useState('personal');
  const [transport, setTransport] = useState('auto');
  const [stage, setStage] = useState('new');
  const [comment, setComment] = useState('');

  // Поиск существующего контакта
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<ContactHit[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search в режиме existing
  useEffect(() => {
    if (mode !== 'existing') return;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
        const j = await safeFetchJson<{ contacts: ContactHit[] }>(`/api/recruit/contacts/search${q}`);
        setContacts(j.contacts ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, mode]);

  function pickContact(c: ContactHit) {
    setPickedId(c.id);
    // Подставляем доступное в новые поля — на случай переключения mode.
    if (c.full_name) setFullName(c.full_name);
    if (c.phone) setPhone(c.phone);
    if (c.telegram) setTelegram(c.telegram);
    if (c.source === 'tg' || c.source === 'vk' || c.source === 'personal' || c.source === 'other') {
      setSource(c.source);
    }
  }

  async function submit() {
    setSaving(true); setError(null);
    try {
      const payload: Record<string, unknown> = { source, transport, stage, comment: comment.trim() || null };
      if (mode === 'existing' && pickedId) {
        payload.contact_id = pickedId;
      } else {
        if (!fullName.trim()) {
          setError('Введи имя кандидата'); setSaving(false); return;
        }
        payload.full_name = fullName.trim();
        if (phone.trim()) payload.phone = phone.trim();
        if (telegram.trim()) payload.telegram = telegram.trim();
      }
      const j = await safeFetchJson<{ contact_id: string; chat_id: string; stage: string }>(
        '/api/recruit/funnel/add',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      await onAdded({ contact_id: j.contact_id, chat_id: j.chat_id, stage: j.stage });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <UserPlus size={16} className="text-blue-600" />
            Добавить кандидата в воронку
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </header>

        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <button
            onClick={() => setMode('new')}
            className={`text-[11px] px-2.5 py-1 rounded-md font-medium ${
              mode === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Новый кандидат
          </button>
          <button
            onClick={() => setMode('existing')}
            className={`text-[11px] px-2.5 py-1 rounded-md font-medium ${
              mode === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Из существующих контактов
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 overflow-y-auto">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 flex items-start gap-2">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {mode === 'existing' && (
            <div>
              <Field label="Найти контакт">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Имя / телефон / @telegram…"
                    className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </Field>
              <div className="mt-1 max-h-44 overflow-y-auto border border-gray-200 rounded-md">
                {searching ? (
                  <p className="text-[11px] text-gray-400 text-center py-3">Поиск…</p>
                ) : contacts.length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-3">
                    {search.trim() ? 'Не найдено' : 'Введи запрос для поиска'}
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {contacts.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => pickContact(c)}
                          className={`w-full text-left px-2 py-1.5 hover:bg-blue-50/40 ${
                            pickedId === c.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-gray-900 truncate">{c.full_name ?? '—'}</span>
                            {pickedId === c.id && <Check size={11} className="text-blue-600 flex-shrink-0" />}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate">
                            {[c.phone, c.telegram, c.type && `тип: ${c.type}`].filter(Boolean).join(' · ')}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {pickedId && (
                <p className="mt-1 text-[10px] text-blue-700">
                  Выбран контакт. Данные ниже подставлены, можно править.
                </p>
              )}
            </div>
          )}

          <Field label="Имя" required>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иван Петров"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Телефон">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123 45 67" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
            </Field>
            <Field label="Telegram">
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username или t.me/…" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Источник">
              <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none bg-white">
                {SOURCES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="На чём поедет">
              <select value={transport} onChange={(e) => setTransport(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none bg-white">
                {TRANSPORTS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Этап">
              <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none bg-white">
                {FUNNEL_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Комментарий">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Откуда, что хочет, особенности…"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y"
            />
          </Field>
        </div>

        <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-md">Отмена</button>
          <button
            onClick={submit}
            disabled={saving || (mode === 'new' && !fullName.trim()) || (mode === 'existing' && !pickedId)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            <Plus size={12} /> {saving ? 'Сохранение…' : 'Добавить в воронку'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
