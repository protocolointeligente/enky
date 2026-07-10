# tests/e2e

Infraestrutura de testes end-to-end preparada com Playwright (`playwright.config.ts`), sem specs ainda.

Testes E2E reais começam na Fase seguinte, quando existirem fluxos de UI completos para validar (ver Constitution, Princípio 18: "não existe funcionalidade pronta sem fluxo completo"). Escrever E2E contra uma tela isolada e desconectada não agrega valor.

Antes do primeiro spec, instale os navegadores do Playwright localmente (download pesado, não incluído nesta fase):

```bash
npx playwright install
```
