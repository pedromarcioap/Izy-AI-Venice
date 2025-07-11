chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'makeApiRequest') {
    chrome.storage.sync.get(['openRouterApiKey', 'selectedModel'], function(result) {
      const apiKey = result.openRouterApiKey;
      const model = result.selectedModel;

      fetch(`https://api.openrouter.ai/v1/models/${model}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          prompt: request.prompt,
          // Outros parâmetros conforme necessário
        })
      })
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => sendResponse({ error: error.message }));
    });

    return true;  // Will respond asynchronously.
  }
});
