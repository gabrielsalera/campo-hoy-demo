import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Baby, Beef, Calendar, Droplets, HeartPulse, MapPin, Milk, Stethoscope, Syringe } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, EmptyState, Panel, ProgressBar } from '../components/ui'
import { DEMO_TODAY, daysBetween, formatDate } from '../data/demoData'
import { useDemo } from '../store/DemoContext'

export default function AnimalDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state } = useDemo()
  const animal = state.animals.find((item) => item.id === id)
  const mother = animal?.motherId ? state.animals.find((item) => item.id === animal.motherId) : undefined
  const father = animal?.fatherId ? state.animals.find((item) => item.id === animal.fatherId) : undefined
  const treatments = state.treatments.filter((treatment) => treatment.animalId === id)
  const alerts = state.alerts.filter((alert) => alert.relatedAnimalIds.includes(id ?? '') && alert.status !== 'Resuelta')
  const reproduction = state.reproductionEvents.filter((event) => event.animalId === id).slice(0, 8)
  const milkSeries = useMemo(() => Array.from({ length: 14 }, (_, index) => ({ day: `${index + 1}/8`, liters: animal?.category === 'Vaca en ordeñe' ? Number(((animal.lastMilkLiters || 22) + Math.sin(index) * 2.1).toFixed(1)) : 0 })), [animal])

  if (!animal) return <Panel><EmptyState title="Animal no encontrado" description="La ficha solicitada no existe en este conjunto de datos." /><Button onClick={() => navigate('/animales')}>Volver al listado</Button></Panel>

  return (
    <>
      <div className="detail-back"><Link to="/animales"><ArrowLeft size={17} /> Volver a animales</Link></div>
      <header className="animal-profile-header">
        <div className="animal-profile-main"><span className="animal-profile-avatar"><Beef size={31} /></span><div><div className="profile-badges"><Badge tone={animal.status === 'Activo' ? 'success' : 'neutral'}>{animal.status}</Badge><Badge tone="info">{animal.category}</Badge></div><h1>{animal.tag}</h1><p>{animal.name} · {animal.farm}</p></div></div>
        <div className="profile-actions"><Button variant="secondary" onClick={() => navigate(`/reproduccion?animal=${animal.id}`)}><HeartPulse size={17} /> Evento reproductivo</Button><Button onClick={() => navigate(`/sanidad?animal=${animal.id}`)}><Syringe size={17} /> Registrar tratamiento</Button></div>
      </header>
      {alerts.length > 0 && <div className="profile-alert"><Activity size={20} /><div><strong>{alerts.length} alerta{alerts.length > 1 ? 's' : ''} vinculada{alerts.length > 1 ? 's' : ''}</strong><span>{alerts.map((alert) => alert.title).join(' · ')}</span></div><Button variant="ghost" onClick={() => navigate('/consistencia')}>Investigar</Button></div>}
      <div className="profile-grid">
        <div className="profile-main-column">
          <Panel title="Información general" subtitle="Identidad y ubicación actual">
            <div className="info-grid"><div><Calendar size={17} /><span>Nacimiento</span><strong>{formatDate(animal.birthDate)}</strong></div><div><MapPin size={17} /><span>Lote actual</span><strong>{animal.lot}</strong></div><div><Beef size={17} /><span>Sexo</span><strong>{animal.sex}</strong></div><div><Activity size={17} /><span>Peso estimado</span><strong>{animal.weight} kg</strong></div></div>
          </Panel>
          <Panel title="Producción y lactancia" subtitle={animal.category === 'Vaca en ordeñe' ? `Lactancia ${animal.lactationNumber} · ${animal.daysInMilk} días en leche` : 'Sin producción individual para esta categoría'}>
            {animal.category === 'Vaca en ordeñe' ? <><div className="production-highlight"><div><span>Último control</span><strong>{animal.lastMilkLiters.toFixed(1)} L</strong></div><div><span>Promedio 14 días</span><strong>{(animal.lastMilkLiters - 0.4).toFixed(1)} L</strong></div><div><span>Objetivo</span><strong>25,0 L</strong></div></div><div className="small-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={milkSeries}><defs><linearGradient id="animalMilk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2e7d5b" stopOpacity={0.25}/><stop offset="95%" stopColor="#2e7d5b" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day" tickLine={false} axisLine={false}/><YAxis domain={['dataMin - 3', 'dataMax + 3']} tickLine={false} axisLine={false}/><Tooltip formatter={(value) => `${value} L`}/><Area type="monotone" dataKey="liters" stroke="#2e7d5b" fill="url(#animalMilk)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div></> : <EmptyState title="Sin lactancia activa" description="La producción aparecerá cuando el animal ingrese al rodeo de ordeñe." />}
          </Panel>
          <Panel title="Línea de tiempo" subtitle="Historia trazable de la ficha">
            <div className="timeline">{[...animal.timeline].sort((a, b) => b.date.localeCompare(a.date)).map((event) => <div className="timeline-event" key={event.id}><span className="timeline-dot" /><div className="timeline-date">{formatDate(event.date)}</div><div><Badge tone={event.type === 'Sanidad' ? 'warning' : event.type === 'Reproducción' ? 'purple' : 'info'}>{event.type}</Badge><h3>{event.title}</h3><p>{event.detail}</p><small>Cargó {event.operator}</small></div></div>)}</div>
          </Panel>
        </div>
        <aside className="profile-side-column">
          <Panel title="Estado reproductivo">
            <div className="repro-status-card"><span className="repro-icon"><HeartPulse size={22} /></span><div><Badge tone={animal.reproductiveStatus === 'Preñada' ? 'success' : animal.reproductiveStatus === 'Vacía' ? 'warning' : 'neutral'}>{animal.reproductiveStatus}</Badge>{animal.dueDate && <><strong>Parto estimado</strong><span>{formatDate(animal.dueDate)} · {daysBetween(DEMO_TODAY, animal.dueDate)} días</span></>}</div></div>
            {animal.dueDate && <ProgressBar value={Math.max(5, 100 - daysBetween(DEMO_TODAY, animal.dueDate) / 2.1)} />}
            <div className="simple-list">{reproduction.slice(0, 4).map((event) => <div key={event.id}><span>{event.type}</span><strong>{formatDate(event.date)}</strong></div>)}</div>
          </Panel>
          <Panel title="Genealogía">
            <div className="parent-cards"><div><span><Baby size={17} /> Madre</span>{mother ? <Link to={`/animales/${mother.id}`}><strong>{mother.tag}</strong><small>{mother.name}</small></Link> : <p>Sin dato informado</p>}</div><div><span><Beef size={17} /> Padre</span>{father ? <Link to={`/animales/${father.id}`}><strong>{father.tag}</strong><small>{father.name}</small></Link> : <p>Sin dato informado</p>}</div></div>
          </Panel>
          <Panel title="Sanidad">
            <div className="health-profile-summary"><span className={`health-orb ${animal.healthStatus === 'Sana' ? 'healthy' : 'attention'}`}><Stethoscope size={20} /></span><div><strong>{animal.healthStatus}</strong><span>{treatments.filter((item) => item.active).length} tratamientos activos</span></div></div>
            <div className="simple-list">{treatments.slice(0, 3).map((treatment) => <div key={treatment.id}><span>{treatment.diagnosis}</span><strong>{treatment.medicine}</strong></div>)}{treatments.length === 0 && <p className="muted-text">Sin tratamientos registrados.</p>}</div>
          </Panel>
          {animal.category === 'Vaca en ordeñe' && <Panel title="Indicadores de lactancia"><div className="metric-row"><Milk size={17} /><span>Días en leche</span><strong>{animal.daysInMilk}</strong></div><div className="metric-row"><Droplets size={17} /><span>Producción</span><strong>{animal.lastMilkLiters.toFixed(1)} L</strong></div></Panel>}
        </aside>
      </div>
    </>
  )
}
