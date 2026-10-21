# Prueba local de la ruleta

Guía de las mejoras del editor, la presentación y los sorteos. Las pruebas pueden ejecutarse localmente sin conectar Supabase. Ningún script de la aplicación ejecuta cambios en la base de datos.

## Abrir la aplicación

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Abrir http://127.0.0.1:5174/Rueda-de-la-fortuna/ . El servidor se limita a esta computadora. Mantén la terminal abierta mientras pruebas; Ctrl+C lo detiene. Si el puerto ya está ocupado por la sesión de prueba, basta con abrir el enlace.

## Qué probar

1. Cambia un premio y espera «Borrador guardado en este dispositivo». Recarga: debe recuperarse. El borrador es independiente de las versiones nombradas con «Guardar ruleta».
2. Borra, duplica o mueve un gajo; prueba Deshacer y Rehacer. Ctrl+Z / Ctrl+Shift+Z también funcionan fuera de los campos de texto. Se conservan hasta 40 pasos durante la sesión del editor.
3. Aplica las paletas o pega entre 4 y 14 premios, uno por línea. Reemplazar la lista o aplicar colores se puede deshacer.
4. En Apariencia, prueba el ajuste «Mostrar completo» / «Rellenar el círculo» y el encuadre del logo central. La vista previa incluye título, logo de juego y un resultado de ejemplo, claramente identificado.
5. En Apariencia → Presentación y sorteo, ajusta duración, sonido, confeti y animaciones. La preferencia de movimiento reducido del dispositivo prevalece sobre las animaciones.
6. Activa «Retirar al ganador», entra a Jugar y gira varias veces. El historial registra hasta 100 resultados de la sesión, sin modificar los gajos del diseño. «Reiniciar sesión» limpia el historial y restablece todos los premios. Editar los gajos también inicia una sesión nueva. El historial y los gajos retirados no se conservan al recargar.
7. Prueba Pantalla completa y Silenciar. Vuelve al editor durante una tirada: no debe aparecer un ganador tardío ni seguir sonando la rueda.
8. En Apariencia → Presentación y sorteo, cambia entre texto radial y horizontal. El texto se ajusta al espacio disponible y puede abreviarse con puntos suspensivos. Los sectores muy estrechos omiten el rótulo: su nombre completo sigue en el tooltip y en «Probabilidades actuales».
9. En Gajos → Más opciones, escribe un «Mensaje al salir» para cada premio. Al terminar una tirada, el gajo elegido se resalta y aparece una tarjeta compacta junto a la rueda (debajo en móvil), sin superposición ni fondo oscurecido/desenfocado. La tarjeta no bloquea los controles ni mueve el foco al aparecer. «Cerrar» o Escape cierran la tarjeta; «Volver a girar» inicia otra tirada. Por defecto permanece hasta que la cierres; puedes optar por cerrarla automáticamente a los 6 segundos.
10. En móvil, prueba «Ver rueda» / «Ocultar rueda». La vista previa empieza plegada y hay accesos fijos a la vista previa y al juego al pie de la pantalla.
11. En Guardadas, busca u ordena las versiones por nombre/fecha, duplica una y prueba importar una copia exportada en JSON. La importación crea un ID nuevo y conserva el original; se rechazan archivos inválidos o mayores a 8 MB.
12. Ajusta por separado los volúmenes del giro y del resultado. Los controles de presentación pueden ocultarse tras 2,5 segundos de inactividad; mover el puntero, tocar o usar el teclado los muestra de nuevo.
13. Prueba los sectores iguales y proporcionales. «Probabilidades actuales» solo está disponible en el editor, incluso después de retirar un premio en el juego y volver a editar. La pantalla de juego y los tooltips de la rueda no muestran porcentajes. La posición del puntero, los límites de los sectores y la selección usan la misma geometría. Si no quieres que el tamaño de los sectores permita deducir sus pesos, utiliza sectores iguales.

Los gajos con probabilidad cero no participan. Si no quedan premios con peso positivo, el botón de giro se desactiva. Las probabilidades de los premios restantes se ponderan entre ellos. Los sectores proporcionales representan los pesos originales del diseño; no cambian de tamaño al retirar ganadores y los de peso cero no ocupan espacio. No se añadieron estilos temáticos ni marcas de premios retirados. El resaltado corresponde únicamente al último resultado.

