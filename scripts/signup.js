const SUPABASE_URL = 'https://psoxppumeihdanqrgyzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb3hwcHVtZWloZGFucXJneXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzY4MzMsImV4cCI6MjA4OTU1MjgzM30.mnHWnufKUbo3asRBmnwTnjLU4-SIVtF8QoIBSrJSWuA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let pendingEmail = '';
let pendingUserData = null;

const signupForm = document.getElementById('signupForm');
const otpForm = document.getElementById('otpForm');
const createAccountBtn = document.getElementById('createAccountBtn');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const resendOtpBtn = document.getElementById('resendOtpBtn');

function setupPasswordToggle(toggleId, inputId) {
    const toggle = document.getElementById(toggleId);
    const input = document.getElementById(inputId);
    if (toggle && input) {
        toggle.addEventListener('click', function () {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.classList.toggle('bi-eye');
            this.classList.toggle('bi-eye-slash');
        });
    }
}
setupPasswordToggle('togglePassword', 'password');
setupPasswordToggle('toggleConfirmPassword', 'confirmPassword');

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const course = document.getElementById('course').value.trim();
    const year = parseInt(document.getElementById('year').value, 10);
    const gender = document.getElementById('gender').value;

    if (!username || !email || !password || !confirmPassword || !course || !year || !gender) {
        alert('Please fill in all fields.');
        return;
    }
    if (password !== confirmPassword) {
        alert('Passwords do not match.');
        return;
    }
    if (password.length < 8) {
        alert('Password must be at least 8 characters.');
        return;
    }
    if (isNaN(year) || year < 1 || year > 5) {
        alert('Year level must be between 1 and 5.');
        return;
    }

    createAccountBtn.disabled = true;
    const originalText = createAccountBtn.innerHTML;
    createAccountBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';

    try {
        // Password hashing is done by Supabase Auth on the server — do not hash in the browser.
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    course,
                    year,
                    gender,
                    role: 'student'
                }
            }
        });
        if (error) throw error;

        pendingEmail = email;
        pendingUserData = { username, email, course, year, gender };

        signupForm.classList.add('d-none');
        otpForm.classList.remove('d-none');

        alert('Account created. Check your email for the OTP code, then verify below.');
    } catch (err) {
        alert(`Sign up failed: ${err.message}`);
    } finally {
        createAccountBtn.disabled = false;
        createAccountBtn.innerHTML = originalText;
    }
});

otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('otpCode').value.trim();
    if (!pendingEmail || !token) {
        alert('Missing email or OTP code.');
        return;
    }
    if (!/^\d{8}$/.test(token)) {
        alert('OTP must be exactly 8 digits.');
        return;
    }

    verifyOtpBtn.disabled = true;
    const originalText = verifyOtpBtn.innerHTML;
    verifyOtpBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

    try {
        const { error } = await supabaseClient.auth.verifyOtp({
            email: pendingEmail,
            token: token,
            type: 'signup'
        });
        if (error) throw error;

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) throw new Error('Could not retrieve user after verification.');

        const { error: insertError } = await supabaseClient
            .from('students')
            .upsert([{
                id: user.id,
                name: pendingUserData.username,
                email: pendingUserData.email,
                course: pendingUserData.course,
                year: pendingUserData.year,
                gender: pendingUserData.gender
            }], { onConflict: 'id' });

        if (insertError) {
            console.error('Student insert error:', insertError);
            alert('Account verified but failed to save student details. Please contact admin.');
            return;
        }

        alert('OTP verified! Your student account is now active.');
        window.location.href = 'login.html';
    } catch (err) {
        alert(`OTP verification failed: ${err.message}`);
    } finally {
        verifyOtpBtn.disabled = false;
        verifyOtpBtn.innerHTML = originalText;
    }
});

resendOtpBtn.addEventListener('click', async () => {
    if (!pendingEmail) {
        alert('Please sign up first.');
        return;
    }
    resendOtpBtn.disabled = true;
    try {
        const { error } = await supabaseClient.auth.resend({
            type: 'signup',
            email: pendingEmail
        });
        if (error) throw error;
        alert('OTP resent. Please check your email.');
    } catch (err) {
        alert(`Could not resend OTP: ${err.message}`);
    } finally {
        resendOtpBtn.disabled = false;
    }
});