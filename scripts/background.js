chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request)
    .then(sendResponse)
    .catch(error => sendResponse({ error: error.message }));
  return true;
});

async function handleMessage(request) {
  switch (request.action) {
    case 'getCookie':
      return getCookie(request.url, request.name);
    case 'setCookie':
      return setCookie(request.url, request.name, request.value);
    default:
      throw new Error(`Unknown action: ${request.action}`);
  }
}

async function getCookie(url, name) {
  try {
    const cookie = await chrome.cookies.get({ url, name });
    return { cookie };
  } catch (error) {
    return { error: error.message };
  }
}

async function setCookie(url, name, value) {
  try {
    const urlObj = new URL(url);
    const existingCookie = await chrome.cookies.get({ url, name });

    const cookieDetails = {
      url,
      name,
      value,
      path: existingCookie?.path || '/',
      secure: existingCookie?.secure || urlObj.protocol === 'https:',
      sameSite: existingCookie?.sameSite || 'lax'
    };

    if (existingCookie?.domain?.startsWith('.')) {
      cookieDetails.domain = existingCookie.domain;
    }

    if (existingCookie?.expirationDate) {
      cookieDetails.expirationDate = existingCookie.expirationDate;
    } else {
      cookieDetails.expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
    }

    const result = await chrome.cookies.set(cookieDetails);

    if (!result) {
      throw new Error('Failed to set cookie');
    }

    return { success: true, cookie: result };
  } catch (error) {
    return { error: error.message };
  }
}
