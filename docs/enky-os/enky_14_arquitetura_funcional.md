# ENKY 14 - ARQUITETURA FUNCIONAL DO SISTEMA
**Versão 1.0** — Módulos, responsabilidades, integrações e estrutura funcional

---

## 4 Áreas Principais

| Área | Objetivo |
|------|----------|
| **Pública** | Atrair, educar, vender, marketplace |
| **Treinador** | Organizar, prescrever, analisar, gerenciar |
| **Atleta** | Executar, registrar, acompanhar |
| **Admin** | Controlar, auditar, gerenciar plataforma |

---

## Módulos Detalhados

### Autenticação & Papéis
SUPERADMIN, ADMIN, TRAINER, ATHLETE, VISITOR. Validação no servidor, proteção de rotas, vínculo atleta-treinador.

### Gestão de Atletas
Cadastro, convite, agrupamento, perfil completo, objetivo, disponibilidade, histórico de lesões, observações técnicas.

### Perfil do Atleta (360°)
Dados + objetivo + avaliações + calendário + treinos + aderência + feedbacks + métricas + alertas + Intelligence.

### Avaliações
Física, funcional, testes por modalidade, anamnese, lesões, prontidão, medidas corporais.

### Periodização
Atleta + modalidade + objetivo + data-alvo + fases + semanas + progressão + regenerativa → gera treinos no calendário.

### Calendário (Centro Operacional)
Mês/semana/dia, drag & drop, copiar/duplicar/mover, status, modalidade por cor, feedback, alertas. Edição (treinador) / visualização (atleta).

### Prescrição
Manual + automática. Estruturada por modalidade. Rascunho editável. Vinculada ao calendário.

### Biblioteca de Treinos
Modelos reutilizáveis por modalidade/nível/objetivo.

### Biblioteca de Exercícios
Exercícios com vídeo/imagem, grupo muscular, padrão motor, equipamento.

### Execução & Feedback
Atleta: realizado/parcial/perdido + RPE + dor + observações. Treinador: revisar + ajustar + gerar insight.

### Análises
Aderência, volume, intensidade, planejado vs realizado, evolução, feedback, fadiga, distribuição.

### Relatórios
Semanal/mensal/atleta/grupo/carga/aderência/comercial/admin. Resumo + métricas + interpretação + recomendações.

### ENKY Intelligence
Resumo, análise, sugestão, alerta, explicação, relatório, apoio prescrição, apoio marketplace.

### Marketplace
Vitrine pública, filtros, compra, pagamento, acesso. Treinador: criar/editar/publicar planos. Admin: aprovar/recusar.

### Pagamentos & Assinaturas
SaaS + marketplace + comissão + PIX/cartão + status + bloqueio/liberação.

### Comunicação & Notificações
Úteis, poucas, acionáveis.

### Logs & Auditoria
Login, CRUD treinos, calendário, marketplace, pagamentos, permissões, Intelligence.

### Configurações
Por perfil: treinador, atleta, admin.

---

## Fluxo Integrado

```
Treinador: Dashboard → Atleta → Periodização → Calendário → Prescrição
→ Atleta executa → Feedback → Análise → Intelligence → Ajuste → Relatório
```

---

## Prioridade Funcional

1. Auth + atletas + calendário + prescrição manual + feedback + dashboard
2. Periodização + relatórios simples + marketplace básico + admin
3. Intelligence inicial + análises + prescrição automática corrida
4. Multiesporte + relatórios avançados + pagamentos + dashboards
5. Integrações + app nativo + Academy + Labs + API

---

## Módulo Pronto = 
Rota funcional + interface + dados persistidos + permissões + estados vazios + erro + loading + validação + conexão com módulos + sem mocks
