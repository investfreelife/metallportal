'use client';

import { useEffect, useMemo, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  Car as CarIcon,
  Plus,
  Phone,
  MapPin,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  X,
  AlertCircle,
  Fuel,
  Building2,
  Check,
  Banknote,
} from 'lucide-react';
import { fmtMsk } from '@/lib/tz';

interface CarRow {
  model?: string;
  fuel?: string;
  day?: number | null;
}

interface CarPartner {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  purpose: string | null;
  cars: CarRow[] | null;
  status: string | null;
  note: string | null;
  created_at: string;
}

interface Props {
  tenantName: string | null;
}

const STATUS_OPTIONS: { key: string; label: string; color: string; rank: number }[] = [
  { key: 'active',   label: 'Подходит',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', rank: 0 },
  { key: 'checking', label: 'Проверяем', color: 'bg-amber-100 text-amber-800 border-amber-200',       rank: 1 },
  { key: 'rejected', label: 'Отказ',     color: 'bg-red-50 text-red-600 border-red-200',              rank: 2 },
];

function statusMeta(s: string | null) {
  return STATUS_OPTIONS.find((x) => x.key === (s ?? '')) ?? STATUS_OPTIONS[1];
}


function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${Math.round(v).toLocaleString('ru-RU')} ₽`;
}

export default function CarPartnersClient({ tenantName }: Props) {
  const [partners, setPartners] = useState<CarPartner[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CarPartner | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const j = await safeFetchJson<{ partners: CarPartner[] }>('/api/recruit/car-partners');
      setPartners(j.partners ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  // Сортировка: status='active' сверху, затем по created_at DESC.
  const sorted = useMemo(() => {
    return [...partners].sort((a, b) => {
      const ra = statusMeta(a.status).rank;
      const rb = statusMeta(b.status).rank;
      if (ra !== rb) return ra - rb;
      return (a.created_at < b.created_at ? 1 : -1);
    });
  }, [partners]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) =>
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').toLowerCase().includes(q) ||
      (p.address ?? '').toLowerCase().includes(q) ||
      (p.cars ?? []).some((c) => (c.model ?? '').toLowerCase().includes(q))
    );
  }, [sorted, search]);

  // Итоги
  const totals = useMemo(() => {
    const carsCount = partners.reduce((s, p) => s + (p.cars?.length ?? 0), 0);
    const allPrices = partners
      .flatMap((p) => (p.cars ?? []).map((c) => c.day))
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
    const min = allPrices.length ? Math.min(...allPrices) : null;
    const max = allPrices.length ? Math.max(...allPrices) : null;
    const active = partners.filter((p) => p.status === 'active').length;
    return { count: partners.length, active, carsCount, min, max };
  }, [partners]);

  async function remove(p: CarPartner) {
    if (!confirm(`Удалить таксопарк «${p.name}»?`)) return;
    try {
      await safeFetchJson(`/api/recruit/car-partners/${p.id}`, { method: 'DELETE' });
      await reload(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={20} className="text-gray-600" />
            Таксопарки{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Источники авто для наших водителей — у каких таксопарков берём машины, по каким ценам.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => reload()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Обновить
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700"
          >
            <Plus size={14} />
            Добавить таксопарк
          </button>
        </div>
      </header>

      {/* ── Итоги ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4 bg-white border-b border-gray-100">
        <TotalCard label="Таксопарков" value={totals.count} hint={`${totals.active} подходит`} />
        <TotalCard label="Машин всего" value={totals.carsCount} hint={`из ${totals.count} парков`} />
        <TotalCard
          label="Цена/сутки"
          value={totals.min && totals.max ? (totals.min === totals.max ? fmtMoney(totals.min) : `${fmtMoney(totals.min)} — ${fmtMoney(totals.max)}`) : '—'}
          hint="диапазон по всем"
        />
        <TotalCard
          label="Средняя"
          value={(() => {
            const prices = partners.flatMap((p) => (p.cars ?? []).map((c) => c.day)).filter((v): v is number => typeof v === 'number' && v > 0);
            if (!prices.length) return '—';
            return fmtMoney(Math.round(prices.reduce((s, v) => s + v, 0) / prices.length));
          })()}
          hint="среднее по машинам"
        />
      </div>

      {/* ── Поиск ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100">
        <div className="relative w-80">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию / телефону / адресу / модели…"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
          />
        </div>
        {search && (
          <span className="text-[11px] text-gray-500">Найдено: {filtered.length}</span>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : filtered.length === 0 ? (
          <EmptyState hasSearch={!!search.trim()} hasItems={partners.length > 0} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-7xl">
            {filtered.map((p) => (
              <PartnerCard
                key={p.id}
                partner={p}
                onEdit={() => setEditing(p)}
                onDelete={() => remove(p)}
              />
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <PartnerForm
          partner={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(true); }}
        />
      )}
    </div>
  );
}

function TotalCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function PartnerCard({
  partner: p,
  onEdit,
  onDelete,
}: {
  partner: CarPartner;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = statusMeta(p.status);
  const cars = p.cars ?? [];
  const phoneLink = p.phone ? p.phone.replace(/[^\d+]/g, '') : '';

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all">
      <header className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <CarIcon size={18} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 break-words">{p.name}</div>
            <div className="text-[10px] text-gray-400">{fmtMsk(p.created_at, false)} МСК</div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${meta.color}`}>
            {meta.label}
          </span>
          <button onClick={onEdit} className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Редактировать">
            <Edit3 size={12} />
          </button>
          <button onClick={onDelete} className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Удалить">
            <Trash2 size={12} />
          </button>
        </div>
      </header>

      <div className="px-4 py-3 space-y-1.5 text-xs">
        {p.phone && (
          <div className="flex items-center gap-1.5 text-gray-700">
            <Phone size={11} className="text-gray-400 flex-shrink-0" />
            <a href={`tel:${phoneLink}`} className="text-blue-600 hover:underline">{p.phone}</a>
          </div>
        )}
        {p.address && (
          <div className="flex items-start gap-1.5 text-gray-700">
            <MapPin size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="break-words">{p.address}</span>
          </div>
        )}
        {p.note && (
          <div className="text-gray-500 text-[11px] italic break-words mt-1">{p.note}</div>
        )}
      </div>

      {cars.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <div className="px-4 py-2 text-[10px] font-semibold text-gray-600 uppercase tracking-wide flex items-center justify-between">
            <span>Машины ({cars.length})</span>
            <span>Цена/сутки</span>
          </div>
          <div className="px-2 pb-2">
            <table className="w-full text-xs">
              <tbody>
                {cars.map((c, i) => (
                  <tr key={i} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-2 py-1.5 text-gray-900">{c.model || '—'}</td>
                    <td className="px-2 py-1.5 w-20">
                      {c.fuel && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-600">
                          <Fuel size={9} />
                          {c.fuel}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right w-24 font-medium text-gray-900">
                      {fmtMoney(c.day ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cars.length === 0 && (
        <div className="px-4 py-2 text-[11px] text-gray-400 italic border-t border-gray-100">
          Машины не указаны
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasSearch, hasItems }: { hasSearch: boolean; hasItems: boolean }) {
  if (hasSearch && hasItems) {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <Search size={36} className="text-gray-300 mx-auto mb-3" />
        <h2 className="text-sm font-medium text-gray-700">Не найдено</h2>
        <p className="text-xs text-gray-500 mt-2">Поменяй запрос или сбрось фильтр.</p>
      </div>
    );
  }
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <Building2 size={36} className="text-gray-300 mx-auto mb-3" />
      <h2 className="text-sm font-medium text-gray-700">Таксопарков пока нет</h2>
      <p className="text-xs text-gray-500 mt-2">
        Добавь первый источник авто кнопкой «+ Добавить таксопарк». Сюда будут попадать парки,
        у которых берём машины для наших водителей.
      </p>
    </div>
  );
}

// ─── Form (create / edit) ─────────────────────────────────────────────
function PartnerForm({
  partner,
  onClose,
  onSaved,
}: {
  partner: CarPartner | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(partner?.name ?? '');
  const [phone, setPhone] = useState(partner?.phone ?? '');
  const [address, setAddress] = useState(partner?.address ?? '');
  const [status, setStatus] = useState<string>(partner?.status ?? 'checking');
  const [note, setNote] = useState(partner?.note ?? '');
  const [cars, setCars] = useState<CarRow[]>(
    partner?.cars && Array.isArray(partner.cars) ? partner.cars : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCar(i: number, patch: Partial<CarRow>) {
    setCars((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addCarRow() {
    setCars((prev) => [...prev, { model: '', fuel: 'газ', day: undefined }]);
  }
  function removeCarRow(i: number) {
    setCars((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        status,
        note: note.trim() || null,
        cars: cars
          .map((c) => ({
            model: c.model?.trim() || '',
            fuel: c.fuel?.trim() || '',
            day: typeof c.day === 'number' && Number.isFinite(c.day) ? c.day : null,
          }))
          .filter((c) => c.model),
      };
      if (partner) {
        await safeFetchJson(`/api/recruit/car-partners/${partner.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await safeFetchJson('/api/recruit/car-partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {partner ? 'Изменить таксопарк' : 'Новый таксопарк'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </header>

        <div className="px-4 py-4 space-y-3 overflow-y-auto">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 flex items-start gap-2">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <Field label="Название" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="«По Две Авеню Групп (таксопарк)»"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Телефон">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="8 991 779 10 75"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
              />
            </Field>
            <Field label="Статус">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none bg-white"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Адрес">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="м. Пражская, Ступинский проезд д.8"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </Field>

          <Field label="Заметка">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Условия аренды, контактное лицо, особенности…"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y"
            />
          </Field>

          {/* ── Машины ─────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                Машины ({cars.length})
              </label>
              <button
                type="button"
                onClick={addCarRow}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Plus size={11} />
                Добавить машину
              </button>
            </div>
            {cars.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded">
                Машины ещё не добавлены
              </p>
            ) : (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="grid grid-cols-[1fr_120px_120px_24px] gap-1 px-2 py-1 bg-gray-50 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                  <div>Модель</div>
                  <div>Топливо</div>
                  <div className="text-right">Цена/сутки ₽</div>
                  <div />
                </div>
                {cars.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_120px_24px] gap-1 px-2 py-1 border-t border-gray-100 items-center">
                    <input
                      value={c.model ?? ''}
                      onChange={(e) => setCar(i, { model: e.target.value })}
                      placeholder="Renault Logan"
                      className="px-2 py-1 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
                    />
                    <select
                      value={c.fuel ?? ''}
                      onChange={(e) => setCar(i, { fuel: e.target.value })}
                      className="px-2 py-1 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none bg-white"
                    >
                      <option value="газ">газ</option>
                      <option value="бензин">бензин</option>
                      <option value="дизель">дизель</option>
                      <option value="электро">электро</option>
                      <option value="">—</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={c.day ?? ''}
                      onChange={(e) => setCar(i, { day: e.target.value === '' ? undefined : Number(e.target.value) })}
                      placeholder="2000"
                      className="px-2 py-1 text-xs text-right border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeCarRow(i)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Убрать машину"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-md">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            <Check size={12} />
            {saving ? 'Сохранение…' : partner ? 'Сохранить' : 'Создать'}
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
