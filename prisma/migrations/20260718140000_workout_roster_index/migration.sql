-- Índice composto para a consulta ampla da carteira (calendário "todos os
-- atletas" e motor de atenção): WHERE organizationId = ? AND trainerId = ?
-- AND plannedDate BETWEEN ? AND ?. Sem ele, só o índice de trainerId servia e
-- o Postgres varria todas as datas do treinador — pesado com 200 atletas.
-- ponytail: CREATE INDEX simples (trava breve). Se a tabela crescer a milhões
-- de linhas, trocar por CREATE INDEX CONCURRENTLY fora de transação.
CREATE INDEX "Workout_organizationId_trainerId_plannedDate_idx"
  ON "Workout"("organizationId", "trainerId", "plannedDate");
