import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  BotMessageSquare,
  Check,
  Clock,
  History,
  MessageSquarePlus,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { apiRequest } from '../lib/api.ts';
import type { AiConversation, AiMessage } from '../types.ts';

interface MansurAiViewProps {
  displayName: string;
}

interface ConversationsResponse {
  conversations: AiConversation[];
  storageAvailable: boolean;
}

interface MessagesResponse {
  messages: AiMessage[];
  storageAvailable: boolean;
  found: boolean;
}

interface ChatResponse {
  conversation: AiConversation | null;
  conversationId: string | null;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
  persisted: boolean;
  storageAvailable: boolean;
}

const STARTER_QUESTIONS: string[] = [
  'Kenapa saya sering loss saat trading?',
  'Bagaimana cara mengontrol emosi ketika mengalami kerugian?',
  'Apa itu liquidity?',
  'Apa perbedaan BOS dan CHOCH?',
  'Bagaimana cara menentukan risk reward?',
  'Saya takut entry setelah mengalami loss, bagaimana mengatasinya?',
  'Bagaimana cara membuat trading plan yang baik?',
  'Apa yang harus saya pelajari sebagai trader pemula?',
];

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderInlineFormatted(text: string): Array<string | ReactNode> {
  const segments: Array<string | ReactNode> = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      segments.push(
        <strong key={`b-${keyIdx++}`} className="font-semibold text-[#1A2421]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      segments.push(
        <code
          key={`c-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded-md bg-[#1A2421]/6 text-[#0D7A72] font-mono text-[12.5px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }
  return segments;
}

function FormattedAiMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let orderedBuffer: string[] = [];
  let blockKey = 0;

  const flushLists = () => {
    if (bulletBuffer.length > 0) {
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="space-y-1.5 pl-4 list-disc marker:text-[#0D7A72]">
          {bulletBuffer.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatted(item)}
            </li>
          ))}
        </ul>
      );
      bulletBuffer = [];
    }
    if (orderedBuffer.length > 0) {
      blocks.push(
        <ol
          key={`ol-${blockKey++}`}
          className="space-y-1.5 pl-5 list-decimal marker:text-[#0D7A72] marker:font-semibold"
        >
          {orderedBuffer.map((item, idx) => (
            <li key={idx} className="leading-relaxed pl-0.5">
              {renderInlineFormatted(item)}
            </li>
          ))}
        </ol>
      );
      orderedBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushLists();
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flushLists();
      blocks.push(
        <h4
          key={`h-${blockKey++}`}
          className="text-[13.5px] sm:text-sm font-bold text-[#1A2421] pt-1"
        >
          {renderInlineFormatted(headingMatch[1])}
        </h4>
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (orderedBuffer.length > 0) flushLists();
      bulletBuffer.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      if (bulletBuffer.length > 0) flushLists();
      orderedBuffer.push(orderedMatch[1]);
      continue;
    }

    flushLists();
    blocks.push(
      <p key={`p-${blockKey++}`} className="leading-relaxed">
        {renderInlineFormatted(trimmed)}
      </p>
    );
  }

  flushLists();

  return <div className="space-y-2 text-[13.5px] sm:text-sm text-[#263430]">{blocks}</div>;
}

export function MansurAiView({ displayName }: MansurAiViewProps) {
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedPrompt, setFailedPrompt] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const data = await apiRequest<ConversationsResponse>('/api/mansur-ai/conversations');
      setConversations(data.conversations || []);
      setStorageAvailable(data.storageAvailable !== false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memuat riwayat percakapan MANSUR AI.');
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, sending, scrollToBottom]);

  const handleSelectConversation = async (conversationId: string) => {
    if (sending) return;
    setActiveConversationId(conversationId);
    setErrorMessage('');
    setFailedPrompt('');
    setMobileHistoryOpen(false);
    setLoadingMessages(true);
    try {
      const data = await apiRequest<MessagesResponse>(
        `/api/mansur-ai/conversations/${encodeURIComponent(conversationId)}/messages`
      );
      setMessages(data.messages || []);
      setStorageAvailable(data.storageAvailable !== false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memuat pesan percakapan.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleNewConversation = () => {
    if (sending) return;
    setActiveConversationId(null);
    setMessages([]);
    setErrorMessage('');
    setFailedPrompt('');
    setConfirmDeleteId(null);
    setMobileHistoryOpen(false);
    inputRef.current?.focus();
  };

  const handleDeleteConversation = async (conversationId: string) => {
    setDeletingId(conversationId);
    setErrorMessage('');
    try {
      await apiRequest(`/api/mansur-ai/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE',
      });
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setConfirmDeleteId(null);
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menghapus percakapan.');
    } finally {
      setDeletingId(null);
    }
  };

  const sendMessage = async (rawPrompt: string) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setErrorMessage('');
    setFailedPrompt('');

    const tempId = `temp-${Date.now()}`;
    const optimisticUserMsg: AiMessage = {
      id: tempId,
      userId: '',
      conversationId: activeConversationId || '',
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const previousMessages = messages;
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInput('');

    try {
      const fallbackHistory = previousMessages.slice(-16).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await apiRequest<ChatResponse>('/api/mansur-ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: trimmed,
          fallbackHistory,
        }),
      });

      setStorageAvailable(res.storageAvailable !== false);

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return [...withoutTemp, res.userMessage, res.assistantMessage];
      });

      if (res.conversationId) {
        setActiveConversationId(res.conversationId);
      }

      if (res.conversationId) {
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === res.conversationId);
          if (res.conversation && !exists) {
            return [res.conversation, ...prev];
          }
          if (exists) {
            const updated: AiConversation = {
              ...exists,
              updatedAt: res.assistantMessage.createdAt || new Date().toISOString(),
            };
            return [updated, ...prev.filter((c) => c.id !== res.conversationId)];
          }
          return prev;
        });
        if (!res.conversation && res.persisted) {
          fetchConversations();
        }
      }
    } catch (err: any) {
      setMessages(previousMessages);
      setFailedPrompt(trimmed);
      setInput(trimmed);
      setErrorMessage(
        err?.message || 'Gagal menghubungi MANSUR AI. Silakan coba lagi.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const renderHistoryContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#1A2421]/8 flex items-center justify-between gap-2 shrink-0">
        <div>
          <h3 className="text-sm font-bold text-[#1A2421]">Riwayat Konsultasi</h3>
          <p className="text-[11px] text-[#52625D]">
            {conversations.length > 0
              ? `${conversations.length} sesi tersimpan`
              : 'Belum ada sesi tersimpan'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewConversation}
          disabled={sending}
          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          <span>Baru</span>
        </button>
      </div>

      {!storageAvailable && (
        <div className="mx-3 mt-3 p-3 rounded-2xl bg-[#D8EFE7]/70 border border-[#0D7A72]/20 text-[11px] leading-relaxed text-[#1A2421]">
          Konsultasi tetap aktif di sesi ini. Untuk menyimpan riwayat percakapan &amp; isi
          pesan secara penuh, pastikan tabel <span className="font-mono font-semibold">ai_conversations</span> dan{' '}
          <span className="font-mono font-semibold">ai_messages</span> (beserta RLS) pada{' '}
          <span className="font-mono font-semibold">supabase/schema.sql</span> telah diterapkan.
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {loadingConversations ? (
          <div className="space-y-2">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-14 rounded-2xl bg-white/50 animate-pulse"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-[#D8EFE7]/80 text-[#0D7A72] flex items-center justify-center mx-auto">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-[#52625D] leading-relaxed">
              Mulai tanya jawab pertama Anda untuk menyimpan sesi konsultasi secara
              otomatis.
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = activeConversationId === conv.id;
            const isConfirming = confirmDeleteId === conv.id;
            return (
              <div
                key={conv.id}
                className={`group rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-[#D8EFE7]/85 border-[#0D7A72]/30'
                    : 'bg-white/50 hover:bg-white/80 border-white/75'
                }`}
              >
                {isConfirming ? (
                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#B91C1C] truncate">
                      Hapus sesi ini?
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={deletingId === conv.id}
                        onClick={() => handleDeleteConversation(conv.id)}
                        className="w-7 h-7 rounded-lg bg-[#DC2626] text-white flex items-center justify-center cursor-pointer hover:bg-[#B91C1C]"
                        aria-label="Konfirmasi hapus percakapan"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="w-7 h-7 rounded-lg bg-white text-[#52625D] flex items-center justify-center cursor-pointer hover:bg-white/90"
                        aria-label="Batal hapus"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 p-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectConversation(conv.id)}
                      className="flex-1 min-w-0 text-left px-2.5 py-2 rounded-xl cursor-pointer"
                    >
                      <div
                        className={`text-xs font-semibold truncate ${
                          isSelected ? 'text-[#0D7A72]' : 'text-[#1A2421]'
                        }`}
                      >
                        {conv.title}
                      </div>
                      <div className="text-[10.5px] text-[#52625D] mt-0.5 truncate">
                        {formatShortDate(conv.updatedAt)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(conv.id)}
                      className="w-8 h-8 rounded-xl text-[#52625D] hover:text-[#B91C1C] hover:bg-[#DC2626]/10 flex items-center justify-center opacity-75 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shrink-0"
                      aria-label={`Hapus percakapan ${conv.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-11.5rem)] lg:h-[calc(100vh-8.25rem)] min-h-[540px]">
      {/* Desktop Conversation History Sidebar */}
      <aside className="hidden lg:flex lg:w-72 shrink-0 glass-card rounded-[26px] overflow-hidden flex-col">
        {renderHistoryContent()}
      </aside>

      {/* Main Chat Container */}
      <section className="flex-1 min-w-0 glass-card rounded-[28px] flex flex-col overflow-hidden">
        {/* Top Mentor Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#1A2421]/8 flex items-center justify-between gap-3 bg-white/35 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0D7A72] to-[#14B8A6] text-white flex items-center justify-center shrink-0 shadow-[0_6px_16px_rgba(13,122,114,0.22)]">
              <BotMessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#1A2421] truncate">
                  MANSUR AI
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#D8EFE7] text-[#0D7A72] text-[10px] font-semibold shrink-0">
                  Mentor Trading
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#52625D] truncate">
                Tanya jawab materi, strategi, psikologi &amp; manajemen risiko trading
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileHistoryOpen(true)}
              className="lg:hidden min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/75 hover:bg-white border border-white/85 text-xs font-semibold text-[#1A2421] cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#0D7A72]" />
              <span>Riwayat</span>
              {conversations.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#D8EFE7] text-[#0D7A72] text-[10px] font-bold">
                  {conversations.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleNewConversation}
              disabled={sending}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#D8EFE7] hover:bg-[#C6E7DB] disabled:opacity-50 text-[#0D7A72] text-xs font-semibold cursor-pointer transition-colors"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Percakapan Baru</span>
              <span className="sm:hidden">Baru</span>
            </button>
          </div>
        </div>

        {/* Educational Scope Notice */}
        <div className="px-4 sm:px-6 py-2 bg-[#D8EFE7]/45 border-b border-[#0D7A72]/10 flex items-center gap-2 text-[11px] text-[#324540] shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0D7A72] shrink-0" />
          <span className="truncate sm:whitespace-normal">
            Fokus konsultasi &amp; edukasi trading — bukan sinyal entry otomatis, harga
            pasar live, atau jaminan profit.
          </span>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          {loadingMessages ? (
            <div className="space-y-4 max-w-3xl mx-auto">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`h-16 rounded-[22px] bg-white/60 animate-pulse ${
                    idx % 2 === 1 ? 'w-2/3 ml-auto' : 'w-4/5'
                  }`}
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="max-w-3xl mx-auto py-4 sm:py-6 space-y-6">
              <div className="text-center space-y-2.5 px-2">
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-[#0D7A72] to-[#14B8A6] text-white flex items-center justify-center mx-auto shadow-[0_10px_24px_rgba(13,122,114,0.24)]">
                  <BotMessageSquare className="w-7 h-7" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#1A2421]">
                  Halo {displayName}, ada yang ingin dikonsultasikan hari ini?
                </h3>
                <p className="text-xs sm:text-sm text-[#52625D] max-w-xl mx-auto leading-relaxed">
                  Saya MANSUR AI, asisten edukasi trading Anda. Ceritakan kendala psikologi,
                  tanyakan konsep market structure, atau diskusikan cara mengatur risiko dan
                  trading plan secara bertahap.
                </p>
              </div>

              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#52625D] text-center">
                  Pilih topik atau tulis pertanyaan Anda sendiri
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STARTER_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      disabled={sending}
                      onClick={() => sendMessage(question)}
                      className="min-h-[48px] text-left px-4 py-3 rounded-[20px] bg-white/70 hover:bg-white border border-white/85 hover:border-[#0D7A72]/35 text-xs sm:text-[13px] font-medium text-[#1A2421] transition-all cursor-pointer active:scale-[0.99] shadow-2xs"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {isUser ? (
                      <div className="max-w-[85%] sm:max-w-[76%] rounded-[22px] rounded-br-md px-4 py-3 bg-[#0D7A72] text-white shadow-[0_6px_18px_rgba(13,122,114,0.2)]">
                        <p className="text-[13.5px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      </div>
                    ) : (
                      <div className="max-w-[92%] sm:max-w-[84%] flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0 mt-0.5 border border-[#0D7A72]/15">
                          <BotMessageSquare className="w-4 h-4" />
                        </div>
                        <div className="rounded-[22px] rounded-tl-md px-4 py-3.5 bg-white/85 border border-white/95 shadow-2xs">
                          <FormattedAiMessage content={msg.content} />
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0 border border-[#0D7A72]/15">
                      <BotMessageSquare className="w-4 h-4" />
                    </div>
                    <div className="rounded-[22px] rounded-tl-md px-4 py-3 bg-white/85 border border-white/95 flex items-center gap-2.5">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0D7A72] animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0D7A72] animate-bounce [animation-delay:140ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0D7A72] animate-bounce [animation-delay:280ms]" />
                      </div>
                      <span className="text-xs font-medium text-[#52625D]">
                        MANSUR AI sedang berpikir...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-4 sm:mx-6 mb-2 px-4 py-2.5 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 text-xs text-[#B91C1C] font-medium min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {failedPrompt && (
              <button
                type="button"
                disabled={sending}
                onClick={() => sendMessage(failedPrompt)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-[#B91C1C] text-xs font-semibold hover:bg-white/90 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kirim Ulang</span>
              </button>
            )}
          </div>
        )}

        {/* Composer Input */}
        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 border-t border-[#1A2421]/8 bg-white/45 shrink-0"
        >
          <div className="max-w-3xl mx-auto flex items-end gap-2.5">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              maxLength={4000}
              placeholder="Tulis pertanyaan atau cerita kendala trading Anda di sini..."
              aria-label="Pertanyaan untuk MANSUR AI"
              className="flex-1 min-h-[44px] max-h-32 resize-none glass-input rounded-2xl px-4 py-2.5 text-[15px] sm:text-sm text-[#1A2421] placeholder:text-[#52625D]/75 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Kirim pertanyaan"
              className="min-h-[44px] min-w-[44px] sm:px-4 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 shadow-[0_6px_16px_rgba(13,122,114,0.22)]"
            >
              <SendHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </div>
          <p className="max-w-3xl mx-auto mt-1.5 px-1 text-[10.5px] text-[#52625D]">
            Tekan Enter untuk mengirim, Shift + Enter untuk baris baru. Manajemen risiko selalu
            tanggung jawab masing-masing trader.
          </p>
        </form>
      </section>

      {/* Mobile Conversation History Sheet */}
      <AnimatePresence>
        {mobileHistoryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-[#1A2421]/35 backdrop-blur-xs flex justify-end"
            onClick={() => setMobileHistoryOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[86%] max-w-xs h-full glass-card rounded-l-[28px] flex flex-col overflow-hidden"
            >
              <div className="px-4 pt-4 pb-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setMobileHistoryOpen(false)}
                  aria-label="Tutup riwayat"
                  className="w-9 h-9 rounded-xl bg-white/75 text-[#52625D] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0">{renderHistoryContent()}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
