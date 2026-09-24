// Authentication & Session Management for The super Girls IoT Portal

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('supergirls_jwt_token');
  if (token && window.location.pathname.endsWith('index.html') || token && window.location.pathname === '/') {
    // Verify token validity
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.location.href = 'dashboard.html';
      } else {
        localStorage.removeItem('supergirls_jwt_token');
        localStorage.removeItem('supergirls_user');
      }
    })
    .catch(() => {
      // offline or server restarting
    });
  }
});

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let borderColor = '#4f46e5';
  let iconName = 'check-circle';
  if (type === 'error') {
    borderColor = '#ef4444';
    iconName = 'alert-triangle';
  } else if (type === 'info') {
    borderColor = '#0ea5e9';
    iconName = 'info';
  }

  toast.style.borderLeftColor = borderColor;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-5 h-5 flex-shrink-0" style="color: ${borderColor}"></i>
    <div class="text-sm font-medium text-slate-800">${message}</div>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Switch between Login and Registration tabs
function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginBtn = document.getElementById('tab-login-btn');
  const registerBtn = document.getElementById('tab-register-btn');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginBtn.className = 'flex-1 py-2.5 text-center font-semibold text-sm rounded-xl transition-all duration-200 bg-white text-indigo-600 shadow-sm';
    registerBtn.className = 'flex-1 py-2.5 text-center font-semibold text-sm rounded-xl transition-all duration-200 text-slate-500 hover:text-slate-900';
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    registerBtn.className = 'flex-1 py-2.5 text-center font-semibold text-sm rounded-xl transition-all duration-200 bg-white text-indigo-600 shadow-sm';
    loginBtn.className = 'flex-1 py-2.5 text-center font-semibold text-sm rounded-xl transition-all duration-200 text-slate-500 hover:text-slate-900';
  }
  if (window.lucide) lucide.createIcons();
}

// Handle Login Submission
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('login-submit-btn');

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Signing in...</span>`;

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('supergirls_jwt_token', data.token);
      localStorage.setItem('supergirls_user', JSON.stringify(data.user));
      showToast('Welcome back, ' + data.user.name + '! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
    } else {
      showToast(data.message || 'Login failed. Please check credentials.', 'error');
    }
  } catch (error) {
    showToast('Network error. Unable to reach server.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Sign In to Dashboard</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    if (window.lucide) lucide.createIcons();
  }
}

// Handle Registration Submission
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const submitBtn = document.getElementById('register-submit-btn');

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Creating Account...</span>`;

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('supergirls_jwt_token', data.token);
      localStorage.setItem('supergirls_user', JSON.stringify(data.user));
      showToast('Registration successful! Redirecting to Dashboard...', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
    } else {
      showToast(data.message || 'Registration failed.', 'error');
    }
  } catch (error) {
    showToast('Network error. Unable to reach server.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Create Account</span><i data-lucide="user-plus" class="w-4 h-4"></i>`;
    if (window.lucide) lucide.createIcons();
  }
}
