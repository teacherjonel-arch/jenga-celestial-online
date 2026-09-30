# Jenga Celestial Online - 4 jugadores

Proyecto preparado para GitHub + Render.

## Estructura
- public/index.html: juego Jenga 3D y sala online.
- server.js: servidor HTTP + WebSocket, salas de 4 jugadores y sincronización.
- package.json: dependencia ws y comando de inicio.
- render.yaml: configuración de Render.

## Flujo online
1. Jugador 1 abre la página y pulsa CREAR SALA.
2. Se genera un código de 6 caracteres.
3. Los jugadores 2, 3 y 4 abren el mismo enlace, pulsan UNIRSE y escriben el código.
4. La sala muestra 1/4, 2/4, 3/4 y 4/4.
5. Solo el anfitrión puede iniciar cuando hay 4 jugadores.
6. El servidor sincroniza turno, piezas retiradas, preguntas/respuestas y caída de la torre.

## Render
Build Command: npm install
Start Command: npm start
Root Directory: vacío

El WebSocket usa automáticamente wss:// cuando la página está en HTTPS.
