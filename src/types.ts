export type Farm = 'Tambo La Esperanza' | 'Establecimiento El Ombú'
export type AnimalCategory = 'Vaca en ordeñe' | 'Vaca seca' | 'Vaquillona' | 'Ternera' | 'Ternero' | 'Toro'
export type AnimalStatus = 'Activo' | 'Vendido' | 'Descarte' | 'Muerto'
export type Severity = 'Crítica' | 'Alta' | 'Media' | 'Baja'

export interface TimelineEvent {
  id: string
  date: string
  type: 'Nacimiento' | 'Movimiento' | 'Reproducción' | 'Sanidad' | 'Producción' | 'Baja'
  title: string
  detail: string
  operator: string
}

export interface Animal {
  id: string
  tag: string
  name: string
  farm: Farm
  category: AnimalCategory
  status: AnimalStatus
  sex: 'Hembra' | 'Macho'
  birthDate: string
  lot: string
  motherId?: string
  fatherId?: string
  reproductiveStatus: 'Preñada' | 'Vacía' | 'Servida' | 'No aplica'
  dueDate?: string
  lactationNumber: number
  daysInMilk: number
  lastMilkLiters: number
  healthStatus: 'Sana' | 'En tratamiento' | 'En observación'
  weight: number
  createdAt: string
  timeline: TimelineEvent[]
}

export interface MilkRecord {
  id: string
  date: string
  shift: 'Mañana' | 'Tarde'
  farm: Farm
  liters: number
  milkedCows: number
  discardedLiters: number
  tankTemperature: number
  responsible: string
  notes: string
}

export interface Birth {
  id: string
  date: string
  motherId: string
  calfId: string
  type: 'Simple' | 'Múltiple'
  sex: 'Hembra' | 'Macho'
  weight: number
  status: 'Viva' | 'Muerta al parto' | 'En observación'
  notes: string
  responsible: string
}

export interface Treatment {
  id: string
  animalId: string
  diagnosis: string
  medicine: string
  dose: string
  frequency: string
  responsible: string
  startDate: string
  endDate: string
  milkWithdrawalUntil?: string
  meatWithdrawalUntil?: string
  evolution: 'Estable' | 'Mejora' | 'Requiere control'
  active: boolean
}

export interface InventoryItem {
  id: string
  name: string
  type: 'Alimento' | 'Medicamento' | 'Semen' | 'Insumo'
  unit: string
  stock: number
  minimum: number
  expiryDate?: string
  price: number
  supplier: string
  averageDailyUse: number
}

export interface InventoryMovement {
  id: string
  itemId: string
  type: 'Compra' | 'Consumo' | 'Ajuste'
  quantity: number
  date: string
  responsible: string
}

export interface TaskItem {
  id: string
  title: string
  responsible: string
  priority: 'Crítica' | 'Alta' | 'Media' | 'Baja'
  dueDate: string
  recurrence: 'Sin repetición' | 'Diaria' | 'Semanal' | 'Mensual'
  status: 'Pendiente' | 'En progreso' | 'Completada'
  comments: string
  relatedType: 'Animal' | 'Lote' | 'General'
  relatedId?: string
}

export interface RainRecord {
  id: string
  date: string
  farm: Farm
  millimeters: number
  temperature: number
  humidity: number
  wind: number
}

export interface ConsistencyAlert {
  id: string
  type: string
  title: string
  explanation: string
  evidence: string[]
  relatedAnimalIds: string[]
  severity: Severity
  recommendation: string
  operator: string
  date: string
  status: 'Abierta' | 'En revisión' | 'Corregida' | 'Resuelta'
}

export interface Lot {
  id: string
  name: string
  farm: Farm
  area: number
  animalCount: number
  category: string
  capacity: number
  ration: string
  notes: string
  occupancy: { date: string; count: number; event: string }[]
}

export interface ReproductionEvent {
  id: string
  animalId: string
  type: 'Servicio' | 'Inseminación' | 'Tacto' | 'Secado' | 'Aborto' | 'Parto'
  date: string
  result: string
  bull: string
  responsible: string
}

export interface AnalyticsEvent {
  id: string
  date: string
  sessionId: string
  type: 'page_view' | 'feature_use' | 'form_started' | 'form_completed' | 'contact_request'
  module: string
  label: string
  durationSeconds: number
}

export interface SurveyResponse {
  id: string
  date: string
  mostUseful: string
  missingFeature: string
  ownDataInterest: 'Sí' | 'No' | 'Quizás'
  animalCount: string
  contactRequested: boolean
  name: string
  email: string
  phone: string
  interestScore: number
}

export interface DemoState {
  animals: Animal[]
  milkRecords: MilkRecord[]
  births: Birth[]
  treatments: Treatment[]
  inventory: InventoryItem[]
  inventoryMovements: InventoryMovement[]
  tasks: TaskItem[]
  rain: RainRecord[]
  alerts: ConsistencyAlert[]
  lots: Lot[]
  reproductionEvents: ReproductionEvent[]
  analyticsEvents: AnalyticsEvent[]
  surveys: SurveyResponse[]
  pendingSync: number
  updatedAt: string
}
