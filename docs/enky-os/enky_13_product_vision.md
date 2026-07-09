# ENKY 13 - PRODUCT VISION & SCOPE
**Versão 1.0** — Documento-mãe de visão, escopo e direção de produto

---

## Visão de Produto

> Plataforma SaaS de inteligência esportiva que integra gestão, prescrição, calendário, análise, marketplace e IA para transformar dados em decisões melhores.

---

## Usuários

| Perfil | Objetivo principal |
|--------|-------------------|
| **Superadmin** | Gestão da plataforma, usuários, marketplace, logs, segurança |
| **Treinador** | Cadastrar atletas, prescrever, calendário, análise, relatórios, vender planos |
| **Atleta** | Ver treinos, registrar execução, feedback, evolução, comprar planos |
| **Visitante** | Conhecer ENKY, marketplace, cadastro |

---

## 20 Módulos

1. Autenticação e papéis
2. Dashboard treinador
3. Dashboard atleta
4. Dashboard admin
5. Gestão de atletas
6. Avaliações e perfil
7. Periodização
8. Prescrição de treinos
9. **Calendário drag & drop** (centro operacional)
10. Biblioteca de treinos/exercícios
11. Modalidades esportivas
12. Feedback e execução
13. Análises e dashboards
14. Relatórios
15. ENKY Intelligence
16. Marketplace
17. Pagamentos e assinaturas
18. Comunicação e notificações
19. Logs e auditoria
20. Configurações

---

## Calendário = Centro Operacional

Visualizar dia/semana/mês, drag & drop, copiar/duplicar/mover treinos, criar direto no calendário, status de execução, feedback, diferenciar modalidades, análise semanal.

---

## 6 Modalidades Iniciais

| Modalidade | Métricas-chave |
|-----------|---------------|
| **Corrida** | Distância, pace, FC, RPE, zonas, volume, VDOT |
| **Ciclismo** | Potência, FTP, cadência, FC, RPE, zonas de potência |
| **Natação** | Metragem, ritmo/100m, séries, educativos, intervalo |
| **Triatlo** | Distribuição 3 modalidades, carga total, transições |
| **Musculação** | Exercício, séries, reps, carga, RPE/RIR, grupo muscular |
| **Funcional** | Circuito, rounds, tempo, padrão motor, densidade |

---

## MVP Essencial

- Autenticação + papéis (admin, treinador, atleta)
- Dashboard treinador + atleta
- Cadastro de atletas + perfil
- Calendário drag & drop básico
- Criação manual de treinos (corrida inicial)
- Feedback do atleta
- Relatório simples
- Marketplace básico
- Admin básico + logs
- ENKY Intelligence inicial (resumo/análise simples)

---

## Fluxo Integrado

```
Atleta cadastrado → objetivo → periodização → treinos no calendário
→ atleta executa → feedback → dados analisados → Intelligence gera insight
→ treinador ajusta → relatório mostra evolução
```

---

## Critérios de Sucesso do MVP

- Treinadores cadastram atletas sem dificuldade
- Atletas veem e registram treinos
- Calendário funciona como centro da rotina
- Prescrição rápida e editável
- Feedback retorna ao treinador
- Relatórios fazem sentido
- Marketplace vende planos básicos
- Dados persistidos corretamente
- Permissões funcionam
- Plataforma reduz caos real

---

## Diretrizes para Desenvolvimento

- Não criar rotas vazias ou duplicar funções
- Papéis claros, persistência no banco
- Calendário como centro, treinador no controle
- Componentes reutilizáveis, UX clara
- Mobile-first, estados vazios úteis
- Respeitar escopo do MVP
- Documentar decisões técnicas

---

## Documentos Técnicos Complementares (ENKY 14–24)

14-Arquitetura Funcional | 15-Telas e Fluxos | 16-Calendário | 17-Modalidades | 18-Métricas | 19-Base Científica | 20-Intelligence no Produto | 21-Modelo de Dados | 22-Regras de Negócio | 23-Roadmap MVP | 24-Prompt Master
