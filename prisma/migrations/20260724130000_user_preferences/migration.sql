-- Preferências do usuário (Perfil e configurações do atleta §12).
-- ADITIVA: uma coluna JSONB nullable em User. Sem backfill (opcional, default NULL).
ALTER TABLE "User" ADD COLUMN "preferences" JSONB;
