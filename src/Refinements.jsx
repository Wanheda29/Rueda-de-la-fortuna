import React, { useEffect, useRef, useState } from "react";
import { effectiveProbabilities, wheelBackground } from "./features.mjs";

export function ProbabilityInfo({ prizes, removed = [], mode }) {
  const values = effectiveProbabilities(prizes, removed);
  return <details className="probability-info"><summary>Probabilidades actuales</summary>
    <p>{mode === "proporcionales" ? "El tamaño de cada sector representa su probabilidad original." : "Los sectores tienen el mismo tamaño; la probabilidad se configura por separado."} Al retirar premios, las posibilidades se reparten entre los que siguen en juego.</p>
    <table><caption className="sr-only">Probabilidades configuradas y efectivas para la siguiente tirada</caption><thead><tr><th>Premio</th><th>Original</th><th>Próxima tirada</th></tr></thead><tbody>{values.map(p => <tr key={p.index}><th scope="row">{p.texto || "Sin texto"}</th><td>{Number(p.probabilidad).toFixed(1)}%</td><td>{p.effective > 0 && p.effective < .1 ? "<0,1" : p.effective.toFixed(1)}%</td></tr>)}</tbody></table>
    {!values.some(p => p.effective > 0) && <p>No hay premios disponibles para la siguiente tirada.</p>}
  </details>;
}

function Thumbnail({ wheel }) {
  return <div className="saved-thumbnail" aria-hidden="true" style={{ background: wheelBackground(wheel.gajos, wheel.juego?.modoSectores) }}><span>{wheel.centro?.imagen ? <img src={wheel.centro.imagen} alt="" /> : (wheel.centro?.texto || "●").slice(0, 5)}</span></div>;
}

export function SavedLibrary({ wheels, onLoad, onDuplicate, onDelete, onImport }) {
  const [sort, setSort] = useState("fecha");
  const [query, setQuery] = useState("");
  const ordered = wheels.filter(wheel => wheel.nombre.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))).sort((a, b) => sort === "nombre" ? a.nombre.localeCompare(b.nombre, "es", { numeric: true }) : (Date.parse(b.guardadaEn) || 0) - (Date.parse(a.guardadaEn) || 0));
  return <section className="saved-panel" aria-label="Ruletas guardadas">
    <div className="section-heading"><h2>Tu biblioteca</h2><label className="import-wheel-button">Importar copia JSON<input type="file" accept=".json,application/json" onChange={onImport} /></label></div>
    {wheels.length > 0 && <div className="library-filters"><label>Buscar ruleta<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre de la ruleta" /></label><label>Ordenar por<select value={sort} onChange={e => setSort(e.target.value)}><option value="fecha">Más recientes</option><option value="nombre">Nombre</option></select></label></div>}
    <div className="saved-list">{ordered.map(wheel => <article className="library-card" key={wheel.id} aria-label={wheel.nombre}>
      <Thumbnail wheel={wheel} /><div className="library-info"><h3>{wheel.nombre}</h3><p>{wheel.gajos.length} gajos{Number.isFinite(Date.parse(wheel.guardadaEn)) ? ` · ${new Date(wheel.guardadaEn).toLocaleDateString("es-UY")}` : ""}</p></div>
      <div className="library-actions"><button className="secondary-button" type="button" onClick={() => onLoad(wheel)}>Cargar</button><button className="ghost-button" type="button" onClick={() => onDuplicate(wheel)}>Duplicar versión</button><button className="ghost-button" type="button" onClick={() => onDelete(wheel.id)}>Eliminar</button></div>
    </article>)}</div>
    {!ordered.length && <div className="saved-empty"><strong>{wheels.length ? "No encontramos esa ruleta" : "Tu próxima ruleta empieza aquí"}</strong><p>{wheels.length ? "Prueba con otro nombre." : "Guarda una versión o importa una copia JSON para empezar tu biblioteca."}</p></div>}
  </section>;
}

export function WinnerCard({ result, onClose, onSpin, canSpin, persistent }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [result.id]);
  useEffect(() => {
    if (persistent) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [persistent, result.id, onClose]);
  return <dialog ref={ref} className="winner-card" aria-labelledby="winner-title" aria-describedby="winner-prize" onCancel={event => { event.preventDefault(); onClose(); }} style={{ "--result-color": result.color }}>
    <span className="winner-kicker">Resultado de la tirada</span>
    <h2 id="winner-title">{result.mensajeResultado || "Resultado"}</h2>
    <p id="winner-prize">{result.texto || "Gajo sin texto"}</p>
    <div className="winner-card-actions"><button className="spin-button" type="button" disabled={!canSpin} onClick={() => { onClose(); onSpin(); }}>Volver a girar</button><button className="secondary-button" type="button" onClick={onClose} autoFocus>Cerrar</button></div>
    {!canSpin && <p className="winner-help">Se agotaron los premios. Cierra y reinicia la sesión para volver a jugar.</p>}
  </dialog>;
}

export function PresentationControls({ children, autoHide, spinning, resultOpen }) {
  const [hidden, setHidden] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    function wake() {
      setHidden(false);
      clearTimeout(timer.current);
      if (autoHide && !resultOpen) timer.current = setTimeout(() => setHidden(true), 2500);
    }
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("focusin", wake);
    return () => { clearTimeout(timer.current); ["pointermove", "pointerdown", "keydown", "focusin"].forEach(type => window.removeEventListener(type, wake)); };
  }, [autoHide, spinning, resultOpen]);
  return <div className="controls-shell">
    <header className={`play-header presentation-controls${hidden ? " controls-hidden" : ""}`} onFocusCapture={() => setHidden(false)}>{children}</header>
    {hidden && <button type="button" className="show-controls" onClick={() => setHidden(false)}>Mostrar controles</button>}
  </div>;
}

export function SoundLevels({ value, onChange }) {
  return <details className="sound-levels"><summary>Volumen</summary><div>{[["volumenGiro", "Volumen del giro"], ["volumenResultado", "Volumen del resultado"]].map(([key, label]) => <label key={key}>{label}: {value[key]}%<input type="range" min="0" max="100" value={value[key]} onChange={e => onChange(key, Number(e.target.value))} /></label>)}</div></details>;
}
