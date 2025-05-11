// Load dashboard data
async function loadDashboardData() {
    // Make sure user is logged in
    if (!isLoggedIn()) {
      window.location.href = '/login.html';
      return;
    }
    
    try {
      // Show loading
      showLoading('dashboard-data');
      
      // Fetch user data
      const userData = await fetchCurrentUser();
      
      if (!userData) {
        showAlert('Failed to load user data', 'error');
        return;
      }
      
      // Update welcome message
      const welcomeElement = document.getElementById('welcome-message');
      if (welcomeElement) {
        welcomeElement.textContent = `Hello, ${userData.email}`;
      }
      
      // Fetch balance
      const balanceResult = await apiRequest('/finance/balance', 'GET');
      
      if (balanceResult && balanceResult.success) {
        displayBalanceData(balanceResult.data);
      } else {
        showAlert('Failed to load balance data', 'error');
      }
      
      // Fetch transactions (just for stats)
      const transactionsResult = await apiRequest('/finance/transactions', 'GET');
      
      if (transactionsResult && transactionsResult.success) {
        displayTransactionStats(transactionsResult.data);
      }
      
    } catch (error) {
      console.error('Dashboard load error:', error);
      showAlert('Error loading dashboard data', 'error');
    }
  }
  
  // Display balance data
  function displayBalanceData(data) {
    const dashboardDataContainer = document.getElementById('dashboard-data');
    if (!dashboardDataContainer) return;
    
    // Clear loading
    dashboardDataContainer.innerHTML = '';
    
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
    dashboardDataContainer.appendChild(balanceRow);
    
    // Add hold days info
    const holdDaysInfo = document.createElement('p');
    holdDaysInfo.innerHTML = `Funds are held in reserve for <strong>${data.holdDays}</strong> days before becoming available.`;
    dashboardDataContainer.appendChild(holdDaysInfo);
  }
  
  // Display transaction stats
  function displayTransactionStats(data) {
    const statsContainer = document.getElementById('transaction-stats');
    if (!statsContainer) return;
    
    // For now, just show total number of transactions
    statsContainer.innerHTML = `
      <div class="card">
        <h3>Transaction Summary</h3>
        <p>Total Transactions: ${data.total || 0}</p>
      </div>
    `;
  }
  
  // Initialize dashboard
  document.addEventListener('DOMContentLoaded', function() {
    // Create sidebar with active menu
    createSidebar('Dashboard');
    
    // Load dashboard data
    loadDashboardData();
  });