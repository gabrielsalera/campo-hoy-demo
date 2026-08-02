import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Baby, Beef, Boxes, CalendarClock, CloudRain, Droplets, HeartPulse, Milk,
  PackageMinus, RefreshCcw, ShieldAlert, Stethoscope,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DEMO_TODAY, daysBetween, formatDate, formatNumber } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import { Badge, Button, Modal, PageHeader, Panel, ProgressBar, StatCard } from '../components/ui'

interface DetailState { title: string; type: string }

export default function Dashboard() {
  const { state } = useDemo()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<DetailState | null>(null)
  const active = state.animals.filter((animal) => animal.status === 'Activo')
  const milking = active.filter((animal) => animal.category === 'Vaca en ordeñe')
  const dry = active.filter((animal) => animal.category === 'Vaca seca')
  const heifers = active.filter((animal) => animal.category === 'Vaquillona')
  const calves = active.filter((animal) => animal.category === 'Ternera' || animal.category === 'Ternero')
  const pregnant = active.filter((animal) => animal.reproductiveStatus === 'Preñada')
  const empty = active.filter((animal) => animal.reproductiveStatus === 'Vacía')
  const dueSoon = pregnant.filter((animal) => animal.dueDate && daysBetween(DEMO_TODAY, animal.dueDate) <= 30)
  const activeTreatments = state.treatments.filter((treatment) => treatment.active)
  const withdrawal = activeTreatments.filter((treatment) => treatment.milkWithdrawalUntil && treatment.milkWithdrawalUntil >= DEMO_TODAY)
  const overdueTasks = state.tasks.filter((task) => task.status !== 'Completada' && task.dueDate < DEMO_TODAY)
  const criticalAlerts = state.alerts.filter((alert) => alert.severity === 'Crítica' && alert.status !== 'Resuelta')
  const lowStock = state.inventory.filter((item) => item.stock <= item.minimum)
  const monthlyRain = state.rain.filter((record) => record.date.slice(0, 7) === DEMO_TODAY.slice(0, 7)).reduce((sum, record) => sum + record.millimeters, 0)
  const todayMilk = state.milkRecords.filter((record) => record.date === DEMO_TODAY)
  const litersToday = todayMilk.reduce((sum, record) => sum + record.liters, 0)
  const discardedToday = todayMilk.reduce((sum, record) => sum + record.discardedLiters, 0)
  const expectedStock = active.length + 2

  const milkSeries = useMemo(() => {
    const dates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(`${DEMO_TODAY}T12:00:00Z`)
      date.setUTCDate(date.getUTCDate() - (29 - index))
      return date.toISOString().slice(0, 10)
    })
    return dates.map((date) => {
      const records = state.milkRecords.filter((record) => record.date === date)
      return {
        date: date.slice(5),
        litros: records.reduce((sum, record) => sum + record.liters, 0),
        esperanza: records.filter((record) => record.farm === 'Tambo La Esperanza').reduce((sum, record) => sum + record.liters, 0),
        ombu: records.filter((record) => record.farm === 'Establecimiento El Ombú').reduce((sum, record) => sum + record.liters, 0),
      }
    })
  }, [state.milkRecords])
  const avg7 = Math.round(milkSeries.slice(-7).reduce((sum, point) => sum + point.litros, 0) / 7)
  const avg30 = Math.round(milkSeries.reduce((sum, point) => sum + point.litros, 0) / 30)

  const openDetail = (title: string, type: string) => setDetail({ title, type })
  const detailContent = () => {
    if (!detail) return null
    const map: Record<string, { description: string; rows: { label: string; value: string; badge?: string }[]; action?: { label: string; path: string } }> = {
      stock: { description: 'Existencias activas conciliadas entre fichas individuales y lotes.', rows: [
        { label: 'Tambo La Esperanza', value: `${active.filter((animal) => animal.farm === 'Tambo La Esperanza').length} animales` },
        { label: 'Establecimiento El Ombú', value: `${active.filter((animal) => animal.farm === 'Establecimiento El Ombú').length} animales` },
        { label: 'Último recuento', value: '1 ago 2026', badge: 'Actualizado' },
      ], action: { label: 'Abrir animales', path: '/animales' } },
      milk: { description: 'Producción consolidada de los cuatro ordeñes cargados hoy.', rows: [
        { label: 'Promedio 7 días', value: `${formatNumber(avg7)} L` }, { label: 'Promedio 30 días', value: `${formatNumber(avg30)} L` },
        { label: 'Leche descartada hoy', value: `${discardedToday} L`, badge: discardedToday > 30 ? 'Revisar' : 'Normal' },
      ], action: { label: 'Abrir producción', path: '/produccion' } },
      stockDifference: { description: 'El recuento declarado supera en dos cabezas las fichas activas. La diferencia está asociada a bajas no cerradas.', rows: [
        { label: 'Stock declarado', value: `${expectedStock}` }, { label: 'Fichas activas', value: `${active.length}` }, { label: 'Diferencia', value: '+2', badge: 'Investigar' },
      ], action: { label: 'Investigar diferencia', path: '/consistencia' } },
      reproductive: { description: 'Estado reproductivo calculado sobre hembras elegibles del rodeo activo.', rows: [
        { label: 'Preñadas', value: `${pregnant.length}` }, { label: 'Vacías', value: `${empty.length}` }, { label: 'Próximas a parir', value: `${dueSoon.length}`, badge: '30 días' },
      ], action: { label: 'Abrir reproducción', path: '/reproduccion' } },
      health: { description: 'Tratamientos en curso y animales con restricciones vigentes.', rows: [
        { label: 'Tratamientos activos', value: `${activeTreatments.length}` }, { label: 'Retiro de leche', value: `${withdrawal.length}`, badge: 'Separar' }, { label: 'En observación', value: `${active.filter((animal) => animal.healthStatus === 'En observación').length}` },
      ], action: { label: 'Abrir sanidad', path: '/sanidad' } },
      tasks: { description: 'Trabajo operativo pendiente ordenado por vencimiento y prioridad.', rows: overdueTasks.slice(0, 5).map((task) => ({ label: task.title, value: formatDate(task.dueDate), badge: task.priority })), action: { label: 'Abrir tareas', path: '/tareas' } },
      alerts: { description: 'Alertas de máxima gravedad que afectan trazabilidad o stock.', rows: criticalAlerts.map((alert) => ({ label: alert.title, value: alert.operator, badge: alert.status })), action: { label: 'Abrir consistencia', path: '/consistencia' } },
      inventory: { description: 'Insumos en mínimo, agotados o con stock negativo.', rows: lowStock.map((item) => ({ label: item.name, value: `${formatNumber(item.stock, 1)} ${item.unit}`, badge: item.stock < 0 ? 'Negativo' : 'Bajo' })), action: { label: 'Abrir inventario', path: '/inventario' } },
      rain: { description: 'Acumulado del mes en ambos establecimientos.', rows: state.rain.filter((record) => record.date.slice(0, 7) === DEMO_TODAY.slice(0, 7)).map((record) => ({ label: record.farm, value: `${record.millimeters} mm`, badge: `${record.humidity}% HR` })), action: { label: 'Abrir clima', path: '/clima' } },
      sync: { description: 'Registros guardados localmente que esperan una conexión autorizada.', rows: [
        { label: 'Formularios operativos', value: `${state.pendingSync}` }, { label: 'Persistencia', value: 'Activa en este dispositivo', badge: 'Local' }, { label: 'Última actualización', value: 'Ahora' },
      ], action: { label: 'Abrir datos', path: '/datos' } },
    }
    const content = map[detail.type] ?? map.stock
    return <><p className="modal-intro">{content.description}</p><div className="detail-list">{content.rows.map((row, index) => <div key={`${row.label}-${index}`}><span>{row.label}</span><strong>{row.value}</strong>{row.badge && <Badge tone={row.badge === 'Negativo' || row.badge === 'Investigar' || row.badge === 'Separar' ? 'danger' : 'info'}>{row.badge}</Badge>}</div>)}</div>{content.action && <Button onClick={() => { setDetail(null); navigate(content.action!.path) }}>{content.action.label}</Button>}</>
  }

  return (
    <>
      <PageHeader eyebrow="Resumen del día · 2 de agosto de 2026" title="El campo, claro desde el primer vistazo" description="Producción, rodeo y tareas críticas de los dos establecimientos en una sola vista." actions={<Button variant="secondary" onClick={() => navigate('/nacimientos')}><Baby size={18} /> Registrar nacimiento</Button>} />
      <div className="hero-grid">
        <Panel className="welcome-panel">
          <div className="welcome-copy"><Badge tone="success">Operación al día</Badge><h2>Buen día, Pablo.</h2><p>La producción se mantiene estable. Hay <strong>{criticalAlerts.length} alertas críticas</strong> y <strong>{overdueTasks.length} tareas vencidas</strong> para priorizar.</p><div className="welcome-actions"><Button onClick={() => navigate('/tareas')}>Ver prioridades</Button><Button variant="ghost" onClick={() => navigate('/comercial')}>Resumen comercial</Button></div></div>
          <div className="score-ring"><span>Consistencia</span><strong>87</strong><small>/ 100</small></div>
        </Panel>
        <Panel className="today-panel"><div className="today-heading"><div className="weather-icon"><CloudRain size={25} /></div><div><span>Hoy en los establecimientos</span><strong>17 °C</strong></div></div><div className="weather-row"><span>Humedad <strong>68%</strong></span><span>Viento <strong>12 km/h</strong></span><span>Lluvia mes <strong>{monthlyRain} mm</strong></span></div></Panel>
      </div>
      <div className="stat-grid stat-grid-4">
        <StatCard label="Stock total" value={formatNumber(active.length)} hint={`${milking.length} en ordeñe · ${dry.length} secas`} icon={Beef} onClick={() => openDetail('Stock total', 'stock')} />
        <StatCard label="Litros de hoy" value={`${formatNumber(litersToday)} L`} hint={`${(litersToday / milking.length).toFixed(1)} L por vaca`} icon={Milk} tone="blue" onClick={() => openDetail('Producción de hoy', 'milk')} />
        <StatCard label="Preñadas" value={pregnant.length} hint={`${dueSoon.length} próximas a parir`} icon={HeartPulse} tone="purple" onClick={() => openDetail('Estado reproductivo', 'reproductive')} />
        <StatCard label="Tratamientos activos" value={activeTreatments.length} hint={`${withdrawal.length} con retiro de leche`} icon={Stethoscope} tone="amber" onClick={() => openDetail('Sanidad activa', 'health')} />
      </div>
      <div className="stat-grid stat-grid-4 compact-stats">
        <StatCard label="Vaquillonas" value={heifers.length} hint="Rodeo activo" icon={Beef} onClick={() => navigate('/animales?categoria=Vaquillona')} />
        <StatCard label="Terneros/as" value={calves.length} hint="Recría total" icon={Baby} tone="blue" onClick={() => navigate('/animales?categoria=Ternera')} />
        <StatCard label="Tareas vencidas" value={overdueTasks.length} hint="Requieren atención" icon={CalendarClock} tone="red" onClick={() => openDetail('Tareas vencidas', 'tasks')} />
        <StatCard label="Diferencia de stock" value="+2" hint="Declarado vs. fichas" icon={RefreshCcw} tone="red" onClick={() => openDetail('Diferencia de stock', 'stockDifference')} testId="stock-difference-card" />
      </div>
      <div className="dashboard-grid">
        <Panel title="Producción de leche" subtitle="Últimos 30 días · comparación por establecimiento" action={<Button variant="ghost" onClick={() => navigate('/produccion')}>Ver producción</Button>} className="chart-panel">
          <div className="chart-summary"><div><span>Promedio 7 días</span><strong>{formatNumber(avg7)} L</strong></div><div><span>Promedio 30 días</span><strong>{formatNumber(avg30)} L</strong></div><div><span>Variación</span><strong className="positive">+2,8%</strong></div></div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={milkSeries}><defs><linearGradient id="milkGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2e7d5b" stopOpacity={0.28}/><stop offset="95%" stopColor="#2e7d5b" stopOpacity={0}/></linearGradient><linearGradient id="milkBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4d83b8" stopOpacity={0.24}/><stop offset="95%" stopColor="#4d83b8" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e9e2"/><XAxis dataKey="date" tickLine={false} axisLine={false} interval={4}/><YAxis tickLine={false} axisLine={false} width={44}/><Tooltip formatter={(value) => `${formatNumber(Number(value))} L`}/><Legend/><Area type="monotone" dataKey="esperanza" name="La Esperanza" stroke="#2e7d5b" fill="url(#milkGreen)" strokeWidth={2.5}/><Area type="monotone" dataKey="ombu" name="El Ombú" stroke="#4d83b8" fill="url(#milkBlue)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Atención hoy" subtitle="Priorizado por impacto operativo" action={<Badge tone="danger">{criticalAlerts.length + overdueTasks.length} pendientes</Badge>}>
          <div className="priority-list">
            <button onClick={() => openDetail('Alertas críticas', 'alerts')}><span className="priority-icon critical"><ShieldAlert size={18} /></span><div><strong>{criticalAlerts.length} alertas de consistencia</strong><span>Partos, stock y trazabilidad</span></div><AlertTriangle size={18} /></button>
            <button onClick={() => openDetail('Tareas vencidas', 'tasks')}><span className="priority-icon overdue"><CalendarClock size={18} /></span><div><strong>{overdueTasks.length} tareas vencidas</strong><span>La más antigua venció hace 6 días</span></div><AlertTriangle size={18} /></button>
            <button onClick={() => openDetail('Insumos con stock bajo', 'inventory')}><span className="priority-icon inventory"><PackageMinus size={18} /></span><div><strong>{lowStock.length} insumos bajo mínimo</strong><span>Uno presenta stock negativo</span></div><Boxes size={18} /></button>
            <button onClick={() => openDetail('Registros pendientes', 'sync')}><span className="priority-icon sync"><RefreshCcw size={18} /></span><div><strong>{state.pendingSync} registros por sincronizar</strong><span>Guardados de forma segura en el dispositivo</span></div><Droplets size={18} /></button>
          </div>
        </Panel>
      </div>
      <div className="dashboard-grid lower-grid">
        <Panel title="Composición del rodeo" subtitle="Animales activos por categoría">
          <div className="herd-composition">{[
            ['Vacas en ordeñe', milking.length, 49, 'green'], ['Vacas secas', dry.length, 12, 'blue'], ['Vaquillonas', heifers.length, 14, 'amber'], ['Terneros/as', calves.length, 22, 'purple'], ['Toros', active.filter((animal) => animal.category === 'Toro').length, 3, 'red'],
          ].map(([label, count, percent, tone]) => <button key={String(label)} onClick={() => navigate('/animales')}><div><span>{label}</span><strong>{count}</strong></div><ProgressBar value={Number(percent)} tone={tone === 'red' ? 'red' : tone === 'amber' ? 'amber' : tone === 'blue' ? 'blue' : 'green'} /></button>)}</div>
        </Panel>
        <Panel title="Próximos partos" subtitle="Ventana de 30 días" action={<Button variant="ghost" onClick={() => navigate('/reproduccion')}>Ver lista</Button>}>
          <div className="mini-table">{dueSoon.slice(0, 5).map((animal) => <button key={animal.id} onClick={() => navigate(`/animales/${animal.id}`)}><span className="animal-avatar">{animal.tag.slice(-2)}</span><div><strong>{animal.tag}</strong><span>{animal.farm}</span></div><div className="align-right"><strong>{animal.dueDate ? formatDate(animal.dueDate) : '—'}</strong><span>{animal.dueDate ? `${daysBetween(DEMO_TODAY, animal.dueDate)} días` : ''}</span></div></button>)}</div>
        </Panel>
      </div>
      <Modal open={Boolean(detail)} title={detail?.title ?? ''} eyebrow="Detalle operativo" onClose={() => setDetail(null)}>{detailContent()}</Modal>
    </>
  )
}
