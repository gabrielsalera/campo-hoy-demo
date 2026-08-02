import type {
  AnalyticsEvent,
  Animal,
  AnimalCategory,
  AnimalStatus,
  Birth,
  ConsistencyAlert,
  DemoState,
  Farm,
  InventoryItem,
  InventoryMovement,
  Lot,
  MilkRecord,
  RainRecord,
  ReproductionEvent,
  TaskItem,
  Treatment,
} from '../types'

export const DEMO_TODAY = '2026-08-02'
export const FARMS: Farm[] = ['Tambo La Esperanza', 'Establecimiento El Ombú']
export const OPERATORS = ['Lucía Benítez', 'Martín Quiroga', 'Sofía Roldán', 'Diego Ferreyra']

const toIso = (date: Date) => date.toISOString().slice(0, 10)
const fromIso = (value: string) => new Date(`${value}T12:00:00Z`)
const addDays = (value: string, days: number) => {
  const date = fromIso(value)
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date)
}
const addMonths = (value: string, months: number) => {
  const date = fromIso(value)
  date.setUTCMonth(date.getUTCMonth() + months)
  return toIso(date)
}
const pad = (value: number, size = 3) => String(value).padStart(size, '0')
const fraction = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function animalCategory(index: number): AnimalCategory {
  if (index < 238) return 'Vaca en ordeñe'
  if (index < 298) return 'Vaca seca'
  if (index < 368) return 'Vaquillona'
  if (index < 425) return 'Ternera'
  if (index < 474) return 'Ternero'
  if (index < 486) return 'Toro'
  return (['Vaca en ordeñe', 'Vaca seca', 'Vaquillona', 'Ternera', 'Ternero'] as AnimalCategory[])[index % 5]
}

function animalStatus(index: number): AnimalStatus {
  if (index < 486) return 'Activo'
  if (index < 502) return 'Vendido'
  if (index < 508) return 'Descarte'
  return 'Muerto'
}

function generateAnimals(): Animal[] {
  return Array.from({ length: 512 }, (_, index) => {
    const number = index + 1
    const category = animalCategory(index)
    const status = animalStatus(index)
    const farm = FARMS[index % 3 === 0 ? 1 : 0]
    const isMale = category === 'Ternero' || category === 'Toro'
    const birthYear = category === 'Vaca en ordeñe' || category === 'Vaca seca'
      ? 2018 + (index % 6)
      : category === 'Vaquillona'
        ? 2024
        : category === 'Toro'
          ? 2021 + (index % 3)
          : 2025 + (index % 2)
    const birthMonth = (index * 7) % 12
    const birthDay = (index * 11) % 27 + 1
    const birthDate = `${birthYear}-${pad(birthMonth + 1, 2)}-${pad(birthDay, 2)}`
    const reproductiveStatus = !isMale && ['Vaca en ordeñe', 'Vaca seca', 'Vaquillona'].includes(category)
      ? (['Preñada', 'Vacía', 'Servida'] as const)[index % 3]
      : 'No aplica'
    const dueDate = reproductiveStatus === 'Preñada' ? addDays(DEMO_TODAY, 8 + ((index * 13) % 150)) : undefined
    const operator = OPERATORS[index % OPERATORS.length]
    const motherId = index >= 298 && category !== 'Toro' ? `animal-${pad((index % 220) + 1)}` : undefined
    const fatherId = index >= 298 && category !== 'Toro' ? `animal-${pad(475 + (index % 12))}` : undefined
    const baseTimeline = [
      {
        id: `timeline-${number}-birth`, date: birthDate, type: 'Nacimiento' as const,
        title: 'Nacimiento registrado', detail: `${isMale ? 'Macho' : 'Hembra'} de ${35 + (index % 12)} kg`, operator,
      },
      {
        id: `timeline-${number}-move`, date: addMonths(birthDate, Math.min(18, 5 + (index % 14))), type: 'Movimiento' as const,
        title: 'Cambio de lote', detail: `Ingreso a ${farm === FARMS[0] ? 'Lote Norte' : 'Potrero 4'}`, operator: OPERATORS[(index + 1) % 4],
      },
      ...(!isMale && index < 368 ? [{
        id: `timeline-${number}-repro`, date: addDays(DEMO_TODAY, -(18 + (index % 110))), type: 'Reproducción' as const,
        title: reproductiveStatus === 'Preñada' ? 'Tacto positivo' : 'Control reproductivo',
        detail: reproductiveStatus === 'Preñada' ? `Preñez confirmada · parto estimado ${dueDate}` : `${reproductiveStatus} · seguimiento programado`,
        operator: OPERATORS[(index + 2) % 4],
      }] : []),
      ...(status !== 'Activo' ? [{
        id: `timeline-${number}-status`, date: addDays(DEMO_TODAY, -(index % 40)), type: 'Baja' as const,
        title: `${status} del rodeo activo`, detail: 'Movimiento documentado con control de stock', operator,
      }] : []),
    ]
    return {
      id: `animal-${pad(number)}`,
      tag: `CH-${202000 + number}`,
      name: isMale ? `Mestizo ${pad(number)}` : `Aurora ${pad(number)}`,
      farm,
      category,
      status,
      sex: isMale ? 'Macho' : 'Hembra',
      birthDate,
      lot: farm === FARMS[0] ? ['Ordeñe 1', 'Ordeñe 2', 'Preparto', 'Recría Norte'][index % 4] : ['Potrero 1', 'Potrero 4', 'Vaquillonas', 'Cría Sur'][index % 4],
      motherId,
      fatherId,
      reproductiveStatus,
      dueDate,
      lactationNumber: category === 'Vaca en ordeñe' ? 1 + (index % 5) : 0,
      daysInMilk: category === 'Vaca en ordeñe' ? 22 + ((index * 9) % 285) : 0,
      lastMilkLiters: category === 'Vaca en ordeñe' ? Number((17 + fraction(index) * 15).toFixed(1)) : 0,
      healthStatus: index % 67 === 0 ? 'En tratamiento' : index % 41 === 0 ? 'En observación' : 'Sana',
      weight: isMale ? 98 + (index % 510) : 38 + (index % 590),
      createdAt: birthDate,
      timeline: baseTimeline,
    }
  })
}

