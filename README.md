# Manual de Switching

Guías interactivas para configurar switches de forma segura: eliges la marca y la tarea, escribes tus valores y
obtienes los comandos listos para copiar, con los riesgos, la verificación y la vuelta atrás de cada cambio. Es un
único archivo HTML que funciona sin conexión.

| Marca | Equipo | Gestión |
|-------|--------|---------|
| HPE Aruba Networking | Aruba CX 6100 (AOS-CX) | Línea de comandos |
| Cisco | Catalyst 1300 | Línea de comandos |
| MikroTik | CRS317 (RouterOS 7) | Línea de comandos |
| Ruijie Reyee | NBS3200 | Interfaz web |

Incluye 72 guías en 19 tareas (puesta en marcha y acceso, VLAN y puertos, monitorización, seguridad y resiliencia),
7 artículos de fundamentos y un planificador de red que genera los pasos de cada switch a partir del
diseño de la red.

## Uso rápido

1. Descarga el último `manual-switching-vX.Y.Z.html` de la página de
   [releases](https://github.com/RealUchijavi/Manual-Switches/releases) o genera `dist/index.html` con `npm run build`.
2. Ábrelo con doble clic. No necesita servidor ni internet.
3. Elige la marca arriba y la tarea en el lateral, o busca con `Ctrl+K`.
4. Rellena **Tus datos**: los comandos se completan solos y solo se pueden copiar cuando todos los valores son válidos.
5. Sigue **Antes de empezar**, **Paso a paso** y **Verificación**. Si algo falla, aplica **Vuelta atrás**.
6. En **Registro del cambio**, anota el equipo y el ticket y copia o descarga el registro para el ticket. También
   puedes imprimir la guía rellenada o guardarla como PDF.

El tema claro u oscuro se cambia con el botón de la cabecera. El **Estado del contenido**, enlazado en el pie de página,
muestra qué guías están contrastadas, cuáles faltan por probar y cuáles conviene revisar.

### Planificador de red

El **Planificador de red** de la cabecera (`#/plan`) sirve para diseñar o documentar la red de una empresa y sacar los
pasos de cada switch:

1. En **VLAN**, empieza con una plantilla o añade las VLAN una a una, con su propósito. Marca una como Gestión.
2. En **Switches**, elige el modelo de cada uno y su IP de gestión. El primero es el núcleo.
3. En **Enlaces**, indica qué puerto de cada switch une a cuál. Cada enlace se configura como trunk en los dos extremos.
4. En **Puertos**, asigna los puertos de acceso a su VLAN.
5. En **Guía**, si todo encaja, tienes los pasos de cada switch, del núcleo hacia fuera, con los comandos de su marca ya
   rellenos. «Abrir la guía con estos datos» lleva a la guía completa con los valores puestos.

El mapa de la red se dibuja solo a partir del plan. El plan se guarda en el navegador y se puede exportar e importar como
JSON. No cubre el enrutamiento entre VLAN, el DHCP ni el cortafuegos.

Los valores y los pasos marcados se guardan en el navegador de ese ordenador. Las claves (como las de SNMPv3) se
piden en campos aparte que solo viven en memoria: rellenan los comandos, pero no se guardan en el navegador y salen
como `********` en el registro del cambio.

## Cómo leer cada guía

| Indicador | Significado |
|-----------|-------------|
| Riesgo bajo | No afecta al tráfico ni al acceso de gestión. |
| Riesgo medio | Puede cortar un puerto o un servicio concreto. |
| Riesgo alto | Puede dejar sin red a muchos equipos o dejarte sin acceso; usa siempre la red de seguridad de la marca. |
| Sin verificar | Algún comando no se ha podido confirmar en la documentación oficial. Pruébala antes en laboratorio. |
| Contrastada con documentación | Pasos y comandos comprobados en la guía oficial del fabricante para el firmware indicado. |
| Probada en equipo real | Ejecutada en un switch de laboratorio, con una nota de dónde y con qué firmware. |

## Desarrollo

Necesitas Node 24 (ver `.nvmrc`).

```bash
npm ci
npm run dev        # servidor de desarrollo
npm test           # pruebas (Vitest)
npm run typecheck  # comprobación de tipos
npm run lint       # solo lint (Biome)
npm run check      # lint, formato y orden de imports (Biome)
npm run format     # aplica el formato y los arreglos automáticos del lint
npm run build      # genera dist/index.html
```

Cada pull request a `main` pasa por el CI de GitHub Actions: `check`, `typecheck`, `test` y `build`. Al crear una
etiqueta `vX.Y.Z`, el workflow de release publica el HTML en GitHub.

## Cómo añadir o corregir una guía

El contenido vive en YAML, separado del código:

| Carpeta | Contiene |
|---------|----------|
| `src/content/platforms/` | Una ficha por marca: sistema, modelos, cómo se guarda la configuración y redes de seguridad. |
| `src/content/concepts/` | Una tarea por archivo: qué es, riesgos y requisitos, comunes a todas las marcas. |
| `src/content/procedures/<marca>/<tarea>.yaml` | La guía de esa tarea en esa marca. |
| `src/content/fundamentals/` | Artículos de fundamentos. |

Una guía tiene estas partes, en este orden: `summary`, `risk`, `params`, `preflight`, `steps`, `verification`,
`rollback`, `sources` y `status`. Copia una guía parecida de la misma marca como punto de partida.

Reglas que comprueba `npm test`:

- Todo `{{param}}` usado en comandos o textos tiene que estar declarado en `params`.
- Un paso sin comandos lleva `manual: true`; en las marcas gestionadas por web, todos los pasos son manuales.
- Un parámetro que pida contraseñas, claves o comunidades tiene que ser de tipo `secret`.
- Toda guía tiene riesgo, fuentes y vuelta atrás. Restaurar, LAG, IP de gestión, firmware y ACL de gestión son
  siempre de riesgo alto.
- `lab-tested` exige una nota que diga dónde se probó.

Para subir una guía de nivel:

1. **Sin verificar → Contrastada:** confirma cada comando en la documentación oficial y añade la fuente en `sources`.
2. **Contrastada → Probada:** ejecútala completa, incluida la vuelta atrás, en un equipo de laboratorio. Actualiza
   `status.level`, `status.reviewed`, `status.firmware` y `status.notes`.

Los textos de la interfaz y del contenido se escriben en español de España; el código y los mensajes de commit, en
inglés con [Conventional Commits](https://www.conventionalcommits.org/es/).

## Estructura del código

| Ruta | Responsabilidad |
|------|-----------------|
| `src/domain/` | Esquema del contenido, carga del catálogo, generación de comandos y validación de valores. |
| `src/features/` | Pantallas: navegación, guía, ficha de marca, fundamentos, estado y planificador de red. |
| `src/ui/` | Componentes reutilizables. |
| `src/lib/` | Rutas por hash, estado guardado en el navegador y portapapeles. |
| `odd/tasks/` | Seguimiento de cada funcionalidad: requisitos, tareas y registro de decisiones. |

El historial de versiones está en [CHANGELOG.md](CHANGELOG.md).
