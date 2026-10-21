import React, { useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured, secureEditingEnabled } from "./supabaseClient";
import { useWheelDraft } from "./useWheelDraft";
import { DEFAULT_GAME, normalizeGame, textColor, eligiblePrizes, choosePrize, wheelSlices, wheelBackground, sliceAtPointer, validateWheelImport } from "./features.mjs";
import { QuickPrizes, GameSettings, CenterImageSettings, ResultHistory } from "./EditorExtras";
import { WheelFace } from "./WheelFace";
import { ProbabilityInfo, SavedLibrary, WinnerCard, PresentationControls, SoundLevels } from "./Refinements";

const STORAGE_KEY = "ruletas-editables";
const ONLINE_QUERY_PARAM = "ruleta";
const ONLINE_STORAGE_BUCKET = "wheel-images";
const MIN_GAJOS = 4;
const MAX_GAJOS = 14;
const TICK_SOUND_URL = `${import.meta.env.BASE_URL}sounds/tick.m4a`;
const WINNER_SOUND_URL = `${import.meta.env.BASE_URL}sounds/winner.m4a`;
const MIN_TICK_INTERVAL_MS = 45;
const MIN_TICK_SPEED_DEGREES_PER_MS = 0.05;
const coloresConfeti = [
  "#ffcf33",
  "#f97316",
  "#14b8a6",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#22c55e",
  "#ec4899",
];

const coloresSugeridos = [
  "#f97316",
  "#14b8a6",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#22c55e",
  "#ec4899",
  "#facc15",
  "#06b6d4",
  "#84cc16",
  "#fb7185",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
];

const ruletaInicial = {
  nombre: "Ruleta principal",
  mostrarTitulo: true,
  mostrarUltimoResultado: true,
  centro: {
    texto: "Gira",
    imagen: "",
    tamanoImagen: 116,
  },
  fondoJuego: {
    color: "#101010",
    imagen: "",
  },
  logoJuego: {
    imagen: "",
    opacidad: 100,
  },
  juego: DEFAULT_GAME,
  gajos: [
    {
      texto: "100 puntos",
      color: "#f97316",
      colorTexto: "#ffffff",
      tamanoTexto: 15,
      probabilidad: 12.5,
    },
    {
      texto: "Pierde turno",
      color: "#14b8a6",
      colorTexto: "#ffffff",
      tamanoTexto: 14,
      probabilidad: 12.5,
    },
    {
      texto: "Doble premio",
      color: "#ef4444",
      colorTexto: "#ffffff",
      tamanoTexto: 14,
      probabilidad: 12.5,
    },
    {
      texto: "50 puntos",
      color: "#3b82f6",
      colorTexto: "#ffffff",
      tamanoTexto: 15,
      probabilidad: 12.5,
    },
    {
      texto: "Vuelve a girar",
      color: "#a855f7",
      colorTexto: "#ffffff",
      tamanoTexto: 13,
      probabilidad: 12.5,
    },
    {
      texto: "200 puntos",
      color: "#22c55e",
      colorTexto: "#ffffff",
      tamanoTexto: 15,
      probabilidad: 12.5,
    },
    {
      texto: "Reto sorpresa",
      color: "#ec4899",
      colorTexto: "#ffffff",
      tamanoTexto: 13,
      probabilidad: 12.5,
    },
    {
      texto: "Comodin",
      color: "#facc15",
      colorTexto: "#111111",
      tamanoTexto: 15,
      probabilidad: 12.5,
    },
  ],
};

