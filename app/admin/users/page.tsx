"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Plus, Trash2, RefreshCw, Copy, Check, ShieldCheck, Brush } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AdminUser {
  id: string;
  name: string;
  login: string;
  password: string;
  role: "admin" | "designer";
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  admin: { label: "Администратор", icon: ShieldCheck, color: "text-[#E8B86D]" },
  designer: { label: "Дизайнер (фото)", icon: Brush, color: "text-blue-400" },
};

function genPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: "", login: "", password: genPassword(), role: "designer" as "admin" | "designer" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_users").select("*").order("created_at");
    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const copyCredentials = (u: AdminUser) => {
    const text = `Логин: ${u.login}\nПароль: ${u.password}\nСайт: ${window.location.origin}/admin`;
    navigator.clipboard.writeText(text);
    setCopied(u.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleActive = async (u: AdminUser) => {
    await supabase.from("admin_users").update({ is_active: !u.is_active }).eq("id", u.id);
    load();
  };

  const deleteUser = async (u: AdminUser) => {
    if (u.login === "admin") return;
    if (!confirm(`Удалить пользователя ${u.name}?`)) return;
    await supabase.from("admin_users").delete().eq("id", u.id);
    load();
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.login || !newUser.password) return;
    setSaving(true);
    const { error } = await supabase.from("admin_users").insert({
      name: newUser.name,
      login: newUser.login.trim().toLowerCase(),
      password: newUser.password,
      role: newUser.role,
      is_active: true,
    });
    if (error) { alert("Ошибка: " + error.message); setSaving(false); return; }
    setShowAdd(false);
    setNewUser({ name: "", login: "", password: genPassword(), role: "designer" });
    setSaving(false);
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Пользователи</h1>
          <p className="text-white/40 text-sm mt-0.5">Управление доступом в админ-панель</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold text-sm"
        >
          <Plus size={14} /> Пригласить
        </button>
      </div>

      {/* Roles reference */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {Object.entries(ROLE_LABELS).map(([role, { label, icon: Icon, color }]) => (
          <div key={role} className="bg-[#16213e] rounded-xl p-4 border border-white/5">
            <div className={`flex items-center gap-2 font-semibold text-sm mb-1 ${color}`}>
              <Icon size={14} /> {label}
            </div>
            <p className="text-white/40 text-xs">
              {role === "admin" ? "Полный доступ ко всем разделам админки" : "Только загрузка и изменение фото в разделах каталога"}
            </p>
          </div>
        ))}
      </div>

      {/* Add user form */}
      {showAdd && (
        <div className="bg-[#16213e] rounded-xl p-6 border border-[#E8B86D]/30 mb-6">
          <h3 className="text-white font-bold mb-4">Новый пользователь</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Имя</label>
              <input
                value={newUser.name}
                onChange={e => setNewUser(s => ({ ...s, name: e.target.value }))}
                placeholder="Иван Иванов"
                className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Логин</label>
              <input
                value={newUser.login}
                onChange={e => setNewUser(s => ({ ...s, login: e.target.value }))}
                placeholder="ivan"
                className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Пароль</label>
              <div className="flex gap-2">
                <input
                  value={newUser.password}
                  onChange={e => setNewUser(s => ({ ...s, password: e.target.value }))}
                  className="flex-1 bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D] font-mono"
                />
                <button
                  onClick={() => setNewUser(s => ({ ...s, password: genPassword() }))}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-white/60 hover:text-white text-xs border border-white/10"
                  title="Сгенерировать"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Роль</label>
              <select
                value={newUser.role}
                onChange={e => setNewUser(s => ({ ...s, role: e.target.value as any }))}
                className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]"
              >
                <option value="designer">Дизайнер (только фото)</option>
                <option value="admin">Администратор (полный доступ)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createUser} disabled={saving}
              className="px-5 py-2 bg-[#E8B86D] text-black text-sm font-bold rounded-lg disabled:opacity-60">
              {saving ? "Создание..." : "Создать и выдать доступ"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-white/40 text-sm hover:text-white">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <div className="text-white/40 text-center py-10">Загрузка...</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const roleInfo = ROLE_LABELS[u.role];
            const RoleIcon = roleInfo.icon;
            return (
              <div key={u.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                u.is_active ? "bg-[#16213e] border-white/10" : "bg-[#16213e]/40 border-white/5 opacity-50"
              }`}>
                <div className="w-10 h-10 rounded-full bg-[#E8B86D]/10 flex items-center justify-center text-[#E8B86D] font-bold text-sm flex-shrink-0">
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{u.name}</span>
                    <span className={`flex items-center gap-1 text-xs ${roleInfo.color}`}>
                      <RoleIcon size={10} /> {roleInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-white/40 text-xs font-mono">логин: {u.login}</span>
                    <span className="text-white/40 text-xs font-mono">пароль: {u.password}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => copyCredentials(u)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[#E8B86D]/20 text-white/60 hover:text-[#E8B86D] text-xs transition-all"
                    title="Скопировать данные для отправки"
                  >
                    {copied === u.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied === u.id ? "Скопировано" : "Копировать"}
                  </button>
                  <button
                    onClick={() => toggleActive(u)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      u.is_active ? "bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400" : "bg-white/5 text-white/30 hover:bg-green-500/10 hover:text-green-400"
                    }`}
                  >
                    {u.is_active ? "Активен" : "Отключён"}
                  </button>
                  {u.login !== "admin" && (
                    <button onClick={() => deleteUser(u)} className="p-1.5 text-white/20 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
