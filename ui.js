/* Polished select controls, with the native select retained for form data. */
(() => {
  let opened = null;
  function close() {
    if (!opened) return;
    const previous = opened; opened = null;
    if (typeof previous.menu.hidePopover === 'function' && previous.menu.matches(':popover-open')) previous.menu.hidePopover();
    previous.menu.remove(); previous.button.setAttribute('aria-expanded', 'false');
  }
  function enhance(select) {
    if (select.dataset.enhanced) return;
    select.dataset.enhanced = 'true'; select.tabIndex = -1;
    const wrapper = document.createElement('div'); wrapper.className = 'select-control';
    select.before(wrapper); wrapper.append(select);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'select-trigger';
    button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
    const label = document.querySelector(`label[for="${select.id}"]`);
    button.setAttribute('aria-label', label?.textContent || select.getAttribute('aria-label') || 'Choose an option');
    wrapper.append(button);
    function refresh() {
      button.textContent = select.selectedOptions[0]?.textContent || 'Choose an option';
      button.disabled = select.disabled;
      if (opened?.button === button) close();
    }
    select.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(select, { childList: true, subtree: true, attributes: true });
    function open() {
      if (opened?.button === button) { close(); return; }
      close();
      const menu = document.createElement('div'); menu.className = 'select-menu'; menu.setAttribute('role', 'listbox');
      // The top layer avoids clipping and transformed dialog coordinates.
      menu.setAttribute('popover', 'manual');
      const menuId = `${select.id || 'choice'}-options`; menu.id = menuId; button.setAttribute('aria-controls', menuId);
      let lastGroup = '';
      for (const option of select.options) {
        const group = option.parentElement.tagName === 'OPTGROUP' ? option.parentElement.label : '';
        if (group && group !== lastGroup) { const heading = document.createElement('div'); heading.className = 'select-group'; heading.textContent = group; menu.append(heading); }
        lastGroup = group;
        const item = document.createElement('button'); item.type = 'button'; item.className = 'select-option';
        item.textContent = option.textContent; item.disabled = option.disabled || option.parentElement.disabled;
        item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(option.selected));
        item.onclick = () => { select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true })); close(); button.focus({ preventScroll: true }); };
        menu.append(item);
      }
      (select.closest('dialog') || document.body).append(menu);
      if (typeof menu.showPopover === 'function') menu.showPopover();
      function position() {
        const rect = button.getBoundingClientRect();
        if (!button.isConnected || !rect.width) { close(); return; }
        const below = innerHeight - rect.bottom - 16;
        menu.style.width = `${Math.min(rect.width, innerWidth - 24)}px`;
        menu.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - rect.width - 12))}px`;
        const room = below > 180 ? below : rect.top - 16;
        menu.style.maxHeight = `${Math.min(300, Math.max(100, room))}px`;
        menu.style.top = 'auto'; menu.style.bottom = 'auto';
        if (below > 180) menu.style.top = `${Math.max(8, rect.bottom + 6)}px`;
        else menu.style.bottom = `${Math.max(8, innerHeight - rect.top + 6)}px`;
      }
      opened = { menu, button, position }; button.setAttribute('aria-expanded', 'true');
      position();
      (menu.querySelector('[aria-selected="true"]') || menu.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
      menu.onkeydown = event => {
        const items = [...menu.querySelectorAll('button:not(:disabled)')]; const index = items.indexOf(document.activeElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus({ preventScroll: true });
        } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); button.focus({ preventScroll: true }); }
        else if (event.key === 'Tab') { close(); button.focus({ preventScroll: true }); }
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) items.find(item => item.textContent.toLowerCase().startsWith(event.key.toLowerCase()))?.focus({ preventScroll: true });
      };
    }
    button.onclick = open;
    button.onkeydown = event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); } };
    refresh();
  }
  const scan = () => document.querySelectorAll('select').forEach(enhance);
  scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('pointerdown', event => { if (opened && !opened.menu.contains(event.target) && !opened.button.contains(event.target)) close(); });
  window.addEventListener('resize', () => opened?.position());
  window.addEventListener('scroll', event => {
    // Scrolling the options (including focus-driven scrolling) must keep the list open.
    if (opened && (event.target === opened.menu || opened.menu.contains(event.target))) return;
    opened?.position();
  }, true);
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('close', close);
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  });
  const zone = document.getElementById('file-drop-zone');
  zone?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('upload-file-input').click(); } });
  function destination() {
    const subject = subjectObj(document.getElementById('upload-subject').value);
    document.getElementById('upload-destination').textContent = subject ? `Save to: STUD / ${semesterName(subject.semesterId)} / ${subject.name} / ${categoryFolders[document.getElementById('upload-category').value]}` : 'Add a module to organize your documents.';
  }
  document.getElementById('upload-subject').addEventListener('change', destination);
  document.getElementById('upload-category').addEventListener('change', destination);
  new MutationObserver(destination).observe(document.getElementById('upload-modal'), { attributes: true, attributeFilter: ['open'] });
  const toastEl = document.getElementById('toast'); toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
})();