function App() {
  const [vista, setVista] = useState("editor");
  const draft = useWheelDraft(normalizarRuleta(ruletaInicial), normalizarRuleta);
  const { wheel: ruleta, setWheel: setRuleta, replaceWheel: replaceRuleta } = draft;
  const [ruletasGuardadas, setRuletasGuardadas] = useState(() =>
    cargarRuletasGuardadas()
  );
  const [rotacion, setRotacion] = useState(0);
  const [estaGirando, setEstaGirando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null);
  const [animarRuleta, setAnimarRuleta] = useState(true);
  const [confetiId, setConfetiId] = useState(0);
  const [mostrarAnuncioGanador, setMostrarAnuncioGanador] = useState(false);
  const [estadoOnline, setEstadoOnline] = useState({
    estado: "idle",
    mensaje: "",
  });
  const [enlaceCompartido, setEnlaceCompartido] = useState("");
  const ruletaVisualRef = useRef(null);
  const rotacionActualRef = useRef(0);
  const tickFrameRef = useRef(null);
  const ultimoGajoTickRef = useRef(null);
  const ultimoTickTiempoRef = useRef(0);
  const ultimoAnguloTickRef = useRef(0);
  const ultimoFrameTickTiempoRef = useRef(0);
  const audioContextRef = useRef(null);
  const tickBufferRef = useRef(null);
  const tickBufferPromiseRef = useRef(null);
  const giroTimerRef = useRef(null);
  const girandoRef = useRef(false);
  const winnerAudioRef = useRef(null);
  const onlineRequestRef = useRef(0);
  const [historial, setHistorial] = useState([]);
  const [retirados, setRetirados] = useState([]);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [mensajeJuego, setMensajeJuego] = useState("");
  const [movimientoReducido, setMovimientoReducido] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [avisoLocal, setAvisoLocal] = useState("");
  const configJuegoRef = useRef(ruleta.juego);
  configJuegoRef.current = ruleta.juego;
  const gajosDisponibles = eligiblePrizes(ruleta.gajos, ruleta.juego.retirarGanador ? retirados : []);
  const animacionesActivas = ruleta.juego.animaciones && !movimientoReducido;

  const anguloPorGajo = 360 / ruleta.gajos.length;
  const fondoRuleta = wheelBackground(ruleta.gajos, ruleta.juego.modoSectores);
  const fondoModoJuego = crearEstiloFondoJuego(ruleta.fondoJuego);

  useEffect(
    () => () => {
      detenerSonidoGajos();
      window.clearTimeout(giroTimerRef.current);
      winnerAudioRef.current?.pause();
      audioContextRef.current?.close();
    },
    []
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMovimientoReducido(query.matches);
    query.addEventListener("change", update);
    const fullscreen = () => setPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", fullscreen);
    return () => { query.removeEventListener("change", update); document.removeEventListener("fullscreenchange", fullscreen); };
  }, []);

  useEffect(() => {
    if (vista !== "editor") return;
    const keyboard = event => {
      if (!(event.ctrlKey || event.metaKey) || !["z", "y"].includes(event.key.toLowerCase())) return;
      if (event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      limpiarEnlace();
      if (event.key.toLowerCase() === "y" || event.shiftKey) draft.redo(); else draft.undo();
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [vista, draft.undo, draft.redo]);

  useEffect(() => {
    onlineRequestRef.current += 1;
    setEstadoOnline(actual => actual.estado === "loading" ? { estado: "idle", mensaje: "Hay cambios nuevos. Vuelve a guardar online cuando termines." } : actual);
  }, [ruleta]);

  useEffect(() => {
    if (winnerAudioRef.current) winnerAudioRef.current.volume = ruleta.juego.sonido ? ruleta.juego.volumenResultado / 100 : 0;
  }, [ruleta.juego.sonido, ruleta.juego.volumenResultado]);

  useEffect(() => {
    if (ruleta.juego.sonido && girandoRef.current && animacionesActivas) iniciarSonidoGajos();
  }, [ruleta.juego.sonido]);

  useEffect(() => {
    // A changed design starts a fresh draw pool; retiring winners never edits the design.
    setRetirados([]);
    setHistorial([]);
    setUltimoResultado(null);
    setMostrarAnuncioGanador(false);
  }, [ruleta.gajos]);

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);
    const idRuletaOnline = parametros.get(ONLINE_QUERY_PARAM);

    if (!idRuletaOnline) return;

    cargarRuletaOnline(idRuletaOnline);
  }, []);

  useEffect(() => {
    if (vista !== "juego") return;

    function manejarTecla(event) {
      const elementoActivo = document.activeElement;
      const estaEscribiendo =
        elementoActivo?.tagName === "INPUT" ||
        elementoActivo?.tagName === "TEXTAREA" ||
        elementoActivo?.tagName === "SELECT";

      if (event.code === "Space" && !event.repeat && !estaEscribiendo && elementoActivo?.tagName !== "BUTTON") {
        event.preventDefault();
        girarRuleta();
      }
    }

    window.addEventListener("keydown", manejarTecla);

    return () => window.removeEventListener("keydown", manejarTecla);
  }, [vista, estaGirando, ruleta]);

  useEffect(() => {
    const debeGirarLento =
      vista === "editor" ||
      (vista === "juego" && !estaGirando && !ultimoResultado);
    if (!debeGirarLento || !animacionesActivas) return undefined;

    let frameId;
    let tiempoAnterior;
    const gradosPorMilisegundo = 360 / 90000;

    function animar(tiempoActual) {
      if (!ruletaVisualRef.current) return;

      if (tiempoAnterior === undefined) {
        tiempoAnterior = tiempoActual;
      }

      const diferencia = tiempoActual - tiempoAnterior;
      tiempoAnterior = tiempoActual;

      rotacionActualRef.current = normalizarAngulo(
        rotacionActualRef.current + diferencia * gradosPorMilisegundo
      );
      ruletaVisualRef.current.style.transform = `rotate(${rotacionActualRef.current}deg)`;

      frameId = window.requestAnimationFrame(animar);
    }

    frameId = window.requestAnimationFrame(animar);

    return () => window.cancelAnimationFrame(frameId);
  }, [vista, estaGirando, ultimoResultado, animacionesActivas]);

  function actualizarGajo(index, propiedad, valor) {
    setRuleta((ruletaActual) => ({
      ...ruletaActual,
      gajos:
        propiedad === "probabilidad"
          ? ajustarProbabilidades(ruletaActual.gajos, index, valor)
          : ruletaActual.gajos.map((gajo, gajoIndex) =>
              gajoIndex === index ? { ...gajo, [propiedad]: valor } : gajo
            ),
    }));
  }

  function agregarGajo() {
    setRuleta((ruletaActual) => {
      if (ruletaActual.gajos.length >= MAX_GAJOS) return ruletaActual;

      const nuevoIndice = ruletaActual.gajos.length;
      const nuevoGajo = crearGajoNuevo(nuevoIndice);

      return {
        ...ruletaActual,
        gajos: repartirProbabilidadesIguales([
          ...ruletaActual.gajos,
          nuevoGajo,
        ]),
      };
    });
    resetearTirada();
  }

  function eliminarGajo(index) {
    setRuleta((ruletaActual) => {
      if (ruletaActual.gajos.length <= MIN_GAJOS) return ruletaActual;

      return {
        ...ruletaActual,
        gajos: repartirProbabilidadesIguales(
          ruletaActual.gajos.filter((_, gajoIndex) => gajoIndex !== index)
        ),
      };
    });
    resetearTirada();
  }

  function actualizarCentro(propiedad, valor) {
    setRuleta((ruletaActual) => ({
      ...ruletaActual,
      centro: {
        ...ruletaActual.centro,
        [propiedad]: valor,
      },
    }));
  }

  function duplicarGajo(index) {
    setRuleta(actual => {
      if (actual.gajos.length >= MAX_GAJOS) return actual;
      const gajos = [...actual.gajos];
      gajos.splice(index + 1, 0, { ...gajos[index] });
      return { ...actual, gajos: repartirProbabilidadesIguales(gajos) };
    });
  }

  function moverGajo(index, direction) {
    setRuleta(actual => {
      const next = index + direction;
      if (next < 0 || next >= actual.gajos.length) return actual;
      const gajos = [...actual.gajos];
      [gajos[index], gajos[next]] = [gajos[next], gajos[index]];
      return { ...actual, gajos };
    });
  }

  function aplicarPaleta(colors) {
    setRuleta(actual => ({ ...actual, gajos: actual.gajos.map((gajo, i) => ({ ...gajo, color: colors[i % colors.length], colorTexto: textColor(colors[i % colors.length]) })) }));
  }

  function importarPremios(names) {
    setRuleta(actual => ({ ...actual, gajos: repartirProbabilidadesIguales(names.map((texto, i) => ({ ...crearGajoNuevo(i), texto }))) }));
  }

  function actualizarJuego(propiedad, valor) {
    setRuleta(actual => ({ ...actual, juego: { ...actual.juego, [propiedad]: valor } }));
    if (propiedad === "sonido" && !valor) detenerSonidoGajos();
  }

  function reiniciarSesion() {
    resetearTirada();
    setRetirados([]);
    setHistorial([]);
  }

  async function alternarPantallaCompleta() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setMensajeJuego("");
    } catch { setMensajeJuego("El navegador no permite pantalla completa aquí. Puedes usar F11."); }
  }

  function limpiarEnlace() {
    onlineRequestRef.current += 1;
    setEnlaceCompartido("");
    setEstadoOnline({ estado: "idle", mensaje: "" });
    const url = new URL(window.location.href);
    url.searchParams.delete(ONLINE_QUERY_PARAM);
    window.history.replaceState(null, "", url);
  }

  function exportarRuleta() {
    const blob = new Blob([JSON.stringify(ruleta, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(ruleta.nombre || "ruleta").replace(/[^\p{L}\p{N}_-]/gu, "-")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function duplicarVersion(source) {
    const copy = normalizarRuleta({ ...source, id: crearId(), nombre: `${source.nombre} (copia)`, guardadaEn: new Date().toISOString() });
    const next = [copy, ...ruletasGuardadas];
    setRuletasGuardadas(next);
    setAvisoLocal(guardarEnStorage(next) ? "Versión duplicada en tu biblioteca." : "No se pudo guardar la copia. Exporta la ruleta para conservarla.");
  }

  async function importarArchivo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("La copia es demasiado grande. Usa un archivo de hasta 8 MB.");
      const imported = validateWheelImport(JSON.parse(await file.text()));
      const copy = normalizarRuleta({ ...imported, id: crearId(), guardadaEn: new Date().toISOString() });
      limpiarEnlace();
      resetearTirada();
      setRuleta(copy);
      guardarRuletaLocal(copy);
      setAvisoLocal(actual => actual.startsWith("No se pudo") ? actual : "Copia importada en tu biblioteca. Puedes deshacer el cambio de diseño.");
    } catch (error) { setAvisoLocal(error instanceof SyntaxError ? "El archivo no contiene JSON válido." : error.message); }
  }

  function actualizarFondoJuego(propiedad, valor) {
    setRuleta((ruletaActual) => ({
      ...ruletaActual,
      fondoJuego: {
        ...ruletaActual.fondoJuego,
        [propiedad]: valor,
      },
    }));
  }

  function actualizarLogoJuego(propiedad, valor) {
    setRuleta((ruletaActual) => ({
      ...ruletaActual,
      logoJuego: {
        ...ruletaActual.logoJuego,
        [propiedad]: valor,
      },
    }));
  }

  function actualizarNombre(nombre) {
    setRuleta((ruletaActual) => ({
      ...ruletaActual,
      nombre,
    }));
  }

  function actualizarMostrarTitulo(mostrarTitulo) {
    setRuleta((ruletaActual) => ({
      ...ruletaActual,
      mostrarTitulo,
    }));
  }

  function actualizarMostrarUltimoResultado(mostrarUltimoResultado) {
    setRuleta((ruletaActual) => ({
      ...ruletaActual,
      mostrarUltimoResultado,
    }));
  }

  function cargarImagenCentro(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();

    lector.onload = () => {
      actualizarCentro("imagen", String(lector.result));
      actualizarCentro("tamanoImagen", 116);
    };

    lector.readAsDataURL(archivo);
  }

  function cargarImagenFondoJuego(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();

    lector.onload = () => {
      actualizarFondoJuego("imagen", String(lector.result));
    };

    lector.readAsDataURL(archivo);
  }

  function cargarImagenLogoJuego(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();

    lector.onload = () => {
      actualizarLogoJuego("imagen", String(lector.result));
    };

    lector.readAsDataURL(archivo);
  }

  function guardarRuleta() {
    const ruletaNormalizada = normalizarRuleta(ruleta);
    const ruletaParaGuardar = {
      ...ruletaNormalizada,
      id: ruletaNormalizada.id || crearId(),
      nombre: ruletaNormalizada.nombre.trim() || "Ruleta sin nombre",
      guardadaEn: new Date().toISOString(),
    };

    guardarRuletaLocal(ruletaParaGuardar);
  }

  function guardarRuletaLocal(ruletaParaGuardar) {
    const siguientesRuletas = [
      ruletaParaGuardar,
      ...ruletasGuardadas.filter((item) => item.id !== ruletaParaGuardar.id),
    ];

    replaceRuleta(ruletaParaGuardar);
    setRuletasGuardadas(siguientesRuletas);
    setAvisoLocal(guardarEnStorage(siguientesRuletas) ? "Ruleta guardada en este dispositivo." : "No se pudo guardar. Exporta una copia de la ruleta.");
  }

  async function guardarRuletaOnline() {
    if (!supabaseConfigured) {
      setEstadoOnline({
        estado: "error",
        mensaje: "Configura Supabase para guardar ruletas online.",
      });
      return;
    }

    const ruletaNormalizada = normalizarRuleta(ruleta);
    let id = ruletaNormalizada.id || crearId();
    const nombre = ruletaNormalizada.nombre.trim() || "Ruleta sin nombre";
    const requestId = ++onlineRequestRef.current;

    setEstadoOnline({
      estado: "loading",
      mensaje: "Guardando ruleta online...",
    });

    try {
      let ownerId = null;
      let guardarComoCopia = false;
      if (secureEditingEnabled) {
        ownerId = await obtenerUsuarioEditor();
        const { data: existente, error: consultaError } = await supabase.from("wheels").select("owner_id").eq("id", id).maybeSingle();
        if (consultaError) throw consultaError;
        guardarComoCopia = Boolean(existente && existente.owner_id !== ownerId);
        if (guardarComoCopia) id = crearId();
      }
      if (requestId !== onlineRequestRef.current) return;
      const configOnline = await prepararRuletaOnline(
        {
          ...ruletaNormalizada,
          id,
          nombre,
        },
        ownerId ? `${ownerId}/${id}` : id
      );

      if (requestId !== onlineRequestRef.current) return;

      const { error } = await supabase.from("wheels").upsert({
        id,
        name: nombre,
        ...(ownerId ? { owner_id: ownerId } : {}),
        config_json: configOnline,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }
      if (requestId !== onlineRequestRef.current) return;

      const enlace = crearEnlaceCompartido(id);
      const ruletaGuardada = {
        ...ruletaNormalizada,
        id,
        nombre,
        guardadaEn: new Date().toISOString(),
      };

      replaceRuleta(ruletaGuardada);
      setEnlaceCompartido(enlace);
      guardarRuletaLocal(ruletaGuardada);
      window.history.replaceState(null, "", enlace);
      setEstadoOnline({
        estado: "success",
        mensaje: guardarComoCopia ? "Se guardó una copia propia. La ruleta compartida conserva su enlace original." : "Ruleta guardada online. El enlace ya está listo.",
      });
    } catch (error) {
      if (requestId !== onlineRequestRef.current) return;
      setEstadoOnline({
        estado: "error",
        mensaje: `No se pudo guardar online: ${error.message}`,
      });
    }
  }

  async function cargarRuletaOnline(id) {
    const requestId = ++onlineRequestRef.current;
    if (!supabaseConfigured) {
      setEstadoOnline({
        estado: "error",
        mensaje: "Falta configurar Supabase para abrir este enlace.",
      });
      return;
    }

    setEstadoOnline({
      estado: "loading",
      mensaje: "Cargando ruleta compartida...",
    });

    try {
      const { data, error } = await supabase
        .from("wheels")
        .select("config_json")
        .eq("id", id)
        .single();

      if (error) {
        throw error;
      }
      if (requestId !== onlineRequestRef.current) return;

      const ruletaOnline = normalizarRuleta({
        ...data.config_json,
        id,
      });

      setRuleta(ruletaOnline);
      guardarRuletaLocal(ruletaOnline);
      setUltimoResultado(null);
      resetearTirada();
      setEnlaceCompartido(crearEnlaceCompartido(id));
      setVista("editor");
      setEstadoOnline({
        estado: "success",
        mensaje: "Ruleta compartida cargada correctamente.",
      });
    } catch (error) {
      if (requestId !== onlineRequestRef.current) return;
      setEstadoOnline({
        estado: "error",
        mensaje: `No se pudo cargar la ruleta: ${error.message}`,
      });
    }
  }

  async function copiarEnlaceCompartido() {
    if (!enlaceCompartido) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(enlaceCompartido);
      else { window.prompt("Copia este enlace:", enlaceCompartido); return; }
      setEstadoOnline({ estado: "success", mensaje: "Enlace copiado." });
    } catch { setEstadoOnline({ estado: "error", mensaje: "No se pudo copiar. Selecciona el enlace y cópialo manualmente." }); }
  }

  function crearNuevaRuleta() {
    limpiarEnlace();
    const siguienteNumero = ruletasGuardadas.length + 1;
    setRuleta(
      normalizarRuleta({
        ...ruletaInicial,
        nombre: `Ruleta ${siguienteNumero}`,
      })
    );
    setUltimoResultado(null);
    resetearTirada();
  }

  function cargarRuletaGuardada(ruletaGuardada) {
    limpiarEnlace();
    setRuleta(normalizarRuleta(ruletaGuardada));
    resetearTirada();
  }

  function eliminarRuletaGuardada(id) {
    const siguientesRuletas = ruletasGuardadas.filter((item) => item.id !== id);
    setRuletasGuardadas(siguientesRuletas);
    guardarEnStorage(siguientesRuletas);
  }

  function abrirJuego() {
    resetearTirada();
    setVista("juego");
  }

  function volverAlEditor() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    resetearTirada();
    setVista("editor");
  }

  function resetearTirada() {
    window.clearTimeout(giroTimerRef.current);
    giroTimerRef.current = null;
    girandoRef.current = false;
    winnerAudioRef.current?.pause();
    detenerSonidoGajos();
    setAnimarRuleta(false);
    rotacionActualRef.current = 0;
    setRotacion(0);
    setEstaGirando(false);
    setConfetiId(0);
    setMostrarAnuncioGanador(false);
    setUltimoResultado(null);
    setMensajeJuego("");
  }

  function girarRuleta() {
    if (girandoRef.current) return;
    const gajoGanador = choosePrize(gajosDisponibles);
    if (!gajoGanador) { setMensajeJuego("No quedan premios disponibles. Reinicia la sesión para volver a jugar."); return; }
    girandoRef.current = true;
    const duracion = animacionesActivas ? ruleta.juego.duracion * 1000 : 120;

    prepararSonidoTick();
    setEstaGirando(true);
    setAnimarRuleta(animacionesActivas);
    setMostrarAnuncioGanador(false);
    setUltimoResultado(null);

    const vueltasMinimas = 360 * 5;
    const nuevoIndiceGanador = gajoGanador.index;
    const slice = wheelSlices(ruleta.gajos, ruleta.juego.modoSectores)[nuevoIndiceGanador];
    const margenBorde = slice.span * 0.02;
    const rangoSeguro = slice.span - margenBorde * 2;
    const offsetAleatorio =
      Math.random() * rangoSeguro - rangoSeguro / 2;
    const posicionDentroDelGajo =
      slice.center + offsetAleatorio;
    const anguloObjetivo = normalizarAngulo(360 - posicionDentroDelGajo);
    const resultado = {
      texto: gajoGanador.texto,
      color: gajoGanador.color,
      indice: nuevoIndiceGanador,
      mensajeResultado: gajoGanador.mensajeResultado || "Resultado",
      id: crearId(),
      fecha: new Date().toISOString(),
    };

    setRotacion(() => {
      const anguloActual = normalizarAngulo(rotacionActualRef.current);
      const giroHastaObjetivo = normalizarAngulo(anguloObjetivo - anguloActual);
      const nuevaRotacion =
        rotacionActualRef.current + vueltasMinimas + giroHastaObjetivo;

      rotacionActualRef.current = nuevaRotacion;

      return nuevaRotacion;
    });

    if (animacionesActivas && ruleta.juego.sonido) iniciarSonidoGajos(anguloPorGajo);

    giroTimerRef.current = window.setTimeout(() => {
      giroTimerRef.current = null;
      girandoRef.current = false;
      detenerSonidoGajos();
      reproducirSonidoGanador();
      setUltimoResultado(resultado);
      setEstaGirando(false);
      setHistorial(actual => [resultado, ...actual].slice(0, 100));
      if (ruleta.juego.retirarGanador) setRetirados(actual => [...actual, nuevoIndiceGanador]);
      if (configJuegoRef.current.confeti && !movimientoReducido) setConfetiId((idActual) => idActual + 1);
      setMostrarAnuncioGanador(true);
    }, duracion + (animacionesActivas ? 40 : 0));
  }

  function ocultarAnuncioGanador() {
    setMostrarAnuncioGanador(false);
  }

  function iniciarSonidoGajos() {
    detenerSonidoGajos();
    prepararSonidoTick();

    ultimoGajoTickRef.current = null;
    ultimoTickTiempoRef.current = 0;
    ultimoAnguloTickRef.current = 0;
    ultimoFrameTickTiempoRef.current = 0;

    function revisarGajo(tiempoActual) {
      const anguloVisual = obtenerRotacionVisual(ruletaVisualRef.current);
      const indiceGajo = sliceAtPointer(wheelSlices(ruleta.gajos, ruleta.juego.modoSectores), anguloVisual);
      const tiempoAnterior = ultimoFrameTickTiempoRef.current;
      const anguloAnterior = ultimoAnguloTickRef.current;
      const diferenciaTiempo = tiempoAnterior ? tiempoActual - tiempoAnterior : 0;
      const diferenciaAngulo = tiempoAnterior
        ? normalizarAngulo(anguloVisual - anguloAnterior)
        : 0;
      const velocidadAngular =
        diferenciaTiempo > 0 ? diferenciaAngulo / diferenciaTiempo : 0;

      if (ultimoGajoTickRef.current === null) {
        ultimoGajoTickRef.current = indiceGajo;
      } else if (
        indiceGajo !== ultimoGajoTickRef.current &&
        velocidadAngular >= MIN_TICK_SPEED_DEGREES_PER_MS &&
        tiempoActual - ultimoTickTiempoRef.current >= MIN_TICK_INTERVAL_MS
      ) {
        reproducirTick();
        ultimoGajoTickRef.current = indiceGajo;
        ultimoTickTiempoRef.current = tiempoActual;
      }

      ultimoAnguloTickRef.current = anguloVisual;
      ultimoFrameTickTiempoRef.current = tiempoActual;
      tickFrameRef.current = window.requestAnimationFrame(revisarGajo);
    }

    tickFrameRef.current = window.requestAnimationFrame(revisarGajo);
  }

  function detenerSonidoGajos() {
    if (!tickFrameRef.current) return;

    window.cancelAnimationFrame(tickFrameRef.current);
    tickFrameRef.current = null;
  }

  function reproducirTick() {
    if (!configJuegoRef.current.sonido) return;
    const audioContext = audioContextRef.current;
    const tickBuffer = tickBufferRef.current;

    if (!audioContext || !tickBuffer) return;

    const fuente = audioContext.createBufferSource();
    const volumen = audioContext.createGain();

    fuente.buffer = tickBuffer;
    volumen.gain.value = configJuegoRef.current.volumenGiro / 100;
    fuente.connect(volumen);
    volumen.connect(audioContext.destination);
    fuente.start();
  }

  function reproducirSonidoGanador() {
    if (!configJuegoRef.current.sonido) return;
    const audio = new Audio(WINNER_SOUND_URL);
    winnerAudioRef.current = audio;
    audio.volume = configJuegoRef.current.volumenResultado / 100;
    audio.play().catch(() => {});
  }

  function prepararSonidoTick() {
    if (!configJuegoRef.current.sonido || (!window.AudioContext && !window.webkitAudioContext)) return;
    const audioContext = obtenerAudioContext();

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    if (tickBufferRef.current || tickBufferPromiseRef.current) return;

    tickBufferPromiseRef.current = fetch(TICK_SOUND_URL)
      .then((respuesta) => respuesta.arrayBuffer())
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        tickBufferRef.current = audioBuffer;
      })
      .catch(() => {
        tickBufferPromiseRef.current = null;
      });
  }

  function obtenerAudioContext() {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }

    return audioContextRef.current;
  }

  return (
    <main
      className={vista === "juego" ? "game-shell play-shell" : "game-shell"}
      style={vista === "juego" ? fondoModoJuego : undefined}
    >
      {vista === "editor" ? (
        <EditorRuleta
          ruleta={ruleta}
          ruletasGuardadas={ruletasGuardadas}
          fondoRuleta={fondoRuleta}
          anguloPorGajo={anguloPorGajo}
          rotacion={rotacion}
          ruletaVisualRef={ruletaVisualRef}
          actualizarNombre={actualizarNombre}
          actualizarMostrarTitulo={actualizarMostrarTitulo}
          actualizarMostrarUltimoResultado={actualizarMostrarUltimoResultado}
          actualizarGajo={actualizarGajo}
          agregarGajo={agregarGajo}
          eliminarGajo={eliminarGajo}
          actualizarCentro={actualizarCentro}
          actualizarFondoJuego={actualizarFondoJuego}
          actualizarLogoJuego={actualizarLogoJuego}
          cargarImagenCentro={cargarImagenCentro}
          cargarImagenFondoJuego={cargarImagenFondoJuego}
          cargarImagenLogoJuego={cargarImagenLogoJuego}
          guardarRuleta={guardarRuleta}
          guardarRuletaOnline={guardarRuletaOnline}
          copiarEnlaceCompartido={copiarEnlaceCompartido}
          cargarRuletaGuardada={cargarRuletaGuardada}
          eliminarRuletaGuardada={eliminarRuletaGuardada}
          abrirJuego={abrirJuego}
          crearNuevaRuleta={crearNuevaRuleta}
          estadoOnline={estadoOnline}
          enlaceCompartido={enlaceCompartido}
          supabaseConfigurado={supabaseConfigured}
          herramientas={{ ...draft, avisoLocal, exportarRuleta, duplicarGajo, moverGajo, aplicarPaleta, importarPremios, actualizarJuego, movimientoReducido, duplicarVersion, importarArchivo, retirados: ruleta.juego.retirarGanador ? retirados : [],
            undo: () => { limpiarEnlace(); draft.undo(); }, redo: () => { limpiarEnlace(); draft.redo(); } }}
        />
      ) : (
        <VistaJuego
          ruleta={ruleta}
          fondoRuleta={fondoRuleta}
          anguloPorGajo={anguloPorGajo}
          rotacion={rotacion}
          ruletaVisualRef={ruletaVisualRef}
          estaGirando={estaGirando}
          ultimoResultado={ultimoResultado}
          mostrarAnuncioGanador={mostrarAnuncioGanador}
          confetiId={confetiId}
          animarRuleta={animarRuleta}
          girarRuleta={girarRuleta}
          ocultarAnuncioGanador={ocultarAnuncioGanador}
          volverAlEditor={volverAlEditor}
          historial={historial}
          retirados={retirados}
          disponibles={gajosDisponibles.length}
          reiniciarSesion={reiniciarSesion}
          alternarPantallaCompleta={alternarPantallaCompleta}
          pantallaCompleta={pantallaCompleta}
          mensajeJuego={mensajeJuego}
          actualizarJuego={actualizarJuego}
        />
      )}
    </main>
  );
}

