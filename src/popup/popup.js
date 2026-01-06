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
            action: t.action === 'chat' ? 'sendMessage' : t.action,
            actionValue: t.action === 'chat' ? t.message : null,
            delay: t.delay || 0,
            enabled: t.enabled !== false // Default to true
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
                triggers = data.triggers.map(t => ({
                    name: t.name || t.keyword,
                    userType: t.userType || 'any',
                    username: t.username || '',
                    condition: t.condition || 'contains',
                    keyword: t.keyword,
                    action: t.action === 'sendMessage' ? 'chat' : t.action,
                    message: t.action === 'sendMessage' ? t.actionValue : (t.message || ''),
                    delay: t.delay || 0,
                    enabled: t.enabled !== false
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
    e.target.value = '';
}

function renderTriggers() {
    const list = document.getElementById('triggersList');
    list.innerHTML = '';

    if (triggers.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">No triggers configured</div>';
        return;
    }

    triggers.forEach((trigger, index) => {
        const isActive = trigger.enabled !== false;

        const item = document.createElement('div');
        item.className = 'trigger-item' + (isActive ? '' : ' disabled');

        // Header with name and toggle
        const header = document.createElement('div');
        header.className = 'trigger-header';

        const name = document.createElement('span');
        name.className = 'trigger-name';
        name.textContent = trigger.name || trigger.keyword;

        const controls = document.createElement('div');
        controls.className = 'trigger-controls';

        // Mini toggle switch
        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'switch switch-mini';
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = isActive;
        toggleInput.onchange = () => toggleTrigger(index);
        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'slider round';
        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(toggleSlider);

        controls.appendChild(toggleLabel);
        header.appendChild(name);
        header.appendChild(controls);

        // Details
        const details = document.createElement('div');
        details.className = 'trigger-details';
        let actionDisplay = trigger.action;
        if (trigger.action === 'chat') actionDisplay = 'Send Chat';
        details.innerHTML = `
            ${trigger.condition === 'exact' ? '[Exact]' : '[Contains]'} "${trigger.keyword}"<br>
            Action: ${actionDisplay} ${trigger.delay > 0 ? `(+${trigger.delay}ms)` : ''}
        `;

        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'trigger-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '✏️ Edit';
        editBtn.onclick = () => editTrigger(index);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '🗑️ Delete';
        deleteBtn.onclick = () => deleteTrigger(index);

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(header);
        item.appendChild(details);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

function toggleTrigger(index) {
    triggers[index].enabled = !triggers[index].enabled;
    chrome.storage.local.set({ triggers }, renderTriggers);
}

function showAddForm() {
    document.getElementById('formTitle').textContent = 'Add Trigger';
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

function editTrigger(index) {
    const trigger = triggers[index];
    editingIndex = index;

    document.getElementById('formTitle').textContent = 'Edit Trigger';
    document.getElementById('editForm').classList.remove('hidden');
    document.getElementById('addTriggerBtn').classList.add('hidden');

    // Fill form with existing values
    document.getElementById('triggerName').value = trigger.name || '';
    document.getElementById('userType').value = trigger.userType || 'any';
    document.getElementById('username').value = trigger.username || '';
    document.getElementById('conditionType').value = trigger.condition || 'contains';
    document.getElementById('keyword').value = trigger.keyword || '';
    document.getElementById('actionType').value = trigger.action || 'notification';
    document.getElementById('chatMessage').value = trigger.message || '';
    document.getElementById('delay').value = trigger.delay || 0;

    toggleActionFields();
    toggleUserFields();
}

function hideAddForm() {
    document.getElementById('editForm').classList.add('hidden');
    document.getElementById('addTriggerBtn').classList.remove('hidden');
    editingIndex = -1;
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
        delay,
        enabled: editingIndex > -1 ? triggers[editingIndex].enabled : true
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
