"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Activity } from "lucide-react";
import { type Cardio, cardioActivities, cardioSchema, cardioPace, cardioDuration, cardioWeek, localDate, prettyDate, uid } from "@/lib/model";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
export function CardioTab({ items, onSave }: { items: Cardio[]; onSave: (c: Cardio, deleted?: boolean) => Promise<void> }) {
  const [edit, setEdit] = useState<Cardio | null>(null);
  const [deleting, setDeleting] = useState<Cardio | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const summary = cardioWeek(items.filter(c => filter === "all" || c.activity === filter));
  const history = items.filter(c => filter === "all" || c.activity === filter).sort((a,b) => b.date.localeCompare(a.date));
  return <section className="cardio-page">
    <div className="cardio-heading"><div><h1>Cardio</h1><p className="muted">Cada salida y cada minuto cuentan.</p></div><Button onClick={() => setEdit({id:uid(),activity:"run",date:localDate(),distanceKm:null,durationSeconds:1800,rpe:null,notes:""})}><Plus size={18}/> Registrar</Button></div>
    <label>Actividad<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas las actividades</option>{Object.entries(cardioActivities).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <h2>Esta semana</h2><div className="cardio-stats"><div><strong>{summary.km.toLocaleString("es-AR",{maximumFractionDigits:2})}</strong><span>km registrados</span></div><div><strong>{Math.round(summary.minutes)}</strong><span>minutos</span></div><div><strong>{summary.count}</strong><span>sesiones</span></div></div>
    <h2>Historial</h2>
    {!history.length && <div className="empty"><Activity size={32}/><h3>Tu próximo paso empieza acá</h3><p>Registrá una actividad al terminar. La distancia es opcional.</p></div>}
    <div className="cardio-history">{history.map(c => <article className="cardio-record" key={c.id}><div><h3>{cardioActivities[c.activity]}</h3><small>{prettyDate(c.date)}</small><p><strong>{cardioDuration(c.durationSeconds)}</strong>{c.distanceKm !== null && ` · ${c.distanceKm.toLocaleString("es-AR")} km`}</p><p className="muted">{cardioPace(c)}{c.rpe !== null && ` · RPE ${c.rpe}`}</p>{c.notes && <p className="cardio-notes">{c.notes}</p>}</div><div className="actions"><Button variant="ghost" size="icon" aria-label={`Editar ${cardioActivities[c.activity]} del ${c.date}`} onClick={() => setEdit(c)}><Pencil size={18}/></Button><Button variant="ghost" size="icon" aria-label={`Eliminar ${cardioActivities[c.activity]} del ${c.date}`} onClick={() => {setError("");setDeleting(c);}}><Trash2 size={18}/></Button></div></article>)}</div>
    {edit && <CardioEditor key={edit.id} initial={edit} onClose={() => setEdit(null)} onSave={async c => {await onSave(c);setEdit(null);}}/>}
    {deleting && <Modal title="Eliminar actividad" description="Se quitará de tu historial y del calendario." onClose={() => {if(!busy)setDeleting(null);}}><p>{cardioActivities[deleting.activity]} · {prettyDate(deleting.date)}</p><Button variant="destructive" disabled={busy} onClick={async () => {setBusy(true);try {await onSave(deleting,true);setDeleting(null);} catch {setError("No pudimos eliminar la actividad. Intentá nuevamente.");}finally{setBusy(false);}}}>Eliminar actividad</Button>{error && <p role="alert">{error}</p>}</Modal>}
  </section>;
}
function CardioEditor({initial,onSave,onClose}:{initial:Cardio;onSave:(c:Cardio)=>Promise<void>;onClose:()=>void}) {
  const [activity,setActivity]=useState(initial.activity), [date,setDate]=useState(initial.date);
  const [distance,setDistance]=useState(initial.distanceKm?.toString() ?? "");
  const [hours,setHours]=useState(String(Math.floor(initial.durationSeconds/3600)));
  const [minutes,setMinutes]=useState(String(Math.floor(initial.durationSeconds/60)%60));
  const [seconds,setSeconds]=useState(String(initial.durationSeconds%60));
  const [rpe,setRpe]=useState(initial.rpe?.toString() ?? ""),[notes,setNotes]=useState(initial.notes);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const number=(v:string)=>Number(v.replace(",","."));
  return <Modal title="Registrar cardio" description="Ingresá el tiempo total. Distancia, esfuerzo y notas son opcionales." onClose={() => {if(!busy)onClose();}}><form className="form-grid" onSubmit={async e => {e.preventDefault();if(busy)return;setError("");const result=cardioSchema.safeParse({...initial,activity,date,distanceKm:distance.trim()?number(distance):null,durationSeconds:Number(hours)*3600+Number(minutes)*60+Number(seconds),rpe:rpe.trim()?number(rpe):null,notes});if(!result.success){setError("Revisá los datos: el tiempo debe ser mayor que cero y la distancia, si la indicás, positiva.");return;}setBusy(true);try{await onSave(result.data);}catch{setError("No pudimos guardar. Tus datos siguen en este formulario.");}finally{setBusy(false);}}}>
    <label>Actividad<select value={activity} disabled={busy} onChange={e=>setActivity(e.target.value as Cardio["activity"])}>{Object.entries(cardioActivities).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>Fecha<input type="date" required max={localDate()} value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>
    <label>Distancia (km, opcional)<input inputMode="decimal" placeholder="Ej. 5,2" value={distance} disabled={busy} onChange={e=>setDistance(e.target.value)}/></label>
    <fieldset className="cardio-time"><legend>Tiempo total</legend><label>Horas<input type="number" min="0" max="168" step="1" required value={hours} disabled={busy} onChange={e=>setHours(e.target.value)}/></label><label>Minutos<input type="number" min="0" max="59" step="1" required value={minutes} disabled={busy} onChange={e=>setMinutes(e.target.value)}/></label><label>Segundos<input type="number" min="0" max="59" step="1" required value={seconds} disabled={busy} onChange={e=>setSeconds(e.target.value)}/></label></fieldset>
    <label>RPE (opcional)<input type="number" min="1" max="10" step="0.5" placeholder="1 a 10" value={rpe} disabled={busy} onChange={e=>setRpe(e.target.value)}/></label>
    <label>Notas<textarea maxLength={4000} value={notes} disabled={busy} onChange={e=>setNotes(e.target.value)}/></label>
    {error && <p role="alert" className="error">{error}</p>}<Button disabled={busy}>{busy?"Guardando…":"Guardar actividad"}</Button>
  </form></Modal>;
}
