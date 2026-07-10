# ENKY OS — PRODUCT & ENGINEERING SPECIFICATION v1.0
**Fonte única de verdade para engenharia, produto e implementação**

**Status: Especificação consolidada**  
**Uso: Documento principal para Claude Code, Codex, desenvolvedores e decisões técnicas**  
**Produto: ENKY — Plataforma de Inteligência Esportiva**

---

## 1. FINALIDADE DESTE DOCUMENTO

Este documento consolida a especificação de produto e engenharia da ENKY.

A partir desta versão, este documento deve ser tratado como a fonte única de verdade para implementação técnica, arquitetura funcional, regras de negócio, permissões, modelo de dados, MVP, roadmap e critérios de pronto.

Ele não substitui a filosofia da marca, mas transforma a visão da ENKY in uma especificação operacional para desenvolvimento.

Este documento deve ser lido antes de qualquer implementação no Claude Code, Codex ou outro ambiente de desenvolvimento.

---

## 2. DOCUMENTOS CONSOLIDADOS E REFERÊNCIAS

Esta especificação consolida e deriva dos seguintes documentos do ENKY OS:

- ENKY 00 - Constitution
- ENKY 10 - Manifesto para Treinadores
- ENKY 11 - Manual da ENKY Intelligence
- ENKY 12 - Brand Book Filosófico
- ENKY 13 - Product Vision & Scope
- ENKY 14 - Arquitetura Funcional do Sistema
- ENKY 15 - Telas e Fluxos Obrigatórios
- ENKY 16 - Calendário Drag & Drop de Treinos
- ENKY 17 - Modalidades e Prescrição Multiesporte
- ENKY 18 - Métricas, Indicadores e Dashboards
- ENKY 19 - Base Científica e Regras de Treinamento
- ENKY 20 - ENKY Intelligence no Produto
- ENKY 21 - Modelo de Dados e Entidades
- ENKY 22 - Regras de Negócio e Permissões
- ENKY 23 - Roadmap MVP para Plataforma Completa
- ENKY 24 - Prompt Master para Claude/Codex

*Observação operacional:* Caso existam documentos externos nomeados 09A a 09E ou PRD 01, eles devem ser anexados posteriormente como apêndices ou usados para revisar esta especificação. Até sua inclusão formal, esta versão v1.0 passa a ser a referência operacional principal.

---

## 3. PRINCÍPIO CENTRAL DA ENKY

> **A ENKY transforma dados em compreensão, compreensão em decisão e decisão em performance.**

A plataforma existe para organizar o caos do treinamento esportivo, apoiar treinadores, melhorar a experiência do atleta e transformar informação dispersa em decisões melhores.

A ENKY não substitui o treinador.  
A ENKY potencializa o treinador.

---

## 4. DEFINIÇÃO DO PRODUTO

A ENKY é uma plataforma SaaS de inteligência esportiva para:
- treinadores;
- assessorias esportivas;
- atletas;
- organizações;
- marketplace de planos;
- gestão de performance;
- prescrição multiesporte;
- análise de dados;
- relatórios;
- inteligência aplicada.

A ENKY integra:
- gestão de atletas;
- calendário de treinos;
- prescrição;
- periodização;
- feedback;
- métricas;
- dashboards;
- relatórios;
- marketplace;
- pagamentos;
- permissões;
- ENKY Intelligence.

---

## 5. USUÁRIOS PRINCIPAIS

### Visitante
Acessa site público, marketplace público, páginas institucionais, login e cadastro.

### Atleta
Visualiza treinos publicados, calendário, detalhes de treino, feedback, evolução e relatórios compartilhados.

### Treinador
Cadastra atletas, prescreve treinos, organiza calendário, acompanha feedbacks, gera relatórios, cria planos e usa ENKY Intelligence.

### Admin / Superadmin
Gerencia plataforma, usuários, marketplace, planos, pagamentos, auditoria, configurações e suporte.

### Organização
Representa assessorias, equipes, studios, clubes e grupos com múltiplos treinadores e atletas.

