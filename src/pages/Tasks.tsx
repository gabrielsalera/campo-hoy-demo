import { useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Clock3, ListTodo, MessageSquare, Plus, UserRound } from 'lucide-react'
import { Badge, Button, Field, Modal, PageHeader, Panel, Segmented, StatCard } from '../components/ui'
import { DEMO_TODAY, formatDate, OPERATORS } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { TaskItem } from '../types'

export default function Tasks() {
  const { state, addTask, updateTaskStatus, trackEvent } = useDemo()
  const [view, setView] = useState('Lista')
  const [filter, setFilter] = useState('Todas')
  const [modalOpen, setModalOpen] = useState(false)
  const [calendarOffset, setCalendarOffset] = useState(0)
  const [title, setTitle] = useState('Controlar lote de preparto')
  const [responsible, setResponsible] = useState(OPERATORS[0])
  const [priority, setPriority] = useState<TaskItem['priority']>('Alta')
  const [dueDate, setDueDate] = useState('2026-08-04')
  const [recurrence, setRecurrence] = useState<TaskItem['recurrence']>('Semanal')
  const [status, setStatus] = useState<TaskItem['status']>('Pendiente')
  const [comments, setComments] = useState('Revisar condición corporal y disponibilidad de agua.')
  const [relatedType, setRelatedType] = useState<TaskItem['relatedType']>('Lote')
  const [relatedId, setRelatedId] = useState(state.lots[2].id)
  const [message, setMessage] = useState('')
  const pending = state.tasks.filter((task) => task.status === 'Pendiente')
  const inProgress = state.tasks.filter((task) => task.status === 'En progreso')
  const overdue = state.tasks.filter((task) => task.status !== 'Completada' && task.dueDate < DEMO_TODAY)
  const completed = state.tasks.filter((task) => task.status === 'Completada')
  const visible = state.tasks.filter((task) => filter === 'Todas' || task.status === filter || (filter === 'Vencidas' && task.status !== 'Completada' && task.dueDate < DEMO_TODAY)).sort((a,b) => a.dueDate.localeCompare(b.dueDate))
  const firstOpenTaskId = visible.find((task) => task.status !== 'Completada')?.id

  const calendar = useMemo(() => {
    const first = new Date('2026-08-01T12:00:00Z')
    first.setUTCMonth(first.getUTCMonth() + calendarOffset)
    const blanks = first.getUTCDay()
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - blanks + 1
      const date = new Date(first); date.setUTCDate(day)
      const iso = date.toISOString().slice(0, 10)
      return { day: date.getUTCDate(), current: date.getUTCMonth() === first.getUTCMonth(), iso, tasks: state.tasks.filter((task) => task.dueDate === iso) }
    })
  }, [state.tasks, calendarOffset])
  const calendarDate = new Date('2026-08-01T12:00:00Z')
  calendarDate.setUTCMonth(calendarDate.getUTCMonth() + calendarOffset)
  const calendarLabel = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(calendarDate)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    addTask({ title, responsible, priority, dueDate, recurrence, status, comments, relatedType, relatedId: relatedType === 'General' ? undefined : relatedId })
    setMessage(`Tarea “${title}” creada y asignada a ${responsible}.`)
    setModalOpen(false)
  }

  const complete = (task: TaskItem) => {
    updateTaskStatus(task.id, 'Completada')
    setMessage(`Tarea “${task.title}” completada.`)
  }

  return (
    <>
      <PageHeader eyebrow="Organización del equipo" title="Tareas" description="Prioridades, responsables, recurrencias y seguimiento vinculados al rodeo." actions={<div className="header-action-group"><Segmented options={['Lista', 'Calendario']} value={view} onChange={setView} label="Vista de tareas"/><Button onClick={() => setModalOpen(true)}><Plus size={18}/> Nueva tarea</Button></div>} />
      {message && <div className="success-banner page-success" data-testid="task-success"><CheckCircle2 size={19}/><span>{message}</span></div>}
      <div className="stat-grid stat-grid-4"><StatCard label="Pendientes" value={pending.length} hint="Por iniciar" icon={ListTodo}/><StatCard label="En progreso" value={inProgress.length} hint="Con responsable activo" icon={CircleDot} tone="blue"/><StatCard label="Vencidas" value={overdue.length} hint="Fuera de fecha" icon={Clock3} tone="red"/><StatCard label="Completadas" value={completed.length} hint="Historial disponible" icon={CheckCircle2} tone="green"/></div>
      <Panel className="task-panel" title={view === 'Lista' ? 'Plan de trabajo' : calendarLabel} subtitle={view === 'Lista' ? `${visible.length} tareas en la vista actual` : 'Vencimientos y recurrencias del equipo'} action={view === 'Lista' ? <div className="inline-tabs">{['Todas', 'Pendiente', 'En progreso', 'Vencidas', 'Completada'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div> : <div className="calendar-navigation"><Button variant="ghost" aria-label="Mes anterior" onClick={() => setCalendarOffset((value) => value - 1)}><ChevronLeft size={17}/></Button><strong>{calendarLabel}</strong><Button variant="ghost" aria-label="Mes siguiente" onClick={() => setCalendarOffset((value) => value + 1)}><ChevronRight size={17}/></Button></div>}>
        {view === 'Lista' ? <div className="task-cards">{visible.map((task) => <article key={task.id} className={task.status === 'Completada' ? 'completed' : ''}><button className={`task-check ${task.status === 'Completada' ? 'checked' : ''}`} aria-label={task.status === 'Completada' ? 'Reabrir tarea' : 'Completar tarea'} data-testid={task.id === firstOpenTaskId ? 'complete-task' : undefined} onClick={() => task.status === 'Completada' ? updateTaskStatus(task.id, 'Pendiente') : complete(task)}>{task.status === 'Completada' ? <Check size={17}/> : null}</button><div className="task-main"><div className="task-topline"><Badge tone={task.priority === 'Crítica' ? 'danger' : task.priority === 'Alta' ? 'warning' : task.priority === 'Media' ? 'info' : 'neutral'}>{task.priority}</Badge><Badge tone={task.status === 'Completada' ? 'success' : task.status === 'En progreso' ? 'purple' : 'neutral'}>{task.status}</Badge>{task.recurrence !== 'Sin repetición' && <Badge tone="info">↻ {task.recurrence}</Badge>}</div><h3>{task.title}</h3>{task.comments && <p>{task.comments}</p>}<div className="task-meta"><span><CalendarDays size={14}/>{formatDate(task.dueDate)}</span><span><UserRound size={14}/>{task.responsible}</span><span><MessageSquare size={14}/>{task.relatedType}{task.relatedId ? ` · ${task.relatedId}` : ''}</span></div></div><div className="task-quick-actions">{task.status === 'Pendiente' && <Button variant="ghost" onClick={() => updateTaskStatus(task.id, 'En progreso')}>Iniciar</Button>}{task.status !== 'Completada' && <Button variant="secondary" onClick={() => complete(task)}>Completar</Button>}</div></article>)}</div> : <div className="calendar-view"><div className="calendar-weekdays">{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendar.map((day, index) => <div key={`${day.iso}-${index}`} className={`${day.current ? '' : 'other-month'} ${day.iso === DEMO_TODAY ? 'today' : ''}`}><span>{day.day}</span><div>{day.tasks.slice(0,3).map((task) => <span key={task.id} title={task.title} className={`calendar-task priority-${task.priority.toLowerCase()}`}>{task.title}</span>)}{day.tasks.length > 3 && <small>+{day.tasks.length - 3} más</small>}</div></div>)}</div></div>}
      </Panel>
      <Modal open={modalOpen} title="Crear tarea" eyebrow="Plan de trabajo" onClose={() => setModalOpen(false)} width="large"><form onSubmit={submit} onFocus={() => trackEvent({ type: 'form_started', module: 'Tareas', label: 'Nueva tarea iniciada', durationSeconds: 0 })}><div className="form-grid two-cols"><Field label="Título"><input value={title} onChange={(event) => setTitle(event.target.value)} required/></Field><Field label="Responsable"><select value={responsible} onChange={(event) => setResponsible(event.target.value)}>{OPERATORS.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Prioridad"><select value={priority} onChange={(event) => setPriority(event.target.value as TaskItem['priority'])}><option>Crítica</option><option>Alta</option><option>Media</option><option>Baja</option></select></Field><Field label="Fecha"><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required/></Field><Field label="Recurrencia"><select value={recurrence} onChange={(event) => setRecurrence(event.target.value as TaskItem['recurrence'])}><option>Sin repetición</option><option>Diaria</option><option>Semanal</option><option>Mensual</option></select></Field><Field label="Estado inicial"><select value={status} onChange={(event) => setStatus(event.target.value as TaskItem['status'])}><option>Pendiente</option><option>En progreso</option><option>Completada</option></select></Field><Field label="Relación"><select value={relatedType} onChange={(event) => { const value = event.target.value as TaskItem['relatedType']; setRelatedType(value); setRelatedId(value === 'Animal' ? state.animals[0].id : state.lots[0].id) }}><option>Animal</option><option>Lote</option><option>General</option></select></Field>{relatedType !== 'General' && <Field label={relatedType}><select value={relatedId} onChange={(event) => setRelatedId(event.target.value)}>{relatedType === 'Animal' ? state.animals.slice(0,100).map((animal) => <option key={animal.id} value={animal.id}>{animal.tag} · {animal.category}</option>) : state.lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.name} · {lot.farm}</option>)}</select></Field>}</div><Field label="Comentarios"><textarea rows={3} value={comments} onChange={(event) => setComments(event.target.value)}/></Field><div className="modal-actions"><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit"><Plus size={18}/> Crear tarea</Button></div></form></Modal>
    </>
  )
}
