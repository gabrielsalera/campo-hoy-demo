import { useMemo } from 'react'
import { CheckCircle2, Clock3, Contact, Eye, FileInput, MousePointerClick, Route, Star, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, PageHeader, Panel, ProgressBar, StatCard } from '../components/ui'
import { formatDate } from '../data/demoData'
import { useDemo } from '../store/DemoContext'

export default function CommercialAnalytics() {
  const { state } = useDemo()
  const events = state.analyticsEvents
  const sessions = new Set(events.map((event) => event.sessionId))
  const sessionCounts = new Map<string, number>()
  events.forEach((event) => sessionCounts.set(event.sessionId, (sessionCounts.get(event.sessionId) ?? 0) + 1))
  const returning = [...sessionCounts.values()].filter((count) => count > 3).length
  const pageViews = events.filter((event) => event.type === 'page_view')
  const formStarts = events.filter((event) => event.type === 'form_started')
  const formCompleted = events.filter((event) => event.type === 'form_completed')
  const contactRequests = events.filter((event) => event.type === 'contact_request').length + state.surveys.filter((survey) => survey.contactRequested).length
  const averageTime = Math.round(events.reduce((sum, event) => sum + event.durationSeconds, 0) / Math.max(1, sessions.size) / 60)
  const avgInterest = state.surveys.length ? Math.round(state.surveys.reduce((sum, survey) => sum + survey.interestScore, 0) / state.surveys.length) : 78

  const modules = useMemo(() => {
    const map = new Map<string, number>()
    events.forEach((event) => event.type === 'page_view' && map.set(event.module, (map.get(event.module) ?? 0) + 1))
    return [...map.entries()].map(([module, visits]) => ({ module, visits })).sort((a,b)=>b.visits-a.visits).slice(0,10)
  }, [events])
  const funnel = [
    { value: sessions.size, name: 'Ingresaron a la demo', fill: '#2e7d5b' },
    { value: Math.round(sessions.size * .82), name: 'Visitaron 3+ módulos', fill: '#4b9271' },
    { value: Math.max(formStarts.length, Math.round(sessions.size * .54)), name: 'Iniciaron formulario', fill: '#79ad8f' },
    { value: Math.max(formCompleted.length, Math.round(sessions.size * .38)), name: 'Completaron formulario', fill: '#a4c5ae' },
    { value: Math.max(contactRequests, Math.round(sessions.size * .14)), name: 'Solicitaron contacto', fill: '#d7a556' },
  ]
  const sessionsByDay = useMemo(() => Array.from({ length: 14 }, (_, index) => {
    const date = new Date('2026-08-02T12:00:00Z'); date.setUTCDate(date.getUTCDate() - (13-index)); const iso=date.toISOString().slice(0,10)
    return { date: iso.slice(5), sessions: new Set(events.filter((event)=>event.date===iso).map((event)=>event.sessionId)).size || 1, actions: events.filter((event)=>event.date===iso).length }
  }), [events])

  return (
    <>
      <PageHeader eyebrow="Área privada · Comercial" title="Analítica de la demo" description="Qué recorren los productores, qué prueban y dónde aparece una intención comercial concreta." actions={<Badge tone="purple"><Eye size={14}/> Sólo equipo comercial</Badge>} />
      <div className="analytics-live"><span className="live-dot"/><strong>Medición local activa</strong><p>Esta misma navegación agrega eventos a los indicadores sin enviar datos a servicios externos.</p></div>
      <div className="stat-grid stat-grid-4"><StatCard label="Sesiones demo" value={sessions.size} hint={`${returning} usuarios regresaron`} icon={Users}/><StatCard label="Módulos visitados" value={pageViews.length} hint={`${modules.length} módulos distintos`} icon={MousePointerClick} tone="blue"/><StatCard label="Tiempo aproximado" value={`${averageTime} min`} hint="Promedio por sesión" icon={Clock3} tone="purple"/><StatCard label="Solicitudes de contacto" value={contactRequests} hint="Intención de seguimiento" icon={Contact} tone="amber"/></div>
      <div className="analytics-grid"><Panel title="Embudo de interacción" subtitle="Desde el ingreso hasta la solicitud de contacto"><div className="funnel-chart"><ResponsiveContainer width="100%" height="100%"><FunnelChart><Tooltip/><Funnel dataKey="value" data={funnel} isAnimationActive={false}>{funnel.map((item)=><Cell key={item.name} fill={item.fill}/>) }<LabelList position="right" fill="#2b362f" stroke="none" dataKey="name"/></Funnel></FunnelChart></ResponsiveContainer></div></Panel><Panel title="Interés comercial" subtitle="Señales consolidadas de la encuesta"><div className="interest-score"><div className="interest-ring"><strong>{avgInterest}</strong><span>/100</span></div><div><Badge tone={avgInterest>=75?'success':'warning'}>Interés {avgInterest>=75?'alto':'medio'}</Badge><h3>Buena probabilidad de adopción</h3><p>Combina interés en datos propios, escala del rodeo y solicitud de contacto.</p></div></div><div className="interest-signals"><div><span>Usaría datos propios</span><ProgressBar value={state.surveys.length ? Math.round(state.surveys.filter((s)=>s.ownDataInterest==='Sí').length/state.surveys.length*100) : 71}/><strong>{state.surveys.length ? Math.round(state.surveys.filter((s)=>s.ownDataInterest==='Sí').length/state.surveys.length*100) : 71}%</strong></div><div><span>Completó un formulario</span><ProgressBar value={Math.min(100, Math.round(formCompleted.length/Math.max(1,sessions.size)*100))}/><strong>{Math.min(100, Math.round(formCompleted.length/Math.max(1,sessions.size)*100))}%</strong></div></div></Panel></div>
      <div className="analytics-grid"><Panel title="Actividad de las últimas dos semanas" subtitle="Sesiones y funciones utilizadas"><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={sessionsByDay}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip/><Bar dataKey="sessions" name="Sesiones" fill="#2e7d5b" radius={[4,4,0,0]}/><Bar dataKey="actions" name="Acciones" fill="#a8c6df" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></Panel><Panel title="Módulos más visitados" subtitle="Ranking acumulado"><div className="module-ranking">{modules.map((module,index)=><div key={module.module}><span>{index+1}</span><div><strong>{module.module}</strong><ProgressBar value={Math.round(module.visits/Math.max(1,modules[0]?.visits)*100)}/></div><strong>{module.visits}</strong></div>)}</div></Panel></div>
      <div className="commercial-detail-grid"><Panel title="Uso de formularios" subtitle="Inicio y finalización"><div className="form-conversion"><div><span className="form-icon started"><FileInput size={21}/></span><div><strong>{formStarts.length || 18}</strong><span>Formularios iniciados</span></div></div><Route size={24}/><div><span className="form-icon completed"><CheckCircle2 size={21}/></span><div><strong>{formCompleted.length}</strong><span>Formularios completados</span></div></div><div className="conversion-rate"><strong>{Math.min(100,Math.round(formCompleted.length/Math.max(1,formStarts.length||18)*100))}%</strong><span>conversión</span></div></div></Panel><Panel title="Respuestas y contactos" subtitle="Últimas respuestas guardadas"><div className="survey-results" data-testid="analytics-surveys">{state.surveys.length ? state.surveys.slice(0,5).map((survey)=><div key={survey.id}><span className="survey-avatar">{survey.name ? survey.name.slice(0,2).toUpperCase() : 'AN'}</span><div><strong>{survey.name || 'Respuesta anónima'}</strong><span>{survey.mostUseful} · {survey.animalCount} animales</span></div><Badge tone={survey.contactRequested?'success':'neutral'}>{survey.contactRequested?'Contacto solicitado':`Interés ${survey.interestScore}`}</Badge><small>{formatDate(survey.date)}</small></div>) : <div className="empty-commercial"><Star size={25}/><strong>Resultados ficticios precargados</strong><span>La próxima encuesta completada aparecerá acá.</span></div>}</div></Panel></div>
      <Panel title="Eventos recientes" subtitle="Navegación y funciones utilizadas en este dispositivo"><div className="event-stream">{events.slice(-12).reverse().map((event)=><div key={event.id}><span className={`event-dot event-${event.type}`}/><div><strong>{event.label}</strong><span>{event.module} · sesión {event.sessionId.slice(-8)}</span></div><Badge tone={event.type==='form_completed'?'success':event.type==='contact_request'?'warning':'info'}>{event.type.replace('_',' ')}</Badge><small>{event.durationSeconds ? `${event.durationSeconds} s` : 'ahora'}</small></div>)}</div></Panel>
    </>
  )
}
