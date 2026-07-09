# ENKY 23 - ROADMAP MVP PARA PLATAFORMA COMPLETA
**Versão 1.0** — Diretrizes de Fases, Prioridades, Critérios de Entrega e Evolução Estratégica do Produto

---

## 1. OBJETIVO DESTE DOCUMENTO

Este documento define o roadmap de construção da ENKY, da versão MVP até a plataforma completa.

A função deste roadmap é impedir que o desenvolvimento se perca em funcionalidades soltas, telas duplicadas, automações prematuras ou recursos avançados antes do core funcionar.

A ENKY deve ser construída por fases.

Cada fase deve entregar valor real, reduzir risco e preparar a próxima etapa.

Este documento orienta:

- o que construir primeiro;
- o que deixar para depois;
- quais módulos são essenciais;
- quais recursos são vendáveis no MVP;
- quais recursos exigem validação;
- quais recursos dependem de dados acumulados;
- quais entregas Claude/Codex deve priorizar;
- quais critérios definem uma fase pronta.

---

## 2. PRINCÍPIO CENTRAL DO ROADMAP

**Construir primeiro o sistema que funciona.**

Depois o sistema que escala.

Depois o sistema que fica inteligente.

A ENKY não deve começar tentando ser a plataforma completa.

Deve começar com um núcleo sólido:

- login;
- papéis;
- treinador;
- atleta;
- cadastro de atletas;
- calendário;
- prescrição;
- feedback;
- análise simples;
- marketplace básico;
- pagamentos/assinatura controlados;
- dados persistidos;
- permissões seguras.

Sem isso, qualquer inteligência avançada será frágil.

---

## 3. VISÃO DE LONGO PRAZO

A ENKY deve evoluir para uma plataforma completa de inteligência esportiva com:

- SaaS para treinadores;
- gestão de atletas;
- prescrição multiesporte;
- calendário drag and drop;
- periodização;
- métricas e dashboards;
- ENKY Intelligence;
- marketplace;
- pagamentos;
- relatórios;
- biblioteca de treinos e exercícios;
- integrações com wearables;
- app mobile;
- academy;
- labs;
- API;
- expansão para modalidades e organizações.

---

## 4. FASES DO ROADMAP

*   **Fase 0** — Auditoria, estabilização e base técnica
*   **Fase 1** — MVP operacional vendável
*   **Fase 2** — Beta com treinadores reais
*   **Fase 3** — Marketplace e monetização inicial
*   **Fase 4** — Multiesporte estruturado
*   **Fase 5** — ENKY Intelligence aplicada
*   **Fase 6** — Plataforma completa para assessorias
*   **Fase 7** — Integrações, app mobile e escala
*   **Fase 8** — Ecossistema ENKY: Academy, Labs, API e expansão

---

## 5. FASE 0 — AUDITORIA, ESTABILIZAÇÃO E BASE TÉCNICA

**Objetivo:** Criar uma base segura antes de construir novos recursos.

**Prioridade:** Muito alta.

**Problema que resolve:** Evita que o sistema continue acumulando rotas vazias, código duplicado, dados frágeis, permissões inseguras e migrations perigosas.

**Entregas obrigatórias:**

- revisar autenticação;
- corrigir papéis;
- proteger `/admin`;
- revisar middleware;
- revisar banco;
- revisar Prisma schema;
- revisar migrations;
- remover rotas vazias;
- remover componentes duplicados;
- remover dados mockados em produção;
- garantir persistência;
- garantir que build funcione;
- garantir deploy estável na Vercel;
- revisar variáveis de ambiente;
- revisar webhooks;
- criar logs básicos;
- documentar estado atual.

**Critério de pronto:** O sistema faz build, deploy, login, proteção de rotas e acesso por papel sem erro crítico.

---

## 6. FASE 0 — O QUE NÃO FAZER