function generateMilkRecords(): MilkRecord[] {
  const records: MilkRecord[] = []
  for (let day = 547; day >= 0; day -= 1) {
    const date = addDays(DEMO_TODAY, -day)
    FARMS.forEach((farm, farmIndex) => {
      ;(['Mañana', 'Tarde'] as const).forEach((shift, shiftIndex) => {
        const seasonal = Math.sin((day / 365) * Math.PI * 2) * 140
        const baseline = farmIndex === 0 ? 3400 : 2300
        const shiftFactor = shiftIndex === 0 ? 0.54 : 0.46
        const anomaly = day === 18 && farmIndex === 1 ? -260 : 0
        const liters = Math.round((baseline + seasonal + fraction(day * 11 + farmIndex) * 110 + anomaly) * shiftFactor)
        records.push({
          id: `milk-${date}-${farmIndex}-${shiftIndex}`,
          date,
          shift,
          farm,
          liters,
          milkedCows: farmIndex === 0 ? 142 : 96,
          discardedLiters: day % 17 === 0 ? 18 + farmIndex * 7 : 4 + farmIndex,
          tankTemperature: Number((3.3 + fraction(day + shiftIndex) * 0.9).toFixed(1)),
          responsible: OPERATORS[(day + farmIndex + shiftIndex) % 4],
          notes: anomaly ? 'Caída asociada a cambio de ración' : '',
        })
      })
    })
  }
  return records
}

function generateBirths(animals: Animal[]): Birth[] {
  return Array.from({ length: 42 }, (_, index) => {
    const mother = animals[(index * 5) % 230]
    const calf = animals[298 + index]
    return {
      id: `birth-${pad(index + 1)}`,
      date: addDays(DEMO_TODAY, -(index * 11 + 3)),
      motherId: mother.id,
      calfId: calf.id,
      type: index % 13 === 0 ? 'Múltiple' : 'Simple',
      sex: calf.sex,
      weight: 34 + (index % 11),
      status: index % 19 === 0 ? 'En observación' : 'Viva',
      notes: index % 9 === 0 ? 'Calostrado dentro de las primeras dos horas' : '',
      responsible: OPERATORS[index % 4],
    }
  })
}

function generateTreatments(animals: Animal[]): Treatment[] {
  const diagnoses = ['Mastitis clínica', 'Pietín', 'Metritis posparto', 'Complejo respiratorio', 'Herida superficial']
  const medicines = ['Lactomicina', 'PodalCare', 'UterPlus', 'RespiraVet', 'Cicatrizol']
  return Array.from({ length: 18 }, (_, index) => {
    const active = index < 8
    const startDate = addDays(DEMO_TODAY, active ? -(index % 4) : -(35 + index * 3))
    return {
      id: `treatment-${pad(index + 1)}`,
      animalId: animals[(index * 31) % 238].id,
      diagnosis: diagnoses[index % diagnoses.length],
      medicine: medicines[index % medicines.length],
      dose: `${8 + (index % 5) * 2} ml`,
      frequency: index % 2 ? 'Cada 24 horas' : 'Cada 12 horas',
      responsible: OPERATORS[index % 4],
      startDate,
      endDate: addDays(startDate, 4 + (index % 3)),
      milkWithdrawalUntil: active && index < 6 ? addDays(DEMO_TODAY, 2 + index) : undefined,
      meatWithdrawalUntil: active ? addDays(DEMO_TODAY, 12 + index * 2) : undefined,
      evolution: index % 4 === 0 ? 'Requiere control' : index % 3 === 0 ? 'Estable' : 'Mejora',
      active,
    }
  })
}

