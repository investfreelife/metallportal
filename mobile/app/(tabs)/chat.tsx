import { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Linking,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useProfileStore } from '../../stores/profileStore';

const PRIMARY = '#1a56db';

interface Message {
  id: string;
  sender_type: 'client' | 'manager' | 'bot';
  content: string;
  created_at: string;
}

export default function ChatScreen() {
  const { user } = useAuthStore();
  const { profile, loadProfile } = useProfileStore();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => { loadProfile(); }, []);

  // Найти или создать чат для текущего пользователя
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const init = async () => {
      try {
        let { data: chat, error: fetchErr } = await supabase
          .from('chats')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!chat) {
          const { data: newChat, error: insertErr } = await supabase
            .from('chats')
            .insert({
              user_id: user.id,
              customer_name: profile.name || user.email?.split('@')[0] || 'Клиент',
              customer_phone: profile.phone || null,
              status: 'open',
              last_message: 'Начал диалог',
              last_message_at: new Date().toISOString(),
            })
            .select('id')
            .single();
          if (insertErr) console.error('Chat insert error:', insertErr.message);
          chat = newChat;
        }

        if (!chat) { setLoading(false); return; }
        setChatId(chat.id);

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true });

      setMessages(msgs ?? []);
      setLoading(false);

      // Realtime подписка
      const channel = supabase
        .channel(`chat-${chat.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `chat_id=eq.${chat.id}`,
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };
    init();
  }, [user?.id, profile.name]);

  const sendMessage = async () => {
    if (!input.trim() || !chatId || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_type: 'client',
      content: text,
    });

    await supabase.from('chats').update({
      last_message: text,
      last_message_at: new Date().toISOString(),
      unread_count: supabase.rpc as any,
    }).eq('id', chatId);

    await supabase.rpc('increment_unread', { chat_id: chatId });
    setSending(false);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={s.headerAvatar}><Text style={s.headerAvatarText}>М</Text></View>
        <View>
          <Text style={s.headerName}>МеталлПортал</Text>
          <Text style={s.headerSub}>Менеджер отвечает в рабочее время</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {messages.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTitle}>Напишите нам</Text>
            <Text style={s.emptyText}>Спросите про наличие товара, цены,{'\n'}условия доставки — ответим быстро</Text>
            <TouchableOpacity
              style={s.tgBtn}
              onPress={() => Linking.openURL(`https://t.me/${process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ?? ''}`)}
            >
              <Text style={s.tgBtnText}>📱 Также можно написать в Telegram</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={s.msgList}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View style={[
                s.bubble,
                item.sender_type === 'client' ? s.bubbleMe : s.bubbleThem,
              ]}>
                {item.sender_type === 'bot' && (
                  <Text style={s.botLabel}>🤖 Система</Text>
                )}
                <Text style={[
                  s.bubbleText,
                  item.sender_type === 'client' ? s.bubbleTextMe : s.bubbleTextThem,
                ]}>{item.content}</Text>
                <Text style={[
                  s.bubbleTime,
                  item.sender_type === 'client' ? s.bubbleTimeMe : s.bubbleTimeThem,
                ]}>
                  {new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          />
        )}

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Сообщение..."
            placeholderTextColor="#94a3b8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            <Text style={s.sendBtnText}>{sending ? '...' : '➤'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: PRIMARY, paddingHorizontal: 16, paddingVertical: 14 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  tgBtn: { marginTop: 16, backgroundColor: '#229ED9', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14 },
  tgBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  msgList: { padding: 16, gap: 8, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: PRIMARY, borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextThem: { color: '#0f172a' },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  bubbleTimeThem: { color: '#94a3b8' },
  botLabel: { fontSize: 10, color: '#94a3b8', marginBottom: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 8 },
  input: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#cbd5e1' },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
