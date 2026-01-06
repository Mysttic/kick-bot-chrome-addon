chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'notification') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: request.title || 'Kick Chat Monitor',
            message: request.message || 'Trigger matched!'
        });
    }
});