## Datos locales y copias

El borrador se guarda en el navegador, bajo `ruleta-borrador-v1`; las ruletas nombradas usan `ruletas-editables`. El almacenamiento depende del origen: los datos de GitHub Pages no se copian automáticamente a localhost. Prueba siempre con el mismo enlace/puerto. Si el navegador no permite guardar o se agota su espacio, se muestra un error y puedes usar «Exportar copia» para descargar el JSON actual.

`backups/published-original.zip` conserva el código publicado que se descargó antes de editar. También se guardaron copias individuales de los archivos principales. Para volver a la versión original sin tocar estos cambios, extrae el ZIP en otra carpeta y ejecuta esa copia; para restaurar esta carpeta, detén primero el servidor y recupera los archivos desde ese ZIP. No es necesario cambiar ni borrar `.git`.

`backups/local-before-refinements-20261021/` conserva la primera versión local anterior a esta segunda tanda de mejoras.

## Guardado online: preparado, sin conexión activa

No hay credenciales en esta carpeta; por eso Guardar online permanece deshabilitado. El uso local, los sonidos, las imágenes del dispositivo, el borrador y las versiones locales funcionan sin Supabase.

El guardado online mantiene por defecto el funcionamiento y esquema anteriores, para que la publicación de estas mejoras no requiera modificar la base activa. La protección por propietario **no está activa** en ese modo: las políticas anteriores siguen siendo las que rigen el acceso.

El cliente y `supabase-setup.sql` están preparados para separar lectura y edición **cuando se active** `VITE_SUPABASE_SECURE_EDITING=true` después de revisar y aplicar la migración:

- Los enlaces públicos permiten leer/copiar una ruleta; no otorgan permiso para sobrescribirla.
- El editor obtiene una sesión de Supabase Auth con `signInAnonymously` y las filas nuevas llevan `owner_id = auth.uid()`.
- Solo el propietario puede actualizar su fila. Las imágenes nuevas se guardan bajo `usuario/ruleta/…` y las políticas de Storage restringen las escrituras a esa carpeta.
- Guardar una ruleta de otro propietario crea una copia con un ID y un enlace distintos. Las ruletas anteriores con `owner_id` vacío siguen siendo legibles; se guardan como copias nuevas en lugar de asignarlas al primer visitante.

Antes de publicar esta parte, se requiere una prueba en un proyecto Supabase de desarrollo: respaldar las tablas/políticas, revisar políticas adicionales que pudieran conceder escrituras, habilitar Anonymous Sign-Ins en Auth y aplicar el SQL revisado. Configurar `.env.local` a partir de `.env.example` con URL y clave pública de ese proyecto; nunca usar `service_role` en el navegador. Reiniciar Vite después de cambiar variables.

La identidad anónima pertenece al navegador: borrar sus datos o cambiar de dispositivo pierde el acceso de edición de esa identidad. El enlace sigue permitiendo jugar/copiar. Un acceso con cuenta sería una ampliación posterior si se necesita editar la misma ruleta desde varios dispositivos.

El SQL **no se ejecutó ni validó contra una base de datos**. No activar `VITE_SUPABASE_SECURE_EDITING=true` con el esquema viejo: el modo protegido requiere la columna y las políticas nuevas. En GitHub Pages esa opción se configura como variable del repositorio antes de volver a desplegar. La reversión de la base requiere revisar las políticas respaldadas; no se restaura automáticamente una política pública de escritura.

Referencias: [Supabase Auth anónimo](https://supabase.com/docs/reference/javascript/auth-signinanonymously), [políticas RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [acceso a Storage](https://supabase.com/docs/guides/storage/security/access-control).

## Validación

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
```

Las pruebas de navegador usan Google Chrome instalado y no escriben en servicios externos. Incluyen móvil, pantalla completa, recuperación del borrador, undo/redo, edición rápida, agotamiento del sorteo, cancelación de tiradas, movimiento reducido y flujos online simulados. Las capturas se generan en `test-results/`. Las pruebas online simuladas no sustituyen la validación de las políticas en Supabase de desarrollo.
