// js/products.js - FULLY UPDATED VERSION

// Toggle file method fields (URL or upload)
function toggleFileMethodFields() {
    const fileMethod = document.querySelector('input[name="file-method"]:checked')?.value;
    const fileUrlContainer = document.getElementById('file-url-container');
    const fileUploadContainer = document.getElementById('file-upload-container');
  
    // guard against missing elements
    if (!fileUrlContainer || !fileUploadContainer) return;
  
    if (fileMethod === 'url') {
        fileUrlContainer.style.display = 'block';
        fileUploadContainer.style.display = 'none';
        
        // Clear file upload when URL is selected
        const fileUploadInput = document.getElementById('product-file-upload');
        if (fileUploadInput) fileUploadInput.value = '';
    } else {
        fileUrlContainer.style.display = 'none';
        fileUploadContainer.style.display = 'block';
        
        // Clear URL input when file upload is selected
        const fileUrlInput = document.getElementById('product-file-url');
        if (fileUrlInput) fileUrlInput.value = '';
    }
}

// This function ensures consistent image URL formatting throughout the frontend
function formatImageUrl(imageUrl) {
    if (!imageUrl) return '';

    // If already a full URL with protocol, return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }

    // Extract the base URL from API_URL (e.g., http://localhost:5000)
    const baseUrl = API_URL.split('/api')[0];

    // Handle /api/uploads paths (preserve them as is)
    if (imageUrl.startsWith('/api/uploads/')) {
        return `${baseUrl}${imageUrl}`;
    }

    // Handle /uploads paths
    if (imageUrl.startsWith('/uploads/')) {
        return `${baseUrl}${imageUrl}`;
    }

    // If it's just a filename, assume it should be in /uploads
    if (!imageUrl.includes('/')) {
        return `${baseUrl}/uploads/${imageUrl}`;
    }

    // Default fallback - just prepend the base URL
    return `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

// Fetch and display products
async function loadProducts() {
    try {
        // Show loading
        showLoading('products-list');
    
        // Fetch products
        const result = await apiRequest('/products', 'GET');
    
        if (result && result.success) {
            displayProducts(result.data);
        } else {
            document.getElementById('products-list').innerHTML = '<p>Failed to load products</p>';
        }
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('products-list').innerHTML = '<p>Error loading products</p>';
    }
}

// Display products list
function displayProducts(data) {
    const container = document.getElementById('products-list');
    if (!container) return;

    // Clear content
    container.innerHTML = '';

    if (!data.products || data.products.length === 0) {
        container.innerHTML = '<p>No products found. Create your first product!</p>';
        return;
    }

    // Create table
    const table = document.createElement('table');

    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Image</th>
        <th>Name</th>
        <th>Price</th>
        <th>Type</th>
        <th>Status</th>
        <th>Created</th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');

    data.products.forEach(product => {
        const tr = document.createElement('tr');

        // Find main image or use first image
        let imageUrl = '';
        let imageAlt = product.title || 'Product image';

        if (product.images && product.images.length > 0) {
            const mainImage = product.images.find(img => img.isMain);
            const rawUrl = mainImage ? mainImage.url : product.images[0].url;
            imageUrl = formatImageUrl(rawUrl);

            // Log the raw and formatted URLs for debugging
            console.log('Raw image URL:', rawUrl, '| Formatted URL:', imageUrl);
        }

        tr.innerHTML = `
          <td>${imageUrl ? `<img src="${imageUrl}" alt="${imageAlt}" style="width: 50px; height: 50px; object-fit: cover;" onerror="this.src='../img/placeholder.png'; this.onerror=null;">` : 'No image'}</td>
          <td>${product.title}</td>
          <td>${formatCurrency(product.price, product.currency)}</td>
          <td>${product.type}</td>
          <td>${product.status}</td>
          <td>${formatDate(product.createdAt)}</td>
          <td>
            <button class="edit-btn" data-id="${product._id}">Edit</button>
            <button class="delete-btn" data-id="${product._id}">Delete</button>
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
                loadProductsPage(data.page - 1);
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
                loadProductsPage(data.page + 1);
            });
            pagination.appendChild(nextBtn);
        }

        container.appendChild(pagination);
    }

    // Add event listeners for edit/delete buttons
    attachProductButtonListeners();
}

// Load products for a specific page
async function loadProductsPage(page = 1, limit = 10) {
    try {
        // Show loading
        showLoading('products-list');

        // Fetch products with pagination
        const result = await apiRequest(`/products?page=${page}&limit=${limit}`, 'GET');

        if (result && result.success) {
            displayProducts(result.data);
        } else {
            document.getElementById('products-list').innerHTML = '<p>Failed to load products</p>';
        }
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('products-list').innerHTML = '<p>Error loading products</p>';
    }
}

// Attach event listeners to product action buttons
function attachProductButtonListeners() {
    // Edit buttons
    const editButtons = document.querySelectorAll('.edit-btn');
    editButtons.forEach(button => {
        button.addEventListener('click', function () {
            const productId = this.getAttribute('data-id');
            openEditProductModal(productId);
        });
    });

    // Delete buttons
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function () {
            const productId = this.getAttribute('data-id');
            confirmDeleteProduct(productId);
        });
    });
}

// Generate a random slug (10 characters, alphanumeric)
function generateSlug() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let slug = '';
    for (let i = 0; i < 10; i++) {
        slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return slug;
}

// Update image counter and enforce 10 image limit
function updateImageCounter(inputId, counterId) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId) || 
                    document.querySelector(`#${inputId}`).nextElementSibling;
    
    if (input && counter) {
        const fileCount = input.files.length;
        
        if (fileCount > 10) {
            // Warn the user
            counter.textContent = `${fileCount}/10 images selected (only first 10 will be used)`;
            counter.style.color = 'red';
        } else {
            counter.textContent = `${fileCount}/10 images selected`;
            counter.style.color = fileCount > 8 ? 'orange' : '#666';
        }
    }
}

// Handle image preview for create form
function handleImagePreview() {
    const imageInput = document.getElementById('product-images');
    const previewContainer = document.getElementById('image-previews');

    if (!imageInput || !previewContainer) return;

    // Add listener for image counter
    imageInput.addEventListener('change', function() {
        updateImageCounter('product-images', 'image-counter');
    });

    imageInput.addEventListener('change', function () {
        // Clear existing previews
        previewContainer.innerHTML = '';

        // Limit to 10 images
        const maxImages = 10;
        const filesToPreview = Array.from(this.files).slice(0, maxImages);

        if (filesToPreview.length > 0) {
            for (let i = 0; i < filesToPreview.length; i++) {
                const file = filesToPreview[i];
                const reader = new FileReader();

                reader.onload = function (e) {
                    const preview = document.createElement('div');
                    preview.className = 'image-preview';
                    preview.innerHTML = `
                      <img src="${e.target.result}" alt="Preview" style="width: 100px; height: 100px; object-fit: cover;">
                      <div>
                        <label>
                          <input type="radio" name="main-image" value="${i}" ${i === 0 ? 'checked' : ''}>
                          Main Image
                        </label>
                        <button type="button" class="remove-image-btn" data-index="${i}">Remove</button>
                      </div>
                    `;
                    previewContainer.appendChild(preview);

                    // Add event listener for remove button
                    const removeButton = preview.querySelector('.remove-image-btn');
                    if (removeButton) {
                        removeButton.addEventListener('click', function() {
                            preview.remove();

                            // Re-index the remaining images
                            const previews = previewContainer.querySelectorAll('.image-preview');
                            previews.forEach((preview, newIndex) => {
                                const radio = preview.querySelector('input[type="radio"]');
                                const removeBtn = preview.querySelector('.remove-image-btn');

                                if (radio) radio.value = newIndex;
                                if (removeBtn) removeBtn.setAttribute('data-index', newIndex);
                            });

                            // If all images are removed, clear the file input
                            if (previews.length === 0) {
                                imageInput.value = '';
                                updateImageCounter('product-images', 'image-counter');
                            }
                        });
                    }
                };

                reader.readAsDataURL(file);
            }
        }
    });
}

