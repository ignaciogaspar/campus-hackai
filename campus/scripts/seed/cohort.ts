// Cohorte demo de AI-Centric Management: 20 ejecutivos FICTICIOS (is_fictional = true).
// Empresas inventadas; cualquier parecido con empresas reales es casual.

export interface SeedPerson {
  slug: string
  fullName: string
  company: string
  position: string
  industry: string
  bio: string
  interests: string[]
}

export const PROFESSORS: Array<{ slug: string; fullName: string; email: string | null; position: string; bio: string }> = [
  {
    slug: 'sebastian-buffo-sempe',
    fullName: 'Sebastián Buffo Sempé',
    email: null,
    position: 'Profesor · Director de la maestría MBT AI-Centric',
    bio: 'Profesor del programa AI-Centric Management.',
  },
  {
    slug: 'ignacio-berdinas',
    fullName: 'Ignacio Berdiñas',
    email: 'ignacio.berdinas@gmail.com',
    position: 'Profesor · Director de la maestría MBT AI-Centric',
    bio: 'Profesor del programa AI-Centric Management.',
  },
  {
    slug: 'alberto-willi',
    fullName: 'Alberto Willi',
    email: null,
    position: 'Profesor · Director de la maestría MBT AI-Centric',
    bio: 'Profesor del programa AI-Centric Management.',
  },
]