---

## 6. PRINCÍPIOS INEGOCIÁVEIS DE ENGENHARIA

Toda implementação deve obedecer:
- segurança antes de funcionalidade;
- permissões validadas no servidor;
- dados reais e persistidos;
- fluxo completo antes de tela visual;
- treinador como decisor;
- IA como apoio, não substituição;
- calendário como centro operacional;
- métrica a serviço da decisão;
- marketplace responsável;
- logs para ações sensíveis;
- nenhuma ação destrutiva sem confirmação;
- nenhuma alteração em produção sem cautela;
- nenhuma rota vazia ou duplicada;
- nenhum mock como solução final.

---

## 7. ESCOPO DO MVP

O MVP da ENKY deve permitir o fluxo essencial:

1. Treinador cria conta.
2. Treinador acessa dashboard.
3. Treinador cadastra atleta.
4. Treinador cria treino.
5. Treino aparece no calendário.
6. Treinador publica treino.
7. Atleta acessa painel.
8. Atleta visualiza treino.
9. Atleta envia feedback.
10. Treinador recebe feedback.
11. Treinador revisa resposta.
12. Sistema registra dados.
13. Permissões protegem acesso.
14. Relatório simples pode ser gerado.

---

## 8. FUNCIONALIDADES OBRIGATÓRIAS DO MVP

### Autenticação
- login;
- cadastro;
- sessão;
- proteção de rotas;
- papéis.

### Papéis
- ADMIN;
- SUPERADMIN;
- TRAINER;
- ATHLETE.

### Treinador
- dashboard;
- cadastro de atletas;
- lista de atletas;
- perfil do atleta;
- criação de treino;
- calendário semanal;
- publicação de treino;
- visualização de feedback;
- relatório simples.

### Atleta
- dashboard;
- calendário/lista de treinos;
- detalhe do treino;
- feedback pós-treino;
- evolução simples;
- relatórios compartilhados.

### Admin
- dashboard protegido;
- usuários;
- treinadores;
- atletas;
- marketplace básico;
- pagamentos básicos;
- logs.

### Marketplace Inicial
- planos publicados;
- detalhe do plano;
- criação de plano;
- compra básica;
- status de pagamento;
- liberação de acesso.

---

## 9. FORA DO MVP

Não priorizar no MVP:
- app mobile nativo;
- integrações com Garmin/Strava;
- IA avançada;
- prescrição automática completa multiesporte;
- organizações complexas;
- white label;
- gamificação;
- rede social;
- API pública;
- academy;
- labs;
- dashboards excessivamente avançados.

Esses recursos devem ser preparados na arquitetura, mas não construídos antes do núcleo funcionar.

---

## 10. ARQUITETURA FUNCIONAL

A ENKY deve ser organizada em quatro grandes áreas:

1.  **Área pública:** home, sobre, para treinadores, para atletas, marketplace público, preços, login, cadastro.
2.  **Área do treinador:** dashboard, atletas, perfil do atleta, calendário, prescrição, periodização, avaliações, feedbacks, métricas, relatórios, marketplace, financeiro, configurações.
3.  **Área do atleta:** dashboard, calendário, treino do dia, detalhe do treino, feedback, evolução, relatórios, planos, perfil.
4.  **Área admin:** dashboard, usuários, treinadores, atletas, marketplace, planos, pagamentos, assinaturas, logs, configurações.

---

## 11. ROTAS RECOMENDADAS

### Público:
- `/`
- `/sobre`
- `/treinadores`
- `/atletas`
- `/marketplace`
- `/marketplace/[slug]`
- `/precos`
- `/login`
- `/cadastro`

### Treinador:
- `/treinador/dashboard`
- `/treinador/atletas`
- `/treinador/atletas/[id]`
- `/treinador/calendario`
- `/treinador/periodizacao`
- `/treinador/treinos`
- `/treinador/feedbacks`
- `/treinador/analises`
- `/treinador/relatorios`
- `/treinador/marketplace`
- `/treinador/financeiro`
- `/treinador/configuracoes`

