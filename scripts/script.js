// Supabase configuration - REPLACE WITH YOUR OWN KEYS
const SUPABASE_URL = 'https://psoxppumeihdanqrgyzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb3hwcHVtZWloZGFucXJneXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzY4MzMsImV4cCI6MjA4OTU1MjgzM30.mnHWnufKUbo3asRBmnwTnjLU4-SIVtF8QoIBSrJSWuA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;
const LOGIN_GUARD_KEY = 'admin_login_guard_v1';

function getUserRole(session) {
    return session?.user?.user_metadata?.role || 'admin';
}

function redirectByRole(session) {
    const role = getUserRole(session);
    if (role === 'student') {
        window.location.href = 'student-dashboard.html';
        return;
    }
    window.location.href = 'dashboard.html';
}

function getLoginGuardState() {
    try {
        return JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY)) || { attempts: 0, lockUntil: 0 };
    } catch {
        return { attempts: 0, lockUntil: 0 };
    }
}

function setLoginGuardState(state) {
    localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(state));
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) redirectByRole(session);
    });

    // Password toggle
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('bi-eye');
            this.classList.toggle('bi-eye-slash');
        });
    }

    // Login form handler
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordError = document.getElementById('passwordError');
    const emailError = document.getElementById('emailError');

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

    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    passwordInput.addEventListener('input', () => clearError(passwordInput, passwordError));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const now = Date.now();
        const guard = getLoginGuardState();
        if (guard.lockUntil && now < guard.lockUntil) {
            const minsLeft = Math.ceil((guard.lockUntil - now) / 60000);
            alert(`Too many login attempts. Please wait ${minsLeft} minute(s) before trying again.`);
            return;
        }

        let isValid = true;

        const emailVal = emailInput.value.trim();
        const passVal = passwordInput.value;

        if (!emailVal) {
            showError(emailInput, emailError, 'Admin email address is required');
            isValid = false;
        } else if (!validateEmail(emailVal)) {
            showError(emailInput, emailError, 'Enter a valid email address');
            isValid = false;
        } else {
            clearError(emailInput, emailError);
        }

        if (!passVal) {
            showError(passwordInput, passwordError, 'Password is required');
            isValid = false;
        } else {
            clearError(passwordInput, passwordError);
        }

        if (!isValid) return;

        const btn = form.querySelector('.btn-maroon');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Verifying...';
        btn.disabled = true;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: emailVal,
                password: passVal
            });

            if (error) throw error;

            if (data.session) {
                setLoginGuardState({ attempts: 0, lockUntil: 0 });
                redirectByRole(data.session);
            } else {
                throw new Error('Login failed');
            }
        } catch (err) {
            const current = getLoginGuardState();
            const attempts = (current.attempts || 0) + 1;
            const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;
            setLoginGuardState({
                attempts: shouldLock ? 0 : attempts,
                lockUntil: shouldLock ? Date.now() + LOCKOUT_MINUTES * 60000 : 0
            });

            const demoAlert = document.createElement('div');
            demoAlert.className = 'alert alert-danger mt-3 text-center';
            demoAlert.innerHTML = `<strong>Access denied</strong> — Invalid email or password.<br>Please verify your credentials and try again.`;
            const existingAlert = form.querySelector('.alert-danger');
            if (existingAlert) existingAlert.remove();
            form.insertBefore(demoAlert, form.querySelector('.mb-3'));

            btn.innerHTML = originalText;
            btn.disabled = false;

            setTimeout(() => {
                if (demoAlert && demoAlert.parentNode) demoAlert.remove();
            }, 4000);
        }
    });
});