- Não criar nova IA.
- Não criar marketplace complexo.
- Não expandir modalidades.
- Não refazer interface inteira sem corrigir base.
- Não rodar reset destrutivo em produção.
- Não usar seed em produção sem controle.
- Não criar novas rotas duplicadas.

---

## 7. FASE 1 — MVP OPERACIONAL VENDÁVEL

**Objetivo:** Ter uma versão utilizável por treinadores reais, capaz de entregar valor básico e permitir venda inicial.

**Público:** Treinadores individuais e pequenas assessorias.

**Funcionalidades obrigatórias:**

- login;
- cadastro;
- papéis admin, treinador e atleta;
- dashboard do treinador;
- cadastro de atletas;
- perfil do atleta;
- calendário semanal;
- criação manual de treinos;
- publicação de treino para atleta;
- dashboard do atleta;
- visualização do treino pelo atleta;
- feedback pós-treino;
- status planejado/realizado/parcial/não realizado;
- feedback aparecendo para treinador;
- relatório simples;
- admin básico;
- logs essenciais;
- marketplace mínimo ou vitrine inicial;
- plano comercial simples.

---

## 8. FASE 1 — PRIORIDADE DE MODALIDADES

No MVP, priorizar:

1.  **Corrida**
2.  **Musculação/funcional básico**

*Por quê:*
- corrida já está mais alinhada à origem do produto;
- permite validação rápida com treinadores;
- musculação/funcional amplia valor para treinadores híbridos;
- evita lançar todas as modalidades mal feitas.

Ciclismo, natação e triatlo devem ficar preparados na arquitetura, mas não precisam estar completos no MVP.

---

## 9. FASE 1 — CRITÉRIOS DE SUCESSO

O MVP será considerado funcional se:

- treinador cadastra atleta;
- treinador cria treino;
- treino aparece no calendário;
- atleta visualiza treino;
- atleta envia feedback;
- treinador recebe feedback;
- treinador ajusta próximo treino;
- dados persistem;
- permissões funcionam;
- admin acessa painel protegido;
- não há mock crítico em produção;
- fluxo básico pode ser vendido e testado.

---

## 10. FASE 1 — O QUE NÃO FAZER

- Não tentar completar triatlo avançado.
- Não criar dashboards excessivos.
- Não criar IA complexa.
- Não criar integração com Garmin/Strava ainda.
- Não criar app mobile nativo.
- Não criar gamificação.
- Não criar rede social.
- Não criar marketplace com muitas regras antes de validar compra simples.

---

## 11. FASE 2 — BETA COM TREINADORES REAIS

**Objetivo:** Colocar o MVP nas mãos de treinadores teste e capturar feedback real.

**Ações:**

- selecionar 5 a 20 treinadores;
- acompanhar uso semanal;
- coletar dúvidas;
- registrar bugs;
- observar fluxo real;
- medir ativação;
- medir atletas cadastrados;
- medir treinos prescritos;
- medir feedbacks enviados;
- identificar telas confusas;
- ajustar UX;
- eliminar retrabalho.

**Indicadores de beta:**

- treinadores ativos semanalmente;
- atletas cadastrados por treinador;
- treinos criados;
- feedbacks enviados;
- problemas reportados;
- tempo para criar treino;
- taxa de abandono;
- funcionalidades mais usadas;
- funcionalidades ignoradas.

---

## 12. FASE 2 — ENTREGAS

- onboarding do treinador;
- tutorial rápido;
- estados vazios melhores;
- ajustes de UX;
- correções de bugs;
- logs de uso;
- painel simples de ativação;
- feedback interno;
- suporte manual estruturado;
- documentação de perguntas frequentes.

**Critério de pronto:** Treinadores conseguem operar sem acompanhamento constante e o fluxo principal se repete em uso real.

---

## 13. FASE 3 — MARKETPLACE E MONETIZAÇÃO INICIAL

**Objetivo:** Transformar conhecimento técnico em produto vendável.

**Funcionalidades:**

