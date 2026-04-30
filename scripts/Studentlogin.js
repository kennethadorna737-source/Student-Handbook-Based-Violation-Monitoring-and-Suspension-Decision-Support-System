const SUPABASE_URL = 'https://psoxppumeihdanqrgyzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb3hwcHVtZWloZGFucXJneXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzY4MzMsImV4cCI6MjA4OTU1MjgzM30.mnHWnufKUbo3asRBmnwTnjLU4-SIVtF8QoIBSrJSWuA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;
const LOGIN_GUARD_KEY = 'student_login_guard_v1';

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

document.addEventListener('DOMContentLoaded', function () {
    // Redirect if already logged in as student
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            const role = session.user?.user_metadata?.role;
            if (role === 'student') {
                window.location.href = 'student-dashboard.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }
    });

    // Password toggle
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('bi-eye');
            this.classList.toggle('bi-eye-slash');
        });
    }

    const form = document.getElementById('studentLoginForm');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');

    function validateEmail(email) {
        return /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(String(email).toLowerCase());
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

        const emailVal = emailInput.value.trim();
        const passVal = passwordInput.value;
        let isValid = true;

        if (!emailVal) {
            showError(emailInput, emailError, 'Email address is required');
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

        const btn = document.getElementById('loginBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Signing in...';
        btn.disabled = true;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: emailVal,
                password: passVal,
            });

            if (error) throw error;

            if (data.session) {
                const role = data.session.user?.user_metadata?.role;
                setLoginGuardState({ attempts: 0, lockUntil: 0 });

                if (role !== 'student') {
                    // Admin logged in via student portal — redirect to admin
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'student-dashboard.html';
                }
            } else {
                throw new Error('Login failed. No session returned.');
            }
        } catch (err) {
            const current = getLoginGuardState();
            const attempts = (current.attempts || 0) + 1;
            const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;
            setLoginGuardState({
                attempts: shouldLock ? 0 : attempts,
                lockUntil: shouldLock ? Date.now() + LOCKOUT_MINUTES * 60000 : 0,
            });

            const existingAlert = form.querySelector('.alert-danger');
            if (existingAlert) existingAlert.remove();

            const alertEl = document.createElement('div');
            alertEl.className = 'alert alert-danger mt-3 text-center';
            alertEl.innerHTML = `<strong>Login failed</strong> — Invalid email or password.<br>Please check your credentials and try again.`;
            form.insertBefore(alertEl, form.querySelector('.mb-4'));

            btn.innerHTML = originalText;
            btn.disabled = false;

            setTimeout(() => {
                if (alertEl && alertEl.parentNode) alertEl.remove();
            }, 4000);
        }
    });
});