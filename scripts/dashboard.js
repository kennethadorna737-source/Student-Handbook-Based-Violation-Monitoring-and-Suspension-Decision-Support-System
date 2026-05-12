// Supabase configuration
const SUPABASE_URL = window.location.hostname === 'localhost'
  ? (typeof Deno !== 'undefined' ? 'http://localhost:54321' : 'http://127.0.0.1:54321')
  : 'https://psoxppumeihdanqrgyzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb3hwcHVtZWloZGFucXJneXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzY4MzMsImV4cCI6MjA4OTU1MjgzM30.mnHWnufKUbo3asRBmnwTnjLU4-SIVtF8QoIBSrJSWuA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

let trendChart, typeChart;
let inactivityTimer;
let realtimeChannel;
let selectedEmail = '';
let selectedUsername = '';

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function showSuccessNotification(message) {
    const notifId = 'success-notification-' + Date.now();
    const notifHTML = `
        <div id="${notifId}" class="alert alert-success alert-dismissible fade show position-fixed" role="alert" style="top: 20px; right: 20px; z-index: 9999; min-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <strong>✓ Success!</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', notifHTML);
    
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
        const elem = document.getElementById(notifId);
        if (elem) {
            elem.remove();
        }
    }, 4000);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeViolationType(type) {
    const value = String(type || '').trim().toLowerCase();
    if (value === 'category a' || value === 'minor offense') return 'Category A';
    if (value === 'category b' || value === 'major offense') return 'Category B';
    if (value === 'category c' || value === 'grave offense') return 'Category C';
    return String(type || '').trim();
}

function getPoints(type) {
    const normalizedType = normalizeViolationType(type);
    if (normalizedType === 'Category A') return 1;
    if (normalizedType === 'Category B') return 3;
    if (normalizedType === 'Category C') return 6;
    return 0;
}

function isEligible(violations) {
    return violations.reduce((sum, v) => sum + getPoints(v.type), 0) >= 5;
}

// ── Session Guards ────────────────────────────────────────────────────────────

async function logoutForSecurity(reason = '') {
    try { await supabaseClient.auth.signOut(); } catch (e) { console.warn(e); }
    if (reason) alert(reason);
    window.location.href = 'login.html';
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        logoutForSecurity('Session expired due to inactivity. Please sign in again.');
    }, INACTIVITY_TIMEOUT_MS);
}

function initSessionGuards() {
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach((evt) => {
        document.addEventListener(evt, resetInactivityTimer, { passive: true });
    });
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) { window.location.href = 'login.html'; return; }
            resetInactivityTimer();
        }
    });
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_OUT' || !session) && !window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    });
    resetInactivityTimer();
}

// ── Realtime ──────────────────────────────────────────────────────────────────

function initRealtimeSync() {
    if (realtimeChannel) return;
    realtimeChannel = supabaseClient
        .channel('admin-dashboard-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => loadDashboardData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'violations' }, () => loadDashboardData())
        .subscribe();
}

// ── Dashboard Data ────────────────────────────────────────────────────────────

async function loadDashboardData() {
    try {
        const [studentsRes, violationsRes] = await Promise.all([
            supabaseClient.from('students').select('*'),
            supabaseClient.from('violations').select('*')
        ]);

        if (studentsRes.error) throw studentsRes.error;
        if (violationsRes.error) throw violationsRes.error;

        const students = studentsRes.data;
        const violations = violationsRes.data;

        document.getElementById('totalStudents').innerText = students.length;
        document.getElementById('totalViolations').innerText = violations.length;
        const studentsWithViol = new Set(violations.map(v => v.student_id)).size;
        document.getElementById('studentsWithViolations').innerText = studentsWithViol;

        let eligible = 0;
        for (let student of students) {
            const sv = violations.filter(v => v.student_id === student.id);
            if (isEligible(sv)) eligible++;
        }
        document.getElementById('eligibleCount').innerText = eligible;

        updateCharts(violations);
        window.appData = { students, violations };
        populateStudentDropdowns(students);
        renderStudentAccounts(students, violations);
        renderUsersTable(students);
    } catch (err) {
        console.error('Error loading dashboard data:', err);
    }
}

// ── Render Tables ─────────────────────────────────────────────────────────────

function renderStudentAccounts(students, violations) {
    const tbody = document.getElementById('studentAccountsTableBody');
    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No student accounts found.</td></tr>';
        return;
    }

    const violationCountByStudent = new Map();
    (violations || []).forEach((v) => {
        const sid = String(v.student_id ?? '');
        violationCountByStudent.set(sid, (violationCountByStudent.get(sid) || 0) + 1);
    });

    // Points per student for eligibility
    const pointsByStudent = new Map();
    (violations || []).forEach((v) => {
        const sid = String(v.student_id ?? '');
        pointsByStudent.set(sid, (pointsByStudent.get(sid) || 0) + getPoints(v.type));
    });

    tbody.innerHTML = students.map((s) => {
        const sid = String(s.id ?? '');
        const count = violationCountByStudent.get(sid) || 0;
        const points = pointsByStudent.get(sid) || 0;
        const eligible = points >= 5;

        let status;
        if (count === 0) {
            status = '<span class="badge bg-success">No Violations</span>';
        } else if (eligible) {
            status = `<span class="badge bg-danger">Eligible for Suspension (${count} violations, ${points} pts)</span>`;
        } else {
            status = `<span class="badge bg-warning text-dark">Has Violations (${count}, ${points} pts)</span>`;
        }

        return `<tr>
            <td>${escapeHtml(s.name || 'N/A')}</td>
            <td>${escapeHtml(sid || 'N/A')}</td>
            <td>${escapeHtml(s.course || 'N/A')}</td>
            <td>${escapeHtml(s.year || 'N/A')}</td>
            <td>${status}</td>
        </tr>`;
    }).join('');
}

function renderUsersTable(students) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No students found.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map((s) => {
        const username = s.name || s.username || 'N/A';
        const email = s.email || 'N/A';
        const hasEmail = typeof s.email === 'string' && s.email.includes('@');
        const emailLink = hasEmail
            ? `<button
                    type="button"
                    class="btn btn-sm btn-outline-primary send-email-btn"
                    data-email="${escapeHtml(s.email)}"
                    data-username="${escapeHtml(username)}"
                    title="Email ${escapeHtml(username)}"
               ><i class="bi bi-envelope"></i> Send Email</button>`
            : '<span class="text-muted small">No email</span>';
        return `<tr>
            <td>${escapeHtml(username)}</td>
            <td>${escapeHtml(email)}</td>
            <td>${emailLink}</td>
        </tr>`;
    }).join('');
}

// ── Charts ────────────────────────────────────────────────────────────────────

function updateCharts(violations) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const today = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(monthNames[d.getMonth()]);
    }
    const monthlyCounts = months.map(month =>
        violations.filter(v => monthNames[new Date(v.date).getMonth()] === month).length
    );

    if (trendChart) {
        trendChart.data.datasets[0].data = monthlyCounts;
        trendChart.update();
    } else {
        const ctxTrend = document.getElementById('trendChart').getContext('2d');
        trendChart = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Violations',
                    data: monthlyCounts,
                    borderColor: '#800000',
                    backgroundColor: 'rgba(128,0,0,0.06)',
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: '#FFD700',
                    pointBorderColor: '#800000',
                    pointRadius: 5
                }]
            },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
        });
    }

    const types = ['Category A', 'Category B', 'Category C'];
    const typeCounts = types.map(t => violations.filter(v => normalizeViolationType(v.type) === t).length);
    if (typeChart) {
        typeChart.data.datasets[0].data = typeCounts;
        typeChart.update();
    } else {
        const ctxPie = document.getElementById('typeChart').getContext('2d');
        typeChart = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: types,
                datasets: [{
                    data: typeCounts,
                    backgroundColor: ['#FFD700', '#ea580c', '#800000'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

// ── Dropdowns ─────────────────────────────────────────────────────────────────

function populateStudentDropdowns(students) {
    const selects = ['violationStudentId', 'historyStudentId', 'eligibilityStudentId', 'reportStudentId'];
    const options = '<option value="">Select student</option>' +
        students.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.id)})</option>`).join('');
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = options;
    });
}