- vitrine pública de planos;
- detalhe do plano;
- criação de plano pelo treinador/admin;
- status de plano: rascunho, publicado, arquivado;
- compra básica;
- liberação de acesso;
- histórico de compra;
- plano aplicado ao atleta;
- dashboard simples de vendas;
- regras de promessa responsável;
- pagamentos com status.

**Planos iniciais recomendados:**

- corrida 5 km iniciante;
- corrida 10 km iniciante/intermediário;
- corrida 21 km;
- musculação complementar para corredores;
- funcional para corredores;
- plano base de condicionamento.

---

## 14. FASE 3 — REGRAS DE QUALIDADE DO MARKETPLACE

Todo plano deve ter:

- modalidade;
- nível;
- objetivo;
- duração;
- frequência;
- descrição clara;
- requisitos;
- para quem é;
- para quem não é;
- aviso de responsabilidade;
- preço;
- estrutura geral.

**Não permitir:**

- resultado garantido;
- promessa clínica;
- lesão zero;
- plano perfeito para todos;
- linguagem enganosa.

---

## 15. FASE 4 — MULTIESPORTE ESTRUTURADO

**Objetivo:** Expandir a ENKY sem virar sistema genérico.

**Ordem recomendada:**

1.  **Corrida completa**
2.  **Musculação/funcional estruturados**
3.  **Ciclismo**
4.  **Natação**
5.  **Triatlo integrado**

**Critério:** Só liberar modalidade quando possuir:
- campos próprios;
- tipos de treino;
- feedback específico;
- métricas próprias;
- calendário integrado;
- relatório mínimo;
- documentação;
- exemplos de prescrição.

---

## 16. FASE 4 — CICLISMO

**Entregas:**

- treinos por duração;
- potência/FTP;
- FC/RPE alternativa;
- zonas;
- cadência;
- blocos;
- feedback específico;
- dashboard básico de ciclismo;
- relatórios.

---

## 17. FASE 4 — NATAÇÃO

**Entregas:**

- metragem;
- séries;
- repetições;
- intervalo;
- ritmo por 100m;
- educativos;
- material;
- feedback técnico;
- dashboard básico de natação.

---

## 18. FASE 4 — TRIATLO

**Entregas:**

- distribuição por modalidade;
- treinos combinados;
- transições;
- volume total;
- carga acumulada;
- prova-alvo;
- equilíbrio semanal;
- relatórios integrados.

*Regra:* Triatlo não deve ser três planos isolados.

---

## 19. FASE 5 — ENKY INTELLIGENCE APLICADA

**Objetivo:** Inserir inteligência contextual nos pontos certos do produto.

**MVP da Intelligence:**

- resumo inteligente do atleta;
- lista de atletas que precisam de atenção;
- análise de feedback;
- comparação planejado vs realizado;
- alerta de dados insuficientes;
- geração de relatório simples;
- revisão básica de semana;
- sugestões na prescrição;
- logs de recomendações.

---

## 20. FASE 5 — INTELLIGENCE AVANÇADA

Após acumular dados:

- priorização inteligente de atletas;
- análise longitudinal;
- prescrição automática por modalidade;
- explicabilidade por métrica;
- revisão de marketplace;
- relatórios automáticos avançados;
- chat contextual;
- recomendações personalizadas por treinador;
- análise comercial;
- detecção de padrões de abandono.

*Regra:* A ENKY Intelligence deve nascer cautelosa, explicável e dependente de dados reais.

---

## 21. FASE 6 — PLATAFORMA COMPLETA PARA ASSESSORIAS

**Objetivo:** Atender organizações com múltiplos treinadores, grupos e operação maior.

**Funcionalidades:**

- organizations;
- memberships;
- múltiplos treinadores;
- grupos de atletas;
- permissões internas;
- assistentes;
- dashboard da assessoria;
- relatórios por grupo;
- marketplace da assessoria;
- white label futuro;
- gestão comercial;
- financeiro por organização;
- auditoria avançada.

---

## 22. FASE 6 — CRITÉRIO DE PRONTO

A plataforma estará pronta para assessorias quando:

- múltiplos treinadores operam sem conflito;
- atletas podem estar vinculados à organização;
- permissões internas funcionam;
- dados não vazam entre equipes;
- relatórios por grupo funcionam;
- billing por organização é possível;
- admin consegue auditar.

---

## 23. FASE 7 — INTEGRAÇÕES, APP MOBILE E ESCALA

**Objetivo:** Aumentar valor e reduzir fricção operacional.

**Integrações futuras:**

- Strava;
- Garmin;
- Polar;
- Coros;
- Wahoo;
- Apple Health;
- Google Fit;
- calendário externo;
- gateways de pagamento;
- WhatsApp/e-mail;
- webhooks.

**App mobile:**

- atleta primeiro;
- treino do dia;
- feedback rápido;
- notificações;
- calendário;
- evolução simples.

---

## 24. FASE 7 — REGRAS PARA INTEGRAÇÕES

Não integrar antes do core funcionar.

**Integrações devem:**

- exigir consentimento;
- registrar origem;
- evitar duplicidade;
- permitir desconexão;
- tratar dados inconsistentes;
- preservar treino prescrito;
- vincular atividade realizada ao treino planejado.

---

## 25. FASE 8 — ECOSSISTEMA ENKY

**Objetivo:** Expandir a ENKY além do SaaS operacional.

**Componentes:**

- ENKY Academy;
- ENKY Labs;
- ENKY API;
- ENKY Marketplace avançado;
- certificações;
- comunidade profissional;
- relatórios científicos;
- benchmarking anonimizado futuro;
- conteúdo educacional;
- parcerias.

---

## 26. ENKY ACADEMY

**Objetivo:** Educar treinadores e mercado.

**Conteúdos:**

- ciência do treinamento;
- uso da plataforma;
- prescrição multiesporte;
- análise de dados;
- IA aplicada ao esporte;
- marketing para treinadores;
- gestão de assessorias;
- marketplace.

---

## 27. ENKY LABS

**Objetivo:** Ser camada de pesquisa, inovação e validação.

**Funções:**

- testar métricas;
- validar modelos;
- revisar evidências;
- criar relatórios;
- desenvolver inteligência aplicada;
- estudar performance humana;
- apoiar diferença de marca.

---

## 28. ENKY API

**Objetivo:** Permitir integrações futuras com parceiros, wearables, organizações e sistemas externos.

Só deve ser considerada depois de:

- modelo de dados maduro;
- segurança forte;
- permissões claras;
- demanda real;
- documentação.

---

## 29. PRIORIZAÇÃO POR IMPACTO E RISCO

**Alta prioridade, alto impacto:**
- login;
- papéis;
- atletas;
- calendário;
- prescrição;
- feedback;
- dashboard treinador;
- permissões;
- persistência;
- logs.

**Alto impacto, médio risco:**
- marketplace básico;
- relatórios;
- periodização;
- métricas;
- ENKY Intelligence inicial.

**Alto impacto, alto risco:**
- prescrição automática avançada;
- integrações externas;
- IA contextual complexa;
- pagamentos completos;
- organizações multiusuário;
- app mobile.

**Baixa prioridade inicial:**
- gamificação;
- rede social;
- ranking público;
- chat genérico;
- estética avançada sem fluxo;
- integrações antes do core.

---

## 30. ROADMAP RECOMENDADO EM ORDEM EXECUTÁVEL

1.  **Etapa 1:** Estabilizar autenticação, papéis, banco, deploy e rotas.
2.  **Etapa 2:** Construir fluxo treinador-atleta-treino-feedback.
3.  **Etapa 3:** Fortalecer calendário drag and drop.
4.  **Etapa 4:** Criar relatórios simples e dashboard útil.
5.  **Etapa 5:** Criar marketplace básico vendável.
6.  **Etapa 6:** Criar métricas e alertas simples.
7.  **Etapa 7:** Adicionar ENKY Intelligence inicial.
8.  **Etapa 8:** Expandir modalidades.
9.  **Etapa 9:** Criar organizações/assessorias.
10. **Etapa 10:** Integrar wearables e app mobile.

