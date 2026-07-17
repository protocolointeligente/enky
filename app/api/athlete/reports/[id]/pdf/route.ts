import type { NextRequest } from "next/server";
import { getAthleteReportDocument } from "@/modules/reports/report-service";
import { renderReportPdf, reportPdfFilename } from "@/modules/reports/report-pdf";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { apiError } from "@/server/http/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pdfkit é Node puro — não roda no edge.

// PDF do relatório para o atleta. Passa pelo mesmo guarda da leitura: só
// PUBLISHED, e só o dele. Rascunho e revogado devolvem 404 aqui também — o PDF
// não é uma porta lateral para o que a tela esconde.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
    const { id } = await params;

    const document = await getAthleteReportDocument(id, organizationId, athleteProfileId);
    const pdf = await renderReportPdf(document);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportPdfFilename(document)}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
