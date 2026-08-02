import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, CloudRain, CloudSun, Droplets, Plus, Thermometer, Wind } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Field, Modal, PageHeader, Panel, StatCard } from '../components/ui'
import { DEMO_TODAY, FARMS, formatDate } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { Farm } from '../types'

export default function Climate() {
  const { state, addRain, trackEvent } = useDemo()
  const [modalOpen, setModalOpen] = useState(false)
  const [farm, setFarm] = useState<Farm>(FARMS[0])
  const [date, setDate] = useState(DEMO_TODAY)
  const [millimeters, setMillimeters] = useState(18)
  const [temperature, setTemperature] = useState(17.2)
  const [humidity, setHumidity] = useState(68)
  const [wind, setWind] = useState(12.4)
  const [message, setMessage] = useState('')
  const current = state.rain.filter((item) => item.date.slice(0,7) === DEMO_TODAY.slice(0,7))
  const monthlyRain = current.reduce((sum, item) => sum + item.millimeters, 0)
  const currentWeather = state.rain.at(-1)!

  const annual = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2,'0'))
    return months.map((month) => ({
      month,
      current: state.rain.filter((item) => item.date.slice(0,7) === `2026-${month}`).reduce((sum,item) => sum + item.millimeters,0),
      previous: state.rain.filter((item) => item.date.slice(0,7) === `2025-${month}`).reduce((sum,item) => sum + item.millimeters,0),
    }))
  }, [state.rain])
  const productionAndRain = useMemo(() => {
    const monthMap = new Map<string, { month: string; rain: number; milk: number }>()
    state.rain.forEach((record) => { const month = record.date.slice(0,7); const item = monthMap.get(month) ?? { month, rain:0, milk:0 }; item.rain += record.millimeters; monthMap.set(month,item) })
    state.milkRecords.forEach((record) => { const month = record.date.slice(0,7); const item = monthMap.get(month) ?? { month, rain:0, milk:0 }; item.milk += record.liters; monthMap.set(month,item) })
    return [...monthMap.values()].sort((a,b)=>a.month.localeCompare(b.month)).slice(-12).map((item)=>({...item, milk: Math.round(item.milk/1000)}))
  }, [state.rain, state.milkRecords])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    addRain({ farm, date, millimeters, temperature, humidity, wind })
    setMessage(`Lluvia registrada: ${millimeters} mm en ${farm}. El acumulado mensual ya fue actualizado.`)
    setModalOpen(false)
  }

  return (
    <>
      <PageHeader eyebrow="Ambiente y producción" title="Lluvias y clima" description="Serie meteorológica ficticia para entender el impacto productivo sin depender de servicios externos." actions={<Button onClick={() => setModalOpen(true)}><Plus size={18}/> Cargar lluvia</Button>} />
      {message && <div className="success-banner page-success"><CheckCircle2 size={19}/><span>{message}</span></div>}
      <div className="weather-hero"><div className="weather-current"><div className="sun-cloud"><CloudSun size={44}/></div><div><span>Domingo, 2 de agosto</span><strong>{currentWeather.temperature.toFixed(1)} °C</strong><p>Parcialmente nublado · condiciones estables</p></div></div><div className="weather-details"><div><Droplets size={20}/><span>Humedad</span><strong>{currentWeather.humidity}%</strong></div><div><Wind size={20}/><span>Viento</span><strong>{currentWeather.wind} km/h</strong></div><div><CloudRain size={20}/><span>Lluvia del mes</span><strong>{monthlyRain} mm</strong></div></div></div>
      <div className="stat-grid stat-grid-4"><StatCard label="Acumulado mensual" value={`${monthlyRain} mm`} hint="Ambos establecimientos" icon={CloudRain}/><StatCard label="La Esperanza" value={`${current.filter((item)=>item.farm===FARMS[0]).reduce((s,i)=>s+i.millimeters,0)} mm`} hint="Agosto 2026" icon={Droplets} tone="blue"/><StatCard label="El Ombú" value={`${current.filter((item)=>item.farm===FARMS[1]).reduce((s,i)=>s+i.millimeters,0)} mm`} hint="Agosto 2026" icon={Droplets} tone="purple"/><StatCard label="Temperatura media" value={`${currentWeather.temperature.toFixed(1)} °C`} hint="Último registro" icon={Thermometer} tone="amber"/></div>
      <div className="climate-grid"><Panel title="Comparación anual de lluvias" subtitle="Milímetros por mes"><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={annual}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip formatter={(value)=>`${value} mm`}/><Legend/><Bar dataKey="current" name="2026" fill="#2e7d5b" radius={[4,4,0,0]}/><Bar dataKey="previous" name="2025" fill="#a8c6df" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></Panel><Panel title="Lectura productiva" subtitle="Señales destacadas"><div className="climate-insights"><div><Badge tone="success">Favorable</Badge><h3>Reservas de humedad estables</h3><p>El acumulado reciente sostiene la oferta de pasto en ambos establecimientos.</p></div><div><Badge tone="warning">Seguimiento</Badge><h3>Producción sensible al viento</h3><p>Los días de mayor viento muestran una baja ficticia promedio del 3,2%.</p></div><div><Badge tone="info">Planificación</Badge><h3>Ventana seca de 5 días</h3><p>Condiciones adecuadas para movimientos de lotes y mantenimiento.</p></div></div></Panel></div>
      <Panel title="Lluvia y producción de leche" subtitle="Relación mensual · producción expresada en miles de litros"><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={productionAndRain}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis yAxisId="rain" tickLine={false} axisLine={false}/><YAxis yAxisId="milk" orientation="right" tickLine={false} axisLine={false}/><Tooltip/><Legend/><Bar yAxisId="rain" dataKey="rain" name="Lluvia (mm)" fill="#79a9cf" radius={[5,5,0,0]}/><Line yAxisId="milk" dataKey="milk" name="Leche (mil L)" stroke="#2e7d5b" strokeWidth={3}/></ComposedChart></ResponsiveContainer></div></Panel>
      <Panel title="Registros meteorológicos" subtitle="Datos cargados manualmente"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Establecimiento</th><th>Lluvia</th><th>Temperatura</th><th>Humedad</th><th>Viento</th></tr></thead><tbody>{state.rain.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map((record)=><tr key={record.id}><td>{formatDate(record.date)}</td><td>{record.farm}</td><td><strong>{record.millimeters} mm</strong></td><td>{record.temperature} °C</td><td>{record.humidity}%</td><td>{record.wind} km/h</td></tr>)}</tbody></table></div></Panel>
      <Modal open={modalOpen} title="Cargar lluvia y clima" eyebrow="Registro manual" onClose={()=>setModalOpen(false)}><form onSubmit={submit} onFocus={()=>trackEvent({type:'form_started',module:'Clima',label:'Carga de lluvia iniciada',durationSeconds:0})}><div className="form-grid two-cols"><Field label="Establecimiento"><select value={farm} onChange={(event)=>setFarm(event.target.value as Farm)}>{FARMS.map((item)=><option key={item}>{item}</option>)}</select></Field><Field label="Fecha"><input type="date" value={date} onChange={(event)=>setDate(event.target.value)}/></Field><Field label="Lluvia (mm)"><input type="number" min="0" step="0.1" value={millimeters} onChange={(event)=>setMillimeters(Number(event.target.value))}/></Field><Field label="Temperatura (°C)"><input type="number" step="0.1" value={temperature} onChange={(event)=>setTemperature(Number(event.target.value))}/></Field><Field label="Humedad (%)"><input type="number" min="0" max="100" value={humidity} onChange={(event)=>setHumidity(Number(event.target.value))}/></Field><Field label="Viento (km/h)"><input type="number" min="0" step="0.1" value={wind} onChange={(event)=>setWind(Number(event.target.value))}/></Field></div><div className="modal-actions"><Button type="button" variant="ghost" onClick={()=>setModalOpen(false)}>Cancelar</Button><Button type="submit"><CloudRain size={18}/> Guardar registro</Button></div></form></Modal>
    </>
  )
}
