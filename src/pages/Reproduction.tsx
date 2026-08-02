import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Baby, CalendarClock, CheckCircle2, HeartPulse, Plus, RefreshCcw, Search, Syringe, UserRound } from 'lucide-react'
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Badge, Button, Field, Modal, PageHeader, Panel, StatCard } from '../components/ui'
import { DEMO_TODAY, daysBetween, formatDate, OPERATORS } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { ReproductionEvent } from '../types'

const queueLabels = ['Para servir', 'Para tactar', 'Repetidoras', 'Próximas a secar', 'Próximas a parir', 'Vacías +120 días']

export default function Reproduction() {
  const { state, addReproductionEvent, trackEvent } = useDemo()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const eligible = state.animals.filter((animal) => animal.status === 'Activo' && animal.sex === 'Hembra' && ['Vaca en ordeñe', 'Vaca seca', 'Vaquillona'].includes(animal.category))
  const defaultAnimal = eligible.find((animal) => animal.id === params.get('animal')) ?? eligible[0]
  const [queue, setQueue] = useState('Para servir')
  const [modalOpen, setModalOpen] = useState(Boolean(params.get('animal')))
  const [animalId, setAnimalId] = useState(defaultAnimal.id)
  const [type, setType] = useState<ReproductionEvent['type']>('Servicio')
  const [date, setDate] = useState(DEMO_TODAY)
  const [result, setResult] = useState('Realizado')
  const [bull, setBull] = useState('Genética H-248')
  const [responsible, setResponsible] = useState(OPERATORS[0])
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  const pregnant = eligible.filter((animal) => animal.reproductiveStatus === 'Preñada')
  const empty = eligible.filter((animal) => animal.reproductiveStatus === 'Vacía')
  const served = eligible.filter((animal) => animal.reproductiveStatus === 'Servida')
  const due30 = pregnant.filter((animal) => animal.dueDate && daysBetween(DEMO_TODAY, animal.dueDate) <= 30)
  const drySoon = pregnant.filter((animal) => animal.dueDate && daysBetween(DEMO_TODAY, animal.dueDate) > 30 && daysBetween(DEMO_TODAY, animal.dueDate) <= 75)

  const queues = useMemo(() => ({
    'Para servir': empty.filter((_, index) => index % 2 === 0),
    'Para tactar': served,
    'Repetidoras': empty.filter((_, index) => index % 5 === 0),
    'Próximas a secar': drySoon,
    'Próximas a parir': due30,
    'Vacías +120 días': empty.filter((animal) => animal.daysInMilk > 120),
  }), [empty, served, drySoon, due30])
  const visible = queues[queue as keyof typeof queues].filter((animal) => !search || `${animal.tag} ${animal.name}`.toLowerCase().includes(search.toLowerCase()))
  const pieData = [{ name: 'Preñadas', value: pregnant.length, color: '#2e7d5b' }, { name: 'Servidas', value: served.length, color: '#4d83b8' }, { name: 'Vacías', value: empty.length, color: '#d99c4b' }]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    addReproductionEvent({ animalId, type, date, result, bull, responsible })
    setMessage(`${type} guardado. La ficha y la lista reproductiva se actualizaron.`)
    setModalOpen(false)
  }

  return (
    <>
      <PageHeader eyebrow="Manejo reproductivo" title="Reproducción" description="Servicios, tactos, preñeces, secados y partos con listas listas para trabajar." actions={<Button onClick={() => { setMessage(''); setModalOpen(true) }}><Plus size={18}/> Registrar evento</Button>} />
      {message && <div className="success-banner page-success"><CheckCircle2 size={19}/><span>{message}</span></div>}
      <div className="stat-grid stat-grid-4"><StatCard label="Preñadas" value={pregnant.length} hint={`${Math.round(pregnant.length / eligible.length * 100)}% del rodeo elegible`} icon={HeartPulse}/><StatCard label="Para tactar" value={served.length} hint="Servicio con control pendiente" icon={Syringe} tone="blue"/><StatCard label="Próximas a parir" value={due30.length} hint="Ventana de 30 días" icon={Baby} tone="purple"/><StatCard label="Vacías +120 días" value={queues['Vacías +120 días'].length} hint="Prioridad productiva" icon={CalendarClock} tone="red"/></div>
      <div className="repro-overview">
        <Panel title="Estado del rodeo elegible" subtitle={`${eligible.length} hembras en seguimiento`}><div className="repro-pie-layout"><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" innerRadius={58} outerRadius={86} paddingAngle={3}>{pieData.map((item) => <Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><span><strong>{eligible.length}</strong><small>hembras</small></span></div><div className="chart-legend">{pieData.map((item) => <div key={item.name}><span style={{ background: item.color }}/><div><strong>{item.value}</strong><small>{item.name}</small></div></div>)}</div></div></Panel>
        <Panel title="Próximos hitos" subtitle="Fechas probables de parto y secado"><div className="milestone-list">{pregnant.filter((animal) => animal.dueDate).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).slice(0, 6).map((animal) => <button key={animal.id} onClick={() => navigate(`/animales/${animal.id}`)}><span className="calendar-tile"><small>{animal.dueDate?.slice(5,7)}</small><strong>{animal.dueDate?.slice(8)}</strong></span><div><strong>{animal.tag}</strong><span>{animal.farm}</span></div><Badge tone={animal.dueDate && daysBetween(DEMO_TODAY, animal.dueDate) <= 30 ? 'warning' : 'info'}>{animal.dueDate ? `${daysBetween(DEMO_TODAY, animal.dueDate)} días` : '—'}</Badge></button>)}</div></Panel>
      </div>
      <Panel title="Listas de trabajo" subtitle="Priorización automática según estado y días transcurridos">
        <div className="queue-tabs">{queueLabels.map((label) => <button key={label} className={queue === label ? 'active' : ''} onClick={() => setQueue(label)}><span>{label}</span><Badge tone={queue === label ? 'success' : 'neutral'}>{queues[label as keyof typeof queues].length}</Badge></button>)}</div>
        <label className="search-field queue-search"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar caravana en esta lista"/></label>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Animal</th><th>Categoría</th><th>Estado actual</th><th>Último evento</th><th>Fecha objetivo</th><th>Responsable</th><th>Acción</th></tr></thead><tbody>{visible.slice(0, 18).map((animal, index) => { const last = state.reproductionEvents.find((event) => event.animalId === animal.id); return <tr key={animal.id}><td><button className="table-animal-link" onClick={() => navigate(`/animales/${animal.id}`)}><span className="animal-avatar">{animal.tag.slice(-2)}</span><div><strong>{animal.tag}</strong><span>{animal.name}</span></div></button></td><td>{animal.category}</td><td><Badge tone={animal.reproductiveStatus === 'Preñada' ? 'success' : animal.reproductiveStatus === 'Vacía' ? 'warning' : 'info'}>{animal.reproductiveStatus}</Badge></td><td>{last ? <><strong>{last.type}</strong><small className="table-subline">{formatDate(last.date)}</small></> : 'Sin evento'}</td><td>{animal.dueDate ? formatDate(animal.dueDate) : formatDate(new Date(Date.parse(DEMO_TODAY) + (index + 7) * 86400000).toISOString().slice(0,10))}</td><td><span className="operator"><UserRound size={14}/>{OPERATORS[index % 4]}</span></td><td><Button variant="ghost" onClick={() => { setAnimalId(animal.id); setType(queue === 'Para tactar' ? 'Tacto' : queue === 'Próximas a secar' ? 'Secado' : 'Servicio'); setModalOpen(true) }}>Registrar</Button></td></tr>})}</tbody></table></div>
      </Panel>
      <Modal open={modalOpen} title="Registrar evento reproductivo" eyebrow="Nueva carga" onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} onFocus={() => trackEvent({ type: 'form_started', module: 'Reproducción', label: 'Evento reproductivo iniciado', durationSeconds: 0 })}><div className="form-grid two-cols"><Field label="Animal"><select value={animalId} onChange={(event) => setAnimalId(event.target.value)}>{eligible.map((animal) => <option key={animal.id} value={animal.id}>{animal.tag} · {animal.category}</option>)}</select></Field><Field label="Tipo de evento"><select value={type} onChange={(event) => { const value = event.target.value as ReproductionEvent['type']; setType(value); setResult(value === 'Tacto' ? 'Positivo' : 'Realizado') }}><option>Servicio</option><option>Inseminación</option><option>Tacto</option><option>Secado</option><option>Aborto</option><option>Parto</option></select></Field><Field label="Fecha"><input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></Field><Field label="Resultado"><select value={result} onChange={(event) => setResult(event.target.value)}>{type === 'Tacto' ? <><option>Positivo</option><option>Negativo</option><option>Dudoso</option></> : <><option>Realizado</option><option>No realizado</option></>}</select></Field><Field label="Toro / semen"><input value={bull} onChange={(event) => setBull(event.target.value)} /></Field><Field label="Responsable"><select value={responsible} onChange={(event) => setResponsible(event.target.value)}>{OPERATORS.map((item) => <option key={item}>{item}</option>)}</select></Field></div><div className="modal-actions"><Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit"><RefreshCcw size={17}/> Guardar evento</Button></div></form>
      </Modal>
    </>
  )
}
