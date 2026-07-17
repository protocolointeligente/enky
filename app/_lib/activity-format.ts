// Formatação de grandezas do REALIZADO (Fase 11). Vive aqui, e não em cada
// página, para que treinador e atleta leiam o mesmo número da mesma forma.
//
// O banco guarda o ritmo em s/km para TODA modalidade (ver
// `ExternalActivity.paceSecondsPerKm`). A convenção de EXIBIÇÃO é por
// modalidade, e é este arquivo que a aplica — um ciclista não lê "3:00/km", ele
// lê "20,0 km/h"; um nadador não lê "12:30/km", ele lê "1:15/100m".

export function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}`;
  return `${minutes}min`;
}

function minutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  // 59,6s arredonda para 60 — que não existe num relógio.
  if (seconds === 60) return `${minutes + 1}:00`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatPace(secondsPerKm: number | null, modality: string | null): string | null {
  if (secondsPerKm === null || secondsPerKm <= 0) return null;

  switch (modality) {
    case "CYCLING":
      // Velocidade, não ritmo — é a convenção universal do ciclismo.
      return `${(3600 / secondsPerKm).toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
      })} km/h`;
    case "SWIMMING":
      // Por 100m, a convenção da natação.
      return `${minutesSeconds(secondsPerKm / 10)}/100m`;
    default:
      return `${minutesSeconds(secondsPerKm)}/km`;
  }
}
