import { useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Map, MapPin, MoveRight, Plus, Ruler, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Field, Modal, PageHeader, ProgressBar } from '../components/ui'
import { DEMO_TODAY, FARMS, formatDate, OPERATORS } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { Lot } from '../types'

export default function Lots() {
  const { state, moveLot, trackEvent } = useDemo()
  const [farm, setFarm] = useState('Todos')
  const [selected, setSelected] = useState<Lot | null>(null)
  const [movementLot, setMovementLot] = useState<Lot | null>(null)
  const [movementType, setMovementType] = useState<'Ingreso' | 'Salida'>('Ingreso')
  const [quantity, setQuantity] = useState(5)
  const [responsible, setResponsible] = useState(OPERATORS[0])
  const [message, setMessage] = useState('')
  const visible = state.lots.filter((lot) => farm === 'Todos' || lot.farm === farm)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!movementLot) return
    moveLot(movementLot.id, movementType === 'Ingreso' ? Math.abs(quantity) : -Math.abs(quantity))
    setMessage(`${movementType} de ${quantity} animales guardado en ${movementLot.name}.`)
    setMovementLot(null)
    trackEvent({ type: 'form_completed', module: 'Lotes', label: 'Movimiento de lote', durationSeconds: 42 })
  }

  return (
    <>
      <PageHeader eyebrow="Uso de superficie" title="Lotes y potreros" description="Ocupación, capacidad, ración e historial de movimientos por ambiente." actions={<label className="compact-select"><MapPin size={17}/><select value={farm} onChange={(event) => setFarm(event.target.value)}><option>Todos</option>{FARMS.map((item) => <option key={item}>{item}</option>)}</select></label>} />
      {message && <div className="success-banner page-success"><CheckCircle2 size={19}/><span>{message}</span></div>}
      <div className="lot-summary"><div><Map size={21}/><span>Superficie controlada</span><strong>{visible.reduce((sum, lot) => sum + lot.area, 0).toFixed(1)} ha</strong></div><div><Users size={21}/><span>Animales en lotes</span><strong>{visible.reduce((sum, lot) => sum + lot.animalCount, 0)}</strong></div><div><Ruler size={21}/><span>Capacidad disponible</span><strong>{visible.reduce((sum, lot) => sum + Math.max(0, lot.capacity - lot.animalCount), 0)}</strong></div></div>
      <div className="lots-grid">{visible.map((lot) => { const occupancy = Math.round(lot.animalCount / lot.capacity * 100); return <article className="lot-card" key={lot.id}><div className="lot-visual"><div className="field-lines"/><span>{lot.area.toFixed(1)} ha</span><Badge tone={occupancy >= 95 ? 'danger' : occupancy >= 80 ? 'warning' : 'success'}>{occupancy}% ocupado</Badge></div><div className="lot-card-body"><div className="lot-title"><div><span>{lot.farm}</span><h2>{lot.name}</h2></div><MapPin size={20}/></div><div className="lot-metrics"><div><span>Animales</span><strong>{lot.animalCount}</strong></div><div><span>Capacidad</span><strong>{lot.capacity}</strong></div><div><span>Categoría</span><strong>{lot.category}</strong></div></div><ProgressBar value={occupancy} tone={occupancy >= 95 ? 'red' : occupancy >= 80 ? 'amber' : 'green'}/><div className="lot-ration"><span>Ración actual</span><strong>{lot.ration}</strong></div><div className="lot-notes">{lot.notes}</div><div className="lot-actions"><Button variant="ghost" onClick={() => setSelected(lot)}>Ver historial</Button><Button variant="secondary" onClick={() => { setMovementLot(lot); setMovementType('Ingreso') }}><MoveRight size={16}/> Movimiento</Button></div></div></article>})}</div>
      <Modal open={Boolean(selected)} title={selected?.name ?? ''} eyebrow="Historial de ocupación" onClose={() => setSelected(null)} width="large">{selected && <><div className="lot-detail-summary"><div><span>Establecimiento</span><strong>{selected.farm}</strong></div><div><span>Superficie</span><strong>{selected.area.toFixed(1)} ha</strong></div><div><span>Ocupación actual</span><strong>{selected.animalCount} / {selected.capacity}</strong></div><div><span>Ración</span><strong>{selected.ration}</strong></div></div><div className="medium-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={selected.occupancy}><defs><linearGradient id="lotArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2e7d5b" stopOpacity={0.28}/><stop offset="95%" stopColor="#2e7d5b" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickFormatter={(value) => value.slice(0,7)} tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip labelFormatter={(value) => formatDate(String(value))}/><Area dataKey="count" name="Animales" stroke="#2e7d5b" fill="url(#lotArea)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div><div className="occupancy-history">{selected.occupancy.slice().reverse().map((record, index) => <div key={`${record.date}-${index}`}><span className="history-marker"/><div><strong>{record.event}</strong><span>{formatDate(record.date)}</span></div><strong>{record.count} animales</strong></div>)}</div><Button onClick={() => { setMovementLot(selected); setSelected(null) }}><Plus size={17}/> Registrar movimiento</Button></>}</Modal>
      <Modal open={Boolean(movementLot)} title={`Movimiento · ${movementLot?.name ?? ''}`} eyebrow="Actualizar ocupación" onClose={() => setMovementLot(null)}><form onSubmit={submit}><div className="movement-toggle"><button type="button" className={movementType === 'Ingreso' ? 'active' : ''} onClick={() => setMovementType('Ingreso')}><ArrowDownToLine size={18}/> Ingreso</button><button type="button" className={movementType === 'Salida' ? 'active' : ''} onClick={() => setMovementType('Salida')}><ArrowUpFromLine size={18}/> Salida</button></div><div className="form-grid two-cols"><Field label="Cantidad de animales"><input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/></Field><Field label="Fecha"><input type="date" value={DEMO_TODAY} readOnly/></Field><Field label="Responsable"><select value={responsible} onChange={(event) => setResponsible(event.target.value)}>{OPERATORS.map((item) => <option key={item}>{item}</option>)}</select></Field></div><div className="modal-actions"><Button type="button" variant="ghost" onClick={() => setMovementLot(null)}>Cancelar</Button><Button type="submit">Guardar movimiento</Button></div></form></Modal>
    </>
  )
}
