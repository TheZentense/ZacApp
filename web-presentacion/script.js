// =========================================================
// ANIMACIÓN DE APARICIÓN SUAVE AL HACER SCROLL
// =========================================================

// Creamos un observador que detecta cuando un elemento entra en pantalla
const observador = new IntersectionObserver((entradas) => {
  entradas.forEach((entrada) => {
    // Si el elemento ya es visible al menos en un 15%
    if (entrada.isIntersecting) {
      // Le agregamos la clase 'show' para que aparezca suavemente con la transición CSS
      entrada.target.classList.add('show');
      // Dejamos de observarlo para no repetir la animación innecesariamente
      observador.unobserve(entrada.target);
    }
  });
}, {
  threshold: 0.15 // Se activa cuando el 15% del elemento es visible
});

// Seleccionamos todos los elementos con la clase .reveal y los ponemos a observar
document.querySelectorAll('.reveal').forEach((elemento) => {
  observador.observe(elemento);
});