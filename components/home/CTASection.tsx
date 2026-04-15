"use client";

import { Mic, Send } from "lucide-react";
import { useState } from "react";

export default function CTASection() {
  const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = () => {
    setIsListening(!isListening);
    setTimeout(() => setIsListening(false), 2000);
  };

  return (
    <section className="py-16" style={{ backgroundColor: "#0d0d1a" }}>
      <div className="container-main">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-8">
            Не нашли нужную позицию?
          </h2>

          <div className="relative">
            <textarea
              placeholder="Опишите что нужно..."
              className="w-full bg-card border-2 border-gold rounded p-4 pr-24 text-foreground placeholder:text-muted-foreground outline-none resize-none h-32"
            />

            <div className="absolute bottom-3 right-3 flex gap-2">
              <button
                onClick={handleVoiceInput}
                className={`w-11 h-11 flex items-center justify-center rounded transition-all ${
                  isListening
                    ? "bg-red-500 animate-pulse"
                    : "bg-muted hover:bg-muted-foreground/20"
                }`}
              >
                <Mic
                  className={isListening ? "text-white" : "text-foreground"}
                  size={20}
                />
              </button>

              <button className="w-11 h-11 flex items-center justify-center bg-gold hover:bg-gold-dark rounded transition-all">
                <Send className="text-foreground" size={20} />
              </button>
            </div>
          </div>

          <p className="text-white/70 text-sm mt-4">
            Отвечаем в Telegram за 15 минут
          </p>
        </div>
      </div>
    </section>
  );
}
