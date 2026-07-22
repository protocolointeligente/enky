-- Fase 03 — segunda metade da máquina de estados do Insight. Roda em transação
-- separada da migração anterior (obrigatório: o Postgres não deixa USAR um valor
-- de enum na mesma transação em que ele foi adicionado).
--
-- 1. O default de exposição passa de 'PENDING' (legado) para 'NEW'.
-- 2. Linhas antigas expostas mas não decididas são reconciliadas para 'NEW'.
--    ACCEPTED/IGNORED são preservados — já eram decisão do treinador.

ALTER TABLE "Insight" ALTER COLUMN "status" SET DEFAULT 'NEW';

UPDATE "Insight" SET "status" = 'NEW' WHERE "status" = 'PENDING';
