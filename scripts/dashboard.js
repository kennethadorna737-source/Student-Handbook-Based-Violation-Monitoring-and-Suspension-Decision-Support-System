// Supabase configuration
const SUPABASE_URL = 'https://psoxppumeihdanqrgyzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb3hwcHVtZWloZGFucXJneXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzY4MzMsImV4cCI6MjA4OTU1MjgzM30.mnHWnufKUbo3asRBmnwTnjLU4-SIVtF8QoIBSrJSWuA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

let trendChart, typeChart;
let inactivityTimer;
let realtimeChannel;
let selectedEmail = '';
let selectedUsername = '';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function logoutForSecurity(reason = '') {
    try {
        await supabaseClient.auth.signOut();
    } catch (e) {
        console.warn('Sign out warning:', e);
    }
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
            if (!session) {
                window.location.href = 'login.html';
                return;
            }
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

// Helper: Get points for violation type
function getPoints(type) {
    if (type === 'Minor Offense') return 1;
    if (type === 'Major Offense') return 3;
    if (type === 'Grave Offense') return 6;
    return 0;
}

// Helper: Check if student is eligible for suspension (points >=5)
function isEligible(violations) {
    const totalPoints = violations.reduce((sum, v) => sum + getPoints(v.type), 0);
    return totalPoints >= 5;
}

// Load all students and violations, then update dashboard
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

        // Update summary cards
        document.getElementById('totalStudents').innerText = students.length;
        document.getElementById('totalViolations').innerText = violations.length;
        const studentsWithViol = new Set(violations.map(v => v.student_id)).size;
        document.getElementById('studentsWithViolations').innerText = studentsWithViol;

        // Eligible count
        let eligible = 0;
        for (let student of students) {
            const studentViolations = violations.filter(v => v.student_id === student.id);
            if (isEligible(studentViolations)) eligible++;
        }
        document.getElementById('eligibleCount').innerText = eligible;

        // Update charts
        updateCharts(violations);

        // Store data globally for dropdowns and other functions
        window.appData = { students, violations };
        populateStudentDropdowns(students);
        renderStudentAccounts(students, violations);
        renderUsersTable(students);
    } catch (err) {
        console.error('Error loading dashboard data:', err);
        alert('Failed to load data. Check console.');
    }
}

function initRealtimeSync() {
    if (realtimeChannel) return;
    realtimeChannel = supabaseClient
        .channel('admin-dashboard-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
            loadDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'violations' }, () => {
            loadDashboardData();
        })
        .subscribe();
}

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

    tbody.innerHTML = students.map((s) => {
        const sid = String(s.id ?? '');
        const count = violationCountByStudent.get(sid) || 0;
        const status = count > 0
            ? `<span class="badge bg-danger">Has Violations (${count})</span>`
            : '<span class="badge bg-success">No Violations</span>';

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
        const username = s.username || s.name || 'N/A';
        const email = s.email || 'N/A';
        const hasEmail = typeof s.email === 'string' && s.email.includes('@');
        const emailLink = hasEmail
            ? `<button
                    type="button"
                    class="btn btn-sm btn-outline-primary send-email-btn"
                    data-email="${escapeHtml(s.email)}"
                    data-username="${escapeHtml(username)}"
                    title="Email ${escapeHtml(username)}"
               >
                    <i class="bi bi-envelope"></i> Send Email
               </button>`
            : '<span class="text-muted small">No email</span>';
        return `<tr>
            <td>${escapeHtml(username)}</td>
            <td>${escapeHtml(email)}</td>
            <td>${emailLink}</td>
        </tr>`;
    }).join('');
}

function getTemplateEmailContent(username) {
    return {
        subject: 'PhilTechGMA Notice',
        body: `Hello ${username},\n\nThis is a reminder from PhilTechGMA Admin regarding your student account and handbook compliance.\n\nPlease check your dashboard for details and respond if assistance is needed.\n\nThank you,\nPhilTechGMA Admin`
    };
}

