-- Fase 03 — ENKY Intelligence 02H → máquina de estados completa do Insight e
-- campos adicionais de prontidão. Migração puramente ADITIVA: só acrescenta
-- valores de enum e colunas nullable/legado. Nenhuma coluna é removida, nenhum
-- dado é alterado aqui (o backfill de status vive na migração seguinte, em
-- transação separada, porque o Postgres proíbe USAR um valor de enum recém
-- adicionado na mesma transação em que ele foi criado).

-- AlterEnum: novos estados do ciclo de vida do Insight.
ALTER TYPE "InsightStatus" ADD VALUE IF NOT EXISTS 'NEW';
ALTER TYPE "InsightStatus" ADD VALUE IF NOT EXISTS 'VIEWED';
ALTER TYPE "InsightStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "InsightStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterTable: Insight ganha vínculo opcional a um treino e nota do treinador
-- (distinta de `outcome`, que é o resultado observado).
ALTER TABLE "Insight" ADD COLUMN "workoutId" TEXT;
ALTER TABLE "Insight" ADD COLUMN "note" TEXT;

-- AddForeignKey: SetNull — apagar o treino não apaga o histórico de decisão.
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: prontidão ganha humor, disposição e dor localizada (texto livre,
-- dado de saúde — redigido em log).
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "mood" INTEGER;
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "disposition" INTEGER;
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "localizedPain" TEXT;
