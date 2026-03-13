export const CONTRACT_GENERAL_TEMPLATE = `# CONTRATO GENERAL DE VIAJE TURÍSTICO A {{trip.destinationCountry}}

## Contrato Número: {{contract.number}}

Entre nosotros:

(a)
{{#if lucitours.signatories.includeEdwin}}EDWIN EDUARDO BONILLA CORDERO, mayor de edad, divorciado, jubilado, portador de la cedula de identidad numero 3-0238-0791, vecino de Cartago, en condicion de representante legal, con facultades de apoderado generalisimo sin limite de suma de{{/if}}
{{#if lucitours.signatories.includeErick}}ERICK JOSUE BONILLA PEREIRA, mayor, soltero, administrador de agencia de viajes, portador de la cedula de identidad numero 1-1597-0559, vecino de Cartago, en condicion de representante legal, con facultades de apoderado generalisimo sin limite de suma de{{/if}}

VIAJES LUCITOURS TURISMO INTERNACIONAL SOCIEDAD ANÓNIMA, cédula jurídica número 3-101-874546, con domicilio social en la Provincia 03 Cartago, Cantón 01 Cartago, Occidental, frente a la tienda deportiva Carolina, en centro comercial, segunda planta primer local a mano izquierda Lucitours,
en adelante denominada "Lucitours"; y

(b) {{client.fullName}}, mayor de edad, {{client.civilStatus}}, {{client.profession}},
{{#if (eq client.idType "cedula")}}portador de la cédula de identidad número {{client.idNumber}}{{/if}}
{{#if (eq client.idType "passport")}}de nacionalidad {{client.nationality}}, portador del pasaporte número {{client.idNumber}}{{/if}}
{{#if (eq client.idType "dimex")}}portador del Documento de Identidad Migratorio para Extranjeros (DIMEX) número {{client.idNumber}}{{/if}},
vecino de {{client.address}}, correo electrónico {{client.email}}, teléfono {{client.phone}}, en adelante denominado como el "Cliente".

{{#if travelers.hasCompanions}}
Adicionalmente, comparecen como acompañantes del Tour:
{{#each travelers.companions}}
- {{fullName}}, mayor de edad, {{civilStatus}}, {{profession}}, portador de {{idTypeLabel}} número {{idNumber}}, vecino de {{address}}, correo electrónico {{email}}, teléfono {{phone}}.
{{/each}}
{{/if}}

{{#if travelers.hasMinors}}
El Cliente declara que viaja con menor(es) de edad:
{{#each travelers.minors}}
- {{fullName}}, documento de menor numero {{idNumber}}, en calidad de representado por {{guardianName}}.
{{/each}}
La autorización y consentimiento de representación de menor de edad se incorpora como anexo obligatorio de este Contrato.
{{/if}}

Haciendo mención a los comparecientes en conjunto, denominados como las "Partes", hemos convenido en celebrar el presente CONTRATO GENERAL DE VIAJE TURÍSTICO, el cual se regirá por las siguientes cláusulas:

## CLÁUSULAS

### PRIMERO: OBJETO
El presente Contrato será el documento base para regular las cláusulas y condiciones referentes a la contratación del paquete turístico internacional acordado entre las Partes.

### SEGUNDO: DESTINO
El país a visitar por parte del Cliente es {{trip.destinationCountry}}, y manifiesta expresamente que dicho destino fue elegido y reservado de forma voluntaria para la realización del Tour.

### TERCERO: FECHAS DEL TOUR Y PLAZO
Las fechas de ejecución del Tour serán del {{trip.startDate}} al {{trip.endDate}}, mismas que se entenderán como plazo del presente Contrato.

### CUARTO: PRECIO, FORMA DE PAGO Y MEDIOS DE PAGO
El precio total del Tour será por la suma de US$ {{payment.totalAmount}}, monto que incluye el 13% del Impuesto al Valor Agregado (IVA), tomando como referencia el tipo de cambio vigente del día: {{payment.exchangeRateText}} colones.

{{#if (eq payment.plan "installments")}}
El Cliente se compromete a pagar el precio final del Tour conforme al siguiente esquema:
- Pago inicial: US$ {{payment.initialAmount}} al momento de la firma del Contrato.
- Abonos o cuotas: {{payment.installmentsSummary}}.
- Fecha límite de pago total: {{payment.dueDate}}.
{{/if}}

{{#if (eq payment.plan "cash")}}
El monto total será cancelado en pago de contado en fecha {{payment.paidAt}}.
{{/if}}

Los medios de pago para realizar los pagos son los siguientes:
- Cuenta Bancaria (IBAN): CR25011610400074756807, Banco Promerica, a nombre de VIAJES LUCITOURS TURISMO INTERNACIONAL S.A.
- Sinpe Móvil: 7296-9551, a nombre de VIAJES LUCITOURS TURISMO INTERNACIONAL S.A.
- Pagos en efectivo o por tarjeta de débito/crédito en oficinas de Lucitours.

### QUINTO: DEPÓSITO DE RESERVA
{{#if (eq payment.plan "installments")}}
La cuota de reserva inicial se utiliza como depósito mínimo para reservar y garantizar el espacio del Cliente en el Tour y los operadores turísticos, por lo que dicho depósito no será transferible, reutilizable ni reembolsable.
{{/if}}

En caso de incumplimiento en pagos, Lucitours podrá notificar una fecha límite para poner al día los montos. De mantenerse el incumplimiento, Lucitours podrá excluir al Cliente del Tour y los dineros recibidos al momento no serán reembolsables, ya que se aplicarán a las penalidades que puedan existir por parte de los operadores del tour, sean estos aerolíneas, hoteles, traslados, etc.

### SEXTO: ALOJAMIENTOS Y HOSPEDAJES
Como parte del Tour, el Cliente podrá hospedarse en hoteles, hostels, airbnb u otros similares.
- Día de entrada: {{trip.startDate}}.
- Día de salida: {{lodging.checkOutDate}}.
Todo sujeto a disponibilidad del hospedaje y necesidades operativas del Tour, caso fortuito o de fuerza mayor.

### SÉTIMO: CHECK IN Y ASIGNACIÓN DE ASIENTOS
Lucitours realizará el check in según apertura de aerolínea.

{{#if sale.isResale}}
En modalidad reventa, el check in podra estar a cargo del Cliente revendedor, salvo acuerdo escrito distinto.
{{/if}}

La asignación de asientos la realiza la aerolínea de forma aleatoria. Lucitours no garantiza asientos juntos o cercanos.
Si se solicita asiento junto a acompañantes, debe gestionarse con al menos 15 días hábiles de anticipación y podrá generar costo adicional.

Equipaje permitido: {{trip.allowedLuggageText}}

### OCTAVO: SEGURO DE VIAJE
Lucitours podrá colaborar con la adquisición de seguro de viaje mediante agencia aliada Assist Card, siendo opcional para el Cliente.

El Cliente acepta que, al no contratar seguro con Lucitours o bien no contar con un seguro viajero propio durante el Tour en este mismo acto, exonera a Lucitours de toda responsabilidad por cualquier accidente, enfermedad, gasto médico, muerte o repatriación.

Asimismo, el Cliente declara que exime a Lucitours, en este mismo acto y en la medida permitida por ley, de responsabilidad por gastos médicos, hospitalarios, emergencias, cancelaciones, retrasos, pérdida de equipaje u otras contingencias cubribles por el seguro de viaje.

### NOVENO: PERSONAL DE ACOMPAÑAMIENTO
Dependiendo del Tour, Lucitours podrá asignar personal de acompañamiento desde Costa Rica.
El Cliente debe presentarse con al menos 3 horas de anticipación al aeropuerto y con toda la documentación requerida para viajar.
Lucitours no será responsable por llegada tardía, documentos vencidos o documentación incompleta del Cliente.

### DÉCIMO: FICHA DE ACTIVIDADES E ITINERARIO
Itinerario general:
{{#each trip.itineraryItems}}
- Fecha: {{date}} | Actividad: {{activity}}
{{/each}}

Lucitours podrá modificar itinerario, ruta, hospedajes u orden del Tour cuando sea necesario para seguridad, resguardo y ejecución efectiva del servicio.

### DÉCIMO PRIMERO: TRANSPORTES
Lucitours brindará, por medio de terceros contratados, transportes relacionados con el Tour (vehículo privado, microbús, colectivo o transporte público).
Todo transporte fuera de itinerario corre por cuenta del Cliente.

### DÉCIMO SEGUNDO: ALIMENTACIÓN
El Tour no incluye alimentación, salvo indicación expresa en la publicación del tour o bien que el hospedaje indique que se incluye el desayuno con el hospedaje; por lo tanto, el Cliente debe asumir sus costos de alimentación durante el tour.

### DÉCIMO TERCERO: CANCELACIÓN DEL TOUR
La cancelación del Tour podrá darse por:
- Enfermedad/muerte debidamente justificadas.
- Imposibilidad de prestación por parte del operador.
- Fuerza mayor o caso fortuito (clima extremo, cierre de aeropuertos, guerras, pandemias, sobreventa, etc.).
- Causas no previstas que imposibiliten la ejecución del Tour.

En los supuestos que correspondan, Lucitours gestionará reintegros ante terceros operadores y podrá aplicar penalidades conforme políticas de proveedores.

### DÉCIMO CUARTO: DERECHOS Y OBLIGACIONES DEL CLIENTE
El Cliente se obliga, entre otros, a:
- Pagar los montos económicos según contrato.
- Brindar documentación veraz y vigente.
- Respetar horarios, itinerarios y normas de proveedores.
- Resguardar pertenencias personales.
- Asumir gastos no incluidos.
- Gestionar correctamente documentación de menor(es), cuando aplique.

### DÉCIMO QUINTO: DERECHOS Y OBLIGACIONES DE LUCITOURS
Lucitours se obliga, entre otros, a:
- Ejecutar el Tour contratado.
- Contratar y pagar a proveedores del servicio.
- Brindar acompañamiento contractual y soporte operativo.
- Gestionar check in cuando corresponda.

### DÉCIMO SEXTO: EXONERACIÓN DE RESPONSABILIDAD
El Cliente exonera a Lucitours por eventos no atribuibles directamente a su gestión, incluyendo, entre otros:
- Enfermedades, accidentes, robos o pérdidas durante el Tour.
- Atrasos, desvío o pérdida de vuelos.
- Cierre de atracciones o condiciones climáticas adversas.
- Eventualidades de terceros proveedores.
- Problemas por documentación dudosa, falsa, vencida o insuficiente.

### DÉCIMO SÉTIMO: MODIFICACIONES AL CONTRATO
Toda modificación deberá formalizarse por escrito mediante adenda firmada por las Partes.

### DÉCIMO OCTAVO: RESOLUCIÓN ALTERNA DE CONFLICTOS Y LEY APLICABLE
Este Contrato se regirá por la legislación de la República de Costa Rica. Cualquier controversia intentará resolverse primero por vía conciliatoria antes de acudir a la vía judicial.

### DÉCIMO NOVENO: CONFIDENCIALIDAD
Toda información comercial, operativa y documental conocida con ocasión del Contrato será tratada como confidencial durante su vigencia y por un año adicional a su terminación.

### VIGÉSIMO: NOTIFICACIONES Y COMUNICACIONES
- Lucitours:
  - Correo: contratos@lucitour.com
  - WhatsApp: 6015-9906
- Cliente:
  - Dirección: {{client.address}}
  - Correo: {{client.email}}
  - WhatsApp/Teléfono: {{client.phone}}
  - Contacto de emergencia: {{client.emergencyContact.name}} - {{client.emergencyContact.phone}}

### VIGÉSIMO PRIMERO: INTEGRIDAD CONTRACTUAL
Las Partes aceptan que este Contrato y sus anexos constituyen el acuerdo total entre ellas respecto del Tour contratado.

En fe de lo anterior, las Partes declaran haber leído y comprendido integralmente el presente Contrato, aceptándolo en todas sus cláusulas.

## FIRMAS

Número de contrato: {{contract.number}}

Lucitours:

{{#if lucitours.signatories.includeEdwin}}
______________________________
P/ VIAJES LUCITOURS TURISMO INTERNACIONAL S.A.
EDWIN EDUARDO BONILLA CORDERO
Cédula de identidad: 3-0238-0791
Representante legal
Fecha: {{signatures.lucitoursEdwinDate}}
{{/if}}

{{#if lucitours.signatories.includeErick}}
______________________________
P/ VIAJES LUCITOURS TURISMO INTERNACIONAL S.A.
ERICK JOSUE BONILLA PEREIRA
Cédula de identidad: 1-1597-0559
Representante legal
Fecha: {{signatures.lucitoursErickDate}}
{{/if}}

Cliente:

______________________________
{{client.fullName}}
{{client.idTypeLabel}}: {{client.idNumber}}
Fecha: {{signatures.clientDate}}

{{#if travelers.hasCompanions}}
Acompañante(s):
{{#each travelers.companions}}
______________________________
{{fullName}}
{{idTypeLabel}}: {{idNumber}}
Fecha: {{../signatures.clientDate}}
{{/each}}
{{/if}}

{{#if travelers.hasMinors}}
Representante de menor(es):
______________________________
{{minors.guardianSignatureName}}
Fecha: {{signatures.clientDate}}
{{/if}}
`;
