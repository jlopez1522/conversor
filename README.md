# Transcriptor Web Local

Aplicación web estática para transcribir audio y video en español dentro del navegador. El archivo fuente, el audio decodificado y la transcripción no se envían a un servidor. La inferencia se ejecuta con Whisper mediante Transformers.js y usa WebGPU cuando está disponible, con alternativa WASM/CPU.

## Funcionalidades

- Cola de varios archivos MP4, MOV, MKV, MP3, WAV y M4A. La extensión no garantiza compatibilidad: antes de aceptar el trabajo se comprueba que la pista real sea decodificable por Mediabunny/WebCodecs en el navegador utilizado.
- Ventanas lógicas de 25 segundos con 2,5 segundos de contexto a cada lado: Whisper devuelve tiempos por palabra y la app conserva únicamente las palabras cuyo centro pertenece a la ventana, evitando cortes y duplicados en los límites.
- Mezcla a mono resistente a cancelación de fase, eliminación de componente continua, normalización moderada y remuestreo a 16 kHz mediante Web Audio (con alternativa lineal), sin decodificar la grabación completa en RAM.
- Transcripción local en un Web Worker con `onnx-community/whisper-small` fijado a la revisión `461d552a09349d5d0d0779b40dd79800eaa3e35a`, español y tarea de transcripción (sin resumen ni traducción).
- Preferencia por WebGPU y reintento automático con WASM/CPU si la carga por GPU falla.
- Confirmación atómica de cada fragmento en IndexedDB, con tiempos absolutos, identidad de fuente, versión de modelo y ajustes.
- Pausa en el límite del fragmento, cancelación, reintento y reanudación desde el primer hueco guardado.
- Verificación de la fuente al volver mediante SHA-256 de metadatos y muestras del inicio/final del archivo.
- Corrección manual persistente, exportación completa a TXT UTF-8 y DOCX.
- Historial local y eliminación de un trabajo o de todos los datos.

## Desarrollo

Requisitos: Node.js 20.19 o posterior, únicamente para compilar y probar.

```bash
npm install
npm run dev
npm test
npm run build
```

La aplicación final está en `dist/` y no necesita Node.js en el equipo del usuario.

## Arquitectura

- `src/media`: inspección y decodificación incremental con Mediabunny.
- `src/workers`: carga de Transformers.js e inferencia Whisper fuera del hilo de interfaz.
- `src/storage`: trabajos y fragmentos en IndexedDB mediante `idb`.
- `src/domain`: tipos, identidad de fuente, orden/reanudación y tiempos.
- `src/export`: generación de TXT y DOCX.
- `src/components`: interfaz React accesible en español.

Un fragmento solo cuenta como completado cuando el texto y el estado del trabajo se escriben juntos en una transacción IndexedDB. Las ediciones se guardan en `editedText` y la reanudación no las sobrescribe.

## Privacidad y red

La app no incluye analítica, telemetría, cuentas ni endpoints de aplicación. Transformers.js descarga el modelo desde Hugging Face; Vercel entrega los archivos estáticos. El modelo `onnx-community/whisper-small` requiere aproximadamente 250 MB con WASM/q8 o 590 MB con el codificador fp32 y decodificador q4 de WebGPU (más archivos pequeños de configuración), y queda sujeto a la caché del navegador.

Para auditar la red en Chrome o Edge:

1. Abre DevTools → Network y activa “Preserve log”.
2. Carga una grabación corta e inicia la transcripción.
3. Confirma que solo aparecen recursos de la aplicación/Vercel y descargas de `huggingface.co` o su CDN para el modelo.
4. Filtra por `fetch`, `xhr` y por el nombre del archivo. No debe existir ninguna solicitud cuyo cuerpo contenga el archivo, PCM o texto transcrito.
5. Repite con el modelo ya almacenado en caché; no deberían ser necesarias descargas de modelo nuevas.

No uses grabaciones confidenciales sin comprobar primero las políticas de tu organización. Esta aplicación no constituye por sí misma una aprobación corporativa.

## Limitaciones conocidas

- La transcripción no continúa después de cerrar la pestaña. Al volver, el navegador exige seleccionar de nuevo el archivo y la app verifica que coincida.
- WebGPU, WebAssembly, Web Workers, almacenamiento y caché pueden estar bloqueados por políticas corporativas. En CPU/WASM, Whisper Small puede ser mucho más lento que la duración real del audio.
- Existe un problema abierto de liberación de memoria de Whisper/WebGPU en Transformers.js 4.x. Como mitigación, esta aplicación reinicia el worker cada cuatro fragmentos WebGPU; los pesos se reutilizan desde la caché, aunque la reinicialización añade tiempo. Debe validarse en cada combinación de navegador/GPU antes de procesar tres horas.
- Los límites efectivos dependen de RAM, GPU, cuota de IndexedDB, espacio de caché y estabilidad del navegador. No se garantiza tamaño ilimitado ni tiempo de proceso.
- MOV/MKV/MP4/M4A son contenedores; ciertos códecs propietarios, pistas cifradas o archivos dañados pueden fallar aunque la extensión esté admitida. El error se muestra y los fragmentos previos permanecen guardados.
- Las marcas `[HH:MM:SS]` indican el inicio verificado de cada fragmento lógico de 25 segundos. Los tiempos por palabra se usan internamente para recortar el contexto, pero el documento exportado mantiene marcas por fragmento.
- El fingerprint lee como máximo 1 MiB del archivo (inicio y final) más metadatos. No persiste el archivo ni un embedding.
- La exactitud depende de ruido, voces superpuestas, micrófono, acento y modelo. El texto se conserva como lo devuelve Whisper y se puede corregir; no se resume ni se completa artificialmente.

## Validación con una grabación de más de 3 horas

Esta prueba requiere un navegador real, hardware compatible y un archivo autorizado; no forma parte de las pruebas unitarias:

1. Usa una grabación de prueba de al menos 03:05:00 y anota frases conocidas cerca de 00:00:00, 01:00:00 y 03:00:00.
2. Verifica en el administrador de tareas que la memoria no crece de forma proporcional al tamaño completo del video.
3. Pausa después de varios fragmentos, recarga, selecciona el mismo archivo y comprueba que se reanuda desde el primer índice ausente.
4. Comprueba que una edición manual anterior sigue intacta.
5. Finaliza y exporta TXT/DOCX; compara cantidad, orden, texto y marcas absolutas, incluida una marca mayor a `[03:00:00]`.
6. Repite la auditoría de red descrita arriba y prueba cancelar/reintentar, cuota insuficiente y un códec no compatible.

## Despliegue en Vercel

1. Publica este repositorio en GitHub.
2. En Vercel, elige **Add New → Project** e importa el repositorio.
3. Vercel detectará Vite. El archivo `vercel.json` fija `npm run build` y el directorio `dist`.
4. No configures funciones, backend, variables con claves de API ni analítica.
5. Despliega y realiza en el dominio HTTPS la prueba de navegador y la auditoría de red.

También puede desplegarse con Vercel CLI (`vercel`) desde un equipo de desarrollo, pero no es necesario instalar nada en el equipo corporativo del usuario final.
