import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Filter, Search, SlidersHorizontal } from 'lucide-react'
import { Badge, Button, EmptyState, PageHeader, Panel } from '../components/ui'
import { useDemo } from '../store/DemoContext'

const PAGE_SIZE = 25

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

export default function Animals() {
  const { state, trackEvent } = useDemo()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(params.get('categoria') ?? '')
  const [status, setStatus] = useState('')
  const [lot, setLot] = useState('')
  const [farm, setFarm] = useState('')
  const [page, setPage] = useState(1)

  const lots = useMemo(() => [...new Set(state.animals.map((animal) => animal.lot))].sort(), [state.animals])
  const filtered = useMemo(() => state.animals.filter((animal) => {
    const matchesQuery = !query || `${animal.tag} ${animal.name}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (!category || animal.category === category) && (!status || animal.status === status) && (!lot || animal.lot === lot) && (!farm || animal.farm === farm)
  }), [state.animals, query, category, status, lot, farm])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const exportCsv = () => {
    const rows = [['Caravana', 'Nombre', 'Establecimiento', 'Categoría', 'Estado', 'Lote', 'Nacimiento'], ...filtered.map((animal) => [animal.tag, animal.name, animal.farm, animal.category, animal.status, animal.lot, animal.birthDate])]
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = 'campo-hoy-animales.csv'
    anchor.click()
    URL.revokeObjectURL(anchor.href)
    trackEvent({ type: 'feature_use', module: 'Animales', label: 'Exportación CSV', durationSeconds: 12 })
  }

  const clearFilters = () => { setQuery(''); setCategory(''); setStatus(''); setLot(''); setFarm(''); setPage(1) }
  const activeFilters = [query, category, status, lot, farm].filter(Boolean).length

  return (
    <>
      <PageHeader eyebrow="Rodeo y trazabilidad" title="Animales" description={`${state.animals.length} fichas ficticias con historia individual, parentesco y estado productivo.`} actions={<Button variant="secondary" onClick={exportCsv}><Download size={17} /> Exportar CSV</Button>} />
      <div className="animal-summary-strip">
        <div><span>Total fichas</span><strong>{state.animals.length}</strong></div>
        <div><span>Activos</span><strong>{state.animals.filter((a) => a.status === 'Activo').length}</strong></div>
        <div><span>Hembras</span><strong>{state.animals.filter((a) => a.sex === 'Hembra').length}</strong></div>
        <div><span>Con alertas</span><strong>{new Set(state.alerts.flatMap((a) => a.relatedAnimalIds)).size}</strong></div>
      </div>
      <Panel className="filter-panel">
        <div className="filters-row">
          <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Buscar por caravana o nombre" aria-label="Buscar por caravana" /></label>
          <label><span className="sr-only">Categoría</span><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}><option value="">Todas las categorías</option><option>Vaca en ordeñe</option><option>Vaca seca</option><option>Vaquillona</option><option>Ternera</option><option>Ternero</option><option>Toro</option></select></label>
          <label><span className="sr-only">Estado</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">Todos los estados</option><option>Activo</option><option>Vendido</option><option>Descarte</option><option>Muerto</option></select></label>
          <label><span className="sr-only">Lote</span><select value={lot} onChange={(event) => { setLot(event.target.value); setPage(1) }}><option value="">Todos los lotes</option>{lots.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Establecimiento</span><select value={farm} onChange={(event) => { setFarm(event.target.value); setPage(1) }}><option value="">Ambos establecimientos</option><option>Tambo La Esperanza</option><option>Establecimiento El Ombú</option></select></label>
          {activeFilters > 0 && <Button variant="ghost" onClick={clearFilters}>Limpiar ({activeFilters})</Button>}
        </div>
        <div className="filter-meta"><span><Filter size={15} /> {filtered.length} animales encontrados</span><span><SlidersHorizontal size={15} /> Filtros combinables</span></div>
      </Panel>
      <Panel className="table-panel">
        {visible.length ? <div className="data-table-wrap"><table className="data-table animal-table"><thead><tr><th>Animal</th><th>Categoría</th><th>Establecimiento</th><th>Lote</th><th>Reproducción</th><th>Sanidad</th><th>Estado</th><th aria-label="Abrir" /></tr></thead><tbody>{visible.map((animal) => {
          const hasAlert = state.alerts.some((alert) => alert.relatedAnimalIds.includes(animal.id) && alert.status !== 'Resuelta')
          return <tr key={animal.id} onClick={() => navigate(`/animales/${animal.id}`)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && navigate(`/animales/${animal.id}`)}>
            <td><div className="animal-cell"><span className="animal-avatar">{animal.tag.slice(-2)}</span><div><strong>{animal.tag}</strong><span>{animal.name} · {animal.sex}</span></div>{hasAlert && <span className="row-alert" title="Con alerta">!</span>}</div></td>
            <td>{animal.category}</td><td>{animal.farm}</td><td>{animal.lot}</td><td><Badge tone={animal.reproductiveStatus === 'Preñada' ? 'success' : animal.reproductiveStatus === 'Vacía' ? 'warning' : 'neutral'}>{animal.reproductiveStatus}</Badge></td><td><Badge tone={animal.healthStatus === 'Sana' ? 'success' : animal.healthStatus === 'En tratamiento' ? 'danger' : 'warning'}>{animal.healthStatus}</Badge></td><td><Badge tone={animal.status === 'Activo' ? 'success' : animal.status === 'Muerto' ? 'danger' : 'neutral'}>{animal.status}</Badge></td><td><ChevronRight size={18} /></td>
          </tr>
        })}</tbody></table></div> : <EmptyState title="Sin coincidencias" description="Probá con otra caravana o quitá uno de los filtros." />}
        <div className="pagination"><span>Mostrando {visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}</span><div><Button variant="ghost" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={17} /> Anterior</Button><span>Página {currentPage} de {pages}</span><Button variant="ghost" disabled={currentPage === pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Siguiente <ChevronRight size={17} /></Button></div></div>
      </Panel>
    </>
  )
}
