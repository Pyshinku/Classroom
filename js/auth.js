// Google Classroom - Official Google OAuth 2.0, Identity Services & User Engine

// Official Google OAuth 2.0 Client ID Configuration
const OFFICIAL_GOOGLE_CLIENT_ID = '650811325639-t1s3c1t3dbucgthvmn6clija5m8h8k07.apps.googleusercontent.com';

function getGoogleClientId() {
    return localStorage.getItem('google_classroom_oauth_client_id') || (typeof appState !== 'undefined' && appState.googleClientId) || OFFICIAL_GOOGLE_CLIENT_ID;
}

function setGoogleClientId(id) {
    id = (id || '').trim();
    localStorage.setItem('google_classroom_oauth_client_id', id);
    if (typeof appState !== 'undefined') appState.googleClientId = id;
}

// User State Checks
function isGuestUser() {
    return !appState.activeAccountId || appState.activeAccountId === 'usr_guest';
}

function getCurrentUser() {
    if (isGuestUser()) {
        return {
            id: 'usr_guest',
            name: 'Гость',
            email: '',
            role: 'guest',
            avatar: 'Г',
            bg: 'from-gray-500 to-slate-600',
            photoUrl: ''
        };
    }
    const found = (appState.accounts || []).find(a => a.id === appState.activeAccountId);
    if (found) return found;

    // Try reading cached profile
    try {
        const cached = JSON.parse(localStorage.getItem('google_classroom_current_user_profile') || 'null');
        if (cached && (cached.id === appState.activeAccountId || !appState.activeAccountId)) {
            if (!appState.accounts) appState.accounts = [];
            if (!appState.accounts.some(a => a.id === cached.id)) {
                appState.accounts.push(cached);
            }
            appState.activeAccountId = cached.id;
            return cached;
        }
    } catch (e) {}

    return {
        id: 'usr_guest',
        name: 'Гость',
        email: '',
        role: 'guest',
        avatar: 'Г',
        bg: 'from-gray-500 to-slate-600',
        photoUrl: ''
    };
}

function enableGuestMode() {
    appState.activeAccountId = 'usr_guest';
    localStorage.setItem('google_classroom_active_account_id', 'usr_guest');
    localStorage.removeItem('google_classroom_current_user_profile');
    persistState();
    
    // Close user popover if open
    const popUser = document.getElementById('popover-user');
    if (popUser) popUser.classList.add('hidden');

    syncUserInterface();
    if (typeof renderAllViews === 'function') renderAllViews();
    window.navigateTo('dashboard');
    triggerToast('Включен гостевой режим');
}