### Atleta:
- `/atleta/dashboard`
- `/atleta/calendario`
- `/atleta/treinos/[id]`
- `/atleta/evolucao`
- `/atleta/relatorios`
- `/atleta/planos`
- `/atleta/perfil`

### Admin:
- `/admin/dashboard`
- `/admin/usuarios`
- `/admin/treinadores`
- `/admin/atletas`
- `/admin/marketplace`
- `/admin/planos`
- `/admin/pagamentos`
- `/admin/assinaturas`
- `/admin/logs`
- `/admin/configuracoes`

---

## 12. MODELO DE DADOS ESSENCIAL

Entidades essenciais do MVP:
- User
- TrainerProfile
- AthleteProfile
- CoachAthleteRelationship
- AthleteGroup
- Assessment
- TestResult
- Periodization
- TrainingWeek
- Workout
- WorkoutBlock
- Exercise
- WorkoutExercise
- WorkoutTemplate
- CalendarEvent
- WorkoutFeedback
- MetricRecord
- DerivedMetric
- AthleteInsight
- AIRecommendation
- Report
- MarketplacePlan
- MarketplacePurchase
- SubscriptionPlan
- Subscription
- PaymentTransaction
- Notification
- Message/Comment
- AuditLog
- FileAttachment
- SystemSetting

---

## 13. REGRAS DE MODELAGEM

- `User` representa pessoa autenticada.
- `TrainerProfile` representa dados profissionais do treinador.
- `AthleteProfile` representa dados esportivos do atleta.
- `CoachAthleteRelationship` controla vínculo treinador-atleta.
- `Workout` representa sessão prescrita.
- `WorkoutFeedback` pertence obrigatoriamente a um `Workout`.
- `CalendarEvent` representa evento temporal e pode se vincular a `Workout`.
- `MetricRecord` armazena métrica bruta.
- `DerivedMetric` armazena cálculo derivado.
- `AIRecommendation` registra recomendação da ENKY Intelligence.
- `AuditLog` registra ação sensível.
- `MarketplacePlan` representa plano vendido.
- `MarketplacePurchase` representa compra.
- `PaymentTransaction` representa pagamento.

*Regra crítica:*
- Não criar treino sem `athleteId` e `trainerId`.
- Não criar feedback sem `workoutId`.
- Não criar IA sem log.
- Não criar marketplace sem compra/pagamento quando houver transação.
- Não misturar `User` com `AthleteProfile`.

---

## 14. PERMISSÕES E SEGURANÇA

Permissões devem ser validadas no backend. O frontend pode ocultar botões, mas isso não é suficiente.

**Regras:**
- `/admin/*` somente ADMIN/SUPERADMIN;
- `/treinador/*` somente TRAINER autorizado;
- `/atleta/*` somente ATHLETE autorizado;
- treinador só acessa atletas vinculados;
- atleta só acessa seus dados;
- admin deve gerar log em ações sensíveis;
- ENKY Intelligence só acessa dados permitidos ao usuário;
- pagamentos controlam acesso comercial;
- assinatura pode limitar recursos.

---

## 15. AÇÕES QUE EXIGEM LOG

Devem gerar `AuditLog`:
- alteração de papel;
- criação/edição/exclusão de treino;
- movimentação de treino no calendário;
- publicação de treino;
- feedback sensível;
- geração de relatório;
- compartilhamento de relatório;
- recomendação relevante da IA;
- criação/publicação/rejeição de plano marketplace;
- pagamento;
- reembolso;
- assinatura;
- bloqueio/desbloqueio de usuário;
- alteração administrativa.

---

## 16. AÇÕES QUE EXIGEM CONFIRMAÇÃO

Exigem confirmação explícita:
- excluir;
- arquivar atleta;
- encerrar vínculo;
- cancelar treino;
- mover treino publicado;
- despublicar plano;
- bloquear usuário;
- alterar papel;
- aprovar/rejeitar plano marketplace;
- reembolsar pagamento;
- cancelar assinatura;
- apagar arquivo.

