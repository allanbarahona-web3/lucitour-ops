# Consolidacion de contratos Lucitours

## Objetivo
Reducir variantes de contratos repetidos a un modelo mantenible:
- 2 contratos base
- Anexos condicionales segun reglas de negocio
- Previsualizacion obligatoria antes de envio/firma

## Inventario detectado en `varios.md`
Fuente: `src/components/admin/varios.md`

1. `AUTORIZACION Y CONSENTIMIENTO PARA REPRESENTACION DE MENOR...` (linea 1)
2. `EXONERACION DE RESPONSABILIDAD` (linea 15)
3. `CONTRATO DE VIAJE TURISTICO` cliente con cedula (linea 54)
4. `CONTRATO DE VIAJE TURISTICO` cliente extranjero con pasaporte (linea 231)
5. `CONTRATO DE VIAJE TURISTICO` cliente extranjero con DIMEX (linea 408)
6. `CONTRATO DE VIAJE TURISTICO` adulto + menor (linea 584)
7. `CONTRATO DE VIAJE TURISTICO PARA REVENTA` (linea 770)
8. `CONTRATO DE VIAJE TURISTICO` pago de contado (linea 941)

## Propuesta de unificacion
### Contratos base
1. `ContratoTuristicoEstandar`
2. `ContratoTuristicoReventa`

### Anexos
1. `AnexoExoneracion`
2. `AnexoAutorizacionMenor`
3. `AnexoAcompanantes` (si aplica listar acompanantes)
4. `AnexoCondicionesEspeciales` (opcional, para casos de proveedor/destino)
5. `AnexoSeguroExoneracionCobertura` (gestion por viajero, actualizable hasta 48h antes del viaje)

### Regla especial de seguro
- El contrato general solo referencia el anexo de seguro.
- El anexo de seguro se firma/actualiza despues de la reserva y hasta 48h antes del viaje.
- Si un viajero no compra seguro con Lucitours, su exoneracion individual es obligatoria.
- Si un viajero reporta seguro propio, se guarda comprobante como respaldo.

## Campos canonicos (payload)
```ts
export type ContractPayload = {
  contractType: "standard" | "resale";
  client: {
    fullName: string;
    civilStatus?: string;
    profession?: string;
    nationality?: string;
    idType: "cedula" | "passport" | "dimex";
    idNumber: string;
    address?: string;
    email?: string;
    phone?: string;
    emergencyContact?: { name?: string; phone?: string };
  };
  trip: {
    destinationCountry: string;
    startDate: string;
    endDate: string;
    itineraryItems: Array<{ date: string; activity: string }>;
    includesSupportStaff?: boolean;
  };
  travelers: Array<{
    fullName: string;
    idType: "cedula" | "passport" | "dimex" | "minor_id";
    idNumber: string;
    isMinor: boolean;
    guardianName?: string;
  }>;
  payment: {
    currency: "USD";
    totalAmount: number;
    vatIncluded: boolean;
    plan: "cash" | "installments";
    initialAmount?: number;
    installments?: Array<{ dueDate: string; amount: number }>;
    paidAt?: string;
    dueDate?: string;
  };
  resale?: {
    seatsIncluded?: number;
    checkInManagedByLucitours: boolean;
  };
  legal: {
    applyExonerationAnnex: boolean;
    applyMinorAuthorizationAnnex: boolean;
  };
};
```

## Reglas condicionales (motor)
1. Si `contractType === "resale"` -> usar `ContratoTuristicoReventa`.
2. Si `contractType === "standard"` -> usar `ContratoTuristicoEstandar`.
3. Si `client.idType === "passport"` -> render de comparecencia para pasaporte.
4. Si `client.idType === "dimex"` -> render de comparecencia para DIMEX.
5. Si `travelers.some(t => t.isMinor)` -> anexar `AnexoAutorizacionMenor`.
6. Si `travelers.length > 1` -> anexar `AnexoAcompanantes`.
7. Si `payment.plan === "cash"` -> clausula de contado.
8. Si `payment.plan === "installments"` -> clausula de cuotas y deposito.
9. Si `legal.applyExonerationAnnex` -> anexar `AnexoExoneracion`.

## Validaciones minimas antes de generar
1. Pais destino, fechas y monto total obligatorios.
2. Tipo y numero de identificacion del titular obligatorios.
3. Para menor: representante y documento de menor obligatorios.
4. Para cuotas: al menos una cuota y fecha limite de pago.
5. Para reventa: cantidad de personas incluida obligatoria.

## Flujo recomendado (producto)
1. Agente llena formulario.
2. Sistema normaliza `ContractPayload`.
3. Motor selecciona contrato base + anexos.
4. Se genera borrador para preview.
5. Usuario revisa, corrige y confirma.
6. Se bloquea version, se guarda auditoria y se envia/firma.

## Preview obligatorio
Pantalla de previsualizacion debe incluir:
1. Documento principal + anexos en orden final.
2. Semaforo de completitud por seccion (verde/amarillo/rojo).
3. Alertas de campos faltantes antes de aprobar.
4. Botones: `Volver a editar`, `Regenerar`, `Aprobar y enviar`.

## Backlog tecnico sugerido
1. Definir plantilla DOCX del contrato base estandar.
2. Definir plantilla DOCX de reventa.
3. Definir plantillas DOCX de anexos.
4. Implementar mapper formulario -> `ContractPayload`.
5. Implementar `selectContractAndAnnexes(payload)`.
6. Implementar endpoint de `preview`.
7. Implementar endpoint de `finalize/send` con versionado.

## Riesgos a resolver con asesoria legal
1. Duplicidad entre clausula de exoneracion en contrato y anexo separado.
2. Redaccion para menores cuando firma solo un representante.
3. Diferencias de responsabilidad en reventa vs venta directa.
4. Terminologia de retracto y devoluciones en todos los escenarios.

## Checklist de arranque (operativo)
1. Confirmar redaccion legal del contrato maestro.
2. Confirmar lista final de anexos oficiales.
3. Congelar nombres de variables de plantilla.
4. Probar 10 casos reales (normal, menor, pasaporte, dimex, contado, cuotas, reventa).
5. Activar despliegue gradual con bitacora de errores.
