let currentView = 'main';

document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  setupEventListeners();
  loadChatHistory();
});

function setupEventListeners() {
  // Main view elements
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('user-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  document.getElementById('settings-btn').addEventListener('click', showSettings);

  // Settings view elements
  document.getElementById('back-btn').addEventListener('click', showMain);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('clear-chat').addEventListener('click', clearChat);
}

function showSettings() {
  document.getElementById('main-view').classList.add('hidden');
  document.getElementById('settings-view').classList.remove('hidden');
  currentView = 'settings';
}

function showMain() {
  document.getElementById('settings-view').classList.add('hidden');
  document.getElementById('main-view').classList.remove('hidden');
  currentView = 'main';
}

function loadSettings() {
  chrome.storage.sync.get(['openRouterApiKey', 'selectedModel'], function(result) {
    if (result.openRouterApiKey) {
      document.getElementById('api-key').value = result.openRouterApiKey;
    }
    if (result.selectedModel) {
      document.getElementById('model-select').value = result.selectedModel;
    }
  });
}

function saveSettings() {
  const apiKey = document.getElementById('api-key').value.trim();
  const selectedModel = document.getElementById('model-select').value;

  if (!apiKey) {
    alert('Por favor, insira uma API key válida.');
    return;
  }

  chrome.storage.sync.set({
    openRouterApiKey: apiKey,
    selectedModel: selectedModel
  }, function() {
    alert('Configurações salvas com sucesso!');
    showMain();
  });
}

function sendMessage() {
  const userInput = document.getElementById('user-input').value.trim();
  if (userInput === '') return;

  // Check if settings are configured
  chrome.storage.sync.get(['openRouterApiKey'], function(result) {
    if (!result.openRouterApiKey) {
      alert('Por favor, configure sua API key nas configurações.');
      showSettings();
      return;
    }

    addMessage('user', userInput);
    document.getElementById('user-input').value = '';
    
    // Show typing indicator
    const typingId = addMessage('assistant', 'Digitando...');
    
    chrome.runtime.sendMessage({ 
      action: 'makeApiRequest', 
      prompt: userInput 
    }, function(response) {
      // Remove typing indicator
      document.getElementById(typingId).remove();
      
      if (response.error) {
        addMessage('error', `Erro: ${response.error}`);
      } else {
        addMessage('assistant', response.reply);
      }
      
      saveChatHistory();
    });
  });
}

function addMessage(type, content) {
  const messagesContainer = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  messageDiv.id = messageId;
  messageDiv.className = `message ${type}-message`;
  
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = type === 'user' ? '👤' : type === 'error' ? '⚠️' : '🤖';
  
  const content_div = document.createElement('div');
  content_div.className = 'message-content';
  content_div.textContent = content;
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content_div);
  messagesContainer.appendChild(messageDiv);
  
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  return messageId;
}

function clearChat() {
  if (confirm('Tem certeza que deseja limpar o chat?')) {
    document.getElementById('messages').innerHTML = '';
    chrome.storage.local.remove('chatHistory');
  }
}

function saveChatHistory() {
  const messages = document.getElementById('messages').innerHTML;
  chrome.storage.local.set({ chatHistory: messages });
}

function loadChatHistory() {
  chrome.storage.local.get(['chatHistory'], function(result) {
    if (result.chatHistory) {
      document.getElementById('messages').innerHTML = result.chatHistory;
      const messagesContainer = document.getElementById('messages');
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });
}