document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('addTriggerBtn').addEventListener('click', showAddForm);
document.getElementById('saveBtn').addEventListener('click', saveTrigger);
document.getElementById('cancelBtn').addEventListener('click', hideAddForm);
document.getElementById('actionType').addEventListener('change', toggleActionFields);
document.getElementById('userType').addEventListener('change', toggleUserFields);
document.getElementById('globalToggle').addEventListener('change', toggleExtension);
document.getElementById('exportBtn').addEventListener('click', exportConfig);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', importConfig);

let triggers = [];
let editingIndex = -1;
let isEnabled = true;

function restoreOptions() {
    chrome.storage.local.get({ triggers: [], enabled: true }, (items) => {
        triggers = items.triggers;
        isEnabled = items.enabled;

        document.getElementById('globalToggle').checked = isEnabled;
        updateStatusText(isEnabled);
        renderTriggers();
    });
}

function updateStatusText(active) {
    const text = document.getElementById('statusText');
    text.textContent = active ? 'Active' : 'Disabled';
    text.style.color = active ? '#28a745' : '#dc3545';
}

function toggleExtension(e) {
    const active = e.target.checked;
    isEnabled = active;
    chrome.storage.local.set({ enabled: active });
    updateStatusText(active);
}

function exportConfig() {
    const exportData = {
        triggers: triggers.map(t => ({
            name: t.name,
            userType: t.userType || 'any',
            username: t.username || '',
            condition: t.condition || 'contains',
            keyword: t.keyword,
            // Map internal 'chat' to 'sendMessage' for compatibility if needed, 
            // or keep as is if we want to stick to internal schema. 
            // The user asked for "same structure as config.example.json".
            // config.example.json uses: "action": "sendMessage", "actionValue": "..."
            action: t.action === 'chat' ? 'sendMessage' : t.action,
            actionValue: t.action === 'chat' ? t.message : null,
            delay: t.delay || 0
        }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kick-bot-config.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (Array.isArray(data.triggers)) {
                // Map external generic keys back to internal keys
                triggers = data.triggers.map(t => ({
                    name: t.name || t.keyword,
                    userType: t.userType || 'any',
                    username: t.username || '',
                    condition: t.condition || 'contains',
                    keyword: t.keyword,
                    action: t.action === 'sendMessage' ? 'chat' : t.action,
                    message: t.action === 'sendMessage' ? t.actionValue : (t.message || ''), // Support both
                    delay: t.delay || 0
                }));

                chrome.storage.local.set({ triggers }, () => {
                    renderTriggers();
                    alert('Configuration imported successfully!');
                });
            } else {
                alert('Invalid configuration format: missing triggers array');
            }
        } catch (err) {
            alert('Error parsing JSON file');
            console.error(err);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
}

function renderTriggers() {
    const list = document.getElementById('triggersList');
    list.innerHTML = '';

    triggers.forEach((trigger, index) => {
        const item = document.createElement('div');
        item.className = 'trigger-item';

        const info = document.createElement('div');
        info.className = 'trigger-info';

        const name = document.createElement('div');
        name.className = 'trigger-keyword';
        name.textContent = trigger.name || trigger.keyword;

        const details = document.createElement('div');
        details.className = 'trigger-action';
        let actionDisplay = trigger.action;
        if (trigger.action === 'chat') actionDisplay = 'Send Chat';

        details.innerHTML = `
            ${trigger.condition === 'exact' ? '[Exact]' : '[Contains]'} "${trigger.keyword}"<br>
            Action: ${actionDisplay} ${trigger.delay > 0 ? `(${trigger.delay}ms)` : ''}
        `;

        info.appendChild(name);
        info.appendChild(details);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'X';
        deleteBtn.onclick = () => deleteTrigger(index);

        item.appendChild(info);
        item.appendChild(deleteBtn);
        list.appendChild(item);
    });
}

function showAddForm() {
    document.getElementById('editForm').classList.remove('hidden');
    document.getElementById('addTriggerBtn').classList.add('hidden');

    // Reset form
    document.getElementById('triggerName').value = '';
    document.getElementById('userType').value = 'any';
    document.getElementById('username').value = '';
    document.getElementById('conditionType').value = 'contains';
    document.getElementById('keyword').value = '';
    document.getElementById('actionType').value = 'notification';
    document.getElementById('chatMessage').value = '';
    document.getElementById('delay').value = '0';

    toggleActionFields();
    toggleUserFields();
    editingIndex = -1;
}

function hideAddForm() {
    document.getElementById('editForm').classList.add('hidden');
    document.getElementById('addTriggerBtn').classList.remove('hidden');
}

function toggleActionFields() {
    const action = document.getElementById('actionType').value;
    const chatGroup = document.getElementById('chatMessageGroup');
    if (action === 'chat') {
        chatGroup.classList.remove('hidden');
    } else {
        chatGroup.classList.add('hidden');
    }
}

function toggleUserFields() {
    const userType = document.getElementById('userType').value;
    const usernameGroup = document.getElementById('usernameGroup');
    if (userType === 'specific') {
        usernameGroup.classList.remove('hidden');
    } else {
        usernameGroup.classList.add('hidden');
    }
}

function saveTrigger() {
    const name = document.getElementById('triggerName').value.trim();
    const userType = document.getElementById('userType').value;
    const username = document.getElementById('username').value.trim();
    const condition = document.getElementById('conditionType').value;
    const keyword = document.getElementById('keyword').value.trim();
    const action = document.getElementById('actionType').value;
    const message = document.getElementById('chatMessage').value;
    const delay = parseInt(document.getElementById('delay').value) || 0;

    if (!keyword) {
        alert('Please enter a keyword');
        return;
    }

    if (userType === 'specific' && !username) {
        alert('Please enter a username');
        return;
    }

    if (action === 'chat' && !message) {
        alert('Please enter a chat message');
        return;
    }

    const newTrigger = {
        name: name || keyword,
        userType,
        username,
        condition,
        keyword,
        action,
        message: action === 'chat' ? message : null,
        delay
    };

    if (editingIndex > -1) {
        triggers[editingIndex] = newTrigger;
    } else {
        triggers.push(newTrigger);
    }

    chrome.storage.local.set({ triggers }, () => {
        renderTriggers();
        hideAddForm();
    });
}

function deleteTrigger(index) {
    if (confirm('Are you sure you want to delete this trigger?')) {
        triggers.splice(index, 1);
        chrome.storage.local.set({ triggers }, renderTriggers);
    }
}
