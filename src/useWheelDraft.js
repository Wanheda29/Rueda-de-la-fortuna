import { useEffect, useReducer, useState } from "react";
import { historyReducer } from "./features.mjs";

const DRAFT_KEY = "ruleta-borrador-v1";

export function useWheelDraft(initial, normalize) {
  const [history, dispatch] = useReducer(historyReducer, null, () => {
    let present = initial;
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (saved?.version === 1 && saved.wheel) present = normalize(saved.wheel);
    } catch { /* A damaged draft must not stop the editor. */ }
    return { past: [], present, future: [] };
  });
  const [saveState, setSaveState] = useState("Guardando borrador…");

  useEffect(() => {
    setSaveState("Guardando borrador…");
    function save() {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, wheel: history.present }));
        setSaveState("Borrador guardado en este dispositivo");
      } catch {
        setSaveState("No se pudo guardar el borrador. Exporta una copia para conservar los cambios.");
      }
    }
    const timer = setTimeout(save, 300);
    const onVisibility = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", onVisibility); };
  }, [history.present]);

  return {
    wheel: history.present,
    setWheel: value => dispatch({ type: "edit", value }),
    replaceWheel: value => dispatch({ type: "replace", value }),
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    saveState,
  };
}
