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
