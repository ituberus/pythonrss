// Load admin dashboard data
async function loadAdminDashboard() {
    try {
      // Show loading
      showLoading('admin-dashboard-data');
      
      // In this simple version, we'll just fetch and display verifications and users summary
      
      // Fetch pending verifications
      const pendingVerificationsResult = await apiRequest('/admin/verifications/pending', 'GET', null, false, true);
      
      if (pendingVerificationsResult && pendingVerificationsResult.success) {
        // Display the count of pending verifications
        const pendingCount = pendingVerificationsResult.data.pendingVerifications.length;
        displayPendingCount(pendingCount);
      }
      
      // Fetch users
      const usersResult = await apiRequest('/admin/users', 'GET', null, false, true);
      
      if (usersResult && usersResult.success) {
        // Display user stats
        displayUserStats(usersResult.data.users);
      }
      
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      document.getElementById('admin-dashboard-data').innerHTML = '<p>Error loading dashboard data</p>';
    }
  }
  
  // Display pending verifications count
  function displayPendingCount(count) {
    const container = document.getElementById('pending-verifications-count');
    if (container) {
      container.textContent = count;
    }
  }
  
  // Display user statistics
  function displayUserStats(users) {
    const container = document.getElementById('user-stats');
    if (!container) return;
    
    // Count users by status
    const stats = {
      total: users.length,
      verified: 0,
      pending: 0,
      rejected: 0,
      active: 0,
      suspended: 0,
      blocked: 0
    };
    
    users.forEach(user => {
      if (user.idCheckStatus === 'verified') stats.verified++;
      if (user.idCheckStatus === 'pending') stats.pending++;
      if (user.idCheckStatus === 'rejected') stats.rejected++;
      if (user.status === 'active') stats.active++;
      if (user.status === 'suspended') stats.suspended++;
      if (user.status === 'blocked') stats.blocked++;
    });
    
    // Display stats
    container.innerHTML = `
      <p>Total Users: ${stats.total}</p>
      <p>Verified: ${stats.verified}</p>
      <p>Pending Verification: ${stats.pending}</p>
      <p>Rejected: ${stats.rejected}</p>
      <p>Active: ${stats.active}</p>
      <p>Suspended: ${stats.suspended}</p>
      <p>Blocked: ${stats.blocked}</p>
    `;
  }
  
  // Load pending verifications
  async function loadPendingVerifications() {
    try {
      // Show loading
      showLoading('verifications-list');
      
      // Fetch pending verifications
      const result = await apiRequest('/admin/verifications/pending', 'GET', null, false, true);
      
      if (result && result.success) {
        displayVerifications(result.data.pendingVerifications);
      } else {
        document.getElementById('verifications-list').innerHTML = '<p>Failed to load pending verifications</p>';
      }
    } catch (error) {
      console.error('Error loading pending verifications:', error);
      document.getElementById('verifications-list').innerHTML = '<p>Error loading pending verifications</p>';
    }
  }
  
  // Load rejected verifications
  async function loadRejectedVerifications() {
    try {
      // Show loading
      showLoading('verifications-list');
      
      // Fetch rejected verifications
      const result = await apiRequest('/admin/verifications/rejected', 'GET', null, false, true);
      
      if (result && result.success) {
        displayVerifications(result.data.rejectedVerifications);
      } else {
        document.getElementById('verifications-list').innerHTML = '<p>Failed to load rejected verifications</p>';
      }
    } catch (error) {
      console.error('Error loading rejected verifications:', error);
      document.getElementById('verifications-list').innerHTML = '<p>Error loading rejected verifications</p>';
    }
  }
  
  // Display verifications list
  function displayVerifications(verifications) {
    const container = document.getElementById('verifications-list');
    if (!container) return;
    
    // Clear content
    container.innerHTML = '';
    
    if (!verifications || verifications.length === 0) {
      container.innerHTML = '<p>No verifications found.</p>';
      return;
    }
    
    // Create table
    const table = document.createElement('table');
    
    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>ID</th>
        <th>Merchant</th>
        <th>Submitted</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    
    verifications.forEach(verification => {
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>${verification._id}</td>
        <td>${verification.merchantId?.businessName || 'N/A'}</td>
        <td>${formatDate(verification.submittedAt)}</td>
        <td>${verification.status}</td>
        <td>
          <button class="view-btn" data-id="${verification._id}">View Details</button>
        </td>
      `;
      
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Add event listeners for view buttons
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(button => {
      button.addEventListener('click', function() {
        const verificationId = this.getAttribute('data-id');
        window.location.href = `verification-details.html?id=${verificationId}`;
      });
    });
  }
  
  // Load verification details
  async function loadVerificationDetails(verificationId) {
    try {
      // Show loading
      showLoading('verification-details');
      
      // Fetch verification details
      const result = await apiRequest(`/admin/verifications/${verificationId}`, 'GET', null, false, true);
      
      if (result && result.success) {
        displayVerificationDetails(result.data.verification);
      } else {
        document.getElementById('verification-details').innerHTML = '<p>Failed to load verification details</p>';
      }
    } catch (error) {
      console.error('Error loading verification details:', error);
      document.getElementById('verification-details').innerHTML = '<p>Error loading verification details</p>';
    }
  }
  
  // Display verification details
  function displayVerificationDetails(verification) {
    const container = document.getElementById('verification-details');
    if (!container) return;
    
    // Clear content
    container.innerHTML = '';
    
    // Create details content
    const details = document.createElement('div');
    
    // Basic info
    details.innerHTML = `
      <h3>Verification ID: ${verification._id}</h3>
      <p>Merchant: ${verification.merchantId?.businessName || 'N/A'}</p>
      <p>Email: ${verification.userId?.email || 'N/A'}</p>
      <p>Status: ${verification.status}</p>
      <p>Submitted: ${formatDate(verification.submittedAt)}</p>
    `;
    
    // Business document section
    const businessDoc = document.createElement('div');
    businessDoc.className = 'card';
    businessDoc.innerHTML = `
      <h3>Business Document</h3>
      <p>Type: ${verification.businessDocument.type}</p>
      <p>Number: ${verification.businessDocument.number}</p>
      <p>Status: ${verification.businessDocument.status}</p>
      ${verification.businessDocument.rejectionReason ? `<p>Rejection Reason: ${verification.businessDocument.rejectionReason}</p>` : ''}
      ${verification.businessDocument.documentImage ? `<p><a href="#" class="document-link" data-type="business" data-id="${verification._id}">View Document</a></p>` : ''}
      
      <div class="form-group">
        <label for="business-doc-status">Update Status</label>
        <select id="business-doc-status">
          <option value="pending" ${verification.businessDocument.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="verified" ${verification.businessDocument.status === 'verified' ? 'selected' : ''}>Verified</option>
          <option value="rejected" ${verification.businessDocument.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="business-doc-rejection-reason">Rejection Reason (if rejected)</label>
        <textarea id="business-doc-rejection-reason" rows="2">${verification.businessDocument.rejectionReason || ''}</textarea>
      </div>
    `;
    
    // Personal document section
    const personalDoc = document.createElement('div');
    personalDoc.className = 'card';
    personalDoc.innerHTML = `
      <h3>Personal Document</h3>
      <p>Type: ${verification.personalDocument.type}</p>
      <p>Number: ${verification.personalDocument.number}</p>
      <p>Status: ${verification.personalDocument.status}</p>
      ${verification.personalDocument.rejectionReason ? `<p>Rejection Reason: ${verification.personalDocument.rejectionReason}</p>` : ''}
      
      ${verification.personalDocument.frontImage ? `<p><a href="#" class="document-link" data-type="personal" data-field="front" data-id="${verification._id}">View Front</a></p>` : ''}
      ${verification.personalDocument.backImage ? `<p><a href="#" class="document-link" data-type="personal" data-field="back" data-id="${verification._id}">View Back</a></p>` : ''}
      ${verification.personalDocument.selfieImage ? `<p><a href="#" class="document-link" data-type="personal" data-field="selfie" data-id="${verification._id}">View Selfie</a></p>` : ''}
      
      <div class="form-group">
        <label for="personal-doc-status">Update Status</label>
        <select id="personal-doc-status">
          <option value="pending" ${verification.personalDocument.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="verified" ${verification.personalDocument.status === 'verified' ? 'selected' : ''}>Verified</option>
          <option value="rejected" ${verification.personalDocument.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="personal-doc-rejection-reason">Rejection Reason (if rejected)</label>
        <textarea id="personal-doc-rejection-reason" rows="2">${verification.personalDocument.rejectionReason || ''}</textarea>
      </div>
    `;
    
    // Bank details section
    const bankDetails = document.createElement('div');
    bankDetails.className = 'card';
    bankDetails.innerHTML = `
      <h3>Bank Details</h3>
      <p>Account Name: ${verification.bankDetails.accountName}</p>
      <p>Account Number: ${verification.bankDetails.accountNumber}</p>
      <p>Bank Name: ${verification.bankDetails.bankName}</p>
      ${verification.bankDetails.routingNumber ? `<p>Routing Number: ${verification.bankDetails.routingNumber}</p>` : ''}
      ${verification.bankDetails.bankBranch ? `<p>Bank Branch: ${verification.bankDetails.bankBranch}</p>` : ''}
      <p>Status: ${verification.bankDetails.status}</p>
      ${verification.bankDetails.rejectionReason ? `<p>Rejection Reason: ${verification.bankDetails.rejectionReason}</p>` : ''}
      
      ${verification.bankDetails.statementDocument ? `<p><a href="#" class="document-link" data-type="bank" data-id="${verification._id}">View Statement</a></p>` : ''}
      
      <div class="form-group">
        <label for="bank-details-status">Update Status</label>
        <select id="bank-details-status">
          <option value="pending" ${verification.bankDetails.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="verified" ${verification.bankDetails.status === 'verified' ? 'selected' : ''}>Verified</option>
          <option value="rejected" ${verification.bankDetails.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="bank-details-rejection-reason">Rejection Reason (if rejected)</label>
        <textarea id="bank-details-rejection-reason" rows="2">${verification.bankDetails.rejectionReason || ''}</textarea>
      </div>
    `;
    
    // Overall status section
    const overallStatus = document.createElement('div');
    overallStatus.className = 'card';
    overallStatus.innerHTML = `
      <h3>Overall Status</h3>
      
      <div class="form-group">
        <label for="overall-status">Update Overall Status</label>
        <select id="overall-status">
          <option value="pending" ${verification.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="verified" ${verification.status === 'verified' ? 'selected' : ''}>Verified</option>
          <option value="rejected" ${verification.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="rejection-note">Rejection Note (if rejected)</label>
        <textarea id="rejection-note" rows="3">${verification.rejectionNote || ''}</textarea>
      </div>
      
      <button id="update-verification-btn">Update Verification</button>
    `;
    
    // Add all sections to container
    container.appendChild(details);
    container.appendChild(businessDoc);
    container.appendChild(personalDoc);
    container.appendChild(bankDetails);
    container.appendChild(overallStatus);
    
    // Add event listener for document links
    const documentLinks = document.querySelectorAll('.document-link');
    documentLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        
        const type = this.getAttribute('data-type');
        const id = this.getAttribute('data-id');
        const field = this.getAttribute('data-field');
        
        // Open document in new window
        let url = `/api/admin/documents/${type}/${id}`;
        if (field) {
          url += `/${field}`;
        }
        
        // Add admin token for authentication
        url += `?adminToken=${localStorage.getItem('admin_token')}`;
        
        window.open(url, '_blank');
      });
    });
    
    // Add event listener for update button
    const updateBtn = document.getElementById('update-verification-btn');
    if (updateBtn) {
      updateBtn.addEventListener('click', function() {
        updateVerification(verification._id);
      });
    }
  }
  
  // Update verification
  async function updateVerification(verificationId) {
    try {
      // Get form values
      const businessDocStatus = document.getElementById('business-doc-status').value;
      const businessDocRejectionReason = document.getElementById('business-doc-rejection-reason').value;
      const personalDocStatus = document.getElementById('personal-doc-status').value;
      const personalDocRejectionReason = document.getElementById('personal-doc-rejection-reason').value;
      const bankDetailsStatus = document.getElementById('bank-details-status').value;
      const bankDetailsRejectionReason = document.getElementById('bank-details-rejection-reason').value;
      const overallStatus = document.getElementById('overall-status').value;
      const rejectionNote = document.getElementById('rejection-note').value;
      
      // Prepare data
      const updateData = {
        businessDocStatus,
        personalDocStatus,
        bankDetailsStatus,
        overallStatus
      };
      
      // Add rejection reasons if status is rejected
      if (businessDocStatus === 'rejected' && businessDocRejectionReason) {
        updateData.businessDocRejectionReason = businessDocRejectionReason;
      }
      
      if (personalDocStatus === 'rejected' && personalDocRejectionReason) {
        updateData.personalDocRejectionReason = personalDocRejectionReason;
      }
      
      if (bankDetailsStatus === 'rejected' && bankDetailsRejectionReason) {
        updateData.bankDetailsRejectionReason = bankDetailsRejectionReason;
      }
      
      if (overallStatus === 'rejected' && rejectionNote) {
        updateData.rejectionNote = rejectionNote;
      }
      
      // Disable button
      const updateBtn = document.getElementById('update-verification-btn');
      if (updateBtn) {
        updateBtn.disabled = true;
        updateBtn.textContent = 'Updating...';
      }
      
      // Update verification
      const result = await apiRequest(`/admin/verifications/${verificationId}/update`, 'POST', updateData, false, true);
      
      if (result && result.success) {
        showAlert('Verification updated successfully', 'success');
        
        // Reload verification details
        loadVerificationDetails(verificationId);
      } else {
        showAlert(result?.message || 'Failed to update verification', 'error');
      }
      
      // Enable button
      if (updateBtn) {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Update Verification';
      }
    } catch (error) {
      console.error('Error updating verification:', error);
      showAlert('Error updating verification', 'error');
      
      // Enable button
      const updateBtn = document.getElementById('update-verification-btn');
      if (updateBtn) {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Update Verification';
      }
    }
  }
  
  // Load users
  async function loadUsers(filters = {}) {
    try {
      // Show loading
      showLoading('users-list');
      
      // Build query parameters
      let queryParams = '?';
      
      if (filters.status) {
        queryParams += `status=${filters.status}&`;
      }
      
      if (filters.search) {
        queryParams += `search=${filters.search}&`;
      }
      
      // Remove trailing & or ? if exists
      if (queryParams.endsWith('&') || queryParams.endsWith('?')) {
        queryParams = queryParams.slice(0, -1);
      }
      
      // Fetch users
      const result = await apiRequest(`/admin/users${queryParams}`, 'GET', null, false, true);
      
      if (result && result.success) {
        displayUsers(result.data.users);
      } else {
        document.getElementById('users-list').innerHTML = '<p>Failed to load users</p>';
      }
    } catch (error) {
      console.error('Error loading users:', error);
      document.getElementById('users-list').innerHTML = '<p>Error loading users</p>';
    }
  }
  
  // Display users list
  function displayUsers(users) {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    // Clear content
    container.innerHTML = '';
    
    if (!users || users.length === 0) {
      container.innerHTML = '<p>No users found.</p>';
      return;
    }
    
    // Create table
    const table = document.createElement('table');
    
    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>ID</th>
        <th>Email</th>
        <th>Role</th>
        <th>Status</th>
        <th>Verification</th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    
    users.forEach(user => {
      const tr = document.createElement('tr');
      
      const merchantInfo = user.merchantId ? 
        `<br><small>${user.merchantId.businessName} (${user.merchantId.country})</small>` :
        '';
      
      // Format status with color
      let statusHtml = user.status;
      if (user.status === 'active') {
        statusHtml = `<span style="color: green;">${user.status}</span>`;
      } else if (user.status === 'suspended') {
        statusHtml = `<span style="color: orange;">${user.status}</span>`;
      } else if (user.status === 'blocked') {
        statusHtml = `<span style="color: red;">${user.status}</span>`;
      }
      
      // Format verification status with color
      let verificationHtml = user.idCheckStatus || 'Not started';
      if (user.idCheckStatus === 'verified') {
        verificationHtml = `<span style="color: green;">${user.idCheckStatus}</span>`;
      } else if (user.idCheckStatus === 'pending') {
        verificationHtml = `<span style="color: orange;">${user.idCheckStatus}</span>`;
      } else if (user.idCheckStatus === 'rejected') {
        verificationHtml = `<span style="color: red;">${user.idCheckStatus}</span>`;
      }
      
      // Action buttons based on current status
      let actionButtons = `<button class="view-user-btn" data-id="${user._id}">View</button> `;
      
      if (user.status === 'active') {
        actionButtons += `
          <button class="suspend-user-btn" data-id="${user._id}">Suspend</button>
          <button class="block-user-btn" data-id="${user._id}">Block</button>
        `;
      } else if (user.status === 'suspended' || user.status === 'blocked') {
        actionButtons += `<button class="activate-user-btn" data-id="${user._id}">Activate</button>`;
      }
      
      tr.innerHTML = `
        <td>${user._id}</td>
        <td>${user.email}${merchantInfo}</td>
        <td>${user.role}</td>
        <td>${statusHtml}</td>
        <td>${verificationHtml}</td>
        <td>${actionButtons}</td>
      `;
      
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Add event listeners to action buttons
    attachUserButtonListeners();
  }
  
  // Attach event listeners to user action buttons
  function attachUserButtonListeners() {
    // View user buttons
    const viewButtons = document.querySelectorAll('.view-user-btn');
    viewButtons.forEach(button => {
      button.addEventListener('click', function() {
        const userId = this.getAttribute('data-id');
        window.location.href = `user-details.html?id=${userId}`;
      });
    });
    
    // Suspend user buttons
    const suspendButtons = document.querySelectorAll('.suspend-user-btn');
    suspendButtons.forEach(button => {
      button.addEventListener('click', function() {
        const userId = this.getAttribute('data-id');
        openSuspendUserModal(userId);
      });
    });
    
    // Block user buttons
    const blockButtons = document.querySelectorAll('.block-user-btn');
    blockButtons.forEach(button => {
      button.addEventListener('click', function() {
        const userId = this.getAttribute('data-id');
        confirmBlockUser(userId);
      });
    });
    
    // Activate user buttons
    const activateButtons = document.querySelectorAll('.activate-user-btn');
    activateButtons.forEach(button => {
      button.addEventListener('click', function() {
        const userId = this.getAttribute('data-id');
        activateUser(userId);
      });
    });
  }
  
  // Open suspend user modal
  function openSuspendUserModal(userId) {
    // Set user ID in hidden field
    document.getElementById('suspend-user-id').value = userId;
    
    // Show modal
    document.getElementById('suspend-user-modal').style.display = 'block';
  }
  
  // Suspend user
  async function suspendUser(userId, suspendUntil) {
    try {
      // Suspend user
      const result = await apiRequest(`/admin/users/${userId}/suspend`, 'POST', { suspendUntil }, false, true);
      
      if (result && result.success) {
        showAlert('User suspended successfully', 'success');
        
        // Close modal
        document.getElementById('suspend-user-modal').style.display = 'none';
        
        // Reload users
        loadUsers();
      } else {
        showAlert(result?.message || 'Failed to suspend user', 'error');
      }
    } catch (error) {
      console.error('Error suspending user:', error);
      showAlert('Error suspending user', 'error');
    }
  }
  
  // Confirm block user
  function confirmBlockUser(userId) {
    if (confirm('Are you sure you want to block this user? This action cannot be undone.')) {
      blockUser(userId);
    }
  }
  
  // Block user
  async function blockUser(userId) {
    try {
      // Block user
      const result = await apiRequest(`/admin/users/${userId}/block`, 'POST', {}, false, true);
      
      if (result && result.success) {
        showAlert('User blocked successfully', 'success');
        
        // Reload users
        loadUsers();
      } else {
        showAlert(result?.message || 'Failed to block user', 'error');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      showAlert('Error blocking user', 'error');
    }
  }
  
  // Activate user
  async function activateUser(userId) {
    try {
      // Activate user
      const result = await apiRequest(`/admin/users/${userId}/activate`, 'POST', {}, false, true);
      
      if (result && result.success) {
        showAlert('User activated successfully', 'success');
        
        // Reload users
        loadUsers();
      } else {
        showAlert(result?.message || 'Failed to activate user', 'error');
      }
    } catch (error) {
      console.error('Error activating user:', error);
      showAlert('Error activating user', 'error');
    }
  }
  
  // Load user details
  async function loadUserDetails(userId) {
    try {
      // Show loading
      showLoading('user-details');
      
      // Fetch user details
      const result = await apiRequest(`/admin/users/${userId}`, 'GET', null, false, true);
      
      if (result && result.success) {
        displayUserDetails(result.data);
      } else {
        document.getElementById('user-details').innerHTML = '<p>Failed to load user details</p>';
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      document.getElementById('user-details').innerHTML = '<p>Error loading user details</p>';
    }
  }
  
  // Display user details
  function displayUserDetails(data) {
    const container = document.getElementById('user-details');
    if (!container) return;
    
    // Clear content
    container.innerHTML = '';
    
    const user = data.user;
    const verification = data.verification;
    
    // Create details content
    const details = document.createElement('div');
    
    // Basic info
    details.innerHTML = `
      <h3>User ID: ${user._id}</h3>
      <p>Email: ${user.email}</p>
      <p>Role: ${user.role}</p>
      <p>Status: ${user.status}</p>
      <p>Verification Status: ${user.idCheckStatus || 'Not started'}</p>
      <p>Email Verified: ${user.emailVerified ? 'Yes' : 'No'}</p>
      <p>Onboarding Stage: ${user.onboardingStage}</p>
      <p>Onboarding Complete: ${user.onboardingComplete ? 'Yes' : 'No'}</p>
    `;
    
    // Merchant info if exists
    if (user.merchantId) {
      details.innerHTML += `
        <h3>Merchant Details</h3>
        <p>Business Name: ${user.merchantId.businessName}</p>
        <p>Country: ${user.merchantId.country}</p>
        <p>Status: ${user.merchantId.status}</p>
        <p>Selling Method: ${user.merchantId.sellingMethod}</p>
      `;
    }
    
    // Verification info if exists
    if (verification) {
      details.innerHTML += `
        <h3>Verification</h3>
        <p>Status: ${verification.status}</p>
        <p>Submitted At: ${formatDate(verification.submittedAt)}</p>
        <p><a href="verification-details.html?id=${verification._id}">View Verification Details</a></p>
      `;
    }
    
    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.style.marginTop = '20px';
    
    // Different actions based on current status
    if (user.status === 'active') {
      actionsDiv.innerHTML = `
        <button id="suspend-btn" class="button">Suspend User</button>
        <button id="block-btn" class="button">Block User</button>
      `;
    } else if (user.status === 'suspended' || user.status === 'blocked') {
      actionsDiv.innerHTML = `
        <button id="activate-btn" class="button">Activate User</button>
      `;
    }
    
    // Additional actions
    actionsDiv.innerHTML += `
      <button id="edit-btn" class="button">Edit User</button>
      <button id="delete-btn" class="button" style="background-color: #dc3545;">Delete User</button>
    `;
    
    // Add to container
    container.appendChild(details);
    container.appendChild(actionsDiv);
    
    // Add event listeners to action buttons
    const suspendBtn = document.getElementById('suspend-btn');
    if (suspendBtn) {
      suspendBtn.addEventListener('click', function() {
        openSuspendUserModal(user._id);
      });
    }
    
    const blockBtn = document.getElementById('block-btn');
    if (blockBtn) {
      blockBtn.addEventListener('click', function() {
        confirmBlockUser(user._id);
      });
    }
    
    const activateBtn = document.getElementById('activate-btn');
    if (activateBtn) {
      activateBtn.addEventListener('click', function() {
        activateUser(user._id);
      });
    }
    
    const editBtn = document.getElementById('edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        openEditUserModal(user);
      });
    }
    
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function() {
        confirmDeleteUser(user._id);
      });
    }
  }
  
  // Open edit user modal
  function openEditUserModal(user) {
    // Populate form fields
    document.getElementById('edit-user-id').value = user._id;
    document.getElementById('edit-user-email').value = user.email;
    document.getElementById('edit-user-role').value = user.role;
    document.getElementById('edit-user-status').value = user.status;
    document.getElementById('edit-user-id-check-status').value = user.idCheckStatus || '';
    document.getElementById('edit-user-email-verified').value = user.emailVerified ? 'true' : 'false';
    
    if (user.merchantId) {
      document.getElementById('edit-user-business-name').value = user.merchantId.businessName;
      document.getElementById('edit-user-country').value = user.merchantId.country;
      document.getElementById('edit-user-selling-method').value = user.merchantId.sellingMethod;
    }
    
    // Show modal
    document.getElementById('edit-user-modal').style.display = 'block';
  }
  
  // Edit user
  async function editUser(event) {
    event.preventDefault();
    
    const userId = document.getElementById('edit-user-id').value;
    const email = document.getElementById('edit-user-email').value;
    const role = document.getElementById('edit-user-role').value;
    const status = document.getElementById('edit-user-status').value;
    const idCheckStatus = document.getElementById('edit-user-id-check-status').value;
    const emailVerified = document.getElementById('edit-user-email-verified').value;
    const businessName = document.getElementById('edit-user-business-name').value;
    const country = document.getElementById('edit-user-country').value;
    const sellingMethod = document.getElementById('edit-user-selling-method').value;
    
    try {
      const updateBtn = document.getElementById('update-user-btn');
      updateBtn.disabled = true;
      updateBtn.textContent = 'Updating...';
      
      // Update user fields one by one
      if (email) {
        await apiRequest(`/admin/users/${userId}/edit`, 'POST', { field: 'email', value: email }, false, true);
      }
      
      if (role) {
        await apiRequest(`/admin/users/${userId}/edit`, 'POST', { field: 'role', value: role }, false, true);
      }
      
      if (status) {
        await apiRequest(`/admin/users/${userId}/edit`, 'POST', { field: 'status', value: status }, false, true);
      }
      
      if (idCheckStatus) {
        await apiRequest(`/admin/users/${userId}/edit`, 'POST', { field: 'idCheckStatus', value: idCheckStatus }, false, true);
      }
      
      if (emailVerified) {
        await apiRequest(`/admin/users/${userId}/edit`, 'POST', { field: 'emailVerified', value: emailVerified }, false, true);
      }
      
      if (businessName) {
        await apiRequest(`/admin/users/${userId}/edit`, 'POST', { field: 'businessName', value: businessName }, false, true);
      }
      
      if (country) {
        await apiRequest(`/admin/users/${userId}/edit`, 'POST', { field: 'country', value: country }, false, true);
      }
      
      if (sellingMethod) {
        await apiRequest(`/admin/users/${userId}/edit`, 'POST', { field: 'sellingMethod', value: sellingMethod }, false, true);
      }
      
      showAlert('User updated successfully', 'success');
      
      // Close modal
      document.getElementById('edit-user-modal').style.display = 'none';
      
      // Reload user details
      loadUserDetails(userId);
      
      updateBtn.disabled = false;
      updateBtn.textContent = 'Update User';
    } catch (error) {
      console.error('Error updating user:', error);
      showAlert('Error updating user', 'error');
      
      const updateBtn = document.getElementById('update-user-btn');
      updateBtn.disabled = false;
      updateBtn.textContent = 'Update User';
    }
  }
  
  // Confirm delete user
  function confirmDeleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone and will delete all associated data.')) {
      deleteUser(userId);
    }
  }
  
  // Delete user
  async function deleteUser(userId) {
    try {
      // Delete user
      const result = await apiRequest(`/admin/users/${userId}/delete`, 'POST', {}, false, true);
      
      if (result && result.success) {
        showAlert('User deleted successfully', 'success');
        
        // Redirect to users list
        window.location.href = 'users.html';
      } else {
        showAlert(result?.message || 'Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showAlert('Error deleting user', 'error');
    }
  }
  
  // Handle admin API requests
  async function apiRequest(endpoint, method = 'GET', data = null, includeAuth = true, isAdmin = false) {
    const url = `${API_URL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add admin token if isAdmin is true
    if (isAdmin) {
      const adminToken = localStorage.getItem('admin_token');
      if (adminToken) {
        headers['X-Admin-Token'] = adminToken;
      } else {
        // Redirect to admin login if token doesn't exist
        window.location.href = '/admin-login.html';
        return null;
      }
    } 
    // Otherwise handle normal authentication
    else if (includeAuth) {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        window.location.href = '/login.html';
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
      if (response.status === 401) {
        if (isAdmin) {
          localStorage.removeItem('admin_token');
          window.location.href = '/admin-login.html';
        } else {
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('user_data');
          window.location.href = '/login.html';
        }
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
  
  // Initialize admin pages
  document.addEventListener('DOMContentLoaded', function() {
    // Check for admin token
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken && !window.location.pathname.includes('admin-login.html')) {
      window.location.href = '/admin-login.html';
      return;
    }
    
    // Init for admin dashboard
    if (window.location.pathname.includes('admin/index.html')) {
      createSidebar('Dashboard');
      loadAdminDashboard();
    }
    // Init for verifications page
    else if (window.location.pathname.includes('admin/verifications.html')) {
      createSidebar('Verifications');
      
      // Default to pending verifications
      loadPendingVerifications();
      
      // Add event listeners for tab buttons
      document.getElementById('pending-tab').addEventListener('click', function() {
        loadPendingVerifications();
      });
      
      document.getElementById('rejected-tab').addEventListener('click', function() {
        loadRejectedVerifications();
      });
    }
    // Init for verification details page
    else if (window.location.pathname.includes('admin/verification-details.html')) {
      createSidebar('Verifications');
      
      // Get verification ID from URL
      const params = getUrlParams();
      if (params.id) {
        loadVerificationDetails(params.id);
      } else {
        window.location.href = 'verifications.html';
      }
    }
    // Init for users page
    else if (window.location.pathname.includes('admin/users.html')) {
      createSidebar('Users');
      
      // Load users
      loadUsers();
      
      // Add event listener for search form
      const searchForm = document.getElementById('user-search-form');
      if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
          e.preventDefault();
          
          const status = document.getElementById('filter-status').value;
          const search = document.getElementById('search-query').value;
          
          loadUsers({ status, search });
        });
      }
      
      // Add event listener for reset button
      const resetBtn = document.getElementById('reset-search-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', function() {
          document.getElementById('user-search-form').reset();
          loadUsers();
        });
      }
    }
    // Init for user details page
    else if (window.location.pathname.includes('admin/user-details.html')) {
      createSidebar('Users');
      
      // Get user ID from URL
      const params = getUrlParams();
      if (params.id) {
        loadUserDetails(params.id);
      } else {
        window.location.href = 'users.html';
      }
      
      // Add event listener for suspend form
      const suspendForm = document.getElementById('suspend-user-form');
      if (suspendForm) {
        suspendForm.addEventListener('submit', function(e) {
          e.preventDefault();
          
          const userId = document.getElementById('suspend-user-id').value;
          const suspendUntil = document.getElementById('suspend-until').value;
          
          if (!suspendUntil) {
            showAlert('Please select a suspension end date', 'error');
            return;
          }
          
          suspendUser(userId, suspendUntil);
        });
      }
      
      // Add event listener for close modal buttons
      const closeButtons = document.querySelectorAll('.close-modal');
      closeButtons.forEach(button => {
        button.addEventListener('click', function() {
          document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
          });
        });
      });
      
      // Add event listener for edit user form
      const editUserForm = document.getElementById('edit-user-form');
      if (editUserForm) {
        editUserForm.addEventListener('submit', editUser);
      }
      
      // Close modal when clicking outside
      window.addEventListener('click', function(event) {
        document.querySelectorAll('.modal').forEach(modal => {
          if (event.target === modal) {
            modal.style.display = 'none';
          }
        });
      });
    }
  });