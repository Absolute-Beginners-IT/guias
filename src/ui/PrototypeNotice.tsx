/** Shown on every page: the manual is still a prototype and must say so. */
export function PrototypeNotice() {
  return (
    <p className="prototype-notice" role="note" aria-label="Aviso de prototipo">
      <strong>Prototipo en desarrollo:</strong> el contenido se está revisando y no sustituye a la documentación oficial
      del fabricante ni a una prueba en laboratorio.
    </p>
  )
}
