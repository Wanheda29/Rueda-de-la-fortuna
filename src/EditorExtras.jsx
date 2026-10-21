import React, { useState } from "react";
import { PALETTES, parsePrizes } from "./features.mjs";
import { SoundLevels } from "./Refinements";

export function QuickPrizes({ onPalette, onImport }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return <div className="quick-prizes">
    <div className="palette-row" aria-label="Paletas de colores">
      <span>Colores</span>
      {Object.entries(PALETTES).map(([name, colors]) => <button type="button" key={name} className="palette-button" onClick={() => onPalette(colors)}>
        <span className="palette-swatches" aria-hidden="true">{colors.slice(0, 4).map(color => <i key={color} style={{ background: color }} />)}</span>{name}
      </button>)}
    </div>
    <button type="button" className="ghost-button" aria-expanded={open} onClick={() => setOpen(!open)}>Pegar una lista de premios</button>
    {open && <div className="bulk-editor">
      <label>Un premio por línea (entre 4 y 14)<textarea rows="6" value={text} onChange={e => { setText(e.target.value); setError(""); }} placeholder={"Premio 1\nPremio 2\nPremio 3\nPremio 4"} /></label>
      <p>Reemplaza los gajos actuales con probabilidades iguales. Puedes deshacerlo.</p>
      {error && <p role="alert" className="online-message error">{error}</p>}
      <button type="button" className="secondary-button" onClick={() => {
        try { onImport(parsePrizes(text)); setOpen(false); setText(""); } catch (err) { setError(err.message); }
      }}>Aplicar lista</button>
    </div>}
  </div>;
}

export function GameSettings({ value, onChange, reducedMotion }) {
  return <div className="background-editor game-settings">
    <h2>Presentación y sorteo</h2>
    <label>Lectura de los premios<select value={value.orientacionTexto} onChange={e => onChange("orientacionTexto", e.target.value)}><option value="radial">Radial</option><option value="horizontal">Horizontal</option></select></label>
    <label>Tamaño de los sectores<select value={value.modoSectores} onChange={e => onChange("modoSectores", e.target.value)}><option value="iguales">Iguales, con probabilidades independientes</option><option value="proporcionales">Proporcionales a la probabilidad</option></select></label>
    <p>En modo proporcional, un premio con probabilidad cero no ocupa espacio. Puedes consultar todos los premios en la lista de probabilidades.</p>
    <label>Duración del giro: {value.duracion.toFixed(1)} s
      <input type="range" min="2" max="12" step="0.2" value={value.duracion} onChange={e => onChange("duracion", Number(e.target.value))} />
    </label>
    {[["sonido", "Reproducir sonidos"], ["confeti", "Celebrar con confeti"], ["animaciones", "Animar la rueda"], ["retirarGanador", "Retirar al ganador después de cada tirada"], ["mantenerResultado", "Mantener el resultado hasta que lo cierre"], ["ocultarControles", "Ocultar controles al dejar de interactuar"]].map(([key, label]) => <label key={key} className="check-field"><input type="checkbox" checked={value[key]} onChange={e => onChange(key, e.target.checked)} />{label}</label>)}
    <SoundLevels value={value} onChange={onChange} />
    <label className="check-field"><input type="checkbox" checked={value.mostrarHistorial} onChange={e => onChange("mostrarHistorial", e.target.checked)} />Mostrar historial de tiradas</label>
    <p>Retirar al ganador evita repeticiones durante la sesión; conserva todos los gajos de tu diseño.</p>
    {reducedMotion && <p>Tu dispositivo solicita movimiento reducido. Las animaciones y el confeti permanecerán desactivados.</p>}
  </div>;
}

export function CenterImageSettings({ center, onChange }) {
  return <div className="image-fit-settings">
    <label>Cómo mostrar el logo<select value={center.ajusteImagen} onChange={e => onChange("ajusteImagen", e.target.value)}>
      <option value="cover">Rellenar el círculo</option><option value="contain">Mostrar completo</option>
    </select></label>
    {[["posicionX", "Posición horizontal"], ["posicionY", "Posición vertical"]].map(([key, title]) => <label key={key}>{title}: {center[key]}%
      <input type="range" min="0" max="100" value={center[key]} disabled={!center.imagen} onChange={e => onChange(key, Number(e.target.value))} />
    </label>)}
    <button type="button" className="ghost-button" disabled={!center.imagen} onClick={() => { onChange("posicionX", 50); onChange("posicionY", 50); }}>Centrar imagen</button>
  </div>;
}

export function ResultHistory({ results, onReset, removedCount }) {
  return <details className="result-history">
    <summary>Historial de tiradas <span>{results.length}</span></summary>
    {results.length ? <ol>{results.map((result, index) => <li key={result.id}>
      <i style={{ background: result.color }} aria-hidden="true" /><span>{result.texto || "Sin texto"}</span>
      <time dateTime={result.fecha}>{new Date(result.fecha).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}</time>
    </li>)}</ol> : <p>Los resultados aparecerán aquí.</p>}
    <p>{removedCount ? `${removedCount} gajos retirados en esta sesión.` : "Todos los gajos siguen en juego."}</p>
    <button type="button" className="ghost-button" onClick={onReset} disabled={!results.length && !removedCount}>Reiniciar sesión</button>
  </details>;
}
