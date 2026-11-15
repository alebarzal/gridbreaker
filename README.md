# Grid Breaker

Arcade tipo "breakout de cuadrícula": la bola excava túneles en un campo de 40×46 celdas diminutas.
5 mundos, 30 niveles, 5 jefes, 10 power-ups. Web (TypeScript + Vite + Canvas 2D) y Android (Capacitor).

## Arrancar

```bash
npm install
npm run dev -- --host
```

Abre la URL que aparece en la terminal. Con `--host` también sale una dirección de red
(`http://192.168.x.x:5173`) para probarlo desde el móvil conectado a la misma wifi.

`npm run build` comprueba los tipos y genera la versión de producción en `dist/`.

### Controles

| | Móvil | PC |
|---|---|---|
| Mover la pala | arrastrar el dedo | ratón o flechas ← → |
| Lanzar / soltar bola (imán) | toque corto | clic, espacio |
| Pausa | botón ⏸ o botón atrás | P o Escape |
| Silenciar | botón del altavoz | M |

### Modo debug

Tecla **D**, 5 toques rápidos sobre el título, o abrir con `?debug=1` (o `?testUpdate=1`).

- En partida muestra FPS y nº de bolas. Teclas: **N** saltar nivel, **B** +25 bolas, **K** dañar al jefe,
  **L** vida extra, **U** soltar un power-up. En el menú de pausa aparece "Saltar nivel".
- Desbloquea todos los niveles en el selector.
- En el menú principal añade: **Simular actualización** (aviso falso de la v99.0.0),
  **Reset versión vista** (vuelve a mostrar las novedades) y **Desbloquear todo**.

## Estructura

```
src/
  main.ts            arranque: guardado, novedades, aviso de actualización
  config.ts          medidas lógicas, repo de GitHub, versión
  core/              App (bucle con timestep fijo a 120 Hz, entrada, escalado), escenas,
                     audio (Web Audio), guardado, semver, novedades, actualizaciones, plataforma
  game/              Grid, Ball, Paddle, PowerUp, Projectile, Particles, levels
  game/bosses/       Boss (base + ataques compartidos) y los 5 jefes
  scenes/            Menú, Selector de niveles, Juego, Pausa, Game Over, Victoria, Ajustes
  data/levels/       world1..5.json  (niveles)
  data/changelog.json
scripts/             make-icon.mjs (icono pixel-art) y bot.js (bot de pruebas)
android/             proyecto Android generado por Capacitor
```

La colisión bola-cuadrícula solo mira las celdas que toca la bola (como mucho 4 por paso), nunca
la cuadrícula entera, y la cuadrícula se pinta en un canvas aparte que solo redibuja las celdas que cambian.

## Crear un nivel nuevo

Los niveles viven en `src/data/levels/worldN.json`. Añade un objeto a la lista `levels` del mundo:

```json
{
  "name": "Mi nivel",
  "speed": 1.1,
  "target": 0.85,
  "par": 120,
  "drops": 0.05,
  "map": [
    "....................",
    ".##################.",
    ".#X####PP#####X####.",
    "MMMMMM......MMMMMMMM",
    "..K..............K..",
    ".MMMMMMDDDDDDMMMMMM."
  ]
}
```

- `map`: cada carácter es un bloque. Con filas de 20 caracteres cada bloque ocupa 2×2 celdas; con filas de
  40, una celda. Las filas se colocan desde arriba (máximo 46 celdas de alto; deja hueco abajo).

  | Carácter | Celda |
  |---|---|
  | `.` | vacío |
  | `#` | normal (1 golpe) |
  | `2` `3` | dura (2 o 3 golpes, cambia de color) |
  | `I` | hielo (2 golpes) |
  | `M` | metal, indestructible |
  | `X` | explosiva (rompe las vecinas en radio 2, en cadena) |
  | `P` | power-up garantizado |
  | `K` | llave: al romper todas se abren las puertas |
  | `D` | puerta de metal |
  | `R` | lava: se regenera a los pocos segundos |

- `speed`: multiplicador de velocidad de la bola. `target`: fracción de celdas a romper para ganar.
  `par`: segundos para la estrella de tiempo. `drops`: probabilidad de power-up por celda rota.
- `boss`: `"worm"`, `"golem"`, `"queen"`, `"dragon"` o `"core"` convierte el nivel en un combate (se ignora `target`).
- `modifiers` (en el nivel o en el mundo): `{ "slippery": true }` (hielo),
  `{ "regenDelay": 6 }` (segundos de regeneración de `R`),
  `{ "gravity": { "strength": 1, "period": 8, "dirs": ["down", "up", "left"] } }` (gravedad que rota cada `period` s).

El selector muestra 6 niveles por mundo. Para un mundo nuevo, crea `world6.json` (copia la cabecera
`id`, `name`, `music`, `theme` de otro) e impórtalo en `src/game/levels.ts`.

