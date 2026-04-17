"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { User, Lock, LogOut, Package, ChevronRight, Building2, CheckCircle } from "lucide-react";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AccountPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.href = "/account/login"; return; }
      setUser(data.session.user);
      setLoading(false);
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setPwdMsg("Минимум 6 символов"); return; }
    setPwdLoading(true); setPwdMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwdLoading(false);
    if (error) setPwdMsg("Ошибка: " + error.message);
    else { setPwdMsg("Пароль успешно изменён!"); setNewPassword(""); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Загрузка...</div>
      </div>
    );
  }

  const joinedAt = user?.created_at ? new Date(user.created_at).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container-main h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gold rounded" />
            <span className="font-bold text-foreground">МЕТАЛЛПОРТАЛ</span>
          </Link>
          <button onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <LogOut size={14} />
            Выйти
          </button>
        </div>
      </div>

      <div className="container-main py-10 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
            <User size={22} className="text-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Личный кабинет</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Profile card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <User size={16} className="text-gold" />
              <h2 className="font-semibold text-foreground">Профиль</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-foreground font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email подтверждён</span>
                <span className={user?.email_confirmed_at ? "text-green-500 flex items-center gap-1" : "text-yellow-500"}>
                  {user?.email_confirmed_at ? <><CheckCircle size={13} /> Да</> : "Нет"}
                </span>
              </div>
              {joinedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Дата регистрации</span>
                  <span className="text-foreground">{joinedAt}</span>
                </div>
              )}
            </div>
          </div>

          {/* Change password */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock size={16} className="text-gold" />
              <h2 className="font-semibold text-foreground">Изменить пароль</h2>
            </div>
            <form onSubmit={handleChangePassword} className="flex gap-3">
              <input
                type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Новый пароль (мин. 6 символов)"
                className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors"
              />
              <button type="submit" disabled={pwdLoading || !newPassword}
                className="px-4 py-2 bg-gold hover:bg-yellow-400 disabled:opacity-40 text-black text-sm font-semibold rounded-lg transition-all">
                {pwdLoading ? "..." : "Сохранить"}
              </button>
            </form>
            {pwdMsg && (
              <p className={`text-xs mt-2 ${pwdMsg.startsWith("Ошибка") ? "text-red-400" : "text-green-400"}`}>{pwdMsg}</p>
            )}
          </div>

          {/* Catalog link */}
          <Link href="/catalog" className="flex items-center gap-3 bg-card border border-border rounded-xl p-5 hover:border-gold transition-colors group">
            <Package size={20} className="text-gold" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Каталог металлопроката</p>
              <p className="text-xs text-muted-foreground mt-0.5">Арматура, трубы, листы и профиль</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground group-hover:text-gold transition-colors" />
          </Link>

          {/* Sign out */}
          <button onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
            <LogOut size={15} />
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
