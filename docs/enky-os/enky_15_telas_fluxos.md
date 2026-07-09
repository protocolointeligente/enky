# ENKY 15 - TELAS E FLUXOS OBRIGATÓRIOS
**Versão 1.0** — Telas, fluxos, ações, permissões e estados

---

## Estrutura de Áreas

| Área | Telas |
|------|-------|
| **Pública** | Home, Sobre, Para Treinadores, Para Atletas, Marketplace, Detalhe Plano, Login, Cadastro, Preços |
| **Treinador** | Dashboard, Atletas, Perfil Atleta, Avaliações, Calendário, Periodização, Prescrição, Biblioteca Treinos/Exercícios, Feedbacks, Análises, Relatórios, Marketplace, Financeiro, Config |
| **Atleta** | Dashboard, Calendário, Treino Detalhe, Feedback, Evolução, Relatórios, Planos, Perfil |
| **Admin** | Dashboard, Usuários, Treinadores, Atletas, Marketplace, Planos, Pagamentos, Logs, Config |

---

## Rotas Recomendadas

**Público:** `/`, `/sobre`, `/treinadores`, `/atletas`, `/marketplace`, `/marketplace/[plano]`, `/precos`, `/login`, `/cadastro`

**Treinador:** `/treinador/dashboard`, `/treinador/atletas`, `/treinador/atletas/[id]`, `/treinador/calendario`, `/treinador/periodizacao`, `/treinador/treinos`, `/treinador/analises`, `/treinador/relatorios`, `/treinador/marketplace`, `/treinador/financeiro`, `/treinador/configuracoes`

**Atleta:** `/atleta/dashboard`, `/atleta/calendario`, `/atleta/treinos/[id]`, `/atleta/evolucao`, `/atleta/relatorios`, `/atleta/planos`, `/atleta/perfil`

**Admin:** `/admin/dashboard`, `/admin/usuarios`, `/admin/treinadores`, `/admin/atletas`, `/admin/marketplace`, `/admin/planos`, `/admin/pagamentos`, `/admin/logs`, `/admin/configuracoes`

---

## Fluxos Obrigatórios

### Treinador
1. Cadastrar atleta: Dashboard → Atletas → Novo → Salvar → Perfil
2. Criar treino: Calendário/Perfil → Criar → Preencher → Salvar → Calendário
3. Mover treino: Calendário → Drag → Persistir → Log
4. Periodização: Atleta → Nova → Fases → Gerar → Calendário
5. Feedback: Dashboard → Pendente → Revisar → Ajustar
6. Relatório: Atleta → Novo → Gerar → Compartilhar
7. Marketplace: Novo plano → Preencher → Publicar

### Atleta
1. Ver treino: Dashboard → Treino hoje → Detalhe
2. Registrar: Detalhe → Realizado → Feedback → Enviar
3. Comprar: Marketplace → Plano → Comprar → Acesso

### Admin
1. Aprovar plano: Marketplace → Pendentes → Aprovar/Recusar → Log
2. Gerenciar usuário: Buscar → Alterar → Log

---

## Estados Obrigatórios (toda tela)
Carregando, erro, vazio, sem permissão, sucesso, confirmação destrutiva, validação, salvando, falha

---

## Critérios de Tela Pronta
Dados reais + permissão + ação principal + estados vazios + erro + persistência + mobile + loading + validação + confirmação + conexão com fluxo seguinte