---

## 17. CALENDÁRIO COMO CENTRO OPERACIONAL

O calendário é o núcleo operacional da ENKY. Ele conecta: *periodização, prescrição, execução, feedback, análise, relatórios e ENKY Intelligence.*

**MVP do calendário:**
- visualização semanal do treinador;
- lista/semana para atleta;
- criação de treino;
- edição de treino;
- drag and drop com persistência;
- status do treino;
- publicação;
- feedback vinculado;
- permissões;
- loading;
- erro;
- estado vazio;
- log de ações sensíveis.

*Drag and drop:* Mover treino deve atualizar data no banco. Se treino estiver publicado, exigir confirmação. Atleta não pode mover treino.

---

## 18. PRESCRIÇÃO

Prescrição deve ser modular e multiesporte.

**Campos comuns:**
- atleta;
- treinador;
- modalidade;
- data;
- título;
- objetivo;
- descrição;
- duração planejada;
- intensidade planejada;
- status;
- publicação;
- origem;
- observações.

**Origem:** manual, template, periodização, ENKY Intelligence, marketplace, importado futuramente.

*Regra:* Prescrição automática é sempre rascunho editável até validação do treinador.

---

## 19. MODALIDADES

**Modalidades iniciais:** Corrida, Musculação, Treinamento funcional, Ciclismo, Natação, Triatlo.

**Prioridade MVP:** Corrida e Musculação/funcional básico.

**Expansão:** Ciclismo, Natação, Triatlo integrado.

*Regra:* Modalidade importa. Não copiar lógica da corrida para todas as modalidades.

---

## 20. CORRIDA

**Campos:** distância, duração, pace, FC, RPE, zona, tipo de treino, blocos, repetições, intervalo, superfície, observações técnicas.

**Tipos:** rodagem, longão, intervalado, tempo run, fartlek, regenerativo, progressivo, ritmo de prova, subida, teste, prova.

---

## 21. MUSCULAÇÃO

**Campos:** exercício, grupo muscular, padrão motor, séries, repetições, carga, RPE, RIR, intervalo, tempo, equipamento, observações, vídeo/imagem.

**Tipos:** força, hipertrofia, resistência, potência, full body, membros superiores, membros inferiores, core, preventivo, complementar ao endurance.

---

## 22. FUNCIONAL

**Campos:** exercício, padrão motor, circuito, rounds, tempo de trabalho, pausa, repetições, RPE, equipamento, nível, adaptação.

**Tipos:** circuito, EMOM, AMRAP, estações, mobilidade, core, força funcional, potência, resistência.

---

## 23. CICLISMO

**Campos futuros:** duração, distância, potência, FTP, FC, cadência, RPE, terreno, zona.

---

## 24. NATAÇÃO

**Campos futuros:** metragem, piscina, ritmo por 100m, séries, repetições, intervalo, material, educativos, técnica, RPE.

---

## 25. TRIATLO

Triatlo deve integrar modalidades.

**Campos futuros:** modalidade da sessão, treino combinado, brick, transição, distribuição semanal, volume por modalidade, carga total, prova-alvo.

*Regra:* Triatlo não é três planos isolados.

---

## 26. FEEDBACK DO ATLETA

**Feedback obrigatório no MVP:**
- realizado, parcial ou não realizado;
- RPE;
- duração real;
- distância/volume real quando aplicável;
- observação;
- dor/desconforto (local da dor, intensidade da dor);
- fadiga;
- recuperação percebida.

O feedback deve alimentar: dashboard do treinador, métricas, relatórios, ENKY Intelligence e próximos ajustes.

---

## 27. MÉTRICAS

A ENKY deve armazenar muitas métricas, mas exibir apenas o que ajuda a decidir.