function generateInventory(): InventoryItem[] {
  const source: Omit<InventoryItem, 'id'>[] = [
    { name: 'Silo de maíz', type: 'Alimento', unit: 'kg', stock: 42800, minimum: 24000, price: 0.16, supplier: 'Nutrición Rural SA', averageDailyUse: 1850 },
    { name: 'Rollo de alfalfa', type: 'Alimento', unit: 'rollos', stock: 46, minimum: 55, price: 24, supplier: 'Forrajes del Centro', averageDailyUse: 6 },
    { name: 'Balanceado 18%', type: 'Alimento', unit: 'kg', stock: 9100, minimum: 6500, price: 0.43, supplier: 'Nutrición Rural SA', averageDailyUse: 720 },
    { name: 'Núcleo mineral', type: 'Alimento', unit: 'kg', stock: 380, minimum: 450, price: 1.28, supplier: 'Minerales Pampeanos', averageDailyUse: 44 },
    { name: 'Lactomicina', type: 'Medicamento', unit: 'frascos', stock: 8, minimum: 12, expiryDate: '2026-10-12', price: 18.5, supplier: 'Veterinaria Horizonte', averageDailyUse: 0.35 },
    { name: 'Antiinflamatorio A', type: 'Medicamento', unit: 'frascos', stock: 19, minimum: 8, expiryDate: '2027-02-18', price: 22.1, supplier: 'Veterinaria Horizonte', averageDailyUse: 0.18 },
    { name: 'Sales de rehidratación', type: 'Medicamento', unit: 'sobres', stock: 34, minimum: 20, expiryDate: '2026-09-03', price: 3.4, supplier: 'Agroinsumos Sur', averageDailyUse: 0.8 },
    { name: 'Dosis Holando H-248', type: 'Semen', unit: 'dosis', stock: 42, minimum: 30, price: 16, supplier: 'Genética Lechera', averageDailyUse: 0.7 },
    { name: 'Dosis Jersey J-106', type: 'Semen', unit: 'dosis', stock: 18, minimum: 22, price: 21, supplier: 'Genética Lechera', averageDailyUse: 0.3 },
    { name: 'Guantes largos', type: 'Insumo', unit: 'unidades', stock: 145, minimum: 100, price: 0.58, supplier: 'Agroinsumos Sur', averageDailyUse: 8 },
    { name: 'Caravanas visuales', type: 'Insumo', unit: 'unidades', stock: 76, minimum: 50, price: 1.05, supplier: 'Trazar Campo', averageDailyUse: 0.4 },
    { name: 'Reactivo de mastitis', type: 'Insumo', unit: 'litros', stock: -2, minimum: 4, expiryDate: '2026-08-20', price: 13.7, supplier: 'Calidad Láctea', averageDailyUse: 0.2 },
  ]
  return source.map((item, index) => ({ ...item, id: `inventory-${pad(index + 1)}` }))
}

function generateInventoryMovements(inventory: InventoryItem[]): InventoryMovement[] {
  return Array.from({ length: 36 }, (_, index) => ({
    id: `inventory-move-${pad(index + 1)}`,
    itemId: inventory[index % inventory.length].id,
    type: (['Compra', 'Consumo', 'Ajuste'] as const)[index % 3],
    quantity: index % 3 === 0 ? 40 + index : -(3 + (index % 17)),
    date: addDays(DEMO_TODAY, -index),
    responsible: OPERATORS[index % 4],
  }))
}

