export const PALETTES = {
  Fiesta: ["#f97316", "#14b8a6", "#ef4444", "#3b82f6", "#a855f7", "#22c55e", "#ec4899", "#eab308"],
  Océano: ["#0c4a6e", "#0369a1", "#0891b2", "#0f766e", "#075985", "#155e75"],
  Pastel: ["#fecdd3", "#ddd6fe", "#bfdbfe", "#a7f3d0", "#fde68a", "#fed7aa"],
};

export const DEFAULT_GAME = { duracion: 6.2, sonido: true, confeti: true, animaciones: true, retirarGanador: false, volumenGiro: 65, volumenResultado: 85, mantenerResultado: true, ocultarControles: true, mostrarHistorial: true, modoSectores: "iguales", orientacionTexto: "radial" };

export function normalizeGame(value = {}) {
  const duration = Number(value.duracion);
  return {
    duracion: Number.isFinite(duration) ? Math.min(12, Math.max(2, duration)) : DEFAULT_GAME.duracion,
    ...Object.fromEntries(["sonido", "confeti", "animaciones", "retirarGanador", "mantenerResultado", "ocultarControles", "mostrarHistorial"].map(key => [key, typeof value[key] === "boolean" ? value[key] : DEFAULT_GAME[key]])),
    ...Object.fromEntries(["volumenGiro", "volumenResultado"].map(key => [key, Number.isFinite(Number(value[key])) ? Math.min(100, Math.max(0, Number(value[key]))) : DEFAULT_GAME[key]])),
    modoSectores: value.modoSectores === "proporcionales" ? "proporcionales" : "iguales",
    orientacionTexto: value.orientacionTexto === "horizontal" ? "horizontal" : "radial",
  };
}

export function textColor(hex) {
  const channels = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .179 ? "#111111" : "#ffffff";
}

export function parsePrizes(text, min = 4, max = 14) {
  const names = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (names.length < min || names.length > max) throw new Error(`Introduce entre ${min} y ${max} premios, uno por línea.`);
  return names;
}

export function eligiblePrizes(prizes, removed = []) {
  return prizes.map((prize, index) => ({ ...prize, index })).filter(p => !removed.includes(p.index) && Number(p.probabilidad) > 0);
}

export function choosePrize(prizes, random = Math.random()) {
  const total = prizes.reduce((n, p) => n + Math.max(0, Number(p.probabilidad) || 0), 0);
  if (!prizes.length || total <= 0) return null;
  let point = Math.min(Math.max(random, 0), 1 - Number.EPSILON) * total;
  for (const prize of prizes) {
    const weight = Math.max(0, Number(prize.probabilidad) || 0);
    if (point < weight) return prize;
    point -= weight;
  }
  return prizes.at(-1);
}

export function historyReducer(state, action) {
  if (action.type === "undo" && state.past.length) return { past: state.past.slice(0, -1), present: state.past.at(-1), future: [state.present, ...state.future] };
  if (action.type === "redo" && state.future.length) return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  if (action.type === "replace") return { past: state.past, present: typeof action.value === "function" ? action.value(state.present) : action.value, future: state.future };
  if (action.type !== "edit") return state;
  const present = typeof action.value === "function" ? action.value(state.present) : action.value;
  if (present === state.present) return state;
  return { past: [...state.past.slice(-39), state.present], present, future: [] };
}

export const angle = degrees => ((degrees % 360) + 360) % 360;

export function wheelSlices(prizes, mode = "iguales") {
  const total = prizes.reduce((sum, prize) => sum + Math.max(0, Number(prize.probabilidad) || 0), 0);
  const spans = prizes.map(prize => mode === "proporcionales" && total > 0 ? 360 * Math.max(0, Number(prize.probabilidad) || 0) / total : 360 / prizes.length);
  let start = -(spans[0] || 0) / 2;
  return prizes.map((prize, index) => {
    const slice = { ...prize, index, start, end: start + spans[index], span: spans[index], center: start + spans[index] / 2 };
    start = slice.end;
    return slice;
  });
}

export function wheelBackground(prizes, mode = "iguales") {
  const slices = wheelSlices(prizes, mode);
  if (!slices.length) return "#333333";
  const origin = slices[0].start;
  return `conic-gradient(from ${origin}deg, ${slices.map(slice => `${slice.color} ${slice.start - origin}deg ${slice.end - origin}deg`).join(", ")})`;
}

export function sliceAtPointer(slices, rotation) {
  const pointer = angle(-rotation);
  return slices.find(slice => slice.span > 0 && angle(pointer - slice.start) < slice.span)?.index ?? null;
}

export function effectiveProbabilities(prizes, removed = []) {
  const available = eligiblePrizes(prizes, removed);
  const total = available.reduce((sum, p) => sum + Number(p.probabilidad), 0);
  return prizes.map((prize, index) => ({ ...prize, index, effective: total && available.some(p => p.index === index) ? Number(prize.probabilidad) / total * 100 : 0 }));
}

export function validateWheelImport(value) {
  const wheel = value?.version === 1 && value?.wheel ? value.wheel : value;
  if (!wheel || typeof wheel !== "object" || Array.isArray(wheel) || !Array.isArray(wheel.gajos) || wheel.gajos.length < 4 || wheel.gajos.length > 14 || !wheel.gajos.every(gajo => typeof gajo === "string" || (gajo && typeof gajo === "object" && !Array.isArray(gajo) && typeof gajo.texto === "string"))) {
    throw new Error("El archivo no contiene una ruleta válida con entre 4 y 14 premios.");
  }
  return wheel;
}
