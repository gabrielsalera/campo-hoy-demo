import {
  BarChart3, Beef, Boxes, CalendarCheck2, ChevronDown, ClipboardCheck, CloudSun, DatabaseZap,
  Gauge, HeartPulse, HelpCircle, Menu, Milk, PanelLeftClose, PanelLeftOpen, ScanSearch,
  ShieldCheck, Sprout, Stethoscope, Users, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { dataMode } from '../lib/supabase'
import { useDemo } from '../store/DemoContext'

const navigation = [
  { group: 'Visión general', items: [
    { to: '/dashboard', label: 'Dashboard', icon: Gauge },
    { to: '/animales', label: 'Animales', icon: Beef },
    { to: '/consistencia', label: 'Consistencia', icon: ShieldCheck },
  ] },
  { group: 'Producción', items: [
    { to: '/nacimientos', label: 'Nacimientos', icon: Sprout },
    { to: '/produccion', label: 'Producción de leche', icon: Milk },
    { to: '/reproduccion', label: 'Reproducción', icon: HeartPulse },
    { to: '/sanidad', label: 'Sanidad', icon: Stethoscope },
  ] },
  { group: 'Operación', items: [
    { to: '/inventario', label: 'Inventario', icon: Boxes },
    { to: '/lotes', label: 'Lotes y potreros', icon: ScanSearch },
    { to: '/tareas', label: 'Tareas', icon: CalendarCheck2 },
    { to: '/clima', label: 'Lluvias y clima', icon: CloudSun },
    { to: '/datos', label: 'Importar / exportar', icon: DatabaseZap },
  ] },
  { group: 'Demo comercial', items: [
    { to: '/comercial', label: 'Analítica', icon: BarChart3 },
    { to: '/encuesta', label: 'Encuesta y contacto', icon: Users },
  ] },
]

const mobileLinks = [
  { to: '/dashboard', label: 'Inicio', icon: Gauge },
  { to: '/animales', label: 'Animales', icon: Beef },
  { to: '/produccion', label: 'Leche', icon: Milk },
  { to: '/tareas', label: 'Tareas', icon: ClipboardCheck },
]

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><Sprout size={21} /></div>
}

export default function Layout() {
  const { state, trackEvent } = useDemo()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [farm, setFarm] = useState('Todos los establecimientos')
  const location = useLocation()
  const allItems = useMemo(() => navigation.flatMap((group) => group.items), [])
  const activeItem = allItems.find((item) => location.pathname.startsWith(item.to))

  useEffect(() => {
    setMobileOpen(false)
    const label = activeItem?.label ?? 'Dashboard'
    trackEvent({ type: 'page_view', module: label, label: `Visita a ${label}`, durationSeconds: 45 })
    // Se registra una sola vez por cambio de ruta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <NavLink to="/dashboard" className="brand"><BrandMark /><div><strong>Campo Hoy</strong><span>Gestión agropecuaria</span></div></NavLink>
          <button className="sidebar-close" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          {navigation.map((group) => <div className="nav-group" key={group.group}><p>{group.group}</p>{group.items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={collapsed ? label : undefined}>
              <Icon size={19} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}</div>)}
        </nav>
        <div className="sidebar-footer">
          <div className="support-card"><HelpCircle size={19} /><div><strong>Demo guiada</strong><span>Datos 100% ficticios</span></div></div>
          <button className="collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expandir navegación' : 'Contraer navegación'}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span>{collapsed ? '' : 'Contraer menú'}</span>
          </button>
        </div>
      </aside>
      {mobileOpen && <button className="mobile-overlay" aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)} />}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu" aria-label="Abrir navegación" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div><span className="breadcrumb">Campo Hoy /</span><strong>{activeItem?.label ?? 'Dashboard'}</strong></div></div>
          <div className="topbar-actions">
            <label className="farm-selector"><span className="sr-only">Establecimiento</span><select value={farm} onChange={(event) => setFarm(event.target.value)}><option>Todos los establecimientos</option><option>Tambo La Esperanza</option><option>Establecimiento El Ombú</option></select><ChevronDown size={15} /></label>
            <div className="sync-pill"><span className="live-dot" />{dataMode}<small>{state.pendingSync} pendientes</small></div>
            <div className="avatar" title="Productor demo">PG</div>
          </div>
        </header>
        <main className="content"><Outlet /></main>
        <nav className="mobile-bottom" aria-label="Navegación móvil">
          {mobileLinks.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={20} /><span>{label}</span></NavLink>)}
          <button onClick={() => setMobileOpen(true)}><Menu size={20} /><span>Más</span></button>
        </nav>
      </div>
    </div>
  )
}
