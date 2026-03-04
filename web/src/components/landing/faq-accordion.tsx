"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className={cn(
              "rounded-xl border transition-all duration-200",
              isOpen
                ? "border-violet-500/30 bg-violet-500/5"
                : "border-border bg-card hover:border-border/80",
            )}
          >
            <button
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              onClick={() => setOpenIndex(isOpen ? null : i)}
            >
              <span className={cn("text-sm font-medium sm:text-base", isOpen ? "text-white" : "text-foreground")}>
                {item.question}
              </span>
              <span className="flex-shrink-0 text-muted-foreground">
                {isOpen ? <Minus size={16} /> : <Plus size={16} />}
              </span>
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                isOpen ? "max-h-96" : "max-h-0",
              )}
            >
              <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
