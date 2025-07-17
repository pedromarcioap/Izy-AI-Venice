chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'makeApiRequest') {
    chrome.storage.sync.get(['openRouterApiKey', 'selectedModel'], function(result) {
      const apiKey = result.openRouterApiKey;
      const model = result.selectedModel || 'anthropic/claude-3.5-sonnet';

      if (!apiKey) {
        sendResponse({ error: 'API key not configured' });
        return;
      }

      fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'Izy AI Venice Extension'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.choices && data.choices[0] && data.choices[0].message) {
          sendResponse({ reply: data.choices[0].message.content });
        } else {
          sendResponse({ error: 'Invalid response format' });
        }
      })
      .catch(error => {
        console.error('API Error:', error);
        sendResponse({ error: error.message });
      });
    });

    return true; // Will respond asynchronously
  }
});