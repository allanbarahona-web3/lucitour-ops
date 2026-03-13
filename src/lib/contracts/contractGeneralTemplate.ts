export const CONTRACT_GENERAL_TEMPLATE = `# CONTRATO GENERAL DE VIAJE TURISTICO A {{trip.destinationCountry}}

## Contrato Numero: {{contract.number}}

Entre nosotros:

(a)
{{#if lucitours.signatories.includeEdwin}}EDWIN EDUARDO BONILLA CORDERO, mayor de edad, divorciado, jubilado, portador de la cedula de identidad numero 3-0238-0791, vecino de Cartago, en condicion de representante legal, con facultades de apoderado generalisimo sin limite de suma de{{/if}}
{{#if lucitours.signatories.includeErick}}ERICK JOSUE BONILLA PEREIRA, mayor, soltero, administrador de agencia de viajes, portador de la cedula de identidad numero 1-1597-0559, vecino de Cartago, en condicion de representante legal, con facultades de apoderado generalisimo sin limite de suma de{{/if}}

VIAJES LUCITOURS TURISMO INTERNACIONAL SOCIEDAD ANONIMA, cedula juridica numero 3-101-874546, con domicilio social en la Provincia 03 Cartago, Canton 01 Cartago, Occidental, frente a la tienda deportiva Carolina, en centro comercial, segunda planta primer local a mano izquierda Lucitours,
en adelante denominada "Lucitours"; y

(b) {{client.fullName}}, mayor de edad, {{client.civilStatus}}, {{client.profession}},
{{#if (eq client.idType "cedula")}}portador de la cedula de identidad numero {{client.idNumber}}{{/if}}
{{#if (eq client.idType "passport")}}de nacionalidad {{client.nationality}}, portador del pasaporte numero {{client.idNumber}}{{/if}}
{{#if (eq client.idType "dimex")}}portador del Documento de Identidad Migratorio para Extranjeros (DIMEX) numero {{client.idNumber}}{{/if}},
vecino de {{client.address}}, correo electronico {{client.email}}, telefono {{client.phone}}, en adelante denominado como el "Cliente".

{{#if travelers.hasCompanions}}
Adicionalmente, comparecen como acompanantes del Tour:
{{#each travelers.companions}}
- {{fullName}}, mayor de edad, {{civilStatus}}, {{profession}}, portador de {{idTypeLabel}} numero {{idNumber}}, vecino de {{address}}, correo electronico {{email}}, telefono {{phone}}.
{{/each}}
{{/if}}

{{#if travelers.hasMinors}}
El Cliente declara que viaja con menor(es) de edad:
{{#each travelers.minors}}
- {{fullName}}, documento de menor numero {{idNumber}}, en calidad de representado por {{guardianName}}.
{{/each}}
La autorizacion y consentimiento de representacion de menor de edad se incorpora como anexo obligatorio de este Contrato.
{{/if}}

Haciendo mencion a los comparecientes en conjunto, denominados como las "Partes", hemos convenido en celebrar el presente CONTRATO GENERAL DE VIAJE TURISTICO, el cual se regira por las siguientes clausulas:

## CLAUSULAS

### PRIMERO: OBJETO
El presente Contrato sera el documento base para regular las clausulas y condiciones referentes a la contratacion del paquete turistico internacional acordado entre las Partes.

### SEGUNDO: DESTINO
El pais a visitar por parte del Cliente es {{trip.destinationCountry}}, y manifiesta expresamente que dicho destino fue elegido y reservado de forma voluntaria para la realizacion del Tour.

### TERCERO: FECHAS DEL TOUR Y PLAZO
Las fechas de ejecucion del Tour seran del {{trip.startDate}} al {{trip.endDate}}, mismas que se entenderan como plazo del presente Contrato.

### CUARTO: PRECIO, FORMA DE PAGO Y MEDIOS DE PAGO
El precio total del Tour sera por la suma de US$ {{payment.totalAmount}}, monto que incluye el 13% del Impuesto al Valor Agregado (IVA), tomando como referencia el tipo de cambio vigente del dia: {{payment.exchangeRateText}} colones.

{{#if (eq payment.plan "installments")}}
El Cliente se compromete a pagar el precio final del Tour conforme al siguiente esquema:
- Pago inicial: US$ {{payment.initialAmount}} al momento de la firma del Contrato.
- Abonos o cuotas: {{payment.installmentsSummary}}.
- Fecha limite de pago total: {{payment.dueDate}}.
{{/if}}

{{#if (eq payment.plan "cash")}}
El monto total sera cancelado en pago de contado en fecha {{payment.paidAt}}.
{{/if}}

Los medios de pago para realizar los pagos son los siguientes:
- Cuenta Bancaria (IBAN): CR25011610400074756807, Banco Promerica, a nombre de VIAJES LUCITOURS TURISMO INTERNACIONAL S.A.
- Sinpe Movil: 7296-9551, a nombre de VIAJES LUCITOURS TURISMO INTERNACIONAL S.A.
- Pagos en efectivo o por tarjeta de debito/credito en oficinas de Lucitours.

### QUINTO: DEPOSITO DE RESERVA
{{#if (eq payment.plan "installments")}}
La cuota de reserva inicial, se utiliza como deposito minimo para reservar y garantizar el espacio del Cliente en el Tour y los operadores turisticos, por lo que dicho deposito no sera transferible, reutilizable ni reembolsable.
{{/if}}

En caso de incumplimiento en pagos, Lucitours podra notificar una fecha limite para poner al dia los montos. De mantenerse el incumplimiento, Lucitours podra excluir al Cliente del Tour y los dineros recibidos al momento no seran reembolsables, ya que se aplicaran a las penalidades que puedan existir por parte de los operadores del tour, sean estos aerolineas, hoteles, traslados, etc.

### SEXTO: ALOJAMIENTOS Y HOSPEDAJES
Como parte del Tour, el Cliente podra hospedarse en hoteles, hostels, airbnb u otros similares.
- Dia de entrada: {{trip.startDate}}.
- Dia de salida: {{lodging.checkOutDate}}.
Todo sujeto a disponibilidad del hospedaje y necesidades operativas del Tour, caso fortuito o de fuerza mayor.

### SETIMO: CHECK IN Y ASIGNACION DE ASIENTOS
Lucitours realizara el check in segun apertura de aerolinea.

{{#if sale.isResale}}
En modalidad reventa, el check in podra estar a cargo del Cliente revendedor, salvo acuerdo escrito distinto.
{{/if}}

La asignacion de asientos la realiza la aerolinea de forma aleatoria. Lucitours no garantiza asientos juntos o cercanos.
Si se solicita asiento junto a acompanantes, debe gestionarse con al menos 15 dias habiles de anticipacion y podra generar costo adicional.

Equipaje permitido: {{trip.allowedLuggageText}}

### OCTAVO: SEGURO DE VIAJE
Lucitours podra colaborar con la adquisicion de seguro de viaje mediante agencia aliada Assist Card, siendo opcional para el Cliente.

El Cliente acepta que, al no contratar seguro con Lucitours o bien no contar con un seguro viajero propio durante el Tour en este mismo acto, exonera a Lucitours de toda responsabilidad por cualquier accidente, enfermedad, gasto medico, muerte o repatriacion.

Asimismo, el Cliente declara que exime a Lucitours, en este mismo acto y en la medida permitida por ley, de responsabilidad por gastos medicos, hospitalarios, emergencias, cancelaciones, retrasos, perdida de equipaje u otras contingencias cubribles por el seguro de viaje.

### NOVENO: PERSONAL DE ACOMPANAMIENTO
Dependiendo del Tour, Lucitours podra asignar personal de acompanamiento desde Costa Rica.
El Cliente debe presentarse con al menos 3 horas de anticipacion al aeropuerto y con toda la documentacion requerida para viajar.
Lucitours no sera responsable por llegada tardia, documentos vencidos o documentacion incompleta del Cliente.

### DECIMO: FICHA DE ACTIVIDADES E ITINERARIO
Itinerario general:
{{#each trip.itineraryItems}}
- Fecha: {{date}} | Actividad: {{activity}}
{{/each}}

Lucitours podra modificar itinerario, ruta, hospedajes u orden del Tour cuando sea necesario para seguridad, resguardo y ejecucion efectiva del servicio.

### DECIMO PRIMERO: TRANSPORTES
Lucitours brindara, por medio de terceros contratados, transportes relacionados con el Tour (vehiculo privado, microbus, colectivo o transporte publico).
Todo transporte fuera de itinerario corre por cuenta del Cliente.

### DECIMO SEGUNDO: ALIMENTACION
El Tour no incluye alimentacion, salvo indicacion expresa en la publicacion del tour o bien que el hospedaje indique que se incluye el desayuno con el hospedaje; por lo tanto el Cliente debe asumir sus costos de alimentacion durante el tour.

### DECIMO TERCERO: CANCELACION DEL TOUR
La cancelacion del Tour podra darse por:
- Enfermedad/muerte debidamente justificadas.
- Imposibilidad de prestacion por parte del operador.
- Fuerza mayor o caso fortuito (clima extremo, cierre de aeropuertos, guerras, pandemias, sobreventa, etc.).
- Causas no previstas que imposibiliten la ejecucion del Tour.

En los supuestos que correspondan, Lucitours gestionara reintegros ante terceros operadores y podra aplicar penalidades conforme politicas de proveedores.

### DECIMO CUARTO: DERECHOS Y OBLIGACIONES DEL CLIENTE
El Cliente se obliga, entre otros, a:
- Pagar los montos economicos segun contrato.
- Brindar documentacion veraz y vigente.
- Respetar horarios, itinerarios y normas de proveedores.
- Resguardar pertenencias personales.
- Asumir gastos no incluidos.
- Gestionar correctamente documentacion de menor(es), cuando aplique.

### DECIMO QUINTO: DERECHOS Y OBLIGACIONES DE LUCITOURS
Lucitours se obliga, entre otros, a:
- Ejecutar el Tour contratado.
- Contratar y pagar a proveedores del servicio.
- Brindar acompanamiento contractual y soporte operativo.
- Gestionar check in cuando corresponda.

### DECIMO SEXTO: EXONERACION DE RESPONSABILIDAD
El Cliente exonera a Lucitours por eventos no atribuibles directamente a su gestion, incluyendo, entre otros:
- Enfermedades, accidentes, robos o perdidas durante el Tour.
- Atrasos, desvio o perdida de vuelos.
- Cierre de atracciones o condiciones climaticas adversas.
- Eventualidades de terceros proveedores.
- Problemas por documentacion dudosa, falsa, vencida o insuficiente.

### DECIMO SETIMO: MODIFICACIONES AL CONTRATO
Toda modificacion debera formalizarse por escrito mediante adenda firmada por las Partes.

### DECIMO OCTAVO: RESOLUCION ALTERNA DE CONFLICTOS Y LEY APLICABLE
Este Contrato se regira por la legislacion de la Republica de Costa Rica. Cualquier controversia intentara resolverse primero por via conciliatoria antes de acudir a la via judicial.

### DECIMO NOVENO: CONFIDENCIALIDAD
Toda informacion comercial, operativa y documental conocida con ocasion del Contrato sera tratada como confidencial durante su vigencia y por un ano adicional a su terminacion.

### VIGESIMO: NOTIFICACIONES Y COMUNICACIONES
- Lucitours:
  - Correo: contratos@lucitour.com
  - WhatsApp: 6015-9906
- Cliente:
  - Direccion: {{client.address}}
  - Correo: {{client.email}}
  - WhatsApp/Telefono: {{client.phone}}
  - Contacto de emergencia: {{client.emergencyContact.name}} - {{client.emergencyContact.phone}}

### VIGESIMO PRIMERO: INTEGRIDAD CONTRACTUAL
Las Partes aceptan que este Contrato y sus anexos constituyen el acuerdo total entre ellas respecto del Tour contratado.

En fe de lo anterior, las Partes declaran haber leido y comprendido integralmente el presente Contrato, aceptandolo en todas sus clausulas.

## FIRMAS

Numero de contrato: {{contract.number}}

Lucitours:

{{#if lucitours.signatories.includeEdwin}}
______________________________
P/ VIAJES LUCITOURS TURISMO INTERNACIONAL S.A.
EDWIN EDUARDO BONILLA CORDERO
Cedula de identidad: 3-0238-0791
Representante legal
Fecha: {{signatures.lucitoursEdwinDate}}
{{/if}}

{{#if lucitours.signatories.includeErick}}
______________________________
P/ VIAJES LUCITOURS TURISMO INTERNACIONAL S.A.
ERICK JOSUE BONILLA PEREIRA
Cedula de identidad: 1-1597-0559
Representante legal
Fecha: {{signatures.lucitoursErickDate}}
{{/if}}

Cliente:

______________________________
{{client.fullName}}
{{client.idTypeLabel}}: {{client.idNumber}}
Fecha: {{signatures.clientDate}}

{{#if travelers.hasCompanions}}
Acompanante(s):
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
