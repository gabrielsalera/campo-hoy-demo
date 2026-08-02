import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { addDays, createId, createInitialState, DEMO_TODAY } from '../data/demoData'
import { clearDemoState, loadDemoState, saveDemoState } from '../lib/demoDb'
import type {
  AnalyticsEvent,
  Animal,
  Birth,
  ConsistencyAlert,
  DemoState,
  InventoryMovement,
  MilkRecord,
  RainRecord,
  ReproductionEvent,
  SurveyResponse,
  TaskItem,
  Treatment,
} from '../types'

interface BirthInput {
  motherId: string
  date: string
  type: Birth['type']
  sex: Birth['sex']
  weight: number
  tag: string
  status: Birth['status']
  notes: string
  responsible: string
}

interface DemoContextValue {
  state: DemoState
  ready: boolean
  addBirth: (input: BirthInput) => Animal
  addMilkRecord: (record: Omit<MilkRecord, 'id'>) => void
  addTreatment: (treatment: Omit<Treatment, 'id' | 'active'>) => void
  addTask: (task: Omit<TaskItem, 'id'>) => void
  updateTaskStatus: (id: string, status: TaskItem['status']) => void
  addRain: (record: Omit<RainRecord, 'id'>) => void
  addInventoryMovement: (movement: Omit<InventoryMovement, 'id'>) => void
  updateAlert: (id: string, status: ConsistencyAlert['status']) => void
  addReproductionEvent: (event: Omit<ReproductionEvent, 'id'>) => void
  addSurvey: (survey: Omit<SurveyResponse, 'id' | 'date' | 'interestScore'>) => void
  trackEvent: (event: Omit<AnalyticsEvent, 'id' | 'date' | 'sessionId'>) => void
  importAnimals: (animals: Animal[]) => void
  moveLot: (lotId: string, difference: number) => void
  resetDemo: () => Promise<void>
}

const DemoContext = createContext<DemoContextValue | null>(null)

