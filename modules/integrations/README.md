# modules/integrations

Importa o **realizado** de fontes externas (Fase 11: Strava) para confrontar com o **planejado** que a ENKY prescreve.

## Regra estrutural: a integração é um periférico

Nenhum módulo de treino importa este. Se o Strava sair do ar, se as credenciais não existirem, se o token de um atleta for revogado — prescrever, publicar, executar e dar feedback continuam idênticos. Uma instalação **sem** credencial do Strava é uma instalação válida: as rotas de integração respondem 422 com mensagem explícita e o resto do produto não sabe que ela existe.

Isso é o oposto do módulo `payments`, onde a ausência de configuração em produção é um erro operacional. Aqui, ausência é um estado suportado.

## Onde cada regra da fase vive

| Regra | Onde |
| --- | --- |
| Tokens não aparecem em log | `external-connection.ts` — token não sai do módulo; `withFreshAccessToken` entrega para um callback e não devolve. `ConnectionView` não tem campo de token. |
| Tokens em repouso | `server/security/crypto.ts` — AES-256-GCM, chave derivada do `AUTH_SECRET` por HKDF. |
| Webhook valida verify token | `strava-provider.ts#verifySubscription` (o handshake GET). Ver abaixo por que o POST não tem equivalente. |
| Importação duplicada não duplica | Índice `uq_external_activity_provider_activity`, no banco. `import-activities.ts` trata o P2002 como sucesso. |
| Atleta pode revogar | `disconnectProvider` — apaga os tokens localmente **mesmo se** a revogação no Strava falhar. |
| Falha não quebra treino manual | Nenhuma importação do módulo `workouts` para cá; a UI de planejado × realizado degrada sozinha. |

## O webhook do Strava não é assinado — e por que isso não importa

O Asaas autentica cada POST com um segredo no header. **O Strava não.** Ele não assina o corpo; o `hub.verify_token` só existe no handshake `GET` que cria a inscrição. Qualquer um que descubra a URL pode POSTar um evento sintético.

A resposta do desenho não é fingir que validamos algo, é tornar a validação desnecessária:

1. O evento é tratado como **aviso**, nunca como dado — nada do corpo é gravado.
2. `owner_id` só serve para procurar uma conexão ativa nossa; desconhecido → descartado.
3. O dado vem da **API do Strava**, buscado com o nosso token, e a posse é reconferida contra o dono da conexão.

O pior que um POST forjado consegue é gastar uma chamada de API atrás de uma atividade que não existe. Não há caminho para injetar uma linha de dado falso.

## Decisões que o código não deriva sozinho

- **Vínculo é conservador**: data + modalidade, e só quando há **exatamente um** candidato. Dois treinos da mesma modalidade no dia → `AMBIGUOUS`, nenhum vínculo. Par errado é pior que par nenhum — o treinador ajustaria carga com base numa atribuição inventada. Vincular à mão é v2.
- **Pace canônico em s/km** para toda modalidade, natação inclusive (mesma decisão da Fase 6: volume é sempre km). A convenção de exibição (min/km, km/h, min/100m) é da UI — `app/_lib/activity-format.ts`.
- **Atividade sem modalidade mapeável é importada assim mesmo** (é volume real do atleta), só não vincula. Fingir que `Yoga` é `FUNCTIONAL` faria yoga cumprir um treino de funcional.
- **Desconectar não apaga as atividades já importadas**: são histórico de treino, não "dados do Strava".
- **Não existe provedor falso com fallback por variável de ambiente** (ao contrário de `payments`): um fake ativo por engano escreveria atividade **inventada** no histórico clínico do atleta. Os testes injetam o duplo explicitamente via `setActivityProviderForTests`.
- **Triatlo não é mapeado**: o Strava registra o triatlo como três atividades (Swim/Ride/Run), não uma.

## Fora do escopo da v1

- Vínculo manual atividade ↔ treino pela UI (hoje: automático ou nada).
- Consumir o realizado no motor de decisão (`modules/intelligence`) — ele lê feedback e carga; ligar a distância importada à equação de carga exige decidir como ela convive com o RPE auto-relatado, que é trabalho próprio.
- Séries temporais (streams de FC, splits), fotos, segmentos.
- Eventos `athlete` do webhook (revogação pelo site do Strava) — detectada na renovação de token seguinte.
- Outros provedores (Garmin, Polar): escrever um `ActivityProvider`; nada além do adapter muda.

## Setup do Strava (operacional)

1. Criar a aplicação em https://www.strava.com/settings/api. O *Authorization Callback Domain* precisa ser o domínio do deployment (sem protocolo, sem caminho).
2. `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` nas env vars.
3. `STRAVA_WEBHOOK_VERIFY_TOKEN`: um segredo escolhido por nós (`openssl rand -base64 32`).
4. Criar a inscrição do webhook (o Strava faz o GET de handshake no ato):
   ```
   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
     -F client_id=... -F client_secret=... \
     -F callback_url=https://SEU-DOMINIO/api/webhooks/strava \
     -F verify_token=SEU_VERIFY_TOKEN
   ```
   O `id` devolvido vai em `STRAVA_WEBHOOK_SUBSCRIPTION_ID`.
5. O Strava aceita **uma** inscrição por aplicação — preview e produção compartilhando o mesmo app disputam o webhook. Por isso `STRAVA_WEBHOOK_SUBSCRIPTION_ID` existe: eventos de outra inscrição são descartados.
