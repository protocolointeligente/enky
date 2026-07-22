import { describe, expect, it } from "vitest";
import {
  computeTime,
  dedupeAndOrder,
  formatDuration,
  isTerminal,
  nextStatus,
  reduce,
  type ExecEvent,
} from "@/modules/workout-execution/execution-state";

const S = 1000;
const MIN = 60 * S;
const T0 = 1_700_000_000_000; // epoch base arbitrário

function ev(type: ExecEvent["type"], atMs: number, seq: number, extra?: Partial<ExecEvent>): ExecEvent {
  return { type, at: T0 + atMs, sequence: seq, idempotencyKey: `${type}-${seq}`, ...extra };
}

describe("nextStatus", () => {
  it("permite pausar e retomar", () => {
    expect(nextStatus("STARTED", ev("PAUSE", 0, 1))).toBe("PAUSED");
    expect(nextStatus("PAUSED", ev("RESUME", 0, 2))).toBe("STARTED");
  });
  it("rejeita transições inválidas", () => {
    expect(nextStatus("STARTED", ev("RESUME", 0, 1))).toBeNull(); // não estava pausado
    expect(nextStatus("PAUSED", ev("PAUSE", 0, 1))).toBeNull();
    expect(nextStatus("COMPLETED", ev("PAUSE", 0, 1))).toBeNull(); // terminal
  });
  it("COMPLETE parcial vs total", () => {
    expect(nextStatus("STARTED", ev("COMPLETE", 0, 1))).toBe("COMPLETED");
    expect(nextStatus("STARTED", ev("COMPLETE", 0, 1, { partial: true }))).toBe("PARTIALLY_COMPLETED");
  });
  it("eventos de progresso não mudam status", () => {
    expect(nextStatus("STARTED", ev("STEP_COMPLETED", 0, 1))).toBeNull();
    expect(nextStatus("STARTED", ev("NOTE", 0, 1))).toBeNull();
  });
});

describe("isTerminal", () => {
  it("classifica terminais", () => {
    expect(isTerminal("ABANDONED")).toBe(true);
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("PARTIALLY_COMPLETED")).toBe(true);
    expect(isTerminal("STARTED")).toBe(false);
    expect(isTerminal("PAUSED")).toBe(false);
  });
});

describe("dedupeAndOrder", () => {
  it("remove duplicatas por idempotencyKey e ordena por sequence", () => {
    const dup = ev("STEP_COMPLETED", 5 * S, 2);
    const out = dedupeAndOrder([ev("START", 0, 1), dup, dup, ev("PAUSE", 10 * S, 3)]);
    expect(out.map((e) => e.sequence)).toEqual([1, 2, 3]);
  });
});

describe("computeTime", () => {
  it("sem START, tempo zero", () => {
    expect(computeTime([ev("NOTE", 0, 1)], T0 + MIN)).toEqual({ elapsedSeconds: 0, activeSeconds: 0 });
  });

  it("ativo: elapsed = active quando nunca pausou", () => {
    const t = computeTime([ev("START", 0, 1)], T0 + 30 * MIN);
    expect(t.elapsedSeconds).toBe(30 * 60);
    expect(t.activeSeconds).toBe(30 * 60);
  });

  it("exclui intervalo pausado do active mas não do elapsed", () => {
    // start=0, pause=10min, resume=15min (5min pausado), agora=20min
    const events = [ev("START", 0, 1), ev("PAUSE", 10 * MIN, 2), ev("RESUME", 15 * MIN, 3)];
    const t = computeTime(events, T0 + 20 * MIN);
    expect(t.elapsedSeconds).toBe(20 * 60);
    expect(t.activeSeconds).toBe(15 * 60); // 20 - 5 pausados
  });

  it("sobrevive a background: recalcula por timestamp mesmo se pausado até o fim", () => {
    // pausado em 5min e nunca retomado; agora=25min → 20min pausados
    const events = [ev("START", 0, 1), ev("PAUSE", 5 * MIN, 2)];
    const t = computeTime(events, T0 + 25 * MIN);
    expect(t.elapsedSeconds).toBe(25 * 60);
    expect(t.activeSeconds).toBe(5 * 60);
  });

  it("congela no evento terminal, ignora o 'agora'", () => {
    const events = [ev("START", 0, 1), ev("COMPLETE", 40 * MIN, 2)];
    const t = computeTime(events, T0 + 999 * MIN); // agora muito depois
    expect(t.elapsedSeconds).toBe(40 * 60);
  });

  it("pausas consecutivas sem resume contam só a primeira", () => {
    const events = [ev("START", 0, 1), ev("PAUSE", 5 * MIN, 2), ev("PAUSE", 8 * MIN, 3)];
    const t = computeTime(events, T0 + 10 * MIN);
    expect(t.activeSeconds).toBe(5 * 60); // pausado desde 5min
  });
});

describe("formatDuration", () => {
  it("formata mm:ss e h:mm:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(-5)).toBe("0:00"); // nunca negativo
  });
});

describe("reduce", () => {
  it("um treino completo: start→pause→resume→complete", () => {
    const events = [
      ev("START", 0, 1),
      ev("STEP_COMPLETED", 2 * MIN, 2),
      ev("PAUSE", 10 * MIN, 3),
      ev("RESUME", 12 * MIN, 4),
      ev("COMPLETE", 30 * MIN, 5),
    ];
    const snap = reduce(events, T0 + 999 * MIN);
    expect(snap.status).toBe("COMPLETED");
    expect(snap.elapsedSeconds).toBe(30 * 60);
    expect(snap.activeSeconds).toBe(28 * 60); // 2min pausados
  });

  it("ignora eventos após terminal (idempotência de conclusão)", () => {
    const events = [ev("START", 0, 1), ev("COMPLETE", 20 * MIN, 2), ev("ABANDON", 25 * MIN, 3)];
    expect(reduce(events, T0 + 30 * MIN).status).toBe("COMPLETED");
  });

  it("abandono", () => {
    const events = [ev("START", 0, 1), ev("ABANDON", 8 * MIN, 2)];
    expect(reduce(events, T0 + 30 * MIN).status).toBe("ABANDONED");
  });
});