---

## 31. CRITÉRIOS GERAIS DE PRONTO

Uma fase só está pronta quando:

- funciona com dados reais;
- salva no banco;
- respeita permissões;
- tem estados vazios;
- tem tratamento de erro;
- tem fluxo completo;
- não depende de mock em produção;
- foi testada manualmente;
- tem impacto claro no usuário;
- não quebra fluxo anterior;
- está documentada.

---

## 32. MÉTRICAS DE VALIDAÇÃO DO PRODUTO

**Métricas iniciais:**

- treinadores cadastrados;
- treinadores ativos semanalmente;
- atletas cadastrados;
- treinos criados;
- treinos publicados;
- feedbacks enviados;
- relatórios gerados;
- planos marketplace criados;
- planos vendidos;
- tempo até primeiro treino criado;
- taxa de ativação do treinador;
- taxa de ativação do atleta;
- bugs por semana;
- churn de treinadores.

---

## 33. SINAIS DE QUE O MVP ESTÁ FUNCIONANDO

- treinador volta a usar na semana seguinte;
- treinador cadastra mais atletas;
- atleta envia feedback sem ajuda;
- calendário vira rotina;
- treinador pede melhorias, não apenas correções;
- marketplace recebe interesse real;
- relatórios ajudam a comunicação;
- dados começam a alimentar insights;
- sistema reduz uso de planilhas/WhatsApp.

---

## 34. SINAIS DE ALERTA

- treinadores não conseguem cadastrar atletas;
- atletas não entendem treino;
- calendário é ignorado;
- feedback não é enviado;
- dashboard não orienta ação;
- marketplace não converte;
- IA gera texto genérico;
- muitos botões não funcionam;
- dados somem;
- permissões falham;
- deploy quebra com frequência.

---

## 35. ORDEM PARA CLAUDE/CODEX

Claude/Codex deve trabalhar nesta ordem:

1.  Auditar estado atual.
2.  Corrigir autenticação e papéis.
3.  Validar banco e migrations.
4.  Garantir rotas protegidas.
5.  Implementar entidades essenciais.
6.  Implementar fluxo de atleta.
7.  Implementar calendário.
8.  Implementar prescrição.
9.  Implementar feedback.
10. Implementar dashboard.
11. Implementar relatório simples.
12. Implementar marketplace básico.
13. Implementar pagamentos/assinatura básicos.
14. Implementar métricas.
15. Implementar ENKY Intelligence inicial.
16. Expandir modalidades.

---

## 36. O QUE CLAUDE/CODEX NÃO DEVE FAZER

- Não construir tudo ao mesmo tempo.
- Não criar telas fora do roadmap.
- Não priorizar estética sobre fluxo.
- Não criar IA avançada antes dos dados.
- Não criar marketplace complexo antes da compra básica.
- Não expandir modalidades sem estrutura.
- Não integrar wearables antes do calendário funcionar.
- Não criar app mobile antes de validar o webapp.
- Não refatorar indefinidamente sem entregar valor.
- Não apagar produção.

---

## 37. DECLARAÇÃO FINAL

A ENKY deve crescer com método.

Primeiro, uma base técnica segura.

Depois, um MVP que treinadores consigam usar.

Depois, validação com usuários reais.

Depois, marketplace e monetização.

Depois, multiesporte.

Depois, inteligência aplicada mais forte.

Depois, organizações, integrações, app e ecossistema.

Esse caminho protege a empresa contra o erro mais comum em produtos digitais: tentar parecer grande antes de funcionar bem.

A ENKY deve nascer simples no uso, profunda na lógica e escalável na arquitetura.

O objetivo não é lançar muitas funcionalidades.

O objetivo é construir uma plataforma que transforme caos em clareza, clareza em decisão e decisão em performance.
