// admin-fx.js - Handle FX rate management

// Load FX settings and rates
async function loadFxData() {
    try {
      // Load FX settings
      await loadFxSettings();
      
      // Load FX rates
      await loadFxRates();
    } catch (error) {
      console.error('Error loading FX data:', error);
      showAlert('Failed to load FX data', 'error');
    }
  }
  
  // Load FX settings
  async function loadFxSettings() {
    try {
      // Show loading
      const settingsCard = document.getElementById('fx-settings-card');
      if (settingsCard) {
        settingsCard.innerHTML = '<div class="loading">Loading settings...</div>';
      }
      
      // Get FX settings from API
      const result = await apiRequest('/admin/settings/fx', 'GET', null, false, true);
      
      if (result && result.success) {
        displayFxSettings(result.data.settings);
      } else {
        if (settingsCard) {
          settingsCard.innerHTML = '<p>Failed to load FX settings</p>';
        }
      }
    } catch (error) {
      console.error('Error loading FX settings:', error);
      const settingsCard = document.getElementById('fx-settings-card');
      if (settingsCard) {
        settingsCard.innerHTML = '<p>Error loading FX settings</p>';
      }
    }
  }
  
  // Display FX settings
  function displayFxSettings(settings) {
    const settingsCard = document.getElementById('fx-settings-card');
    if (!settingsCard) return;
    
    // Create settings display
    settingsCard.innerHTML = `
      <div>
        <h3>Global FX Settings</h3>
        <p><strong>Default FX Spread:</strong> ${settings.defaultSpread || 1.9}%</p>
        <p><strong>Automatic FX Updates:</strong> ${settings.autoFxUpdate ? 'Enabled' : 'Disabled'}</p>
        <p><small>These settings apply to all merchants unless overridden at the merchant level</small></p>
      </div>
    `;
    
    // Populate edit form with current values
    document.getElementById('default-spread').value = settings.defaultSpread || 1.9;
    document.getElementById('auto-fx-update').checked = settings.autoFxUpdate || false;
  }
  
  // Load FX rates
  async function loadFxRates() {
    try {
      // Show loading
      const ratesContainer = document.getElementById('fx-rates-container');
      if (ratesContainer) {
        ratesContainer.innerHTML = '<div class="loading">Loading rates...</div>';
      }
      
      // Get FX rates from API
      const result = await apiRequest('/admin/finance/fx-rates', 'GET', null, false, true);
      
      if (result && result.success) {
        displayFxRates(result.data);
      } else {
        if (ratesContainer) {
          ratesContainer.innerHTML = '<p>Failed to load FX rates</p>';
        }
      }
    } catch (error) {
      console.error('Error loading FX rates:', error);
      const ratesContainer = document.getElementById('fx-rates-container');
      if (ratesContainer) {
        ratesContainer.innerHTML = '<p>Error loading FX rates</p>';
      }
    }
  }
  
  // Display FX rates
  function displayFxRates(data) {
    const ratesContainer = document.getElementById('fx-rates-container');
    if (!ratesContainer) return;
    
    // Clear content
    ratesContainer.innerHTML = '';
    
    if (!data.rates || data.rates.length === 0) {
      ratesContainer.innerHTML = '<p>No exchange rates found. Add rates using the button below.</p>';
      return;
    }
    
    // Create rate cards
    data.rates.forEach(rate => {
      const rateCard = document.createElement('div');
      rateCard.className = 'fx-card';
      
      // Format rate with 6 decimal places
      const formattedRate = rate.rate.toFixed(6);
      
      // Format time
      const fetchedAt = new Date(rate.fetchedAt);
      const formattedTime = fetchedAt.toLocaleString();
      
      // Build card content
      rateCard.innerHTML = `
        <h3>${rate.baseCurrency} to ${rate.quoteCurrency}</h3>
        <p><strong>Rate:</strong> ${formattedRate}</p>
        <p><strong>1 ${rate.baseCurrency} = ${formattedRate} ${rate.quoteCurrency}</strong></p>
        <p><small>Last updated: ${formattedTime}</small></p>
        <p><small>Source: ${rate.source || 'Manual'}</small></p>
        
        <button class="update-rate-btn" 
          data-base="${rate.baseCurrency}" 
          data-quote="${rate.quoteCurrency}" 
          data-rate="${rate.rate}">
          Update Rate
        </button>
      `;
      
      ratesContainer.appendChild(rateCard);
    });
    
    // Add event listeners for update buttons
    const updateButtons = document.querySelectorAll('.update-rate-btn');
    updateButtons.forEach(button => {
      button.addEventListener('click', function() {
        // Get data attributes
        const baseCurrency = this.getAttribute('data-base');
        const quoteCurrency = this.getAttribute('data-quote');
        const currentRate = this.getAttribute('data-rate');
        
        // Populate add rate form with current values
        document.getElementById('base-currency').value = baseCurrency;
        document.getElementById('quote-currency').value = quoteCurrency;
        document.getElementById('rate-value').value = currentRate;
        
        // Change button text to indicate update
        document.getElementById('submit-rate-btn').textContent = 'Update Rate';
        
        // Show modal
        document.getElementById('add-rate-modal').style.display = 'block';
      });
    });
  }
  
  // Update FX settings
  async function updateFxSettings(event) {
    event.preventDefault();
    
    // Get form values
    const defaultSpread = parseFloat(document.getElementById('default-spread').value);
    const autoFxUpdate = document.getElementById('auto-fx-update').checked;
    
    // Validate input
    if (isNaN(defaultSpread) || defaultSpread < 0 || defaultSpread > 10) {
      showAlert('Default spread must be a number between 0 and 10', 'error');
      return;
    }
    
    try {
      const updateBtn = document.getElementById('update-settings-btn');
      updateBtn.disabled = true;
      updateBtn.textContent = 'Updating...';
      
      // Update settings
      const result = await apiRequest('/admin/settings/fx', 'PATCH', {
        defaultSpread,
        autoFxUpdate
      }, false, true);
      
      if (result && result.success) {
        showAlert('FX settings updated successfully', 'success');
        
        // Close modal
        document.getElementById('edit-settings-modal').style.display = 'none';
        
        // Reload settings
        loadFxSettings();
      } else {
        showAlert(result?.message || 'Failed to update FX settings', 'error');
      }
      
      updateBtn.disabled = false;
      updateBtn.textContent = 'Update Settings';
    } catch (error) {
      console.error('Error updating FX settings:', error);
      showAlert('Error updating FX settings', 'error');
      
      const updateBtn = document.getElementById('update-settings-btn');
      updateBtn.disabled = false;
      updateBtn.textContent = 'Update Settings';
    }
  }
  
  // Add or update FX rate
  async function addOrUpdateRate(event) {
    event.preventDefault();
    
    // Get form values
    const baseCurrency = document.getElementById('base-currency').value;
    const quoteCurrency = document.getElementById('quote-currency').value;
    const rate = parseFloat(document.getElementById('rate-value').value);
    
    // Validate input
    if (baseCurrency === quoteCurrency) {
      showAlert('Base and quote currencies must be different', 'error');
      return;
    }
    
    if (isNaN(rate) || rate <= 0) {
      showAlert('Rate must be a positive number', 'error');
      return;
    }
    
    try {
      const submitBtn = document.getElementById('submit-rate-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
      
      // Add/update rate
      const result = await apiRequest('/admin/finance/fx-rates/update', 'POST', {
        baseCurrency,
        quoteCurrency,
        rate
      }, false, true);
      
      if (result && result.success) {
        showAlert('Exchange rate updated successfully', 'success');
        
        // Close modal
        document.getElementById('add-rate-modal').style.display = 'none';
        
        // Reset form
        document.getElementById('add-rate-form').reset();
        document.getElementById('submit-rate-btn').textContent = 'Add Rate';
        
        // Reload rates
        loadFxRates();
      } else {
        showAlert(result?.message || 'Failed to update exchange rate', 'error');
      }
      
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Rate';
    } catch (error) {
      console.error('Error updating FX rate:', error);
      showAlert('Error updating FX rate', 'error');
      
      const submitBtn = document.getElementById('submit-rate-btn');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Rate';
    }
  }
  
  // Refresh all rates from external source
  async function refreshAllRates() {
    try {
      // Show confirmation dialog
      if (!confirm('This will refresh all exchange rates from external sources. Continue?')) {
        return;
      }
      
      const refreshBtn = document.getElementById('refresh-all-rates-btn');
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      
      // Refresh rates
      const result = await apiRequest('/admin/finance/fx-rates/refresh-all', 'POST', {}, false, true);
      
      if (result && result.success) {
        showAlert('All exchange rates refreshed successfully', 'success');
        
        // Reload rates
        loadFxRates();
      } else {
        showAlert(result?.message || 'Failed to refresh exchange rates', 'error');
      }
      
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh All Rates';
    } catch (error) {
      console.error('Error refreshing exchange rates:', error);
      showAlert('Error refreshing exchange rates', 'error');
      
      const refreshBtn = document.getElementById('refresh-all-rates-btn');
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh All Rates';
    }
  }
  
  // Initialize FX management page
  document.addEventListener('DOMContentLoaded', function() {
    // Create sidebar with active menu
    createSidebar('FX Rates');
    
    // Load FX data
    loadFxData();
    
    // Add event listener for edit settings button
    const editSettingsBtn = document.getElementById('edit-settings-btn');
    if (editSettingsBtn) {
      editSettingsBtn.addEventListener('click', function() {
        document.getElementById('edit-settings-modal').style.display = 'block';
      });
    }
    
    // Add event listener for edit settings form
    const editSettingsForm = document.getElementById('edit-settings-form');
    if (editSettingsForm) {
      editSettingsForm.addEventListener('submit', updateFxSettings);
    }
    
    // Add event listener for add rate button
    const addRateBtn = document.getElementById('add-rate-btn');
    if (addRateBtn) {
      addRateBtn.addEventListener('click', function() {
        // Reset form
        document.getElementById('add-rate-form').reset();
        document.getElementById('submit-rate-btn').textContent = 'Add Rate';
        
        // Show modal
        document.getElementById('add-rate-modal').style.display = 'block';
      });
    }
    
    // Add event listener for add rate form
    const addRateForm = document.getElementById('add-rate-form');
    if (addRateForm) {
      addRateForm.addEventListener('submit', addOrUpdateRate);
    }
    
    // Add event listener for refresh rates button
    const refreshRatesBtn = document.getElementById('refresh-all-rates-btn');
    if (refreshRatesBtn) {
      refreshRatesBtn.addEventListener('click', refreshAllRates);
    }
    
    // Add event listeners for modal close buttons
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
      button.addEventListener('click', function() {
        document.querySelectorAll('.modal').forEach(modal => {
          modal.style.display = 'none';
        });
      });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
      document.querySelectorAll('.modal').forEach(modal => {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  });