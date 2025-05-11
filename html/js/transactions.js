// Load transactions data
async function loadTransactions(page = 1, limit = 10, filters = {}) {
    // Make sure user is logged in
    if (!isLoggedIn()) {
      window.location.href = '/login.html';
      return;
    }
    
    try {
      // Show loading
      showLoading('transactions-list');
      
      // Build query parameters
      let queryParams = `?page=${page}&limit=${limit}`;
      
      // Add filters if provided
      if (filters.status) {
        queryParams += `&status=${filters.status}`;
      }
      
      if (filters.fromDate) {
        queryParams += `&fromDate=${filters.fromDate}`;
      }
      
      if (filters.toDate) {
        queryParams += `&toDate=${filters.toDate}`;
      }
      
      // Fetch transactions
      const result = await apiRequest(`/finance/transactions${queryParams}`, 'GET');
      
      if (result && result.success) {
        displayTransactions(result.data);
      } else {
        document.getElementById('transactions-list').innerHTML = '<p>Failed to load transactions</p>';
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      document.getElementById('transactions-list').innerHTML = '<p>Error loading transactions</p>';
    }
  }
  
  // Display transactions list
  function displayTransactions(data) {
    const container = document.getElementById('transactions-list');
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
        <th>Customer</th>
        <th>Method</th>
        <th>Status</th>
        <th>Amount</th>
        <th>Actions</th>
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
      
      tr.innerHTML = `
        <td>${formatDate(transaction.createdAt)}</td>
        <td>${transaction.id}</td>
        <td>${transaction.customer || 'N/A'}</td>
        <td>${transaction.paymentMethod || 'N/A'}</td>
        <td>${statusHtml}</td>
        <td>${formatCurrency(transaction.amount, transaction.currency)}</td>
        <td>
          <button class="view-btn" data-id="${transaction.id}">View</button>
          ${transaction.status === 'captured' ? `<button class="refund-btn" data-id="${transaction.id}">Refund</button>` : ''}
        </td>
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
          const filters = getFilterValues();
          loadTransactions(data.page - 1, data.limit, filters);
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
          const filters = getFilterValues();
          loadTransactions(data.page + 1, data.limit, filters);
        });
        pagination.appendChild(nextBtn);
      }
      
      container.appendChild(pagination);
    }
    
    // Add event listeners for view/refund buttons
    attachTransactionButtonListeners();
  }
  
  // Attach event listeners to transaction action buttons
  function attachTransactionButtonListeners() {
    // View buttons
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(button => {
      button.addEventListener('click', function() {
        const transactionId = this.getAttribute('data-id');
        viewTransactionDetails(transactionId);
      });
    });
    
    // Refund buttons
    const refundButtons = document.querySelectorAll('.refund-btn');
    refundButtons.forEach(button => {
      button.addEventListener('click', function() {
        const transactionId = this.getAttribute('data-id');
        confirmRefundTransaction(transactionId);
      });
    });
  }
  
  // View transaction details
  function viewTransactionDetails(transactionId) {
    alert(`View transaction details for ID: ${transactionId}`);
    // In a real implementation, this would fetch the transaction details and show them in a modal
  }
  
  // Confirm refund transaction
  function confirmRefundTransaction(transactionId) {
    if (confirm('Are you sure you want to refund this transaction?')) {
      refundTransaction(transactionId);
    }
  }
  
  // Refund transaction
  async function refundTransaction(transactionId) {
    try {
      // Process refund
      const result = await apiRequest(`/orders/${transactionId}/refund`, 'POST');
      
      if (result && result.success) {
        showAlert('Transaction refunded successfully', 'success');
        
        // Reload transactions
        loadTransactions();
      } else {
        showAlert(result?.message || 'Failed to refund transaction', 'error');
      }
    } catch (error) {
      console.error('Error refunding transaction:', error);
      showAlert('Error refunding transaction', 'error');
    }
  }
  
  // Get filter values
  function getFilterValues() {
    const status = document.getElementById('filter-status')?.value;
    const fromDate = document.getElementById('filter-from-date')?.value;
    const toDate = document.getElementById('filter-to-date')?.value;
    
    const filters = {};
    
    if (status && status !== 'all') {
      filters.status = status;
    }
    
    if (fromDate) {
      filters.fromDate = fromDate;
    }
    
    if (toDate) {
      filters.toDate = toDate;
    }
    
    return filters;
  }
  
  // Handle filter form submission
  function handleFilterSubmit(event) {
    event.preventDefault();
    
    const filters = getFilterValues();
    loadTransactions(1, 10, filters);
  }
  
  // Reset filters
  function resetFilters() {
    // Reset filter form
    document.getElementById('filter-form').reset();
    
    // Reload transactions with default filters
    loadTransactions();
  }
  
  // Initialize transactions page
  document.addEventListener('DOMContentLoaded', function() {
    // Create sidebar with active menu
    createSidebar('Transactions');
    
    // Load transactions
    loadTransactions();
    
    // Add event listener for filter form
    const filterForm = document.getElementById('filter-form');
    if (filterForm) {
      filterForm.addEventListener('submit', handleFilterSubmit);
    }
    
    // Add event listener for reset filters button
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', resetFilters);
    }
  });