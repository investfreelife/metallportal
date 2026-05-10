"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, Plus, Save, X, Pause, Play, ExternalLink } from "lucide-react";

interface Offer {
  id: string;
  product_id: string;
  base_price: number;
  final_price: number;
  currency: string;
  unit: string | null;
  in_stock: boolean;
  stock_quantity: number | null;
  min_quantity: number;
  lead_time_days: number | null;
  is_active: boolean;
  is_buy_box: boolean;
  product: { id: string; name: string; slug: string } | null;
}

interface Props {
  supplier: { id: string; company_name: string };
  initialOffers: Offer[];
}

export default function SupplierDashboardClient({ supplier, initialOffers }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"offers" | "catalog">("offers");
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Offer>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Catalog browse
  const [search, setSearch] = useState("");
  const [browseResults, setBrowseResults] = useState<any[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  function startEdit(o: Offer) {
    setEditing(o.id);
    setEditForm({
      final_price: o.final_price,
      stock_quantity: o.stock_quantity ?? undefined,
      lead_time_days: o.lead_time_days ?? undefined,
      in_stock: o.in_stock,
      is_active: o.is_active,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setEditForm({});
    setError(null);
  }

  async function saveEdit(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/supplier/offers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Ошибка сохранения");
        return;
      }
      const { offer } = await res.json();
      setOffers((curr) =>
        curr.map((o) => (o.id === id ? { ...o, ...offer } : o)),
      );
      setEditing(null);
      setEditForm({});
      router.refresh();
    });
  }

  async function togglePause(o: Offer) {
    setError(null);
    const newActive = !o.is_active;
    const res = await fetch(`/api/supplier/offers/${o.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: newActive }),
    });
    if (!res.ok) {
      setError("Ошибка обновления");
      return;
    }
    const { offer } = await res.json();
    setOffers((curr) => curr.map((x) => (x.id === o.id ? { ...x, ...offer } : x)));
    router.refresh();
  }

  async function searchCatalog() {
    if (!search.trim()) return;
    setBrowseLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/supplier/catalog/search?q=${encodeURIComponent(search.trim())}`);
      if (!res.ok) throw new Error("search failed");
      const { products } = await res.json();
      setBrowseResults(products);
    } catch (e: any) {
      setError("Поиск не удался");
    } finally {
      setBrowseLoading(false);
    }
  }

  async function activateProduct(product: any) {
    setError(null);
    const priceStr = window.prompt(
      `Установите цену для «${product.name}» (${product.unit || "т"}):`,
      "0",
    );
    if (!priceStr) return;
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
      setError("Некорректная цена");
      return;
    }
    const res = await fetch(`/api/supplier/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: product.id,
        final_price: price,
        unit: product.unit,
        in_stock: true,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Ошибка активации");
      return;
    }
    const { offer } = await res.json();
    setOffers((curr) => [{ ...offer, product }, ...curr]);
    setBrowseResults((curr) => curr.filter((p) => p.id !== product.id));
    setTab("offers");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { id: "offers", label: `Мои офферы (${offers.length})` },
          { id: "catalog", label: "Каталог + активировать" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-gold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-500 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* MY OFFERS TAB */}
      {tab === "offers" && (
        <section className="space-y-3">
          {offers.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center">
              У вас пока нет активных офферов. Перейдите во вкладку «Каталог» чтобы активировать SKU.
            </p>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Продукт</th>
                    <th className="text-right px-3 py-2 font-semibold">Цена</th>
                    <th className="text-right px-3 py-2 font-semibold">Остаток</th>
                    <th className="text-right px-3 py-2 font-semibold">Срок (дн)</th>
                    <th className="text-center px-3 py-2 font-semibold">Статус</th>
                    <th className="text-center px-3 py-2 font-semibold">Buy Box</th>
                    <th className="text-right px-3 py-2 font-semibold">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        {o.product ? (
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-muted-foreground flex-shrink-0" />
                            <span className="truncate max-w-md">{o.product.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">[удалён]</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing === o.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.final_price ?? 0}
                            onChange={(e) => setEditForm({ ...editForm, final_price: parseFloat(e.target.value) })}
                            className="w-28 bg-background border border-border rounded px-2 py-1 text-right"
                          />
                        ) : (
                          <span className="font-semibold">
                            {Number(o.final_price).toLocaleString("ru-RU")} ₽/{o.unit || "т"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing === o.id ? (
                          <input
                            type="number"
                            value={editForm.stock_quantity ?? 0}
                            onChange={(e) => setEditForm({ ...editForm, stock_quantity: parseFloat(e.target.value) || 0 })}
                            className="w-20 bg-background border border-border rounded px-2 py-1 text-right"
                          />
                        ) : (
                          <span className={o.in_stock ? "" : "text-muted-foreground"}>
                            {o.stock_quantity ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing === o.id ? (
                          <input
                            type="number"
                            value={editForm.lead_time_days ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, lead_time_days: parseInt(e.target.value) || null as any })}
                            className="w-16 bg-background border border-border rounded px-2 py-1 text-right"
                          />
                        ) : (
                          o.lead_time_days ?? "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {o.is_active ? (
                          o.in_stock ? (
                            <span className="text-emerald-500 text-xs">● в наличии</span>
                          ) : (
                            <span className="text-amber-500 text-xs">○ нет</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">⏸ пауза</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {o.is_buy_box && <span className="text-gold text-base">★</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing === o.id ? (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => saveEdit(o.id)} disabled={pending} className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded" title="Сохранить">
                              <Save size={14} />
                            </button>
                            <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted/30 rounded" title="Отмена">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => startEdit(o)} className="text-xs text-gold hover:underline" title="Редактировать">
                              ✎
                            </button>
                            <button onClick={() => togglePause(o)} className="p-1 text-muted-foreground hover:text-foreground rounded" title={o.is_active ? "На паузу" : "Возобновить"}>
                              {o.is_active ? <Pause size={12} /> : <Play size={12} />}
                            </button>
                            {o.product && (
                              <a href={`/catalog/${o.product.slug}`} target="_blank" rel="noopener noreferrer" className="p-1 text-muted-foreground hover:text-gold rounded" title="Посмотреть в каталоге">
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* CATALOG TAB */}
      {tab === "catalog" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Найдите SKU в общем каталоге → активируйте → установите цену.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchCatalog()}
                placeholder="Например: «Арматура 12 А3» или «Лист г/к 4х1500»"
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg focus:border-gold/60 focus:outline-none"
              />
            </div>
            <button
              onClick={searchCatalog}
              disabled={browseLoading || !search.trim()}
              className="bg-gold hover:bg-yellow-400 disabled:bg-muted disabled:text-muted-foreground text-black font-bold px-5 rounded-lg transition-all"
            >
              {browseLoading ? "..." : "Найти"}
            </button>
          </div>

          {browseResults.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Продукт</th>
                    <th className="text-left px-3 py-2 font-semibold">Категория</th>
                    <th className="text-right px-3 py-2 font-semibold">Уже активно</th>
                    <th className="text-right px-3 py-2 font-semibold">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {browseResults.map((p: any) => {
                    const alreadyOffered = offers.some((o) => o.product_id === p.id);
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{p.name}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{p.category_name || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {alreadyOffered ? <span className="text-emerald-500 text-xs">✓ ваш оффер</span> : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {alreadyOffered ? (
                            <span className="text-muted-foreground text-xs">в офферах</span>
                          ) : (
                            <button
                              onClick={() => activateProduct(p)}
                              className="inline-flex items-center gap-1 text-gold text-xs font-semibold hover:underline"
                            >
                              <Plus size={12} />
                              Активировать
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
