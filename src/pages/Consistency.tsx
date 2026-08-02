import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, FileWarning, ShieldCheck, UserRound } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Modal, PageHeader, Panel, ProgressBar, Segmented, StatCard } from '../components/ui'
import { formatDate } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { ConsistencyAlert, Severity } from '../types'

const severityTone = (severity: Severity) => severity === 'Crítica' ? 'danger' : severity === 'Alta' ? 'warning' : severity === 'Media' ? 'info' : 'neutral'

export default function Consistency() {
  const { state, updateAlert } = useDemo()
  const [filter, setFilter] = useState('Abiertas')
  const [selected, setSelected] = useState<ConsistencyAlert | null>(null)
  const openAlerts = state.alerts.filter((alert) => alert.status !== 'Resuelta')
  const critical = openAlerts.filter((alert) => alert.severity === 'Crítica')
  const warnings = openAlerts.filter((alert) => alert.severity !== 'Crítica')
  const visible = filter === 'Todas' ? state.alerts : filter === 'Resueltas' ? state.alerts.filter((alert) => alert.status === 'Resuelta') : openAlerts
  const expectedBirths = 48
  const reportedBirths = state.births.length
  const registeredCalves = state.births.filter((birth) => state.animals.some((animal) => animal.id === birth.calfId)).length
  const missingCalves = Math.max(0, expectedBirths - registeredCalves)
  const score = Math.max(0, Math.round(100 - critical.length * 2 - warnings.length * 0.8))
  const trend = useMemo(() => Array.from({ length: 8 }, (_, index) => ({ week: `S${index + 1}`, score: 72 + index * 2 + (index % 3) * 2, alerts: 19 - index })), [])
  const ranking = useMemo(() => state.alerts.map((alert) => ({ name: alert.title.split(' ').slice(0, 3).join(' '), count: alert.severity === 'Crítica' ? 8 : alert.severity === 'Alta' ? 5 : 3 })).slice(0, 7), [state.alerts])

  const act = (alert: ConsistencyAlert, status: ConsistencyAlert['status']) => {
    updateAlert(alert.id, status)
    setSelected({ ...alert, status })
  }

  return (
    <>
      <PageHeader eyebrow="Control de calidad" title="Consistencia reproductiva" description="Cada inconsistencia muestra su origen, evidencia y una acción concreta para resolverla." actions={<Badge tone={critical.length ? 'danger' : 'success'}>{critical.length} críticas abiertas</Badge>} />
      <div className="consistency-hero">
        <Panel className="score-panel"><div className="score-large"><div className="score-gauge"><span style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}><strong>{score}</strong><small>/100</small></span></div><div><Badge tone={score >= 85 ? 'success' : 'warning'}>{score >= 85 ? 'Buena consistencia' : 'Requiere atención'}</Badge><h2>Calidad general del rodeo</h2><p>El puntaje combina partos, nacimientos, reproducción, bajas y ocupación de lotes.</p></div></div><div className="score-breakdown"><div><span>Identificación</span><ProgressBar value={94} /><strong>94%</strong></div><div><span>Reproducción</span><ProgressBar value={84} tone="amber"/><strong>84%</strong></div><div><span>Stock y lotes</span><ProgressBar value={79} tone="amber"/><strong>79%</strong></div></div></Panel>
        <div className="consistency-stats"><StatCard label="Errores críticos" value={critical.length} hint="Bloquean la conciliación" icon={AlertOctagon} tone="red" onClick={() => setFilter('Abiertas')} /><StatCard label="Advertencias" value={warnings.length} hint="Necesitan revisión" icon={AlertTriangle} tone="amber" onClick={() => setFilter('Abiertas')} /><StatCard label="Diferencia de stock" value="+2" hint="Declarado vs. individual" icon={FileWarning} tone="red" onClick={() => setSelected(state.alerts.find((alert) => alert.type === 'muerto-stock') ?? null)} /><StatCard label="Controles resueltos" value={state.alerts.filter((alert) => alert.status === 'Resuelta').length} hint="En esta demostración" icon={CheckCircle2} tone="green" onClick={() => setFilter('Resueltas')} /></div>
      </div>
      <div className="birth-audit-grid">
        {[['Partos esperados', expectedBirths, 'Plan reproductivo'], ['Partos informados', reportedBirths, 'Registros recibidos'], ['Crías registradas', registeredCalves, 'Fichas vinculadas'], ['Crías faltantes', missingCalves, 'Diferencia investigable']].map(([label, value, hint], index) => <div key={String(label)}><span className={`audit-number audit-${index}`}>{value}</span><strong>{label}</strong><small>{hint}</small></div>)}
      </div>
      <div className="consistency-charts">
        <Panel title="Evolución del puntaje" subtitle="Últimas ocho semanas"><div className="medium-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="week" tickLine={false} axisLine={false}/><YAxis domain={[60, 100]} tickLine={false} axisLine={false}/><Tooltip/><Line dataKey="score" name="Puntaje" stroke="#2e7d5b" strokeWidth={3} dot={{ fill: '#2e7d5b', r: 4 }}/></LineChart></ResponsiveContainer></div></Panel>
        <Panel title="Ranking de errores" subtitle="Casos detectados en 18 meses"><div className="medium-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={ranking} layout="vertical" margin={{ left: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickLine={false} axisLine={false}/><YAxis dataKey="name" type="category" width={118} tickLine={false} axisLine={false}/><Tooltip/><Bar dataKey="count" name="Casos" fill="#d99c4b" radius={[0, 6, 6, 0]}/></BarChart></ResponsiveContainer></div></Panel>
      </div>
      <Panel title="Alertas investigables" subtitle="Evidencia completa, responsable de carga y resolución trazada" action={<Segmented options={['Abiertas', 'Resueltas', 'Todas']} value={filter} onChange={setFilter} label="Filtrar alertas" />}>
        <div className="alert-list" data-testid="consistency-alerts">{visible.map((alert) => <article key={alert.id} className={`alert-row severity-${alert.severity.toLowerCase()}`}>
          <div className="alert-severity"><span>{alert.severity === 'Crítica' ? <AlertOctagon size={20}/> : <AlertTriangle size={20}/>}</span></div>
          <div className="alert-main"><div className="alert-title-row"><Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge><Badge tone={alert.status === 'Resuelta' ? 'success' : alert.status === 'En revisión' ? 'purple' : 'neutral'}>{alert.status}</Badge><span>{formatDate(alert.date)}</span></div><h3>{alert.title}</h3><p>{alert.explanation}</p><div className="alert-meta"><span><UserRound size={14}/> {alert.operator}</span><span><ClipboardCheck size={14}/> {alert.evidence.length} evidencias</span></div></div>
          <div className="alert-actions"><Button variant="ghost" onClick={() => setSelected(alert)}>Revisar</Button><Button variant="secondary" onClick={() => act(alert, 'Corregida')}>Corregir</Button><Button onClick={() => act(alert, 'Resuelta')}>Resolver</Button></div>
        </article>)}</div>
      </Panel>
      <Modal open={Boolean(selected)} title={selected?.title ?? ''} eyebrow="Investigación de inconsistencia" onClose={() => setSelected(null)} width="large">
        {selected && <div className="alert-detail"><div className="alert-detail-top"><div><span>Gravedad</span><Badge tone={severityTone(selected.severity)}>{selected.severity}</Badge></div><div><span>Estado</span><Badge tone={selected.status === 'Resuelta' ? 'success' : 'warning'}>{selected.status}</Badge></div><div><span>Cargó el evento</span><strong>{selected.operator}</strong></div><div><span>Fecha detectada</span><strong>{formatDate(selected.date)}</strong></div></div><section><h3>Qué encontramos</h3><p>{selected.explanation}</p></section><section><h3>Evidencia</h3><ul className="evidence-list">{selected.evidence.map((item) => <li key={item}><ShieldCheck size={17}/><span>{item}</span></li>)}</ul></section><section><h3>Registros relacionados</h3><div className="related-records">{selected.relatedAnimalIds.map((animalId) => { const animal = state.animals.find((item) => item.id === animalId); return animal ? <Link key={animalId} to={`/animales/${animalId}`}><span className="animal-avatar">{animal.tag.slice(-2)}</span><div><strong>{animal.tag}</strong><small>{animal.name} · {animal.status}</small></div><ChevronRight size={18}/></Link> : <div key={animalId} className="missing-record"><AlertTriangle size={18}/><span>Referencia sin ficha: {animalId}</span></div> })}</div></section><section className="recommendation"><h3>Acción recomendada</h3><p>{selected.recommendation}</p></section><div className="modal-actions"><Button variant="ghost" onClick={() => act(selected, 'En revisión')}>Marcar en revisión</Button><Button variant="secondary" onClick={() => act(selected, 'Corregida')}>Aplicar corrección</Button><Button onClick={() => { act(selected, 'Resuelta'); setSelected(null) }}>Resolver alerta</Button></div></div>}
      </Modal>
    </>
  )
}