// Handle image preview for edit form
function handleEditImagePreview() {
    const imageInput = document.getElementById('edit-product-new-images');
    const previewContainer = document.getElementById('edit-image-previews');
    const counter = document.getElementById('edit-image-counter');

    if (!imageInput || !previewContainer) return;

    // Add listener for image counter
    imageInput.addEventListener('change', function() {
        // Count existing images
        const existingImagesCount = previewContainer.querySelectorAll('.image-preview[data-type="existing"]').length;
        const newImagesCount = this.files.length;
        const totalImages = existingImagesCount + newImagesCount;
        
        if (totalImages > 10) {
            counter.textContent = `${totalImages}/10 images selected (exceeds limit)`;
            counter.style.color = 'red';
        } else {
            counter.textContent = `${totalImages}/10 images selected`;
            counter.style.color = totalImages > 8 ? 'orange' : '#666';
        }
    });

    imageInput.addEventListener('change', function () {
        // Calculate number of existing images
        const existingPreviews = previewContainer.querySelectorAll('.image-preview[data-type="existing"]');
        const existingCount = existingPreviews.length;
        
        // Calculate how many new images we can add (up to 10 total)
        const availableSlots = 10 - existingCount;
        
        if (availableSlots <= 0) {
            showAlert('Maximum 10 images allowed. Please remove some existing images first.', 'error');
            this.value = ''; // Clear the input
            return;
        }
        
        // Remove any existing "new" image previews
        const existingNewPreviews = previewContainer.querySelectorAll('.image-preview[data-type="new"]');
        existingNewPreviews.forEach(preview => preview.remove());

        if (this.files && this.files.length > 0) {
            // Limit new files to available slots
            const filesToPreview = Array.from(this.files).slice(0, availableSlots);
            
            for (let i = 0; i < filesToPreview.length; i++) {
                const file = filesToPreview[i];
                const reader = new FileReader();

                reader.onload = function (e) {
                    const preview = document.createElement('div');
                    preview.className = 'image-preview';
                    preview.dataset.type = 'new'; // Mark as a new image
                    preview.innerHTML = `
                      <img src="${e.target.result}" alt="Preview" style="width: 100px; height: 100px; object-fit: cover;">
                      <div>
                        <label>
                          <input type="radio" name="edit-main-image" value="new-${i}">
                          Main Image
                        </label>
                        <button type="button" class="remove-new-image-btn" data-index="${i}">Remove</button>
                      </div>
                    `;
                    previewContainer.appendChild(preview);

                    // Add event listener for remove button
                    const removeButton = preview.querySelector('.remove-new-image-btn');
                    if (removeButton) {
                        removeButton.addEventListener('click', function() {
                            // Create a new FileList without the removed file
                            preview.remove();
                            
                            // Update image counter
                            updateEditImageCounter();
                            
                            // If all new images are removed, clear the file input
                            const newPreviews = previewContainer.querySelectorAll('.image-preview[data-type="new"]');
                            if (newPreviews.length === 0) {
                                imageInput.value = '';
                            }
                        });
                    }
                };

                reader.readAsDataURL(file);
            }
            
            // If there are more files than slots, show warning
            if (this.files.length > availableSlots) {
                showAlert(`Only ${availableSlots} out of ${this.files.length} images will be used (10 images maximum).`, 'warning');
            }
        }
    });
    
    // Update the edit image counter based on existing previews
    function updateEditImageCounter() {
        const existingCount = previewContainer.querySelectorAll('.image-preview[data-type="existing"]').length;
        const newCount = previewContainer.querySelectorAll('.image-preview[data-type="new"]').length;
        const totalCount = existingCount + newCount;
        
        if (counter) {
            counter.textContent = `${totalCount}/10 images selected`;
            counter.style.color = totalCount > 8 ? 'orange' : '#666';
        }
    }
}

// Add a shipping method row
function addShippingMethodRow(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'shipping-method-row';
    row.innerHTML = `
    <input type="text" class="shipping-method-name" placeholder="Method name (e.g. Standard Shipping)">
    <input type="number" class="shipping-method-price" min="0" step="0.01" placeholder="Price">
    <button type="button" class="remove-shipping-method-btn">×</button>
`;

    
    container.appendChild(row);
    
    // Add event listener for remove button
    const removeButton = row.querySelector('.remove-shipping-method-btn');
    if (removeButton) {
        removeButton.addEventListener('click', function() {
            row.remove();
        });
    }
}

