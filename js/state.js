// Google Classroom - State Management & API Engine

const DEFAULT_STATE = {
    activeAccountId: null,
    darkMode: false,
    sidebarCollapsed: false,
    currentCourseId: null,
    currentAssignmentId: null,
    activeCourseTab: 'stream',
    googleClientId: '650811325639-t1s3c1t3dbucgthvmn6clija5m8h8k07.apps.googleusercontent.com',
    serverUrl: (function() {
        if (typeof window !== 'undefined') {
            if (window.location.hostname.endsWith('github.io')) {
                return 'https://classroom-backend-h79h.onrender.com';
            }
            if (window.location.protocol.startsWith('http') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                return window.location.origin;
            }
        }
        return localStorage.getItem('google_classroom_server_url') || 'https://classroom-backend-h79h.onrender.com';
    })(),
    accounts: [],
    courses: [],
    announcements: [],
    assignments: [],
    lastUpdate: 0,
    userSettings: {
        master: true,
        commentsPost: true,
        commentsMention: true,
        commentsPrivate: true,
        studentAssignments: true,
        studentGrades: true,
        studentReminders: true,
        teacherSubmissions: true,
        teacherLate: true,
        teacherInvite: true,
        courseSpecific: {}
    },
    inAppNotifications: []
};

const STORAGE_KEY = 'google_classroom_master_v9';
let appState = (() => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        let parsed = stored ? JSON.parse(stored) : {};
        const state = Object.assign({}, DEFAULT_STATE, parsed);
        state.accounts = state.accounts || [];
        state.courses = state.courses || [];
        state.announcements = state.announcements || [];
        state.assignments = state.assignments || [];
        state.userSettings = Object.assign({}, DEFAULT_STATE.userSettings, state.userSettings || {});
        state.inAppNotifications = state.inAppNotifications || [];

        // Check explicit saved active account
        const savedActiveId = localStorage.getItem('google_classroom_active_account_id');
        if (savedActiveId && savedActiveId !== 'usr_guest') {
            state.activeAccountId = savedActiveId;
        }

        // Restore cached current user profile if available
        try {
            const cachedUser = JSON.parse(localStorage.getItem('google_classroom_current_user_profile') || 'null');
            if (cachedUser && cachedUser.id) {
                if (!state.accounts.some(a => a.id === cachedUser.id)) {
                    state.accounts.push(cachedUser);
                }
                if (!state.activeAccountId) {
                    state.activeAccountId = cachedUser.id;
                }
            }
        } catch (e) {}

        return state;
    } catch (e) {
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
})();

let isOnline = false;
let isSyncing = false;
let pendingPostAttachments = [];
let pendingStudentAttachments = [];
let selectedSettingsBannerImg = '';
let selectedSettingsBannerGrad = '';
let selectedBannerImg = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80';
let selectedBannerGrad = 'from-blue-600 to-indigo-700';
let selectedRegColor = 'from-blue-600 to-indigo-600';
let selectedEditColor = 'from-blue-600 to-indigo-600';

function getApiBase() {
    const saved = localStorage.getItem('google_classroom_server_url');
    if (saved) return saved;

    if (typeof window !== 'undefined') {
        if (window.location.hostname.endsWith('github.io')) {
            return 'https://classroom-backend-h79h.onrender.com';
        }
        if (window.location.protocol.startsWith('http') && !window.location.hostname.endsWith('github.io')) {
            return window.location.origin;
        }
    }
    return appState.serverUrl || 'https://classroom-backend-h79h.onrender.com';
}

