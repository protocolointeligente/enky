// Fronteira entre o domínio de assinatura e o gateway de pagamento.
//
// Por que a abstração existe (Fase 10): o provedor escolhido é o Asaas, mas
// nenhuma regra de negócio deve conhecê-lo. Tudo que o domínio sabe é este
// arquivo — vocabulário da ENKY, não do gateway. Trocar de gateway, ou operar
// dois em paralelo, é escrever um novo adapter; nenhum serviço, rota ou tela
// muda. O `FakePaymentProvider` (dev/test) é a prova de que a fronteira é real:
// todo o fluxo — checkout, webhook, cancelamento — roda sem tocar a rede.
//
// A ENKY NUNCA recebe, processa ou persiste número de cartão, CVV ou validade
// (modules/payments/README.md). O adapter devolve uma URL do gateway e o
// pagamento acontece lá.

// Evento de webhook JÁ VERIFICADO e traduzido para o vocabulário da ENKY.
// Um adapter só produz isto depois de autenticar a requisição; o serviço de
// webhook nunca vê o corpo cru nem o formato do gateway.
export type PaymentEventType =
  // Pagamento confirmado — a única coisa que ATIVA uma assinatura.
  | "SUBSCRIPTION_ACTIVATED"
  // Pagamento de um novo ciclo confirmado.
  | "SUBSCRIPTION_RENEWED"
  // Cobrança vencida/estornada. NUNCA apaga dados — degrada para o
  // limite do plano grátis (regra da Fase 10).
  | "PAYMENT_FAILED"
  // Assinatura encerrada no gateway.
  | "SUBSCRIPTION_CANCELLED";

export interface PaymentWebhookEvent {
  // Id do evento no gateway (Asaas: `evt_...`). É a chave de idempotência —
  // o gateway reenvia o mesmo id em cada retentativa.
  eventId: string;
  type: PaymentEventType;
  // Assinatura no gateway (Asaas: `sub_...`) — como o evento é resolvido para
  // uma Subscription local.
  gatewaySubscriptionId: string;
  // Cobrança individual, quando o evento for de pagamento. Chave natural da
  // PaymentTransaction.
  gatewayPaymentId?: string;
  // Valor confirmado PELO GATEWAY, em reais. Conferido contra o preço do
  // plano no banco — nunca substitui esse preço.
  amount?: number;
  currency?: string;
  // Fim do ciclo pago, quando o gateway informa.
  currentPeriodEnd?: Date;
  // Tipo cru do gateway, só para auditoria/observabilidade.
  rawType: string;
}

export interface CreateSubscriptionCheckoutRequest {
  // Id da nossa Subscription — vai como referência externa no gateway, para
  // que um evento sempre volte a apontar para a linha certa.
  subscriptionId: string;
  planName: string;
  // Preço lido do BANCO (SubscriptionPlan.price), nunca do cliente.
  amount: number;
  currency: string;
  billingCycle: "MENSAL" | "ANUAL";
  customer: {
    // Reuso do cliente já criado no gateway, quando existir.
    gatewayCustomerId?: string;
    name: string;
    email: string;
    // Exigido pelo Asaas para criar cliente. Trafega apenas nesta chamada e
    // NUNCA é persistido pela ENKY — só o `gatewayCustomerId` retornado é.
    taxId: string;
  };
}

export interface CheckoutSession {
  gatewaySubscriptionId: string;
  gatewayCustomerId: string;
  // Para onde o navegador é enviado para pagar. A assinatura permanece
  // INCOMPLETE até um webhook confirmar — chegar nesta URL não ativa nada.
  redirectUrl: string;
}

export class WebhookVerificationError extends Error {}

export interface PaymentProvider {
  readonly name: string;

  createSubscriptionCheckout(request: CreateSubscriptionCheckoutRequest): Promise<CheckoutSession>;

  // Encerra a assinatura no gateway. O status local NÃO muda aqui — muda
  // quando o webhook de cancelamento chegar (regra: só evento confirmado
  // altera Subscription).
  cancelSubscription(gatewaySubscriptionId: string): Promise<void>;

  // Autentica a requisição e traduz o corpo. Lança WebhookVerificationError
  // se a assinatura/segredo não conferir — o chamador responde 401 e NADA é
  // processado. Retorna null para evento conhecido porém irrelevante (ex.:
  // PAYMENT_CREATED), que é registrado como IGNORED e descartado.
  parseWebhook(rawBody: string, headers: Headers): PaymentWebhookEvent | null;
}
