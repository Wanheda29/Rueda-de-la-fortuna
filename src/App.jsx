import React, { useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "./supabaseClient";

const STORAGE_KEY = "ruletas-editables";
const ONLINE_QUERY_PARAM = "ruleta";
const ONLINE_STORAGE_BUCKET = "wheel-images";
const MIN_GAJOS = 4;
const MAX_GAJOS = 14;
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
    tamanoImagen: 72,
  },
  fondoJuego: {
    color: "#101010",
    imagen: "",
  },
  logoJuego: {
    imagen: "",
    opacidad: 100,
  },
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
  const [ruleta, setRuleta] = useState(() => normalizarRuleta(ruletaInicial));
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

  const anguloPorGajo = 360 / ruleta.gajos.length;
  const fondoRuleta = crearFondoRuleta(ruleta.gajos);
  const fondoModoJuego = crearEstiloFondoJuego(ruleta.fondoJuego);

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

      if (event.code === "Space" && !estaEscribiendo) {
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
    if (!debeGirarLento) return undefined;

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
  }, [vista, estaGirando, ultimoResultado]);

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

    setRuleta(ruletaParaGuardar);
    setRuletasGuardadas(siguientesRuletas);
    guardarEnStorage(siguientesRuletas);
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
    const id = ruletaNormalizada.id || crearId();
    const nombre = ruletaNormalizada.nombre.trim() || "Ruleta sin nombre";

    setEstadoOnline({
      estado: "loading",
      mensaje: "Guardando ruleta online...",
    });

    try {
      const configOnline = await prepararRuletaOnline(
        {
          ...ruletaNormalizada,
          id,
          nombre,
        },
        id
      );

      const { error } = await supabase.from("wheels").upsert({
        id,
        name: nombre,
        config_json: configOnline,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      const enlace = crearEnlaceCompartido(id);
      const ruletaGuardada = {
        ...ruletaNormalizada,
        id,
        nombre,
        guardadaEn: new Date().toISOString(),
      };

      setRuleta(ruletaGuardada);
      setEnlaceCompartido(enlace);
      guardarRuletaLocal(ruletaGuardada);
      window.history.replaceState(null, "", enlace);
      setEstadoOnline({
        estado: "success",
        mensaje: "Ruleta guardada online. El enlace ya esta listo.",
      });
    } catch (error) {
      setEstadoOnline({
        estado: "error",
        mensaje: `No se pudo guardar online: ${error.message}`,
      });
    }
  }

  async function cargarRuletaOnline(id) {
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
      setEstadoOnline({
        estado: "error",
        mensaje: `No se pudo cargar la ruleta: ${error.message}`,
      });
    }
  }

  async function copiarEnlaceCompartido() {
    if (!enlaceCompartido) return;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(enlaceCompartido);
    } else {
      window.prompt("Copia este enlace:", enlaceCompartido);
    }

    setEstadoOnline({
      estado: "success",
      mensaje: "Enlace copiado.",
    });
  }

  function crearNuevaRuleta() {
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
    resetearTirada();
    setVista("editor");
  }

  function resetearTirada() {
    setAnimarRuleta(false);
    rotacionActualRef.current = 0;
    setRotacion(0);
    setEstaGirando(false);
    setConfetiId(0);
    setMostrarAnuncioGanador(false);
  }

  function girarRuleta() {
    if (estaGirando) return;

    setEstaGirando(true);
    setAnimarRuleta(true);
    setMostrarAnuncioGanador(false);

    const vueltasMinimas = 360 * 5;
    const nuevoIndiceGanador = elegirIndicePorProbabilidad(ruleta.gajos);
    const margenBorde = anguloPorGajo * 0.01;
    const rangoSeguro = anguloPorGajo - margenBorde * 2;
    const offsetAleatorio =
      Math.random() * rangoSeguro - rangoSeguro / 2;
    const posicionDentroDelGajo =
      nuevoIndiceGanador * anguloPorGajo + offsetAleatorio;
    const anguloObjetivo = normalizarAngulo(360 - posicionDentroDelGajo);
    const gajoGanador = ruleta.gajos[nuevoIndiceGanador];
    const resultado = {
      texto: gajoGanador.texto,
      color: gajoGanador.color,
    };

    setRotacion(() => {
      const anguloActual = normalizarAngulo(rotacionActualRef.current);
      const giroHastaObjetivo = normalizarAngulo(anguloObjetivo - anguloActual);
      const nuevaRotacion =
        rotacionActualRef.current + vueltasMinimas + giroHastaObjetivo;

      rotacionActualRef.current = nuevaRotacion;

      return nuevaRotacion;
    });

    window.setTimeout(() => {
      setUltimoResultado(resultado);
      setEstaGirando(false);
      setConfetiId((idActual) => idActual + 1);
      setMostrarAnuncioGanador(true);
    }, 6240);
  }

  function ocultarAnuncioGanador() {
    setMostrarAnuncioGanador(false);
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
}) {
  const totalProbabilidad = ruleta.gajos.reduce(
    (total, gajo) => total + (Number(gajo.probabilidad) || 0),
    0
  );

  return (
    <section className="creator-layout">
      <div className="creator-header">
        <div>
          <p className="eyebrow">Menu de creacion</p>
          <h1>Ruleta editable</h1>
          <p>
            Ajusta textos, colores, centro e imagen. Guarda tus versiones y
            entra a jugar cuando la ruleta este lista.
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

      <div className="creator-grid">
        <section className="editor-panel" aria-label="Configuracion de ruleta">
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
                Falta configurar Supabase en las variables de entorno.
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
            Mostrar en pantalla
          </label>

          <label className="check-field">
            <input
              type="checkbox"
              checked={ruleta.mostrarUltimoResultado}
              onChange={(event) =>
                actualizarMostrarUltimoResultado(event.target.checked)
              }
            />
            Mostrar ultimo resultado
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
              Tamano imagen central: {ruleta.centro.tamanoImagen}px
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

          <div className="prize-board" aria-label="Editor de gajos">
            <div className="section-heading">
              <div>
                <h2>Gajos</h2>
                <p>
                  {ruleta.gajos.length} gajos activos. Minimo {MIN_GAJOS},
                  maximo {MAX_GAJOS}. Total: {totalProbabilidad.toFixed(1)}%.
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
            <div className="prize-list">
              {ruleta.gajos.map((gajo, index) => (
                <EditorGajo
                  gajo={gajo}
                  index={index}
                  key={`editor-${index}`}
                  actualizarGajo={actualizarGajo}
                  eliminarGajo={eliminarGajo}
                  puedeEliminar={ruleta.gajos.length > MIN_GAJOS}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="preview-panel" aria-label="Vista previa">
          <RuletaVisual
            ruleta={ruleta}
            fondoRuleta={fondoRuleta}
          anguloPorGajo={anguloPorGajo}
          rotacion={rotacion}
          ruletaVisualRef={ruletaVisualRef}
          animarRuleta={false}
        />

          <section className="saved-panel" aria-label="Ruletas guardadas">
            <h2>Ruletas guardadas</h2>
            {ruletasGuardadas.length > 0 ? (
              <div className="saved-list">
                {ruletasGuardadas.map((ruletaGuardada) => (
                  <div className="saved-item" key={ruletaGuardada.id}>
                    <strong>{ruletaGuardada.nombre}</strong>
                    <div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => cargarRuletaGuardada(ruletaGuardada)}
                      >
                        Cargar
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => eliminarRuletaGuardada(ruletaGuardada.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>Aun no guardaste ruletas.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function EditorGajo({ gajo, index, actualizarGajo, eliminarGajo, puedeEliminar }) {
  return (
    <div className="prize-item">
      <span>{index + 1}</span>
      <label>
        Texto
        <input
          type="text"
          value={gajo.texto}
          onChange={(event) => actualizarGajo(index, "texto", event.target.value)}
        />
      </label>
      <label>
        Gajo
        <input
          type="color"
          value={gajo.color}
          onChange={(event) => actualizarGajo(index, "color", event.target.value)}
        />
      </label>
      <label>
        Texto
        <input
          type="color"
          value={gajo.colorTexto}
          onChange={(event) =>
            actualizarGajo(index, "colorTexto", event.target.value)
          }
        />
      </label>
      <label>
        Tamano
        <input
          type="number"
          min="10"
          max="22"
          value={gajo.tamanoTexto}
          onChange={(event) =>
            actualizarGajo(index, "tamanoTexto", Number(event.target.value))
          }
        />
      </label>
      <label>
        Prob. %
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={gajo.probabilidad}
          onChange={(event) =>
            actualizarGajo(index, "probabilidad", Number(event.target.value))
          }
        />
      </label>
      <button
        className="ghost-button remove-slice-button"
        type="button"
        onClick={() => eliminarGajo(index)}
        disabled={!puedeEliminar}
      >
        Eliminar
      </button>
    </div>
  );
}

function VistaJuego({
  ruleta,
  fondoRuleta,
  anguloPorGajo,
  rotacion,
  ruletaVisualRef,
  estaGirando,
  ultimoResultado,
  mostrarAnuncioGanador,
  confetiId,
  animarRuleta,
  girarRuleta,
  ocultarAnuncioGanador,
  volverAlEditor,
}) {
  return (
    <section className="play-layout" onClick={ocultarAnuncioGanador}>
      {confetiId > 0 ? <Confeti key={confetiId} /> : null}

      <header className="play-header">
        <button className="secondary-button" type="button" onClick={volverAlEditor}>
          Volver al editor
        </button>
      </header>

      <div className="play-main">
        {ruleta.logoJuego.imagen ? (
          <div className="play-logo" aria-label="Logo del juego">
            <img
              src={ruleta.logoJuego.imagen}
              alt=""
              style={{ opacity: ruleta.logoJuego.opacidad / 100 }}
            />
          </div>
        ) : null}

        {mostrarAnuncioGanador && !estaGirando && ultimoResultado ? (
          <ResultadoGanador resultado={ultimoResultado} />
        ) : null}

        <div className="wheel-stage play-wheel" aria-label="Ruleta de premios">
          <div className="pointer" aria-hidden="true" />
          <RuletaVisual
            ruleta={ruleta}
            fondoRuleta={fondoRuleta}
            anguloPorGajo={anguloPorGajo}
            rotacion={rotacion}
            ruletaVisualRef={ruletaVisualRef}
            animarRuleta={estaGirando && animarRuleta}
            onCenterClick={girarRuleta}
          />
        </div>

        <aside className="play-side">
          {ruleta.mostrarUltimoResultado ? (
            <div className="result-box" aria-live="polite">
              <span>Ultimo resultado</span>
              {estaGirando ? (
                <strong>Girando...</strong>
              ) : ultimoResultado ? (
                <div className="result-value">
                  <span
                    className="result-color"
                    style={{ background: ultimoResultado.color }}
                    aria-hidden="true"
                  />
                  <strong>{ultimoResultado.texto || "Sin texto"}</strong>
                </div>
              ) : (
                <strong>Aun no hay resultado</strong>
              )}
            </div>
          ) : null}

          <button
            className="spin-button"
            type="button"
            onClick={girarRuleta}
            disabled={estaGirando}
          >
            <span aria-hidden="true">▶</span>
            {estaGirando ? "Girando..." : "Girar"}
          </button>
        </aside>
      </div>
    </section>
  );
}

function ResultadoGanador({ resultado }) {
  const textoResultado = String(resultado.texto || "").trim();
  const tieneTexto = textoResultado.length > 0;

  return (
    <div className="winner-announcement" role="status" aria-live="polite">
      <strong>¡Ganaste!</strong>
      {tieneTexto ? (
        <span>{textoResultado}</span>
      ) : (
        <span
          className="winner-color"
          style={{ background: resultado.color }}
          aria-label="Color del gajo ganador"
        />
      )}
    </div>
  );
}

function Confeti() {
  const piezas = Array.from({ length: 80 }, (_, index) => ({
    id: index,
    x: Math.random() * 100,
    drift: Math.random() * 80 - 40,
    delay: Math.random() * 0.45,
    duration: 2.4 + Math.random() * 1.2,
    rotate: Math.random() * 360,
    size: 7 + Math.random() * 7,
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
}) {
  return (
    <div
      ref={ruletaVisualRef}
      className={`wheel ${animarRuleta ? "" : "no-transition"}`}
      style={{
        background: fondoRuleta,
        transform: `rotate(${rotacion}deg)`,
      }}
    >
      {ruleta.gajos.map((gajo, index) => (
        <div
          className="wheel-segment"
          key={`gajo-${index}`}
          style={{
            transform: `rotate(${index * anguloPorGajo}deg)`,
          }}
        >
          <span
            style={{
              color: gajo.colorTexto,
              fontSize: `${gajo.tamanoTexto}px`,
            }}
          >
            {gajo.texto}
          </span>
        </div>
      ))}
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
              width: `${ruleta.centro.tamanoImagen}px`,
              height: `${ruleta.centro.tamanoImagen}px`,
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
  } catch {
    // Si el navegador bloquea el almacenamiento, la app sigue funcionando.
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
      tamanoTexto: Number(gajo?.tamanoTexto) || gajoBase.tamanoTexto,
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
    centro: {
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
