import { useState, type FormEvent } from 'react'
import { CheckCircle2, Contact, Heart, Mail, MessageCircleQuestion, Phone, Send, Sparkles } from 'lucide-react'
import { Badge, Button, Field, PageHeader, Panel } from '../components/ui'
import { useDemo } from '../store/DemoContext'
import type { SurveyResponse } from '../types'

export default function Survey() {
  const { addSurvey, trackEvent } = useDemo()
  const [mostUseful, setMostUseful] = useState('Animales y trazabilidad')
  const [missingFeature, setMissingFeature] = useState('Integración con balanza electrónica')
  const [ownDataInterest, setOwnDataInterest] = useState<SurveyResponse['ownDataInterest']>('Sí')
  const [animalCount, setAnimalCount] = useState('480')
  const [contactRequested, setContactRequested] = useState(true)
  const [name, setName] = useState('Pablo García')
  const [email, setEmail] = useState('pablo@ejemplo.com')
  const [phone, setPhone] = useState('+54 9 351 555 0134')
  const [submitted, setSubmitted] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    addSurvey({ mostUseful, missingFeature, ownDataInterest, animalCount, contactRequested, name, email, phone })
    setSubmitted(true)
  }

  if (submitted) return <div className="survey-complete" data-testid="survey-success"><span><CheckCircle2 size={40}/></span><Badge tone="success">Respuesta guardada</Badge><h1>Gracias por recorrer Campo Hoy</h1><p>Tu evaluación ya aparece en el tablero comercial de esta demo. La solicitud no se envió fuera de este dispositivo.</p><div><Button onClick={()=>setSubmitted(false)}>Completar otra respuesta</Button><Button variant="secondary" onClick={()=>window.location.assign('/comercial')}>Ver tablero comercial</Button></div></div>

  return (
    <>
      <PageHeader eyebrow="Cierre de la demostración" title="Tu mirada mejora el producto" description="Contanos qué te resultó útil y si querés probar Campo Hoy con información propia." />
      <div className="survey-layout"><Panel className="survey-form-panel"><form onSubmit={submit} onFocus={()=>trackEvent({type:'form_started',module:'Encuesta',label:'Encuesta iniciada',durationSeconds:0})}><div className="survey-section"><div className="survey-question"><span>1</span><div><h2>¿Qué función te resultó más útil?</h2><p>Elegí la que más valor aportaría a tu trabajo diario.</p></div></div><div className="choice-grid">{['Dashboard del productor','Animales y trazabilidad','Control reproductivo','Producción de leche','Sanidad e inventario','Tareas y alertas'].map((choice)=><label key={choice} className={mostUseful===choice?'selected':''}><input type="radio" name="useful" value={choice} checked={mostUseful===choice} onChange={()=>setMostUseful(choice)}/><span>{choice}</span><CheckCircle2 size={18}/></label>)}</div></div><div className="survey-section"><div className="survey-question"><span>2</span><div><h2>¿Qué función te está faltando?</h2><p>Una necesidad concreta nos ayuda a priorizar.</p></div></div><Field label="Función o mejora"><textarea rows={3} value={missingFeature} onChange={(event)=>setMissingFeature(event.target.value)} placeholder="Ej.: integración con balanza, reportes contables…"/></Field></div><div className="survey-section"><div className="survey-question"><span>3</span><div><h2>¿Te interesaría probar con tus propios datos?</h2></div></div><div className="interest-choices">{(['Sí','Quizás','No'] as const).map((choice)=><label key={choice} className={ownDataInterest===choice?'selected':''}><input type="radio" name="interest" value={choice} checked={ownDataInterest===choice} onChange={()=>setOwnDataInterest(choice)}/><strong>{choice}</strong><span>{choice==='Sí'?'Quiero avanzar':choice==='Quizás'?'Necesito conversarlo':'Sólo quería conocerla'}</span></label>)}</div></div><div className="survey-section"><div className="survey-question"><span>4</span><div><h2>Contanos la escala de tu rodeo</h2></div></div><Field label="Cantidad aproximada de animales"><input type="number" min="1" value={animalCount} onChange={(event)=>setAnimalCount(event.target.value)} data-testid="survey-animal-count" required/></Field></div><div className="contact-toggle"><label><input type="checkbox" checked={contactRequested} onChange={(event)=>setContactRequested(event.target.checked)}/><span className="toggle-switch"/><div><strong>Quiero que me contacten</strong><p>Estos datos quedan guardados únicamente en esta demo local.</p></div></label></div>{contactRequested&&<div className="contact-fields"><Field label="Nombre"><div className="input-with-icon"><Contact size={17}/><input value={name} onChange={(event)=>setName(event.target.value)} required/></div></Field><Field label="Email"><div className="input-with-icon"><Mail size={17}/><input type="email" value={email} onChange={(event)=>setEmail(event.target.value)} required/></div></Field><Field label="Teléfono"><div className="input-with-icon"><Phone size={17}/><input value={phone} onChange={(event)=>setPhone(event.target.value)}/></div></Field></div>}<div className="survey-submit"><p><Heart size={16}/> No se realizará ningún envío externo.</p><Button type="submit" data-testid="submit-survey"><Send size={18}/> Guardar encuesta</Button></div></form></Panel><aside className="survey-side"><div className="survey-side-card"><span><Sparkles size={26}/></span><Badge tone="success">Demo completa</Badge><h2>Lo que acabás de recorrer</h2><ul><li><CheckCircle2 size={17}/> 512 animales con trazabilidad</li><li><CheckCircle2 size={17}/> 18 meses de historia productiva</li><li><CheckCircle2 size={17}/> 14 módulos conectados</li><li><CheckCircle2 size={17}/> Cargas que actualizan indicadores</li><li><CheckCircle2 size={17}/> Persistencia en este dispositivo</li></ul></div><Panel><div className="quote-card"><MessageCircleQuestion size={25}/><blockquote>“La información útil no es la que está guardada: es la que permite decidir a tiempo.”</blockquote><span>Equipo Campo Hoy</span></div></Panel></aside></div>
    </>
  )
}