function syncUserInterface() {
    const user = getCurrentUser();
    const isGuest = isGuestUser();

    const btnAvatar = document.getElementById('btn-user-avatar');
    const btnRegister = document.getElementById('btn-header-register');
    const guestBadge = document.getElementById('header-guest-badge');
    const navTodo = document.getElementById('nav-btn-todo');
    const btnPlus = document.getElementById('btn-plus-menu');
    const dashGuestBanner = document.getElementById('dash-guest-banner');
    const dashActionsBox = document.getElementById('dash-quick-actions-box');

    if (isGuest) {
        // GUEST MODE RESTRICTIONS
        if (btnAvatar) btnAvatar.classList.add('hidden');
        if (btnRegister) btnRegister.classList.remove('hidden');
        if (guestBadge) guestBadge.classList.remove('hidden');
        
        // Hide "Список задач" button in guest mode
        if (navTodo) navTodo.classList.add('hidden');
        
        // Hide Create/Join plus menu
        if (btnPlus) btnPlus.classList.add('hidden');
        
        // Hide dashboard create/join buttons, show guest banner
        if (dashActionsBox) dashActionsBox.classList.add('hidden');
        if (dashGuestBanner) dashGuestBanner.classList.remove('hidden');

        // Hide teacher tabs
        const gradesTab = document.getElementById('tab-btn-grades');
        const createAssignBtn = document.getElementById('btn-trigger-create-assignment');
        if (gradesTab) gradesTab.classList.add('hidden');
        if (createAssignBtn) createAssignBtn.classList.add('hidden');

    } else {
        // LOGGED-IN USER INTERFACE
        if (btnAvatar) btnAvatar.classList.remove('hidden');
        if (btnRegister) btnRegister.classList.add('hidden');
        if (guestBadge) guestBadge.classList.add('hidden');
        
        // Show Todo
        if (navTodo) navTodo.classList.remove('hidden');
        if (btnPlus) btnPlus.classList.remove('hidden');

        if (dashActionsBox) dashActionsBox.classList.remove('hidden');
        if (dashGuestBanner) dashGuestBanner.classList.add('hidden');

        // Render Avatar
        if (user.photoUrl) {
            btnAvatar.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white font-bold flex items-center justify-center text-xs shadow ring-2 ring-transparent hover:ring-google-blue/40 transition overflow-hidden bg-gray-200 dark:bg-gray-700';
            btnAvatar.innerHTML = `<img src="${user.photoUrl}" alt="${user.name}" class="w-full h-full object-cover">`;
        } else {
            btnAvatar.className = `w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white font-bold flex items-center justify-center text-xs shadow ring-2 ring-transparent hover:ring-google-blue/40 transition overflow-hidden bg-gradient-to-tr ${user.bg || 'from-blue-600 to-indigo-600'}`;
            btnAvatar.innerHTML = `<span id="header-avatar-initials">${user.avatar || 'П'}</span>`;
        }

        // Render Popover Profile Card
        const menuBadge = document.getElementById('menu-avatar-badge');
        if (menuBadge) {
            if (user.photoUrl) {
                menuBadge.className = 'w-16 h-16 rounded-full text-white text-xl font-bold flex items-center justify-center shadow-lg ring-4 ring-blue-100 dark:ring-blue-900/40 overflow-hidden bg-gray-200 dark:bg-gray-700';
                menuBadge.innerHTML = `<img src="${user.photoUrl}" alt="${user.name}" class="w-full h-full object-cover">`;
            } else {
                menuBadge.className = `w-16 h-16 rounded-full text-white text-xl font-bold flex items-center justify-center shadow-lg ring-4 ring-blue-100 dark:ring-blue-900/40 bg-gradient-to-tr ${user.bg || 'from-blue-600 to-indigo-600'}`;
                menuBadge.innerHTML = user.avatar || 'П';
            }
        }

        const menuName = document.getElementById('menu-user-name');
        if (menuName) menuName.textContent = user.name;
        const menuEmail = document.getElementById('menu-user-email');
        if (menuEmail) menuEmail.textContent = user.email;

        // Role badge
        const isTeacher = user.role === 'teacher';
        const roleBadge = document.getElementById('menu-user-role-badge');
        if (roleBadge) {
            roleBadge.textContent = isTeacher ? 'Преподаватель' : 'Студент';
            roleBadge.className = isTeacher 
                ? 'px-3 py-0.5 text-[11px] font-semibold rounded-full bg-blue-100 dark:bg-blue-950 text-google-blue dark:text-blue-300'
                : 'px-3 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950 text-google-green dark:text-emerald-300';
        }

        // Announcement avatar
        const annAvatar = document.getElementById('announcement-user-avatar');
        if (annAvatar) {
            if (user.photoUrl) {
                annAvatar.className = 'w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700';
                annAvatar.innerHTML = `<img src="${user.photoUrl}" alt="${user.name}" class="w-full h-full object-cover">`;
            } else {
                annAvatar.className = `w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0 bg-gradient-to-tr ${user.bg || 'from-blue-600 to-indigo-600'}`;
                annAvatar.innerHTML = user.avatar || 'П';
            }
        }

        // Teacher controls
        const gradesTab = document.getElementById('tab-btn-grades');
        const gradesMobileTab = document.getElementById('tab-btn-grades-mobile');
        const createAssignBtn = document.getElementById('btn-trigger-create-assignment');
        const changeThemeBtn = document.getElementById('btn-change-course-theme');

        if (gradesTab) gradesTab.classList.toggle('hidden', !isTeacher);
        if (gradesMobileTab) gradesMobileTab.classList.toggle('hidden', !isTeacher);
        if (createAssignBtn) createAssignBtn.classList.toggle('hidden', !isTeacher);
        if (changeThemeBtn) changeThemeBtn.classList.toggle('hidden', !isTeacher);

        // Populate accounts switcher list in Popover
        const switchList = document.getElementById('menu-accounts-list');
        if (switchList) {
            const otherAccounts = (appState.accounts || []).filter(acc => acc.id !== user.id);
            if (otherAccounts.length > 0) {
                switchList.innerHTML = otherAccounts.map(acc => {
                    const avatarHtml = acc.photoUrl 
                        ? `<img src="${acc.photoUrl}" class="w-8 h-8 rounded-full object-cover shrink-0 shadow-sm">`
                        : `<div class="w-8 h-8 rounded-full bg-gradient-to-tr ${acc.bg || 'from-blue-600 to-indigo-600'} text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">${acc.avatar || 'П'}</div>`;
                    return `
                    <button type="button" onclick="switchActiveAccount('${acc.id}')" class="w-full p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center space-x-3 transition text-left group">
                        ${avatarHtml}
                        <div class="truncate flex-1">
                            <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 group-hover:text-google-blue dark:group-hover:text-google-blueDarkTheme">${acc.name}</p>
                            <p class="text-[11px] text-google-gray dark:text-gray-400 truncate">${acc.email} • ${acc.role === 'teacher' ? 'Преподаватель' : 'Студент'}</p>
                        </div>
                    </button>
                    `;
                }).join('');
            } else {
                switchList.innerHTML = '<p class="text-[11px] text-google-gray p-2 text-center italic">Нет других сохраненных аккаунтов</p>';
            }
        }
    }
}

