// Sistema de segurança para armazenamento de API keys
class SecurityManager {
  constructor() {
    this.keyPrefix = 'izy_ai_';
    this.encryptionKey = this.generateEncryptionKey();
  }

  generateEncryptionKey() {
    // Gera uma chave baseada em características do navegador/extensão
    const userAgent = navigator.userAgent;
    const timestamp = Date.now().toString();
    const random = Math.random().toString();
    
    return btoa(userAgent + timestamp + random).slice(0, 32);
  }

  // Criptografia simples XOR (para demonstração - em produção usar crypto API)
  encrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(result);
  }

  decrypt(encryptedText, key) {
    try {
      const text = atob(encryptedText);
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(
          text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return result;
    } catch (error) {
      return null;
    }
  }

  async saveApiKey(apiKey) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key não pode estar vazia');
    }

    // Valida formato da API key
    if (!this.validateApiKeyFormat(apiKey)) {
      throw new Error('Formato de API key inválido');
    }

    const encryptedKey = this.encrypt(apiKey, this.encryptionKey);
    const keyData = {
      key: encryptedKey,
      timestamp: Date.now(),
      validated: false
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.set({ 
          [this.keyPrefix + 'api_key']: keyData 
        }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } else {
      localStorage.setItem(this.keyPrefix + 'api_key', JSON.stringify(keyData));
      return Promise.resolve();
    }
  }

  async getApiKey() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.sync.get([this.keyPrefix + 'api_key'], (result) => {
          const keyData = result[this.keyPrefix + 'api_key'];
          if (keyData && keyData.key) {
            const decryptedKey = this.decrypt(keyData.key, this.encryptionKey);
            resolve({
              key: decryptedKey,
              timestamp: keyData.timestamp,
              validated: keyData.validated || false
            });
          } else {
            resolve(null);
          }
        });
      });
    } else {
      const keyData = localStorage.getItem(this.keyPrefix + 'api_key');
      if (keyData) {
        try {
          const parsed = JSON.parse(keyData);
          const decryptedKey = this.decrypt(parsed.key, this.encryptionKey);
          return {
            key: decryptedKey,
            timestamp: parsed.timestamp,
            validated: parsed.validated || false
          };
        } catch (error) {
          return null;
        }
      }
      return null;
    }
  }

  async validateApiKey(apiKey) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin || 'chrome-extension://',
          'X-Title': 'Izy AI Venice'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          valid: true,
          data: data.data || {}
        };
      } else {
        return {
          valid: false,
          error: `Erro ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async markKeyAsValidated() {
    const keyData = await this.getApiKey();
    if (keyData) {
      keyData.validated = true;
      const encryptedKey = this.encrypt(keyData.key, this.encryptionKey);
      const updatedData = {
        key: encryptedKey,
        timestamp: keyData.timestamp,
        validated: true
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve) => {
          chrome.storage.sync.set({ 
            [this.keyPrefix + 'api_key']: updatedData 
          }, resolve);
        });
      } else {
        localStorage.setItem(this.keyPrefix + 'api_key', JSON.stringify(updatedData));
        return Promise.resolve();
      }
    }
  }

  validateApiKeyFormat(apiKey) {
    // Valida formato básico da API key da OpenRouter
    return /^sk-or-v1-[a-f0-9]{64}$/.test(apiKey) || 
           /^sk-[a-zA-Z0-9]{48,}$/.test(apiKey);
  }

  async removeApiKey() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.sync.remove([this.keyPrefix + 'api_key'], resolve);
      });
    } else {
      localStorage.removeItem(this.keyPrefix + 'api_key');
      return Promise.resolve();
    }
  }

  getKeyAge(timestamp) {
    const now = Date.now();
    const age = now - timestamp;
    const days = Math.floor(age / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    if (days < 7) return `${days} dias atrás`;
    if (days < 30) return `${Math.floor(days / 7)} semanas atrás`;
    return `${Math.floor(days / 30)} meses atrás`;
  }
}

// Instância global
window.securityManager = new SecurityManager();