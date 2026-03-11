export interface InsuranceAnnexTraveler {
  travelerName: string;
  travelerRole: string;
  travelerIdType: string;
  travelerIdNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  wantsInsuranceWithLucitours: boolean | null;
  provider: string;
  hasOwnInsurance: boolean | null;
}

export interface InsuranceAnnexPayload {
  contractNumber: string;
  annexNumber: string;
  clientFullName: string;
  clientIdType: string;
  clientIdNumber: string;
  tripDestination: string;
  tripStartDate: string;
  tripEndDate: string;
  annexIssuedAt: string;
  annexSentAt: string;
  annexCutoffAt: string;
  includeEdwin: boolean;
  includeErick: boolean;
  lucitoursEdwinDate: string;
  lucitoursErickDate: string;
  clientDate: string;
  travelers: InsuranceAnnexTraveler[];
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

export const renderInsuranceAnnexPreview = (payload: InsuranceAnnexPayload): string => {
  const lines: string[] = [];
  const isSingleTraveler = payload.travelers.length === 1;
  const annexNumber = payload.annexNumber || "-";
  const contractNumber = payload.contractNumber || "-";

  lines.push(`ANEXO DE DECLARACION DE SEGURO DE VIAJE ${annexNumber}`);
  lines.push(`Contrato Numero: ${contractNumber}`);
  lines.push("");
  lines.push(`Este anexo complementa el CONTRATO GENERAL DE VIAJE TURISTICO N. ${contractNumber} y registra unicamente la declaracion de seguro de los viajeros.`);
  lines.push("");
  lines.push("CLAUSULAS");
  lines.push("PRIMERO: DATOS DE REFERENCIA DEL VIAJE");
  lines.push(`- Cliente titular: ${payload.clientFullName || "-"}`);
  lines.push(`- Documento titular: ${payload.clientIdType || "-"} ${payload.clientIdNumber || "-"}`);
  lines.push(`- Destino: ${payload.tripDestination || "-"}`);
  lines.push(`- Fechas del Tour: ${payload.tripStartDate || "-"} a ${payload.tripEndDate || "-"}`);
  lines.push("");
  lines.push("SEGUNDO: DECLARACION DE SEGURO POR VIAJERO");

  payload.travelers.forEach((traveler, index) => {
    lines.push("");
    lines.push(`${index + 1}. Viajero: ${traveler.travelerName} (${traveler.travelerRole})`);
    lines.push(`- Identificacion: ${traveler.travelerIdType || "-"} ${traveler.travelerIdNumber || "-"}`);
    lines.push(`- Contacto de emergencia: ${traveler.emergencyContactName || "-"}`);
    lines.push(`- Telefono emergencia: ${traveler.emergencyContactPhone || "-"}`);
    lines.push(`- Desea seguro con Lucitours: ${yesNo(traveler.wantsInsuranceWithLucitours)}`);

    if (traveler.wantsInsuranceWithLucitours === true) {
      lines.push(`- Proveedor del seguro: ${traveler.provider || "PENDIENTE"}`);
      lines.push(`- Plan/poliza: ${traveler.provider || "PENDIENTE"}`);
    } else {
      lines.push(`- Desea contratar seguro por su cuenta: ${yesNo(traveler.hasOwnInsurance)}`);
      lines.push("- Requiere anexo de exoneracion independiente: SI.");
    }

    if (!isSingleTraveler) {
      lines.push("Firma viajero/representante: ______________________________");
      lines.push(`Nombre: ${traveler.travelerName}`);
      lines.push(`Identificacion: ${traveler.travelerIdType || "-"} ${traveler.travelerIdNumber || "-"}`);
      lines.push(`Fecha: ${payload.clientDate || "-"}`);
    }
  });

  lines.push("");
  lines.push("TERCERO: FIRMA Y ACEPTACION");
  lines.push(isSingleTraveler ? "Firmas" : "Firmas de control administrativo");
  lines.push("Por Lucitours:");

  if (payload.includeEdwin) {
    lines.push("______________________________");
    lines.push("EDWIN EDUARDO BONILLA CORDERO");
    lines.push("Cedula de identidad: 3-0238-0791");
    lines.push("Representante legal");
    lines.push(`Fecha: ${payload.lucitoursEdwinDate || "-"}`);
  }

  if (payload.includeErick) {
    lines.push("______________________________");
    lines.push("ERICK JOSUE BONILLA PEREIRA");
    lines.push("Cedula de identidad: 1-1597-0559");
    lines.push("Representante legal");
    lines.push(`Fecha: ${payload.lucitoursErickDate || "-"}`);
  }

  lines.push("");
  lines.push(isSingleTraveler ? "Cliente / Tomador de seguro:" : "Cliente titular:");
  lines.push("______________________________");
  lines.push(payload.clientFullName || "-");
  lines.push(`Identificacion: ${payload.clientIdType || "-"} ${payload.clientIdNumber || "-"}`);
  lines.push(`Fecha: ${payload.clientDate || "-"}`);

  lines.push("");
  lines.push("Control administrativo:");
  lines.push(`- Fecha de emision de anexo: ${payload.annexIssuedAt || "-"}`);
  lines.push(`- Fecha/hora de envio a firma: ${payload.annexSentAt || "PENDIENTE"}`);

  return lines.join("\n").trim();
};