window.switchActiveAccount = function(accId) {
    appState.activeAccountId = accId;
    persistState();
    syncUserInterface();
    const pop = document.getElementById('popover-user');
    if (pop) pop.classList.add('hidden');
    if (typeof renderAllViews === 'function') renderAllViews();
    const user = getCurrentUser();
    triggerToast(`Переключено на: ${user.name}`);
};

// =========================================================================
// REAL OFFICIAL GOOGLE OAUTH 2.0 INTEGRATION
// =========================================================================

// Trigger Official Google Sign-In redirect to accounts.google.com
window.triggerGoogleSignIn = function() {
    const clientId = getGoogleClientId();
    if (!clientId) {
        showGoogleSetupModal();
        return;
    }

    // Build authentic Google OAuth 2.0 endpoint
    let redirectUri = window.location.origin + window.location.pathname;
    if (!redirectUri.endsWith('/') && !redirectUri.endsWith('.html')) {
        redirectUri += '/';
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: 'email profile openid',
        prompt: 'select_account'
    });

    // Navigate directly to OFFICIAL Google Account Chooser
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

// Listen for OAuth 2.0 redirect callback with access_token in URL hash
window.checkOAuthCallback = async function() {
    if (window.location.hash && window.location.hash.includes('access_token=')) {
        try {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            if (accessToken) {
                // Clear hash from URL immediately without reload
                history.replaceState(null, '', window.location.pathname + window.location.search);
                triggerToast('Авторизация через Google...', false);

                // Fetch verified profile from official Google UserInfo endpoint
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (res.ok) {
                    const profile = await res.json();
                    await handleAuthenticGoogleLogin(profile);
                } else {
                    triggerToast('Не удалось получить данные аккаунта Google', true);
                }
            }
        } catch (err) {
            console.error('OAuth callback error', err);
            triggerToast('Ошибка обработки входа Google', true);
        }
    }
};

