const SUPABASE_URL = 'https://psoxppumeihdanqrgyzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb3hwcHVtZWloZGFucXJneXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzY4MzMsImV4cCI6MjA4OTU1MjgzM30.mnHWnufKUbo3asRBmnwTnjLU4-SIVtF8QoIBSrJSWuA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');
const totalViolationsEl = document.getElementById('totalViolations');
const totalPointsEl = document.getElementById('totalPoints');
const eligibilityBadgeEl = document.getElementById('eligibilityBadge');
const violationsTableBody = document.getElementById('violationsTableBody');
const logoutBtn = document.getElementById('logoutBtn');

function getPoints(type) {
    if (type === 'Minor Offense') return 1;
    if (type === 'Major Offense') return 3;
    if (type === 'Grave Offense') return 6;
    return 0;
}

function renderViolations(violations) {
    if (!violations || violations.length === 0) {
        violationsTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No violations found.</td></tr>';
        return;
    }

    violationsTableBody.innerHTML = violations
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map((v) => `
            <tr>
                <td>${v.date || ''}</td>
                <td>${v.type || ''}</td>
                <td>${v.description || ''}</td>
            </tr>
        `)
        .join('');
}

async function loadStudentData() {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    const session = sessionData?.session;
    if (sessionError || !session) {
        window.location.href = 'login.html';
        return;
    }
    if (session.user?.user_metadata?.role !== 'student') {
        window.location.href = 'dashboard.html';
        return;
    }

    const user = session.user;
    studentEmailEl.textContent = user.email || '-';
    studentNameEl.textContent = user.user_metadata?.username || 'Student';

    const userId = user.id;
    const { data: studentRow } = await supabaseClient
        .from('students')
        .select('name')
        .eq('id', userId)
        .single();

    if (studentRow?.name) {
        studentNameEl.textContent = studentRow.name;
    }

    const { data: violations, error: violationsError } = await supabaseClient
        .from('violations')
        .select('*')
        .eq('student_id', userId);

    if (violationsError) {
        violationsTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Failed to load violations.</td></tr>';
        return;
    }

    const totalViolations = violations.length;
    const totalPoints = violations.reduce((sum, v) => sum + getPoints(v.type), 0);
    const eligible = totalPoints >= 5;

    totalViolationsEl.textContent = String(totalViolations);
    totalPointsEl.textContent = String(totalPoints);
    eligibilityBadgeEl.className = `badge rounded-pill ${eligible ? 'text-bg-danger' : 'text-bg-success'}`;
    eligibilityBadgeEl.textContent = eligible ? 'Eligible for Suspension' : 'Not Eligible for Suspension';

    renderViolations(violations);
}

logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_OUT' || !session) && !window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
        return;
    }
    if (session && session.user?.user_metadata?.role !== 'student') {
        window.location.href = 'dashboard.html';
    }
});

loadStudentData();