// ── Search ────────────────────────────────────────────────────────────────────

document.getElementById('searchBtn').addEventListener('click', async () => {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const resultDiv = document.getElementById('searchResult');
    if (!query) {
        resultDiv.innerHTML = '<div class="alert alert-warning py-2">Enter a student ID or name.</div>';
        return;
    }
    const { data: students, error } = await supabaseClient
        .from('students')
        .select('*')
        .or(`id.ilike.%${query}%,name.ilike.%${query}%`);

    if (error || !students || students.length === 0) {
        resultDiv.innerHTML = '<div class="alert alert-danger py-2">Student not found.</div>';
        return;
    }

    const student = students[0];
    const { data: violations } = await supabaseClient.from('violations').select('*').eq('student_id', student.id);
    const points = (violations || []).reduce((s, v) => s + getPoints(v.type), 0);
    const eligible = points >= 5;
    const statusBadge = eligible
        ? '<span class="badge bg-danger">Eligible for Suspension</span>'
        : violations?.length > 0
            ? '<span class="badge bg-warning text-dark">Has Violations</span>'
            : '<span class="badge bg-success">No Violations</span>';

    resultDiv.innerHTML = `
        <div class="alert alert-success py-2 mb-0">
            <strong>${escapeHtml(student.name)}</strong> (${escapeHtml(String(student.id))})<br>
            ${escapeHtml(student.course)} · Year ${escapeHtml(String(student.year))}<br>
            Violations: ${violations?.length || 0} &nbsp;|&nbsp; Points: ${points} &nbsp;${statusBadge}
        </div>`;
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

// ── Record Violation ──────────────────────────────────────────────────────────

document.getElementById('violationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('violationStudentId').value;
    const type = document.getElementById('violationType').value;
    const date = document.getElementById('violationDate').value;
    const description = document.getElementById('violationDesc').value.trim();

    if (!studentId || !date || !description) {
        alert('Please fill all fields.');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';

    const { error } = await supabaseClient.from('violations').insert([{
        student_id: studentId,
        type,
        date,
        description
    }]);

    btn.disabled = false;
    btn.innerHTML = orig;

    if (error) {
        alert('Error recording violation: ' + error.message);
        return;
    }

    alert('Violation recorded successfully.');
    document.getElementById('violationForm').reset();
    document.getElementById('violationDate').value = new Date().toISOString().slice(0, 10);
    bootstrap.Modal.getInstance(document.getElementById('recordModal')).hide();
    loadDashboardData();
});

// ── Violation History ─────────────────────────────────────────────────────────

document.getElementById('historyStudentId').addEventListener('change', async (e) => {
    const sid = e.target.value;
    const container = document.getElementById('historyList');
    if (!sid) { container.innerHTML = ''; return; }

    const { data: student } = await supabaseClient.from('students').select('*').eq('id', sid).single();
    const { data: violations } = await supabaseClient.from('violations').select('*').eq('student_id', sid).order('date', { ascending: false });

    if (!violations || violations.length === 0) {
        container.innerHTML = `<div class="alert alert-secondary">No violations recorded for <strong>${escapeHtml(student?.name || sid)}</strong>.</div>`;
        return;
    }

    const totalPoints = violations.reduce((s, v) => s + getPoints(v.type), 0);
    let html = `
        <p class="mb-2"><strong>${escapeHtml(student?.name || sid)}</strong> &nbsp;·&nbsp; Total: ${violations.length} violation(s), <strong>${totalPoints} pts</strong></p>
        <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
            <thead><tr><th>Date</th><th>Type</th><th>Pts</th><th>Description</th></tr></thead>
            <tbody>`;

    violations.forEach(v => {
        const normalizedType = normalizeViolationType(v.type);
        const pts = getPoints(normalizedType);
        const typeColor = normalizedType === 'Category A' ? '#d97706' : normalizedType === 'Category B' ? '#ea580c' : '#dc2626';
        html += `<tr>
            <td>${escapeHtml(v.date)}</td>
            <td><span class="badge" style="background:${typeColor};">${escapeHtml(normalizedType || v.type)}</span></td>
            <td><strong style="color:${typeColor};">+${pts}</strong></td>
            <td>${escapeHtml(v.description)}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
});

// ── Suspension Eligibility ────────────────────────────────────────────────────

document.getElementById('eligibilityStudentId').addEventListener('change', async (e) => {
    const sid = e.target.value;
    const resultDiv = document.getElementById('eligibilityResult');
    if (!sid) { resultDiv.innerHTML = ''; return; }

    const { data: student } = await supabaseClient.from('students').select('*').eq('id', sid).single();
    const { data: violations } = await supabaseClient.from('violations').select('*').eq('student_id', sid);
    const totalPoints = (violations || []).reduce((s, v) => s + getPoints(v.type), 0);
    const eligible = totalPoints >= 5;

    const categoryA = (violations || []).filter(v => normalizeViolationType(v.type) === 'Category A').length;
    const categoryB = (violations || []).filter(v => normalizeViolationType(v.type) === 'Category B').length;
    const categoryC = (violations || []).filter(v => normalizeViolationType(v.type) === 'Category C').length;

    resultDiv.innerHTML = `
        <strong>${escapeHtml(student?.name || sid)}</strong><br>
        Points: <strong>${totalPoints}</strong> &nbsp;(Category A: ${categoryA}, Category B: ${categoryB}, Category C: ${categoryC})<br>
        <strong>${eligible ? '⚠ ELIGIBLE for suspension.' : '✓ Not eligible for suspension.'}</strong>`;
    resultDiv.className = `alert ${eligible ? 'alert-danger' : 'alert-success'}`;
});

// ── Report Generation ─────────────────────────────────────────────────────────

document.getElementById('reportType').addEventListener('change', function () {
    document.getElementById('reportStudentDiv').classList.toggle('d-none', this.value !== 'byStudent');
});

document.getElementById('generateReportBtn').addEventListener('click', async () => {
    const type = document.getElementById('reportType').value;
    let csv = 'Student ID,Student Name,Course,Year,Violation Type,Points,Date,Description\n';

    if (type === 'summary') {
        const { data: violations } = await supabaseClient.from('violations').select('*, students(name, course, year)');
        for (let v of (violations || [])) {
            const pts = getPoints(v.type);
            csv += `${v.student_id},"${v.students?.name || 'Unknown'}","${v.students?.course || ''}","${v.students?.year || ''}",${v.type},${pts},${v.date},"${v.description?.replace(/"/g, '""')}"\n`;
        }
    } else {
        const sid = document.getElementById('reportStudentId').value;
        if (!sid) { alert('Please select a student.'); return; }
        const { data: student } = await supabaseClient.from('students').select('*').eq('id', sid).single();
        const { data: violations } = await supabaseClient.from('violations').select('*').eq('student_id', sid);
        for (let v of (violations || [])) {
            const pts = getPoints(v.type);
            csv += `${v.student_id},"${student?.name || 'Unknown'}","${student?.course || ''}","${student?.year || ''}",${v.type},${pts},${v.date},"${v.description?.replace(/"/g, '""')}"\n`;
        }
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `philtechgma_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
});

// ── Email Compose ─────────────────────────────────────────────────────────────

function getTemplateEmailContent(username) {
    return {
        subject: 'PhilTechGMA – Official Student Notice',
        body: `Dear ${username},\n\nThis is an official communication from the PhilTechGMA Administration regarding your student record and compliance with the Student Handbook.\n\nPlease log in to your Student Dashboard to review your violation history and current suspension eligibility status.\n\nIf you have questions or concerns, please visit the Office of Student Affairs.\n\nThank you for your attention to this matter.\n\nRespectfully,\nPhilTechGMA Administration\nCollege of Computer Studies`
    };
}

function setComposeFields(mode) {
    const subjectEl = document.getElementById('composeSubject');
    const bodyEl = document.getElementById('composeBody');
    if (!subjectEl || !bodyEl) return;

    if (mode === 'template') {
        const tpl = getTemplateEmailContent(selectedUsername || 'Student');
        subjectEl.value = tpl.subject;
        bodyEl.value = tpl.body;
    } else {
        subjectEl.value = '';
        bodyEl.value = '';
    }
}

function openComposeEmailModal(email, username) {
    selectedEmail = email;
    selectedUsername = username || 'Student';
    const recipientEl = document.getElementById('composeRecipient');
    const templateRadio = document.getElementById('messageTypeTemplate');
    if (recipientEl) recipientEl.value = selectedEmail;
    if (templateRadio) templateRadio.checked = true;
    setComposeFields('template');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('composeEmailModal')).show();
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.send-email-btn');
    if (!btn) return;
    openComposeEmailModal(
        btn.getAttribute('data-email') || '',
        btn.getAttribute('data-username') || 'Student'
    );
});

document.getElementById('messageTypeTemplate')?.addEventListener('change', (e) => {
    if (e.target.checked) setComposeFields('template');
});

document.getElementById('messageTypeCustom')?.addEventListener('change', (e) => {
    if (e.target.checked) setComposeFields('custom');
});

document.getElementById('sendEmailNowBtn')?.addEventListener('click', async () => {
  if (!selectedEmail) {
    alert('No recipient email selected.');
    return;
  }
  const subject = document.getElementById('composeSubject')?.value?.trim() || '';
  const body = document.getElementById('composeBody')?.value?.trim() || '';
  if (!subject || !body) {
    alert('Please provide both subject and message.');
    return;
  }
 
  const sendBtn = document.getElementById('sendEmailNowBtn');
  const originalText = sendBtn?.innerHTML || '';
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';
  }
 
  try {
    // Always get a fresh session first
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
 
    if (sessionError || !sessionData?.session) {
      throw new Error('No active session. Please log in again.');
    }
 
    let accessToken = sessionData.session.access_token;
 
    // Helper to call the edge function
    const sendRequest = async (token) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-student-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ to: selectedEmail, subject, body }),
      });
 
      let payload = {};
      try { payload = await response.json(); } catch (_) {}
      return { response, payload };
    };
 
    let { response, payload } = await sendRequest(accessToken);
 
    // If token is stale (401), refresh once and retry
    if (response.status === 401) {
      const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
      if (refreshError || !refreshData?.session?.access_token) {
        throw new Error('Session expired. Please log in again.');
      }
      accessToken = refreshData.session.access_token;
      ({ response, payload } = await sendRequest(accessToken));
    }
 
    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}: ${JSON.stringify(payload)}`);
    }
 
    alert(`✅ Email sent successfully to ${selectedEmail}`);
    const modalEl = document.getElementById('composeEmailModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
 
  } catch (err) {
    console.error('Email send error:', err);
    alert(`Email sending failed: ${err.message}`);
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalText;
    }
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
});

// ── Auth Check ────────────────────────────────────────────────────────────────

async function checkAuth() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) { window.location.href = 'login.html'; return; }

    if (session.user?.user_metadata?.role === 'student') {
        window.location.href = 'student-dashboard.html';
        return;
    }

    document.getElementById('adminEmail').innerText = session.user.email;
    document.getElementById('violationDate').value = new Date().toISOString().slice(0, 10);

    initSessionGuards();
    initRealtimeSync();
    loadDashboardData();
}

checkAuth();