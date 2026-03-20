// script.js - Password toggle and admin login validation
document.addEventListener('DOMContentLoaded', function() {
    // ---------- PASSWORD SHOW/HIDE TOGGLE ----------
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            // Toggle the type attribute
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Toggle the eye icon
            this.classList.toggle('bi-eye');
            this.classList.toggle('bi-eye-slash');
        });
    }

    // ---------- FORM VALIDATION & DEMO CREDENTIALS ----------
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');

    // Helper: validate email format
    function validateEmail(email) {
        const re = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    function showError(input, errorElement, message) {
        input.classList.add('is-invalid');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    function clearError(input, errorElement) {
        input.classList.remove('is-invalid');
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }

    // Real-time clear errors on input
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    passwordInput.addEventListener('input', () => clearError(passwordInput, passwordError));

    // Form submit handler
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        let isValid = true;

        // Email validation
        const emailVal = emailInput.value.trim();
        if (!emailVal) {
            showError(emailInput, emailError, 'Admin email address is required');
            isValid = false;
        } else if (!validateEmail(emailVal)) {
            showError(emailInput, emailError, 'Enter a valid email address (e.g., admin@domain.com)');
            isValid = false;
        } else {
            clearError(emailInput, emailError);
        }

        // Password validation
        const passVal = passwordInput.value;
        if (!passVal) {
            showError(passwordInput, passwordError, 'Password is required for administrator access');
            isValid = false;
        } else if (passVal.length < 4) {
            showError(passwordInput, passwordError, 'Password must be at least 4 characters');
            isValid = false;
        } else {
            clearError(passwordInput, passwordError);
        }

        if (isValid) {
            // Show loading state on button
            const btn = form.querySelector('.btn-maroon');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Verifying...';
            btn.disabled = true;

            // Simulate authentication (replace with real backend call)
            setTimeout(() => {
                // Demo credentials: admin@philtechgma.edu.ph / admin123
                if (emailVal === 'admin@philtechgma.edu.ph' && passVal === 'admin123') {
                    // Successful login – redirect to dashboard (change as needed)
                    window.location.href = 'dashboard.html';
                } else {
                    // Show error message
                    const demoAlert = document.createElement('div');
                    demoAlert.className = 'alert alert-danger mt-3 text-center';
                    demoAlert.innerHTML = '<strong>Access denied</strong> — Invalid admin credentials.<br>Demo: admin@philtechgma.edu.ph / admin123';
                    const existingAlert = form.querySelector('.alert-danger');
                    if (existingAlert) existingAlert.remove();
                    form.insertBefore(demoAlert, form.querySelector('.mb-3'));

                    // Reset button
                    btn.innerHTML = originalText;
                    btn.disabled = false;

                    // Auto-remove alert after 4 seconds
                    setTimeout(() => {
                        if (demoAlert && demoAlert.parentNode) demoAlert.remove();
                    }, 4000);
                }
            }, 800);
        }
    });
});