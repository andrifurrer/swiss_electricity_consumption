
document.addEventListener("DOMContentLoaded", () => {
    loadCSV();
});

let allData = []; // Keep full dataset in memory
let chart = null;
let pieChart = null;

async function loadCSV() {
    const response = await fetch("data/ogd104_stromproduktion_swissgrid.csv");
    const text = await response.text();
    const rows = text.trim().split("\n").slice(1); // remove header

    const currentYear = new Date().getFullYear();

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
        updatePieChart(currentYear);
        setupFilterListener();
    }

// async function loadCSV() {
//     try {
//         const csvUrl = "https://www.bfe-ogd.ch/ogd104_stromproduktion_swissgrid.csv?v=" + new Date().getTime();

//         const response = await fetch(csvUrl);
//         const text = await response.text();

//         const rows = text.trim().split("\n").slice(1);

//         allData = rows.map(row => {
//             const cols = row.split(",");

//             return {
//                 date: new Date(cols[0]),
//                 source: cols[1],
//                 value: parseFloat(cols[2].replace(",", "."))
//             };
//         //}).filter(d => !isNaN(d.date));
//         });

//         console.log("Loaded official data:", allData.length);

//         populateYearSelect();
//         updateChart("recentDay");
//         setupFilterListener();

//     } catch (error) {
//         console.error("CSV load failed:", error);
//     }
// }

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
        updatePieChart(yearSelect.value);
    });
}


// Filter data based on selection
function filterData(filterValue) {
    const now = new Date();
    let filtered = [];

    document.getElementById("energyPieChart").style.display =
    filterValue === "year" ? "block" : "none";

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

const centerTextPlugin = {
    id: 'centerText',
    beforeDraw(chart) {
        const { width, height, ctx } = chart;
        ctx.restore();

        const fontSize = (height / 240).toFixed(2);
        ctx.font = `${fontSize}em sans-serif`;
        ctx.textBaseline = "middle";

        const text1 = chart.config.options.plugins.centerText.text1;
        const text2 = chart.config.options.plugins.centerText.text2;

        const textX = Math.round(280+(width - ctx.measureText(text1).width) / 2);
        const textY = height / 2;

        ctx.fillText(text1, textX, textY - 10);
        ctx.fillText(text2, textX, textY + 15);

        ctx.save();
    }
};


function updatePieChart(year) {
    const pieCanvas = document.getElementById("energyPieChart");
    const renewableEl = document.getElementById("renewablePercent");
    const nonRenewableEl = document.getElementById("nonRenewablePercent");

    if (!year) {
        pieCanvas.style.display = "none";
        renewableEl.textContent = '';
        nonRenewableEl.textContent = '';
        return;
    } else {
        pieCanvas.style.display = "block";
    }

    const yearData = allData.filter(d =>
        d.date.getFullYear() === parseInt(year) &&
        !isNaN(d.value)
    );
    if (yearData.length === 0) return;

    // Sum production per source
    const totals = {};
    yearData.forEach(d => {
        if (!totals[d.source]) totals[d.source] = 0;
        totals[d.source] += d.value;
    });

    const sources = Object.keys(totals);
    const values = Object.values(totals);
    const grandTotal = values.reduce((a, b) => a + b, 0);

    // Calculate renewable / non-renewable totals
    const renewableSources = ["Flusskraft", "Speicherkraft", "Wind", "Photovoltaik"];
    const nonRenewableSources = ["Kernkraft", "Thermische"];

    const renewableTotal = sources.reduce((sum, s, i) =>
        renewableSources.includes(s) ? sum + values[i] : sum, 0
    );
    const nonRenewableTotal = sources.reduce((sum, s, i) =>
        nonRenewableSources.includes(s) ? sum + values[i] : sum, 0
    );

    const renewablePercent = ((renewableTotal / grandTotal) * 100).toFixed(1);
    const nonRenewablePercent = ((nonRenewableTotal / grandTotal) * 100).toFixed(1);

    // Update text outside the pie chart
    renewableEl.textContent = `${renewablePercent}% Renewable`;
    nonRenewableEl.textContent = `${nonRenewablePercent}% Non-Renewable`;

    // Pie chart percentages for labels
    const percentages = values.map(v => ((v / grandTotal) * 100).toFixed(1));

    const ctx = pieCanvas.getContext("2d");
    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: sources.map((s, i) => `${s} (${percentages[i]}%)`),
            datasets: [{
                data: values,
                backgroundColor: sources.map((_, i) => getColor(i))
            }]
        },
        options: {
            responsive: true,
            cutout: "65%",
            plugins: {
                legend: { position: "right" }
            }
        }
    });
}