// Process authentic verified profile from Google
window.handleAuthenticGoogleLogin = async function(profile) {
    const email = (profile.email || '').trim().toLowerCase();
    const name = profile.name || email.split('@')[0] || 'Пользователь Google';
    const photoUrl = profile.picture || '';

    let acc = (appState.accounts || []).find(a => a.email && a.email.toLowerCase() === email);
    if (!acc) {
        const newAcc = {
            id: 'usr_g_' + (profile.sub || Date.now()),
            name: name,
            email: email,
            role: 'student',
            avatar: name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || 'ГЛ',
            bg: 'from-blue-600 to-indigo-600',
            photoUrl: photoUrl,
            banner: '',
            googleSub: profile.sub || ''
        };
        if (!appState.accounts) appState.accounts = [];
        appState.accounts.push(newAcc);
        appState.activeAccountId = newAcc.id;
        persistState();
        syncUserInterface();
        if (typeof renderAllViews === 'function') renderAllViews();
        window.navigateTo('dashboard');
        triggerToast(`Вход через Google: ${name}`);

        try {
            await sendServerAction('/api/accounts/register', newAcc);
        } catch (e) {
            console.warn('Account sync note', e);
        }
    } else {
        acc.name = name;
        if (photoUrl) acc.photoUrl = photoUrl;
        appState.activeAccountId = acc.id;
        persistState();
        syncUserInterface();
        if (typeof renderAllViews === 'function') renderAllViews();
        window.navigateTo('dashboard');
        triggerToast(`С возвращением, ${name}!`);

        try {
            await sendServerAction('/api/accounts/update', acc);
        } catch (e) {
            console.warn('Account sync note', e);
        }
    }
};

// Google OAuth Setup Modal
window.showGoogleSetupModal = function() {
    const modal = document.getElementById('modal-google-oauth-setup');
    if (modal) {
        modal.classList.remove('hidden');
        const input = document.getElementById('input-google-client-id');
        if (input) input.value = getGoogleClientId();
    }
};

window.closeGoogleSetupModal = function() {
    const modal = document.getElementById('modal-google-oauth-setup');
    if (modal) modal.classList.add('hidden');
};

window.saveGoogleClientIdAndLogin = function() {
    const input = document.getElementById('input-google-client-id');
    const val = (input ? input.value : '').trim();
    if (!val) {
        triggerToast('Укажите Google OAuth Client ID', true);
        return;
    }
    setGoogleClientId(val);
    closeGoogleSetupModal();
    triggerToast('Client ID сохранен! Переход на страницу Google...');
    setTimeout(() => {
        triggerGoogleSignIn();
    }, 400);
};

// =========================================================================
// STANDARD EMAIL / PASSWORD AUTH MODAL
// =========================================================================

function openAuthModal(tab = 'login') {
    const modal = document.getElementById('modal-auth');
    if (modal) {
        modal.classList.remove('hidden');
        renderFastAccountsList();
    }
    switchAuthTab(tab);
}

function switchAuthTab(tab) {
    const loginSec = document.getElementById('auth-view-login');
    const regSec = document.getElementById('auth-view-register');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabReg = document.getElementById('auth-tab-register');

    if (tab === 'login') {
        if (loginSec) loginSec.classList.remove('hidden');
        if (regSec) regSec.classList.add('hidden');
        if (tabLogin) tabLogin.className = 'flex-1 py-2 text-center text-google-blue border-b-2 border-google-blue transition';
        if (tabReg) tabReg.className = 'flex-1 py-2 text-center text-google-gray hover:text-google-text transition';
    } else {
        if (loginSec) loginSec.classList.add('hidden');
        if (regSec) regSec.classList.remove('hidden');
        if (tabLogin) tabLogin.className = 'flex-1 py-2 text-center text-google-gray hover:text-google-text transition';
        if (tabReg) tabReg.className = 'flex-1 py-2 text-center text-google-blue border-b-2 border-google-blue transition';
    }
}