function EditorRuleta({
  ruleta,
  ruletasGuardadas,
  fondoRuleta,
  anguloPorGajo,
  rotacion,
  ruletaVisualRef,
  actualizarNombre,
  actualizarMostrarTitulo,
  actualizarMostrarUltimoResultado,
  actualizarGajo,
  agregarGajo,
  eliminarGajo,
  actualizarCentro,
  actualizarFondoJuego,
  actualizarLogoJuego,
  cargarImagenCentro,
  cargarImagenFondoJuego,
  cargarImagenLogoJuego,
  guardarRuleta,
  guardarRuletaOnline,
  copiarEnlaceCompartido,
  cargarRuletaGuardada,
  eliminarRuletaGuardada,
  abrirJuego,
  crearNuevaRuleta,
  estadoOnline,
  enlaceCompartido,
  supabaseConfigurado,
  herramientas,
}) {
  const [pestana, setPestana] = useState("gajos");
  const [previewOpen, setPreviewOpen] = useState(() => window.matchMedia("(min-width: 981px)").matches);
  const totalProbabilidad = ruleta.gajos.reduce(
    (total, gajo) => total + (Number(gajo.probabilidad) || 0),
    0
  );

  return (
    <section className="creator-layout">
      <div className="creator-header">
        <div>
          <p className="eyebrow">Tu espacio de creación</p>
          <h1>Diseña tu ruleta</h1>
          <p>
            Personaliza los premios, dale tu estilo y empieza a jugar.
          </p>
        </div>

        <div className="creator-actions">
          <button className="secondary-button" type="button" onClick={crearNuevaRuleta}>
            Nueva rueda
          </button>
          <button className="secondary-button" type="button" onClick={guardarRuleta}>
            Guardar ruleta
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={guardarRuletaOnline}
            disabled={estadoOnline.estado === "loading" || !supabaseConfigurado}
          >
            {estadoOnline.estado === "loading" ? "Guardando..." : "Guardar online"}
          </button>
          <button className="spin-button" type="button" onClick={abrirJuego}>
            <span aria-hidden="true">▶</span>
            Jugar
          </button>
        </div>
      </div>


      <div className="draft-toolbar">
        <p role="status">{herramientas.saveState}</p>
        <div>
          <button type="button" className="ghost-button" disabled={!herramientas.canUndo} onClick={herramientas.undo}>Deshacer</button>
          <button type="button" className="ghost-button" disabled={!herramientas.canRedo} onClick={herramientas.redo}>Rehacer</button>
          <button type="button" className="ghost-button" onClick={herramientas.exportarRuleta}>Exportar copia</button>
        </div>
        {herramientas.avisoLocal && <p role="status">{herramientas.avisoLocal}</p>}
      </div>
      <div className="creator-grid">
        <section className="editor-panel" aria-label="Configuración de ruleta">
          <div className="editor-tabs" role="tablist" aria-label="Secciones de configuración">
            {[
              ["gajos", "Gajos"],
              ["apariencia", "Apariencia"],
              ["guardadas", "Guardadas"],
            ].map(([id, etiqueta], index) => (
              <button
                key={id}
                id={`tab-${id}`}
                type="button"
                role="tab"
                aria-selected={pestana === id}
                aria-controls={`panel-${id}`}
                tabIndex={pestana === id ? 0 : -1}
                onClick={() => setPestana(id)}
                onKeyDown={(event) => {
                  const ids = ["gajos", "apariencia", "guardadas"];
                  let siguiente;
                  if (event.key === "ArrowRight") siguiente = (index + 1) % ids.length;
                  if (event.key === "ArrowLeft") siguiente = (index + ids.length - 1) % ids.length;
                  if (event.key === "Home") siguiente = 0;
                  if (event.key === "End") siguiente = ids.length - 1;
                  if (siguiente === undefined) return;
                  event.preventDefault();
                  setPestana(ids[siguiente]);
                  document.getElementById(`tab-${ids[siguiente]}`)?.focus();
                }}
              >
                {etiqueta}
                {id === "gajos" ? <span className="tab-count">{ruleta.gajos.length}</span> : null}
              </button>
            ))}
          </div>

          <div className="editor-section" id="panel-gajos" role="tabpanel" aria-labelledby="tab-gajos" hidden={pestana !== "gajos"}>
          <div className="prize-board" aria-label="Editor de gajos">
            <div className="section-heading">
              <div>
                <h2>Gajos</h2>
                <p>
                  {ruleta.gajos.length} de {MAX_GAJOS} gajos · Total: {totalProbabilidad.toFixed(1)}%
                </p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={agregarGajo}
                disabled={ruleta.gajos.length >= MAX_GAJOS}
              >
                Agregar gajo
              </button>
            </div>
            <p className="probability-hint">Al cambiar una probabilidad, las demás se ajustan para mantener el total en 100%. {ruleta.juego.modoSectores === "proporcionales" ? "Los sectores representan las probabilidades originales." : "Los gajos tienen el mismo tamaño visual."}</p>
            <QuickPrizes onPalette={herramientas.aplicarPaleta} onImport={herramientas.importarPremios} />
            <ProbabilityInfo prizes={ruleta.gajos} removed={herramientas.retirados} mode={ruleta.juego.modoSectores} />
            <div className="prize-list">
              {ruleta.gajos.map((gajo, index) => (
                <EditorGajo
                  gajo={gajo}
                  index={index}
                  key={`editor-${index}`}
                  actualizarGajo={actualizarGajo}
                  eliminarGajo={eliminarGajo}
                  puedeEliminar={ruleta.gajos.length > MIN_GAJOS}
                  duplicarGajo={herramientas.duplicarGajo}
                  moverGajo={herramientas.moverGajo}
                  total={ruleta.gajos.length}
                />
              ))}
            </div>
          </div>

          </div>

          <div className="editor-section" id="panel-apariencia" role="tabpanel" aria-labelledby="tab-apariencia" hidden={pestana !== "apariencia"}>
            <div className="section-intro">
              <h2>Hazla tuya</h2>
              <p>Ajusta el centro y el escenario de tu juego.</p>
            </div>
          <label className="wide-field">
            Nombre de la ruleta
            <input
              type="text"
              value={ruleta.nombre}
              onChange={(event) => actualizarNombre(event.target.value)}
            />
          </label>

          <label className="check-field">
            <input
              type="checkbox"
              checked={ruleta.mostrarTitulo}
              onChange={(event) => actualizarMostrarTitulo(event.target.checked)}
            />
            Mostrar el título en el juego
          </label>

          <label className="check-field">
            <input
              type="checkbox"
              checked={ruleta.mostrarUltimoResultado}
              onChange={(event) =>
                actualizarMostrarUltimoResultado(event.target.checked)
              }
            />
            Mostrar el último resultado
          </label>

          <div className="center-editor">
            <h2>Centro</h2>
            <label>
              Texto central
              <input
                type="text"
                value={ruleta.centro.texto}
                onChange={(event) => actualizarCentro("texto", event.target.value)}
                placeholder="Texto opcional"
              />
            </label>

            <div className="center-actions">
              <label className="file-field">
                Imagen
                <input type="file" accept="image/*" onChange={cargarImagenCentro} />
              </label>
              <button
                className="secondary-button"
                type="button"
                onClick={() => actualizarCentro("imagen", "")}
              >
                Quitar imagen
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => actualizarCentro("texto", "")}
              >
                Quitar texto
              </button>
            </div>

            <label>
              Tamaño de la imagen central: {Math.round(ruleta.centro.tamanoImagen / 116 * 100)}%
              <input
                type="range"
                min="36"
                max="116"
                value={ruleta.centro.tamanoImagen}
                onChange={(event) =>
                  actualizarCentro("tamanoImagen", Number(event.target.value))
                }
              />
            </label>
            <button
              className="secondary-button"
              type="button"
              disabled={!ruleta.centro.imagen}
              onClick={() => actualizarCentro("tamanoImagen", 116)}
            >
              Ocupar todo el centro
            </button>
            <CenterImageSettings center={ruleta.centro} onChange={actualizarCentro} />
          </div>

          <div className="background-editor">
            <h2>Fondo modo juego</h2>
            <label>
              Color de fondo
              <input
                type="color"
                value={ruleta.fondoJuego.color}
                onChange={(event) =>
                  actualizarFondoJuego("color", event.target.value)
                }
              />
            </label>

            <div className="center-actions">
              <label className="file-field">
                Imagen de fondo
                <input
                  type="file"
                  accept="image/*"
                  onChange={cargarImagenFondoJuego}
                />
              </label>
              <button
                className="secondary-button"
                type="button"
                onClick={() => actualizarFondoJuego("imagen", "")}
              >
                Quitar imagen
              </button>
            </div>
          </div>

          <div className="background-editor">
            <h2>Logo modo juego</h2>
            <div className="center-actions">
              <label className="file-field">
                Imagen de logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={cargarImagenLogoJuego}
                />
              </label>
              <button
                className="secondary-button"
                type="button"
                onClick={() => actualizarLogoJuego("imagen", "")}
              >
                Quitar logo
              </button>
            </div>
            <label>
              Opacidad del logo: {ruleta.logoJuego.opacidad}%
              <input
                type="range"
                min="0"
                max="100"
                value={ruleta.logoJuego.opacidad}
                onChange={(event) =>
                  actualizarLogoJuego("opacidad", Number(event.target.value))
                }
              />
            </label>
            {ruleta.logoJuego.imagen ? (
              <div className="logo-editor-preview" aria-hidden="true">
                <img
                  src={ruleta.logoJuego.imagen}
                  alt=""
                  style={{ opacity: ruleta.logoJuego.opacidad / 100 }}
                />
              </div>
            ) : null}
          </div>


            <GameSettings value={ruleta.juego} onChange={herramientas.actualizarJuego} reducedMotion={herramientas.movimientoReducido} />

          </div>

          <div className="editor-section" id="panel-guardadas" role="tabpanel" aria-labelledby="tab-guardadas" hidden={pestana !== "guardadas"}>
          <SavedLibrary wheels={ruletasGuardadas} onLoad={cargarRuletaGuardada} onDelete={eliminarRuletaGuardada} onDuplicate={herramientas.duplicarVersion} onImport={herramientas.importarArchivo} />

          <div className="online-panel">
            <div>
              <h2>Link compartible</h2>
              <p>
                Guarda online para abrir esta misma ruleta desde otro
                dispositivo.
              </p>
            </div>

            {!supabaseConfigurado ? (
              <p className="online-message error">
                El guardado online no está conectado en esta prueba local. Puedes guardar en este dispositivo o exportar una copia.
              </p>
            ) : null}

            {enlaceCompartido ? (
              <div className="share-link-row">
                <input type="text" value={enlaceCompartido} readOnly />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={copiarEnlaceCompartido}
                >
                  Copiar
                </button>
              </div>
            ) : null}

            {estadoOnline.mensaje ? (
              <p className={`online-message ${estadoOnline.estado}`}>
                {estadoOnline.mensaje}
              </p>
            ) : null}
          </div>


          </div>
        </section>

        <aside className="preview-panel" aria-label="Vista previa" data-collapsed={!previewOpen}>
          <div className="preview-heading">
            <div>
              <p className="eyebrow">Vista previa</p>
              <h2>{ruleta.nombre || "Ruleta sin nombre"}</h2>
            </div>
            <span className="preview-badge"><span aria-hidden="true" />En vivo</span>
            <button type="button" className="ghost-button preview-toggle" aria-expanded={previewOpen} aria-controls="preview-content" onClick={() => setPreviewOpen(value => !value)}>{previewOpen ? "Ocultar rueda" : "Ver rueda"}</button>
          </div>
          <div className="preview-content" id="preview-content">
          <div className="preview-stage" style={crearEstiloFondoJuego(ruleta.fondoJuego)}>
            <GameScene ruleta={ruleta} fondoRuleta={fondoRuleta} anguloPorGajo={anguloPorGajo} rotacion={rotacion} ruletaVisualRef={ruletaVisualRef} preview ultimoResultado={ruleta.gajos[0]} />
          </div>
          <p className="preview-note">Los cambios se reflejan al instante. Pulsa Jugar para probar la ruleta.</p>
          </div>
        </aside>
      </div>
      <nav className="mobile-editor-actions" aria-label="Acciones rápidas">
        <button type="button" className="secondary-button" onClick={() => { setPreviewOpen(true); document.querySelector(".preview-panel")?.scrollIntoView({ behavior: herramientas.movimientoReducido ? "instant" : "smooth", block: "start" }); }}>Ver vista previa</button>
        <button type="button" className="spin-button" onClick={abrirJuego}>Jugar</button>
      </nav>
    </section>
  );
}

