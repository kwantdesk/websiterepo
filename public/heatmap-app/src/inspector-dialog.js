/** Shared inspector controls stay mounted; opening settings never restarts the map. */
export function createInspectorDialog({ dialog, title, onChange = () => {} }) {
  let opener = null;
  const closeMenus = () => {
    const pickers = [...dialog.querySelectorAll('.kwant-select.open')];
    for (const picker of pickers) {
      picker.classList.remove('open');
      picker.querySelector('.kwant-select-menu')?.classList.add('hidden');
      picker.querySelector('.kwant-select-trigger')?.setAttribute('aria-expanded', 'false');
    }
    return pickers.length > 0;
  };
  const finish = () => {
    // A delayed native close event must not close a freshly reopened dialog.
    if (dialog.open) return;
    dialog.classList.remove('open');
    closeMenus();
    onChange(false);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  };
  const close = () => {
    if (dialog.open) dialog.close();
    finish();
  };
  dialog.addEventListener('close', finish);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    // First Escape dismisses an expanded select; the next dismisses settings.
    if (!closeMenus()) close();
  });
  dialog.addEventListener('pointerdown', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      event.preventDefault();
      close();
    }
  });
  return {
    open(label) {
      title.textContent = label;
      if (dialog.open) return;
      opener = dialog.ownerDocument.activeElement;
      dialog.classList.add('open');
      dialog.showModal();
      onChange(true);
    },
    close,
  };
}
