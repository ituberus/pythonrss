// Base API URL
const API_URL = 'http://localhost:5000/api';

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', data = null, includeAuth = true) {
  const url = `${API_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Add Authorization header if needed and token exists
  if (includeAuth) {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      // Redirect to login if token doesn't exist for authenticated requests
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
  }
  
  const options = {
    method,
    headers
  };
  
  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    
    // Handle 401 Unauthorized (expired token)
    if (response.status === 401 && includeAuth) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user_data');
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'API request failed');
    }
    
    return result;
  } catch (error) {
    console.error('API Request Error:', error);
    showAlert(error.message || 'Something went wrong', 'error');
    return null;
  }
}

// Show alert message
function showAlert(message, type = 'success', duration = 5000) {
  // Remove any existing alerts
  const existingAlert = document.querySelector('.alert');
  if (existingAlert) {
    existingAlert.remove();
  }
  
  // Create alert element
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  // Append to body or to a specific alert container if it exists
  const alertContainer = document.getElementById('alert-container') || document.body;
  alertContainer.prepend(alert);
  
  // Auto remove after duration
  setTimeout(() => {
    alert.remove();
  }, duration);
}

// Format currency
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

// Format date
function formatDate(dateString, includeTime = true) {
  const date = new Date(dateString);
  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  
  if (includeTime) {
    return date.toLocaleString('en-US', {
      ...dateOptions,
      hour: '2-digit', 
      minute: '2-digit'
    });
  }
  
  return date.toLocaleDateString('en-US', dateOptions);
}

// Check if user is logged in
function isLoggedIn() {
  return localStorage.getItem('jwt_token') !== null;
}

// Get current user data
function getCurrentUser() {
  const userData = localStorage.getItem('user_data');
  return userData ? JSON.parse(userData) : null;
}

// Check if user is admin
function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

// Protection for merchant-only pages
function requireMerchant() {
  const user = getCurrentUser();
  if (!user || user.role !== 'merchant') {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// Protection for admin-only pages
function requireAdmin() {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// Get URL parameters
function getUrlParams() {
  const params = {};
  new URLSearchParams(window.location.search).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

// Show loading spinner
function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '<div class="spinner"></div>';
  }
}

// Create sidebar navigation
function createSidebar(active) {
  const user = getCurrentUser();
  if (!user) return;
  
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  
  // Logo
  const logo = document.createElement('div');
  logo.className = 'logo';
  logo.textContent = 'RiskPay';
  sidebar.appendChild(logo);
  
  // Navigation links
  const nav = document.createElement('nav');
  const ul = document.createElement('ul');
  ul.style.listStyle = 'none';
  ul.style.padding = '20px 0';
  
  const links = user.role === 'admin' ? [
    { href: '/admin/index.html', text: 'Dashboard' },
    { href: '/admin/verifications.html', text: 'Verifications' },
    { href: '/admin/users.html', text: 'Users' }
  ] : [
    { href: '/merchant/dashboard.html', text: 'Dashboard' },
    { href: '/merchant/products.html', text: 'Products' },
    { href: '/merchant/transactions.html', text: 'Transactions' },
    { href: '/merchant/finance.html', text: 'Finance' }
  ];
  
  links.forEach(link => {
    const li = document.createElement('li');
    li.style.margin = '10px 0';
    
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.text;
    
    if (link.text.toLowerCase() === active.toLowerCase()) {
      a.style.fontWeight = 'bold';
    }
    
    li.appendChild(a);
    ul.appendChild(li);
  });
  
  // Logout link
  const logoutLi = document.createElement('li');
  logoutLi.style.margin = '10px 0';
  
  const logoutBtn = document.createElement('a');
  logoutBtn.href = '#';
  logoutBtn.textContent = 'Log Out';
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    window.location.href = '/login.html';
  });
  
  logoutLi.appendChild(logoutBtn);
  ul.appendChild(logoutLi);
  
  nav.appendChild(ul);
  sidebar.appendChild(nav);
  
  document.body.prepend(sidebar);
  
  // Adjust main content margin
  const mainContent = document.querySelector('.container');
  if (mainContent) {
    mainContent.className = 'container main-content';
  }
}