**Grupos de métricas:** cadastro, prescrição, execução, aderência, carga externa, carga interna, intensidade, volume, densidade, recuperação, prontidão, fadiga, dor, performance, evolução, comportamento, marketplace, qualidade de dados, ENKY Intelligence.

**MVP de métricas:** atletas ativos, treinos de hoje, treinos publicados, feedbacks pendentes, aderência básica, planejado vs realizado, volume semanal, session-RPE simples, dor/desconforto relatado, atletas sem treino, alertas simples.

---

## 28. DASHBOARD DO TREINADOR

**Objetivo:** Ajudar o treinador a decidir o que fazer agora.

**Deve mostrar:**
- atletas ativos;
- treinos de hoje;
- feedbacks pendentes;
- atletas sem treino;
- alertas importantes;
- aderência semanal;
- carga semanal resumida;
- insights da ENKY Intelligence;
- atalhos de ação.

Não deve mostrar todas as métricas brutas.

---

## 29. DASHBOARD DO ATLETA

**Objetivo:** Dar clareza simples ao atleta.

**Deve mostrar:**
- treino de hoje;
- próximos treinos;
- status da semana;
- feedback pendente;
- evolução simples;
- mensagens do treinador;
- aderência pessoal;
- plano atual.

Evitar scores complexos ou alertas alarmistas.

---

## 30. DASHBOARD ADMIN

Deve mostrar: usuários, treinadores, atletas, vendas, assinaturas, marketplace, pagamentos, logs, atividade recente, erros, suporte.

---

## 31. ENKY INTELLIGENCE

A ENKY Intelligence é uma camada de inteligência aplicada.

**Ela deve:** interpretar dados, explicar sinais, sugerir opções, gerar relatórios, apoiar decisões, apontar dados insuficientes, classificar confiança, registrar recomendações.

**Ela não deve:** diagnosticar, prometer resultado, substituir treinador, publicar treino sozinha, mover treino sensível sozinha, acessar dados sem permissão, criar alerta sem ação.

**MVP da Intelligence:**
- card de atenção no dashboard do treinador;
- resumo no perfil do atleta;
- análise simples de feedback;
- planejado vs realizado;
- dados insuficientes;
- relatório simples;
- revisão básica da semana;
- `AIRecommendation` com log.

---

## 32. FORMATO PADRÃO DE INSIGHT

Toda resposta relevante da ENKY Intelligence deve conter:
- **Observação:** o que foi detectado.
- **Interpretação:** por que importa.
- **Dados usados:** transparência.
- **Nível de confiança:** baixa/moderada/alta.
- **Limitação:** o que falta.
- **Ação sugerida:** o que considerar.

---

## 33. RELATÓRIOS

**Relatório inicial deve conter:** atleta, período, objetivo, treinos planejados, treinos realizados, aderência, volume básico, feedbacks relevantes, pontos positivos, pontos de atenção, próximos focos, limitações dos dados, compartilhamento com atleta.

Relatório para treinador pode ser técnico. Relatório para atleta deve ser simples, educativo e sem linguagem alarmista.

---

## 34. MARKETPLACE

**Marketplace inicial:** vitrine pública, detalhe do plano, criação de plano, status do plano (draft/pending_review/published/rejected/archived), compra básica, pagamento, liberação de acesso, dashboard simples de vendas, revisão/admin básica.

**Todo plano deve conter:** modalidade, nível, objetivo, duração, frequência semanal, descrição, requisitos, "para quem é/não é", preço, aviso de responsabilidade.

*Proibido:* resultado garantido, lesão zero, promessa clínica, plano perfeito para todos, performance automática.

---

## 35. PAGAMENTOS E ASSINATURAS

**Entidades:** `SubscriptionPlan`, `Subscription`, `PaymentTransaction`, `MarketplacePurchase`.

**Status de pagamento:** pending, paid, failed, refunded, cancelled, disputed, expired.

*Acesso comercial:* Acesso ao plano comprado só deve ser liberado após pagamento confirmado ou regra clara.

