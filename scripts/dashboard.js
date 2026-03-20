// dashboard.js - Professional Analytics Dashboard

// ----- MOCK DATA -----
let students = [
    { id: "S001", name: "Juan Dela Cruz", course: "BSIT", year: 3 },
    { id: "S002", name: "Maria Santos", course: "BSCS", year: 2 },
    { id: "S003", name: "Pedro Reyes", course: "BSIS", year: 4 },
    { id: "S004", name: "Ana Lopez", course: "BSIT", year: 1 },
    { id: "S005", name: "Carlos Mendoza", course: "BSCS", year: 3 }
];

let violations = [
    { id: 1, studentId: "S001", type: "Minor Offense", date: "2025-01-15", description: "Late submission" },
    { id: 2, studentId: "S001", type: "Major Offense", date: "2025-02-10", description: "Unauthorized absence" },
    { id: 3, studentId: "S002", type: "Minor Offense", date: "2025-01-28", description: "Disruptive behavior" },
    { id: 4, studentId: "S003", type: "Grave Offense", date: "2025-03-05", description: "Cheating" },
    { id: 5, studentId: "S002", type: "Minor Offense", date: "2025-02-20", description: "Littering" },
    { id: 6, studentId: "S005", type: "Major Offense", date: "2025-03-12", description: "Vaping on campus" }
];

// Helper functions
function getStudentById(id) {
    return students.find(s => s.id === id);
}
function getViolationsByStudent(studentId) {
    return violations.filter(v => v.studentId === studentId);
}
function updateSummaryStats() {
    document.getElementById('totalStudents').innerText = students.length;
    document.getElementById('totalViolations').innerText = violations.length;
    const studentsWithViol = new Set(violations.map(v => v.studentId)).size;
    document.getElementById('studentsWithViolations').innerText = studentsWithViol;
    // Eligible count
    let eligible = 0;
    students.forEach(s => {
        if (isEligible(s.id)) eligible++;
    });
    document.getElementById('eligibleCount').innerText = eligible;
}
function isEligible(studentId) {
    const v = getViolationsByStudent(studentId);
    const minor = v.filter(v => v.type === 'Minor Offense').length;
    const major = v.filter(v => v.type === 'Major Offense').length;
    const grave = v.filter(v => v.type === 'Grave Offense').length;
    return grave >= 1 || major >= 3 || minor >= 5;
}

// --- CHARTS ---
let trendChart, typeChart;

function initCharts() {
    // Trend data: last 6 months (Oct-Mar example)
    const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const monthlyCounts = months.map(month => {
        return violations.filter(v => {
            const vDate = new Date(v.date);
            const vMonth = vDate.toLocaleString('default', { month: 'short' });
            return vMonth === month;
        }).length;
    });
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
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#333' } }
            }
        }
    });

    // Pie chart: violation types
    const types = ['Minor Offense', 'Major Offense', 'Grave Offense'];
    const typeCounts = types.map(t => violations.filter(v => v.type === t).length);
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
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function refreshCharts() {
    // Update trend data
    const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const monthlyCounts = months.map(month => {
        return violations.filter(v => {
            const vDate = new Date(v.date);
            const vMonth = vDate.toLocaleString('default', { month: 'short' });
            return vMonth === month;
        }).length;
    });
    trendChart.data.datasets[0].data = monthlyCounts;
    trendChart.update();

    // Update pie
    const types = ['Minor Offense', 'Major Offense', 'Grave Offense'];
    const typeCounts = types.map(t => violations.filter(v => v.type === t).length);
    typeChart.data.datasets[0].data = typeCounts;
    typeChart.update();
}

