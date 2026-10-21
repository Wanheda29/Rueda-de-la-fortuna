import React, { useEffect, useRef, useState } from "react";
import { wheelSlices } from "./features.mjs";

const polar = (radius, degrees) => ({ x: 500 + radius * Math.sin(degrees * Math.PI / 180), y: 500 - radius * Math.cos(degrees * Math.PI / 180) });

export function sectorPath(start, span, radius = 498) {
  const a = polar(radius, start);
  if (span >= 359.999) return `M 500 500 L ${a.x} ${a.y} A ${radius} ${radius} 0 1 1 ${1000 - a.x} ${1000 - a.y} A ${radius} ${radius} 0 1 1 ${a.x} ${a.y} Z`;
  const b = polar(radius, start + span);
  return `M 500 500 L ${a.x} ${a.y} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
}

function wrap(text, width, measure) {
  const lines = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    if (measure(`${line} ${word}`.trim()) <= width) { line = `${line} ${word}`.trim(); continue; }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (line && measure(line + character) > width) { lines.push(line); line = ""; }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function labelLayout(text, width, height, target, context, maxLines) {
  let lines = [], size = target;
  for (; size >= 8; size -= .5) {
    context.font = `800 ${size}px Arial`;
    lines = wrap(text, width, value => context.measureText(value).width);
    if (lines.length <= maxLines && lines.length * size * 1.15 <= height) return { lines, size };
  }
  size = 8;
  context.font = `800 ${size}px Arial`;
  const count = Math.max(1, Math.min(maxLines, Math.floor(height / (size * 1.15))));
  const clipped = lines.slice(0, count);
  if (lines.length > count) {
    let last = clipped.at(-1) || "";
    while (last && context.measureText(last + "…").width > width) last = last.slice(0, -1);
    clipped[count - 1] = last + "…";
  }
  return { lines: clipped, size };
}

export function WheelFace({ wheel, winnerIndex }) {
  const ref = useRef(null);
  const [size, setSize] = useState(500);
  const contextRef = useRef(null);
  if (!contextRef.current) contextRef.current = document.createElement("canvas").getContext("2d");
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setSize(entry.contentRect.width); });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const slices = wheelSlices(wheel.gajos, wheel.juego.modoSectores);
  const inner = Math.max(170, Math.min(400, (Math.min(116, Math.max(86, (size + 20) * .22)) / 2 + 10) / size * 1000));
  const radius = (inner + 450) / 2;
  return <svg ref={ref} className="wheel-face" viewBox="0 0 1000 1000" role="img" aria-label="Premios de la ruleta">
    {slices.filter(s => s.span > 0).map(slice => {
      const point = polar(495, slice.start);
      const horizontal = wheel.juego.orientacionTexto === "horizontal";
      const cross = Math.max(8, Math.min(180, 2 * inner * Math.sin(Math.min(slice.span, 170) * Math.PI / 360) - 20));
      const width = (horizontal ? Math.max(10, Math.min(460, 2 * radius * Math.sin(Math.min(slice.span, 120) * Math.PI / 360) - 26)) : 450 - inner) * size / 1000;
      const height = (horizontal ? 450 - inner : cross) * size / 1000;
      const text = slice.texto || "Sin texto";
      const layout = labelLayout(text, width, height, Math.min(slice.tamanoTexto || 15, size * .05), contextRef.current, horizontal ? 3 : 2);
      const highlight = Number.isInteger(winnerIndex);
      return <g key={slice.index} data-slice-index={slice.index} className={highlight && winnerIndex === slice.index ? "winning-slice" : undefined}>
        <title>{text}</title>
        <path className="slice-hit-area" d={sectorPath(slice.start, slice.span)} fill={highlight ? (winnerIndex === slice.index ? "#ffffff18" : "#00000066") : "transparent"} />
        {highlight && winnerIndex === slice.index && <path className="winner-outline" d={sectorPath(slice.start, slice.span, 488)} fill="none" stroke="#fff1a4" strokeWidth="12" />}
        <line x1="500" y1="500" x2={point.x} y2={point.y} stroke="#ffffffaa" strokeWidth="3" />
        {slice.span >= 7 && width >= 12 && <g transform={`rotate(${slice.center} 500 500)`}>
          <text className="wheel-label" x="500" y={500 - radius} textAnchor="middle" fill={slice.colorTexto} fontSize={layout.size * 1000 / size} transform={horizontal ? undefined : `rotate(90 500 ${500 - radius})`}>
            {layout.lines.map((line, i) => <tspan key={i} x="500" dy={i === 0 ? `${-(layout.lines.length - 1) * .575 + .34}em` : "1.15em"}>{line}</tspan>)}
          </text>
        </g>}
      </g>;
    })}
  </svg>;
}