function renderFastAccountsList() {
    const list = document.getElementById('auth-fast-accounts-list');
    if (!list) return;

    const accounts = appState.accounts || [];
    if (accounts.length === 0) {
        list.innerHTML = '<p class="text-gray-400 italic text-center py-2 text-[11px]">В базе пока нет пользователей</p>';
        return;
    }

    list.innerHTML = accounts.map(acc => {
        const avatarHtml = acc.photoUrl 
            ? `<img src="${acc.photoUrl}" class="w-7 h-7 rounded-full object-cover shrink-0">`
            : `<div class="w-7 h-7 rounded-full bg-gradient-to-tr ${acc.bg || 'from-blue-600 to-indigo-600'} text-white text-[10px] font-bold flex items-center justify-center shrink-0">${acc.avatar || 'П'}</div>`;
        return `
        <button type="button" onclick="selectFastAccount('${acc.id}')" class="w-full p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-google-border dark:border-google-darkBorder flex items-center space-x-2.5 transition text-left group">
            ${avatarHtml}
            <div class="truncate flex-1">
                <p class="font-medium text-xs text-gray-900 dark:text-gray-100">${acc.name}</p>
                <p class="text-[10px] text-google-gray dark:text-gray-400 truncate">${acc.email || 'без email'} • ${acc.role === 'teacher' ? 'Преподаватель' : 'Студент'}</p>
            </div>
            <i class="fa-solid fa-arrow-right-to-bracket text-google-blue text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
        </button>
        `;
    }).join('');
}

window.selectFastAccount = function(accId) {
    const acc = (appState.accounts || []).find(a => a.id === accId);
    if (!acc) return;
    appState.activeAccountId = acc.id;
    persistState();
    syncUserInterface();
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('hidden');
    if (typeof renderAllViews === 'function') renderAllViews();
    window.navigateTo('dashboard');
    triggerToast(`Вход выполнен: ${acc.name}`);
};

window.submitManualLogin = async function() {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const email = (emailInput ? emailInput.value : '').trim().toLowerCase();
    const password = (passInput ? passInput.value : '').trim();

    if (!email) {
        triggerToast('Введите email для входа', true);
        return;
    }

    const acc = (appState.accounts || []).find(a => a.email && a.email.toLowerCase() === email);
    if (!acc) {
        triggerToast('Пользователь с таким email не найден', true);
        return;
    }

    if (acc.password && password && acc.password !== password) {
        triggerToast('Неверный пароль', true);
        return;
    }

    appState.activeAccountId = acc.id;
    persistState();
    syncUserInterface();
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('hidden');
    if (typeof renderAllViews === 'function') renderAllViews();
    window.navigateTo('dashboard');
    triggerToast(`Вход выполнен: ${acc.name}`);
};

window.selectedRegBg = 'from-blue-600 to-indigo-600';

window.submitManualRegister = async function() {
    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const passInput = document.getElementById('reg-password');
    const roleSelect = document.getElementById('reg-role');

    const name = (nameInput ? nameInput.value : '').trim();
    const email = (emailInput ? emailInput.value : '').trim().toLowerCase();
    const password = (passInput ? passInput.value : '').trim() || '123';
    const role = (roleSelect ? roleSelect.value : 'student') || 'student';

    if (!name) {
        triggerToast('Укажите ваше имя (ФИО)', true);
        return;
    }
    if (!email) {
        triggerToast('Укажите email адрес', true);
        return;
    }

    const existing = (appState.accounts || []).find(a => a.email && a.email.toLowerCase() === email);
    if (existing) {
        triggerToast('Пользователь с таким email уже зарегистрирован', true);
        return;
    }

    const newAcc = {
        id: 'usr_' + Date.now(),
        name,
        email,
        password,
        role,
        avatar: name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || 'ПЛ',
        bg: window.selectedRegBg || 'from-blue-600 to-indigo-600',
        photoUrl: '',
        banner: ''
    };

    if (!appState.accounts) appState.accounts = [];
    appState.accounts.push(newAcc);
    appState.activeAccountId = newAcc.id;
    persistState();
    syncUserInterface();

    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('hidden');
    if (typeof renderAllViews === 'function') renderAllViews();
    window.navigateTo('dashboard');
    triggerToast(`Аккаунт ${name} успешно создан!`);

    try {
        await sendServerAction('/api/accounts/register', newAcc);
    } catch (e) {
        console.warn('Account sync note', e);
    }
};

// Profile settings view
function initProfileSettingsView() {
    const user = getCurrentUser();
    const nameInput = document.getElementById('profile-settings-name');
    const emailInput = document.getElementById('profile-settings-email');
    const roleSelect = document.getElementById('profile-settings-role');

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (roleSelect) roleSelect.value = user.role || 'student';
}