function EditorGajo({ gajo, index, actualizarGajo, eliminarGajo, puedeEliminar, duplicarGajo, moverGajo, total }) {
  return (
    <article className="prize-item" style={{ "--slice-color": gajo.color }} aria-label={`Gajo ${index + 1}`}>
      <div className="slice-main">
        <span className="slice-number">{index + 1}</span>
        <label className="slice-text">
          Premio o texto
          <input
            type="text"
            value={gajo.texto}
            placeholder="Escribe un premio"
            onChange={(event) => actualizarGajo(index, "texto", event.target.value)}
          />
        </label>
        <label className="slice-color">
          Color
          <input
            type="color"
            value={gajo.color}
            onChange={(event) => actualizarGajo(index, "color", event.target.value)}
          />
        </label>
      </div>
      <div className="slice-tools">
        <button type="button" className="ghost-button" aria-label={`Subir gajo ${index + 1}`} disabled={index === 0} onClick={() => moverGajo(index, -1)}>↑</button>
        <button type="button" className="ghost-button" aria-label={`Bajar gajo ${index + 1}`} disabled={index === total - 1} onClick={() => moverGajo(index, 1)}>↓</button>
        <button type="button" className="ghost-button" disabled={total >= MAX_GAJOS} onClick={() => duplicarGajo(index)}>Duplicar</button>
      </div>
      <details className="slice-details">
        <summary>
          <span>Más opciones</span>
          <span className="slice-probability">{Number(gajo.probabilidad).toFixed(1)}%</span>
        </summary>
        <label className="outcome-message">Mensaje al salir
          <input type="text" maxLength="120" placeholder="Resultado, ¡Ganaste!, Pierdes turno…" value={gajo.mensajeResultado || ""} onChange={event => actualizarGajo(index, "mensajeResultado", event.target.value)} />
        </label>
        <div className="slice-options">
          <label>
            Color del texto
            <input
              type="color"
              value={gajo.colorTexto}
              onChange={(event) => actualizarGajo(index, "colorTexto", event.target.value)}
            />
          </label>
          <label>
            Tamaño del texto
            <input
              type="number"
              min="10"
              max="22"
              value={gajo.tamanoTexto}
              onChange={(event) => actualizarGajo(index, "tamanoTexto", Number(event.target.value))}
            />
          </label>
          <label>
            Probabilidad (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={gajo.probabilidad}
              onChange={(event) => actualizarGajo(index, "probabilidad", Number(event.target.value))}
            />
          </label>
        </div>
        <button
          className="ghost-button remove-slice-button"
          type="button"
          onClick={() => eliminarGajo(index)}
          disabled={!puedeEliminar}
        >
          Eliminar gajo
        </button>
      </details>
    </article>
  );
}

function VistaJuego({
  ruleta, fondoRuleta, anguloPorGajo, rotacion, ruletaVisualRef, estaGirando,
  ultimoResultado, mostrarAnuncioGanador, confetiId, animarRuleta, girarRuleta,
  ocultarAnuncioGanador, volverAlEditor, historial, retirados, disponibles,
  reiniciarSesion, alternarPantallaCompleta, pantallaCompleta, mensajeJuego, actualizarJuego,
}) {
  return (
    <section className="play-layout">
      {confetiId > 0 && ruleta.juego.confeti ? <Confeti key={confetiId} /> : null}
      <PresentationControls autoHide={ruleta.juego.ocultarControles} spinning={estaGirando} resultOpen={mostrarAnuncioGanador}>
        <button className="secondary-button" type="button" onClick={volverAlEditor}>Volver al editor</button>
        <div>
          <SoundLevels value={ruleta.juego} onChange={actualizarJuego} />
          <button className="ghost-button" type="button" aria-pressed={!ruleta.juego.sonido} onClick={() => actualizarJuego("sonido", !ruleta.juego.sonido)}>{ruleta.juego.sonido ? "Silenciar" : "Activar sonido"}</button>
          <button className="ghost-button" type="button" onClick={alternarPantallaCompleta}>{pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}</button>
        </div>
      </PresentationControls>
      {mensajeJuego && <p className="game-message" role="status">{mensajeJuego}</p>}
      <GameScene {...{ruleta, fondoRuleta, anguloPorGajo, rotacion, ruletaVisualRef, estaGirando, ultimoResultado, animarRuleta, girarRuleta, disponibles}} />
      {mostrarAnuncioGanador && !estaGirando && ultimoResultado ? <WinnerCard result={ultimoResultado} onClose={ocultarAnuncioGanador} onSpin={girarRuleta} canSpin={disponibles > 0} persistent={ruleta.juego.mantenerResultado} /> : null}
      <ProbabilityInfo prizes={ruleta.gajos} removed={ruleta.juego.retirarGanador ? retirados : []} mode={ruleta.juego.modoSectores} />
      <ResultHistory results={historial} removedCount={ruleta.juego.retirarGanador ? retirados.length : 0} onReset={reiniciarSesion} />
      <p className="game-shortcut">Pulsa Espacio para girar · Esc para salir de pantalla completa</p>
    </section>
  );
}

function GameScene({ ruleta, fondoRuleta, anguloPorGajo, rotacion, ruletaVisualRef, estaGirando = false, ultimoResultado, animarRuleta = false, girarRuleta, disponibles = 1, preview = false }) {
  return <div className={preview ? "game-scene scene-preview" : "game-scene"}>
    {ruleta.mostrarTitulo && <h2 className="scene-title">{ruleta.nombre || "Ruleta sin nombre"}</h2>}
    <div className={ruleta.logoJuego.imagen ? "play-main" : "play-main without-logo"}>
      {ruleta.logoJuego.imagen && <div className="play-logo" aria-label="Logo del juego"><img src={ruleta.logoJuego.imagen} alt="Logo del juego" style={{ opacity: ruleta.logoJuego.opacidad / 100 }} /></div>}
      <div className="wheel-stage play-wheel" aria-label="Ruleta de premios">
        <RuletaVisual {...{ruleta, fondoRuleta, anguloPorGajo, rotacion, ruletaVisualRef}} winnerIndex={!preview && !estaGirando ? ultimoResultado?.indice : undefined} animarRuleta={estaGirando && animarRuleta} onCenterClick={!preview && !estaGirando && disponibles > 0 ? girarRuleta : undefined} />
      </div>
      <aside className="play-side">
        {ruleta.mostrarUltimoResultado && <div className="result-box" aria-live={preview ? "off" : "polite"}>
          <span>{preview ? "Ejemplo de resultado" : "Último resultado"}</span>
          {estaGirando ? <strong>Girando…</strong> : ultimoResultado ? <div className="result-value"><span className="result-color" style={{ background: ultimoResultado.color }} aria-hidden="true" /><strong>{ultimoResultado.texto || "Sin texto"}</strong></div> : <strong>Aún no hay resultado</strong>}
        </div>}
        <button type="button" className="spin-button" disabled={preview || estaGirando || !disponibles} onClick={girarRuleta}>{estaGirando ? "Girando…" : !disponibles ? "Sorteo finalizado" : "Girar"}</button>
        {!preview && ruleta.juego.retirarGanador && <p className="remaining-prizes">{disponibles} premios disponibles</p>}
      </aside>
    </div>
  </div>;
}

function Confeti() {
  const piezas = Array.from({ length: 220 }, (_, index) => ({
    id: index,
    x: Math.random() * 100,
    drift: Math.random() * 190 - 95,
    delay: Math.random() * 0.75,
    duration: 3 + Math.random() * 1.8,
    rotate: Math.random() * 360,
    size: 6 + Math.random() * 10,
    color: coloresConfeti[index % coloresConfeti.length],
  }));

  return (
    <div className="confetti-layer" aria-hidden="true">
      {piezas.map((pieza) => (
        <span
          className="confetti-piece"
          key={pieza.id}
          style={{
            "--x": `${pieza.x}%`,
            "--drift": `${pieza.drift}px`,
            "--delay": `${pieza.delay}s`,
            "--duration": `${pieza.duration}s`,
            "--rotate": `${pieza.rotate}deg`,
            "--size": `${pieza.size}px`,
            "--color": pieza.color,
          }}
        />
      ))}
    </div>
  );
}

function RuletaVisual({
  ruleta,
  fondoRuleta,
  anguloPorGajo,
  rotacion,
  ruletaVisualRef,
  animarRuleta,
  onCenterClick,
  winnerIndex,
}) {
  return (
    <div className="wheel-wrap">
      <div className="pointer" aria-hidden="true" />
      <div
        ref={ruletaVisualRef}
        className={`wheel ${animarRuleta ? "" : "no-transition"}`}
        style={{
          "--slice-angle": `${anguloPorGajo}deg`,
          "--spin-duration": `${ruleta.juego.duracion}s`,
          background: fondoRuleta,
          transform: `rotate(${rotacion}deg)`,
        }}
      >
        <WheelFace wheel={ruleta} winnerIndex={winnerIndex} />
      </div>

      <button
        className={`wheel-center ${ruleta.centro.imagen ? "has-image" : ""}`}
        type="button"
        onClick={onCenterClick}
        disabled={!onCenterClick}
      >
        {ruleta.centro.imagen ? (
          <img
            className="wheel-center-image"
            src={ruleta.centro.imagen}
            alt=""
            style={{
              width: `${ruleta.centro.tamanoImagen / 116 * 100}%`,
              height: `${ruleta.centro.tamanoImagen / 116 * 100}%`,
              objectFit: ruleta.centro.ajusteImagen,
              objectPosition: `${ruleta.centro.posicionX}% ${ruleta.centro.posicionY}%`,
            }}
          />
        ) : null}
        {ruleta.centro.texto ? <span>{ruleta.centro.texto}</span> : null}
      </button>
    </div>
  );
}

function crearFondoRuleta(gajos) {
  const anguloPorGajo = 360 / gajos.length;
  const partes = gajos.map((gajo, index) => {
    const inicio = index * anguloPorGajo;
    const fin = (index + 1) * anguloPorGajo;

    return `${gajo.color} ${inicio}deg ${fin}deg`;
  });

  return `conic-gradient(from -${anguloPorGajo / 2}deg, ${partes.join(", ")})`;
}

function normalizarAngulo(angulo) {
  return ((angulo % 360) + 360) % 360;
}

function obtenerRotacionVisual(elemento) {
  if (!elemento) return 0;

  const transform = window.getComputedStyle(elemento).transform;
  if (!transform || transform === "none") return 0;

  const valores = transform.match(/matrix\(([^)]+)\)/)?.[1].split(",");
  if (!valores || valores.length < 2) return 0;

  const a = Number(valores[0]);
  const b = Number(valores[1]);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;

  return normalizarAngulo((Math.atan2(b, a) * 180) / Math.PI);
}

