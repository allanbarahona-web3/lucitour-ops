export interface InsuranceExonerationPayload {
  contractNumber: string;
  annexNumber: string;
  tripDestination: string;
  tripStartDate: string;
  tripEndDate: string;
  clientFullName: string;
  travelerName: string;
  travelerRole: string;
  travelerIdType: string;
  travelerIdNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  hasOwnInsurance: boolean | null;
  issuedAt: string;
}

const yesNo = (value: boolean | null) => {
  if (value === true) {
    return "SI";
  }
  if (value === false) {
    return "NO";
  }
  return "PENDIENTE";
};

export const renderInsuranceExonerationPreview = (
  payload: InsuranceExonerationPayload,
): string => {
  const lines: string[] = [];

  lines.push(`ANEXO DE EXONERACION DE RESPONSABILIDAD POR SEGURO ${payload.annexNumber || "-"}`);
  lines.push(`Contrato Numero: ${payload.contractNumber || "-"}`);
  lines.push("");
  lines.push(
    `Este anexo complementa el CONTRATO GENERAL DE VIAJE TURISTICO N. ${payload.contractNumber || "-"} y documenta la exoneracion individual por seguro para el viajero indicado.`,
  );
  lines.push("");
  lines.push("PRIMERO: DATOS DE REFERENCIA");
  lines.push(`- Cliente titular: ${payload.clientFullName || "-"}`);
  lines.push(`- Viajero: ${payload.travelerName || "-"} (${payload.travelerRole || "-"})`);
  lines.push(`- Identificacion: ${payload.travelerIdType || "-"} ${payload.travelerIdNumber || "-"}`);
  lines.push(`- Destino del Tour: ${payload.tripDestination || "-"}`);
  lines.push(`- Fechas del Tour: ${payload.tripStartDate || "-"} a ${payload.tripEndDate || "-"}`);
  lines.push("");
  lines.push("SEGUNDO: DECLARACION SOBRE SEGURO");
  lines.push("- Desea seguro con Lucitours: NO");
  lines.push(`- Declara contar con seguro propio: ${yesNo(payload.hasOwnInsurance)}`);
  lines.push(
    "- Acepta que, al no contratar seguro con Lucitours, cualquier gestion, cobertura y atencion corresponde exclusivamente al viajero y/o su aseguradora.",
  );
  lines.push("");
  lines.push("TERCERO: EXONERACION DE RESPONSABILIDAD");
  lines.push(
    "El viajero declara que exime a Lucitours de responsabilidad por gastos medicos, hospitalarios, emergencias, cancelaciones, retrasos, perdida de equipaje u otras contingencias cubribles por seguro de viaje, en la medida permitida por ley.",
  );
  lines.push("");
  lines.push("CUARTO: CONTACTO DE EMERGENCIA");
  lines.push(`- Nombre: ${payload.emergencyContactName || "-"}`);
  lines.push(`- Telefono: ${payload.emergencyContactPhone || "-"}`);
  lines.push("");
  lines.push("FIRMAS");
  lines.push("Viajero / Representante:");
  lines.push("______________________________");
  lines.push(`${payload.travelerName || "-"}`);
  lines.push(`Identificacion: ${payload.travelerIdType || "-"} ${payload.travelerIdNumber || "-"}`);
  lines.push("");
  lines.push("Lucitours:");
  lines.push("______________________________");
  lines.push("Representante legal");
  lines.push("");
  lines.push(`Fecha de emision: ${payload.issuedAt || "-"}`);

  return lines.join("\n").trim();
};
