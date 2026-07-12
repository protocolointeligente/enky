/* eslint-disable @next/next/no-img-element */

// Logo oficial ENKY, theme-aware. O símbolo (laranja) é agnóstico; o wordmark
// troca por tema via [data-theme-img] (CSS em globals.css) — branco no escuro,
// petróleo no claro. Sem flash: só a variante do tema atual é exibida.
export function BrandLogo({
  wordmark = true,
  className = "",
}: {
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/brand/enky-symbol.png"
        alt={wordmark ? "" : "ENKY"}
        aria-hidden={wordmark ? true : undefined}
        className="h-6 w-auto"
      />
      {wordmark && (
        <>
          <img
            data-theme-img="dark"
            src="/brand/enky-wordmark-ondark.png"
            alt="ENKY"
            className="h-4 w-auto"
          />
          <img
            data-theme-img="light"
            src="/brand/enky-wordmark-onlight.png"
            alt="ENKY"
            className="h-4 w-auto"
          />
        </>
      )}
    </span>
  );
}