function generateTasks(): TaskItem[] {
  const titles = ['Controlar vacas próximas a parir', 'Reponer rollos de alfalfa', 'Revisar lote de preparto', 'Aplicar segunda dosis sanitaria', 'Confirmar tactos pendientes', 'Ajustar ración del rodeo 2', 'Verificar temperatura del tanque', 'Revisar diferencia de stock']
  return Array.from({ length: 24 }, (_, index) => ({
    id: `task-${pad(index + 1)}`,
    title: titles[index % titles.length],
    responsible: OPERATORS[index % 4],
    priority: (['Crítica', 'Alta', 'Media', 'Baja'] as const)[index % 4],
    dueDate: addDays(DEMO_TODAY, index < 6 ? -(6 - index) : index - 5),
    recurrence: (['Sin repetición', 'Diaria', 'Semanal', 'Mensual'] as const)[index % 4],
    status: index % 7 === 0 ? 'Completada' : index % 5 === 0 ? 'En progreso' : 'Pendiente',
    comments: index % 3 === 0 ? 'Coordinar con el turno de la mañana.' : '',
    relatedType: index % 3 === 0 ? 'Animal' : index % 3 === 1 ? 'Lote' : 'General',
    relatedId: index % 3 === 0 ? `animal-${pad(index + 1)}` : index % 3 === 1 ? `lot-${(index % 8) + 1}` : undefined,
  }))
}

function generateRain(): RainRecord[] {
  const result: RainRecord[] = []
  for (let monthOffset = 17; monthOffset >= 0; monthOffset -= 1) {
    const monthDate = addMonths('2026-08-01', -monthOffset)
    FARMS.forEach((farm, farmIndex) => {
      result.push({
        id: `rain-${monthDate}-${farmIndex}`,
        date: monthDate,
        farm,
        millimeters: Math.round(18 + fraction(monthOffset * 5 + farmIndex) * 126),
        temperature: Number((13 + Math.cos(monthOffset / 2) * 7 + farmIndex * 0.6).toFixed(1)),
        humidity: Math.round(54 + fraction(monthOffset * 3 + farmIndex) * 31),
        wind: Number((8 + fraction(monthOffset * 7 + farmIndex) * 15).toFixed(1)),
      })
    })
  }
  return result
}

function generateAlerts(): ConsistencyAlert[] {
  const definitions = [
    ['parto-sin-cria', 'Parto sin cría', 'Se informó un parto pero no existe una cría vinculada.', ['Evento de parto del 29/07/2026', 'Madre CH-202014 activa'], ['animal-014'], 'Crítica', 'Crear la cría o anular el parto con justificación.'],
    ['cria-sin-parto', 'Cría sin parto', 'La cría ingresó al stock sin un evento de parto asociado.', ['Alta de CH-202322', 'Sin parto en los 10 días previos'], ['animal-322', 'animal-042'], 'Alta', 'Vincular el nacimiento con la madre correspondiente.'],
    ['madre-inexistente', 'Madre inexistente', 'Una referencia materna no coincide con ningún animal.', ['Referencia CH-209991', 'Nacimiento cargado el 21/07/2026'], ['animal-337'], 'Crítica', 'Corregir la caravana materna usando el registro de campo.'],
    ['madre-baja', 'Madre dada de baja', 'La madre estaba fuera del rodeo activo antes del parto informado.', ['Baja por venta el 03/06/2026', 'Parto informado el 18/07/2026'], ['animal-499', 'animal-343'], 'Alta', 'Revisar fecha del evento o identidad de la madre.'],
    ['caravana-duplicada', 'Caravana duplicada', 'Dos altas de animales usan la misma identificación visual.', ['CH-202351 aparece en dos formularios', 'Cargas de dos operarios'], ['animal-351', 'animal-352'], 'Crítica', 'Consolidar los registros y asignar una caravana única.'],
    ['nacimiento-tarde', 'Nacimiento cargado tarde', 'El alta fue registrada 23 días después de la fecha informada.', ['Nacimiento: 02/07/2026', 'Carga: 25/07/2026'], ['animal-364'], 'Media', 'Confirmar fecha y reforzar el circuito de carga diaria.'],
    ['tacto-sin-servicio', 'Tacto positivo sin servicio', 'Hay preñez confirmada sin servicio o inseminación previa.', ['Tacto positivo del 28/07/2026', 'Sin servicio en los 300 días previos'], ['animal-076'], 'Alta', 'Registrar el servicio faltante o corregir el resultado del tacto.'],
    ['categoria-incompatible', 'Categoría incompatible', 'Una ternera figura con evento de secado.', ['Categoría: Ternera', 'Secado informado el 30/07/2026'], ['animal-401'], 'Media', 'Corregir la categoría o eliminar el evento incompatible.'],
    ['muerto-stock', 'Animal muerto en stock', 'Un animal con baja por muerte permanece en un lote activo.', ['Muerte registrada el 22/07/2026', 'Presente en Potrero 4'], ['animal-509'], 'Crítica', 'Cerrar su ocupación y ajustar el stock del lote.'],
    ['vendido-lote', 'Animal vendido en lote activo', 'La venta fue confirmada pero el movimiento de salida no cerró el lote.', ['Venta del 17/07/2026', 'Lote Ordeñe 2 activo'], ['animal-490'], 'Alta', 'Registrar la salida del lote y conciliar existencias.'],
  ] as const
  return definitions.map((item, index) => ({
    id: `alert-${item[0]}`,
    type: item[0],
    title: item[1],
    explanation: item[2],
    evidence: [...item[3]],
    relatedAnimalIds: [...item[4]],
    severity: item[5],
    recommendation: item[6],
    operator: OPERATORS[index % 4],
    date: addDays(DEMO_TODAY, -(index % 8)),
    status: index === 5 ? 'En revisión' : 'Abierta',
  }))
}

