import React, { useState, useEffect, useRef } from 'react';
import { waCustomerAgent, WaAgentResponse } from '../services/waCustomerAgent';
import { storageService } from '../services/storageService';
import { playNewCustomerChime } from '../lib/audioNotifier';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  categoryName?: string;
  isCommitted?: boolean;
  orderId?: string;
}

interface WaChatSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (orderId: string) => void;
}

export const WaChatSimulatorDrawer: React.FC<WaChatSimulatorDrawerProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init-1',
      sender: 'bot',
      text: `Halo Kak! Selamat datang di *Dapur Dulang Indonesia - Sidoarjo* 🥟✨\n\nKami sedia Risoles Mayo Crispy, Rogut, Piscok Lumer, & Kebab hangat fresh dari wajan!\nAda yang mau dipesan? Silakan ketik pesanan Kakak (contoh: *"mayo 3, rogut 2"*). 😊`,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, messages, isTyping]);

  // Listen to order status updates from Kitchen / Cashier in DULANG-3
  useEffect(() => {
    const handleStatusNotif = (e: any) => {
      const { order, status, method } = e.detail || {};
      if (!order) return;

      const botTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      let notifText = '';

      if (status === 'lunas') {
        notifText = `✅ *PEMBAYARAN DIVERIFIKASI & LUNAS!*
🏢 _Dulang Indonesia - Sidoarjo_
━━━━━━━━━━━━━━━━━━━━━
Halo Kak *${order.customer_name}*, pesanan \`#${order.id}\` sebesar *Rp ${order.total_price.toLocaleString('id-ID')}* (${(method || order.payment_method || 'tunai').toUpperCase()}) telah kami terima & tercatat lunas di kasir dapur!

_Terima kasih banyak atas kunjungannya, selamat menikmati risoles fresh & renyah Dapur Dulang!_ 🙏🥟`;
      } else if (status === 'menunggu') {
        notifText = `📢 *UPDATE STATUS DAPUR DULANG!*
━━━━━━━━━━━━━━━━━━━━━
Halo Kak *${order.customer_name}*, pesanan \`#${order.id}\` sedang *DIPROSES & DIGORENG HANGAT* di wajan dapur! 🔥
Estimasi matang ~10-15 menit yaa.`;
      }

      if (notifText) {
        setMessages((prev) => [
          ...prev,
          {
            id: `notif-${Date.now()}`,
            sender: 'bot',
            text: notifText,
            time: botTime,
            categoryName: 'Notifikasi Dapur',
            isCommitted: false,
            orderId: order.id,
          },
        ]);
        playNewCustomerChime();
      }
    };

    window.addEventListener('dulang_wa_status_notification', handleStatusNotif);
    return () => {
      window.removeEventListener('dulang_wa_status_notification', handleStatusNotif);
    };
  }, []);

  const handleSend = (textToSend?: string) => {
    const raw = (textToSend || inputText).trim();
    if (!raw) return;

    const userTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: raw,
      time: userTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Simulate natural typing delay (400ms - 800ms)
    setTimeout(() => {
      const res: WaAgentResponse = waCustomerAgent.handleMessage(raw);
      const botTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: res.reply,
        time: botTime,
        categoryName: res.categoryName,
        isCommitted: !!res.committedOrder,
        orderId: res.committedOrder?.orderId,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);

      // Jika pesanan resmi masuk (Turn 3 commit):
      if (res.committedOrder) {
        // 1. Simpan ke storage DULANG-3
        storageService.addOrderFromWhatsApp(res.committedOrder);

        // 2. Bunyikan lonceng dapur D5->A5!
        playNewCustomerChime();

        // 3. Callback ke parent dashboard
        if (onOrderCreated) {
          onOrderCreated(res.committedOrder.orderId);
        }
      }
    }, 600);
  };

  const handleResetChat = () => {
    waCustomerAgent.resetSession();
    setMessages([
      {
        id: `init-${Date.now()}`,
        sender: 'bot',
        text: `Halo Kak! Sesi chat di-reset. Ada yang bisa kami bantu dari Dapur Dulang hari ini? 🥟🔥`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const quickPills = [
    'stok ready nggak?',
    'mayo 3 rogut 4',
    'jual ayam nggak?',
    'risolnya agak kering ya kemarin...',
    'enak banget risolnya!',
    'ini halal kak?',
    'beli banyak diskon dong',
    'bisa tanpa mayo?',
    'ambil sendiri',
    '3',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-md h-full bg-[#E5DDD5] flex flex-col shadow-2xl relative border-l border-emerald-900/30">
        {/* WhatsApp Green Header */}
        <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-md select-none">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-700 border-2 border-emerald-400/50 flex items-center justify-center text-xl shadow-inner">
                🥟
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#075E54] rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm tracking-wide">Dulang Indonesia</span>
                <span className="bg-emerald-600/80 text-[10px] px-1.5 py-0.5 rounded text-emerald-100 font-mono">Dapur Sidoarjo</span>
              </div>
              <p className="text-[11px] text-emerald-200 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                <span>Online (AI Frontline Agent)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetChat}
              title="Reset Sesi Chat"
              className="text-emerald-200 hover:text-white p-1.5 rounded-lg hover:bg-emerald-700/50 transition-colors text-xs flex items-center space-x-1 border border-emerald-600/60"
            >
              <span>🔄 Reset</span>
            </button>
            <button
              onClick={onClose}
              title="Tutup Chat"
              className="text-emerald-200 hover:text-white p-1.5 rounded-lg hover:bg-emerald-700/50 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="bg-[#128C7E]/10 border-b border-emerald-900/10 px-3 py-2 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wider shrink-0 mr-1">
            ⚡ Coba:
          </span>
          {quickPills.map((pill, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(pill)}
              className="shrink-0 bg-white/90 hover:bg-emerald-50 text-emerald-900 border border-emerald-600/30 text-xs px-2.5 py-1 rounded-full shadow-sm transition hover:scale-105 active:scale-95"
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Chat Messages List (Styled like WhatsApp) */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3"
          style={{
            backgroundImage: `radial-gradient(#128C7E 0.5px, transparent 0.5px)`,
            backgroundSize: '16px 16px',
            backgroundColor: '#efeae2',
          }}
        >
          {/* Security / System Notice */}
          <div className="flex justify-center my-1">
            <div className="bg-[#FFF9D2] border border-[#FFE885] text-[#54656F] text-[11px] px-3 py-1.5 rounded-lg text-center shadow-xs max-w-xs leading-relaxed">
              🔒 <strong>Simulasi WhatsApp Live:</strong> Pesanan yang selesai di sini langsung masuk ke antrean kasir dapur & membunyikan lonceng DULANG-3! 🔔
            </div>
          </div>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in`}
              >
                <div
                  className={`relative max-w-[85%] rounded-lg px-3.5 py-2 shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-[#DCF8C6] text-slate-900 rounded-tr-none'
                      : 'bg-white text-slate-900 rounded-tl-none border border-slate-200/60'
                  }`}
                >
                  {/* Category Pill for Bot */}
                  {!isUser && msg.categoryName && (
                    <div className="mb-1">
                      <span className="text-[10px] font-semibold tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        🏷️ {msg.categoryName}
                      </span>
                    </div>
                  )}

                  {/* Message Body */}
                  <div className="font-normal text-[13px]">{msg.text}</div>

                  {/* Committed badge */}
                  {msg.isCommitted && (
                    <div className="mt-2 pt-2 border-t border-emerald-200/80 bg-emerald-50/80 -mx-2 px-2 py-1 rounded text-[11px] text-emerald-800 font-medium flex items-center space-x-1.5">
                      <span>🔔</span>
                      <span>
                        <strong>Tersambung ke Dapur!</strong> Antrean #{msg.orderId} dibuat otomatis.
                      </span>
                    </div>
                  )}

                  {/* Timestamp & Read ticks */}
                  <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-slate-400 select-none">
                    <span>{msg.time}</span>
                    {isUser && <span className="text-[#53BDEB] font-bold">✓✓</span>}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-start space-x-1 animate-pulse">
              <div className="bg-white border border-slate-200/60 rounded-lg rounded-tl-none px-3 py-2 shadow-sm text-xs text-slate-500 flex items-center space-x-1.5">
                <span className="font-medium text-emerald-700">Dulang Dapur</span>
                <span>sedang mengetik</span>
                <span className="animate-bounce">.</span>
                <span className="animate-bounce delay-100">.</span>
                <span className="animate-bounce delay-200">.</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar Footer */}
        <div className="bg-[#F0F2F5] px-3 py-2.5 flex items-center space-x-2 border-t border-slate-300">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ketik pesanan... (contoh: mayo 2, rogut 3)"
            className="flex-1 bg-white border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#075E54] focus:border-transparent shadow-inner"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full bg-[#075E54] hover:bg-[#128C7E] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#075E54] text-white flex items-center justify-center transition shadow-md shrink-0"
            title="Kirim Pesan"
          >
            <svg
              className="w-4 h-4 translate-x-0.5 fill-current"
              viewBox="0 0 24 24"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
