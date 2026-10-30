# Historial de cambios

Todos los cambios relevantes de este proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- Aviso fijo en todas las páginas: el manual es un prototipo en desarrollo y no sustituye a la documentación oficial
  del fabricante ni a una prueba en laboratorio.

### Cambiado

- La guía de SNMP del Cisco Catalyst 1300 pasa de una comunidad v2c a SNMPv3: Engine ID, grupo con autenticación y
  cifrado, usuario con SHA y AES 128 (creado en la interfaz web, como indica Cisco) y una ACL de gestión que solo
  acepta consultas SNMP del servidor de monitorización. Ahora las cuatro marcas usan SNMPv3.
- En las guías de SNMP de Aruba y MikroTik, el paso que crea el usuario SNMPv3 vuelve a mostrar el comando completo
  para copiar. Las claves de autenticación y de cifrado se escriben en «Tus datos»: rellenan el comando, pero solo viven
  en memoria (no se guardan en el navegador y se borran al recargar) y salen como `********` en el registro del cambio.

## [1.1.0] - 2026-10-16

Planificador de red: del diseño de la red a los pasos de cada switch.

### Añadido

- Planificador de red (`#/plan`): VLAN con su propósito, switches con su modelo, enlaces y puertos de acceso; comprueba
  que el plan es coherente y genera los pasos de cada switch, del núcleo hacia fuera, con los comandos de su marca ya
  rellenos y un enlace para abrir cada guía con esos valores.
- Mapa de la red dibujado a partir del plan, plantillas de inicio y exportación e importación del plan en JSON.
- Artículo de fundamentos «Diseñar las VLAN por propósito».

## [1.0.0] - 2026-10-15

Primera versión publicada como release, con el HTML descargable.

### Añadido

- Registro del cambio en cada guía: equipo, ticket, resultado de la verificación y notas, para copiarlo, descargarlo
  como `.md` o imprimir la guía rellenada y guardarla como PDF.
- Panel de estado del contenido (`#/status`): guías por estado y riesgo, matriz de tareas por marca, aviso de las que
  llevan más de 180 días sin revisarse y filtro de las pendientes de probar.
- Pie de página con la versión y la fecha de la última revisión del contenido.
- Botón de tema en la cabecera (sistema, claro u oscuro), que se recuerda entre sesiones.
- Aviso destacado en las guías sin verificar.
- Accesibilidad: botón «Saltar al contenido», anuncio de las copias para lectores de pantalla y foco siempre visible.
- README con el uso, el desarrollo, cómo añadir guías y los niveles de verificación.
- Lint y formato con Biome (`npm run check`, `npm run format`).
- CI en GitHub Actions para cada pull request y publicación del HTML al crear una versión.

### Cambiado

- Nuevo aspecto pizarra e índigo en los temas claro y oscuro, con tarjetas con sombra y esquinas redondeadas.

### Corregido

- En pantallas de menos de 900 px las pestañas de marca desaparecían y el botón «Tareas» se salía de la pantalla.

## [0.1.0] - 2026-10-15

Primera versión utilizable, sin publicar como release.

### Añadido

- Guías interactivas para Aruba CX 6100, Cisco Catalyst 1300, MikroTik CRS317 y Ruijie NBS3200: comandos generados
  con tus valores, riesgos, comprobaciones previas, verificación y vuelta atrás.
- Tareas de puesta en marcha y acceso, VLAN y puertos, monitorización (SNMPv3 incluido) y seguridad y resiliencia.
- Fundamentos: qué es un switch, MAC, IP y VLAN, tipos de switch, gestión, marcas y cómo trabajar sin romper la red.
- Navegación con pestañas de marca, lateral de tareas, índice de secciones, búsqueda con `Ctrl+K` y guías recientes.
- Un único `index.html` que funciona sin conexión.
