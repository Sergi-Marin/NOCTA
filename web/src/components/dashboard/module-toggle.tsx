"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleModule } from "@/app/actions";
import type { ModuleDefinition } from "@/lib/modules";
import type { Plan } from "@nocta/database";
import { canEnableModule } from "@/lib/modules";
import { Badge } from "@/components/ui/badge";

interface ModuleToggleProps {
  module: ModuleDefinition;
  guildId: string;
  isActive: boolean;
  userPlan: Plan;
}

export function ModuleToggle({ module, guildId, isActive, userPlan }: ModuleToggleProps) {
  const [isPending, startTransition] = useTransition();
  const allowed = canEnableModule(module, userPlan);
  const Icon = module.icon;

  function handleChange(checked: boolean) {
    if (!allowed) return;
    startTransition(async () => {
      await toggleModule(guildId, module.id);
    });
  }

  return (
    <div
      className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${
        isActive ? "border-violet-500/30 bg-violet-500/5" : "border-white/10 bg-white/5"
      } ${!allowed ? "opacity-60" : ""}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          isActive ? "bg-violet-600/20 text-violet-400" : "bg-white/10 text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{module.name}</p>
          {module.requiredPlan !== "FREE" && (
            <Badge variant="violet">{module.requiredPlan}</Badge>
          )}
          {!allowed && (
            <Badge variant="outline">Upgrade required</Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{module.description}</p>
      </div>

      <Switch
        checked={isActive}
        onCheckedChange={handleChange}
        disabled={!allowed || isPending}
      />
    </div>
  );
}