*Assinatura SaaS:* Inadimplência não deve apagar dados. Preferir modo somente leitura ou bloqueio gradual.

---

## 36. BASE CIENTÍFICA

A ENKY deve respeitar: *individualidade biológica, especificidade, sobrecarga progressiva, adaptação, recuperação, reversibilidade, variabilidade, continuidade, volume/intensidade, periodização, carga interna/externa, aderência e consistência.*

**Regras:**
- não usar métrica isolada como decisão final;
- não prometer prever lesão ou diagnosticar;
- não tratar score como verdade;
- usar linguagem prudente;
- indicar dados insuficientes;
- preservar decisão do treinador.

---

## 37. LINGUAGEM DE SEGURANÇA

*   **Usar:** "os dados sugerem", "há sinais de atenção", "pode ser prudente revisar", "com os dados disponíveis", "nível de confiança moderado", "considere validar com o treinador/profissional adequado".
*   **Evitar:** "vai lesionar", "diagnóstico", "certeza", "resultado garantido", "treino perfeito", "risco eliminado".

---

## 38. REGRAS DE PRODUÇÃO E DEPLOY

*   **Obrigatório:** build passando, lint sem erro crítico, migrations revisadas, Prisma generate, envs corretas (`DATABASE_URL`), webhooks com segredo, rotas protegidas, logs de erro, seed seguro, backup.
*   **Proibido:** reset destrutivo em produção, seed que apaga dados reais, promoção automática de admin sem auditoria, webhook sem validação.

---

## 39. ORDEM DE IMPLEMENTAÇÃO PARA CLAUDE CODE

1.  Auditar estado atual.
2.  Corrigir autenticação e papéis.
3.  Corrigir proteção de rotas.
4.  Revisar Prisma/schema/migrations.
5.  Remover rotas vazias e duplicadas.
6.  Implementar entidades essenciais.
7.  Implementar fluxo treinador-atleta.
8.  Implementar calendário.
9.  Implementar prescrição.
10. Implementar feedback.
11. Implementar dashboard do treinador.
12. Implementar dashboard do atleta.
13. Implementar relatório simples.
14. Implementar marketplace básico.
15. Implementar pagamentos/assinatura básicos.
16. Implementar métricas iniciais.
17. Implementar ENKY Intelligence inicial.
18. Expandir modalidades.
19. Preparar organizações.
20. Preparar integrações futuras.

---

## 40. CHECKLIST DE AUDITORIA INICIAL

Verificar: *rotas vazias/duplicadas, componentes duplicados, dados mockados, telas sem backend, ações sem persistência, falhas de login/papéis, middleware frágil, `/admin` exposto, acessos indevidos (treinador/atleta), inconsistências no Prisma, migrations perigosas, webhook inseguro, marketplace sem pagamento, calendário apenas visual.*

---

## 41. CRITÉRIOS DE PRONTO

Uma entrega só está pronta quando: *funciona com dados reais, salva no banco, respeita permissões, tem loading/estado vazio, trata erros, tem validação, não usa mock, está conectada ao fluxo, tem log quando sensível, foi testada manualmente, não quebra build/permissões.*

---

## 42. PROIBIÇÕES PARA CLAUDE CODE

Claude Code não deve:
- criar telas soltas ou botões sem ação;
- usar mock como solução final;
- proteger apenas no frontend;
- permitir atleta editar prescrição ou treinador acessar atletas alheios;
- publicar treino gerado por IA sem validação;
- mover treino publicado sem confirmação;
- criar IA como chat genérico;
- apagar dados em produção ou rodar reset destrutivo;
- aceitar webhook sem segredo;
- promover admin por env;
- criar modalidade sem campos próprios ou score sem explicação;
- liberar plano sem pagamento.

---

## 43. RELATÓRIOS FINAIS OBRIGATÓRIOS DO AGENTE

