"use client";

import { useEffect, useState } from "react";
import { uiClasses } from "@/app/_lib/ui";
import { Modal } from "@/components/ui/modal";

// Confirmação de ação administrativa (Fase 9).
//
// Duas travas, deliberadamente:
//  1. o admin precisa confirmar num diálogo — nada acontece por um clique só;
//  2. quando a ação é destrutiva (bloquear/suspender), o motivo é OBRIGATÓRIO e
//     vai para o AuditLog. O servidor exige o mesmo (admin-schema.ts) — isto
//     aqui é conveniência da UI, não a garantia.
//
// O nome do alvo é repetido no corpo porque o diálogo abre a partir de uma
// tabela: sem isso, é fácil confirmar na linha errada.

export interface ConfirmActionTarget {
  title: string;
  description: string;
  targetName: string;
  confirmLabel: string;
  destructive: boolean;
}

interface Props {
  target: ConfirmActionTarget | null;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function ConfirmActionDialog({ target, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limpa o motivo a cada abertura — reaproveitar o texto da ação anterior
  // gravaria na trilha uma justificativa que não é desta ação.
  useEffect(() => {
    setReason("");
    setError(null);
  }, [target]);

  if (!target) return null;

  const reasonTooShort = target.destructive && reason.trim().length < 5;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={target.title}
      description={target.description}
      footer={
        <>
          <button
            type="button"
            className={uiClasses.buttonSecondary}
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={target.destructive ? uiClasses.buttonDanger : uiClasses.button}
            onClick={handleConfirm}
            disabled={submitting || reasonTooShort}
          >
            {submitting ? "Aplicando..." : target.confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Alvo: <span className="font-semibold text-ink">{target.targetName}</span>
      </p>

      <div>
        <label className={uiClasses.label} htmlFor="admin-action-reason">
          Motivo {target.destructive ? "(obrigatório)" : "(opcional)"}
        </label>
        <textarea
          id="admin-action-reason"
          className={uiClasses.textarea}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex.: solicitação do titular, inadimplência, suspeita de fraude..."
        />
        <p className={`${uiClasses.hint} mt-1`}>
          Fica registrado no log de auditoria junto com seu usuário e a data.
        </p>
      </div>

      {error && <p className={uiClasses.error}>{error}</p>}
    </Modal>
  );
}
