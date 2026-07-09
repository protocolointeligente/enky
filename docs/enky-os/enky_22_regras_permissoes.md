# ENKY 22 - REGRAS DE NEGÓCIO E PERMISSÕES
**Versão 1.0** — Papéis, acessos, regras operacionais, comerciais e auditoria

---

## Princípio

> **Permissão não é decoração de interface.** Validação no backend, banco e ações de servidor. Nunca apenas frontend.

---

## Papéis Globais

| Papel | Acesso |
|-------|--------|
| **VISITOR** | Área pública, marketplace público, cadastro |
| **ATHLETE** | Próprios treinos, feedback, evolução, relatórios compartilhados, planos comprados |
| **TRAINER** | Atletas vinculados, prescrição, calendário, relatórios, marketplace próprio, Intelligence |
| **ADMIN** | Painel admin, marketplace, pagamentos, suporte (não edita prescrição) |
| **SUPERADMIN** | Tudo + auditoria obrigatória |

## Papéis Organizacionais

OWNER, MANAGER, COACH, ASSISTANT, ATHLETE_MEMBER, VIEWER

---

## Regra Central: Vínculo Treinador-Atleta

- Treinador **só acessa** atletas com vínculo ativo
- Status: pending → active → paused → ended → archived
- Atleta pode existir antes de criar login (cadastro manual + convite posterior)
- Encerramento preserva histórico, impede novas prescrições

---

## Permissões Críticas

| Ação | Quem pode |
|------|-----------|
| Criar/editar treino | Treinador (atletas vinculados) |
| Mover treino no calendário | Treinador |
| Registrar feedback | Atleta (próprios treinos) |
| Editar prescrição | ❌ Atleta nunca |
| Ver dados de outro atleta | ❌ Proibido |
| Publicar plano marketplace | Treinador (revisão admin) |
| Aprovar/rejeitar plano | Admin |
| Alterar papel de usuário | Superadmin (com log) |
| Intelligence: executar ação sensível | ❌ Sempre exige validação humana |

---

## Marketplace

- Planos: draft → pending_review → published → rejected → archived
- Obrigatório: modalidade, nível, objetivo, duração, requisitos, "para quem é/não é", aviso responsabilidade
- **Proibido:** resultado garantido, lesão zero, serve para todos, promessa clínica
- Versionamento: compradores mantêm versão adquirida

## Pagamentos & Assinaturas

- Acesso liberado após confirmação de pagamento
- Inadimplência: bloquear novas ações, **nunca apagar dados**
- Modo somente leitura antes de bloqueio drástico

---

## Logs Obrigatórios

Login admin, CRUD treinos, calendário, publicação, feedback sensível, avaliação, relatório, Intelligence, marketplace, pagamentos, reembolsos, alteração papel, config globais

## Ações com Confirmação

Excluir, arquivar atleta, encerrar vínculo, cancelar treino, mover publicado, despublicar plano, bloquear usuário, alterar papel, reembolso, cancelar assinatura

---

## Segurança de Rotas

`/admin/*` → ADMIN/SUPERADMIN | `/treinador/*` → TRAINER | `/atleta/*` → ATHLETE | Backend valida papel + vínculo + propriedade

---

## LGPD & Dados Sensíveis

Finalidade clara, minimização, segurança, transparência, consentimento, possibilidade exclusão, proteção especial para dor/sintomas/saúde/menores
