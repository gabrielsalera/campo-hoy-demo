import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, Boxes, CalendarClock, CheckCircle2, CircleDollarSign, PackageMinus, Plus, Search, ShoppingCart, TrendingDown, UserRound } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Field, Modal, PageHeader, Panel, ProgressBar, StatCard } from '../components/ui'
import { DEMO_TODAY, daysBetween, formatCurrency, formatDate, formatNumber, OPERATORS } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { InventoryMovement } from '../types'

export default function Inventory() {
  const { state, addInventoryMovement, trackEvent } = useDemo()
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [itemId, setItemId] = useState(state.inventory[0].id)
  const [movementType, setMovementType] = useState<InventoryMovement['type']>('Compra')
  const [quantity, setQuantity] = useState(100)
  const [responsible, setResponsible] = useState(OPERATORS[0])
  const [message, setMessage] = useState('')
  const low = state.inventory.filter((item) => item.stock <= item.minimum)
  const negative = state.inventory.filter((item) => item.stock < 0)
  const expiring = state.inventory.filter((item) => item.expiryDate && daysBetween(DEMO_TODAY, item.expiryDate) <= 90)
  const foodDays = state.inventory.filter((item) => item.type === 'Alimento').map((item) => ({ ...item, days: item.averageDailyUse ? Math.floor(item.stock / item.averageDailyUse) : 999 }))
  const visible = state.inventory.filter((item) => (typeFilter === 'Todos' || item.type === typeFilter) && (!search || `${item.name} ${item.supplier}`.toLowerCase().includes(search.toLowerCase())))
  const stockByType = useMemo(() => ['Alimento', 'Medicamento', 'Semen', 'Insumo'].map((type) => ({ type, items: state.inventory.filter((item) => item.type === type).length, value: Math.round(state.inventory.filter((item) => item.type === type).reduce((sum, item) => sum + Math.max(0, item.stock * item.price), 0)) })), [state.inventory])
  const totalValue = state.inventory.reduce((sum, item) => sum + Math.max(0, item.stock * item.price), 0)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const signed = movementType === 'Consumo' ? -Math.abs(quantity) : quantity
    addInventoryMovement({ itemId, type: movementType, quantity: signed, date: DEMO_TODAY, responsible })
    const item = state.inventory.find((candidate) => candidate.id === itemId)
    setMessage(`${movementType} guardada: ${formatNumber(Math.abs(quantity), 1)} ${item?.unit} de ${item?.name}.`)
    setModalOpen(false)
  }

  return (
    <>
      <PageHeader eyebrow="Insumos y alimentación" title="Inventario" description="Compras, consumos, ajustes, vencimientos y días restantes de alimento." actions={<Button onClick={() => setModalOpen(true)}><Plus size={18}/> Registrar movimiento</Button>} />
      {message && <div className="success-banner page-success"><CheckCircle2 size={19}/><span>{message}</span></div>}
      <div className="stat-grid stat-grid-4"><StatCard label="Valor de inventario" value={formatCurrency(totalValue)} hint={`${state.inventory.length} insumos controlados`} icon={CircleDollarSign}/><StatCard label="Stock bajo" value={low.length} hint="En mínimo o por debajo" icon={PackageMinus} tone="amber" onClick={() => setTypeFilter('Todos')}/><StatCard label="Stock negativo" value={negative.length} hint="Requiere ajuste inmediato" icon={AlertTriangle} tone="red"/><StatCard label="Próximos a vencer" value={expiring.length} hint="Dentro de 90 días" icon={CalendarClock} tone="purple"/></div>
      <div className="inventory-alerts"><div className="food-days-card"><div><span className="inventory-alert-icon"><TrendingDown size={20}/></span><div><strong>Autonomía de alimentos</strong><p>El rollo de alfalfa alcanza para {foodDays.find((item) => item.name === 'Rollo de alfalfa')?.days ?? 0} días al consumo actual.</p></div></div><Button variant="secondary" onClick={() => setTypeFilter('Alimento')}>Ver alimentación</Button></div><div className="negative-stock-card"><AlertTriangle size={21}/><div><strong>Stock negativo detectado</strong><p>{negative.map((item) => item.name).join(', ')} necesita recuento físico.</p></div></div></div>
      <div className="inventory-layout">
        <Panel title="Stock actual" subtitle="Niveles, mínimos, precios y proveedores" className="table-panel"><div className="table-toolbar"><label className="search-field"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar insumo o proveedor"/></label><div className="inline-tabs">{['Todos', 'Alimento', 'Medicamento', 'Semen', 'Insumo'].map((item) => <button key={item} className={typeFilter === item ? 'active' : ''} onClick={() => setTypeFilter(item)}>{item}</button>)}</div></div><div className="inventory-list">{visible.map((item) => { const level = item.minimum > 0 ? Math.round(item.stock / item.minimum * 70) : 100; const itemLow = item.stock <= item.minimum; return <article key={item.id}><div className={`inventory-type type-${item.type.toLowerCase()}`}><Boxes size={20}/></div><div className="inventory-name"><strong>{item.name}</strong><span>{item.type} · {item.supplier}</span></div><div className="stock-level"><div><strong className={item.stock < 0 ? 'danger-text' : ''}>{formatNumber(item.stock, 1)} {item.unit}</strong><span>Mínimo: {formatNumber(item.minimum)} {item.unit}</span></div><ProgressBar value={level} tone={item.stock < 0 ? 'red' : itemLow ? 'amber' : 'green'}/></div><div><span>Precio unitario</span><strong>{formatCurrency(item.price)}</strong></div><div><span>Vencimiento</span><strong>{item.expiryDate ? formatDate(item.expiryDate) : 'No aplica'}</strong>{item.expiryDate && daysBetween(DEMO_TODAY, item.expiryDate) <= 90 && <Badge tone="warning">Próximo</Badge>}</div><div><Button variant={itemLow ? 'secondary' : 'ghost'} onClick={() => { setItemId(item.id); setMovementType(itemLow ? 'Compra' : 'Consumo'); setModalOpen(true) }}>{itemLow ? <ShoppingCart size={16}/> : <TrendingDown size={16}/>} {itemLow ? 'Reponer' : 'Consumir'}</Button></div></article>})}</div></Panel>
        <aside><Panel title="Valor por categoría" subtitle="Existencias valorizadas"><div className="medium-chart inventory-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={stockByType}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="type" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip formatter={(value) => formatCurrency(Number(value))}/><Bar dataKey="value" name="Valor" fill="#2e7d5b" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></Panel><Panel title="Movimientos recientes"><div className="movement-list">{state.inventoryMovements.slice(0, 8).map((movement) => { const item = state.inventory.find((candidate) => candidate.id === movement.itemId); return <div key={movement.id}><span className={`movement-sign ${movement.quantity > 0 ? 'positive' : 'negative'}`}>{movement.quantity > 0 ? '+' : '−'}</span><div><strong>{movement.type} · {item?.name}</strong><span><UserRound size={13}/> {movement.responsible}</span></div><div><strong>{formatNumber(Math.abs(movement.quantity),1)} {item?.unit}</strong><small>{formatDate(movement.date)}</small></div></div>})}</div></Panel></aside>
      </div>
      <Modal open={modalOpen} title="Movimiento de inventario" eyebrow="Compra, consumo o ajuste" onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} onFocus={() => trackEvent({ type: 'form_started', module: 'Inventario', label: 'Movimiento iniciado', durationSeconds: 0 })}><div className="form-grid two-cols"><Field label="Insumo"><select value={itemId} onChange={(event) => setItemId(event.target.value)}>{state.inventory.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatNumber(item.stock,1)} {item.unit}</option>)}</select></Field><Field label="Tipo"><select value={movementType} onChange={(event) => setMovementType(event.target.value as InventoryMovement['type'])}><option>Compra</option><option>Consumo</option><option>Ajuste</option></select></Field><Field label="Cantidad"><input type="number" min={movementType === 'Ajuste' ? undefined : 0.01} step="0.01" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required/></Field><Field label="Responsable"><select value={responsible} onChange={(event) => setResponsible(event.target.value)}>{OPERATORS.map((item) => <option key={item}>{item}</option>)}</select></Field></div><div className="modal-actions"><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit"><Boxes size={18}/> Guardar movimiento</Button></div></form>
      </Modal>
    </>
  )
}
