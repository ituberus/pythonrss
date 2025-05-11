// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
      showAlert('Please enter email and password', 'error');
      return;
    }
    
    try {
      const loginBtn = document.getElementById('login-btn');
      loginBtn.disabled = true;
      loginBtn.textContent = 'Logging in...';
      
      const result = await apiRequest('/auth/login', 'POST', { email, password }, false);
      
      if (result && result.success) {
        // Store token and user data
        localStorage.setItem('jwt_token', result.data.token);
        localStorage.setItem('user_data', JSON.stringify(result.data.user));
        
        // Redirect based on user role
        if (result.data.user.role === 'admin') {
          window.location.href = '/admin/index.html';
        } else {
          // Check for redirect parameter
          const params = getUrlParams();
          if (params.redirect) {
            window.location.href = params.redirect;
          } else {
            window.location.href = '/merchant/dashboard.html';
          }
        }
      } else {
        showAlert(result?.message || 'Login failed', 'error');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
      }
    } catch (error) {
      console.error('Login error:', error);
      showAlert('Login failed: ' + (error.message || 'Unknown error'), 'error');
      document.getElementById('login-btn').disabled = false;
      document.getElementById('login-btn').textContent = 'Login';
    }
  }
  
  // Handle registration form submission
  async function handleRegister(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (!email || !password) {
      showAlert('Please enter email and password', 'error');
      return;
    }
    
    if (password !== confirmPassword) {
      showAlert('Passwords do not match', 'error');
      return;
    }
    
    try {
      const registerBtn = document.getElementById('register-btn');
      registerBtn.disabled = true;
      registerBtn.textContent = 'Registering...';
      
      const result = await apiRequest('/auth/register', 'POST', { email, password }, false);
      
      if (result && result.success) {
        // Store token and user data
        localStorage.setItem('jwt_token', result.data.token);
        localStorage.setItem('user_data', JSON.stringify(result.data.user));
        
        // Redirect to onboarding or dashboard
        window.location.href = '/merchant/dashboard.html';
      } else {
        showAlert(result?.message || 'Registration failed', 'error');
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register';
      }
    } catch (error) {
      console.error('Registration error:', error);
      showAlert('Registration failed: ' + (error.message || 'Unknown error'), 'error');
      document.getElementById('register-btn').disabled = false;
      document.getElementById('register-btn').textContent = 'Register';
    }
  }
  
  // Admin login handler
  async function handleAdminLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const accessKey = document.getElementById('access-key').value;
    
    if (!username || !password) {
      showAlert('Please enter username and password', 'error');
      return;
    }
    
    try {
      const loginBtn = document.getElementById('login-btn');
      loginBtn.disabled = true;
      loginBtn.textContent = 'Logging in...';
      
      const result = await apiRequest('/admin/login', 'POST', { 
        username, 
        password,
        accessKey
      }, false);
      
      if (result && result.success) {
        // Store admin token and access level
        localStorage.setItem('admin_token', result.data.adminToken);
        localStorage.setItem('admin_access', result.data.hasFullAccess);
        
        window.location.href = '/admin/index.html';
      } else {
        showAlert(result?.message || 'Admin login failed', 'error');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
      }
    } catch (error) {
      console.error('Admin login error:', error);
      showAlert('Login failed: ' + (error.message || 'Unknown error'), 'error');
      document.getElementById('login-btn').disabled = false;
      document.getElementById('login-btn').textContent = 'Login';
    }
  }
  
  // Fetch current user data
  async function fetchCurrentUser() {
    const result = await apiRequest('/auth/me', 'GET');
    
    if (result && result.success) {
      // Update stored user data
      localStorage.setItem('user_data', JSON.stringify(result.data.user));
      return result.data.user;
    } else {
      return null;
    }
  }
  
  // Check and initialize auth state
  function initAuth() {
    // Redirect based on auth state and current page
    const pathname = window.location.pathname;
    
    // For login and register pages, redirect to dashboard if already logged in
    if (pathname === '/login.html' || pathname === '/register.html' || pathname === '/' || pathname === '/index.html') {
      if (isLoggedIn()) {
        const user = getCurrentUser();
        if (user && user.role === 'admin') {
          window.location.href = '/admin/index.html';
        } else {
          window.location.href = '/merchant/dashboard.html';
        }
      }
    } 
    // For admin pages, check if admin
    else if (pathname.startsWith('/admin/')) {
      if (!localStorage.getItem('admin_token')) {
        window.location.href = '/admin-login.html';
      }
    }
    // For merchant pages, check if logged in as merchant
    else if (pathname.startsWith('/merchant/')) {
      if (!isLoggedIn()) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(pathname);
      } else {
        const user = getCurrentUser();
        if (user && user.role === 'admin') {
          window.location.href = '/admin/index.html';
        }
      }
    }
  }
  
  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth state
    initAuth();
    
    // Attach event listeners to forms
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
    
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }
    
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
  });