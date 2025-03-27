let processes = [];
const processColors = [
    '#4CAF50', '#2196F3', '#F44336', '#FFC107', 
    '#9C27B0', '#FF9800', '#795548', '#607D8B',
    '#E91E63', '#3F51B5', '#009688', '#FFEB3B'
];
let processColorMap = {};

function addProcess() {
    const processId = document.getElementById('process-id').value;
    const arrivalTime = parseInt(document.getElementById('arrival-time').value);
    const burstTime = parseInt(document.getElementById('burst-time').value);
    const algorithm = document.getElementById('algorithm').value;
    let priority = 0;  // Default priority

    // Only validate priority if using priority scheduling
    if (algorithm === 'priority') {
        priority = parseInt(document.getElementById('priority').value);
        if (isNaN(priority)) {
            alert('Please fill all fields with valid values');
            return;
        }
    }

    if (!processId || isNaN(arrivalTime) || isNaN(burstTime)) {
        alert('Please fill all fields with valid values');
        return;
    }

    const process = {
        id: processId,
        arrivalTime,
        burstTime,
        priority,
        remainingTime: burstTime
    };

    processes.push(process);
    // Assign a color to the process
    if (!processColorMap[processId]) {
        processColorMap[processId] = processColors[Object.keys(processColorMap).length % processColors.length];
    }
    updateProcessTable();
    clearInputs();
}

function clearInputs() {
    document.getElementById('process-id').value = '';
    document.getElementById('arrival-time').value = '';
    document.getElementById('burst-time').value = '';
    document.getElementById('priority').value = '';
}

function deleteProcess(index) {
    processes.splice(index, 1);
    updateProcessTable();
}

