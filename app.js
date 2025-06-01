// Helper function to parse CSV data
function parseCSV(csvString) {
    const lines = csvString.trim().split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    
    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index];
        });
        return obj;
    });
}

// Helper to parse a single CSV line, handling quoted commas
function parseCSVLine(line) {
    const values = [];
    let inQuote = false;
    let currentField = '';
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            values.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }
    values.push(currentField.trim()); // Add the last field
    return values;
}

// Prospect data loaded from CSV (will be fetched dynamically)
let prospectsData = [];

// Global state
let filteredData = []; // Initialize as empty, will be populated after data fetch
let currentProspect = null;
let prospectStatuses = new Map();
let prospectNotes = new Map();
let typeChart = null;
let locationChart = null;

// DOM elements
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const locationFilter = document.getElementById('locationFilter');
const prospectsTableBody = document.getElementById('prospectsTableBody');
const totalCount = document.getElementById('totalCount');
const analyticsToggle = document.getElementById('analyticsToggle');
const analyticsSection = document.getElementById('analyticsSection');
const exportBtn = document.getElementById('exportBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalSave = document.getElementById('modalSave');

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Ensure modal is hidden on load
    document.getElementById('modalOverlay').classList.add('hidden');
    
    // Fetch and parse CSV data
    try {
        const response = await fetch('northwest_england_prospects.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvString = await response.text();
        prospectsData = parseCSV(csvString);
        filteredData = [...prospectsData]; // Initialize filteredData after prospectsData is loaded
    } catch (error) {
        console.error('Error fetching or parsing CSV:', error);
        // Fallback or error display if CSV fails to load
        document.getElementById('prospectsTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <h3>Error loading prospects data</h3>
                    <p>Please check the CSV file and ensure it's accessible.</p>
                </td>
            </tr>
        `;
        return; // Stop initialization if data loading fails
    }

    initializeFilters();
    renderTable();
    updateAnalytics();
    bindEvents();
    initializeProspectData();
});

// Initialize filter dropdowns
function initializeFilters() {
    // Populate location filter
    const locations = [...new Set(prospectsData.map(p => p.location))].sort();
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
}

// Initialize prospect status and notes
function initializeProspectData() {
    prospectsData.forEach(prospect => {
        if (!prospectStatuses.has(prospect.name)) {
            prospectStatuses.set(prospect.name, 'Not Contacted');
        }
        if (!prospectNotes.has(prospect.name)) {
            prospectNotes.set(prospect.name, '');
        }
    });
}

// Bind event listeners
function bindEvents() {
    searchInput.addEventListener('input', handleSearch);
    typeFilter.addEventListener('change', handleFilter);
    locationFilter.addEventListener('change', handleFilter);
    analyticsToggle.addEventListener('click', toggleAnalytics);
    exportBtn.addEventListener('click', handleExport);
    
    // Modal event listeners with proper handling
    modalClose.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
    });
    
    modalCancel.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
    });
    
    modalSave.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        saveProspectData();
    });
    
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Escape key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Handle search functionality
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    filteredData = prospectsData.filter(prospect => 
        prospect.name.toLowerCase().includes(searchTerm) ||
        prospect.type.toLowerCase().includes(searchTerm) ||
        prospect.location.toLowerCase().includes(searchTerm) ||
        prospect.description.toLowerCase().includes(searchTerm) ||
        prospect.ai_opportunity.toLowerCase().includes(searchTerm)
    );
    applyFilters();
}

// Handle filter changes
function handleFilter() {
    applyFilters();
}

// Apply all filters
function applyFilters() {
    let filtered = [...filteredData];
    
    // Apply search if no search was performed
    if (searchInput.value === '') {
        filtered = [...prospectsData];
    }
    
    // Apply type filter
    const typeValue = typeFilter.value;
    if (typeValue) {
        filtered = filtered.filter(prospect => prospect.type === typeValue);
    }
    
    // Apply location filter
    const locationValue = locationFilter.value;
    if (locationValue) {
        filtered = filtered.filter(prospect => prospect.location === locationValue);
    }
    
    filteredData = filtered;
    renderTable();
    updateTotalCount();
}

// Helper function to format contact info
function formatContactInfo(value, type) {
    if (!value || value === 'TBD' || value === 'Contact via website') {
        return `<span class="contact-placeholder">Contact via website</span>`;
    }
    
    if (type === 'phone') {
        return `<a href="tel:${value}" class="contact-link">${value}</a>`;
    } else if (type === 'email') {
        return `<a href="mailto:${value}" class="contact-link">${value}</a>`;
    }
    
    return value;
}

// Render the prospects table
function renderTable() {
    prospectsTableBody.innerHTML = '';
    
    if (filteredData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="6" class="empty-state">
                <h3>No prospects found</h3>
                <p>Try adjusting your search or filter criteria</p>
            </td>
        `;
        prospectsTableBody.appendChild(row);
        return;
    }
    
    filteredData.forEach(prospect => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${prospect.name}</strong>
            </td>
            <td>
                <span class="prospect-type prospect-type--${getTypeClass(prospect.type)}">
                    ${prospect.type}
                </span>
            </td>
            <td>${prospect.location}</td>
            <td class="contact-cell">
                ${formatContactInfo(prospect.phone, 'phone')}
                ${formatContactInfo(prospect.email, 'email')}
            </td>
            <td>
                <span class="status-badge status-badge--${getStatusClass(prospectStatuses.get(prospect.name))}">
                    ${prospectStatuses.get(prospect.name)}
                </span>
            </td>
            <td class="action-buttons">
                <button class="action-btn" onclick="openProspectModal('${prospect.name.replace(/'/g, "\\'")}')">View</button>
                <a href="mailto:${prospect.email}" class="action-btn">Email</a>
                <a href="tel:${prospect.phone}" class="action-btn">Call</a>
            </td>
        `;
        
        row.addEventListener('click', function(e) {
            if (!e.target.closest('.action-btn')) {
                openProspectModal(prospect.name);
            }
        });
        
        prospectsTableBody.appendChild(row);
    });
}

// Get CSS class for prospect type
function getTypeClass(type) {
    switch (type) {
        case 'Public Body': return 'public';
        case 'Cultural Institution': return 'cultural';
        case 'B2B Company': return 'b2b';
        case 'Funding Body': return 'funding';
        default: return '';
    }
}

// Get CSS class for status
function getStatusClass(status) {
    switch (status) {
        case 'Not Contacted': return 'not-contacted';
        case 'Contacted': return 'contacted';
        case 'Meeting Scheduled': return 'meeting';
        case 'Proposal Sent': return 'proposal';
        case 'Follow-up Required': return 'follow-up';
        case 'Closed': return 'closed';
        default: return 'not-contacted';
    }
}

// Update total count display
function updateTotalCount() {
    const count = filteredData.length;
    totalCount.textContent = `${count} prospect${count !== 1 ? 's' : ''}`;
}

// Toggle analytics section
function toggleAnalytics() {
    const isHidden = analyticsSection.classList.contains('hidden');
    
    if (isHidden) {
        analyticsSection.classList.remove('hidden');
        analyticsToggle.textContent = 'Hide Analytics';
        renderCharts();
    } else {
        analyticsSection.classList.add('hidden');
        analyticsToggle.textContent = 'View Analytics';
    }
}

// Update analytics data
function updateAnalytics() {
    const typeCounts = {};
    const locationCounts = {};
    
    prospectsData.forEach(prospect => {
        typeCounts[prospect.type] = (typeCounts[prospect.type] || 0) + 1;
        locationCounts[prospect.location] = (locationCounts[prospect.location] || 0) + 1;
    });
    
    // Update summary statistics
    document.getElementById('totalProspects').textContent = prospectsData.length;
    document.getElementById('publicBodies').textContent = typeCounts['Public Body'] || 0;
    document.getElementById('culturalInstitutions').textContent = typeCounts['Cultural Institution'] || 0;
    document.getElementById('b2bCompanies').textContent = typeCounts['B2B Company'] || 0;
}

// Render charts
function renderCharts() {
    renderTypeChart();
    renderLocationChart();
}

// Render type distribution chart
function renderTypeChart() {
    const ctx = document.getElementById('typeChart').getContext('2d');
    
    if (typeChart) {
        typeChart.destroy();
    }
    
    const typeCounts = {};
    prospectsData.forEach(prospect => {
        typeCounts[prospect.type] = (typeCounts[prospect.type] || 0) + 1;
    });
    
    const chartColors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5'];
    
    typeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{
                data: Object.values(typeCounts),
                backgroundColor: chartColors.slice(0, Object.keys(typeCounts).length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

// Render location distribution chart
function renderLocationChart() {
    const ctx = document.getElementById('locationChart').getContext('2d');
    
    if (locationChart) {
        locationChart.destroy();
    }
    
    const locationCounts = {};
    prospectsData.forEach(prospect => {
        locationCounts[prospect.location] = (locationCounts[prospect.location] || 0) + 1;
    });
    
    const sortedLocations = Object.entries(locationCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10 locations
    
    const chartColors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'];
    
    locationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedLocations.map(([location]) => location),
            datasets: [{
                label: 'Number of Prospects',
                data: sortedLocations.map(([, count]) => count),
                backgroundColor: chartColors.slice(0, sortedLocations.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Open prospect detail modal
function openProspectModal(prospectName) {
    const prospect = prospectsData.find(p => p.name === prospectName);
    if (!prospect) return;
    
    currentProspect = prospect;
    
    // Helper function to display contact info with placeholders
    function displayContactInfo(value, defaultText = 'Not available') {
        if (!value || value === 'TBD' || value === 'Contact via website') {
            return defaultText;
        }
        return value;
    }
    
    // Populate modal
    document.getElementById('modalTitle').textContent = prospect.name;
    document.getElementById('modalAddress').textContent = prospect.address || 'Address not available';
    
    // Phone
    const phoneElement = document.getElementById('modalPhone');
    const phoneValue = displayContactInfo(prospect.phone, 'Contact via website');
    phoneElement.textContent = phoneValue;
    if (prospect.phone && prospect.phone !== 'TBD' && prospect.phone !== 'Contact via website') {
        phoneElement.href = `tel:${prospect.phone}`;
    } else {
        phoneElement.href = '#';
        phoneElement.onclick = function(e) { e.preventDefault(); };
    }
    
    // Email
    const emailElement = document.getElementById('modalEmail');
    emailElement.textContent = prospect.email || 'Email not available';
    emailElement.href = `mailto:${prospect.email}`;
    
    // Website
    const websiteElement = document.getElementById('modalWebsite');
    websiteElement.textContent = prospect.website || 'Website not available';
    if (prospect.website) {
        websiteElement.href = `https://${prospect.website}`;
    } else {
        websiteElement.href = '#';
        websiteElement.onclick = function(e) { e.preventDefault(); };
    }
    
    document.getElementById('modalDescription').textContent = prospect.description || 'No description available';
    document.getElementById('modalOpportunity').textContent = prospect.ai_opportunity || 'No opportunity details available';
    document.getElementById('modalStatus').value = prospectStatuses.get(prospect.name);
    document.getElementById('modalNotes').value = prospectNotes.get(prospect.name);
    
    modalOverlay.classList.remove('hidden');
    
    // Focus management
    setTimeout(() => {
        document.getElementById('modalStatus').focus();
    }, 100);
}

// Close modal
function closeModal() {
    modalOverlay.classList.add('hidden');
    currentProspect = null;
}

// Save prospect data
function saveProspectData() {
    if (!currentProspect) return;
    
    const status = document.getElementById('modalStatus').value;
    const notes = document.getElementById('modalNotes').value;
    
    prospectStatuses.set(currentProspect.name, status);
    prospectNotes.set(currentProspect.name, notes);
    
    renderTable();
    closeModal();
}

// Handle export functionality
function handleExport() {
    const csvContent = generateCSV(filteredData);
    downloadCSV(csvContent, 'prospects_export.csv');
}

// Generate CSV content
function generateCSV(data) {
    const headers = ['Name', 'Type', 'Location', 'Address', 'Phone', 'Email', 'Website', 'Description', 'AI Opportunity', 'Status', 'Notes'];
    
    const rows = data.map(prospect => [
        prospect.name,
        prospect.type,
        prospect.location,
        prospect.address,
        prospect.phone,
        prospect.email,
        prospect.website,
        prospect.description,
        prospect.ai_opportunity,
        prospectStatuses.get(prospect.name),
        prospectNotes.get(prospect.name)
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field || ''}"`).join(','))
        .join('\n');
    
    return csvContent;
}

// Download CSV file
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Make functions globally available
window.openProspectModal = openProspectModal;