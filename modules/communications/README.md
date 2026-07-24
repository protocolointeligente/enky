# modules/communications

**Responsabilidade:** comunicação interna registrada (Etapa 4 §22) —
`CommunicationLog`. Livro-razão de comunicações (anotação, lembrete, aviso,
mensagem geral) por organização.

## Escopo desta fatia

- **Entregue:** modelo + enums; migração `20260719190000_communications`;
  `logCommunication` (registra que a comunicação aconteceu, com validação de
  tenant do destinatário) + `listCommunications`. Rotas
  `app/api/trainer/communications`; UI `/treinador/gestao/comunicacao`.
- **`recipientId`** é referência **solta** (polimórfica sobre cliente/lead/atleta,
  sem FK) — `recipientType` diz a entidade; o serviço valida que o destinatário
  pertence à org.
- **Deferido:** disparo real de e-mail para mensagem avulsa (depende de um mailer
  geral — hoje só o de convite existe); por ora `status = LOGGED`. WhatsApp
  oficial está fora de escopo (§22). As automações (§23) que gerariam avisos
  automáticos também são fatia futura.

## Segurança

`requireGlobalRole(["TRAINER"])` + `requireOrgRole`. Registrar: MANAGER/HEAD_COACH/
SUPPORT (OWNER passa sozinho); leitura ampla. Tenant isolation no destinatário e
na listagem.
