# ANEXO DE DECLARACION DE SEGURO DE VIAJE {{annex.number}}

Contrato Numero: {{contract.number}}

> Este anexo complementa el `CONTRATO GENERAL DE VIAJE TURISTICO N. {{contract.number}}` y registra solo la declaracion de seguro por viajero.

## CLAUSULAS

### PRIMERO: Datos de referencia del viaje
- Cliente titular: `{{client.fullName}}`
- Documento titular: `{{client.idType}} {{client.idNumber}}`
- Destino: `{{trip.destinationCountry}}`
- Fechas del Tour: `{{trip.startDate}}` a `{{trip.endDate}}`

### SEGUNDO: Declaracion de seguro por viajero
Cada viajero (titular, acompanante o menor) debe tener una declaracion individual.

{{#each insurance.travelers}}
#### Viajero: {{travelerName}} ({{travelerRole}})
- Identificacion: {{travelerIdType}} {{travelerIdNumber}}
- Contacto de emergencia: {{emergencyContactName}}
- Telefono emergencia: {{emergencyContactPhone}}
- Desea seguro con Lucitours: {{wantsInsuranceWithLucitours}}

{{#if wantsInsuranceWithLucitours}}
- Proveedor del seguro: {{provider}}
- Plan/poliza: {{planName}}
{{else}}
- Desea contratar seguro por su cuenta: {{hasOwnInsurance}}
- Requiere anexo de exoneracion independiente: SI
{{/if}}

Firma viajero/representante: ______________________________
Nombre: {{signingName}}
Fecha: {{signingDate}}
{{/each}}

### TERCERO: Firma y aceptacion
Por Lucitours:

{{#if lucitours.signatories.includeEdwin}}
______________________________
EDWIN EDUARDO BONILLA CORDERO
Cedula de identidad: 3-0238-0791
Representante legal
Fecha: {{signatures.lucitoursEdwinDate}}
{{/if}}

{{#if lucitours.signatories.includeErick}}
______________________________
ERICK JOSUE BONILLA PEREIRA
Cedula de identidad: 1-1597-0559
Representante legal
Fecha: {{signatures.lucitoursErickDate}}
{{/if}}

Cliente titular:

______________________________
{{client.fullName}}
Identificacion: {{client.idType}} {{client.idNumber}}
Fecha: {{signatures.clientDate}}

### Control administrativo
- Fecha de emision de anexo: `{{annex.issuedAt}}`
- Fecha/hora de envio a firma: `{{annex.sentAt}}`
