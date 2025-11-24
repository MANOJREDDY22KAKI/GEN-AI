// --- Master Data Structures ---
const teams = {
    "Alpha": ["Alice", "Bob", "Charlie", "David"],
    "Beta": ["Eve", "Frank", "Grace"],
    "Gamma": ["Henry", "Ivy", "Jack", "Kate"]
};

// Initial mock tickets (fetched from system)
const mockFetchedTickets = [
    { id: 'TICKET-001', summary: 'Implement User Login (API)', points: 8, source: 'External' },
    { id: 'TICKET-002', summary: 'Fix Database Connection Bug', points: 3, source: 'External' },
    { id: 'TICKET-003', summary: 'Optimize Image Upload Service', points: 13, source: 'External' },
];

// Array to hold the *final, combined* set of tickets for the sprint (fetched + manual)
let sprintBacklog = [...mockFetchedTickets]; 

// Array to hold submitted leaves
let leaves = [{ resource: 'Alice', date: '2025-12-05' }];


// --- Core UI Functions ---

function loadTeamMembers() {
    const teamName = document.getElementById('teamSelect').value;
    const resourceSelect = document.getElementById('resourceName');
    
    // Clear existing members
    resourceSelect.innerHTML = ''; 
    
    if (teams[teamName]) {
        teams[teamName].forEach(member => {
            const option = document.createElement('option');
            option.value = member;
            option.textContent = member;
            resourceSelect.appendChild(option);
        });
        
        // Update capacity section based on new team size
        const numMembers = teams[teamName].length;
        document.getElementById('totalResources').textContent = numMembers;
        document.getElementById('grossCapacity').textContent = (numMembers * 10) + ' Person-Days'; // Assuming 10 sprint days
    }
    
    // Reset/reload dependent data based on new team
    leaves = []; // Clear leaves for the new team
    sprintBacklog = []; // Clear backlog for the new team
    
    renderLeaves();
    renderTicketReviewTable();
}

function addLeave() {
    const resource = document.getElementById('resourceName').value;
    const date = document.getElementById('leaveDate').value;
    
    if (resource && date) {
        leaves.push({ resource, date });
        renderLeaves();
    } else {
        alert('Please select a resource and a date.');
    }
}

function renderLeaves() {
    const list = document.getElementById('leaveList');
    list.innerHTML = '';
    
    if (leaves.length === 0) {
        list.innerHTML = '<li>No planned leaves submitted for this team.</li>';
    } else {
        leaves.forEach(leave => {
            const li = document.createElement('li');
            li.textContent = `${leave.resource}: ${leave.date}`;
            list.appendChild(li);
        });
    }

    // Update capacity display
    const totalLeaveDays = leaves.length;
    const grossCapacity = parseInt(document.getElementById('grossCapacity').textContent);
    const netCapacity = grossCapacity - totalLeaveDays; 
    
    document.getElementById('totalLeaves').textContent = `${totalLeaveDays} Day${totalLeaveDays === 1 ? '' : 's'}`;
    document.getElementById('netCapacity').textContent = `**${netCapacity} Person-Days**`;
}

function addManualTicket() {
    const summary = document.getElementById('manualSummary').value;
    const points = parseInt(document.getElementById('manualPoints').value);
    
    if (summary && points > 0) {
        const newTicket = { 
            id: 'MANUAL-' + (sprintBacklog.length + 1), 
            summary: summary, 
            points: points,
            source: 'Manual'
        };
        sprintBacklog.push(newTicket);
        document.getElementById('manualSummary').value = '';
        document.getElementById('manualPoints').value = '';
        renderTicketReviewTable();
    } else {
        alert('Please enter a summary and valid story points (> 0).');
    }
}

function fetchTickets() {
    // In a real application, this would fetch filtered tickets via an API call.
    sprintBacklog = [...mockFetchedTickets]; 
    renderTicketReviewTable();
}

function renderTicketReviewTable() {
    const tableBody = document.querySelector('#ticketReviewTable tbody');
    tableBody.innerHTML = '';
    let totalPoints = 0;
    
    if (sprintBacklog.length === 0) {
        const row = tableBody.insertRow();
        row.insertCell(0).colSpan = 3;
        row.insertCell(0).textContent = 'No tickets in the backlog. Fetch tickets or add manually.';
        return;
    }

    sprintBacklog.forEach((ticket, index) => {
        const row = tableBody.insertRow();
        
        row.insertCell(0).textContent = ticket.source;
        row.insertCell(1).textContent = `${ticket.id}: ${ticket.summary}`;
        
        // Editable Story Points Cell
        const pointsCell = row.insertCell(2);
        pointsCell.style.textAlign = 'center';
        
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.value = ticket.points;
        input.className = 'ticket-input-points';
        input.onchange = (e) => {
            sprintBacklog[index].points = parseInt(e.target.value) || 0;
        };
        pointsCell.appendChild(input);
        
        totalPoints += ticket.points;
    });

    // Total Points Row
    const totalRow = tableBody.insertRow();
    totalRow.style.fontWeight = 'bold';
    totalRow.insertCell(0).textContent = '';
    totalRow.insertCell(1).textContent = 'TOTAL ESTIMATED POINTS:';
    totalRow.insertCell(2).textContent = totalPoints + ' pts';
    totalRow.cells[2].style.textAlign = 'center';
}

function calculateAndAnalyze() {
    const team = document.getElementById('teamSelect').value;
    const sprint = document.getElementById('sprintName').value;
    const netCapacity = parseInt(document.getElementById('netCapacity').textContent);
    const totalPoints = sprintBacklog.reduce((sum, t) => sum + t.points, 0);

    // AI Insight Logic (Mocked)
    let insight = `Sprint: ${sprint} for Team ${team}. Net capacity: ${netCapacity} Person-Days. Total estimated Story Points: ${totalPoints} points.`;
    
    if (totalPoints > (netCapacity * 2.5)) { 
        insight += " **CRITICAL OVERLOAD RISK:** Estimated work far exceeds calculated capacity (Capacity/Points mismatch). Highly recommend removing or deferring tickets.";
    } else if (totalPoints > (netCapacity * 2)) {
        insight += " **Moderate Risk:** The workload is high. The AI recommends reserving a 10% buffer and ensuring critical path items are clearly defined.";
    } else {
        insight += " **Good Balance:** Capacity and workload are well-aligned. The team has a sufficient buffer for emergent work.";
    }

    document.getElementById('insightText').textContent = insight;
    alert('Capacity calculated and AI insights generated!');
}

function exportData() {
    // This function would call the backend API to generate the Excel file.
    alert(`Exporting planning data for ${document.getElementById('sprintName').value} (${document.getElementById('teamSelect').value}) to Excel... (Functionality Mocked)`);
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Make these functions globally accessible for the HTML onclick handlers
    window.loadTeamMembers = loadTeamMembers;
    window.addLeave = addLeave;
    window.addManualTicket = addManualTicket;
    window.fetchTickets = fetchTickets;
    window.calculateAndAnalyze = calculateAndAnalyze;
    window.exportData = exportData;

    loadTeamMembers(); // Initialize the UI with the default team (Alpha)
    renderTicketReviewTable(); // Show the initial mock backlog
});