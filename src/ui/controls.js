export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null || v === false) return;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v === true ? '' : v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null || c === false) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

export const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

export function segmented(options, value, onChange, { small = false, label = '' } = {}) {
  const thumb = el('span', { class: 'segmented-thumb', 'aria-hidden': 'true' });
  const root = el('div', { class: `segmented${small ? ' small' : ''}`, role: 'tablist', 'aria-label': label }, [thumb]);
  let current = value;
  const buttons = options.map(opt => {
    const b = el('button', { role: 'tab', type: 'button', 'aria-selected': String(opt.value === current), text: opt.label });
    b.addEventListener('click', () => {
      if (opt.value === current) return;
      set(opt.value);
      onChange(opt.value);
    });
    root.appendChild(b);
    return b;
  });
  const place = () => {
    const i = options.findIndex(o => o.value === current);
    const b = buttons[i];
    if (!b || !b.offsetWidth) return;
    thumb.style.width = `${b.offsetWidth}px`;
    thumb.style.transform = `translateX(${b.offsetLeft}px)`;
  };
  function set(v) {
    current = v;
    buttons.forEach((b, i) => b.setAttribute('aria-selected', String(options[i].value === v)));
    place();
  }
  const ro = new ResizeObserver(place);
  ro.observe(root);
  root.set = set;
  return root;
}

export function slider({ label, min, max, step = 1, value, format = v => String(v), onInput, onChange }) {
  const out = el('span', { class: 'row-value', text: format(value) });
  const input = el('input', { type: 'range', min, max, step, value, 'aria-label': label });
  const paint = () => {
    const v = Number(input.value);
    input.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
    out.textContent = format(v);
  };
  paint();
  input.addEventListener('input', () => {
    paint();
    if (onInput) onInput(Number(input.value));
  });
  input.addEventListener('change', () => {
    if (onChange) onChange(Number(input.value));
  });
  const root = el('div', { class: 'slider-row' }, [
    el('div', { class: 'slider-head' }, [el('span', { class: 'row-label', text: label }), out]),
    input
  ]);
  root.setValue = v => {
    input.value = v;
    paint();
  };
  return root;
}

export function toggle(checked, onChange, label) {
  const b = el('button', { class: 'switch', role: 'switch', type: 'button', 'aria-checked': String(!!checked), 'aria-label': label });
  b.addEventListener('click', () => {
    const next = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return b;
}

export function row(label, control) {
  return el('div', { class: 'row' }, [el('span', { class: 'row-label', text: label }), control]);
}

export function group(label, children) {
  return el('section', { class: 'group' }, [label ? el('h3', { class: 'group-label', text: label }) : null, ...children]);
}

export function header(title, sub) {
  return el('div', {}, [el('h2', { class: 'inspector-title', text: title }), sub ? el('p', { class: 'inspector-sub', text: sub }) : null]);
}
