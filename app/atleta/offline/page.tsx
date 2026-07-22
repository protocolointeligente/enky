import { uiClasses } from "@/app/_lib/ui";

// Fallback servido pelo service worker quando uma navegação falha offline (§50).
// Estático de propósito: não depende de sessão nem de rede para renderizar.
export default function OfflinePage() {
  return (
    <main className={uiClasses.page}>
      <div className={`${uiClasses.container} flex flex-col gap-3`}>
        <h1 className={uiClasses.heading}>Você está offline</h1>
        <p className="text-muted">
          Não foi possível carregar esta página. Os treinos já disponíveis no aparelho continuam
          acessíveis, e o que você registrar será sincronizado quando a conexão voltar.
        </p>
      </div>
    </main>
  );
}
