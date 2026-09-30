# Jenga Celestial Online — 4 jugadores

Versión online del Jenga Celestial 3D. La interfaz y la lógica visual del juego se mantienen en `public/index.html`; el servidor únicamente añade las salas online y la sincronización mediante WebSocket.

## Estructura

- `public/index.html` — juego.
- `server.js` — servidor WebSocket y servidor web.
- `package.json` — dependencia y comando de inicio.
- `render.yaml` — configuración para Render.
- `.gitignore` — archivos que no se suben al repositorio.

## Ejecutar en local

```bash
npm install
npm start
```

Abrir `http://localhost:10000`.

## GitHub → Render

1. Crear un repositorio nuevo en GitHub.
2. Subir todos los archivos y carpetas de este proyecto, conservando `public/index.html`.
3. En Render, crear un **Web Service** conectado al repositorio.
4. Render usará `npm install` para instalar `ws` y `npm start` para iniciar el servidor.
5. Al terminar el despliegue, abrir la URL HTTPS de Render.
6. El primer jugador crea una sala y comparte el código con los otros tres.
7. Los otros tres abren la misma URL desde sus dispositivos y seleccionan **Unirse**.

El cliente detecta automáticamente HTTPS y utiliza `wss://` para la conexión segura WebSocket.

## Reglas online

- Máximo: 4 jugadores.
- El anfitrión ocupa el jugador 1.
- El anfitrión inicia la partida cuando están los 4 conectados.
- El servidor valida el turno y qué piezas ya fueron retiradas.
- La retirada de una pieza, el turno y la caída se sincronizan para todos.
- Si el anfitrión abandona, la sala se cierra.