export const COHORT: SeedPerson[] = [
  {
    slug: 'mariana-etcheverry', fullName: 'Mariana Etcheverry', company: 'Banco Ribera', position: 'Gerenta de Canales Digitales', industry: 'Banca',
    bio: 'Lidera la app y el home banking de un banco mediano con 1,2 millones de clientes.\nQuiere bajar el costo de atención sin perder el trato personal de las sucursales.',
    interests: ['atención al cliente', 'onboarding digital', 'agentes conversacionales'],
  },
  {
    slug: 'federico-ansaldi', fullName: 'Federico Ansaldi', company: 'Financiera Tandil', position: 'Director de Riesgo Crediticio', industry: 'Banca',
    bio: 'Quince años armando modelos de scoring para crédito al consumo en el interior.\nLe preocupa explicarle al regulador por qué un modelo aprueba o rechaza.',
    interests: ['scoring', 'explicabilidad', 'regulación'],
  },
  {
    slug: 'juan-cruz-bustamante', fullName: 'Juan Cruz Bustamante', company: 'Agropecuaria Los Ombúes', position: 'Gerente General', industry: 'Agro',
    bio: 'Maneja 18.000 hectáreas propias y arrendadas en el oeste de Buenos Aires.\nBusca usar los datos de cosecha y clima para decidir siembra y coberturas.',
    interests: ['agricultura de precisión', 'pronóstico de rindes', 'coberturas'],
  },
  {
    slug: 'valeria-rinaldi', fullName: 'Valeria Rinaldi', company: 'Semillas Pergamino Sur', position: 'Jefa de Planeamiento Comercial', industry: 'Agro',
    bio: 'Coordina la red de 140 distribuidores de semillas y la campaña de ventas anticipadas.\nQuiere anticipar la demanda por zona antes de que arranque la siembra.',
    interests: ['forecast de demanda', 'canal de distribuidores', 'pricing'],
  },
  {
    slug: 'lucas-ferreyra', fullName: 'Lucas Ferreyra', company: 'Almacenes Rivadavia', position: 'Gerente de Operaciones de Tiendas', industry: 'Retail',
    bio: 'Responsable de 85 supermercados de cercanía en el AMBA y 2.300 personas.\nSu obsesión es el quiebre de stock y la merma de perecederos.',
    interests: ['reposición', 'merma', 'gestión de personal'],
  },
  {
    slug: 'carolina-mansilla', fullName: 'Carolina Mansilla', company: 'Moda Palermo Group', position: 'Directora de E-commerce', industry: 'Retail',
    bio: 'Llevó el canal online de tres marcas de indumentaria del 8 % al 31 % de la venta.\nAhora quiere personalizar catálogo y precios sin sumar equipo.',
    interests: ['personalización', 'contenido generado con IA', 'marketplaces'],
  },
  {
    slug: 'diego-ocampo', fullName: 'Diego Ocampo', company: 'Metalúrgica Campana', position: 'Gerente de Planta', industry: 'Industria',
    bio: 'Ingeniero mecánico a cargo de una planta de autopartes con tres turnos.\nQuiere pasar del mantenimiento correctivo al predictivo con los sensores que ya tiene.',
    interests: ['mantenimiento predictivo', 'calidad', 'seguridad industrial'],
  },
  {
    slug: 'sofia-larranaga', fullName: 'Sofía Larrañaga', company: 'Plásticos del Litoral', position: 'Directora de Finanzas', industry: 'Industria',
    bio: 'CFO de una pyme industrial familiar de Rosario en plena segunda generación.\nBusca automatizar el cierre mensual y la proyección de caja en un contexto inflacionario.',
    interests: ['cierre contable', 'flujo de caja', 'empresa familiar'],
  },
  {
    slug: 'martin-quiroga', fullName: 'Martín Quiroga', company: 'Clínica Belgrano Norte', position: 'Director Médico Adjunto', industry: 'Salud',
    bio: 'Médico clínico con diez años en gestión hospitalaria y 220 camas a cargo.\nLe interesa reducir la carga administrativa de los médicos sin riesgo para el paciente.',
    interests: ['historia clínica', 'triage', 'seguridad del paciente'],
  },
  {
    slug: 'florencia-ibarra', fullName: 'Florencia Ibarra', company: 'Laboratorios Cuyo Diagnóstico', position: 'Gerenta de Calidad', industry: 'Salud',
    bio: 'Bioquímica a cargo de la calidad de una red de 40 centros de extracción en Cuyo.\nEvalúa herramientas para pre-validar resultados y priorizar los críticos.',
    interests: ['calidad', 'automatización de laboratorio', 'normativa ANMAT'],
  },
  {
    slug: 'gonzalo-peralta', fullName: 'Gonzalo Peralta', company: 'Petrolera Cuenca Norte', position: 'Gerente de Mantenimiento', industry: 'Energía',
    bio: 'Coordina el mantenimiento de 600 pozos y dos plantas de tratamiento en Neuquén.\nQuiere ordenar veinte años de órdenes de trabajo para predecir fallas.',
    interests: ['activos', 'datos operativos', 'seguridad'],
  },
  {
    slug: 'agustina-sosa', fullName: 'Agustina Sosa', company: 'Renovables Patagonia', position: 'Jefa de Desarrollo de Negocios', industry: 'Energía',
    bio: 'Arma proyectos eólicos y solares para grandes usuarios del mercado a término.\nBusca acelerar los análisis de prefactibilidad y las propuestas comerciales.',
    interests: ['propuestas comerciales', 'modelado financiero', 'energía'],
  },
  {
    slug: 'tomas-benitez', fullName: 'Tomás Benítez', company: 'Bebidas Andinas', position: 'Gerente de Trade Marketing', industry: 'Consumo masivo',
    bio: 'Maneja la ejecución en punto de venta de 30.000 comercios del norte argentino.\nQuiere medir qué acción en góndola mueve la venta y cuál es ruido.',
    interests: ['ejecución en punto de venta', 'reconocimiento de imágenes', 'promociones'],
  },
  {
    slug: 'paula-gimenez', fullName: 'Paula Giménez', company: 'Alimentos La Pradera', position: 'Gerenta de Marca', industry: 'Consumo masivo',
    bio: 'Lleva una marca de lácteos con presencia nacional y fuerte competencia de segundas marcas.\nExplora usar IA para investigación de consumidor y creatividad.',
    interests: ['investigación de mercado', 'branding', 'contenido'],
  },
  {
    slug: 'hernan-castillo', fullName: 'Hernán Castillo', company: 'Seguros La Unión del Sur', position: 'Gerente de Siniestros', industry: 'Seguros',
    bio: 'Supervisa la liquidación de 9.000 siniestros de autos por mes.\nBusca acortar plazos y detectar fraude sin castigar al asegurado honesto.',
    interests: ['detección de fraude', 'liquidación', 'experiencia del asegurado'],
  },
  {
    slug: 'camila-herrera', fullName: 'Camila Herrera', company: 'Aseguradora Pilar', position: 'Directora de Experiencia del Cliente', industry: 'Seguros',
    bio: 'Viene del retail y lleva dos años transformando la atención de una aseguradora de vida.\nQuiere un asistente que resuelva consultas de pólizas en un solo contacto.',
    interests: ['atención omnicanal', 'NPS', 'agentes'],
  },
  {
    slug: 'pablo-medina', fullName: 'Pablo Medina', company: 'Transportes Ruta 9', position: 'Gerente de Logística', industry: 'Logística',
    bio: 'Coordina una flota de 210 camiones entre Buenos Aires, Córdoba y Rosario.\nQuiere optimizar ruteo y cargas de retorno con los datos de GPS que ya registra.',
    interests: ['ruteo', 'telemetría', 'costos logísticos'],
  },
  {
    slug: 'natalia-vera', fullName: 'Natalia Vera', company: 'Depósitos Zárate', position: 'Jefa de Operaciones', industry: 'Logística',
    bio: 'Opera un centro de distribución de 45.000 m² para clientes de consumo masivo.\nEvalúa automatizar la planificación de turnos y la conciliación de inventario.',
    interests: ['planificación de turnos', 'inventario', 'automatización'],
  },
  {
    slug: 'andres-rossi', fullName: 'Andrés Rossi', company: 'Nodo Sistemas', position: 'CTO', industry: 'Tecnología',
    bio: 'Cofundador de una software factory de 120 personas que trabaja para bancos y retailers.\nRepiensa el modelo de horas facturables ahora que el código se escribe más rápido.',
    interests: ['desarrollo asistido por IA', 'modelo de negocio', 'equipos'],
  },
  {
    slug: 'julieta-navarro', fullName: 'Julieta Navarro', company: 'Billetera Andina', position: 'Head of Product', industry: 'Tecnología',
    bio: 'Lidera producto en una billetera virtual con 800.000 usuarios activos.\nQuiere iterar más rápido que la competencia sin romper la confianza del usuario.',
    interests: ['producto', 'experimentación', 'prevención de fraude'],
  },
]
