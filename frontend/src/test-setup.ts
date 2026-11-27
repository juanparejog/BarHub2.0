/**
 * Se ejecuta antes de cada fichero de tests. El navegador de los tests (jsdom) dice estar en inglés,
 * así que sin esto la aplicación saldría en inglés y los tests, escritos con los textos en español,
 * no los encontrarían. Los tests de idiomas cambian el idioma por su cuenta.
 */
beforeEach(() => {
  try {
    localStorage.setItem('barhub.idioma', 'es');
  } catch {
    // Sin almacenamiento: el test que lo necesite lo dirá
  }
});
