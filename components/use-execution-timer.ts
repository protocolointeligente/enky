"use client";

import { useEffect, useState } from "react";
import { computeTime, type ExecEvent, type ExecTime } from "@/modules/workout-execution/execution-state";

// Hook do cronômetro (§13). O tick de 1s só provoca re-render; o número exibido
// vem sempre de computeTime(events, now) — derivado de timestamps —, então se
// autocorrige ao voltar de lock de tela / background (que congelam o setInterval,
// não o relógio). visibilitychange força um recálculo imediato ao reabrir.
export function useExecutionTimer(events: ExecEvent[], active: boolean): ExecTime {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  return computeTime(events, now);
}

// Contagem regressiva do descanso de musculação (§14). Dirigida por um deadline
// (epoch ms) — mesma razão do timer: sobrevive a background. Retorna os segundos
// restantes (0 quando não há descanso ativo).
export function useCountdown(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 500);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deadline]);

  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