function sessionId() {
  const key = 'campo-hoy-session'
  let value = sessionStorage.getItem(key)
  if (!value) {
    value = `local-${Date.now()}`
    sessionStorage.setItem(key, value)
  }
  return value
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => createInitialState())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    loadDemoState()
      .then((stored) => {
        if (mounted && stored) setState(stored)
      })
      .finally(() => mounted && setReady(true))
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!ready) return
    void saveDemoState(state)
  }, [ready, state])

  const mutate = useCallback((updater: (current: DemoState) => DemoState) => {
    setState((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }))
  }, [])

  const trackEvent = useCallback((event: Omit<AnalyticsEvent, 'id' | 'date' | 'sessionId'>) => {
    mutate((current) => ({
      ...current,
      analyticsEvents: [...current.analyticsEvents, { ...event, id: createId('event'), date: DEMO_TODAY, sessionId: sessionId() }].slice(-800),
    }))
  }, [mutate])

  const addBirth = useCallback((input: BirthInput) => {
    const mother = state.animals.find((animal) => animal.id === input.motherId)
    if (!mother) throw new Error('No se encontró la madre seleccionada.')
    const id = createId('animal')
    const calf: Animal = {
      id,
      tag: input.tag,
      name: input.sex === 'Hembra' ? 'Ternera recién nacida' : 'Ternero recién nacido',
      farm: mother.farm,
      category: input.sex === 'Hembra' ? 'Ternera' : 'Ternero',
      status: input.status === 'Muerta al parto' ? 'Muerto' : 'Activo',
      sex: input.sex,
      birthDate: input.date,
      lot: mother.farm === 'Tambo La Esperanza' ? 'Recría Norte' : 'Cría Sur',
      motherId: mother.id,
      fatherId: undefined,
      reproductiveStatus: 'No aplica',
      lactationNumber: 0,
      daysInMilk: 0,
      lastMilkLiters: 0,
      healthStatus: input.status === 'En observación' ? 'En observación' : 'Sana',
      weight: input.weight,
      createdAt: input.date,
      timeline: [{
        id: createId('timeline'), date: input.date, type: 'Nacimiento', title: 'Nacimiento registrado',
        detail: `${input.type} · ${input.weight} kg · ${input.status}`, operator: input.responsible,
      }],
    }
    const birth: Birth = {
      id: createId('birth'), date: input.date, motherId: mother.id, calfId: calf.id, type: input.type,
      sex: input.sex, weight: input.weight, status: input.status, notes: input.notes, responsible: input.responsible,
    }
    mutate((current) => {
      const duplicate = current.animals.some((animal) => animal.tag.toLowerCase() === input.tag.toLowerCase())
      const inconsistent = input.date > DEMO_TODAY || duplicate
      return {
        ...current,
        animals: [
          ...current.animals.map((animal) => animal.id === mother.id ? {
            ...animal,
            reproductiveStatus: 'Vacía' as const,
            dueDate: undefined,
            daysInMilk: 0,
            timeline: [{
              id: createId('timeline'), date: input.date, type: 'Reproducción' as const, title: 'Parto informado',
              detail: `Cría ${input.tag} vinculada`, operator: input.responsible,
            }, ...animal.timeline],
          } : animal),
          calf,
        ],
        births: [birth, ...current.births],
        reproductionEvents: [{
          id: createId('repro'), animalId: mother.id, type: 'Parto', date: input.date, result: input.status,
          bull: '', responsible: input.responsible,
        }, ...current.reproductionEvents],
        alerts: inconsistent ? [{
          id: createId('alert'), type: duplicate ? 'caravana-duplicada' : 'fecha-futura',
          title: duplicate ? 'Caravana duplicada' : 'Fecha de nacimiento futura',
          explanation: duplicate ? 'La caravana ingresada ya estaba asignada.' : 'La fecha informada supera la fecha de demostración.',
          evidence: [`Caravana ${input.tag}`, `Carga realizada por ${input.responsible}`], relatedAnimalIds: [calf.id],
          severity: 'Crítica', recommendation: 'Revisar la carga antes de cerrar el registro.', operator: input.responsible,
          date: DEMO_TODAY, status: 'Abierta',
        }, ...current.alerts] : current.alerts,
        pendingSync: current.pendingSync + 1,
      }
    })
    trackEvent({ type: 'form_completed', module: 'Nacimientos', label: 'Nacimiento registrado', durationSeconds: 95 })
    return calf
  }, [mutate, state.animals, trackEvent])

  const addMilkRecord = useCallback((record: Omit<MilkRecord, 'id'>) => {
    mutate((current) => ({ ...current, milkRecords: [...current.milkRecords, { ...record, id: createId('milk') }], pendingSync: current.pendingSync + 1 }))
    trackEvent({ type: 'form_completed', module: 'Producción', label: 'Ordeñe cargado', durationSeconds: 68 })
  }, [mutate, trackEvent])

  const addTreatment = useCallback((treatment: Omit<Treatment, 'id' | 'active'>) => {
    const newTreatment: Treatment = { ...treatment, id: createId('treatment'), active: true }
    mutate((current) => ({
      ...current,
      treatments: [newTreatment, ...current.treatments],
      animals: current.animals.map((animal) => animal.id === treatment.animalId ? {
        ...animal,
        healthStatus: 'En tratamiento',
        timeline: [{
          id: createId('timeline'), date: treatment.startDate, type: 'Sanidad', title: treatment.diagnosis,
          detail: `${treatment.medicine} · ${treatment.dose}`, operator: treatment.responsible,
        }, ...animal.timeline],
      } : animal),
      pendingSync: current.pendingSync + 1,
    }))
    trackEvent({ type: 'form_completed', module: 'Sanidad', label: 'Tratamiento registrado', durationSeconds: 112 })
  }, [mutate, trackEvent])

  const addTask = useCallback((task: Omit<TaskItem, 'id'>) => {
    mutate((current) => ({ ...current, tasks: [{ ...task, id: createId('task') }, ...current.tasks], pendingSync: current.pendingSync + 1 }))
    trackEvent({ type: 'form_completed', module: 'Tareas', label: 'Tarea creada', durationSeconds: 54 })
  }, [mutate, trackEvent])

  const updateTaskStatus = useCallback((id: string, status: TaskItem['status']) => {
    mutate((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, status } : task), pendingSync: current.pendingSync + 1 }))
    trackEvent({ type: 'feature_use', module: 'Tareas', label: `Tarea ${status}`, durationSeconds: 14 })
  }, [mutate, trackEvent])

  const addRain = useCallback((record: Omit<RainRecord, 'id'>) => {
    mutate((current) => ({ ...current, rain: [...current.rain, { ...record, id: createId('rain') }], pendingSync: current.pendingSync + 1 }))
  }, [mutate])

  const addInventoryMovement = useCallback((movement: Omit<InventoryMovement, 'id'>) => {
    mutate((current) => ({
      ...current,
      inventoryMovements: [{ ...movement, id: createId('inventory-move') }, ...current.inventoryMovements],
      inventory: current.inventory.map((item) => item.id === movement.itemId ? { ...item, stock: Number((item.stock + movement.quantity).toFixed(2)) } : item),
      pendingSync: current.pendingSync + 1,
    }))
    trackEvent({ type: 'form_completed', module: 'Inventario', label: `${movement.type} registrada`, durationSeconds: 48 })
  }, [mutate, trackEvent])

  const updateAlert = useCallback((id: string, status: ConsistencyAlert['status']) => {
    mutate((current) => ({ ...current, alerts: current.alerts.map((alert) => alert.id === id ? { ...alert, status } : alert), pendingSync: current.pendingSync + 1 }))
    trackEvent({ type: 'feature_use', module: 'Consistencia', label: `Alerta ${status}`, durationSeconds: 36 })
  }, [mutate, trackEvent])

  const addReproductionEvent = useCallback((event: Omit<ReproductionEvent, 'id'>) => {
    mutate((current) => ({
      ...current,
      reproductionEvents: [{ ...event, id: createId('repro') }, ...current.reproductionEvents],
      animals: current.animals.map((animal) => animal.id === event.animalId ? {
        ...animal,
        reproductiveStatus: event.type === 'Tacto' ? (event.result === 'Positivo' ? 'Preñada' : 'Vacía') : event.type === 'Servicio' || event.type === 'Inseminación' ? 'Servida' : animal.reproductiveStatus,
        dueDate: event.type === 'Tacto' && event.result === 'Positivo' ? addDays(event.date, 210) : animal.dueDate,
        timeline: [{ id: createId('timeline'), date: event.date, type: 'Reproducción', title: event.type, detail: event.result, operator: event.responsible }, ...animal.timeline],
      } : animal),
      pendingSync: current.pendingSync + 1,
    }))
    trackEvent({ type: 'form_completed', module: 'Reproducción', label: `${event.type} registrado`, durationSeconds: 74 })
  }, [mutate, trackEvent])

  const addSurvey = useCallback((survey: Omit<SurveyResponse, 'id' | 'date' | 'interestScore'>) => {
    const score = (survey.ownDataInterest === 'Sí' ? 40 : survey.ownDataInterest === 'Quizás' ? 20 : 5) + (survey.contactRequested ? 35 : 0) + (Number(survey.animalCount) >= 300 ? 25 : 15)
    mutate((current) => ({
      ...current,
      surveys: [{ ...survey, id: createId('survey'), date: DEMO_TODAY, interestScore: Math.min(100, score) }, ...current.surveys],
      analyticsEvents: survey.contactRequested ? [...current.analyticsEvents, {
        id: createId('event'), date: DEMO_TODAY, sessionId: sessionId(), type: 'contact_request', module: 'Encuesta', label: 'Solicitud de contacto', durationSeconds: 0,
      }] : current.analyticsEvents,
      pendingSync: current.pendingSync + 1,
    }))
    trackEvent({ type: 'form_completed', module: 'Encuesta', label: 'Encuesta completada', durationSeconds: 120 })
  }, [mutate, trackEvent])

  const importAnimals = useCallback((animals: Animal[]) => {
    mutate((current) => ({ ...current, animals: [...animals, ...current.animals], pendingSync: current.pendingSync + animals.length }))
    trackEvent({ type: 'form_completed', module: 'Importación', label: `${animals.length} animales importados`, durationSeconds: 180 })
  }, [mutate, trackEvent])

  const moveLot = useCallback((lotId: string, difference: number) => {
    mutate((current) => ({ ...current, lots: current.lots.map((lot) => lot.id === lotId ? {
      ...lot,
      animalCount: Math.max(0, lot.animalCount + difference),
      occupancy: [...lot.occupancy, { date: DEMO_TODAY, count: Math.max(0, lot.animalCount + difference), event: difference > 0 ? 'Ingreso manual' : 'Salida manual' }],
    } : lot), pendingSync: current.pendingSync + 1 }))
  }, [mutate])

  const resetDemo = useCallback(async () => {
    await clearDemoState()
    setState(createInitialState())
  }, [])

  const value = useMemo<DemoContextValue>(() => ({
    state, ready, addBirth, addMilkRecord, addTreatment, addTask, updateTaskStatus, addRain,
    addInventoryMovement, updateAlert, addReproductionEvent, addSurvey, trackEvent, importAnimals, moveLot, resetDemo,
  }), [state, ready, addBirth, addMilkRecord, addTreatment, addTask, updateTaskStatus, addRain, addInventoryMovement, updateAlert, addReproductionEvent, addSurvey, trackEvent, importAnimals, moveLot, resetDemo])

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('useDemo debe usarse dentro de DemoProvider')
  return context
}
