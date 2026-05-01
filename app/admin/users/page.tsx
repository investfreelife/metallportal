"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Send, ShieldCheck, Brush, Briefcase, Loader2 } from "lucide-react";

interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "designer" | "manager";
  telegram_chat_id: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
}

const ROLE_LABELS: Record<string, { label: string; icon: React.ComponentType<{ size?: number }>; color: string; help: string }> = {
  admin:    { label: "Администратор", icon: ShieldCheck, color: "text-[#E8B86D]", help: "Полный доступ ко всем разделам админки" },
  designer: { label: "Дизайнер",      icon: Brush,        color: "text-blue-400",  help: "Только загрузка и изменение фото в каталоге" },
  manager:  { label: "Менеджер",      icon: Briefcase,    color: "text-green-400", help: "Чаты + заявки + базовый каталог" },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ email: "", full_name: "", role: "designer" as AdminUser["role"] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    setUsers(res.ok ? await res.json() : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!invite.email.trim() || !invite.email.includes("@")) {
      setError("Укажите email"); return;
    }
    setSubmitting(true); setError("");
    const res = await fetch("/api/admin/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Ошибка"); return; }
    setShowInvite(false);
    setInvite({ email: "", full_name: "", role: "designer" });
    load();
  };

  const changeRole = async (u: AdminUser, newRole: AdminUser["role"]) => {
    if (u.role === newRole) return;
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    load();
  };

  const deleteUser = async (u: AdminUser) => {
    if (!confirm(`Удалить ${u.email ?? u.full_name ?? "пользователя"}?`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Ошибка: ${data.error ?? res.status}`);
      return;
    }
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Пользователи</h1>
          <p className="text-white/40 text-sm mt-0.5">Доступ через Supabase Auth — приглашения по email</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold text-sm"
        >
          <Plus size={14} /> Пригласить
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {Object.entries(ROLE_LABELS).map(([role, { label, icon: Icon, color, help }]) => (
          <div key={role} className="bg-[#16213e] rounded-xl p-4 border border-white/5">
            <div className={`flex items-center gap-2 font-semibold text-sm mb-1 ${color}`}>
              <Icon size={14} /> {label}
            </div>
            <p className="text-white/40 text-xs">{help}</p>
          </div>
        ))}
      </div>

      {showInvite && (
        <div className="bg-[#16213e] rounded-xl p-6 border border-[#E8B86D]/30 mb-6">
          <h3 className="text-white font-bold mb-4">Пригласить нового пользователя</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Email *</label>
              <input
                type="email"
                value={invite.email}
                onChange={e => setInvite(s => ({ ...s, email: e.target.value }))}
                placeholder="user@example.com"
                className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Имя</label>
              <input
                value={invite.full_name}
                onChange={e => setInvite(s => ({ ...s, full_name: e.target.value }))}
                placeholder="Иван Иванов"
                className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Роль</label>
              <select
                value={invite.role}
                onChange={e => setInvite(s => ({ ...s, role: e.target.value as AdminUser["role"] }))}
                className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]"
              >
                {Object.entries(ROLE_LABELS).map(([role, { label }]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="flex gap-3">
            <button onClick={sendInvite} disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 bg-[#E8B86D] text-black text-sm font-bold rounded-lg disabled:opacity-60">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? "Отправка..." : "Отправить приглашение"}
            </button>
            <button onClick={() => { setShowInvite(false); setError(""); }} className="px-4 py-2 text-white/40 text-sm hover:text-white">
              Отмена
            </button>
          </div>
          <p className="text-xs text-white/30 mt-3">
            Пользователь получит письмо со ссылкой для установки пароля. После регистрации сможет войти на /admin.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-center py-10">Загрузка...</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const roleInfo = ROLE_LABELS[u.role];
            const RoleIcon = roleInfo?.icon ?? ShieldCheck;
            return (
              <div key={u.id} className="flex items-center gap-4 p-4 rounded-xl border bg-[#16213e] border-white/10">
                <div className="w-10 h-10 rounded-full bg-[#E8B86D]/10 flex items-center justify-center text-[#E8B86D] font-bold text-sm flex-shrink-0">
                  {(u.full_name || u.email || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{u.full_name ?? "(без имени)"}</span>
                    <span className={`flex items-center gap-1 text-xs ${roleInfo?.color}`}>
                      <RoleIcon size={10} /> {roleInfo?.label}
                    </span>
                    {!u.email_confirmed && (
                      <span className="text-xs text-yellow-400/80">приглашение не принято</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40 flex-wrap">
                    <span className="font-mono">{u.email}</span>
                    {u.last_sign_in_at && (
                      <span>посл. вход {new Date(u.last_sign_in_at).toLocaleDateString("ru")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={u.role}
                    onChange={e => changeRole(u, e.target.value as AdminUser["role"])}
                    className="bg-[#0d0d1a] border border-white/20 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#E8B86D]"
                  >
                    {Object.entries(ROLE_LABELS).map(([role, { label }]) => (
                      <option key={role} value={role}>{label}</option>
                    ))}
                  </select>
                  <button onClick={() => deleteUser(u)} className="p-1.5 text-white/20 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {!users.length && (
            <div className="text-white/30 text-center py-10 text-sm">
              Нет пользователей. Нажмите «Пригласить» чтобы добавить первого.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
