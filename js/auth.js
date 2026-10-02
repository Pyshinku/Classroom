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
    const navCalendar = document.getElementById('nav-btn-calendar');
    const navTodo = document.getElementById('nav-btn-todo');
    const btnPlus = document.getElementById('btn-plus-menu');
    const dashGuestBanner = document.getElementById('dash-guest-banner');
    const dashActionsBox = document.getElementById('dash-quick-actions-box');

    if (isGuest) {
        // GUEST MODE RESTRICTIONS
        if (btnAvatar) btnAvatar.classList.add('hidden');
        if (btnRegister) btnRegister.classList.remove('hidden');
        
        // Hide "Календарь" and "Список задач" buttons in guest mode
        if (navCalendar) navCalendar.classList.add('hidden');
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
        
        // Show Calendar and Todo
        if (navCalendar) navCalendar.classList.remove('hidden');
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

        // Settings View Profile Card Summary
        const setAvatar = document.getElementById('settings-user-avatar');
        if (setAvatar) {
            if (user.photoUrl) {
                setAvatar.className = 'w-16 h-16 rounded-full text-white text-xl font-bold flex items-center justify-center shadow overflow-hidden bg-gray-200 dark:bg-gray-700';
                setAvatar.innerHTML = `<img src="${user.photoUrl}" alt="${user.name}" class="w-full h-full object-cover">`;
            } else {
                setAvatar.className = `w-16 h-16 rounded-full text-white text-xl font-bold flex items-center justify-center shadow overflow-hidden bg-gradient-to-tr ${user.bg || 'from-blue-600 to-indigo-600'}`;
                setAvatar.innerHTML = user.avatar || 'П';
            }
        }
        const setName = document.getElementById('settings-user-name');
        if (setName) setName.textContent = user.name;
        const setEmail = document.getElementById('settings-user-email');
        if (setEmail) setEmail.textContent = user.email;
        const setRole = document.getElementById('settings-user-role');
        if (setRole) {
            setRole.textContent = isTeacher ? 'Преподаватель' : 'Студент';
            setRole.className = isTeacher
                ? 'inline-block mt-1.5 px-3 py-0.5 text-[11px] font-semibold rounded-full bg-blue-100 dark:bg-blue-950 text-google-blue dark:text-blue-300'
                : 'inline-block mt-1.5 px-3 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950 text-google-green dark:text-emerald-300';
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
    if (typeof syncDevBetaUI === 'function') {
        syncDevBetaUI();
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

// Profile settings view & Customization Engine
function initProfileSettingsView() {
    const user = getCurrentUser();
    if (isGuestUser()) {
        triggerToast('Для настройки профиля войдите через Google.', true);
        triggerGoogleSignIn();
        return;
    }

    // Populate inputs
    const nameInput = document.getElementById('full-profile-input-name');
    const emailInput = document.getElementById('full-profile-input-email');
    const roleSelect = document.getElementById('full-profile-select-role');
    const charInput = document.getElementById('full-profile-avatar-char');
    const photoUrlInput = document.getElementById('full-profile-photo-url');
    const bannerUrlInput = document.getElementById('full-profile-banner-url');

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) {
        emailInput.value = user.email || '';
        emailInput.disabled = true; // Email bound to Google
    }
    if (roleSelect) roleSelect.value = user.role || 'student';
    if (charInput) charInput.value = user.avatar || 'ИС';
    if (photoUrlInput) photoUrlInput.value = user.photoUrl || '';
    if (bannerUrlInput) bannerUrlInput.value = user.banner || '';

    // Temp state for editing
    window.editingProfileState = {
        name: user.name || '',
        role: user.role || 'student',
        avatar: user.avatar || 'ИС',
        bg: user.bg || 'from-blue-600 to-indigo-600',
        photoUrl: user.photoUrl || '',
        banner: user.banner || ''
    };

    updateLiveProfilePreview();

    // Setup color gradients
    const colorsGrid = document.getElementById('full-profile-colors-grid');
    if (colorsGrid) {
        const gradients = [
            { name: 'Синий', grad: 'from-blue-600 to-indigo-600' },
            { name: 'Изумруд', grad: 'from-emerald-500 to-teal-600' },
            { name: 'Фиолетовый', grad: 'from-purple-600 to-pink-600' },
            { name: 'Янтарь', grad: 'from-amber-500 to-orange-600' },
            { name: 'Розовый', grad: 'from-rose-500 to-red-600' },
            { name: 'Тёмный', grad: 'from-slate-700 to-gray-900' }
        ];
        colorsGrid.innerHTML = gradients.map(g => `
            <button type="button" data-grad="${g.grad}" class="profile-color-picker-btn w-9 h-9 rounded-2xl bg-gradient-to-tr ${g.grad} shadow hover:scale-110 active:scale-95 transition ${window.editingProfileState.bg === g.grad ? 'ring-2 ring-offset-2 ring-google-blue' : ''}" title="${g.name}"></button>
        `).join('');

        colorsGrid.querySelectorAll('.profile-color-picker-btn').forEach(btn => {
            btn.onclick = () => {
                window.editingProfileState.bg = btn.dataset.grad;
                window.editingProfileState.photoUrl = '';
                if (photoUrlInput) photoUrlInput.value = '';
                colorsGrid.querySelectorAll('.profile-color-picker-btn').forEach(b => b.classList.remove('ring-2', 'ring-offset-2', 'ring-google-blue'));
                btn.classList.add('ring-2', 'ring-offset-2', 'ring-google-blue');
                updateLiveProfilePreview();
            };
        });
    }

    // Quick emoji stickers
    const emojiGrid = document.getElementById('full-profile-emoji-grid');
    if (emojiGrid) {
        const emojis = ['🎓', '📚', '💻', '🚀', '⭐', '🔥', '🎨', '⚡'];
        emojiGrid.innerHTML = emojis.map(em => `
            <button type="button" class="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm flex items-center justify-center transition active:scale-90">${em}</button>
        `).join('');
        emojiGrid.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                if (charInput) charInput.value = btn.textContent;
                window.editingProfileState.avatar = btn.textContent;
                window.editingProfileState.photoUrl = '';
                if (photoUrlInput) photoUrlInput.value = '';
                updateLiveProfilePreview();
            };
        });
    }

    // Input listeners
    if (nameInput) {
        nameInput.oninput = () => {
            window.editingProfileState.name = nameInput.value.trim() || user.name;
            updateLiveProfilePreview();
        };
    }
    if (roleSelect) {
        roleSelect.onchange = () => {
            window.editingProfileState.role = roleSelect.value;
            updateLiveProfilePreview();
        };
    }
    if (charInput) {
        charInput.oninput = () => {
            window.editingProfileState.avatar = charInput.value.trim().substring(0, 4) || 'ИС';
            window.editingProfileState.photoUrl = '';
            updateLiveProfilePreview();
        };
    }

    // Photo URL apply
    const btnApplyPhoto = document.getElementById('btn-apply-avatar-url');
    if (btnApplyPhoto && photoUrlInput) {
        btnApplyPhoto.onclick = () => {
            const val = photoUrlInput.value.trim();
            if (val) {
                window.editingProfileState.photoUrl = val;
                updateLiveProfilePreview();
                triggerToast('Ссылка на фото применена');
            }
        };
    }

    // Reset avatar photo
    const btnResetPhoto = document.getElementById('btn-reset-avatar-photo');
    if (btnResetPhoto) {
        btnResetPhoto.onclick = () => {
            window.editingProfileState.photoUrl = '';
            if (photoUrlInput) photoUrlInput.value = '';
            updateLiveProfilePreview();
            triggerToast('Фото сброшено, используется цветной аватар');
        };
    }

    // Avatar file upload
    const avatarFileInput = document.getElementById('full-profile-avatar-file');
    if (avatarFileInput) {
        avatarFileInput.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    window.editingProfileState.photoUrl = ev.target.result;
                    if (photoUrlInput) photoUrlInput.value = '';
                    updateLiveProfilePreview();
                    triggerToast('Фото успешно загружено');
                };
                reader.readAsDataURL(file);
            }
        };
    }

    // Banner presets
    const bannerPresets = document.getElementById('full-profile-banner-presets');
    if (bannerPresets) {
        const presets = [
            { title: 'IT & Код', img: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80' },
            { title: 'Наука & Лаб', img: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200&q=80' },
            { title: 'Литература', img: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&q=80' },
            { title: 'Искусство', img: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80' },
            { title: 'Математика', img: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&q=80' },
            { title: 'Градиент', img: '' }
        ];
        bannerPresets.innerHTML = presets.map(p => `
            <div data-img="${p.img}" class="profile-banner-preset-item h-16 rounded-2xl bg-cover bg-center cursor-pointer border-2 border-transparent hover:border-google-blue relative overflow-hidden transition ${window.editingProfileState.banner === p.img ? 'border-google-blue ring-2 ring-google-blue' : ''}" style="${p.img ? `background-image: url('${p.img}')` : 'background: linear-gradient(135deg, #1d4ed8, #4338ca)'}">
                <span class="absolute bottom-1 left-1 bg-black/60 text-[9px] text-white px-1.5 py-0.5 rounded backdrop-blur-sm">${p.title}</span>
            </div>
        `).join('');

        bannerPresets.querySelectorAll('.profile-banner-preset-item').forEach(item => {
            item.onclick = () => {
                window.editingProfileState.banner = item.dataset.img || '';
                if (bannerUrlInput) bannerUrlInput.value = window.editingProfileState.banner;
                bannerPresets.querySelectorAll('.profile-banner-preset-item').forEach(i => i.classList.remove('border-google-blue', 'ring-2', 'ring-google-blue'));
                item.classList.add('border-google-blue', 'ring-2', 'ring-google-blue');
                updateLiveProfilePreview();
            };
        });
    }

    // Banner URL apply
    const btnApplyBanner = document.getElementById('btn-apply-banner-url');
    if (btnApplyBanner && bannerUrlInput) {
        btnApplyBanner.onclick = () => {
            const val = bannerUrlInput.value.trim();
            window.editingProfileState.banner = val;
            updateLiveProfilePreview();
            triggerToast('Ссылка на баннер применена');
        };
    }

    // Banner file upload
    const bannerFileInput = document.getElementById('full-profile-banner-file');
    if (bannerFileInput) {
        bannerFileInput.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    window.editingProfileState.banner = ev.target.result;
                    if (bannerUrlInput) bannerUrlInput.value = '';
                    updateLiveProfilePreview();
                    triggerToast('Баннер успешно загружен');
                };
                reader.readAsDataURL(file);
            }
        };
    }

    // Back to dashboard
    const btnBack = document.getElementById('btn-back-from-profile');
    if (btnBack) {
        btnBack.onclick = () => window.navigateTo('dashboard');
    }

    // Save buttons
    const btnSaveTop = document.getElementById('btn-save-full-profile');
    const btnSaveBottom = document.getElementById('btn-save-full-profile-bottom');
    if (btnSaveTop) btnSaveTop.onclick = saveFullProfileChanges;
    if (btnSaveBottom) btnSaveBottom.onclick = saveFullProfileChanges;
}

function updateLiveProfilePreview() {
    const state = window.editingProfileState;
    if (!state) return;

    const bannerEl = document.getElementById('profile-preview-banner');
    if (bannerEl) {
        if (state.banner) {
            bannerEl.style.backgroundImage = `url('${state.banner}')`;
        } else {
            bannerEl.style.backgroundImage = 'none';
        }
    }

    const avatarBox = document.getElementById('profile-preview-avatar-box');
    const avatarText = document.getElementById('profile-preview-avatar-text');
    if (avatarBox) {
        if (state.photoUrl) {
            avatarBox.className = 'w-28 h-28 sm:w-32 sm:h-32 rounded-full ring-4 ring-white dark:ring-google-darkSurface shadow-2xl overflow-hidden flex items-center justify-center text-white text-3xl font-bold bg-gray-200 dark:bg-gray-700 select-none';
            avatarBox.innerHTML = `<img src="${state.photoUrl}" class="w-full h-full object-cover">`;
        } else {
            avatarBox.className = `w-28 h-28 sm:w-32 sm:h-32 rounded-full ring-4 ring-white dark:ring-google-darkSurface shadow-2xl overflow-hidden flex items-center justify-center text-white text-3xl font-bold bg-gradient-to-tr ${state.bg || 'from-blue-600 to-indigo-600'} select-none`;
            avatarBox.innerHTML = `<span id="profile-preview-avatar-text">${state.avatar || 'ИС'}</span>`;
        }
    }

    const nameEl = document.getElementById('profile-preview-name');
    if (nameEl) nameEl.textContent = state.name;

    const roleBadge = document.getElementById('profile-preview-role-badge');
    if (roleBadge) {
        const isTeacher = state.role === 'teacher';
        roleBadge.textContent = isTeacher ? 'Преподаватель' : 'Студент';
        roleBadge.className = isTeacher 
            ? 'px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950 text-google-blue dark:text-blue-300'
            : 'px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950 text-google-green dark:text-emerald-300';
    }

    const emailEl = document.getElementById('profile-preview-email');
    const user = getCurrentUser();
    if (emailEl) emailEl.textContent = user.email || '';
}

async function saveFullProfileChanges() {
    const state = window.editingProfileState;
    if (!state) return;

    const user = getCurrentUser();
    if (!user || isGuestUser()) return;

    user.name = state.name.trim() || user.name;
    user.role = state.role || 'student';
    user.avatar = state.avatar || 'ИС';
    user.bg = state.bg || 'from-blue-600 to-indigo-600';
    user.photoUrl = state.photoUrl || '';
    user.banner = state.banner || '';

    // Update in appState accounts list
    const accIdx = (appState.accounts || []).findIndex(a => a.id === user.id);
    if (accIdx !== -1) {
        appState.accounts[accIdx] = Object.assign({}, appState.accounts[accIdx], user);
    }

    persistState();
    syncUserInterface();
    if (typeof renderAllViews === 'function') renderAllViews();

    triggerToast('Изменения профиля успешно сохранены!');

    try {
        await sendServerAction('/api/accounts/update', user);
    } catch (e) {
        console.warn('Profile save note', e);
    }
}
