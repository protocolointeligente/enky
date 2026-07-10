# ENKY OS — Índice de Documentação

**Status: Índice operacional — reconciliado na Fase 01.5**

---

## 1. Objetivo

Este documento orienta produto, engenharia, QA e agentes de IA (Claude Code/Codex) sobre onde encontrar cada especificação oficial da ENKY e em que ordem elas prevalecem em caso de conflito.

> **Nota de reconciliação:** a versão anterior deste índice descrevia uma estrutura documental (numeração 00–PRD01, entidades `Person`/`Membership`/`TrainingSession`, "motores centrais" como `Calculation Engine`/`Notification Engine`) que nunca chegou a ser escrita e contradiz os documentos canônicos hoje aprovados — que usam `User`/`TrainerProfile`/`AthleteProfile`/`Workout` (Data Model Specification v1.2.1). Essa versão antiga foi substituída nesta reconciliação. Ver `docs/CHANGELOG_DOCUMENTATION.md`.

---

## 2. Hierarquia documental oficial (fonte única de verdade)

Em caso de conflito, o documento de maior hierarquia prevalece:

1. **ENKY 00 — Constitution** — `docs/enky-os/enky_00_constitution.md`
2. **ENKY OS — Product & Engineering Specification v1.0** — `docs/enky_os_specification.md`
3. **ENKY OS — Interface Architecture & Screen Specifications v1.4** — `docs/enky_interface_specification.md`
4. **ENKY OS — Data Model Specification v1.2.1** — `docs/enky_data_model_specification.md`
5. **ENKY 24 — Prompt Master para Claude/Codex** — `docs/enky-os/enky_24_prompt_master.md`

## 3. Documentos técnicos satélites

- **ENKY 23 — Roadmap MVP para Plataforma Completa** — `docs/enky-os/enky_23_roadmap.md` (fases 0–8)
- **ENKY 25 — Periodização** — `docs/enky_25_periodizacao.md` (detalha o motor de geração assistida introduzido na Interface Spec v1.4 §5)
- **Especificação Visual de Telas** — `docs/enky-os/visual-specs/README.md` (T-01…T-19)
- **Registros de decisão de arquitetura (ADR)** — `docs/adr/`
- **Matriz de permissões** — `docs/enky_role_permission_matrix.md`
- **Arquitetura técnica do repositório** — `docs/ARCHITECTURE.md`
- **Guia de desenvolvimento** — `docs/DEVELOPMENT.md`
- **Changelog documental** — `docs/CHANGELOG_DOCUMENTATION.md`

## 4. Documentos fundacionais de marca e filosofia (`docs/enky-os/enky_01`…`enky_22`)

Consolidados e derivados pela Product & Engineering Specification v1.0 (ver seu §2). Permanecem como contexto histórico/filosófico — em caso de divergência com os 5 documentos canônicos da seção 2, os canônicos prevalecem.

## 5. Fluxo essencial do MVP

Conforme ENKY 00 — Constitution: treinador cadastra atleta → cria treino → treino aparece no calendário → atleta visualiza → atleta executa → atleta envia feedback → treinador analisa → treinador ajusta → dados persistem → permissões funcionam.

## 6. Antes de qualquer implementação

1. Ler os 5 documentos canônicos (seção 2), na ordem de hierarquia.
2. Auditar o estado atual do repositório.
3. Comparar o código com a especificação.
4. Propor plano de execução por fases.
5. Só então implementar — nunca telas soltas, sempre fluxo completo.
