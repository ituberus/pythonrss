// src/js/finance.js

// Load financial data
async function loadFinanceData() {
    // Make sure user is logged in
    if (!isLoggedIn()) {
      window.location.href = '/login.html';
      return;
    }
  
    try {
      // Show loading
      showLoading('finance-data');
  
      // First check if we have user data in localStorage
      let userData = getCurrentUser();
  
      if (!userData) {
        // If not in localStorage, fetch it
        try {
          const userResult = await apiRequest('/auth/me', 'GET');
          if (userResult && userResult.success) {
            userData = userResult.data.user;
            // Update stored user data
            localStorage.setItem('user_data', JSON.stringify(userData));
          }
        } catch (userError) {
          console.error('Error fetching user data:', userError);
          document.getElementById('finance-data').innerHTML =
            '<p>Failed to load user data. Please refresh the page or try again later.</p>';
          return;
        }
      }
  
      if (!userData || !userData.merchantId) {
        document.getElementById('finance-data').innerHTML =
          '<p>Merchant profile not found. Please complete your onboarding first.</p>';
        return;
      }
  
      // Determine if this is a Brazilian merchant (displays in BRL) or international (displays in USD)
      const isBrazilian = userData.merchantId.country === 'BR';
      const dashboardCurrency =
        userData.merchantId.dashboardCurrency || (isBrazilian ? 'BRL' : 'USD');
      const sellsInternationally = userData.merchantId.sellsInternationally || false;
  
      // Fetch balance with proper error handling
      try {
        const balanceResult = await apiRequest('/finance/balance', 'GET');
  
        if (balanceResult && balanceResult.success) {
          displayBalanceData(balanceResult.data, isBrazilian, sellsInternationally);
        } else {
          document.getElementById('finance-data').innerHTML =
            '<p>Failed to load balance data. Please try again later.</p>';
        }
      } catch (balanceError) {
        console.error('Error loading balance:', balanceError);
        document.getElementById('finance-data').innerHTML =
          '<p>Error loading balance data. Please try again later.</p>';
      }
  
      // Show loading for transactions
      showLoading('transactions-data');
  
      // Fetch transactions with proper error handling
      try {
        const transactionsResult = await apiRequest('/finance/transactions', 'GET');
  
        if (transactionsResult && transactionsResult.success) {
          displayTransactionsData(transactionsResult.data, dashboardCurrency);
        } else {
          document.getElementById('transactions-data').innerHTML =
            '<p>Failed to load transactions data. Please try again later.</p>';
        }
      } catch (transactionsError) {
        console.error('Error loading transactions:', transactionsError);
        document.getElementById('transactions-data').innerHTML =
          '<p>Error loading transactions. Please try again later.</p>';
      }
  
      // Load exchange rates based on merchant's currency settings
      if (isBrazilian) {
        // For Brazilian merchants, show BRL to USD rate 
        loadExchangeRate('BRL', 'USD');
      } else {
        // For international merchants, show USD to BRL rate
        loadExchangeRate('USD', 'BRL');
      }
    } catch (error) {
      console.error('Finance load error:', error);
      document.getElementById('finance-data').innerHTML =
        '<p>Error loading finance data. Please try again later.</p>';
    }
  }
  
  // Display balance data
  function displayBalanceData(data, isBrazilian, sellsInternationally) {
    const container = document.getElementById('finance-data');
    if (!container) return;
  
    // Clear loading
    container.innerHTML = '';
  
    // Create balance cards
    const balanceRow = document.createElement('div');
    balanceRow.className = 'row';
  
    // Total Balance
    const totalBalanceCol = document.createElement('div');
    totalBalanceCol.className = 'col';
  
    const totalBalanceCard = document.createElement('div');
    totalBalanceCard.className = 'balance-card';
  
    totalBalanceCard.innerHTML = `
      <div class="balance-label">Total Balance</div>
      <div class="balance-amount">${formatCurrency(data.balance.totalBalance, data.balance.currency)}</div>
    `;
  
    totalBalanceCol.appendChild(totalBalanceCard);
    balanceRow.appendChild(totalBalanceCol);
  
    // Available Balance
    const availableBalanceCol = document.createElement('div');
    availableBalanceCol.className = 'col';
  
    const availableBalanceCard = document.createElement('div');
    availableBalanceCard.className = 'balance-card';
  
    availableBalanceCard.innerHTML = `
      <div class="balance-label">Available Balance</div>
      <div class="balance-amount">${formatCurrency(data.balance.available, data.balance.currency)}</div>
    `;
  
    availableBalanceCol.appendChild(availableBalanceCard);
    balanceRow.appendChild(availableBalanceCol);
  
    // Reserve Balance
    const reserveBalanceCol = document.createElement('div');
    reserveBalanceCol.className = 'col';
  
    const reserveBalanceCard = document.createElement('div');
    reserveBalanceCard.className = 'balance-card';
  
    reserveBalanceCard.innerHTML = `
      <div class="balance-label">Reserve Balance</div>
      <div class="balance-amount">${formatCurrency(data.balance.reserve, data.balance.currency)}</div>
    `;
  
    reserveBalanceCol.appendChild(reserveBalanceCard);
    balanceRow.appendChild(reserveBalanceCol);
  
    // Add to container
    container.appendChild(balanceRow);
  
    // Add hold days info
    const holdDaysInfo = document.createElement('p');
    holdDaysInfo.innerHTML = `Funds are held in reserve for <strong>${data.holdDays}</strong> days before becoming available.`;
    holdDaysInfo.style.marginTop = '10px';
    container.appendChild(holdDaysInfo);
  
    // Add currency information
    const currencyInfoDiv = document.createElement('div');
    currencyInfoDiv.className = 'card';
    currencyInfoDiv.style.marginTop = '20px';
  
    if (isBrazilian) {
      if (sellsInternationally) {
        currencyInfoDiv.innerHTML = `
          <h3>Currency Information</h3>
          <p>Your dashboard is displayed in <strong>BRL</strong>.</p>
          <p>Sales in BRL will be processed in BRL. Sales in other currencies will be converted to USD with the current exchange rate.</p>
          <p>Payouts for international sales will be made in USD to your connected bank account.</p>
        `;
      } else {
        currencyInfoDiv.innerHTML = `
          <h3>Currency Information</h3>
          <p>Your dashboard is displayed in <strong>BRL</strong>.</p>
          <p>All sales and payouts are processed in BRL.</p>
          <p>Want to sell internationally? Enable international sales to receive payments in foreign currencies.</p>
          <button id="enable-international-btn" class="button">Enable International Sales</button>
        `;
      }
    } else {
      // Non-Brazilian merchant
      currencyInfoDiv.innerHTML = `
        <h3>Currency Information</h3>
        <p>Your dashboard is displayed in <strong>USD</strong>.</p>
        <p>Sales in USD will be processed in USD. Sales in other currencies (including BRL) will be converted to USD with the current exchange rate.</p>
        <p>All payouts will be made in USD to your connected bank account.</p>
      `;
    }
  
    container.appendChild(currencyInfoDiv);
  
    // Add event listener for the enable button if it exists
    const enableBtn = document.getElementById('enable-international-btn');
    if (enableBtn) {
      enableBtn.addEventListener('click', enableInternationalSales);
    }
  
    // Add payout request button if there are available funds
    if (data.balance.available > 0) {
      const payoutDiv = document.createElement('div');
      payoutDiv.style.marginTop = '20px';
  
      const payoutButton = document.createElement('button');
      payoutButton.className = 'button';
      payoutButton.textContent = `Request Payout (${formatCurrency(data.balance.available, data.balance.currency)})`;
      payoutButton.addEventListener('click', openPayoutModal);
  
      payoutDiv.appendChild(payoutButton);
      container.appendChild(payoutDiv);
    }
  }
  
  // Display transactions data
  function displayTransactionsData(data, dashboardCurrency) {
    const container = document.getElementById('transactions-data');
    if (!container) return;
  
    // Clear loading
    container.innerHTML = '';
  
    if (!data.transactions || data.transactions.length === 0) {
      container.innerHTML = '<p>No transactions found.</p>';
      return;
    }
  
    // Create table
    const table = document.createElement('table');
  
    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Date</th>
        <th>ID</th>
        <th>Type</th>
        <th>Status</th>
        <th>Original Amount</th>
        <th>Amount (${dashboardCurrency})</th>
      </tr>
    `;
    table.appendChild(thead);
  
    // Table body
    const tbody = document.createElement('tbody');
  
    data.transactions.forEach(transaction => {
      const tr = document.createElement('tr');
  
      // Format status with color
      let statusHtml = transaction.status;
      if (transaction.status === 'succeeded' || transaction.status === 'captured') {
        statusHtml = `<span style="color: green;">${transaction.status}</span>`;
      } else if (transaction.status === 'failed') {
        statusHtml = `<span style="color: red;">${transaction.status}</span>`;
      } else if (transaction.status === 'pending') {
        statusHtml = `<span style="color: orange;">${transaction.status}</span>`;
      } else if (transaction.status === 'refunded') {
        statusHtml = `<span style="color: blue;">${transaction.status}</span>`;
      } else if (transaction.status === 'chargeback') {
        statusHtml = `<span style="color: darkred;">${transaction.status}</span>`;
      }
  
      // Only show original amount if it's different from dashboard currency
      const showOriginalAmount = transaction.currencyOriginal !== dashboardCurrency;
  
      tr.innerHTML = `
        <td>${formatDate(transaction.createdAt)}</td>
        <td>${transaction.id}</td>
        <td>${transaction.type || 'Payment'}</td>
        <td>${statusHtml}</td>
        <td>${showOriginalAmount ? formatCurrency(transaction.amountOriginal, transaction.currencyOriginal) : '-'}</td>
        <td>${formatCurrency(transaction.amountConverted || transaction.amountOriginal, transaction.currencyConverted || transaction.currencyOriginal)}</td>
      `;
  
      tbody.appendChild(tr);
    });
  
    table.appendChild(tbody);
    container.appendChild(table);
  
    // Pagination if available
    if (data.pages > 1) {
      const pagination = document.createElement('div');
      pagination.className = 'pagination';
      pagination.style.marginTop = '20px';
      pagination.style.textAlign = 'center';
  
      // Previous button
      if (data.page > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Previous';
        prevBtn.addEventListener('click', () => {
          loadTransactionsPage(data.page - 1);
        });
        pagination.appendChild(prevBtn);
      }
  
      // Page number
      const pageInfo = document.createElement('span');
      pageInfo.textContent = ` Page ${data.page} of ${data.pages} `;
      pageInfo.style.margin = '0 10px';
      pagination.appendChild(pageInfo);
  
      // Next button
      if (data.page < data.pages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', () => {
          loadTransactionsPage(data.page + 1);
        });
        pagination.appendChild(nextBtn);
      }
  
      container.appendChild(pagination);
    }
  }
  
  // Load transactions for a specific page
  async function loadTransactionsPage(page = 1, limit = 10) {
    try {
      // Show loading
      showLoading('transactions-data');
  
      // Fetch transactions with pagination
      const result = await apiRequest(`/finance/transactions?page=${page}&limit=${limit}`, 'GET');
  
      if (result && result.success) {
        // Fetch user data to get currency settings
        const userData = await fetchCurrentUser();
        const dashboardCurrency = userData?.merchant?.dashboardCurrency || 'USD';
  
        displayTransactionsData(result.data, dashboardCurrency);
      } else {
        document.getElementById('transactions-data').innerHTML = '<p>Failed to load transactions</p>';
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      document.getElementById('transactions-data').innerHTML = '<p>Error loading transactions</p>';
    }
  }
  
  // Enable international sales
  async function enableInternationalSales() {
    try {
      const btn = document.getElementById('enable-international-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Enabling...';
      }
  
      // Update international sales setting
      const result = await apiRequest('/auth/onboarding/international', 'POST', {
        sellsInternationally: true
      });
  
      if (result && result.success) {
        showAlert('International sales enabled successfully. You can now receive payments in foreign currencies.', 'success');
  
        // Reload finance data to update the UI
        loadFinanceData();
      } else {
        showAlert(result?.message || 'Failed to enable international sales', 'error');
  
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Enable International Sales';
        }
      }
    } catch (error) {
      console.error('Error enabling international sales:', error);
      showAlert('Error enabling international sales', 'error');
  
      const btn = document.getElementById('enable-international-btn');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Enable International Sales';
      }
    }
  }
  
  // Open payout request modal
  function openPayoutModal() {
    const modal = document.getElementById('payout-modal');
    if (modal) {
      modal.style.display = 'block';
  
      // Fetch and populate payout amounts
      preparePayoutModal();
    }
  }
  
  // Prepare payout modal with currency options
  async function preparePayoutModal() {
    try {
      // Get user data for currency settings
      const userData = await fetchCurrentUser();
  
      if (!userData || !userData.merchant) {
        showAlert('Failed to load user data', 'error');
        return;
      }
  
      const isBrazilian = userData.merchant.country === 'BR';
      const sellsInternationally = userData.merchant.sellsInternationally || false;
      const dashboardCurrency = userData.merchant.dashboardCurrency; // BRL for Brazilian, USD for others
  
      // Get balance
      const balanceResult = await apiRequest('/finance/balance', 'GET');
  
      if (!balanceResult || !balanceResult.success) {
        showAlert('Failed to load balance data', 'error');
        return;
      }
  
      const balance = balanceResult.data.balance;
  
      // Update the payout amount input
      const amountInput = document.getElementById('payout-amount');
      if (amountInput) {
        amountInput.value = balance.available.toFixed(2);
        amountInput.max = balance.available;
      }
  
      // Update currency options based on merchant settings
      const currencySelect = document.getElementById('payout-currency');
      if (currencySelect) {
        // Clear existing options
        currencySelect.innerHTML = '';
  
        if (isBrazilian && sellsInternationally) {
          // Brazilian merchants who sell internationally can get paid in BRL or USD
          currencySelect.innerHTML = `
            <option value="BRL">BRL (Brazilian Real)</option>
            <option value="USD">USD (US Dollar)</option>
          `;
        } else if (isBrazilian) {
          // Brazilian merchants who only sell domestically get paid in BRL
          currencySelect.innerHTML = `
            <option value="BRL">BRL (Brazilian Real)</option>
          `;
        } else {
          // All other merchants get paid in USD
          currencySelect.innerHTML = `
            <option value="USD">USD (US Dollar)</option>
          `;
        }
      }
    } catch (error) {
      console.error('Error preparing payout modal:', error);
      showAlert('Error preparing payout request', 'error');
    }
  }
  
  // Close modals
  function closeModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.style.display = 'none';
    });
  }
  
  // Handle payout request
  async function handlePayoutRequest(event) {
    event.preventDefault();
  
    // Get form data
    const amount = parseFloat(document.getElementById('payout-amount').value);
    const currency = document.getElementById('payout-currency').value;
  
    if (isNaN(amount) || amount <= 0) {
      showAlert('Please enter a valid amount', 'error');
      return;
    }
  
    try {
      const submitBtn = document.getElementById('request-payout-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
  
      // Request payout
      const result = await apiRequest('/finance/payout', 'POST', {
        amount,
        currency
      });
  
      if (result && result.success) {
        showAlert('Payout requested successfully', 'success');
  
        // Close modal
        closeModals();
  
        // Reload finance data
        loadFinanceData();
      } else {
        showAlert(result?.message || 'Failed to request payout', 'error');
      }
  
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Payout';
    } catch (error) {
      console.error('Payout request error:', error);
      showAlert('Error requesting payout: ' + (error.message || 'Unknown error'), 'error');
  
      const submitBtn = document.getElementById('request-payout-btn');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Payout';
    }
  }
  
  // Load exchange rate between two currencies
  async function loadExchangeRate(base, quote) {
    try {
      // Only request if rate fields are available
      const rateResult = document.getElementById('rate-result');
  
      if (!rateResult) return;
  
      // Show loading
      rateResult.innerHTML = '<div class="loading">Loading exchange rate...</div>';
  
      // Get exchange rate
      const result = await apiRequest(`/finance/rates?base=${base}&quote=${quote}`, 'GET');
  
      if (result && result.success) {
        displayRateResult(result.data);
      } else {
        rateResult.innerHTML = '<p>Failed to load exchange rate</p>';
      }
    } catch (error) {
      console.error('Error getting exchange rates:', error);
      const rateResult = document.getElementById('rate-result');
      if (rateResult) {
        rateResult.innerHTML = '<p>Error loading exchange rate</p>';
      }
    }
  }
  
  // Display exchange rate result
  function displayRateResult(data) {
    const container = document.getElementById('rate-result');
    if (!container) return;
  
    // Update rate select elements if they exist
    const baseSelect = document.getElementById('rate-base');
    const quoteSelect = document.getElementById('rate-quote');
  
    if (baseSelect) baseSelect.value = data.base;
    if (quoteSelect) quoteSelect.value = data.quote;
  
    // Format timestamp
    const timestamp = new Date(data.timestamp);
    const formattedTime = timestamp.toLocaleString();
  
    container.innerHTML = `
      <div class="card" style="margin-top: 10px;">
        <h3>Current Exchange Rate</h3>
        <p>1 ${data.base} = ${data.effectiveRate} ${data.quote}</p>
        <p class="small-text">Updated: ${formattedTime}</p>
        <p class="small-text">Note: Exchange rates include a small spread that covers payment processor fees.</p>
      </div>
    `;
  }
  
  // Initialize finance page
  document.addEventListener('DOMContentLoaded', function() {
    // Create sidebar with active menu
    createSidebar('Finance');
  
    // Load finance data
    loadFinanceData();
  
    // Add event listener for payout form
    const payoutForm = document.getElementById('payout-form');
    if (payoutForm) {
      payoutForm.addEventListener('submit', handlePayoutRequest);
    }
  
    // Add event listeners for rate select elements
    const baseSelect = document.getElementById('rate-base');
    const quoteSelect = document.getElementById('rate-quote');
  
    if (baseSelect && quoteSelect) {
      baseSelect.addEventListener('change', function() {
        loadExchangeRate(baseSelect.value, quoteSelect.value);
      });
  
      quoteSelect.addEventListener('change', function() {
        loadExchangeRate(baseSelect.value, quoteSelect.value);
      });
    }
  
    // Add event listeners for modal close buttons
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
      button.addEventListener('click', closeModals);
    });
  
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
      const modals = document.querySelectorAll('.modal');
      modals.forEach(modal => {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  });
  