function crearGajoNuevo(index) {
  return {
    texto: `Gajo ${index + 1}`,
    color: coloresSugeridos[index % coloresSugeridos.length],
    colorTexto: "#ffffff",
    tamanoTexto: 14,
    probabilidad: 0,
  };
}

function repartirProbabilidadesIguales(gajos) {
  const porcentaje = Number((100 / gajos.length).toFixed(2));

  return gajos.map((gajo, index) => ({
    ...gajo,
    probabilidad:
      index === gajos.length - 1
        ? Number((100 - porcentaje * (gajos.length - 1)).toFixed(2))
        : porcentaje,
  }));
}

function ajustarProbabilidades(gajos, indexEditado, nuevoPorcentaje) {
  const porcentajeEditado = limitarNumero(Number(nuevoPorcentaje), 0, 100) ?? 0;
  const restante = Number((100 - porcentajeEditado).toFixed(2));
  const otrosGajos = gajos.filter((_, index) => index !== indexEditado);
  const totalOtros = otrosGajos.reduce(
    (total, gajo) => total + (Number(gajo.probabilidad) || 0),
    0
  );
  const ultimoOtroIndex = gajos
    .map((_, index) => index)
    .filter((index) => index !== indexEditado)
    .at(-1);

  let acumulado = 0;

  return gajos.map((gajo, index) => {
    if (index === indexEditado) {
      return {
        ...gajo,
        probabilidad: porcentajeEditado,
      };
    }

    const esUltimoOtro = index === ultimoOtroIndex;
    const proporcion =
      totalOtros > 0
        ? (Number(gajo.probabilidad) || 0) / totalOtros
        : 1 / otrosGajos.length;
    const nuevoValor = esUltimoOtro
      ? Number((restante - acumulado).toFixed(2))
      : Number((restante * proporcion).toFixed(2));

    acumulado = Number((acumulado + nuevoValor).toFixed(2));

    return {
      ...gajo,
      probabilidad: nuevoValor,
    };
  });
}

