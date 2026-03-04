"use client";

import { useTransition } from "react";
import { createCheckoutSession, createPortalSession } from "@/app/actions";
import type { Plan } from "@nocta/database";
import { Badge } from "@/components/ui/badge";

const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free",
  PRO: "Pro",
  PREMIUM: "Premium",
};

const PLAN_FEATURES: Record<Plan, string[]> = {
  FREE: ["Voice Assistant", "Auto-Moderation", "Welcome Messages"],
  PRO: ["Everything in Free", "Leveling & XP", "Music Player", "Event Logging"],
  PREMIUM: ["Everything in Pro", "Priority support", "Custom wake word (soon)"],
};

interface PlanCardProps {
  currentPlan: Plan;
}

export function PlanCard({ currentPlan }: PlanCardProps) {
  const [isPending, startTransition] = useTransition();

  function upgrade(plan: "PRO" | "PREMIUM") {
    startTransition(async () => {
      await createCheckoutSession(plan);
    });
  }

  function manage() {
    startTransition(async () => {
      await createPortalSession();
    });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Current plan</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-2xl font-bold">{PLAN_LABELS[currentPlan]}</h2>
            {currentPlan !== "FREE" && <Badge variant="violet">{currentPlan}</Badge>}
          </div>
        </div>
        {currentPlan !== "FREE" && (
          <button
            onClick={manage}
            disabled={isPending}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-foreground hover:border-violet-400/50 transition-colors disabled:opacity-50"
          >
            Manage billing
          </button>
        )}
      </div>

      <ul className="mt-4 space-y-1">
        {PLAN_FEATURES[currentPlan].map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="h-4 w-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {currentPlan === "FREE" && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => upgrade("PRO")}
            disabled={isPending}
            className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Upgrade to Pro
          </button>
          <button
            onClick={() => upgrade("PREMIUM")}
            disabled={isPending}
            className="flex-1 rounded-xl border border-violet-500/40 hover:border-violet-400 transition-colors px-4 py-2.5 text-sm font-semibold text-violet-300 disabled:opacity-50"
          >
            Upgrade to Premium
          </button>
        </div>
      )}

      {currentPlan === "PRO" && (
        <div className="mt-6">
          <button
            onClick={() => upgrade("PREMIUM")}
            disabled={isPending}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Upgrade to Premium
          </button>
        </div>
      )}
    </div>
  );
}
