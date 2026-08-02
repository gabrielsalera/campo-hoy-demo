import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Animals = lazy(() => import('./pages/Animals'))
const AnimalDetail = lazy(() => import('./pages/AnimalDetail'))
const Consistency = lazy(() => import('./pages/Consistency'))
const Births = lazy(() => import('./pages/Births'))
const MilkProduction = lazy(() => import('./pages/MilkProduction'))
const Reproduction = lazy(() => import('./pages/Reproduction'))
const Health = lazy(() => import('./pages/Health'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Lots = lazy(() => import('./pages/Lots'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Climate = lazy(() => import('./pages/Climate'))
const ImportExport = lazy(() => import('./pages/ImportExport'))
const CommercialAnalytics = lazy(() => import('./pages/CommercialAnalytics'))
const Survey = lazy(() => import('./pages/Survey'))

export default function App() {
  return (
    <Suspense fallback={<div className="route-loading" role="status"><span /><strong>Cargando Campo Hoy…</strong></div>}><Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="animales" element={<Animals />} />
        <Route path="animales/:id" element={<AnimalDetail />} />
        <Route path="consistencia" element={<Consistency />} />
        <Route path="nacimientos" element={<Births />} />
        <Route path="produccion" element={<MilkProduction />} />
        <Route path="reproduccion" element={<Reproduction />} />
        <Route path="sanidad" element={<Health />} />
        <Route path="inventario" element={<Inventory />} />
        <Route path="lotes" element={<Lots />} />
        <Route path="tareas" element={<Tasks />} />
        <Route path="clima" element={<Climate />} />
        <Route path="datos" element={<ImportExport />} />
        <Route path="comercial" element={<CommercialAnalytics />} />
        <Route path="encuesta" element={<Survey />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes></Suspense>
  )
}
