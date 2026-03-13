import { renderBrandedDocumentHtml } from "@/lib/contracts/renderDocumentHtml";

export interface MinorPermitAnnexPayload {
  contractNumber: string;
  annexNumber: string;
  tripDestination: string;
  tripStartDate: string;
  tripEndDate: string;
  clientFullName: string;
  minorFullName: string;
  minorIdType: string;
  minorIdNumber: string;
  guardianName: string;
  guardianIdType: string;
  guardianIdNumber: string;
  guardianPhone: string;
  travelingAdultName: string;
  travelingAdultIdType: string;
  travelingAdultIdNumber: string;
  travelingAdultPhone: string;
  issuedAt: string;
}

export const renderMinorPermitAnnexPreview = (
  payload: MinorPermitAnnexPayload,
): string => {
  const lines: string[] = [];

  lines.push(`ANEXO DE AUTORIZACION PARA VIAJE DE MENOR DE EDAD ${payload.annexNumber || "-"}`);
  lines.push(`Contrato Numero: ${payload.contractNumber || "-"}`);
  lines.push("");
  lines.push(
    `Este anexo complementa el CONTRATO GENERAL DE VIAJE TURISTICO N. ${payload.contractNumber || "-"} y documenta la autorizacion del tutor/patria potestad para el menor indicado.`,
  );
  lines.push("");
  lines.push("PRIMERO: DATOS DEL MENOR");
  lines.push(`- Menor: ${payload.minorFullName || "-"}`);
  lines.push(`- Identificacion: ${payload.minorIdType || "-"} ${payload.minorIdNumber || "-"}`);
  lines.push(`- Destino del Tour: ${payload.tripDestination || "-"}`);
  lines.push(`- Fechas del Tour: ${payload.tripStartDate || "-"} a ${payload.tripEndDate || "-"}`);
  lines.push("");
  lines.push("SEGUNDO: DATOS DE QUIEN EJERCE PATRIA POTESTAD / TUTOR LEGAL");
  lines.push(`- Nombre completo: ${payload.guardianName || "-"}`);
  lines.push(`- Identificacion: ${payload.guardianIdType || "-"} ${payload.guardianIdNumber || "-"}`);
  lines.push(`- Telefono de contacto: ${payload.guardianPhone || "-"}`);
  lines.push("");
  lines.push("TERCERO: ADULTO RESPONSABLE QUE ACOMPANA AL MENOR DURANTE EL VIAJE");
  lines.push(`- Nombre completo: ${payload.travelingAdultName || "-"}`);
  lines.push(
    `- Identificacion: ${payload.travelingAdultIdType || "-"} ${payload.travelingAdultIdNumber || "-"}`,
  );
  lines.push(`- Telefono de contacto: ${payload.travelingAdultPhone || "-"}`);
  lines.push("");
  lines.push("CUARTO: DECLARACION DE AUTORIZACION");
  lines.push(
    "La persona firmante declara, bajo fe de juramento, que cuenta con facultades legales suficientes para autorizar el viaje del menor y exonera a Lucitours de responsabilidad por informacion inexacta o documentacion insuficiente aportada por el representante.",
  );
  lines.push("");
  lines.push("QUINTO: DOCUMENTO DE RESPALDO");
  lines.push(
    "Este anexo debe estar acompanado por el permiso notarial, judicial o documento equivalente exigido por la normativa migratoria aplicable.",
  );
  lines.push("");
  lines.push("FIRMAS");
  lines.push("1) Representante del menor (tutor / patria potestad):");
  lines.push("______________________________");
  lines.push(`${payload.guardianName || "-"}`);
  lines.push(`Identificacion: ${payload.guardianIdType || "-"} ${payload.guardianIdNumber || "-"}`);
  lines.push("");
  lines.push("2) Adulto que acompana al menor en el viaje:");
  lines.push("______________________________");
  lines.push(`${payload.travelingAdultName || "-"}`);
  lines.push(
    `Identificacion: ${payload.travelingAdultIdType || "-"} ${payload.travelingAdultIdNumber || "-"}`,
  );
  lines.push("");
  lines.push("3) Menor de edad identificado en este documento:");
  lines.push(`${payload.minorFullName || "-"}`);
  lines.push(`Identificacion: ${payload.minorIdType || "-"} ${payload.minorIdNumber || "-"}`);
  lines.push("");
  lines.push(`Fecha de emision: ${payload.issuedAt || "-"}`);

  return lines.join("\n").trim();
};

export const renderMinorPermitAnnexPreviewHtml = (
  payload: MinorPermitAnnexPayload,
): string =>
  renderBrandedDocumentHtml({
    bodyText: renderMinorPermitAnnexPreview(payload),
  });