Estrellas: 1 por superar el nivel (llegar al % objetivo o derrotar al jefe), 1 por hacerlo dentro del
tiempo `par` y 1 por no perder ninguna vida.

Para comprobar que un nivel se puede superar: con `npm run dev` abierto, en la consola del navegador
`await import('/scripts/bot.js'); __bot(0, 30)` hace jugar a un bot todos los niveles a cámara rápida.

## Añadir una entrada al changelog

1. Sube la versión en `package.json` (`"version": "1.1.0"`). Es la única fuente de verdad: Vite la inyecta
   en la app y Gradle la usa como `versionName`/`versionCode` del APK.
2. Añade la entrada **al principio** de `src/data/changelog.json`:

```json
{
  "version": "1.1.0",
  "fecha": "2026-12-01",
  "novedades": ["Mundo 6: Abismo", "Nuevo power-up: bola fantasma"],
  "resumen": "Mundo 6 y un power-up nuevo."
}
```

`novedades` se muestra completo mientras sea la versión instalada; `resumen` (2-3 líneas) es lo que se ve
plegado cuando pasa a ser una versión anterior. Al abrir la app con una versión mayor que la última vista,
el modal "Novedades" aparece solo; también está en Ajustes > Novedades.

## Generar el APK

Requisitos: Android Studio (incluye el JDK 21 que necesita Gradle; con JDK 25 la compilación falla).

```bash
npm run build && npx cap sync android
```

```bash
npx cap open android
```

Sin abrir Android Studio, desde `android/` (con `JAVA_HOME` apuntando a un JDK 21): `.\gradlew.bat assembleDebug` deja el APK de depuración en `android/app/build/outputs/apk/debug/app-debug.apk`.

En Android Studio: **Build > Generate App Bundles or APKs > Generate APKs** (o *Generate Signed App Bundle or APK*
para una versión firmada). El APK queda en `android/app/build/outputs/apk/`.

> En Windows, si el proyecto está en una ruta muy larga, Gradle y `@capacitor/assets` fallan por el
> límite de 260 caracteres. Tenlo en una ruta corta (por ejemplo `C:\dev\gridbreaker`).

Ya configurado en el proyecto Android: `appId` `com.alebarzal.gridbreaker`, orientación vertical,
pantalla completa inmersiva (`MainActivity.java`), permiso de vibración, pantalla encendida durante la
partida, pausa al pasar a segundo plano y botón atrás (en partida pausa; en la pausa continúa; en los
demás menús vuelve atrás; en el menú principal sale).

Para regenerar icono y splash (el dibujo está en `scripts/make-icon.mjs`):

```bash
npm run icons
```

### APK firmado para publicar

La firma usa una clave tuya, que se crea una sola vez:

```bash
keytool -genkeypair -v -keystore android/gridbreaker-release.jks -alias gridbreaker -keyalg RSA -keysize 2048 -validity 10000
```

Te pedirá una contraseña y unos datos (nombre, etc.). Después copia `android/keystore.properties.example`
como `android/keystore.properties` y pon ahí esa contraseña. Con eso, desde `android/`:
`.\gradlew.bat assembleRelease` deja el APK firmado en `android/app/build/outputs/apk/release/app-release.apk`
(sin `keystore.properties` sale `app-release-unsigned.apk`, que no se puede instalar).

Guarda copia del `.jks` y de la contraseña fuera del proyecto: ninguno de los dos se sube al repo y, si los
pierdes, las versiones nuevas no se podrán instalar encima de las anteriores.

## Publicar una Release (aviso de actualización)

Al abrir, la app consulta `https://api.github.com/repos/alebarzal/gridbreaker/releases/latest`
(4 s de límite; si falla, no hace nada). El repositorio se configura en `src/config.ts`
(`GITHUB_OWNER`, `GITHUB_REPO`) y debe ser público.

1. Sube la versión en `package.json` y añade la entrada al changelog.
2. Genera el APK.
3. En GitHub: **Releases > Draft a new release**, tag `vX.Y.Z` (igual que `package.json`, con la `v`),
   escribe las notas (se muestran en el aviso) y adjunta el `.apk`. Publícala como release normal,
   no como *pre-release* (la API de "latest" las ignora).

Con la CLI de GitHub:

```bash
gh release create v1.1.0 android/app/build/outputs/apk/release/app-release.apk --title "v1.1.0" --notes "Mundo 6 y un power-up nuevo."
```

Las instalaciones con una versión menor verán "Nueva versión X.Y.Z disponible" con **Descargar**
(abre el `.apk` de la release, o la página de la release si no hay APK adjunto) y **Más tarde**
(no vuelve a avisar de esa versión hasta el día siguiente).