function setComposeFields(mode) {
    const subjectEl = document.getElementById('composeSubject');
    const bodyEl = document.getElementById('composeBody');
    if (!subjectEl || !bodyEl) return;

    if (mode === 'template') {
        const template = getTemplateEmailContent(selectedUsername || 'Student');
        subjectEl.value = template.subject;
        bodyEl.value = template.body;
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
    const modalEl = document.getElementById('composeEmailModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

// Update trend and pie charts
function updateCharts(violations) {
    // Trend: last 6 months
    const months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(monthNames[d.getMonth()]);
    }

    const monthlyCounts = months.map(month => {
        return violations.filter(v => {
            const vDate = new Date(v.date);
            return monthNames[vDate.getMonth()] === month;
        }).length;
    });

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
                    backgroundColor: 'rgba(128,0,0,0.05)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#FFD700',
                    pointBorderColor: '#800000',
                    pointRadius: 5
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }

    // Pie chart
    const types = ['Minor Offense', 'Major Offense', 'Grave Offense'];
    const typeCounts = types.map(t => violations.filter(v => v.type === t).length);
    if (typeChart) {
        typeChart.data.datasets[0].data = typeCounts;
        typeChart.update();
    } else {
        const ctxPie = document.getElementById('typeChart').getContext('2d');
        typeChart = new Chart(ctxPie, {
            type: 'pie',
            data: {
                labels: types,
                datasets: [{
                    data: typeCounts,
                    backgroundColor: ['#FFD700', '#800000', '#b84c4c'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

// Populate all student dropdowns
function populateStudentDropdowns(students) {
    const selects = ['violationStudentId', 'historyStudentId', 'eligibilityStudentId', 'reportStudentId'];
    const options = '<option value="">Select student</option>' +
        students.map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`).join('');
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = options;
    });
}

// Search student
document.getElementById('searchBtn').addEventListener('click', async () => {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const resultDiv = document.getElementById('searchResult');
    if (!query) {
        resultDiv.innerHTML = '<div class="alert alert-warning">Enter ID or name</div>';
        return;
    }
    const { data: students, error } = await supabaseClient
        .from('students')
        .select('*')
        .or(`id.ilike.%${query}%,name.ilike.%${query}%`);
    if (error) {
        resultDiv.innerHTML = '<div class="alert alert-danger">Search failed</div>';
        return;
    }
    if (students.length === 0) {
        resultDiv.innerHTML = '<div class="alert alert-danger">Student not found</div>';
        return;
    }
    const student = students[0];
    const { data: violations } = await supabaseClient.from('violations').select('*').eq('student_id', student.id);
    const violCount = violations ? violations.length : 0;
    const hasViolations = violCount > 0;
    const statusBadge = hasViolations
        ? '<span class="badge bg-danger">Has Violations</span>'
        : '<span class="badge bg-success">No Violations</span>';
    resultDiv.innerHTML = `<div class="alert alert-success">${escapeHtml(student.name)} (${escapeHtml(student.id)})<br>Course: ${escapeHtml(student.course)} Y${escapeHtml(student.year)}<br>Violations: ${violCount} ${statusBadge}</div>`;
});

// Record violation
document.getElementById('violationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('violationStudentId').value;
    const type = document.getElementById('violationType').value;
    const date = document.getElementById('violationDate').value;
    const description = document.getElementById('violationDesc').value;

    if (!studentId || !date || !description) {
        alert('Please fill all fields');
        return;
    }

    const { error } = await supabaseClient.from('violations').insert([{
        student_id: studentId,
        type: type,
        date: date,
        description: description
    }]);

    if (error) {
        alert('Error recording violation: ' + error.message);
        return;
    }

    alert('Violation recorded');
    document.getElementById('violationForm').reset();
    bootstrap.Modal.getInstance(document.getElementById('recordModal')).hide();
    loadDashboardData(); // Refresh all data
});

// Violation history
document.getElementById('historyStudentId').addEventListener('change', async (e) => {
    const sid = e.target.value;
    const container = document.getElementById('historyList');
    if (!sid) {
        container.innerHTML = '';
        return;
    }
    const { data: student } = await supabaseClient.from('students').select('*').eq('id', sid).single();
    const { data: violations } = await supabaseClient.from('violations').select('*').eq('student_id', sid);
    if (!violations || violations.length === 0) {
        container.innerHTML = `<div class="alert alert-secondary">No violations for ${escapeHtml(student.name)}</div>`;
        return;
    }
    let html = `<table class="table table-sm table-bordered"><thead><tr><th>Date</th><th>Type</th><th>Description</th></tr></thead><tbody>`;
    violations.forEach(v => {
        html += `<tr><td>${escapeHtml(v.date)}</td><td>${escapeHtml(v.type)}</td><td>${escapeHtml(v.description)}</td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = `<h6>${escapeHtml(student.name)} (${escapeHtml(student.id)})</h6>${html}`;
});

// Suspension eligibility
document.getElementById('eligibilityStudentId').addEventListener('change', async (e) => {
    const sid = e.target.value;
    const resultDiv = document.getElementById('eligibilityResult');
    if (!sid) {
        resultDiv.innerHTML = '';
        return;
    }
    const { data: student } = await supabaseClient.from('students').select('*').eq('id', sid).single();
    const { data: violations } = await supabaseClient.from('violations').select('*').eq('student_id', sid);
    const totalPoints = violations.reduce((sum, v) => sum + getPoints(v.type), 0);
    const eligible = totalPoints >= 5;
    const minor = violations.filter(v => v.type === 'Minor Offense').length;
    const major = violations.filter(v => v.type === 'Major Offense').length;
    const grave = violations.filter(v => v.type === 'Grave Offense').length;
    let reason = `Points: ${totalPoints} (Minor:${minor}, Major:${major}, Grave:${grave}). `;
    reason += eligible ? 'ELIGIBLE for suspension.' : 'Not eligible.';
    resultDiv.innerHTML = `<strong>${escapeHtml(student.name)}</strong><br>${escapeHtml(reason)}`;
    resultDiv.className = eligible ? 'alert alert-danger' : 'alert alert-success';
});

// Report generation (CSV)
document.getElementById('reportType').addEventListener('change', function() {
    const studentDiv = document.getElementById('reportStudentDiv');
    if (this.value === 'byStudent') studentDiv.classList.remove('d-none');
    else studentDiv.classList.add('d-none');
});

document.getElementById('generateReportBtn').addEventListener('click', async () => {
    const type = document.getElementById('reportType').value;
    let csv = "Student ID,Student Name,Violation Type,Date,Description\n";

    if (type === 'summary') {
        const { data: violations } = await supabaseClient.from('violations').select('*, students(name)');
        for (let v of violations) {
            csv += `${v.student_id},"${v.students?.name || 'Unknown'}",${v.type},${v.date},"${v.description}"\n`;
        }
    } else {
        const sid = document.getElementById('reportStudentId').value;
        if (!sid) { alert('Select a student'); return; }
        const { data: student } = await supabaseClient.from('students').select('*').eq('id', sid).single();
        const { data: violations } = await supabaseClient.from('violations').select('*').eq('student_id', sid);
        for (let v of violations) {
            csv += `${v.student_id},"${student.name}",${v.type},${v.date},"${v.description}"\n`;
        }
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `violation_report_${new Date().toISOString().slice(0,19)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
});

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.send-email-btn');
    if (!btn) return;
    const email = btn.getAttribute('data-email') || '';
    const username = btn.getAttribute('data-username') || 'Student';
    openComposeEmailModal(email, username);
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
    const sendRequest = async (accessToken) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-student-email`, {
        mode: 'cors',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ to: selectedEmail, subject, body })
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (_) {
        payload = {};
      }
      return { response, payload };
    };

    let { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    let accessToken = sessionData?.session?.access_token;
    if (sessionError || !accessToken) {
      throw new Error('No active session token. Please log in again.');
    }

    let { response, payload } = await sendRequest(accessToken);

    // If token is stale, refresh once and retry.
    if (response.status === 401) {
      const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
      if (refreshError || !refreshData?.session?.access_token) {
        throw new Error('Session expired. Please log in again.');
      }
      accessToken = refreshData.session.access_token;
      ({ response, payload } = await sendRequest(accessToken));
    }

    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status} while sending email.`);
    }

    alert(`Email sent successfully to ${selectedEmail}`);
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

// Set default date in modal
document.getElementById('violationDate').value = new Date().toISOString().slice(0,10);

// Check authentication on page load
async function checkAuth() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) {
        window.location.href = 'login.html';
        return;
    }
    if (session.user?.user_metadata?.role === 'student') {
        window.location.href = 'student-dashboard.html';
        return;
    }
    document.getElementById('adminEmail').innerText = session.user.email;
    initSessionGuards();
    initRealtimeSync();
    loadDashboardData();
}

checkAuth();