function generateLots(): Lot[] {
  const names = ['Ordeñe 1', 'Ordeñe 2', 'Preparto', 'Recría Norte', 'Potrero 1', 'Potrero 4', 'Vaquillonas', 'Cría Sur']
  const counts = [78, 82, 38, 92, 54, 46, 51, 45]
  return names.map((name, index) => ({
    id: `lot-${index + 1}`,
    name,
    farm: index < 4 ? FARMS[0] : FARMS[1],
    area: 8 + index * 3.4,
    animalCount: counts[index],
    category: index < 2 ? 'Vacas en ordeñe' : index === 2 ? 'Preparto' : index % 2 ? 'Recría' : 'Rodeo mixto',
    capacity: counts[index] + 12 + (index % 4) * 5,
    ration: index < 3 ? 'TMR 22 kg + pastoreo' : 'Pastoreo rotativo + suplemento',
    notes: index % 3 === 0 ? 'Bebederos revisados esta semana.' : 'Ocupación dentro de capacidad.',
    occupancy: Array.from({ length: 6 }, (_, pos) => ({
      date: addMonths(DEMO_TODAY, -(5 - pos)),
      count: counts[index] - 8 + pos * 2 - (index % 3),
      event: pos % 2 ? 'Ingreso programado' : 'Recuento de lote',
    })),
  }))
}

function generateReproductionEvents(animals: Animal[]): ReproductionEvent[] {
  const candidates = animals.filter((animal) => animal.sex === 'Hembra' && ['Vaca en ordeñe', 'Vaca seca', 'Vaquillona'].includes(animal.category)).slice(0, 96)
  return candidates.map((animal, index) => ({
    id: `repro-${pad(index + 1)}`,
    animalId: animal.id,
    type: (['Servicio', 'Inseminación', 'Tacto', 'Secado'] as const)[index % 4],
    date: addDays(DEMO_TODAY, -(4 + index)),
    result: index % 4 === 2 ? (index % 3 === 0 ? 'Positivo' : 'Negativo') : 'Realizado',
    bull: index % 2 ? 'Genética H-248' : 'Toro Natural TN-04',
    responsible: OPERATORS[index % 4],
  }))
}

function generateAnalytics(): AnalyticsEvent[] {
  const modules = ['Dashboard', 'Animales', 'Consistencia', 'Producción', 'Sanidad', 'Inventario', 'Tareas', 'Encuesta']
  return Array.from({ length: 156 }, (_, index) => ({
    id: `event-seed-${pad(index + 1)}`,
    date: addDays(DEMO_TODAY, -(index % 28)),
    sessionId: `demo-session-${pad((index % 34) + 1)}`,
    type: index % 13 === 0 ? 'form_completed' : index % 7 === 0 ? 'feature_use' : 'page_view',
    module: modules[index % modules.length],
    label: index % 13 === 0 ? 'Formulario completado' : `Visita a ${modules[index % modules.length]}`,
    durationSeconds: 38 + (index * 17) % 420,
  }))
}

export function createInitialState(): DemoState {
  const animals = generateAnimals()
  const inventory = generateInventory()
  return {
    animals,
    milkRecords: generateMilkRecords(),
    births: generateBirths(animals),
    treatments: generateTreatments(animals),
    inventory,
    inventoryMovements: generateInventoryMovements(inventory),
    tasks: generateTasks(),
    rain: generateRain(),
    alerts: generateAlerts(),
    lots: generateLots(),
    reproductionEvents: generateReproductionEvents(animals),
    analyticsEvents: generateAnalytics(),
    surveys: [],
    pendingSync: 3,
    updatedAt: `${DEMO_TODAY}T12:00:00.000Z`,
  }
}

export const formatDate = (value: string) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(fromIso(value))
export const formatNumber = (value: number, maximumFractionDigits = 0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits }).format(value)
export const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
export const daysBetween = (from: string, to: string) => Math.round((fromIso(to).getTime() - fromIso(from).getTime()) / 86400000)
export const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
export { addDays }
