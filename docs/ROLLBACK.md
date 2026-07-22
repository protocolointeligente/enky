# ENKY — Plano de Rollback

O que fazer quando um deploy de produção sai errado. Princípio: **reverter o
código é barato e instantâneo; reverter o banco é caro e arriscado** — por isso
as migrations do ENKY são aditivas por disciplina, para que voltar o código não
exija voltar o schema.

## Árvore de decisão rápida

1. **Bug de código, schema intacto?** → Instant Rollback do deploy (§1). Segundos.
2. **Deploy sem migration nova?** → §1 resolve sozinho.
3. **Migration nova, mas aditiva (só criou coluna/tabela nullable)?** → §1 no
   código; a migration pode **ficar** (o código velho a ignora). Não reverta o
   banco.
4. **Migration destrutiva/incompatível (dropou/renomeou/NOT NULL)?** → §2 +
   possivelmente §3. É o caso caro — evite chegar aqui.
5. **Dado corrompido / perda?** → restauração de banco (§3).

## 1. Reverter o deploy (Vercel Instant Rollback)

- Vercel → Project → **Deployments** → escolha o último deployment **bom** →
  **Promote to Production** (ou "Instant Rollback"). Volta o código em segundos,
  sem rebuild.
- Alternativa por git: `git revert <sha>` na `main` e deixe a Vercel rebuildar.
- Depois: `curl /api/health` e rode o smoke (`npm run test:smoke`) contra o
  domínio para confirmar que os 6 fluxos voltaram.

## 2. Reverter uma migration

Prisma **não** faz "down migration" automático. Migration aplicada é imutável.
Opções, da mais segura à menos:

- **Preferida — roll-forward:** escreva uma **migration nova** que desfaz o que
  a ruim fez (ex.: recria a coluna dropada). Aditivo, versionado, aplica com
  `prisma migrate deploy`. Nunca edite a migration já aplicada.
- **Se a migration ruim ainda não subiu em produção:** apenas não a aplique;
  corrija na branch e reaplique a cadeia num banco limpo com
  `npm run check:migrations -- --confirm` antes de tentar de novo.
- **Só em último caso** (schema quebrado, produção parada): restaure o banco a
  um ponto anterior à migration (§3) e trate a migration como não aplicada.

## 3. Restaurar o banco (Neon)

O ENKY usa Neon. Duas rotas, conforme o plano:

- **Branch a partir de um timestamp (PITR):** Neon → projeto → **Branches** →
  criar branch "restore" apontando para o instante anterior ao incidente. Aponte
  `DATABASE_URL`/`DIRECT_URL` de produção para o endpoint dessa branch e
  redeploy. É a rota rápida e não destrói a branch atual (dá para comparar).
- **Restore in-place:** Neon → **Restore** para o ponto no tempo desejado.
  Destrutivo sobre o estado atual — só com a causa entendida.

**Teste obrigatório antes do piloto** (critério de aceite "backup testado"):
1. Crie uma branch de restauração de ~1h atrás.
2. Aponte um deploy de teste para ela e rode `npm run test:smoke`.
3. Confirme que dado esperado está lá e o app sobe. Descarte a branch.
Um backup nunca restaurado não conta como backup.

## 4. Degradar um recurso sem rollback total

Nem todo incidente pede reverter o deploy. Recursos são isolados por env:

- **Pagamento com problema:** o produto **degrada para o plano grátis**, não
  apaga nada (`ENTITLED_STATUSES`). Pausar o webhook no Asaas contém o dano sem
  derrubar o app.
- **E-mail (Resend) fora:** convites falham com erro explícito; o resto do
  produto segue. Reenvie quando voltar (o convite tem reenvio na UI).
- **Rate limit (Upstash) fora:** degrada para memória por instância e grita no
  log — não derruba nada.
- **Strava fora:** rotas de integração respondem 422; prescrever/executar treino
  não muda. Desconectar não apaga atividades importadas.

## 5. Pós-incidente

- Registre o `correlationId`/`digest` do erro e o deployment envolvido.
- Se a causa foi env, corrija na Vercel e **redeploy** (env nova só vale em
  deployment novo).
- Se a causa foi migration, adicione o caso ao `check:migrations` (rodar contra
  banco limpo pega incompatibilidade antes de produção).