Após cada ciclo de implementação, Claude Code deve entregar:
1. Objetivo da tarefa
2. O que foi analisado
3. O que foi implementado
4. Arquivos alterados
5. Entidades/tabelas alteradas
6. Rotas alteradas
7. Permissões afetadas
8. Migrations criadas
9. Comandos necessários
10. Testes manuais recomendados
11. Riscos resolvidos
12. Riscos restantes
13. Próxima ação recomendada

---

## 44. MVP VALIDADO — DEFINIÇÃO

O MVP será considerado validado tecnicamente quando: *treinador consegue cadastrar atleta e prescrever treinos; treinos aparecem no calendário e são publicados; atleta visualiza treinos e envia feedbacks; treinador revisa feedbacks; dados persistem no banco; permissões funcionam; admin está protegido; relatórios simples, marketplace básico e faturamento funcionam; métricas iniciais são calculadas; e a ENKY Intelligence inicial gera logs reais.*

---

## 45. MÉTRICAS DE VALIDAÇÃO DO PRODUTO

Acompanhar: *treinadores cadastrados/ativos, atletas cadastrados, treinos criados/publicados, feedbacks enviados, relatórios gerados, planos criados/vendidos, taxas de ativação (treinador/atleta), tempo até primeiro treino, bugs/semana, churn, retenção, uso do calendário/feedback/marketplace.*

---

## 46. DECLARAÇÃO DE FONTE ÚNICA

Quando houver conflito entre múltiplos documentos, priorizar:
1.  **ENKY 00 - Constitution**
2.  **Esta especificação Product & Engineering v1.0**
3.  **Regras de negócio e permissões**
4.  **Modelo de dados**
5.  **Roadmap MVP**
6.  **Arquitetura funcional**

---

## 47. PROMPT OPERACIONAL PARA ENTREGAR AO CLAUDE CODE

> ### PROMPT:
>
> Você atuará como engenheiro de software sênior e arquiteto técnico da ENKY.
>
> Antes de implementar qualquer coisa, leia integralmente o documento “ENKY OS — Product & Engineering Specification v1.0”. Este documento é a fonte única de verdade para engenharia.
>
> Sua primeira tarefa é auditar o projeto atual e comparar o código com essa especificação. Não implemente nada antes da auditoria.
>
> Entregue um relatório com:
> 1. problemas críticos;
> 2. problemas altos;
> 3. problemas médios;
> 4. problemas baixos;
> 5. riscos de segurança;
> 6. problemas no banco/Prisma/migrations;
> 7. rotas vazias ou duplicadas;
> 8. dados mockados;
> 9. telas sem backend;
> 10. fluxos quebrados;
> 11. ordem recomendada de correção.
>
> Depois da minha aprovação, implemente por fases, começando por autenticação, papéis, permissões, banco, fluxo treinador-atleta, calendário, prescrição e feedback.
>
> Regras obrigatórias:
> - não criar telas soltas;
> - não criar rotas duplicadas;
> - não usar mock como solução final;
> - não proteger apenas pelo frontend;
> - não apagar dados em produção;
> - não rodar reset destrutivo;
> - não publicar treino gerado por IA sem validação do treinador;
> - não permitir atleta editar prescrição;
> - não permitir treinador acessar atleta de outro treinador;
> - não criar IA genérica fora do contexto;
> - não criar marketplace sem pagamento/acesso controlado.
>
> Ao final de cada etapa, entregue relatório técnico com arquivos alterados, migrations, comandos, testes manuais, riscos resolvidos e riscos restantes.

---

## 48. DECLARAÇÃO FINAL

A ENKY deve ser simples no uso, profunda na lógica e segura na arquitetura.

Esta especificação existe para impedir retrabalho, de-sincronia técnica e desenvolvimento aleatório.

A engenharia deve construir primeiro o núcleo que funciona. Depois o núcleo que escala. Depois a inteligência que interpreta.

A ENKY não deve acumular telas. Deve construir fluxos reais.

Não deve parecer pronta. Deve funcionar.

Não deve usar IA para impressionar. Deve usar inteligência para transformar caos em clareza, clareza em decisão e decisão em performance.
