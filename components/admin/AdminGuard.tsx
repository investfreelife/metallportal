"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_authed");
    setAuthed(stored === "1");
  }, []);

  const handleLogin = () => {
    // client-side check against a public env or hardcoded value
    // In production, use a proper auth solution
    const correct = "metallportal2024";
    if (pw === correct) {
      sessionStorage.setItem("admin_authed", "1");
      setAuthed(true);
    } else {
      setError("Неверный пароль");
    }
  };

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <div className="bg-[#16213e] rounded-xl p-8 w-full max-w-sm border border-[#E8B86D]/20">
          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-[#E8B86D] mb-1">МП</div>
            <h1 className="text-xl font-bold text-white">Вход в админ-панель</h1>
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Пароль"
            className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg px-4 py-3 text-white outline-none focus:border-[#E8B86D] mb-3"
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-all"
          >
            Войти
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
