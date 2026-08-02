import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Droplets, Milk, Thermometer, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Area, AreaChart, Bar, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Field, PageHeader, Panel, Segmented, StatCard } from '../components/ui'
import { DEMO_TODAY, FARMS, formatNumber, OPERATORS } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { Farm, MilkRecord } from '../types'

export default function MilkProduction() {
  const { state, addMilkRecord, trackEvent } = useDemo()
  const [range, setRange] = useState('30 días')
  const [date, setDate] = useState(DEMO_TODAY)
  const [shift, setShift] = useState<MilkRecord['shift']>('Mañana')
  const [farm, setFarm] = useState<Farm>(FARMS[0])
  const [liters, setLiters] = useState(1840)
  const [milkedCows, setMilkedCows] = useState(142)
  const [discardedLiters, setDiscardedLiters] = useState(12)
  const [tankTemperature, setTankTemperature] = useState(3.7)
  const [responsible, setResponsible] = useState(OPERATORS[0])
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const duplicate = state.milkRecords.some((record) => record.date === date && record.shift === shift && record.farm === farm)

  const days = range === '7 días' ? 7 : range === '18 meses' ? 548 : 30
  const daily = useMemo(() => {
    const result = []
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const pointDate = new Date(`${DEMO_TODAY}T12:00:00Z`)
      pointDate.setUTCDate(pointDate.getUTCDate() - offset)
      const iso = pointDate.toISOString().slice(0, 10)
      const records = state.milkRecords.filter((record) => record.date === iso)
      result.push({
        date: days > 60 ? iso.slice(0, 7) : iso.slice(5),
        fullDate: iso,
        total: records.reduce((sum, record) => sum + record.liters, 0),
        esperanza: records.filter((record) => record.farm === FARMS[0]).reduce((sum, record) => sum + record.liters, 0),
        ombu: records.filter((record) => record.farm === FARMS[1]).reduce((sum, record) => sum + record.liters, 0),
        discarded: records.reduce((sum, record) => sum + record.discardedLiters, 0),
      })
    }
    if (days > 60) {
      const months = new Map<string, typeof result[number]>()
      result.forEach((point) => {
        const current = months.get(point.date) ?? { ...point, total: 0, esperanza: 0, ombu: 0, discarded: 0 }
        current.total += point.total; current.esperanza += point.esperanza; current.ombu += point.ombu; current.discarded += point.discarded
        months.set(point.date, current)
      })
      return [...months.values()]
    }
    return result
  }, [days, state.milkRecords])
  const last30 = daily.slice(-30)
  const last7 = daily.slice(-7)
  const today = daily.at(-1)?.total ?? 0
  const avg7 = Math.round(last7.reduce((sum, item) => sum + item.total, 0) / Math.max(1, last7.length))
  const avg30 = Math.round(last30.reduce((sum, item) => sum + item.total, 0) / Math.max(1, last30.length))
  const activeMilkingCows = state.animals.filter((animal) => animal.status === 'Activo' && animal.category === 'Vaca en ordeñe').length
  const missingDays = daily.filter((item) => item.total === 0).length
  const anomalies = daily.filter((item, index, list) => index > 0 && item.total > 0 && item.total < list[Math.max(0, index - 1)].total * 0.82)

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; liters: number; discarded: number }>()
    state.milkRecords.forEach((record) => {
      const month = record.date.slice(0, 7)
      const item = map.get(month) ?? { month, liters: 0, discarded: 0 }
      item.liters += record.liters; item.discarded += record.discardedLiters
      map.set(month, item)
    })
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [state.milkRecords])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    addMilkRecord({ date, shift, farm, liters, milkedCows, discardedLiters, tankTemperature, responsible, notes })
    setMessage(`Ordeñe ${shift.toLowerCase()} guardado: ${formatNumber(liters)} L. Los indicadores y gráficos ya incluyen la carga.`)
  }

  return (
    <>
      <PageHeader eyebrow="Producción diaria" title="Producción de leche" description="Cargas por ordeñe, rendimiento por vaca y detección automática de desvíos." actions={<Segmented options={['7 días', '30 días', '18 meses']} value={range} onChange={setRange} label="Rango del gráfico" />} />
      <div className="stat-grid stat-grid-4">
        <StatCard label="Litros de hoy" value={`${formatNumber(today)} L`} hint={`${today > avg7 ? '+' : ''}${((today / Math.max(1, avg7) - 1) * 100).toFixed(1)}% vs. prom. 7 días`} icon={Milk} tone="blue" />
        <StatCard label="Litros por vaca" value={`${(today / activeMilkingCows).toFixed(1)} L`} hint={`${activeMilkingCows} vacas en ordeñe`} icon={Droplets} />
        <StatCard label="Promedio 7 días" value={`${formatNumber(avg7)} L`} hint={`30 días: ${formatNumber(avg30)} L`} icon={TrendingUp} />
        <StatCard label="Leche descartada" value={`${daily.at(-1)?.discarded ?? 0} L`} hint="Por tratamientos y control" icon={TrendingDown} tone="amber" />
      </div>
      <div className="milk-layout">
        <Panel title="Tendencia diaria" subtitle={`${range} · ambos establecimientos`} className="chart-panel"><div className="large-chart" data-testid="milk-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><defs><linearGradient id="totalMilk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2e7d5b" stopOpacity={0.3}/><stop offset="95%" stopColor="#2e7d5b" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickLine={false} axisLine={false} interval={range === '18 meses' ? 1 : range === '30 días' ? 4 : 0}/><YAxis tickLine={false} axisLine={false}/><Tooltip formatter={(value) => `${formatNumber(Number(value))} L`}/><Area type="monotone" dataKey="total" name="Litros" stroke="#2e7d5b" fill="url(#totalMilk)" strokeWidth={2.8}/></AreaChart></ResponsiveContainer></div></Panel>
        <Panel title="Cargar ordeñe" subtitle="La carga impacta de inmediato en todos los indicadores" className="milk-form-panel">
          {message && <div className="success-banner" role="status" data-testid="milk-success"><CheckCircle2 size={18}/><span>{message}</span></div>}
          {duplicate && <div className="warning-banner"><AlertTriangle size={18}/><span>Ya existe una carga para este turno. Si guardás, quedará señalada como posible duplicado.</span></div>}
          <form onSubmit={submit} onFocus={() => trackEvent({ type: 'form_started', module: 'Producción', label: 'Carga de ordeñe iniciada', durationSeconds: 0 })}><div className="form-grid two-cols"><Field label="Fecha"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></Field><Field label="Turno"><select value={shift} onChange={(event) => setShift(event.target.value as MilkRecord['shift'])}><option>Mañana</option><option>Tarde</option></select></Field><Field label="Establecimiento"><select value={farm} onChange={(event) => setFarm(event.target.value as Farm)}>{FARMS.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Litros"><input type="number" min="0" value={liters} onChange={(event) => setLiters(Number(event.target.value))} data-testid="milk-liters" required/></Field><Field label="Vacas ordeñadas"><input type="number" min="1" value={milkedCows} onChange={(event) => setMilkedCows(Number(event.target.value))} required/></Field><Field label="Leche descartada (L)"><input type="number" min="0" value={discardedLiters} onChange={(event) => setDiscardedLiters(Number(event.target.value))}/></Field><Field label="Temperatura tanque (°C)"><input type="number" step="0.1" min="0" max="12" value={tankTemperature} onChange={(event) => setTankTemperature(Number(event.target.value))}/></Field><Field label="Responsable"><select value={responsible} onChange={(event) => setResponsible(event.target.value)}>{OPERATORS.map((item) => <option key={item}>{item}</option>)}</select></Field></div><Field label="Observaciones"><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Cambios de ración, clima o incidencia…"/></Field><Button type="submit" className="full-button" data-testid="save-milk"><Milk size={18}/> Guardar ordeñe</Button></form>
        </Panel>
      </div>
      <div className="milk-insights">
        <Panel title="Comparación entre establecimientos" subtitle="Litros diarios"><div className="medium-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily.slice(-30)}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickLine={false} axisLine={false} interval={5}/><YAxis tickLine={false} axisLine={false}/><Tooltip/><Legend/><Area type="monotone" dataKey="esperanza" name="La Esperanza" stroke="#2e7d5b" fill="#2e7d5b22"/><Area type="monotone" dataKey="ombu" name="El Ombú" stroke="#4d83b8" fill="#4d83b822"/></AreaChart></ResponsiveContainer></div></Panel>
        <Panel title="Calidad de carga" subtitle="Controles automáticos"><div className="quality-grid"><div><span className="quality-icon warning"><AlertTriangle size={19}/></span><div><strong>{anomalies.length} caídas anormales</strong><span>Más de 18% contra el día anterior</span></div></div><div><span className="quality-icon success"><CheckCircle2 size={19}/></span><div><strong>{missingDays} días sin carga</strong><span>{missingDays ? 'Revisar continuidad' : 'Serie completa'}</span></div></div><div><span className="quality-icon warning"><Users size={19}/></span><div><strong>2 posibles duplicados</strong><span>Mismo turno y establecimiento</span></div></div><div><span className="quality-icon success"><Thermometer size={19}/></span><div><strong>3,7 °C promedio</strong><span>Tanques dentro de rango</span></div></div></div></Panel>
      </div>
      <Panel title="Producción mensual" subtitle="Litros totales y leche descartada"><div className="medium-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis yAxisId="left" tickLine={false} axisLine={false}/><YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false}/><Tooltip formatter={(value) => `${formatNumber(Number(value))} L`}/><Bar yAxisId="left" dataKey="liters" name="Producción" fill="#2e7d5b" radius={[5,5,0,0]}/><Line yAxisId="right" dataKey="discarded" name="Descartada" stroke="#d46b4b" strokeWidth={2.4}/></ComposedChart></ResponsiveContainer></div></Panel>
    </>
  )
}
