let currentView = 'main';
let currentApiKey = null;
let modelsLoaded = false;

document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  setupEventListeners();
  loadChatHistory();
  initializeModels();
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
  document.getElementById('refresh-models').addEventListener('click', refreshModels);
  document.getElementById('model-search').addEventListener('input', searchModels);
  document.getElementById('validate-key').addEventListener('click', validateApiKey);
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

async function loadSettings() {
  try {
    const keyData = await window.securityManager.getApiKey();
    if (keyData && keyData.key) {
      currentApiKey = keyData.key;
      document.getElementById('api-key').value = keyData.key;
      
      // Mostra status da chave
      updateKeyStatus(keyData);
      
      // Carrega modelos se a chave estiver validada
      if (keyData.validated) {
        await initializeModels();
      }
    }
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
  }
  
  const selectedModel = localStorage.getItem('selectedModel');
  if (selectedModel) {
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
      modelSelect.value = selectedModel;
    }
  }
}

function updateKeyStatus(keyData) {
  const statusDiv = document.getElementById('key-status');
  if (!statusDiv) return;

  const age = window.securityManager.getKeyAge(keyData.timestamp);
  const isValidated = keyData.validated;
  
  statusDiv.innerHTML = `
    <div class="key-status ${isValidated ? 'validated' : 'unvalidated'}">
      <span class="status-icon">${isValidated ? '✅' : '⚠️'}</span>
      <div class="status-text">
        <div>${isValidated ? 'Chave validada' : 'Chave não validada'}</div>
        <small>Salva ${age}</small>
      </div>
    </div>
  `;
}

async function initializeModels() {
  if (!currentApiKey) return;
  
  try {
    await loadModels();
  } catch (error) {
    console.error('Erro ao inicializar modelos:', error);
  }
}

async function loadModels(forceUpdate = false) {
  if (!currentApiKey) return;

  const loadingIndicator = document.getElementById('models-loading');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'block';
  }

  try {
    const models = await window.modelsManager.syncModels(currentApiKey, forceUpdate);
    populateModelSelect(models);
    modelsLoaded = true;
    
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  } catch (error) {
    console.error('Erro ao carregar modelos:', error);
    if (loadingIndicator) {
      loadingIndicator.innerHTML = '<small style="color: #dc3545;">Erro ao carregar modelos</small>';
    }
  }
}

function populateModelSelect(models) {
  const select = document.getElementById('model-select');
  if (!select) return;

  // Salva o valor atual
  const currentValue = select.value;

  // Limpa opções existentes
  select.innerHTML = '';

  // Adiciona modelos populares primeiro
  const popularModels = window.modelsManager.getPopularModels();
  if (popularModels.length > 0) {
    const popularGroup = document.createElement('optgroup');
    popularGroup.label = 'Modelos Recomendados';
    
    popularModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      popularGroup.appendChild(option);
    });
    
    select.appendChild(popularGroup);
  }

  // Agrupa outros modelos por categoria
  const categories = {};
  models.forEach(model => {
    if (popularModels.find(p => p.id === model.id)) return; // Pula se já está nos populares
    
    const category = window.modelsManager.getModelCategory(model.id);
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(model);
  });

  // Adiciona categorias
  Object.keys(categories).sort().forEach(category => {
    const group = document.createElement('optgroup');
    group.label = category;
    
    categories[category].forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      group.appendChild(option);
    });
    
    select.appendChild(group);
  });

  // Restaura o valor anterior se ainda existir
  if (currentValue) {
    select.value = currentValue;
  }
}

function searchModels() {
  const query = document.getElementById('model-search').value;
  if (window.modelsManager.models && window.modelsManager.models.length > 0) {
    const filteredModels = window.modelsManager.searchModels(query);
    populateModelSelect(filteredModels);
  }
}

async function refreshModels() {
  if (!currentApiKey) {
    alert('Configure uma API key primeiro');
    return;
  }
  
  await loadModels(true);
  alert('Modelos atualizados com sucesso!');
}

async function validateApiKey() {
  const apiKey = document.getElementById('api-key').value.trim();
  if (!apiKey) {
    alert('Insira uma API key primeiro');
    return;
  }

  const validateBtn = document.getElementById('validate-key');
  const originalText = validateBtn.textContent;
  validateBtn.textContent = 'Validando...';
  validateBtn.disabled = true;

  try {
    const result = await window.securityManager.validateApiKey(apiKey);
    
    if (result.valid) {
      await window.securityManager.markKeyAsValidated();
      alert('API key validada com sucesso!');
      
      // Atualiza status
      const keyData = await window.securityManager.getApiKey();
      updateKeyStatus(keyData);
      
      // Carrega modelos
      currentApiKey = apiKey;
      await loadModels(true);
    } else {
      alert(`Erro na validação: ${result.error}`);
    }
  } catch (error) {
    alert(`Erro ao validar: ${error.message}`);
  } finally {
    validateBtn.textContent = originalText;
    validateBtn.disabled = false;
  }
}

async function saveSettings() {
  const apiKey = document.getElementById('api-key').value.trim();
  const selectedModel = document.getElementById('model-select').value;

  if (!apiKey) {
    alert('Por favor, insira uma API key válida.');
    return;
  }

  try {
    // Salva API key de forma segura
    await window.securityManager.saveApiKey(apiKey);
    currentApiKey = apiKey;
    
    localStorage.setItem('selectedModel', selectedModel);
    
    alert('Configurações salvas com sucesso!');
    showMain();

    // Carrega modelos se ainda não foram carregados
    if (!modelsLoaded) {
      await loadModels();
    }
  } catch (error) {
    alert(`Erro ao salvar: ${error.message}`);
  }
}

async function sendMessage() {
  const userInput = document.getElementById('user-input').value.trim();
  if (userInput === '') return;

  if (!currentApiKey) {
    const keyData = await window.securityManager.getApiKey();
    if (!keyData || !keyData.key) {
      alert('Por favor, configure sua API key nas configurações.');
      showSettings();
      return;
    }
    currentApiKey = keyData.key;
  }
  
  const model = localStorage.getItem('selectedModel') || 'anthropic/claude-3.5-sonnet';

  addMessage('user', userInput);
  document.getElementById('user-input').value = '';
  
  // Show typing indicator
  const typingId = addMessage('assistant', 'Digitando...');
  
  makeApiRequest(userInput, currentApiKey, model)
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