function updateProcessTable() {
    const tbody = document.getElementById('process-list');
    tbody.innerHTML = '';

    processes.forEach((process, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${process.id}</td>
            <td>${process.arrivalTime}</td>
            <td>${process.burstTime}</td>
            <td>${process.priority}</td>
            <td><button class="delete-btn" onclick="deleteProcess(${index})">Delete</button></td>
        `;
        tbody.appendChild(row);
    });
}

document.getElementById('algorithm').addEventListener('change', function() {
    const quantumInput = document.getElementById('quantum-input');
    const priorityField = document.querySelector('.input-field:has(#priority)');
    
    // Handle quantum input visibility
    quantumInput.style.display = this.value === 'rr' ? 'inline-block' : 'none';
    
    // Handle priority field visibility
    priorityField.style.display = this.value === 'priority' ? 'block' : 'none';
});

// Hide priority field initially if not priority scheduling
window.addEventListener('DOMContentLoaded', function() {
    const algorithm = document.getElementById('algorithm').value;
    const priorityField = document.querySelector('.input-field:has(#priority)');
    priorityField.style.display = algorithm === 'priority' ? 'block' : 'none';
});

function simulate() {
    if (processes.length === 0) {
        alert('Please add at least one process');
        return;
    }

    const algorithm = document.getElementById('algorithm').value;
    let schedule;

    switch (algorithm) {
        case 'fcfs':
            schedule = FCFS([...processes]);
            break;
        case 'sjf':
            schedule = SJF([...processes]);
            break;
        case 'priority':
            schedule = PriorityScheduling([...processes]);
            break;
        case 'rr':
            const quantum = parseInt(document.getElementById('time-quantum').value);
            if (isNaN(quantum) || quantum < 1) {
                alert('Please enter a valid time quantum');
                return;
            }
            schedule = RoundRobin([...processes], quantum);
            break;
    }

    displayGanttChart(schedule);
    calculateAndDisplayMetrics(schedule);
}

function FCFS(processes) {
    processes.sort((a, b) => a.arrivalTime - b.arrivalTime);
    let currentTime = 0;
    let schedule = [];

    processes.forEach(process => {
        if (currentTime < process.arrivalTime) {
            currentTime = process.arrivalTime;
        }
        schedule.push({
            id: process.id,
            start: currentTime,
            end: currentTime + process.burstTime,
            priority: process.priority
        });
        currentTime += process.burstTime;
    });

    return schedule;
}

function SJF(processes) {
    let currentTime = 0;
    let schedule = [];
    let remainingProcesses = [...processes];
    
    while (remainingProcesses.length > 0) {
        let availableProcesses = remainingProcesses.filter(p => p.arrivalTime <= currentTime);
        
        if (availableProcesses.length === 0) {
            currentTime = Math.min(...remainingProcesses.map(p => p.arrivalTime));
            continue;
        }

        availableProcesses.sort((a, b) => a.burstTime - b.burstTime);
        const shortestJob = availableProcesses[0];
        
        schedule.push({
            id: shortestJob.id,
            start: currentTime,
            end: currentTime + shortestJob.burstTime,
            priority: shortestJob.priority
        });

        currentTime += shortestJob.burstTime;
        remainingProcesses = remainingProcesses.filter(p => p.id !== shortestJob.id);
    }

    return schedule;
}

function PriorityScheduling(processes) {
    let currentTime = 0;
    let schedule = [];
    let remainingProcesses = processes.map(p => ({
        ...p,
        remainingTime: p.burstTime,
        startTime: null,
        completed: false
    }));
    
    while (remainingProcesses.some(p => !p.completed)) {
        // Find available processes at current time
        let availableProcesses = remainingProcesses.filter(p => 
            !p.completed && p.arrivalTime <= currentTime
        );
        
        if (availableProcesses.length === 0) {
            // No processes available, jump to next arrival time
            const nextArrival = Math.min(...remainingProcesses
                .filter(p => !p.completed)
                .map(p => p.arrivalTime));
            currentTime = nextArrival;
            continue;
        }

        // Sort by priority (higher number means higher priority)
        // If priorities are equal, prefer the process that started first
        availableProcesses.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; 
            }
            // If priorities are equal, prefer the one that started earlier
            if (a.startTime !== null && b.startTime !== null) {
                return a.startTime - b.startTime;
            }
            // If one hasn't started, prefer the one with earlier arrival time
            return a.arrivalTime - b.arrivalTime;
        });

        const selectedProcess = availableProcesses[0];
        
        // Find next priority change point (now checking for higher priority)
        const nextPriorityChange = Math.min(
            ...remainingProcesses
                .filter(p => !p.completed && p.arrivalTime > currentTime && p.priority > selectedProcess.priority)
                .map(p => p.arrivalTime)
                .concat([currentTime + selectedProcess.remainingTime])
        );

        const executeTime = nextPriorityChange - currentTime;

        if (selectedProcess.startTime === null) {
            selectedProcess.startTime = currentTime;
        }

        schedule.push({
            id: selectedProcess.id,
            start: currentTime,
            end: currentTime + executeTime,
            priority: selectedProcess.priority
        });

        selectedProcess.remainingTime -= executeTime;
        currentTime += executeTime;

        if (selectedProcess.remainingTime <= 0) {
            const index = remainingProcesses.findIndex(p => p.id === selectedProcess.id);
            remainingProcesses[index].completed = true;
        }
    }

    // Merge consecutive blocks for the same process
    const mergedSchedule = [];
    for (let i = 0; i < schedule.length; i++) {
        if (i === 0 || schedule[i].id !== schedule[i-1].id || schedule[i].start !== schedule[i-1].end) {
            mergedSchedule.push(schedule[i]);
        } else {
            mergedSchedule[mergedSchedule.length - 1].end = schedule[i].end;
        }
    }

    return mergedSchedule;
}

function RoundRobin(processes, quantum) {
    let currentTime = 0;
    let schedule = [];
    let remainingProcesses = processes.map(p => ({...p}));
    
    while (remainingProcesses.length > 0) {
        let executed = false;
        
        for (let i = 0; i < remainingProcesses.length; i++) {
            const process = remainingProcesses[i];
            
            if (process.arrivalTime <= currentTime) {
                const executeTime = Math.min(quantum, process.remainingTime);
                
                schedule.push({
                    id: process.id,
                    start: currentTime,
                    end: currentTime + executeTime,
                    priority: process.priority
                });

                process.remainingTime -= executeTime;
                currentTime += executeTime;
                executed = true;

                if (process.remainingTime === 0) {
                    remainingProcesses.splice(i, 1);
                    i--;
                }
            }
        }

        if (!executed) {
            currentTime = Math.min(...remainingProcesses.map(p => p.arrivalTime));
        }
    }

    return schedule;
}

function displayGanttChart(schedule) {
    const container = document.getElementById('gantt-container');
    const timeline = document.getElementById('timeline');
    container.innerHTML = '';
    timeline.innerHTML = '';

    // Remove any existing process info tooltips
    const existingTooltips = document.querySelectorAll('.process-info');
    existingTooltips.forEach(tooltip => tooltip.remove());

    const timeScale = 50; // pixels per time unit
    let maxTime = Math.max(...schedule.map(p => p.end));
    container.style.width = `${maxTime * timeScale}px`;

    schedule.forEach(process => {
        const block = document.createElement('div');
        block.className = 'gantt-block';
        block.style.left = `${process.start * timeScale}px`;
        block.style.width = `${(process.end - process.start) * timeScale}px`;
        block.style.backgroundColor = processColorMap[process.id];
        block.textContent = `${process.id} (P${process.priority})`;

        // Add hover tooltip
        block.addEventListener('mouseover', (e) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'process-info';
            tooltip.innerHTML = `
                Process: ${process.id}<br>
                Priority: ${process.priority}<br>
                Start: ${process.start}<br>
                End: ${process.end}<br>
                Duration: ${process.end - process.start}
            `;
            tooltip.style.left = `${e.pageX + 10}px`;
            tooltip.style.top = `${e.pageY + 10}px`;
            document.body.appendChild(tooltip);
            tooltip.style.display = 'block';
        });

        block.addEventListener('mousemove', (e) => {
            const tooltip = document.querySelector('.process-info');
            if (tooltip) {
                tooltip.style.left = `${e.pageX + 10}px`;
                tooltip.style.top = `${e.pageY + 10}px`;
            }
        });

        block.addEventListener('mouseout', () => {
            const tooltip = document.querySelector('.process-info');
            if (tooltip) {
                tooltip.remove();
            }
        });

        container.appendChild(block);
    });

    // Add timeline markers
    for (let i = 0; i <= maxTime; i++) {
        const marker = document.createElement('div');
        marker.className = 'timeline-marker';
        marker.style.left = `${i * timeScale}px`;
        marker.textContent = i;
        timeline.appendChild(marker);
    }
}

function calculateAndDisplayMetrics(schedule) {
    const processMetrics = {};
    
    // Initialize process metrics
    processes.forEach(p => {
        processMetrics[p.id] = {
            arrivalTime: p.arrivalTime,
            burstTime: p.burstTime,
            completionTime: 0,
            turnaroundTime: 0,
            waitingTime: 0
        };
    });

    // Calculate completion time for each process
    schedule.forEach(p => {
        processMetrics[p.id].completionTime = Math.max(
            processMetrics[p.id].completionTime,
            p.end
        );
    });

    // Calculate turnaround time and waiting time
    let totalWaitingTime = 0;
    let totalTurnaroundTime = 0;

    Object.keys(processMetrics).forEach(id => {
        const process = processMetrics[id];
        process.turnaroundTime = process.completionTime - process.arrivalTime;
        process.waitingTime = process.turnaroundTime - process.burstTime;
        
        totalWaitingTime += process.waitingTime;
        totalTurnaroundTime += process.turnaroundTime;
    });

    const avgWaitingTime = totalWaitingTime / processes.length;
    const avgTurnaroundTime = totalTurnaroundTime / processes.length;

    document.getElementById('avg-waiting-time').textContent = avgWaitingTime.toFixed(2);
    document.getElementById('avg-turnaround-time').textContent = avgTurnaroundTime.toFixed(2);
}
