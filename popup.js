let currentView = 'main';
let modelsLoaded = false;
let currentApiKey = null;

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
  document.getElementById('clear-cache').addEventListener('click', clearModelsCache);
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

    // Carrega modelo selecionado
    chrome.storage.sync.get(['selectedModel'], function(result) {
      if (result.selectedModel) {
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
          modelSelect.value = result.selectedModel;
        }
      }
    });
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
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
  const refreshBtn = document.getElementById('refresh-models');
  
  if (loadingIndicator) {
    loadingIndicator.style.display = 'block';
    loadingIndicator.innerHTML = '<small>🔄 Carregando modelos...</small>';
  }
  
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '⏳';
  }

  try {
    console.log('🚀 Iniciando carregamento de modelos...');
    const models = await window.modelsManager.syncModels(currentApiKey, forceUpdate);
    console.log('📊 Modelos carregados:', models.length);
    
    populateModelSelect(models);
    modelsLoaded = true;
    
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    
    // Mostra estatísticas
    const stats = window.modelsManager.getModelStats();
    console.log('📈 Estatísticas:', stats);
    updateModelsStats();
    
  } catch (error) {
    console.error('Erro ao carregar modelos:', error);
    if (loadingIndicator) {
      loadingIndicator.innerHTML = `<small style="color: #dc3545;">❌ Erro: ${error.message}</small>`;
    }
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '🔄';
    }
  }
}

function populateModelSelect(models) {
  const select = document.getElementById('model-select');
  if (!select) return;

  console.log('🎨 Populando select com', models.length, 'modelos');

  // Salva o valor atual
  const currentValue = select.value;

  // Limpa opções existentes
  select.innerHTML = '';

  if (models.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Nenhum modelo disponível';
    option.disabled = true;
    select.appendChild(option);
    return;
  }

  // Adiciona modelos populares primeiro
  const popularModels = window.modelsManager.getPopularModels();
  if (popularModels.length > 0) {
    const popularGroup = document.createElement('optgroup');
    popularGroup.label = `⭐ Recomendados (${popularModels.length})`;
    
    popularModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.displayName || model.name;
      popularGroup.appendChild(option);
    });
    
    select.appendChild(popularGroup);
  }

  // Agrupa outros modelos por categoria
  const categories = {};
  models.forEach(model => {
    if (model.isPopular) return; // Pula se já está nos populares
    
    const category = model.category;
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(model);
  });

  // Adiciona categorias
  Object.keys(categories).sort().forEach(category => {
    if (categories[category].length === 0) return;
    
    const group = document.createElement('optgroup');
    group.label = `${category} (${categories[category].length})`;
    
    categories[category].forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.displayName || model.name;
      group.appendChild(option);
    });
    
    select.appendChild(group);
  });

  // Restaura o valor anterior se ainda existir
  if (currentValue) {
    select.value = currentValue;
    if (select.value !== currentValue) {
      console.log('⚠️ Modelo anterior não encontrado:', currentValue);
    }
  }
  
  console.log('✅ Select populado com sucesso');
}

function searchModels() {
  const query = document.getElementById('model-search').value;
  console.log('🔍 Buscando por:', query);
  
  if (window.modelsManager.models && window.modelsManager.models.length > 0) {
    const filteredModels = window.modelsManager.searchModels(query);
    console.log('📋 Resultados da busca:', filteredModels.length);
    populateModelSelect(filteredModels);
  } else {
    console.log('⚠️ Nenhum modelo disponível para busca');
  }
}

async function refreshModels() {
  if (!currentApiKey) {
    alert('⚠️ Configure uma API key primeiro');
    return;
  }
  
  try {
    await loadModels(true);
    const stats = window.modelsManager.getModelStats();
    alert(`✅ ${stats.total} modelos atualizados com sucesso!\n\n📊 Estatísticas:\n• Popular: ${stats.popular}\n• Categorias: ${Object.keys(stats.categories).length}`);
  } catch (error) {
    alert(`❌ Erro ao atualizar modelos: ${error.message}`);
  }
}

async function clearModelsCache() {
  if (confirm('🗑️ Tem certeza que deseja limpar o cache de modelos?\n\nIsso forçará uma nova sincronização na próxima vez.')) {
    try {
      await window.modelsManager.clearCache();
      document.getElementById('model-select').innerHTML = '<option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>';
      modelsLoaded = false;
      alert('✅ Cache limpo com sucesso!');
    } catch (error) {
      alert(`❌ Erro ao limpar cache: ${error.message}`);
    }
  }
}

function updateModelsStats() {
  const statsDiv = document.getElementById('models-stats');
  if (!statsDiv || !window.modelsManager.models.length) return;
  
  const stats = window.modelsManager.getModelStats();
  const topCategories = Object.entries(stats.categories)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(' • ');
  
  statsDiv.innerHTML = `
    📊 Total: ${stats.total} modelos | ⭐ Popular: ${stats.popular}<br>
    🏷️ ${topCategories}
  `;
  statsDiv.classList.add('show');
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
    
    // Salva modelo selecionado
    chrome.storage.sync.set({
      selectedModel: selectedModel
    }, function() {
      alert('Configurações salvas com sucesso!');
      showMain();
    });

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

  // Check if settings are configured
  if (!currentApiKey) {
    const keyData = await window.securityManager.getApiKey();
    if (!keyData || !keyData.key) {
      alert('Por favor, configure sua API key nas configurações.');
      showSettings();
      return;
    }
    currentApiKey = keyData.key;
  }

  addMessage('user', userInput);
  document.getElementById('user-input').value = '';
  
  // Show typing indicator
  const typingId = addMessage('assistant', 'Digitando...');
  
  chrome.runtime.sendMessage({ 
    action: 'makeApiRequest', 
    prompt: userInput,
    apiKey: currentApiKey
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