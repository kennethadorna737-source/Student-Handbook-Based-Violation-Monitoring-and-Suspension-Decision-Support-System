const SUPABASE_URL = 'https://psoxppumeihdanqrgyzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb3hwcHVtZWloZGFucXJneXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzY4MzMsImV4cCI6MjA4OTU1MjgzM30.mnHWnufKUbo3asRBmnwTnjLU4-SIVtF8QoIBSrJSWuA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

let inactivityTimer;
let realtimeChannel;
let currentStudentId = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPoints(type) {
    if (type === 'Category A') return 1;
    if (type === 'Category B') return 3;
    if (type === 'Category C') return 6;
    return 0;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-PH', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

// ── Session Guards ────────────────────────────────────────────────────────────

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        supabaseClient.auth.signOut().finally(() => {
            alert('Session expired due to inactivity. Please sign in again.');
            window.location.href = 'student-login.html';
        });
    }, INACTIVITY_TIMEOUT_MS);
}

function initSessionGuards() {
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach((evt) => {
        document.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                window.location.href = 'student-login.html';
                return;
            }
            resetInactivityTimer();
        }
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            window.location.href = 'student-login.html';
        }
    });

    resetInactivityTimer();
}

// ── Realtime Sync ─────────────────────────────────────────────────────────────

function initRealtimeSync() {
    if (realtimeChannel || !currentStudentId) return;

    realtimeChannel = supabaseClient
        .channel('student-dashboard-sync')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'violations',
            filter: `student_id=eq.${currentStudentId}`
        }, () => {
            loadViolations(currentStudentId);
        })
        .subscribe();
}

// ── UI Renderers ──────────────────────────────────────────────────────────────

function renderViolations(violations) {
    const tbody = document.getElementById('violationsTableBody');
    if (!tbody) return;

    if (!violations || violations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4">
                    <i class="bi bi-check-circle text-success" style="font-size:2rem;"></i>
                    <p class="text-muted mt-2 mb-0">No violations recorded. Keep it up!</p>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = violations
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map((v) => {
            const points = getPoints(v.type);
            const badgeClass = v.type === 'Category A'
                ? 'bg-warning text-dark'
                : v.type === 'Category B'
                    ? 'bg-orange text-white'
                    : 'bg-danger text-white';
            const typeColor = v.type === 'Category B'
                ? '#d97706'
                : v.type === 'Category C'
                    ? '#ea580c'
                    : '#dc2626';
            return `
            <tr>
                <td>${formatDate(v.date)}</td>
                <td>
                    <span class="badge rounded-pill" style="background:${typeColor};">${escapeHtml(v.type)}</span>
                </td>
                <td>${escapeHtml(v.description)}</td>
                <td class="text-center fw-bold" style="color:${typeColor};">+${points}</td>
            </tr>`;
        })
        .join('');
}

function updateSummary(violations) {
    const totalViolationsEl = document.getElementById('totalViolations');
    const totalPointsEl = document.getElementById('totalPoints');
    const eligibilityBadgeEl = document.getElementById('eligibilityBadge');
    const progressBarEl = document.getElementById('suspensionProgress');
    const progressLabelEl = document.getElementById('progressLabel');

    const totalViolations = violations.length;
    const totalPoints = violations.reduce((sum, v) => sum + getPoints(v.type), 0);
    const eligible = totalPoints >= 5;

    if (totalViolationsEl) totalViolationsEl.textContent = String(totalViolations);
    if (totalPointsEl) totalPointsEl.textContent = String(totalPoints);

    if (eligibilityBadgeEl) {
        eligibilityBadgeEl.className = `badge rounded-pill ${eligible ? 'text-bg-danger' : 'text-bg-success'}`;
        eligibilityBadgeEl.textContent = eligible ? '⚠ Eligible for Suspension' : '✓ Not Eligible for Suspension';
    }

    // Progress bar toward suspension threshold (5 points)
    if (progressBarEl) {
        const pct = Math.min((totalPoints / 5) * 100, 100);
        progressBarEl.style.width = `${pct}%`;
        progressBarEl.style.background = eligible ? '#dc2626' : totalPoints >= 3 ? '#ea580c' : '#22c55e';
        progressBarEl.setAttribute('aria-valuenow', pct);
    }

    if (progressLabelEl) {
        progressLabelEl.textContent = eligible
            ? `${totalPoints} pts — Suspension threshold reached!`
            : `${totalPoints} / 5 pts toward suspension threshold`;
    }
}

// ── Data Loading ──────────────────────────────────────────────────────────────

async function loadViolations(studentId) {
    const { data: violations, error } = await supabaseClient
        .from('violations')
        .select('*')
        .eq('student_id', studentId);

    if (error) {
        const tbody = document.getElementById('violationsTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load violations. Please refresh.</td></tr>';
        return;
    }

    updateSummary(violations || []);
    renderViolations(violations || []);
}

async function loadStudentData() {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    const session = sessionData?.session;

    if (sessionError || !session) {
        window.location.href = 'student-login.html';
        return;
    }

    // Only students allowed here
    if (session.user?.user_metadata?.role !== 'student') {
        window.location.href = 'dashboard.html';
        return;
    }

    const user = session.user;
    currentStudentId = user.id;

    // Set email
    const studentEmailEl = document.getElementById('studentEmail');
    if (studentEmailEl) studentEmailEl.textContent = user.email || '—';

    // Set current date
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('en-PH', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Load student record from DB
    const { data: studentRow } = await supabaseClient
        .from('students')
        .select('name, course, year, gender')
        .eq('id', currentStudentId)
        .single();

    const studentNameEl = document.getElementById('studentName');
    const studentCourseEl = document.getElementById('studentCourse');
    const studentYearEl = document.getElementById('studentYear');

    if (studentRow) {
        if (studentNameEl) studentNameEl.textContent = studentRow.name || user.user_metadata?.username || 'Student';
        if (studentCourseEl) studentCourseEl.textContent = studentRow.course || '—';
        if (studentYearEl) studentYearEl.textContent = studentRow.year ? `Year ${studentRow.year}` : '—';
    } else {
        if (studentNameEl) studentNameEl.textContent = user.user_metadata?.username || 'Student';
    }

    await loadViolations(currentStudentId);

    initSessionGuards();
    initRealtimeSync();
}

// ── Logout ────────────────────────────────────────────────────────────────────

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (realtimeChannel) {
        await supabaseClient.removeChannel(realtimeChannel);
    }
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadStudentData();