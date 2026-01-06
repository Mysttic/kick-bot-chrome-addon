let triggers = [];
let isEnabled = true;
let chatObserver = null;

// Load triggers and status
chrome.storage.local.get({ triggers: [], enabled: true }, (items) => {
    triggers = items.triggers;
    isEnabled = items.enabled;
    if (isEnabled) {
        startObserving();
    }
});

// Listen for updates
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.triggers) {
            triggers = changes.triggers.newValue;
        }
        if (changes.enabled) {
            isEnabled = changes.enabled.newValue;
            if (isEnabled) {
                startObserving();
            } else {
                stopObserving();
            }
        }
    }
});

function stopObserving() {
    if (chatObserver) {
        chatObserver.disconnect();
        chatObserver = null;
        console.log('Kick Chat Monitor: Disabled/Stopped');
    }
}

function startObserving() {
    if (!isEnabled) return;
    if (chatObserver) {
        chatObserver.disconnect();
    }

    console.log('Kick Chat Monitor: Starting observer...');

    const chatContainer = document.querySelector('#chat-chatroom .flex.flex-col.overflow-y-auto') ||
        document.querySelector('.chat-container') ||
        document.body;

    chatObserver = new MutationObserver((mutations) => {
        if (!isEnabled) return;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    let chatEntry = node.classList?.contains('break-words') ? node : node.querySelector('.break-words');

                    if (chatEntry) {
                        const authorEl = chatEntry.querySelector('button.font-bold') || chatEntry.querySelector('.chat-entry-username');
                        let author = authorEl ? authorEl.textContent.trim() : 'Unknown';

                        let content = chatEntry.textContent || "";

                        const emotes = chatEntry.querySelectorAll('[data-emote-name]');
                        emotes.forEach(e => {
                            const name = e.getAttribute('data-emote-name');
                            if (name) content += " " + name;
                        });

                        const images = chatEntry.querySelectorAll('img');
                        images.forEach(img => {
                            if (img.alt) content += " " + img.alt;
                        });

                        content = content.replace(/\s+/g, ' ').trim();

                        if (content) {
                            processMessage(author, content);
                        }
                    }
                }
            }
        }
    });

    chatObserver.observe(chatContainer, { childList: true, subtree: true });

    setInterval(() => {
        if (!isEnabled) return;
        const currentContainer = document.querySelector('#chat-chatroom .flex.flex-col.overflow-y-auto');
        if (currentContainer && (!chatObserver || currentContainer !== chatContainer)) {
            startObserving();
        }
    }, 5000);
}

function processMessage(author, text) {
    if (!text || !isEnabled) return;

    triggers.forEach(trigger => {
        // Skip disabled triggers
        if (trigger.enabled === false) return;

        let match = false;

        // 1. Check User (if applicable)
        if (trigger.userType === 'specific' && trigger.username) {
            if (author.toLowerCase() !== trigger.username.toLowerCase()) {
                return;
            }
        }

        // 2. Check Content
        if (trigger.condition === 'exact') {
            if (text === trigger.keyword) {
                match = true;
            }
        } else {
            if (text.includes(trigger.keyword)) {
                match = true;
            }
        }

        if (match) {
            const execute = () => executeAction(trigger);
            if (trigger.delay > 0) {
                setTimeout(execute, trigger.delay);
            } else {
                execute();
            }
        }
    });
}

function executeAction(trigger) {
    if (!isEnabled) return;
    console.log('Executing action:', trigger.action);

    if (trigger.action === 'notification') {
        chrome.runtime.sendMessage({
            type: 'notification',
            title: 'Kick Chat Monitor',
            message: `Match found: ${trigger.name || trigger.keyword}`
        });
    } else if (trigger.action === 'sound') {
        playSound();
    } else if (trigger.action === 'chat') {
        sendChatMessage(trigger.message);
    }
}

function playSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.start();
    setTimeout(() => osc.stop(), 200);
}

function sendChatMessage(message) {
    const input = document.querySelector('#message-input .ProseMirror') || document.querySelector('[contenteditable="true"]');

    if (input) {
        input.focus();
        document.execCommand('insertText', false, message);

        const sendBtn = document.querySelector('button[type="submit"]') || document.querySelector('button[aria-label="Send message"]');
        if (sendBtn) {
            setTimeout(() => sendBtn.click(), 100);
        } else {
            const event = new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
                keyCode: 13
            });
            input.dispatchEvent(event);
        }
    } else {
        console.error('Chat input not found');
    }
}
