async function getAutoSuspendMinutes() {
    const res = await chrome.storage.sync.get(['autoSuspend']);
    return res.autoSuspend || 0;
}
let previousTabId = null;
async function setSuspendAlarm(tabId) {
    const minutes = await getAutoSuspendMinutes();
    if (minutes > 0) {
        chrome.alarms.create(`suspend_${tabId}`, { delayInMinutes: minutes });
    }
}
async function clearSuspendAlarm(tabId) {
    await chrome.alarms.clear(`suspend_${tabId}`);
}
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith('suspend_')) {
        const tabId = parseInt(alarm.name.replace('suspend_', ''), 10);
        if (!isNaN(tabId)) {
            try {
                const tab = await chrome.tabs.get(tabId);
                if (!tab.active && !tab.audible && !tab.discarded) {
                    await chrome.tabs.discard(tabId);
                }
            } catch (e) {
            }
        }
    }
});
async function initializeTabTracking() {
    const alarms = await chrome.alarms.getAll();
    for (const a of alarms) {
        if (a.name.startsWith('suspend_')) {
            await chrome.alarms.clear(a.name);
        }
    }
    const tabs = await chrome.tabs.query({});
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0 && previousTabId === null) {
        previousTabId = activeTabs[0].id;
    }
    const minutes = await getAutoSuspendMinutes();
    if (minutes > 0) {
        for (const tab of tabs) {
            if (!tab.active && !tab.discarded) {
                chrome.alarms.create(`suspend_${tab.id}`, { delayInMinutes: minutes });
            }
        }
    }
}
initializeTabTracking();
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    clearSuspendAlarm(activeInfo.tabId);
    if (previousTabId !== null && previousTabId !== activeInfo.tabId) {
        try {
            const prevTab = await chrome.tabs.get(previousTabId);
            if (!prevTab.active && !prevTab.discarded) {
                setSuspendAlarm(previousTabId);
            }
        } catch (e) {
        }
    }
    previousTabId = activeInfo.tabId;
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && !tab.active && !tab.discarded) {
        setSuspendAlarm(tabId);
    }
});
chrome.tabs.onRemoved.addListener((tabId) => {
    clearSuspendAlarm(tabId);
    if (previousTabId === tabId) {
        previousTabId = null;
    }
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.autoSuspend) {
        initializeTabTracking();
    }
});
