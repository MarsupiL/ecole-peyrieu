import { useEffect } from 'react';

/** Native selects can retain :focus-visible after a pointer selection. */
export function useSelectFocus() {
  useEffect(() => {
    const clearPointerFocus = () => {
      document.querySelectorAll('select[data-pointer-focus]').forEach((select) => {
        select.removeAttribute('data-pointer-focus');
      });
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof HTMLElement)) return;
      const select = event.target.closest('select') ?? event.target.closest('label')?.control;
      if (select?.tagName === 'SELECT') select.setAttribute('data-pointer-focus', 'true');
    };
    const keyDown = (event: KeyboardEvent) => {
      if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) clearPointerFocus();
    };
    const focusOut = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.tagName === 'SELECT') {
        event.target.removeAttribute('data-pointer-focus');
      }
    };
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('keydown', keyDown, true);
    document.addEventListener('focusout', focusOut, true);
    return () => {
      document.removeEventListener('pointerdown', pointerDown, true);
      document.removeEventListener('keydown', keyDown, true);
      document.removeEventListener('focusout', focusOut, true);
      clearPointerFocus();
    };
  }, []);
}
