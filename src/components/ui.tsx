import { X, ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>
}

export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'green', onClick, testId }: {
  label: string; value: string | number; hint: string; icon: LucideIcon; tone?: 'green' | 'blue' | 'amber' | 'red' | 'purple'; onClick?: () => void; testId?: string
}) {
  const content = (
    <>
      <div className={`stat-icon tone-${tone}`}><Icon size={20} aria-hidden="true" /></div>
      <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>
      {onClick && <ArrowUpRight className="stat-arrow" size={18} aria-hidden="true" />}
    </>
  )
  return onClick
    ? <button className="stat-card interactive" onClick={onClick} data-testid={testId}>{content}</button>
    : <div className="stat-card" data-testid={testId}>{content}</div>
}

export function Panel({ title, subtitle, action, children, className = '' }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && <div className="panel-heading"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>}
      {children}
    </section>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Modal({ open, title, eyebrow, children, onClose, width = 'medium' }: { open: boolean; title: string; eyebrow?: string; children: ReactNode; onClose: () => void; width?: 'small' | 'medium' | 'large' }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal modal-${width}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div><IconButton label="Cerrar" onClick={onClose}><X size={20} /></IconButton></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><div className="empty-dot" /><h3>{title}</h3><p>{description}</p></div>
}

export function ProgressBar({ value, tone = 'green' }: { value: number; tone?: 'green' | 'amber' | 'red' | 'blue' }) {
  return <div className="progress" aria-label={`${value}%`}><span className={`progress-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}

export function Segmented({ options, value, onChange, label }: { options: string[]; value: string; onChange: (value: string) => void; label: string }) {
  return <div className="segmented" role="group" aria-label={label}>{options.map((option) => <button key={option} className={value === option ? 'active' : ''} onClick={() => onChange(option)}>{option}</button>)}</div>
}