// --- UI Populate Dropdowns ---
function populateStudentDropdowns() {
    const selects = ['violationStudentId', 'historyStudentId', 'eligibilityStudentId', 'reportStudentId'];
    const options = '<option value="">Select student</option>' + 
        students.map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`).join('');
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = options;
    });
}

// --- Search Student ---
document.getElementById('searchBtn').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const resultDiv = document.getElementById('searchResult');
    if (!query) {
        resultDiv.innerHTML = '<div class="alert alert-warning">Enter ID or name</div>';
        return;
    }
    const student = students.find(s => s.id.toLowerCase() === query || s.name.toLowerCase().includes(query));
    if (student) {
        const violCount = getViolationsByStudent(student.id).length;
        resultDiv.innerHTML = `<div class="alert alert-success">${student.name} (${student.id})<br>Course: ${student.course} Y${student.year}<br>Violations: ${violCount}</div>`;
    } else {
        resultDiv.innerHTML = '<div class="alert alert-danger">Student not found</div>';
    }
});

// --- Record Violation ---
document.getElementById('violationForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const studentId = document.getElementById('violationStudentId').value;
    const type = document.getElementById('violationType').value;
    const date = document.getElementById('violationDate').value;
    const desc = document.getElementById('violationDesc').value;
    if (!studentId || !date || !desc) {
        alert('Please fill all fields');
        return;
    }
    const newId = violations.length + 1;
    violations.push({ id: newId, studentId, type, date, description: desc });
    alert('Violation recorded');
    document.getElementById('violationForm').reset();
    bootstrap.Modal.getInstance(document.getElementById('recordModal')).hide();
    updateSummaryStats();
    refreshCharts();
    // Also update any open modals' dropdowns
    populateStudentDropdowns();
});

// --- Violation History ---
document.getElementById('historyStudentId').addEventListener('change', function() {
    const sid = this.value;
    const container = document.getElementById('historyList');
    if (!sid) {
        container.innerHTML = '';
        return;
    }
    const student = getStudentById(sid);
    const vlist = getViolationsByStudent(sid);
    if (vlist.length === 0) {
        container.innerHTML = `<div class="alert alert-secondary">No violations for ${student.name}</div>`;
        return;
    }
    let html = `<table class="table table-sm table-bordered"><thead><tr><th>Date</th><th>Type</th><th>Description</th></tr></thead><tbody>`;
    vlist.forEach(v => {
        html += `<tr><td>${v.date}</td><td>${v.type}</td><td>${v.description}</td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = `<h6>${student.name} (${student.id})</h6>${html}`;
});

// --- Suspension Eligibility ---
document.getElementById('eligibilityStudentId').addEventListener('change', function() {
    const sid = this.value;
    const resultDiv = document.getElementById('eligibilityResult');
    if (!sid) {
        resultDiv.innerHTML = '';
        return;
    }
    const student = getStudentById(sid);
    const eligible = isEligible(sid);
    const v = getViolationsByStudent(sid);
    const minor = v.filter(v => v.type === 'Minor Offense').length;
    const major = v.filter(v => v.type === 'Major Offense').length;
    const grave = v.filter(v => v.type === 'Grave Offense').length;
    let reason = `Minor: ${minor}, Major: ${major}, Grave: ${grave}. `;
    reason += eligible ? 'ELIGIBLE for suspension.' : 'Not eligible.';
    resultDiv.innerHTML = `<strong>${student.name}</strong><br>${reason}`;
    resultDiv.className = eligible ? 'alert alert-danger' : 'alert alert-success';
});

// --- Generate Report (CSV) ---
document.getElementById('reportType').addEventListener('change', function() {
    const studentDiv = document.getElementById('reportStudentDiv');
    if (this.value === 'byStudent') studentDiv.classList.remove('d-none');
    else studentDiv.classList.add('d-none');
});
document.getElementById('generateReportBtn').addEventListener('click', () => {
    const type = document.getElementById('reportType').value;
    let csv = "Student ID,Student Name,Violation Type,Date,Description\n";
    if (type === 'summary') {
        violations.forEach(v => {
            const s = getStudentById(v.studentId);
            csv += `${v.studentId},"${s ? s.name : 'Unknown'}",${v.type},${v.date},"${v.description}"\n`;
        });
    } else {
        const sid = document.getElementById('reportStudentId').value;
        if (!sid) { alert('Select a student'); return; }
        const student = getStudentById(sid);
        const vlist = getViolationsByStudent(sid);
        vlist.forEach(v => {
            csv += `${v.studentId},"${student.name}",${v.type},${v.date},"${v.description}"\n`;
        });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `violation_report_${new Date().toISOString().slice(0,19)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    populateStudentDropdowns();
    updateSummaryStats();
    initCharts();
    // Set default date for violation modal to today
    const today = new Date().toISOString().slice(0,10);
    document.getElementById('violationDate').value = today;
});