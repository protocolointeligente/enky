# ENKY — Importação e Exportação (Etapa 4 §26–27)

> Formatos e fluxos de CSV da Gestão. Só dados **comerciais** — dado de
> saúde/fisiológico nunca entra (§27/§29).

## 1. Exportação (§27)

Rota: `GET /api/trainer/export/[entity]` → `text/csv` (download). Permissão = a
mesma **leitura** da entidade (`requireOrgRole`). CSV com escape RFC-4180 + BOM
(abre bem no Excel pt-BR).

| Entidade | Colunas |
| --- | --- |
| `leads` | Nome, E-mail, Telefone, Origem, Status, Valor estimado, Criado em |
| `clients` | Nome, E-mail, Telefone, Documento, Status, Criado em |
| `contracts` | Cliente, Plano, Status, Valor final, Início, Término |
| `invoices` | Cliente, Competência, Vencimento, Valor final, Status |

Botões "Exportar CSV" no cabeçalho de cada lista.

**Deferido:** export de athletes/inadimplentes/treinadores/grupos; e um export
que inclua dado de saúde exigiria consentimento explícito e nunca entra no export
comercial padrão.

## 2. Importação de clientes (§26)

Rota: `POST /api/trainer/clients/import` (MANAGER/SUPPORT). Fluxo em **dois
passos** para nunca sobrescrever silenciosamente:

```
{ csv, preview: true }   → valida, NÃO escreve → { headerError, rows[], summary }
{ csv }                  → importa só as linhas VÁLIDAS (insert-only)
```

### Cabeçalho esperado

Mapeamento por nome de coluna (case-insensitive, pt/en):

| Campo | Cabeçalhos aceitos | Obrigatório |
| --- | --- | --- |
| Nome | `nome`, `name` | **sim** |
| E-mail | `email`, `e-mail` | não |
| Telefone | `telefone`, `phone`, `celular` | não |
| Documento | `documento`, `document`, `cpf`, `cnpj` | não |

### Regras

- Máx. **1000 linhas** por importação.
- Validação por linha: nome não-vazio (≤200), e-mail com formato válido se
  presente. Linhas com erro são **puladas** (relatadas no preview), nunca importadas.
- Import = **insert-only** (status `PROSPECT`). **Nunca** atualiza/sobrescreve
  registro existente. Dedup por documento/e-mail é refinamento futuro (rodar duas
  vezes cria duplicatas — intencional e visível).
- Auditado (`IMPORT_CLIENTS`, com contagem).

### Exemplo de CSV

```csv
nome,email,telefone,documento
Maria Silva,maria@exemplo.com,11999990000,12345678900
"Empresa X, Ltda",contato@empresax.com,,11222333000144
```

### UI

Modal na lista de clientes: colar CSV ou upload de arquivo → **Pré-visualizar**
(mostra válidos/erros por linha) → **Importar N**.

**Deferido:** mapeamento livre de colunas (arrastar cabeçalho→campo), importação
de atletas/planos/contratos/pagamentos.

## 3. LGPD nos dados (§29)

- **Exportar dados do titular:** `GET /clients/[id]/lgpd` → JSON com cliente +
  contratos + faturas + comunicações (auditado, `EXPORT_CLIENT_DATA`).
- **Anonimizar:** `POST /clients/[id]/lgpd {action:"anonymize"}` — apaga a PII do
  cliente, **preserva** contratos/faturas (retenção legal), status → ARCHIVED
  (auditado, `ANONYMIZE_CLIENT`).
