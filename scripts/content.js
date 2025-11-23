console.log('Experiment Toggle: Content script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getExperiments') {
    const experiments = [];
    const elements = document.querySelectorAll('[data-variant-key]');

    console.log('Found elements with data-variant-key:', elements.length);

    elements.forEach(el => {
      const key = el.getAttribute('data-variant-key');
      const value = el.getAttribute('data-variant-value');
      console.log('Element:', key, value);
      if (key && value) {
        experiments.push({ key, value });
      }
    });

    console.log('Total experiments:', experiments.length);
    sendResponse({ experiments });
  }
  return true;
});
