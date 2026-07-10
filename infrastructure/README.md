# infrastructure

Isola todo acesso a sistemas externos: banco de dados hoje, e futuramente provedores de e-mail, armazenamento de arquivos, gateway de pagamento e provedores de IA (ver `.env.example`).

Nenhum outro módulo deve importar `@prisma/client` diretamente — sempre pelo singleton em `infrastructure/database/prisma.ts`.

## Status nesta fase

- `database/prisma.ts` — singleton do Prisma Client, seguro para hot-reload em desenvolvimento.

Adaptadores de e-mail, armazenamento, pagamento e IA serão adicionados nas fases correspondentes do roadmap (ENKY 23), nunca antes do núcleo funcionar.
