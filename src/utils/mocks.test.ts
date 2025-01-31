if (!('document' in globalThis)) {
  Object.defineProperty(globalThis, 'document', {
    value: {},
    writable: true,
  });

  /* @ts-expect-error hack */
  document.createElement = () => {
    return {
      href: '',
    };
  };
}

if (!('window' in globalThis)) {
  Object.defineProperty(globalThis, 'window', {
    value: {},
    writable: true,
  });

  /* @ts-expect-error hack */
  window.location = new URL('https://toto');
}

/* @ts-expect-error hack */
globalThis.createImageBitmap = () => {
  return {};
};
