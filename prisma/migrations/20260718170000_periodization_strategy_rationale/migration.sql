-- Motor estratégico (ENKY Intelligence 2.0 · Fase 1) — persistência da
-- racionalização. Migração ADITIVA: uma coluna JSON nullable que guarda a saída
-- explicável do motor (regras aplicadas + versão + referências + confiança +
-- dados ausentes) no momento em que o plano foi gerado. Planos antigos seguem
-- válidos com o campo nulo.
ALTER TABLE "Periodization" ADD COLUMN "strategyRationale" JSONB;
