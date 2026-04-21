"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Chat {
  id: string;
  customer_name: string;
  telegram_username: string;
  last_message: string;
  last_message_at: string;
  status: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_type: "client" | "manager" | "bot";
  content: string;
  created_at: string;
}

export default function AdminChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load chats
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("chats")
        .select("*")
        .order("last_message_at", { ascending: false });
      setChats(data ?? []);
    };
    load();
    const channel = supabase
      .channel("chats-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Load messages for active chat
  useEffect(() => {
    if (!activeChat) return;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", activeChat.id)
        .order("created_at", { ascending: true });
      setMessages(data ?? []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    load();
    const channel = supabase
      .channel(`messages-${activeChat.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${activeChat.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChat]);

  const sendMessage = async () => {
    if (!input.trim() || !activeChat) return;
    setSending(true);
    await fetch("/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: activeChat.id, message: input.trim() }),
    });
    setInput("");
    setSending(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-900">💬 Чаты</h1>
          <p className="text-xs text-gray-500 mt-1">{chats.length} диалогов</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={`w-full text-left p-4 border-b hover:bg-blue-50 transition-colors ${activeChat?.id === chat.id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900 truncate">
                  {chat.customer_name || "@" + chat.telegram_username || "Клиент"}
                </span>
                {chat.unread_count > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-1 flex-shrink-0">
                    {chat.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{chat.last_message}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(chat.last_message_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      {activeChat ? (
        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
              {(activeChat.customer_name || "K")[0].toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{activeChat.customer_name || "Клиент"}</div>
              {activeChat.telegram_username && (
                <div className="text-sm text-gray-500">@{activeChat.telegram_username}</div>
              )}
            </div>
            <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${activeChat.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {activeChat.status === "open" ? "Открыт" : "Закрыт"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_type === "manager" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                  m.sender_type === "manager"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white border text-gray-900 rounded-bl-sm shadow-sm"
                }`}>
                  {m.content}
                  <div className={`text-xs mt-1 ${m.sender_type === "manager" ? "text-blue-200" : "text-gray-400"}`}>
                    {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="bg-white border-t p-4 flex gap-3">
            <input
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Написать сообщение..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              {sending ? "..." : "Отправить"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-lg font-medium">Выберите диалог</p>
            <p className="text-sm mt-1">Все входящие сообщения из Telegram появятся здесь</p>
          </div>
        </div>
      )}
    </div>
  );
}
