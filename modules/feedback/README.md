# modules/feedback

**Responsabilidade:** `WorkoutFeedback` — feedback pós-treino do atleta e o cálculo oficial de `sessionRpeLoad` (sempre no backend, nunca confiando em valor enviado pelo cliente).

**Fonte de verdade:** Data Model Specification v1.2.1 §6; Product & Engineering Specification v1.0 §26; Interface Architecture v1.4 §7.

**Regra crítica:** `sessionRpeLoad = actualDurationMinutes × sessionRpe`, calculado apenas quando ambos os valores são válidos; `PARTIAL`/`NOT_AVAILABLE`/`INVALID` mantêm o valor `null`.

**Status:** fundação apenas. Nenhum modelo, serviço ou rota implementado nesta fase.
