function sendMessage() {
  const userInput = document.getElementById('user-input').value;
  if (userInput.trim() === '') return;

  const messagesContainer = document.getElementById('messages');
  const userMessage = document.createElement('div');
  userMessage.textContent = `Você: ${userInput}`;
  messagesContainer.appendChild(userMessage);

  document.getElementById('user-input').value = '';

  chrome.runtime.sendMessage({ action: 'makeApiRequest', prompt: userInput }, function(response) {
    const aiMessage = document.createElement('div');
    aiMessage.textContent = `AI: ${response.reply}`;
    messagesContainer.appendChild(aiMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

window.onload = function() {
  chrome.storage.sync.get(['openRouterApiKey', 'selectedModel'], function(result) {
    if (!result.openRouterApiKey || !result.selectedModel) {
      alert('Por favor, configure sua API key e modelo nas configurações da extensão.');
    }
  });
};
