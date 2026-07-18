"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { InferSelectModel } from "drizzle-orm";
import type { creditCards as creditCardsTable } from "@/db/schema";
import { findBankLogo } from "@/lib/thai-banks";
import { CreditCard as CreditCardIcon, ChevronLeft, ChevronRight } from "lucide-react";

type CreditCard = InferSelectModel<typeof creditCardsTable>;

const cardColors = ["#D0E77F", "#E5DBFE", "#ACCDFF", "#FBD4E6"];

export function CardCarousel({ cards }: { cards: CreditCard[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (child) {
      el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: "smooth" });
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || el.children.length === 0) return;
    const first = el.children[0] as HTMLElement;
    const itemWidth = first.offsetWidth + 16;
    setActiveIndex(
      Math.min(cards.length - 1, Math.round(el.scrollLeft / itemWidth))
    );
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card, i) => {
          const bank = findBankLogo(card.bankName);
          return (
          <div
            key={card.id}
            className="snap-start shrink-0 w-[85%] sm:w-[340px] rounded-[28px] p-5 text-[#13141A] relative overflow-hidden"
            style={{ backgroundColor: cardColors[i % cardColors.length] }}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <p className="font-bold text-lg">{card.name}</p>
                <div className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center overflow-hidden">
                  {bank ? (
                    <Image
                      src={bank.logo}
                      alt={bank.nameEN}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <CreditCardIcon className="w-4 h-4" />
                  )}
                </div>
              </div>
              <p className="text-sm font-medium opacity-70 mb-4 tracking-widest">
                {card.bankName} &nbsp;•••• {card.lastFourDigits}
              </p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-medium opacity-60 uppercase">
                    Statement
                  </p>
                  <p className="text-sm font-semibold">
                    Day {card.statementDay}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium opacity-60 uppercase">
                    Payment Due
                  </p>
                  <p className="text-sm font-semibold">
                    Day {card.paymentDueDay}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium opacity-60 uppercase">
                    Limit
                  </p>
                  <p className="text-sm font-semibold">
                    {card.creditLimit
                      ? `${parseFloat(card.creditLimit).toLocaleString()} THB`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
            {/* Decorative circles */}
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full border-2 border-[#13141A]/10" />
            <div className="absolute -right-2 -top-2 w-24 h-24 rounded-full border-2 border-[#13141A]/8" />
          </div>
          );
        })}
      </div>

      {cards.length > 1 && (
        <div className="flex items-center justify-center gap-4 mt-3">
          <button
            onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#13141A] hover:bg-neutral-50 transition-colors disabled:opacity-40"
            disabled={activeIndex === 0}
            aria-label="Previous card"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToIndex(i)}
                aria-label={`Go to card ${i + 1}`}
                className={`rounded-full transition-all ${
                  i === activeIndex
                    ? "w-5 h-2 bg-[#13141A]"
                    : "w-2 h-2 bg-[#13141A]/25"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() =>
              scrollToIndex(Math.min(cards.length - 1, activeIndex + 1))
            }
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#13141A] hover:bg-neutral-50 transition-colors disabled:opacity-40"
            disabled={activeIndex === cards.length - 1}
            aria-label="Next card"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