// Create product form submission
async function handleCreateProduct(event) {
    event.preventDefault();

    // gather basic fields
    const title = document.getElementById('product-title').value;
    const shortDescription = document.getElementById('product-short-description').value;
    const longDescription = document.getElementById('product-long-description').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const currency = document.getElementById('product-currency').value;
    const type = document.getElementById('product-type').value;
    const sku = document.getElementById('product-sku').value;
    const barcode = document.getElementById('product-barcode').value;
    const slug = generateSlug(); // Generate a random slug

    if (!title || !shortDescription || !longDescription || isNaN(price) || price <= 0 || !currency || !type) {
        showAlert('Please fill in all required fields with valid values', 'error');
        return;
    }

    const submitBtn = document.getElementById('create-product-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('shortDescription', shortDescription);
        formData.append('longDescription', longDescription);
        formData.append('description', shortDescription); // For backwards compatibility
        formData.append('price', price);
        formData.append('currency', currency);
        formData.append('type', type);
        formData.append('slug', slug);
        
        // Add inventory fields if provided
        if (sku) formData.append('sku', sku);
        if (barcode) formData.append('barcode', barcode);

        // Handle images
        const imageFiles = document.getElementById('product-images').files;
        if (imageFiles && imageFiles.length > 0) {
            // Limit to 10 images
            const maxImages = 10;
            const limitedImageFiles = Array.from(imageFiles).slice(0, maxImages);
            
            for (let i = 0; i < limitedImageFiles.length; i++) {
                formData.append('images', limitedImageFiles[i]);
            }

            // Set main image
            const mainImageRadio = document.querySelector('input[name="main-image"]:checked');
            if (mainImageRadio) {
                formData.append('mainImageIndex', mainImageRadio.value);
            }
        } else {
            showAlert('Please add at least one product image', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Product';
            return;
        }

        // DIGITAL-ONLY: handle file submission
        if (type === 'digital') {
            const fileMethod = document.querySelector('input[name="file-method"]:checked')?.value || 'url';
            formData.append('fileMethod', fileMethod);

            if (fileMethod === 'url') {
                const fileUrl = document.getElementById('product-file-url').value.trim();
                if (fileUrl) {
                    formData.append('fileUrl', fileUrl);
                }
            } else if (fileMethod === 'upload') {
                const fileInput = document.getElementById('product-file-upload');
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    formData.append('digitalFile', fileInput.files[0]);
                }
            }

            // Handle recurring subscription - ONLY if checkbox is checked
            const isRecurring = document.getElementById('product-recurring').checked;
            formData.append('isRecurring', isRecurring ? 'true' : 'false');
            
            if (isRecurring) {
                const digitalData = {
                    recurring: {
                        interval: document.getElementById('product-interval').value,
                        hasTrial: document.getElementById('product-has-trial').checked,
                        trialDays: parseInt(document.getElementById('product-trial-days').value, 10) || 0
                    }
                };
                formData.append('digital', JSON.stringify(digitalData));
            }
        }

        // Handle physical product data
        if (type === 'physical') {
            // Handle stock
            const hasStock = document.getElementById('product-has-stock').checked;
            formData.append('hasStock', hasStock ? 'true' : 'false');

            if (hasStock) {
                const stock = document.getElementById('product-stock').value.trim();
                formData.append('stock', stock || '0');
            }

            // Handle variants
            const hasVariants = document.getElementById('product-has-variants').checked;
            formData.append('hasVariants', hasVariants ? 'true' : 'false');

            if (hasVariants) {
                const variantContainer = document.getElementById('variants-container');
                const variantRows = variantContainer.querySelectorAll('.variant-row');

                if (variantRows.length > 0) {
                    const variants = [];

                    variantRows.forEach(row => {
                        const nameInput = row.querySelector('.variant-name');
                        const valuesInput = row.querySelector('.variant-values');
                        const stockInput = row.querySelector('.variant-stock');

                        if (nameInput && valuesInput) {
                            variants.push({
                                name: nameInput.value.trim(),
                                values: valuesInput.value.split(',').map(v => v.trim()).filter(v => v),
                                stock: parseInt(stockInput?.value, 10) || 0
                            });
                        }
                    });

                    if (variants.length > 0) {
                        formData.append('variants', JSON.stringify(variants));
                    }
                }
            }
            
            // Handle shipping methods
            const shippingContainer = document.getElementById('shipping-methods-container');
            const shippingRows = shippingContainer.querySelectorAll('.shipping-method-row');
            
            if (shippingRows.length > 0) {
                const shippingMethods = [];
                
                shippingRows.forEach(row => {
                    const nameInput = row.querySelector('.shipping-method-name');
                    const priceInput = row.querySelector('.shipping-method-price');
                    
                    if (nameInput && nameInput.value.trim() && priceInput) {
                        shippingMethods.push({
                            name: nameInput.value.trim(),
                            price: parseFloat(priceInput.value) || 0
                        });
                    }
                });
                
                if (shippingMethods.length > 0) {
                    formData.append('shippingMethods', JSON.stringify(shippingMethods));
                }
            }
        }

        // Debug: Log the FormData entries
        console.log("FormData contents:");
        for (let pair of formData.entries()) {
            console.log(pair[0] + ': ' + pair[1]);
        }

        // Send the request with proper authorization
        const token = localStorage.getItem('jwt_token');
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // No Content-Type here - browser sets it with boundary for multipart/form-data
            },
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            showAlert('Product created successfully', 'success');
            
            // Close modal
            document.getElementById('create-product-modal').style.display = 'none';
            
            // Reset form
            const form = document.getElementById('create-product-form');
            form.reset();
            
            // Explicitly reset checkboxes which may persist state
            document.getElementById('product-recurring').checked = false;
            document.getElementById('product-has-trial').checked = false;
            document.getElementById('product-has-stock').checked = true; // This one starts checked by default
            document.getElementById('product-has-variants').checked = false;
            
            // Reset visibility of conditional fields
            document.getElementById('recurring-options').style.display = 'none';
            document.getElementById('trial-options').style.display = 'none';
            document.getElementById('stock-field').style.display = 'block'; // This one starts visible by default
            document.getElementById('variants-section').style.display = 'none';
            
            // Clear preview containers
            document.getElementById('image-previews').innerHTML = '';
            document.querySelector('.image-counter').textContent = '0/10 images selected';
            
            loadProducts();
        } else {
            showAlert(result.message || 'Failed to create product', 'error');
        }
    } catch (err) {
        console.error('Error creating product:', err);
        showAlert('Error creating product: ' + (err.message || 'Unknown error'), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Product';
    }
}

