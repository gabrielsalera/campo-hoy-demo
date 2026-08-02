import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Milk, Plus, Search, ShieldAlert, Stethoscope, Syringe, UserRound } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Field, Modal, PageHeader, Panel, StatCard } from '../components/ui'
import { DEMO_TODAY, addDays, formatDate, OPERATORS } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { Treatment } from '../types'

export default function Health() {
  const { state, addTreatment, trackEvent } = useDemo()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initialAnimal = state.animals.find((animal) => animal.id === params.get('animal')) ?? state.animals.find((animal) => animal.category === 'Vaca en ordeñe')!
  const [modalOpen, setModalOpen] = useState(Boolean(params.get('animal')))
  const [animalId, setAnimalId] = useState(initialAnimal.id)
  const [diagnosis, setDiagnosis] = useState('Mastitis clínica')
  const [medicine, setMedicine] = useState('Lactomicina')
  const [dose, setDose] = useState('12 ml')
  const [frequency, setFrequency] = useState('Cada 12 horas')
  const [responsible, setResponsible] = useState(OPERATORS[0])
  const [startDate, setStartDate] = useState(DEMO_TODAY)
  const [endDate, setEndDate] = useState(addDays(DEMO_TODAY, 4))
  const [milkWithdrawalUntil, setMilkWithdrawalUntil] = useState(addDays(DEMO_TODAY, 5))
  const [meatWithdrawalUntil, setMeatWithdrawalUntil] = useState(addDays(DEMO_TODAY, 18))
  const [evolution, setEvolution] = useState<Treatment['evolution']>('Estable')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Activos')
  const [message, setMessage] = useState('')
  const active = state.treatments.filter((treatment) => treatment.active)
  const milkWithdrawal = active.filter((treatment) => treatment.milkWithdrawalUntil && treatment.milkWithdrawalUntil >= DEMO_TODAY)
  const meatWithdrawal = active.filter((treatment) => treatment.meatWithdrawalUntil && treatment.meatWithdrawalUntil >= DEMO_TODAY)
  const visible = state.treatments.filter((treatment) => {
    const animal = state.animals.find((item) => item.id === treatment.animalId)
    const matchQuery = !search || `${animal?.tag} ${treatment.diagnosis} ${treatment.medicine}`.toLowerCase().includes(search.toLowerCase())
    return matchQuery && (filter === 'Todos' || (filter === 'Activos' ? treatment.active : !treatment.active))
  })
  const diagnoses = useMemo(() => {
    const map = new Map<string, number>()
    state.treatments.forEach((treatment) => map.set(treatment.diagnosis, (map.get(treatment.diagnosis) ?? 0) + 1))
    return [...map.entries()].map(([name, count]) => ({ name, count }))
  }, [state.treatments])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    addTreatment({ animalId, diagnosis, medicine, dose, frequency, responsible, startDate, endDate, milkWithdrawalUntil: milkWithdrawalUntil || undefined, meatWithdrawalUntil: meatWithdrawalUntil || undefined, evolution })
    const animal = state.animals.find((item) => item.id === animalId)
    setMessage(`Tratamiento guardado para ${animal?.tag}. Su leche queda excluida hasta ${formatDate(milkWithdrawalUntil)}.`)
    setModalOpen(false)
  }

  return (
    <>
      <PageHeader eyebrow="Plan sanitario" title="Sanidad" description="Tratamientos, evolución y retiros visibles antes de que la leche llegue al tanque." actions={<Button onClick={() => setModalOpen(true)}><Plus size={18}/> Registrar tratamiento</Button>} />
      {message && <div className="success-banner page-success" data-testid="treatment-success"><CheckCircle2 size={19}/><span>{message}</span></div>}
      {milkWithdrawal.length > 0 && <div className="withdrawal-banner"><span className="withdrawal-icon"><Milk size={25}/></span><div><Badge tone="danger">Retiro de leche activo</Badge><h2>{milkWithdrawal.length} animales no pueden ingresar al tanque</h2><p>Separar durante el ordeñe y verificar la fecha individual antes de liberar la leche.</p></div><Button variant="secondary" onClick={() => setFilter('Activos')}>Ver animales</Button></div>}
      <div className="stat-grid stat-grid-4"><StatCard label="Tratamientos activos" value={active.length} hint="Seguimiento diario" icon={Stethoscope}/><StatCard label="Retiro de leche" value={milkWithdrawal.length} hint="Bloqueo productivo" icon={Milk} tone="red"/><StatCard label="Retiro de carne" value={meatWithdrawal.length} hint="Restricción vigente" icon={ShieldAlert} tone="amber"/><StatCard label="Requieren control" value={active.filter((item) => item.evolution === 'Requiere control').length} hint="Evolución sin mejora" icon={AlertTriangle} tone="red"/></div>
      <div className="health-layout">
        <Panel title="Tratamientos recientes" subtitle="Filtros por estado, caravana, diagnóstico o medicamento" className="table-panel"><div className="table-toolbar"><label className="search-field"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tratamiento"/></label><div className="inline-tabs">{['Activos', 'Finalizados', 'Todos'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="treatment-list">{visible.map((treatment) => { const animal = state.animals.find((item) => item.id === treatment.animalId); const withMilkWithdrawal = treatment.milkWithdrawalUntil && treatment.milkWithdrawalUntil >= DEMO_TODAY; return <article key={treatment.id}><div className={`treatment-status ${withMilkWithdrawal ? 'blocked' : 'normal'}`}>{withMilkWithdrawal ? <Milk size={19}/> : <Stethoscope size={19}/>}</div><div className="treatment-animal"><button onClick={() => navigate(`/animales/${animal?.id}`)}><strong>{animal?.tag}</strong><span>{animal?.name}</span></button><Badge tone={treatment.active ? 'warning' : 'neutral'}>{treatment.active ? 'Activo' : 'Finalizado'}</Badge></div><div><span>Diagnóstico</span><strong>{treatment.diagnosis}</strong><small>{treatment.medicine} · {treatment.dose}</small></div><div><span>Evolución</span><Badge tone={treatment.evolution === 'Mejora' ? 'success' : treatment.evolution === 'Requiere control' ? 'danger' : 'info'}>{treatment.evolution}</Badge></div><div><span>Retiro de leche</span><strong className={withMilkWithdrawal ? 'danger-text' : ''}>{treatment.milkWithdrawalUntil ? formatDate(treatment.milkWithdrawalUntil) : 'Sin retiro'}</strong><small>{withMilkWithdrawal ? 'No enviar al tanque' : 'Sin bloqueo vigente'}</small></div><div><span>Responsable</span><strong className="operator"><UserRound size={14}/>{treatment.responsible}</strong></div></article>})}</div></Panel>
        <aside><Panel title="Diagnósticos frecuentes" subtitle="Últimos 18 meses"><div className="medium-chart health-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={diagnoses} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickLine={false} axisLine={false}/><YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={false}/><Tooltip/><Bar dataKey="count" name="Casos" fill="#4d83b8" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></Panel><Panel title="Próximos controles"><div className="control-list">{active.slice(0, 5).map((treatment, index) => { const animal = state.animals.find((item) => item.id === treatment.animalId); return <div key={treatment.id}><span className="calendar-tile"><small>AGO</small><strong>{String(3 + index).padStart(2,'0')}</strong></span><div><strong>{animal?.tag} · {treatment.diagnosis}</strong><span>{treatment.responsible}</span></div></div>})}</div></Panel></aside>
      </div>
      <Modal open={modalOpen} title="Registrar tratamiento" eyebrow="Sanidad individual" onClose={() => setModalOpen(false)} width="large">
        <form onSubmit={submit} onFocus={() => trackEvent({ type: 'form_started', module: 'Sanidad', label: 'Tratamiento iniciado', durationSeconds: 0 })}><div className="form-grid three-cols"><Field label="Animal"><select value={animalId} onChange={(event) => setAnimalId(event.target.value)}>{state.animals.filter((animal) => animal.status === 'Activo').map((animal) => <option key={animal.id} value={animal.id}>{animal.tag} · {animal.category}</option>)}</select></Field><Field label="Diagnóstico"><input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} required/></Field><Field label="Medicamento"><input value={medicine} onChange={(event) => setMedicine(event.target.value)} required/></Field><Field label="Dosis"><input value={dose} onChange={(event) => setDose(event.target.value)} required/></Field><Field label="Frecuencia"><select value={frequency} onChange={(event) => setFrequency(event.target.value)}><option>Cada 12 horas</option><option>Cada 24 horas</option><option>Dosis única</option></select></Field><Field label="Responsable"><select value={responsible} onChange={(event) => setResponsible(event.target.value)}>{OPERATORS.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Fecha inicial"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)}/></Field><Field label="Fecha final"><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)}/></Field><Field label="Evolución"><select value={evolution} onChange={(event) => setEvolution(event.target.value as Treatment['evolution'])}><option>Estable</option><option>Mejora</option><option>Requiere control</option></select></Field><Field label="Retiro de leche hasta"><input type="date" value={milkWithdrawalUntil} onChange={(event) => setMilkWithdrawalUntil(event.target.value)} data-testid="milk-withdrawal-date"/></Field><Field label="Retiro de carne hasta"><input type="date" value={meatWithdrawalUntil} onChange={(event) => setMeatWithdrawalUntil(event.target.value)}/></Field></div><div className="withdrawal-preview"><Milk size={20}/><div><strong>Bloqueo preventivo de leche</strong><span>Al guardar, el animal aparecerá inmediatamente en la lista de retiro hasta {formatDate(milkWithdrawalUntil)}.</span></div></div><div className="modal-actions"><Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" data-testid="save-treatment"><Syringe size={18}/> Guardar tratamiento</Button></div></form>
      </Modal>
    </>
  )
}
