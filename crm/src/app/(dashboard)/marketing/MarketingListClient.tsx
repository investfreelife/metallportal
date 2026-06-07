'use client';

import { useEffect, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { useRouter } from 'next/navigation';
import { Megaphone, Plus, AlertCircle, X, RefreshCw, Check, Target } from 'lucide-react';
import type { Campaign } from '@/lib/marketing/types';
import StrategyClient from './StrategyClient';
import CompetitorAdsClient from './CompetitorAdsClient';
import OurMarketingClient from './OurMarketingClient';
import FunnelDashboardClient from './FunnelDashboardClient';
import SeedPlanClient from '../seed-plan/SeedPlanClient';

interface Props { tenantName: string | null }


type Tab = 'funnel' | 'ours' | 'competitors' | 'strategy' | 'planner';

export default function MarketingListClient({ tenantName }: Props) {
  const router = useRouter();
  const [, setCampaigns] = useState<Campaign[]>([]);
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // ТЗ-074: первая вкладка теперь «Воронка-дашборд» — главный экран маркетинга.
  const [tab, setTab] = useState<Tab>('funnel');
  const [reloadKey, setReloadKey] = useState(0);

  async function reload() {
    try {
      const j = await safeFetchJson<{ campaigns: Campaign[] }>('/api/recruit/campaigns');
      setCampaigns(j.campaigns ?? []);
      setReloadKey((k) => k + 1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone size={20} className="text-gray-600" />
            Маркетинг{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Каналы → готовые лендинги, посты в ВК и Telegram + насмотренность по конкурентам. Время МСК.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'ours' && (
            <>
              <button onClick={reload} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50">
                <RefreshCw size={12} />
                Обновить
              </button>
              <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700">
                <Plus size={14} />
                Новая кампания
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Топ-табы: Воронка / Наш маркетинг / Конкуренты / Стратегия / Планировщик ── */}
      <div className="flex items-center gap-1 px-6 bg-white border-b border-gray-200 overflow-x-auto">
        <TabBtn active={tab === 'funnel'} onClick={() => setTab('funnel')}>
          🔻 Воронка
        </TabBtn>
        <TabBtn active={tab === 'ours'} onClick={() => setTab('ours')}>
          🚀 Наш маркетинг
        </TabBtn>
        <TabBtn active={tab === 'competitors'} onClick={() => setTab('competitors')}>
          🕵️ Конкуренты
        </TabBtn>
        <TabBtn active={tab === 'strategy'} onClick={() => setTab('strategy')}>
          <Target size={12} />
          Стратегия
        </TabBtn>
        <TabBtn active={tab === 'planner'} onClick={() => setTab('planner')}>
          📅 Планировщик
        </TabBtn>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {tab === 'planner' ? (
        // SeedPlanClient рисует свой full-height layout со своим скроллом —
        // отдаём ему всю область без внешнего padding.
        <div className="flex-1 min-h-0 overflow-hidden">
          <SeedPlanClient />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          {tab === 'funnel' && <FunnelDashboardClient />}
          {tab === 'ours' && <OurMarketingClient key={reloadKey} tenantName={tenantName} />}
          {tab === 'competitors' && <CompetitorAdsClient tenantName={tenantName} />}
          {tab === 'strategy' && <StrategyClient tenantName={tenantName} />}
        </div>
      )}

      {creating && (
        <CreateForm onClose={() => setCreating(false)} onCreated={async (c) => {
          setCreating(false);
          await reload();
          router.push(`/marketing/${c.id}`);
        }} />
      )}
    </div>
  );
}

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Campaign) => void }) {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [audience, setAudience] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setError(null);
    try {
      const j = await safeFetchJson<{ campaign: Campaign }>('/api/recruit/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          objective: objective.trim() || null,
          audience: audience.trim() || null,
          status: 'draft',
        }),
      });
      onCreated(j.campaign);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Новая кампания</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </header>
        <div className="px-4 py-4 space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>}
          <Field label="Название" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="«Найм водителей весна 2026»" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
          </Field>
          <Field label="Цель">
            <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="20 водителей на линию за месяц" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
          </Field>
          <Field label="Аудитория">
            <textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={3} placeholder="Москва и МО, приезжие, кто хочет аренду авто с газом" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y" />
          </Field>
        </div>
        <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-md">Отмена</button>
          <button onClick={submit} disabled={saving || !name.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40">
            <Check size={12} /> {saving ? 'Создание…' : 'Создать'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
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
