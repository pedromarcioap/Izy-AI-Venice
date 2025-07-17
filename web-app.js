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
  const apiKey = localStorage.getItem('openRouterApiKey');
  const selectedModel = localStorage.getItem('selectedModel');
  
  if (apiKey) {
    document.getElementById('api-key').value = apiKey;
  }
  if (selectedModel) {
    document.getElementById('model-select').value = selectedModel;
  }
}

function saveSettings() {
  const apiKey = document.getElementById('api-key').value.trim();
  const selectedModel = document.getElementById('model-select').value;

  if (!apiKey) {
    alert('Por favor, insira uma API key válida.');
    return;
  }

  localStorage.setItem('openRouterApiKey', apiKey);
  localStorage.setItem('selectedModel', selectedModel);
  
  alert('Configurações salvas com sucesso!');
  showMain();
}

function sendMessage() {
  const userInput = document.getElementById('user-input').value.trim();
  if (userInput === '') return;

  const apiKey = localStorage.getItem('openRouterApiKey');
  const model = localStorage.getItem('selectedModel') || 'anthropic/claude-3.5-sonnet';

  if (!apiKey) {
    alert('Por favor, configure sua API key nas configurações.');
    showSettings();
    return;
  }

  addMessage('user', userInput);
  document.getElementById('user-input').value = '';
  
  // Show typing indicator
  const typingId = addMessage('assistant', 'Digitando...');
  
  makeApiRequest(userInput, apiKey, model)
    .then(response => {
      // Remove typing indicator
      document.getElementById(typingId).remove();
      
      if (response.error) {
        addMessage('error', `Erro: ${response.error}`);
      } else {
        addMessage('assistant', response.reply);
      }
      
      saveChatHistory();
    })
    .catch(error => {
      // Remove typing indicator
      document.getElementById(typingId).remove();
      addMessage('error', `Erro: ${error.message}`);
      saveChatHistory();
    });
}

async function makeApiRequest(prompt, apiKey, model) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Izy AI Venice Web App'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return { reply: data.choices[0].message.content };
    } else {
      return { error: 'Invalid response format' };
    }
  } catch (error) {
    console.error('API Error:', error);
    return { error: error.message };
  }
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
    localStorage.removeItem('chatHistory');
  }
}

function saveChatHistory() {
  const messages = document.getElementById('messages').innerHTML;
  localStorage.setItem('chatHistory', messages);
}

function loadChatHistory() {
  const chatHistory = localStorage.getItem('chatHistory');
  if (chatHistory) {
    document.getElementById('messages').innerHTML = chatHistory;
    const messagesContainer = document.getElementById('messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}