/**
 * Localiza a español los mensajes de validación nativa del navegador.
 *
 * Sin esto, cualquier input con `required`, `type="email"`, `pattern`, etc.
 * muestra el texto del navegador en su idioma (ej. "Please fill out this field"),
 * lo que rompe la regla de UI 100% en español. En vez de parchear cada formulario,
 * instalamos un listener global de `invalid` que reemplaza el mensaje, y uno de
 * `input` que limpia el customValidity para permitir la revalidación nativa.
 */

type ValidatableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isValidatable(el: EventTarget | null): el is ValidatableElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

function spanishMessageFor(el: ValidatableElement): string {
  const v = el.validity;
  if (v.valueMissing) return 'Por favor completa este campo.';
  if (v.typeMismatch) {
    if (el instanceof HTMLInputElement && el.type === 'email') return 'Ingresa un correo electrónico válido.';
    if (el instanceof HTMLInputElement && el.type === 'url') return 'Ingresa una URL válida (ej. https://...).';
    return 'El formato ingresado no es válido.';
  }
  if (v.rangeUnderflow) return `El valor mínimo permitido es ${(el as HTMLInputElement).min}.`;
  if (v.rangeOverflow) return `El valor máximo permitido es ${(el as HTMLInputElement).max}.`;
  if (v.tooShort) return `Debe tener al menos ${(el as HTMLInputElement).minLength} caracteres.`;
  if (v.tooLong) return `No debe superar ${(el as HTMLInputElement).maxLength} caracteres.`;
  if (v.stepMismatch || v.badInput) return 'El valor ingresado no es válido.';
  if (v.patternMismatch) return 'El valor no tiene el formato requerido.';
  return 'El valor ingresado no es válido.';
}

/** Installs the global handlers. Returns a cleanup function. */
export function setupSpanishFormValidation(): () => void {
  const onInvalid = (e: Event) => {
    if (isValidatable(e.target)) e.target.setCustomValidity(spanishMessageFor(e.target));
  };
  const onInput = (e: Event) => {
    // Clear so the browser re-runs native constraints (and shows our message) next submit.
    if (isValidatable(e.target)) e.target.setCustomValidity('');
  };
  document.addEventListener('invalid', onInvalid, true);
  document.addEventListener('input', onInput, true);
  return () => {
    document.removeEventListener('invalid', onInvalid, true);
    document.removeEventListener('input', onInput, true);
  };
}