// Open edit product modal
async function openEditProductModal(productId) {
    try {
        // Fetch product details
        const result = await apiRequest(`/products/${productId}`, 'GET');

        if (!result || !result.success) {
            showAlert(result?.message || 'Failed to load product details', 'error');
            return;
        }

        const product = result.data.product;
        console.log("Product data loaded:", product);

        // Get edit modal
        const editModal = document.getElementById('edit-product-modal');
        if (!editModal) {
            showAlert('Edit modal not found', 'error');
            return;
        }

        // Reset the form to clear any previous values
        const form = document.getElementById('edit-product-form');
        if (form) {
               form.reset();
            
               // Clear any old recurring/trial state
               const recurringCheckbox = document.getElementById('edit-product-recurring');
               if (recurringCheckbox) {
                 recurringCheckbox.checked = false;
                 toggleEditRecurringOptions();  // hide recurring options
               }
               const trialCheckbox = document.getElementById('edit-product-has-trial');
               if (trialCheckbox) {
                 trialCheckbox.checked = false;
                 toggleEditTrialOptions();      // hide trial options
               }
             }

        // Reset the file input for new images
        const newImagesInput = document.getElementById('edit-product-new-images');
        if (newImagesInput) newImagesInput.value = '';
        
        // Remove any previous hidden field for removed images
        const existingRemovedImagesInput = document.getElementById('edit-removed-images');
        if (existingRemovedImagesInput) {
            existingRemovedImagesInput.parentNode.removeChild(existingRemovedImagesInput);
        }

        // Populate form fields with safe checks
        // Hidden fields
        const idField = document.getElementById('edit-product-id');
        if (idField) idField.value = product._id;

        // Basic fields - using value property instead of setAttribute for better compatibility 
        const titleField = document.getElementById('edit-product-title');
        if (titleField) titleField.value = product.title || '';

        // Short description
        const shortDescField = document.getElementById('edit-product-short-description');
        if (shortDescField) shortDescField.value = product.shortDescription || product.description || '';

        // Long description
        const longDescField = document.getElementById('edit-product-long-description');
        if (longDescField) longDescField.value = product.longDescription || product.description || '';

        // Regular description as fallback for both if they don't exist
        const descField = document.getElementById('edit-product-description');
        if (descField) descField.value = product.description || '';

        // Price field
        const priceField = document.getElementById('edit-product-price');
        if (priceField) priceField.value = product.price || '';

        // Currency
        const currencySelect = document.getElementById('edit-product-currency');
        if (currencySelect) {
            currencySelect.value = product.currency || 'USD';
        }

        // Type
        const typeSelect = document.getElementById('edit-product-type');
        if (typeSelect) {
            typeSelect.value = product.type || 'digital';
            // Trigger type change event to update visible fields
            const event = new Event('change');
            typeSelect.dispatchEvent(event);
        }

        // Status
        const statusSelect = document.getElementById('edit-product-status');
        if (statusSelect) {
            statusSelect.value = product.status || 'active';
        }
        
        // Inventory fields
        const skuField = document.getElementById('edit-product-sku');
        if (skuField) skuField.value = product.sku || '';
        
        const barcodeField = document.getElementById('edit-product-barcode');
        if (barcodeField) barcodeField.value = product.barcode || '';

        // Populate image previews
        const editImagePreviewsContainer = document.getElementById('edit-image-previews');
        if (editImagePreviewsContainer) {
            editImagePreviewsContainer.innerHTML = '';

            if (product.images && product.images.length > 0) {
                product.images.forEach((image, index) => {
                    const imageUrl = formatImageUrl(image.url);

                    const imagePreview = document.createElement('div');
                    imagePreview.className = 'image-preview';
                    imagePreview.dataset.type = 'existing'; // Mark as existing image
                    imagePreview.dataset.originalIndex = index; // Store original index
                    imagePreview.innerHTML = `
                      <img src="${imageUrl}" alt="Image ${index + 1}" style="width: 100px; height: 100px; object-fit: cover;" onerror="this.src='../img/placeholder.png'; this.onerror=null;">
                      <div>
                        <label>
                          <input type="radio" name="edit-main-image" value="${index}" ${image.isMain ? 'checked' : ''}>
                          Main Image
                        </label>
                        <button type="button" class="remove-image-btn" data-index="${index}">Remove</button>
                      </div>
                    `;
                    editImagePreviewsContainer.appendChild(imagePreview);
                });

                // Add event listeners for remove buttons
                const removeButtons = editImagePreviewsContainer.querySelectorAll('.remove-image-btn');
                removeButtons.forEach(button => {
                    button.addEventListener('click', function () {
                        const index = this.getAttribute('data-index');
                        // Remove from DOM
                        this.closest('.image-preview').remove();
                        
                        // Get or create the hidden field for tracking removed images
                        let removedImagesInput = document.getElementById('edit-removed-images');
                        
                        if (!removedImagesInput) {
                            removedImagesInput = document.createElement('input');
                            removedImagesInput.type = 'hidden';
                            removedImagesInput.id = 'edit-removed-images';
                            removedImagesInput.name = 'edit-removed-images';
                            form.appendChild(removedImagesInput);
                        }
                        
                        // Add the index to the list of removed images
                        const currentRemoved = removedImagesInput.value ? removedImagesInput.value.split(',') : [];
                        if (!currentRemoved.includes(index)) { // Avoid duplicates
                            currentRemoved.push(index);
                            removedImagesInput.value = currentRemoved.join(',');
                        }
                        
                        // Update image counter
                        updateEditImageCounter();
                        
                        console.log('Marked image for removal:', index, 'Current removed list:', removedImagesInput.value);
                    });
                });
                
                // Update image counter
                const imageCounter = document.getElementById('edit-image-counter');
                if (imageCounter) {
                    imageCounter.textContent = `${product.images.length}/10 images selected`;
                }
            }
        }

        // Set up type-specific fields
        // Digital or physical
        const digitalFields = document.getElementById('edit-digital-fields');
        const physicalFields = document.getElementById('edit-physical-fields');

        if (product.type === 'digital') {
            if (digitalFields) digitalFields.style.display = 'block';
            if (physicalFields) physicalFields.style.display = 'none';

            // Set digital fields if available
            if (product.digital) {
                // Set file method (URL or upload)
                if (product.digital.fileUrl) {
                    const urlRadio = document.getElementById('edit-file-method-url');
                    if (urlRadio) urlRadio.checked = true;

                    const urlInput = document.getElementById('edit-product-file-url');
                    if (urlInput) urlInput.value = product.digital.fileUrl;

                    const urlContainer = document.getElementById('edit-file-url-container');
                    const uploadContainer = document.getElementById('edit-file-upload-container');

                    if (urlContainer) urlContainer.style.display = 'block';
                    if (uploadContainer) uploadContainer.style.display = 'none';
                } else if (product.digital.fileUpload) {
                    const uploadRadio = document.getElementById('edit-file-method-upload');
                    if (uploadRadio) uploadRadio.checked = true;

                    const urlContainer = document.getElementById('edit-file-url-container');
                    const uploadContainer = document.getElementById('edit-file-upload-container');

                    if (urlContainer) urlContainer.style.display = 'none';
                    if (uploadContainer) uploadContainer.style.display = 'block';

                    // Show current filename
                    const fileNameDisplay = document.getElementById('edit-current-file-name');
                    if (fileNameDisplay) {
                        fileNameDisplay.textContent = `Current file: ${product.digital.fileUpload}`;
                        fileNameDisplay.style.display = 'block';
                    }
                }

                // Set recurring options
                if (product.digital.recurring && product.digital.recurring.interval) {
                    const recurringCheckbox = document.getElementById('edit-product-recurring');
                    if (recurringCheckbox) {
                        recurringCheckbox.checked = true;
                        
                        // Explicitly trigger the change event
                        const event = new Event('change');
                        recurringCheckbox.dispatchEvent(event);
                    }

                    const recurringOptions = document.getElementById('edit-recurring-options');
                    if (recurringOptions) recurringOptions.style.display = 'block';

                    const intervalSelect = document.getElementById('edit-product-interval');
                    if (intervalSelect && product.digital.recurring.interval) {
                        intervalSelect.value = product.digital.recurring.interval;
                    }

                    // Set trial options
                    if (product.digital.recurring.hasTrial) {
                        const trialCheckbox = document.getElementById('edit-product-has-trial');
                        if (trialCheckbox) {
                            trialCheckbox.checked = true;
                            
                            // Explicitly trigger the change event
                            const event = new Event('change');
                            trialCheckbox.dispatchEvent(event);
                        }

                        const trialOptions = document.getElementById('edit-trial-options');
                        if (trialOptions) trialOptions.style.display = 'block';

                        const trialDaysInput = document.getElementById('edit-product-trial-days');
                        if (trialDaysInput && product.digital.recurring.trialDays !== undefined) {
                            trialDaysInput.value = product.digital.recurring.trialDays;
                        }
                    } else {
                        // Ensure trial options are hidden if hasTrial is false
                        const trialOptions = document.getElementById('edit-trial-options');
                        if (trialOptions) trialOptions.style.display = 'none';

                        const trialCheckbox = document.getElementById('edit-product-has-trial');
                        if (trialCheckbox) trialCheckbox.checked = false;
                    }
                } else {
                    // Ensure recurring options are hidden if recurring doesn't exist
                    const recurringOptions = document.getElementById('edit-recurring-options');
                    if (recurringOptions) recurringOptions.style.display = 'none';

                    const recurringCheckbox = document.getElementById('edit-product-recurring');
                    if (recurringCheckbox) recurringCheckbox.checked = false;
                }
            }
        } else {
            // Physical product
            if (digitalFields) digitalFields.style.display = 'none';
            if (physicalFields) physicalFields.style.display = 'block';

            // Set physical fields if available
            if (product.physical) {
                // Set stock
                if (product.physical.stock !== undefined) {
                    const stockCheckbox = document.getElementById('edit-product-has-stock');
                    if (stockCheckbox) {
                        stockCheckbox.checked = true;
                        
                        // Explicitly trigger the change event
                        const event = new Event('change');
                        stockCheckbox.dispatchEvent(event);
                    }

                    const stockField = document.getElementById('edit-stock-field');
                    if (stockField) stockField.style.display = 'block';

                    const stockInput = document.getElementById('edit-product-stock');
                    if (stockInput) stockInput.value = product.physical.stock;
                } else {
                    const stockCheckbox = document.getElementById('edit-product-has-stock');
                    if (stockCheckbox) stockCheckbox.checked = false;

                    const stockField = document.getElementById('edit-stock-field');
                    if (stockField) stockField.style.display = 'none';
                }
                
                // Set shipping methods
                const shippingMethodsContainer = document.getElementById('edit-shipping-methods-container');
                if (shippingMethodsContainer) {
                    shippingMethodsContainer.innerHTML = '';
                    
                    if (product.physical.shippingMethods && product.physical.shippingMethods.length > 0) {
                        product.physical.shippingMethods.forEach(method => {
                            const row = document.createElement('div');
                            row.className = 'shipping-method-row';
                            row.innerHTML = `
                            <input type="text" class="shipping-method-name" value="${method.name}" placeholder="Method name">
                            <input type="number" class="shipping-method-price" min="0" step="0.01" value="${method.price}" placeholder="Price">
                            <button type="button" class="remove-shipping-method-btn">×</button>
                        `;
                        
                            
                            shippingMethodsContainer.appendChild(row);
                            
                            // Add event listener for remove button
                            const removeButton = row.querySelector('.remove-shipping-method-btn');
                            if (removeButton) {
                                removeButton.addEventListener('click', function() {
                                    row.remove();
                                });
                            }
                        });
                    } else {
                        // Add at least one empty method row
                        addShippingMethodRow('edit-shipping-methods-container');
                    }
                }
            }

            // Set variants
            const variantsCheckbox = document.getElementById('edit-product-has-variants');
            const variantsSection = document.getElementById('edit-variants-section');
            const variantsContainer = document.getElementById('edit-variants-container');

            if (
                product.variants &&
                product.variants.length > 0 &&
                variantsCheckbox &&
                variantsSection &&
                variantsContainer
            ) {
                // Enable variants
                variantsCheckbox.checked = true;
                
                // Explicitly trigger the change event
                const event = new Event('change');
                variantsCheckbox.dispatchEvent(event);
                
                variantsSection.style.display = 'block';

                // Clear existing variants
                variantsContainer.innerHTML = '';

                // Add variant rows
                product.variants.forEach(variant => {
                    const variantRow = document.createElement('div');
                    variantRow.className = 'variant-row';
                    variantRow.innerHTML = `
                      <div class="form-group">
                        <label>Variant Name</label>
                        <input type="text" class="variant-name" value="${variant.name}" required>
                      </div>
                      <div class="form-group">
                        <label>Variant Values (comma-separated)</label>
                        <input type="text" class="variant-values" value="${variant.values.join(
                            ','
                        )}" required>
                      </div>
                      <div class="form-group">
                        <label>Stock</label>
                        <input type="number" class="variant-stock" value="${variant.stock || 0}" min="0">
                      </div>
                      <button type="button" class="remove-variant-btn">Remove</button>
                    `;

                    variantsContainer.appendChild(variantRow);
                });

                // Add event listeners for remove buttons
                const removeButtons = variantsContainer.querySelectorAll('.remove-variant-btn');
                removeButtons.forEach(button => {
                    button.addEventListener('click', function () {
                        this.closest('.variant-row').remove();
                    });
                });
            } else {
                // Ensure variants section is hidden if no variants
                if (variantsCheckbox) variantsCheckbox.checked = false;
                if (variantsSection) variantsSection.style.display = 'none';
            }
        }

        // Show modal
        editModal.style.display = 'block';
        
        // Update image counter for edit form
        function updateEditImageCounter() {
            const existingCount = editImagePreviewsContainer.querySelectorAll('.image-preview[data-type="existing"]').length;
            const newCount = editImagePreviewsContainer.querySelectorAll('.image-preview[data-type="new"]').length;
            const totalCount = existingCount + newCount;
            
            const counter = document.getElementById('edit-image-counter');
            if (counter) {
                counter.textContent = `${totalCount}/10 images selected`;
                counter.style.color = totalCount > 8 ? 'orange' : '#666';
            }
        }
        
        // Initialize the image counter
        updateEditImageCounter();
        
    } catch (error) {
        console.error('Error loading product details:', error);
        showAlert('Error loading product details: ' + (error.message || 'Unknown error'), 'error');
    }
}