function elegirIndicePorProbabilidad(gajos) {
  const pesos = gajos.map((gajo) => Math.max(Number(gajo.probabilidad) || 0, 0));
  const total = pesos.reduce((suma, peso) => suma + peso, 0);

  if (total <= 0) {
    return Math.floor(Math.random() * gajos.length);
  }

  let punto = Math.random() * total;

  for (let index = 0; index < pesos.length; index += 1) {
    punto -= pesos[index];

    if (punto <= 0) {
      return index;
    }
  }

  return gajos.length - 1;
}

function cargarRuletasGuardadas() {
  try {
    const data = window.localStorage.getItem(STORAGE_KEY);
    const ruletas = data ? JSON.parse(data) : [];

    if (!Array.isArray(ruletas)) {
      return [];
    }

    return ruletas.map(normalizarRuleta).filter(Boolean);
  } catch {
    return [];
  }
}

function guardarEnStorage(ruletas) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ruletas));
    return true;
  } catch {
    return false;
  }
}

function crearId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return String(Date.now());
}

function normalizarRuleta(ruleta) {
  if (!ruleta || typeof ruleta !== "object") {
    return ruletaInicial;
  }

  const gajos = Array.isArray(ruleta.gajos) ? ruleta.gajos : ruletaInicial.gajos;
  const gajosNormalizados = gajos.map((gajo, index) => {
    const gajoBase = ruletaInicial.gajos[index] || ruletaInicial.gajos[0];

    if (typeof gajo === "string") {
      return {
        ...gajoBase,
        texto: gajo,
      };
    }

    return {
      texto: String(gajo?.texto ?? gajoBase.texto),
      color: esColorHex(gajo?.color) ? gajo.color : gajoBase.color,
      colorTexto: esColorHex(gajo?.colorTexto)
        ? gajo.colorTexto
        : gajoBase.colorTexto,
      tamanoTexto: limitarNumero(Number(gajo?.tamanoTexto), 10, 22) || gajoBase.tamanoTexto,
      mensajeResultado: String(gajo?.mensajeResultado || "").slice(0, 120),
      probabilidad:
        limitarNumero(Number(gajo?.probabilidad), 0, 100) ??
        gajoBase.probabilidad ??
        0,
    };
  });

  return {
    ...ruletaInicial,
    ...ruleta,
    nombre: String(ruleta.nombre || ruletaInicial.nombre),
    mostrarTitulo:
      typeof ruleta.mostrarTitulo === "boolean"
        ? ruleta.mostrarTitulo
        : ruletaInicial.mostrarTitulo,
    mostrarUltimoResultado:
      typeof ruleta.mostrarUltimoResultado === "boolean"
        ? ruleta.mostrarUltimoResultado
        : ruletaInicial.mostrarUltimoResultado,
    juego: normalizeGame(ruleta.juego),
    centro: {
      ajusteImagen: ruleta.centro?.ajusteImagen === "contain" ? "contain" : "cover",
      posicionX: limitarNumero(Number(ruleta.centro?.posicionX ?? 50), 0, 100) ?? 50,
      posicionY: limitarNumero(Number(ruleta.centro?.posicionY ?? 50), 0, 100) ?? 50,
      texto: String(ruleta.centro?.texto ?? ruletaInicial.centro.texto),
      imagen: String(ruleta.centro?.imagen || ""),
      tamanoImagen:
        limitarNumero(Number(ruleta.centro?.tamanoImagen), 36, 116) ||
        ruletaInicial.centro.tamanoImagen,
    },
    fondoJuego: {
      color: esColorHex(ruleta.fondoJuego?.color)
        ? ruleta.fondoJuego.color
        : ruletaInicial.fondoJuego.color,
      imagen: String(ruleta.fondoJuego?.imagen || ""),
    },
    logoJuego: {
      imagen: String(ruleta.logoJuego?.imagen || ""),
      opacidad:
        limitarNumero(Number(ruleta.logoJuego?.opacidad), 0, 100) ??
        ruletaInicial.logoJuego.opacidad,
    },
    gajos: gajosNormalizados,
  };
}

