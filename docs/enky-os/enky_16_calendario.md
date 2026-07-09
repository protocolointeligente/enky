# ENKY 16 - CALENDÁRIO DRAG & DROP DE TREINOS
**Versão 1.0** — Centro operacional da ENKY

---

## Princípio Central

> O calendário é onde o plano encontra a vida real. É o centro operacional que conecta planejamento, prescrição, execução, feedback e análise.

---

## Visualizações

| Visualização | Objetivo | MVP |
|-------------|----------|-----|
| **Semanal** | Planejamento e edição operacional | ✅ |
| **Mensal** | Visão macro, densidade, competições | Pós-MVP |
| **Diária** | Detalhes do dia, múltiplos atletas | Pós-MVP |
| **Mobile (lista)** | Clareza em celular, cards compactos | ✅ |

---

## Card de Treino

Título + modalidade + duração/distância + intensidade + status + cor por modalidade + ícone + indicador feedback + alerta

---

## Status do Treino

Planejado → Publicado → Realizado / Parcial / Não realizado / Reagendado / Cancelado / Aguardando feedback / Revisado

---

## Ações Drag & Drop

- Arrastar treino entre dias → atualizar data, preservar conteúdo, persistir no banco, log
- Treino não publicado: salvar automaticamente
- Treino publicado: confirmar ("Reagendar e notificar?" / "Sem notificar" / "Cancelar")
- Conflitos: alertar sem bloquear (ex: "2 sessões intensas no mesmo dia")

---

## Ações do Treinador

Criar, editar, mover, copiar (outro dia/atleta/múltiplos), duplicar semana, aplicar template, cancelar, reagendar, publicar (individual/dia/semana), ver feedback, gerar insight

---

## Calendário do Atleta

Ver treinos, abrir detalhes, registrar execução, enviar feedback. **Não pode editar prescrição.**

---

## Feedback → Calendário

Pendente → Enviado → Revisado. Campos: realizado + RPE + duração real + distância real + dor + observações. Alimenta perfil, dashboard, análises, relatórios, Intelligence.

---

## Planejado vs Realizado

Duração, distância, intensidade, carga, status — eixo central de análise.

---

## Integrações

| Com | Como |
|-----|------|
| Periodização | Gera treinos no calendário como rascunhos |
| Prescrição automática | Insere como rascunho editável |
| ENKY Intelligence | Analisa padrões, sugere ajustes, gera alertas |
| Relatórios | Resumo semanal de volume, aderência, carga |

---

## Alertas (poucos, relevantes, acionáveis)

Sem feedback, sem treino, aumento de carga, excesso intensidade, dor, semana incompleta, prova próxima, atraso

---

## Dados do Treino no Calendário

id, athleteId, trainerId, date, status, modality, title, objective, plannedDuration, plannedDistance, intensityType, intensityValue, description, isPublished, source, createdAt, updatedAt + periodizationId, originalDate, feedbackId, aiGenerated...

---

## MVP do Calendário

✅ Semanal treinador + lista atleta + criar/editar/mover + status + publicar + feedback + persistência + permissões + loading/vazio/erro

---

## Critérios de Pronto

Cria treino real + edita + move e persiste + permissões + status + feedback bidirecional + erros + loading + vazio + mobile + sem mocks + conectado à prescrição e perfil
