
document.addEventListener("DOMContentLoaded", () => {
    loadCSV();
});

let allData = []; // Keep full dataset in memory
let chart = null;

async function loadCSV() {
    const response = await fetch("data/ogd104_stromproduktion_swissgrid.csv");
    const text = await response.text();
    const rows = text.trim().split("\n").slice(1); // remove header

    allData = rows.map(row => {
            const cols = row.split(",");
            return {
                date: new Date(cols[0]),
                source: cols[1],
                value: parseFloat(cols[2])
            };
        });

        populateYearSelect();
        updateChart("recentDay");
        setupFilterListener();
    }

// Populate years in dropdown
function populateYearSelect() {
    const yearSet = new Set(allData.map(d => d.date.getFullYear()));
    const yearSelect = document.getElementById("yearSelect");
    yearSet.forEach(y => {
        const option = document.createElement("option");
        option.value = y;
        option.textContent = y;
        yearSelect.appendChild(option);
    });
}

function setupFilterListener() {
    const filter = document.getElementById("timeFilter");
    const yearSelect = document.getElementById("yearSelect");

    filter.addEventListener("change", () => {
        yearSelect.style.display = filter.value === "year" ? "inline" : "none";
        updateChart(filter.value);
    });

    yearSelect.addEventListener("change", () => {
        updateChart("year");
    });
}


// Filter data based on selection
function filterData(filterValue) {
    const now = new Date();
    let filtered = [];

    if (filterValue === "recentDay") {
        // For testing, use yesterday instead of today:
        const targetDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3); // yesterday
        // To use today, uncomment the next line and comment out the above:
        // const targetDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        filtered = allData.filter(d =>
            d.date.getFullYear() === targetDay.getFullYear() &&
            d.date.getMonth() === targetDay.getMonth() &&
            d.date.getDate() === targetDay.getDate()
        );
    } else if (filterValue === "currentMonth") {
        filtered = allData.filter(d => d.date.getMonth() === now.getMonth() && d.date.getFullYear() === now.getFullYear());
    } else if (filterValue === "lastMonth") {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        filtered = allData.filter(d => d.date.getMonth() === lastMonth && d.date.getFullYear() === year);
    } else if (filterValue === "year") {
        const yearSelect = document.getElementById("yearSelect");
        const year = parseInt(yearSelect.value);
        filtered = allData.filter(d => d.date.getFullYear() === year);
    } else if (filterValue === "all") {
        filtered = allData;
    }

    return filtered;
}


// Update chart dynamically
function updateChart(filterValue) {
    const filtered = filterData(filterValue);

    // Log data
    console.log("Filtered data:", filtered);

    // Group by source
    const sources = [...new Set(filtered.map(d => d.source))];
    // Deduplicate by day (one entry per day)
    const dateStrings = [...new Set(filtered.map(d => d.date.toISOString().split("T")[0]))].sort();
    const dates = dateStrings.map(s => new Date(s));

    const dataBySource = {};
    // sources.forEach(source => {
    //     dataBySource[source] = dates.map(date => {
    //         const entry = filtered.find(d =>
    //             d.source === source &&
    //             d.date.toISOString().split("T")[0] === date.toISOString().split("T")[0] // match by day string
    //         );
    //         return entry ? (isNaN(entry.value) ? 0 : entry.value) : 0;
    //     });
    // });
    sources.forEach(source => {
        dataBySource[source] = dates.map(date => {
            const entry = filtered.find(d =>
                d.source === source &&
                d.date.getFullYear() === date.getFullYear() &&
                d.date.getMonth() === date.getMonth() &&
                d.date.getDate() === date.getDate()
            );
            return entry && !isNaN(entry.value) ? entry.value : 0;
        });
    });

    // If only one date, add a dummy second point so line chart can render
    if (dates.length === 1) {
        const singleDate = dates[0];
        // Add a second point (1 hour later) with the same values
        dates.push(new Date(singleDate.getTime() + 3600*1000)); // +1 hour
        sources.forEach(source => dataBySource[source].push(dataBySource[source][0])); // duplicate the values
    }

    // Convert dates to string labels
    const labels = dates.map(d => d.toISOString().split("T")[0]);

    const datasets = sources.map((source, i) => ({
        label: source,
        data: dataBySource[source],
        backgroundColor: getColor(i),
        borderWidth: 1,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 0
    }));
    console.log("Labels:", labels);
    console.log("Datasets:", datasets);

    const ctx = document.getElementById("energyChart").getContext("2d");
    if (chart) chart.destroy();

    // Determine tick formatting based on filter
    function formatLabel(label) {
        const date = new Date(label);
        if (filterValue === "recentDay" || filterValue === "currentMonth" || filterValue === "lastMonth") {
            return `${date.getDate()}.${date.getMonth()+1}`; // show day.month
        } else if (filterValue === "year") {
            return date.getDate() === 1 ? date.toLocaleString('default', { month: 'short' }) : '';
        }
        return label;
    }

    chart = new Chart(ctx, {
        //type: filterValue === "recentDay" ? "bar" : "line", // fall back to bar plot, as line plot needs two points. Fixed above.
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top" } },
            scales: {
                x: {
                    stacked: filterValue === "year",
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true, // let Chart.js skip some labels automatically
                        callback: function(label, index) {
                            const date = new Date(this.getLabelForValue(index));

                            if (filterValue === "recentDay" || filterValue === "currentMonth" || filterValue === "lastMonth") {
                                // daily labels, show every day (or let autoSkip handle it)
                                return `${date.getDate()}.${date.getMonth() + 1}`;
                            } 
                            else if (filterValue === "year") {
                                // only show month name on 1st day of month
                                return date.getDate() === 1 ? date.toLocaleString('default', { month: 'short' }) : null;
                            }
                            return null;
                        }
                    }
                },
                y: {
                    stacked: true // always stack y-values for electricity
                }
            }
        }
    });
}


// Simple color palette
function getColor(index) {
    const palette = ["#3498db","#f1c40f","#e74c3c","#1abc9c", "#2ecc71","#9b59b6",];
    return palette[index % palette.length];
}
