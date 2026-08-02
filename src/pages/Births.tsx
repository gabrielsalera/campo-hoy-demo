import { useMemo, useState, type FormEvent } from 'react'
import { Baby, CheckCircle2, ClipboardPlus, Scale, Search, Sparkles, UserRound } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Field, PageHeader, Panel, StatCard } from '../components/ui'
import { DEMO_TODAY, formatDate, formatNumber, OPERATORS } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { Birth } from '../types'

export default function Births() {
  const { state, addBirth, trackEvent } = useDemo()
  const mothers = state.animals.filter((animal) => animal.sex === 'Hembra' && animal.status === 'Activo' && ['Vaca en ordeñe', 'Vaca seca', 'Vaquillona'].includes(animal.category))
  const defaultMother = mothers.find((animal) => animal.reproductiveStatus === 'Preñada') ?? mothers[0]
  const [motherQuery, setMotherQuery] = useState(defaultMother?.tag ?? '')
  const [motherId, setMotherId] = useState(defaultMother?.id ?? '')
  const [date, setDate] = useState(DEMO_TODAY)
  const [type, setType] = useState<Birth['type']>('Simple')
  const [sex, setSex] = useState<Birth['sex']>('Hembra')
  const [weight, setWeight] = useState(39)
  const [tag, setTag] = useState(`CH-${202000 + state.animals.length + 1}`)
  const [status, setStatus] = useState<Birth['status']>('Viva')
  const [notes, setNotes] = useState('Calostrado dentro de las primeras dos horas.')
  const [responsible, setResponsible] = useState(OPERATORS[0])
  const [message, setMessage] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = mothers.filter((animal) => `${animal.tag} ${animal.name}`.toLowerCase().includes(motherQuery.toLowerCase())).slice(0, 6)
  const selectedMother = mothers.find((animal) => animal.id === motherId)

  const monthly = useMemo(() => {
    const groups = new Map<string, { month: string; births: number; alive: number }>()
    state.births.forEach((birth) => {
      const month = birth.date.slice(0, 7)
      const current = groups.get(month) ?? { month, births: 0, alive: 0 }
      current.births += 1
      if (birth.status !== 'Muerta al parto') current.alive += 1
      groups.set(month, current)
    })
    return [...groups.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map((item) => ({ ...item, month: item.month.slice(5) }))
  }, [state.births])
  const last30 = state.births.filter((birth) => birth.date >= '2026-07-03')
  const liveRate = last30.length ? Math.round(last30.filter((birth) => birth.status !== 'Muerta al parto').length / last30.length * 100) : 100

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!motherId || !tag.trim()) return
    const previousStock = state.animals.filter((animal) => animal.status === 'Activo').length
    const calf = addBirth({ motherId, date, type, sex, weight, tag: tag.trim().toUpperCase(), status, notes, responsible })
    setMessage(`Nacimiento guardado. ${calf.tag} ya tiene ficha e incrementó el stock de ${previousStock} a ${previousStock + (calf.status === 'Activo' ? 1 : 0)}.`)
    setTag(`CH-${202000 + state.animals.length + 2}`)
  }

  return (
    <>
      <PageHeader eyebrow="Partos y crías" title="Registrar un nacimiento" description="Una sola carga crea la cría, actualiza la madre y deja trazabilidad en stock e historial." actions={<Badge tone="success"><Sparkles size={14} /> Flujo conectado</Badge>} />
      <div className="birth-layout">
        <Panel className="birth-form-panel" title="Datos del parto" subtitle="Los campos obligatorios están marcados con *">
          {message && <div className="success-banner" role="status" data-testid="birth-success"><CheckCircle2 size={19}/><span>{message}</span></div>}
          <form onSubmit={submit} onFocus={() => trackEvent({ type: 'form_started', module: 'Nacimientos', label: 'Formulario de nacimiento iniciado', durationSeconds: 0 })}>
            <div className="form-section"><h3><span>1</span> Madre y fecha</h3><div className="form-grid two-cols">
              <Field label="Madre *"><div className="autocomplete"><Search size={17}/><input value={motherQuery} onChange={(event) => { setMotherQuery(event.target.value); setMotherId(''); setShowSuggestions(true) }} onFocus={() => setShowSuggestions(true)} aria-label="Seleccionar madre" required />{showSuggestions && <div className="suggestions">{suggestions.map((animal) => <button type="button" key={animal.id} onClick={() => { setMotherId(animal.id); setMotherQuery(animal.tag); setShowSuggestions(false) }}><span className="animal-avatar">{animal.tag.slice(-2)}</span><div><strong>{animal.tag}</strong><small>{animal.category} · {animal.reproductiveStatus}</small></div></button>)}</div>}</div></Field>
              <Field label="Fecha del parto *"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field>
            </div>{selectedMother && <div className="selected-mother"><span className="animal-avatar">{selectedMother.tag.slice(-2)}</span><div><strong>{selectedMother.tag} · {selectedMother.name}</strong><span>{selectedMother.farm} · {selectedMother.lot}</span></div><Badge tone={selectedMother.reproductiveStatus === 'Preñada' ? 'success' : 'warning'}>{selectedMother.reproductiveStatus}</Badge></div>}</div>
            <div className="form-section"><h3><span>2</span> Parto y cría</h3><div className="form-grid three-cols">
              <Field label="Tipo de parto"><select value={type} onChange={(event) => setType(event.target.value as Birth['type'])}><option>Simple</option><option>Múltiple</option></select></Field>
              <Field label="Sexo"><select value={sex} onChange={(event) => setSex(event.target.value as Birth['sex'])}><option>Hembra</option><option>Macho</option></select></Field>
              <Field label="Peso al nacer (kg)"><input type="number" min="15" max="80" value={weight} onChange={(event) => setWeight(Number(event.target.value))} required /></Field>
              <Field label="Caravana *"><input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="CH-202513" data-testid="birth-tag" required /></Field>
              <Field label="Estado de la cría"><select value={status} onChange={(event) => setStatus(event.target.value as Birth['status'])}><option>Viva</option><option>En observación</option><option>Muerta al parto</option></select></Field>
              <Field label="Responsable"><select value={responsible} onChange={(event) => setResponsible(event.target.value)}>{OPERATORS.map((operator) => <option key={operator}>{operator}</option>)}</select></Field>
            </div></div>
            <div className="form-section"><h3><span>3</span> Observaciones</h3><Field label="Notas del parto"><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Presentación, asistencia, calostrado…" /></Field></div>
            <div className="form-footer"><div><ClipboardPlus size={18}/><span>Se crearán <strong>5 registros relacionados</strong>: parto, cría, madre, stock e historial.</span></div><Button type="submit" data-testid="save-birth"><Baby size={18}/> Guardar nacimiento</Button></div>
          </form>
        </Panel>
        <aside className="birth-side">
          <div className="stat-grid"><StatCard label="Nacimientos 30 días" value={last30.length} hint={`${liveRate}% crías vivas`} icon={Baby} /><StatCard label="Peso promedio" value={`${(last30.reduce((sum, birth) => sum + birth.weight, 0) / Math.max(1, last30.length)).toFixed(1)} kg`} hint="Últimos 30 días" icon={Scale} tone="blue" /></div>
          <Panel title="Qué se actualiza al guardar"><ul className="check-list"><li><CheckCircle2 size={17}/> Nueva ficha de la cría</li><li><CheckCircle2 size={17}/> Evento de parto en la madre</li><li><CheckCircle2 size={17}/> Stock del establecimiento</li><li><CheckCircle2 size={17}/> Línea de tiempo y reproducción</li><li><CheckCircle2 size={17}/> Control automático de duplicados</li></ul></Panel>
          <Panel title="Últimos nacimientos" subtitle="Más recientes primero"><div className="recent-births">{state.births.slice(0, 5).map((birth) => { const calf = state.animals.find((animal) => animal.id === birth.calfId); const mother = state.animals.find((animal) => animal.id === birth.motherId); return <div key={birth.id}><span className="animal-avatar">{calf?.tag.slice(-2) ?? '—'}</span><div><strong>{calf?.tag ?? 'Cría pendiente'}</strong><span>Madre {mother?.tag ?? 'sin vínculo'}</span></div><small>{formatDate(birth.date)}</small></div> })}</div></Panel>
        </aside>
      </div>
      <Panel title="Evolución de nacimientos" subtitle="Partos y supervivencia de los últimos 12 meses"><div className="medium-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip formatter={(value) => formatNumber(Number(value))}/><Bar dataKey="births" name="Nacimientos" fill="#4d83b8" radius={[5,5,0,0]}/><Bar dataKey="alive" name="Crías vivas" fill="#2e7d5b" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="Historial de partos" subtitle={`${state.births.length} registros ficticios`}><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Madre</th><th>Cría</th><th>Tipo</th><th>Sexo</th><th>Peso</th><th>Estado</th><th>Responsable</th></tr></thead><tbody>{state.births.slice(0, 20).map((birth) => { const calf = state.animals.find((animal) => animal.id === birth.calfId); const mother = state.animals.find((animal) => animal.id === birth.motherId); return <tr key={birth.id}><td>{formatDate(birth.date)}</td><td>{mother?.tag ?? 'Sin ficha'}</td><td>{calf?.tag ?? 'Pendiente'}</td><td>{birth.type}</td><td>{birth.sex}</td><td>{birth.weight} kg</td><td><Badge tone={birth.status === 'Viva' ? 'success' : birth.status === 'En observación' ? 'warning' : 'danger'}>{birth.status}</Badge></td><td><span className="operator"><UserRound size={14}/>{birth.responsible}</span></td></tr> })}</tbody></table></div></Panel>
    </>
  )
}
