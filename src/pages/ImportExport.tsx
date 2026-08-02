import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Database, Download, FileSpreadsheet, FileUp, RefreshCcw, ShieldCheck, Upload, XCircle } from 'lucide-react'
import { readSheet } from 'read-excel-file/browser'
import { Badge, Button, Field, PageHeader, Panel, ProgressBar } from '../components/ui'
import { createId, DEMO_TODAY, FARMS, formatNumber } from '../data/demoData'
import { useDemo } from '../store/DemoContext'
import type { Animal, AnimalCategory, AnimalStatus, Farm } from '../types'

type ParsedRow = Record<string, unknown>
type Mapping = { tag: string; category: string; farm: string; status: string }

const categories: AnimalCategory[] = ['Vaca en ordeñe', 'Vaca seca', 'Vaquillona', 'Ternera', 'Ternero', 'Toro']
const statuses: AnimalStatus[] = ['Activo', 'Vendido', 'Descarte', 'Muerto']

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
function downloadCsv(name: string, rows: unknown[][]) {
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = name; anchor.click(); URL.revokeObjectURL(anchor.href)
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { cells.push(current.trim()); current = '' }
    else current += char
  }
  cells.push(current.trim())
  return cells
}

export default function ImportExport() {
  const { state, importAnimals, resetDemo, trackEvent } = useDemo()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [mapping, setMapping] = useState<Mapping>({ tag: '', category: '', farm: '', status: '' })
  const [stage, setStage] = useState(1)
  const [message, setMessage] = useState('')
  const headers = rows.length ? Object.keys(rows[0]) : []

  const analysis = useMemo(() => rows.map((row, index) => {
    const tag = String(row[mapping.tag] ?? '').trim().toUpperCase()
    const category = String(row[mapping.category] ?? '').trim() as AnimalCategory
    const farm = String(row[mapping.farm] ?? '').trim() as Farm
    const status = String(row[mapping.status] ?? 'Activo').trim() as AnimalStatus
    const errors: string[] = []
    if (!tag) errors.push('Caravana vacía')
    if (!categories.includes(category)) errors.push('Categoría inválida')
    if (!FARMS.includes(farm)) errors.push('Establecimiento inválido')
    if (!statuses.includes(status)) errors.push('Estado inválido')
    if (state.animals.some((animal) => animal.tag.toLowerCase() === tag.toLowerCase())) errors.push('Caravana duplicada')
    if (rows.slice(0, index).some((previous) => String(previous[mapping.tag] ?? '').trim().toLowerCase() === tag.toLowerCase())) errors.push('Duplicado en archivo')
    return { index: index + 2, tag, category, farm, status, errors }
  }), [rows, mapping, state.animals])
  const valid = analysis.filter((row) => row.errors.length === 0)
  const rejected = analysis.filter((row) => row.errors.length > 0)
  const duplicates = analysis.filter((row) => row.errors.some((error) => error.includes('duplicad')))

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const matrix: unknown[][] = file.name.toLowerCase().endsWith('.csv')
      ? (await file.text()).split(/\r?\n/).filter(Boolean).map(parseCsvLine)
      : await readSheet(file) as unknown[][]
    const headerRow = (matrix[0] ?? []).map((cell) => String(cell ?? '').trim())
    const data = matrix.slice(1).map((row) => Object.fromEntries(headerRow.map((header, index) => [header, row[index] ?? ''])))
    setRows(data)
    const detectedHeaders = data.length ? Object.keys(data[0]) : []
    const findHeader = (terms: string[]) => detectedHeaders.find((header) => terms.some((term) => header.toLowerCase().includes(term))) ?? detectedHeaders[0] ?? ''
    setMapping({ tag: findHeader(['caravana', 'tag', 'id']), category: findHeader(['categoria', 'categoría', 'category']), farm: findHeader(['establecimiento', 'campo', 'farm']), status: findHeader(['estado', 'status']) })
    setStage(2)
    setMessage('')
    trackEvent({ type: 'form_started', module: 'Importación', label: `Archivo seleccionado: ${file.name}`, durationSeconds: 0 })
  }

  const confirm = () => {
    const imported: Animal[] = valid.map((row, index) => ({
      id: createId('animal-import'), tag: row.tag, name: `Animal importado ${index + 1}`, farm: row.farm, category: row.category, status: row.status,
      sex: row.category === 'Ternero' || row.category === 'Toro' ? 'Macho' : 'Hembra', birthDate: '2025-08-01', lot: row.farm === FARMS[0] ? 'Recría Norte' : 'Cría Sur',
      reproductiveStatus: 'No aplica', lactationNumber: 0, daysInMilk: 0, lastMilkLiters: 0, healthStatus: 'Sana', weight: 180, createdAt: DEMO_TODAY,
      timeline: [{ id: createId('timeline'), date: DEMO_TODAY, type: 'Movimiento', title: 'Ficha importada', detail: `Origen: ${fileName}`, operator: 'Productor demo' }],
    }))
    importAnimals(imported)
    setStage(4)
    setMessage(`${imported.length} filas válidas fueron importadas. ${rejected.length} filas rechazadas quedaron fuera del stock.`)
  }

  const restart = () => { setRows([]); setFileName(''); setStage(1); setMessage(''); if (fileRef.current) fileRef.current.value = '' }

  return (
    <>
      <PageHeader eyebrow="Movilidad de datos" title="Importar y exportar" description="Flujo guiado para mapear archivos, validar errores y confirmar sólo los registros confiables." />
      <div className="import-layout">
        <Panel title="Importación de animales" subtitle="Compatible con CSV, XLS y XLSX" className="import-panel">
          <div className="import-steps">{[['1','Archivo'],['2','Mapeo'],['3','Validación'],['4','Resultado']].map(([number,label],index) => <div key={number} className={stage >= index + 1 ? 'active' : ''}><span>{stage > index + 1 ? <Check size={15}/> : number}</span><strong>{label}</strong>{index < 3 && <i/>}</div>)}</div>
          {stage === 1 && <div className="upload-zone" onClick={() => fileRef.current?.click()}><input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" onChange={chooseFile}/><span className="upload-icon"><FileUp size={30}/></span><h3>Seleccioná un CSV o Excel</h3><p>Arrastrá o elegí un archivo para iniciar. Nada se guarda sin tu confirmación.</p><Button type="button"><Upload size={17}/> Elegir archivo</Button><small>Formatos admitidos: .csv, .xls, .xlsx</small></div>}
          {stage === 2 && <div className="mapping-stage"><div className="file-chip"><FileSpreadsheet size={21}/><div><strong>{fileName}</strong><span>{rows.length} filas · {headers.length} columnas detectadas</span></div><Button variant="ghost" onClick={restart}>Cambiar</Button></div><h3>Mapeá las columnas</h3><p>Indicá qué columna del archivo corresponde a cada dato de Campo Hoy.</p><div className="mapping-grid">{([['tag','Caravana'],['category','Categoría'],['farm','Establecimiento'],['status','Estado']] as const).map(([key,label]) => <Field key={key} label={label}><div className="mapping-select"><span>Campo Hoy</span><ArrowRight size={16}/><select value={mapping[key]} onChange={(event)=>setMapping((current)=>({...current,[key]:event.target.value}))}>{headers.map((header)=><option key={header}>{header}</option>)}</select></div></Field>)}</div><div className="stage-actions"><Button variant="ghost" onClick={restart}>Cancelar</Button><Button onClick={()=>setStage(3)}>Validar archivo <ArrowRight size={17}/></Button></div></div>}
          {stage === 3 && <div className="validation-stage"><div className="validation-summary"><div className="valid"><CheckCircle2 size={21}/><span>Filas válidas</span><strong>{valid.length}</strong></div><div className="rejected"><XCircle size={21}/><span>Rechazadas</span><strong>{rejected.length}</strong></div><div className="duplicate"><AlertTriangle size={21}/><span>Duplicados</span><strong>{duplicates.length}</strong></div></div><ProgressBar value={Math.round(valid.length / Math.max(1, analysis.length) * 100)} /><div className="preview-table-wrap"><table className="data-table"><thead><tr><th>Fila</th><th>Caravana</th><th>Categoría</th><th>Establecimiento</th><th>Estado</th><th>Validación</th></tr></thead><tbody>{analysis.slice(0,12).map((row)=><tr key={row.index}><td>{row.index}</td><td>{row.tag || '—'}</td><td>{row.category || '—'}</td><td>{row.farm || '—'}</td><td>{row.status || '—'}</td><td>{row.errors.length ? <Badge tone="danger">{row.errors.join(' · ')}</Badge> : <Badge tone="success">Válida</Badge>}</td></tr>)}</tbody></table></div><div className="validation-note"><ShieldCheck size={19}/><span>Las {rejected.length} filas rechazadas no se incorporarán. Podrás descargarlas y corregirlas fuera de la demo.</span></div><div className="stage-actions"><Button variant="ghost" onClick={()=>setStage(2)}>Volver al mapeo</Button><Button onClick={confirm} disabled={valid.length===0}><Database size={17}/> Confirmar {valid.length} filas</Button></div></div>}
          {stage === 4 && <div className="import-complete"><span><CheckCircle2 size={35}/></span><h3>Importación confirmada</h3><p>{message}</p><div><strong>{valid.length}</strong><span>nuevas fichas</span></div><Button onClick={restart}>Importar otro archivo</Button></div>}
        </Panel>
        <aside className="export-column"><Panel title="Exportaciones rápidas" subtitle="Listados principales en formato CSV"><div className="export-list"><button onClick={()=>{downloadCsv('campo-hoy-animales.csv',[['Caravana','Categoría','Estado','Establecimiento','Lote'],...state.animals.map((a)=>[a.tag,a.category,a.status,a.farm,a.lot])]); trackEvent({type:'feature_use',module:'Exportación',label:'Animales CSV',durationSeconds:8})}}><span><FileSpreadsheet size={20}/></span><div><strong>Animales y trazabilidad</strong><small>{formatNumber(state.animals.length)} fichas</small></div><Download size={18}/></button><button onClick={()=>downloadCsv('campo-hoy-tareas.csv',[['Tarea','Responsable','Prioridad','Fecha','Estado'],...state.tasks.map((t)=>[t.title,t.responsible,t.priority,t.dueDate,t.status])])}><span><FileSpreadsheet size={20}/></span><div><strong>Tareas</strong><small>{state.tasks.length} registros</small></div><Download size={18}/></button><button onClick={()=>downloadCsv('campo-hoy-produccion.csv',[['Fecha','Turno','Establecimiento','Litros','Vacas'],...state.milkRecords.map((r)=>[r.date,r.shift,r.farm,r.liters,r.milkedCows])])}><span><FileSpreadsheet size={20}/></span><div><strong>Producción de leche</strong><small>18 meses</small></div><Download size={18}/></button><button onClick={()=>downloadCsv('campo-hoy-sanidad.csv',[['Animal','Diagnóstico','Medicamento','Inicio','Fin'],...state.treatments.map((t)=>[state.animals.find((a)=>a.id===t.animalId)?.tag,t.diagnosis,t.medicine,t.startDate,t.endDate])])}><span><FileSpreadsheet size={20}/></span><div><strong>Sanidad</strong><small>{state.treatments.length} tratamientos</small></div><Download size={18}/></button></div></Panel><Panel title="Datos de la demo" subtitle="Persistencia local activa"><div className="data-health"><div><span className="live-dot"/><strong>Guardado automático</strong></div><p>Las cargas sobreviven al recargar la página mediante almacenamiento local del navegador.</p><div className="simple-list"><div><span>Última actualización</span><strong>Ahora</strong></div><div><span>Pendientes de sincronización</span><strong>{state.pendingSync}</strong></div></div><Button variant="danger" onClick={()=>void resetDemo().then(()=>setMessage('Los datos ficticios volvieron a su estado inicial.'))}><RefreshCcw size={17}/> Restablecer demo</Button></div></Panel></aside>
      </div>
    </>
  )
}