function persistState() {
    try {
        const lightweight = {
            activeAccountId: appState.activeAccountId,
            darkMode: appState.darkMode,
            sidebarCollapsed: appState.sidebarCollapsed,
            serverUrl: appState.serverUrl,
            userSettings: appState.userSettings,
            accounts: (appState.accounts || []).slice(0, 50),
            inAppNotifications: (appState.inAppNotifications || []).slice(0, 30)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
        localStorage.setItem('google_classroom_server_url', appState.serverUrl);
        if (appState.activeAccountId && appState.activeAccountId !== 'usr_guest') {
            localStorage.setItem('google_classroom_active_account_id', appState.activeAccountId);
            const currentUser = (appState.accounts || []).find(a => a.id === appState.activeAccountId);
            if (currentUser) {
                localStorage.setItem('google_classroom_current_user_profile', JSON.stringify(currentUser));
            }
        } else if (appState.activeAccountId === 'usr_guest') {
            localStorage.setItem('google_classroom_active_account_id', 'usr_guest');
            localStorage.removeItem('google_classroom_current_user_profile');
        }
    } catch (e) {
        console.warn('Storage quota note', e);
    }
}

function updateServerBadge(online, serverInfo = null) {
    isOnline = online;
    const dot = document.getElementById('server-status-dot');
    const label = document.getElementById('server-status-label');
    const badge = document.getElementById('btn-server-status');

    if (dot && label && badge) {
        if (online) {
            dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
            badge.className = 'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 hover:opacity-90';
            const ipText = (serverInfo && serverInfo.localIps && serverInfo.localIps[0]) ? serverInfo.localIps[0] : 'Онлайн';
            label.textContent = `Общая сеть (${ipText})`;
        } else {
            dot.className = 'w-2 h-2 rounded-full bg-amber-500';
            badge.className = 'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800 hover:opacity-90';
            label.textContent = 'Локально';
        }
    }
}

async function syncWithServer(showFeedback = false) {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${getApiBase()}/api/data`, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const serverDb = await res.json();
            
            const serverAccounts = serverDb.accounts || [];
            const mergedAccounts = [...serverAccounts];
            
            // Merge existing local accounts into server accounts list so we never lose current user
            (appState.accounts || []).forEach(localAcc => {
                if (localAcc && localAcc.id && !mergedAccounts.some(sa => sa.id === localAcc.id || (sa.email && localAcc.email && sa.email.toLowerCase() === localAcc.email.toLowerCase()))) {
                    mergedAccounts.push(localAcc);
                    // Silently register missing local account on backend
                    sendServerAction('/api/accounts/register', localAcc).catch(() => {});
                }
            });

            appState.accounts = mergedAccounts;
            appState.courses = serverDb.courses || [];
            appState.announcements = serverDb.announcements || [];
            appState.assignments = serverDb.assignments || [];
            appState.lastUpdate = serverDb.lastUpdate || Date.now();

            const savedActiveId = localStorage.getItem('google_classroom_active_account_id');
            if (savedActiveId && savedActiveId !== 'usr_guest') {
                if (appState.accounts.some(a => a.id === savedActiveId)) {
                    appState.activeAccountId = savedActiveId;
                } else {
                    // Try to restore from cached profile
                    try {
                        const cachedProfile = JSON.parse(localStorage.getItem('google_classroom_current_user_profile') || 'null');
                        if (cachedProfile && cachedProfile.id === savedActiveId) {
                            appState.accounts.push(cachedProfile);
                            appState.activeAccountId = savedActiveId;
                            sendServerAction('/api/accounts/register', cachedProfile).catch(() => {});
                        }
                    } catch (e) {}
                }
            } else if (savedActiveId === 'usr_guest') {
                appState.activeAccountId = null;
            }

            persistState();
            updateServerBadge(true);
            const isUserInteracting = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
            if (typeof renderAllViews === 'function' && !isUserInteracting) {
                renderAllViews();
            }
            if (showFeedback && typeof triggerToast === 'function') triggerToast('База данных синхронизирована!');
        } else {
            updateServerBadge(false);
            if (showFeedback && typeof triggerToast === 'function') triggerToast('Сервер вернул ошибку', true);
        }
    } catch (err) {
        updateServerBadge(false);
        if (showFeedback && typeof triggerToast === 'function') triggerToast('Сервер недоступен. Запустите start_server.bat', true);
    } finally {
        isSyncing = false;
    }
}

async function sendServerAction(endpoint, payload) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${getApiBase()}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await res.json();
        if (res.ok && result.success) {
            if (result.data) {
                appState.accounts = result.data.accounts || appState.accounts;
                appState.courses = result.data.courses || appState.courses;
                appState.announcements = result.data.announcements || appState.announcements;
                appState.assignments = result.data.assignments || appState.assignments;
                appState.lastUpdate = result.data.lastUpdate || Date.now();
                persistState();
                const isUserInteracting = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
                if (typeof renderAllViews === 'function' && !isUserInteracting) {
                    renderAllViews();
                }
            }
            return { success: true, data: result };
        } else {
            return { success: false, error: result.error || 'Ошибка запроса' };
        }
    } catch (err) {
        return { success: false, error: 'Сервер недоступен (работаем локально)' };
    }
}

// Live polling every 15s (does not interrupt active typing)
setInterval(() => {
    if (typeof document !== 'undefined' && !document.hidden) {
        const isUserInteracting = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        if (!isUserInteracting) {
            syncWithServer(false);
        }
    }
}, 15000);

function compressImage(file, maxWidth, maxHeight, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            return reject(new Error('Файл не является изображением'));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('Ошибка чтения изображения'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsDataURL(file);
    });
}