function crearEstiloFondoJuego(fondoJuego) {
  const color = esColorHex(fondoJuego?.color)
    ? fondoJuego.color
    : ruletaInicial.fondoJuego.color;

  if (!fondoJuego?.imagen) {
    return {
      background: color,
    };
  }

  return {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.22)), url(${fondoJuego.imagen})`,
    backgroundColor: color,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

async function prepararRuletaOnline(ruleta, idRuleta) {
  const centroImagen = await subirImagenSiEsNecesario(
    ruleta.centro.imagen,
    `${idRuleta}/centro`
  );
  const fondoImagen = await subirImagenSiEsNecesario(
    ruleta.fondoJuego.imagen,
    `${idRuleta}/fondo`
  );
  const logoImagen = await subirImagenSiEsNecesario(
    ruleta.logoJuego.imagen,
    `${idRuleta}/logo`
  );

  return {
    ...ruleta,
    centro: {
      ...ruleta.centro,
      imagen: centroImagen,
    },
    fondoJuego: {
      ...ruleta.fondoJuego,
      imagen: fondoImagen,
    },
    logoJuego: {
      ...ruleta.logoJuego,
      imagen: logoImagen,
    },
  };
}

async function obtenerUsuarioEditor() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error("No se pudo iniciar la sesión de edición. Revisa la configuración de acceso online.");
  return data.user.id;
}

async function subirImagenSiEsNecesario(valorImagen, rutaBase) {
  if (!valorImagen || !valorImagen.startsWith("data:")) {
    return valorImagen || "";
  }

  const respuesta = await fetch(valorImagen);
  const archivo = await respuesta.blob();
  const extension = obtenerExtensionImagen(archivo.type);
  const version = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ruta = `${rutaBase}-${version}.${extension}`;

  const { error } = await supabase.storage
    .from(ONLINE_STORAGE_BUCKET)
    .upload(ruta, archivo, {
      cacheControl: "3600",
      contentType: archivo.type,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(ONLINE_STORAGE_BUCKET)
    .getPublicUrl(ruta);

  return `${data.publicUrl}?v=${version}`;
}

function obtenerExtensionImagen(tipo) {
  if (tipo === "image/jpeg") return "jpg";
  if (tipo === "image/png") return "png";
  if (tipo === "image/webp") return "webp";
  if (tipo === "image/gif") return "gif";
  return "png";
}

function crearEnlaceCompartido(id) {
  const url = new URL(window.location.href);
  url.searchParams.set(ONLINE_QUERY_PARAM, id);
  return url.toString();
}

function esColorHex(valor) {
  return typeof valor === "string" && /^#[0-9a-fA-F]{6}$/.test(valor);
}

function limitarNumero(valor, minimo, maximo) {
  if (!Number.isFinite(valor)) return null;
  return Math.min(Math.max(valor, minimo), maximo);
}

export default App;
