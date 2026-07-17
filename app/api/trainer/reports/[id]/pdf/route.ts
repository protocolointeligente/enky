import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getTrainerReportDocument } from "@/modules/reports/report-service";
import { renderReportPdf, reportPdfFilename } from "@/modules/reports/report-pdf";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError } from "@/server/http/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pdfkit é Node puro — não roda no edge.

// PDF do relatório para o treinador. Rascunho inclusive: é o que ele revisa
// antes de publicar. Escopo org+treinador garantido pelo serviço.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });
    const { id } = await params;

    const document = await getTrainerReportDocument(id, {
      userId: identity.userId,
      organizationId,
      trainerProfileId: trainerProfile.id,
    });
    const pdf = await renderReportPdf(document);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportPdfFilename(document)}"`,
        "Content-Length": String(pdf.byteLength),
        // Relatório é dado de saúde/desempenho: nunca em cache compartilhado.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