// Update product form submission
async function handleUpdateProduct(event) {
    event.preventDefault();
    
    // Get form data
    const productId = document.getElementById('edit-product-id').value;
    const title = document.getElementById('edit-product-title').value;
    const shortDescription = document.getElementById('edit-product-short-description').value;
    const longDescription = document.getElementById('edit-product-long-description').value;
    const description = document.getElementById('edit-product-description').value; // For backwards compatibility
    const price = parseFloat(document.getElementById('edit-product-price').value);
    const currency = document.getElementById('edit-product-currency').value;
    const status = document.getElementById('edit-product-status').value;
    const type = document.getElementById('edit-product-type').value;
    const sku = document.getElementById('edit-product-sku').value;
    const barcode = document.getElementById('edit-product-barcode').value;

    if (!title || (!shortDescription && !description) || (!longDescription && !description) || isNaN(price) || price <= 0 || !currency || !status || !type) {
        showAlert('Please fill in all required fields with valid values', 'error');
        return;
    }

    try {
        const submitBtn = document.getElementById('update-product-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        // Create FormData for file uploads
        const formData = new FormData();
        formData.append('title', title);
        formData.append('shortDescription', shortDescription || description);
        formData.append('longDescription', longDescription || description);
        formData.append('description', description || shortDescription); // For backwards compatibility
        formData.append('price', price);
        formData.append('currency', currency);
        formData.append('status', status);
        formData.append('type', type);
        
        // Add inventory fields if provided
        if (sku) formData.append('sku', sku);
        if (barcode) formData.append('barcode', barcode);

        // Handle removed images
        const removedImagesInput = document.getElementById('edit-removed-images');
        if (removedImagesInput && removedImagesInput.value) {
            formData.append('removedImages', removedImagesInput.value);
        }

        // Handle main image selection
        const mainImageRadio = document.querySelector('input[name="edit-main-image"]:checked');
        if (mainImageRadio) {
            const mainImageValue = mainImageRadio.value;
            
            // Check if this is a new image or existing image
            if (mainImageValue.startsWith('new-')) {
                // New image selected as main, get the index from the value
                const newIndex = mainImageValue.split('-')[1];
                formData.append('mainImageIsNew', 'true');
                formData.append('mainImageNewIndex', newIndex);
            } else {
                // Existing image selected as main
                formData.append('mainImageIndex', mainImageValue);
            }
        }

        // Handle new image uploads - enforce limit of 10 total images
        const newImagesInput = document.getElementById('edit-product-new-images');
        if (newImagesInput && newImagesInput.files && newImagesInput.files.length > 0) {
            // Calculate existing images (not removed)
            const existingImages = document.querySelectorAll('#edit-image-previews .image-preview[data-type="existing"]').length;
            
            // Calculate how many new images we can add
            const maxNewImages = 10 - existingImages;
            
            if (maxNewImages > 0) {
                // Limit to available slots
                const filesToUpload = Array.from(newImagesInput.files).slice(0, maxNewImages);
                
                for (let i = 0; i < filesToUpload.length; i++) {
                    formData.append('newImages', filesToUpload[i]);
                }
            }
        }

        // Handle type-specific fields
        if (type === 'digital') {
            const fileMethod = document.querySelector('input[name="edit-file-method"]:checked')?.value;

            if (fileMethod) {
                formData.append('fileMethod', fileMethod);

                if (fileMethod === 'url') {
                    const fileUrl = document.getElementById('edit-product-file-url')?.value;
                    if (fileUrl) formData.append('fileUrl', fileUrl);
                } else if (fileMethod === 'upload') {
                    const fileInput = document.getElementById('edit-product-file-upload');
                    if (fileInput && fileInput.files && fileInput.files.length > 0) {
                        formData.append('digitalFile', fileInput.files[0]);
                    }
                }
            }

            // Handle recurring subscription - CHECK BOX STATE
            const isRecurring = document.getElementById('edit-product-recurring')?.checked;
            formData.append('isRecurring', isRecurring ? 'true' : 'false');

            if (isRecurring) {
                const digitalData = {
                    recurring: {
                        interval: document.getElementById('edit-product-interval')?.value || 'monthly',
                        hasTrial: document.getElementById('edit-product-has-trial')?.checked || false
                    }
                };

                if (digitalData.recurring.hasTrial) {
                    digitalData.recurring.trialDays =
                        parseInt(document.getElementById('edit-product-trial-days')?.value, 10) || 0;
                }

                formData.append('digital', JSON.stringify(digitalData));
            }
        } else if (type === 'physical') {
            // Handle stock
            const hasStock = document.getElementById('edit-product-has-stock')?.checked;
            formData.append('hasStock', hasStock ? 'true' : 'false');

            if (hasStock) {
                const stock = document.getElementById('edit-product-stock')?.value;
                formData.append('stock', stock || '0');
            }

            // Handle variants
            const hasVariants = document.getElementById('edit-product-has-variants')?.checked;
            formData.append('hasVariants', hasVariants ? 'true' : 'false');

            if (hasVariants) {
                const variantContainer = document.getElementById('edit-variants-container');
                const variantRows = variantContainer?.querySelectorAll('.variant-row');

                if (variantRows && variantRows.length > 0) {
                    const variants = [];

                    variantRows.forEach(row => {
                        const nameInput = row.querySelector('.variant-name');
                        const valuesInput = row.querySelector('.variant-values');
                        const stockInput = row.querySelector('.variant-stock');

                        if (nameInput && valuesInput) {
                            variants.push({
                                name: nameInput.value.trim(),
                                values: valuesInput.value.split(',').map(v => v.trim()).filter(v => v),
                                stock: parseInt(stockInput?.value, 10) || 0
                            });
                        }
                    });

                    if (variants.length > 0) {
                        formData.append('variants', JSON.stringify(variants));
                    }
                }
            }
            
            // Handle shipping methods
            const shippingContainer = document.getElementById('edit-shipping-methods-container');
            const shippingRows = shippingContainer?.querySelectorAll('.shipping-method-row');
            
            if (shippingRows && shippingRows.length > 0) {
                const shippingMethods = [];
                
                shippingRows.forEach(row => {
                    const nameInput = row.querySelector('.shipping-method-name');
                    const priceInput = row.querySelector('.shipping-method-price');
                    
                    if (nameInput && nameInput.value.trim() && priceInput) {
                        shippingMethods.push({
                            name: nameInput.value.trim(),
                            price: parseFloat(priceInput.value) || 0
                        });
                    }
                });
                
                if (shippingMethods.length > 0) {
                    formData.append('shippingMethods', JSON.stringify(shippingMethods));
                }
            }
        }

        // Debug log for form data
        console.log('FormData entries:');
        for (let pair of formData.entries()) {
            console.log(pair[0] + ': ' + (pair[1] instanceof File ? `File: ${pair[1].name}` : pair[1]));
        }

        // Send the update request
        const token = localStorage.getItem('jwt_token');
        const response = await fetch(`${API_URL}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
                // Do not set Content-Type for FormData - browser will set it automatically
            },
            body: formData
        });

        const result = await response.json();

        if (result && result.success) {
            showAlert('Product updated successfully', 'success');

            // Close modal and reload products
            const modal = document.getElementById('edit-product-modal');
            if (modal) modal.style.display = 'none';
            
            // Remove the hidden field to prevent it from persisting
            const removedImagesInput = document.getElementById('edit-removed-images');
            if (removedImagesInput) {
                removedImagesInput.parentNode.removeChild(removedImagesInput);
            }

            loadProducts();
        } else {
            showAlert(result?.message || 'Failed to update product', 'error');
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Product';
    } catch (error) {
        console.error('Error updating product:', error);
        showAlert('Error updating product: ' + (error.message || 'Unknown error'), 'error');

        const submitBtn = document.getElementById('update-product-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Product';
        }
    }
}

// Confirm delete product
function confirmDeleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        deleteProduct(productId);
    }
}

// Delete product
async function deleteProduct(productId) {
    try {
        const result = await apiRequest(`/products/${productId}`, 'DELETE');

        if (result && result.success) {
            showAlert('Product deleted successfully', 'success');
            loadProducts();
        } else {
            showAlert(result?.message || 'Failed to delete product', 'error');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showAlert('Error deleting product', 'error');
    }
}

// Show/hide form fields based on product type
function toggleProductTypeFields() {
    const productType = document.getElementById('product-type')?.value;
    const digitalFields = document.getElementById('digital-fields');
    const physicalFields = document.getElementById('physical-fields');

    if (!digitalFields || !physicalFields) return;

    if (productType === 'digital') {
        digitalFields.style.display = 'block';
        physicalFields.style.display = 'none';
        
        // Clear physical fields
        const stockInput = document.getElementById('product-stock');
        const hasStockCheckbox = document.getElementById('product-has-stock');
        const hasVariantsCheckbox = document.getElementById('product-has-variants');
        
        if (stockInput) stockInput.value = '0';
        if (hasStockCheckbox) hasStockCheckbox.checked = false;
        if (hasVariantsCheckbox) hasVariantsCheckbox.checked = false;
        
        const stockField = document.getElementById('stock-field');
        const variantsSection = document.getElementById('variants-section');
        
        if (stockField) stockField.style.display = 'none';
        if (variantsSection) variantsSection.style.display = 'none';
    } else {
        digitalFields.style.display = 'none';
        physicalFields.style.display = 'block';
        
        // Clear digital fields
        const fileUrlInput = document.getElementById('product-file-url');
        const fileUploadInput = document.getElementById('product-file-upload');
        const recurringCheckbox = document.getElementById('product-recurring');
        const hasTrialCheckbox = document.getElementById('product-has-trial');
        
        if (fileUrlInput) fileUrlInput.value = '';
        if (fileUploadInput) fileUploadInput.value = '';
        if (recurringCheckbox) recurringCheckbox.checked = false;
        if (hasTrialCheckbox) hasTrialCheckbox.checked = false;
        
        const recurringOptions = document.getElementById('recurring-options');
        const trialOptions = document.getElementById('trial-options');
        
        if (recurringOptions) recurringOptions.style.display = 'none';
        if (trialOptions) trialOptions.style.display = 'none';
    }
}

// Toggle edit file method fields (URL or upload)
function toggleEditFileMethodFields() {
    const fileMethod = document.querySelector('input[name="edit-file-method"]:checked')?.value;
    const fileUrlContainer = document.getElementById('edit-file-url-container');
    const fileUploadContainer = document.getElementById('edit-file-upload-container');

    if (!fileUrlContainer || !fileUploadContainer) return;

    if (fileMethod === 'url') {
        fileUrlContainer.style.display = 'block';
        fileUploadContainer.style.display = 'none';
        
        // Clear file upload when URL is selected
        const fileUploadInput = document.getElementById('edit-product-file-upload');
        if (fileUploadInput) fileUploadInput.value = '';
    } else {
        fileUrlContainer.style.display = 'none';
        fileUploadContainer.style.display = 'block';
        
        // Clear URL input when file upload is selected
        const fileUrlInput = document.getElementById('edit-product-file-url');
        if (fileUrlInput) fileUrlInput.value = '';
    }
}

// Toggle physical product stock fields
function toggleStockFields() {
    const hasStock = document.getElementById('product-has-stock')?.checked;
    const stockField = document.getElementById('stock-field');

    if (stockField) {
        stockField.style.display = hasStock ? 'block' : 'none';
    }
}

// Toggle edit physical product stock fields
function toggleEditStockFields() {
    const hasStock = document.getElementById('edit-product-has-stock')?.checked;
    const stockField = document.getElementById('edit-stock-field');

    if (stockField) {
        stockField.style.display = hasStock ? 'block' : 'none';
    }
}

// Toggle variant fields
function toggleVariantFields() {
    const hasVariants = document.getElementById('product-has-variants')?.checked;
    const variantsSection = document.getElementById('variants-section');

    if (variantsSection) {
        variantsSection.style.display = hasVariants ? 'block' : 'none';
    }
}

// Toggle edit variant fields
function toggleEditVariantFields() {
    const hasVariants = document.getElementById('edit-product-has-variants')?.checked;
    const variantsSection = document.getElementById('edit-variants-section');

    if (variantsSection) {
        variantsSection.style.display = hasVariants ? 'block' : 'none';
    }
}

// Add variant row
function addVariantRow(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const variantRow = document.createElement('div');
    variantRow.className = 'variant-row';
    variantRow.innerHTML = `
      <div class="form-group">
        <label>Variant Name</label>
        <input type="text" class="variant-name" placeholder="e.g. Size" required>
      </div>
      <div class="form-group">
        <label>Variant Values (comma-separated)</label>
        <input type="text" class="variant-values" placeholder="e.g. Small,Medium,Large" required>
      </div>
      <div class="form-group">
        <label>Stock</label>
        <input type="number" class="variant-stock" value="0" min="0">
      </div>
      <button type="button" class="remove-variant-btn">Remove</button>
    `;

    container.appendChild(variantRow);

    // Add event listener for remove button
    const removeBtn = variantRow.querySelector('.remove-variant-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', function () {
            variantRow.remove();
        });
    }
}

// Toggle recurring options visibility
function toggleRecurringOptions() {
    const isRecurring = document.getElementById('product-recurring')?.checked;
    const recurringOptions = document.getElementById('recurring-options');

    if (!recurringOptions) return;

    recurringOptions.style.display = isRecurring ? 'block' : 'none';

    // If recurring is disabled, also hide trial options
    if (!isRecurring) {
        const trialOptions = document.getElementById('trial-options');
        if (trialOptions) {
            trialOptions.style.display = 'none';
        }

        const hasTrial = document.getElementById('product-has-trial');
        if (hasTrial) {
            hasTrial.checked = false;
        }
    }
}

// Toggle trial options visibility
function toggleTrialOptions() {
    const hasTrial = document.getElementById('product-has-trial')?.checked;
    const trialOptions = document.getElementById('trial-options');

    if (!trialOptions) return;

    trialOptions.style.display = hasTrial ? 'block' : 'none';
}

// Toggle edit recurring options visibility
function toggleEditRecurringOptions() {
    const isRecurring = document.getElementById('edit-product-recurring')?.checked;
    const recurringOptions = document.getElementById('edit-recurring-options');

    if (!recurringOptions) return;

    recurringOptions.style.display = isRecurring ? 'block' : 'none';

    // If recurring is disabled, also hide trial options
    if (!isRecurring) {
        const trialOptions = document.getElementById('edit-trial-options');
        if (trialOptions) {
            trialOptions.style.display = 'none';
        }

        const hasTrial = document.getElementById('edit-product-has-trial');
        if (hasTrial) {
            hasTrial.checked = false;
        }
    }
}

// Toggle edit trial options visibility
function toggleEditTrialOptions() {
    const hasTrial = document.getElementById('edit-product-has-trial')?.checked;
    const trialOptions = document.getElementById('edit-trial-options');

    if (!trialOptions) return;

    trialOptions.style.display = hasTrial ? 'block' : 'none';
}

// Show/hide edit form fields based on product type
function toggleEditProductTypeFields() {
    const productType = document.getElementById('edit-product-type')?.value;
    const digitalFields = document.getElementById('edit-digital-fields');
    const physicalFields = document.getElementById('edit-physical-fields');

    if (!digitalFields || !physicalFields) return;

    if (productType === 'digital') {
        digitalFields.style.display = 'block';
        physicalFields.style.display = 'none';
        
        // Clear physical fields
        const stockInput = document.getElementById('edit-product-stock');
        const hasStockCheckbox = document.getElementById('edit-product-has-stock');
        const hasVariantsCheckbox = document.getElementById('edit-product-has-variants');
        
        if (stockInput) stockInput.value = '0';
        if (hasStockCheckbox) hasStockCheckbox.checked = false;
        if (hasVariantsCheckbox) hasVariantsCheckbox.checked = false;
        
        const stockField = document.getElementById('edit-stock-field');
        const variantsSection = document.getElementById('edit-variants-section');
        
        if (stockField) stockField.style.display = 'none';
        if (variantsSection) variantsSection.style.display = 'none';
    } else {
        digitalFields.style.display = 'none';
        physicalFields.style.display = 'block';
        
        // Clear digital fields
        const fileUrlInput = document.getElementById('edit-product-file-url');
        const fileUploadInput = document.getElementById('edit-product-file-upload');
        const recurringCheckbox = document.getElementById('edit-product-recurring');
        const hasTrialCheckbox = document.getElementById('edit-product-has-trial');
        
        if (fileUrlInput) fileUrlInput.value = '';
        if (fileUploadInput) fileUploadInput.value = '';
        if (recurringCheckbox) recurringCheckbox.checked = false;
        if (hasTrialCheckbox) hasTrialCheckbox.checked = false;
        
        const recurringOptions = document.getElementById('edit-recurring-options');
        const trialOptions = document.getElementById('edit-trial-options');
        
        if (recurringOptions) recurringOptions.style.display = 'none';
        if (trialOptions) trialOptions.style.display = 'none';
        
        // Reset current file name display if it exists
        const fileNameDisplay = document.getElementById('edit-current-file-name');
        if (fileNameDisplay) {
            fileNameDisplay.textContent = '';
            fileNameDisplay.style.display = 'none';
        }
    }
}

// Open create product modal
function openCreateProductModal() {
    const modal = document.getElementById('create-product-modal');
    if (modal) {
        // Reset form
        const form = document.getElementById('create-product-form');
                if (form) {
                      form.reset();
            
                      // Clear any old recurring state
                      const recurringCheckbox = document.getElementById('product-recurring');
                      if (recurringCheckbox) {
                        recurringCheckbox.checked = false;
                        toggleRecurringOptions();  // hide its options
                      }
                    }

        // Clear image previews
        const previewContainer = document.getElementById('image-previews');
        if (previewContainer) previewContainer.innerHTML = '';
        
        // Reset image counter
        const imageCounter = document.querySelector('.image-counter');
        if (imageCounter) imageCounter.textContent = '0/10 images selected';
        
        // Explicitly reset all checkboxes (since form.reset() may not reset them reliably)
        const recurringCheckbox = document.getElementById('product-recurring');
        const trialCheckbox = document.getElementById('product-has-trial');
        const stockCheckbox = document.getElementById('product-has-stock');
        const variantsCheckbox = document.getElementById('product-has-variants');
        
        if (recurringCheckbox) recurringCheckbox.checked = false;
        if (trialCheckbox) trialCheckbox.checked = false;
        if (stockCheckbox) stockCheckbox.checked = true; // This one starts checked by default
        if (variantsCheckbox) variantsCheckbox.checked = false;

        // Initialize fields visibility
        toggleProductTypeFields();
        toggleFileMethodFields();
        toggleRecurringOptions();
        toggleTrialOptions();
        toggleStockFields();
        toggleVariantFields();
        
        // Reset shipping methods container
        const shippingContainer = document.getElementById('shipping-methods-container');
        if (shippingContainer) {
            shippingContainer.innerHTML = `
            <div class="shipping-method-row">
                <input type="text" class="shipping-method-name" placeholder="Method name (e.g. Standard Shipping)">
                <input type="number" class="shipping-method-price" min="0" step="0.01" placeholder="Price">
                <button type="button" class="remove-shipping-method-btn">×</button>
            </div>
        `;
        
            
            // Add event listener for remove button
            const removeButton = shippingContainer.querySelector('.remove-shipping-method-btn');
            if (removeButton) {
                removeButton.addEventListener('click', function() {
                    this.closest('.shipping-method-row').remove();
                });
            }
        }

        // Show modal
        modal.style.display = 'block';
    }
}

// Close modals
function closeModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Function to update edit image counter
function updateEditImageCounter() {
    const container = document.getElementById('edit-image-previews');
    const counter = document.getElementById('edit-image-counter');
    
    if (container && counter) {
        const existingCount = container.querySelectorAll('.image-preview[data-type="existing"]').length;
        const newCount = container.querySelectorAll('.image-preview[data-type="new"]').length;
        const totalCount = existingCount + newCount;
        
        counter.textContent = `${totalCount}/10 images selected`;
        counter.style.color = totalCount > 8 ? 'orange' : '#666';
    }
}

// Initialize products page
document.addEventListener('DOMContentLoaded', function () {
    // Create sidebar with active menu
    createSidebar('Products');

    // Load products
    loadProducts();

    // Set up image preview handler
    handleImagePreview();
    
    // Set up edit image preview handler
    handleEditImagePreview();

    // Add event listener for create product button
    const createBtn = document.getElementById('create-product-btn-main');
    if (createBtn) {
        createBtn.addEventListener('click', openCreateProductModal);
    }

    // Add event listener for product type select in create form
    const productTypeSelect = document.getElementById('product-type');
    if (productTypeSelect) {
        productTypeSelect.addEventListener('change', toggleProductTypeFields);
    }

    // Add event listeners for file method radios
    const fileMethodRadios = document.querySelectorAll('input[name="file-method"]');
    fileMethodRadios.forEach(radio => {
        radio.addEventListener('change', toggleFileMethodFields);
    });

    // Add event listener for recurring checkbox
    const recurringCheckbox = document.getElementById('product-recurring');
    if (recurringCheckbox) {
        recurringCheckbox.addEventListener('change', toggleRecurringOptions);
    }

    // Add event listener for trial checkbox
    const trialCheckbox = document.getElementById('product-has-trial');
    if (trialCheckbox) {
        trialCheckbox.addEventListener('change', toggleTrialOptions);
    }

    // Add event listener for stock checkbox
    const stockCheckbox = document.getElementById('product-has-stock');
    if (stockCheckbox) {
        stockCheckbox.addEventListener('change', toggleStockFields);
    }

 // Add event listener for variants checkbox
 const variantsCheckbox = document.getElementById('product-has-variants');
 if (variantsCheckbox) {
     variantsCheckbox.addEventListener('change', toggleVariantFields);
 }

 // Add event listener for add variant button
 const addVariantBtn = document.getElementById('add-variant-btn');
 if (addVariantBtn) {
     addVariantBtn.addEventListener('click', function () {
         addVariantRow('variants-container');
     });
 }
 
 // Add event listener for add shipping method button (create form)
 const addShippingMethodBtn = document.getElementById('add-shipping-method-btn');
 if (addShippingMethodBtn) {
     addShippingMethodBtn.addEventListener('click', function() {
         addShippingMethodRow('shipping-methods-container');
     });
 }
 
 // Add event listeners for initial shipping method remove buttons
 const initialShippingMethodRemoveBtns = document.querySelectorAll('#shipping-methods-container .remove-shipping-method-btn');
 initialShippingMethodRemoveBtns.forEach(btn => {
     btn.addEventListener('click', function() {
         this.closest('.shipping-method-row').remove();
     });
 });

 // Add event listener for edit product type select
 const editProductTypeSelect = document.getElementById('edit-product-type');
 if (editProductTypeSelect) {
     editProductTypeSelect.addEventListener('change', toggleEditProductTypeFields);
 }

 // Add event listeners for edit file method radios
 const editFileMethodRadios = document.querySelectorAll('input[name="edit-file-method"]');
 editFileMethodRadios.forEach(radio => {
     radio.addEventListener('change', toggleEditFileMethodFields);
 });

 // Add event listener for edit recurring checkbox
 const editRecurringCheckbox = document.getElementById('edit-product-recurring');
 if (editRecurringCheckbox) {
     editRecurringCheckbox.addEventListener('change', toggleEditRecurringOptions);
 }   

 // Add event listener for edit trial checkbox
 const editTrialCheckbox = document.getElementById('edit-product-has-trial');
 if (editTrialCheckbox) {
     editTrialCheckbox.addEventListener('change', toggleEditTrialOptions);
 }

 // Add event listener for edit stock checkbox
 const editStockCheckbox = document.getElementById('edit-product-has-stock');
 if (editStockCheckbox) {
     editStockCheckbox.addEventListener('change', toggleEditStockFields);
 }

 // Add event listener for edit variants checkbox
 const editVariantsCheckbox = document.getElementById('edit-product-has-variants');
 if (editVariantsCheckbox) {
     editVariantsCheckbox.addEventListener('change', toggleEditVariantFields);
 }

 // Add event listener for edit add variant button
 const editAddVariantBtn = document.getElementById('edit-add-variant-btn');
 if (editAddVariantBtn) {
     editAddVariantBtn.addEventListener('click', function () {
         addVariantRow('edit-variants-container');
     });
 }
 
 // Add event listener for edit add shipping method button
 const editAddShippingMethodBtn = document.getElementById('edit-add-shipping-method-btn');
 if (editAddShippingMethodBtn) {
     editAddShippingMethodBtn.addEventListener('click', function() {
         addShippingMethodRow('edit-shipping-methods-container');
     });
 }

 // Add event listener for create product form
 const createProductForm = document.getElementById('create-product-form');
 if (createProductForm) {
     createProductForm.addEventListener('submit', handleCreateProduct);
 }

 // Add event listener for update product form
 const updateProductForm = document.getElementById('edit-product-form');
 if (updateProductForm) {
     updateProductForm.addEventListener('submit', handleUpdateProduct);
 }

 // Add event listeners for modal close buttons
 const closeButtons = document.querySelectorAll('.close-modal');
 closeButtons.forEach(button => {
     button.addEventListener('click', closeModals);
 });

 // Close modal when clicking outside
 window.addEventListener('click', function (event) {
     const modals = document.querySelectorAll('.modal');
     modals.forEach(modal => {
         if (event.target === modal) {
             modal.style.display = 'none';
         }
     });
 });
});