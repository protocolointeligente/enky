import { redirect } from "next/navigation";

// Novidades saiu do ambiente autenticado e virou vitrine pública em /novidades.
// Mantemos este redirect (301 permanente) para não quebrar links antigos e
// bookmarks do treinador. ponytail: um redirect > manter a página duplicada.
export default function TrainerNewsRedirect() {
  redirect("/novidades");
}
