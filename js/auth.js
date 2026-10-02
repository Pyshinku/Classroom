// Google Classroom - Authentication, Google Account Chooser & Guest Mode Engine

// Pre-discovered Google browser accounts (matching real Chrome profile accounts from screenshot)
const KNOWN_GOOGLE_ACCOUNTS = [
    {
        name: 'Данил',
        email: 'github14072001@gmail.com',
        avatar: 'Д',
        bg: 'from-orange-500 to-amber-600',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80',
        role: 'student'
    },
    {
        name: 'Даниил Лаврик',
        email: 'daniklavrik547@gmail.com',
        avatar: 'ДЛ',
        bg: 'from-blue-600 to-indigo-600',
        photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
        role: 'student'
    },
    {
        name: 'Pyshinka',
        email: 'daniil29031976@gmail.com',
        avatar: 'P',
        bg: 'from-rose-500 to-pink-600',
        photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&q=80',
        role: 'student'
    }
];

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
    appState.activeAccountId = null;
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
    const navChats = document.getElementById('nav-btn-chats');
    const navTodo = document.getElementById('nav-btn-todo');
    const btnPlus = document.getElementById('btn-plus-menu');
    const dashGuestBanner = document.getElementById('dash-guest-banner');
    const dashActionsBox = document.getElementById('dash-quick-actions-box');

    if (isGuest) {
        // GUEST MODE RESTRICTIONS (Item 3)
        if (btnAvatar) btnAvatar.classList.add('hidden');
        if (btnRegister) btnRegister.classList.remove('hidden');
        if (guestBadge) guestBadge.classList.remove('hidden');
        
        // Hide Chats button (Item 3)
        if (navChats) navChats.classList.add('hidden');
        
        // Hide "Список задач" button (Item 3)
        if (navTodo) navTodo.classList.add('hidden');
        
        // Hide Create/Join plus menu (Item 3)
        if (btnPlus) btnPlus.classList.add('hidden');
        
        // Hide dashboard create/join buttons, show guest banner (Item 3)
        if (dashActionsBox) dashActionsBox.classList.add('hidden');
        if (dashGuestBanner) dashGuestBanner.classList.remove('hidden');

        // Hide teacher tabs
        const gradesTab = document.getElementById('tab-btn-grades');
        const createAssignBtn = document.getElementById('btn-trigger-create-assignment');
        if (gradesTab) gradesTab.classList.add('hidden');
        if (createAssignBtn) createAssignBtn.classList.add('hidden');

    } else {
        // LOGGED-IN USER EXPERIENCE
        if (btnAvatar) btnAvatar.classList.remove('hidden');
        if (btnRegister) btnRegister.classList.add('hidden');
        if (guestBadge) guestBadge.classList.add('hidden');
        
        // Show Chats & Todo
        if (navChats) navChats.classList.remove('hidden');
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

        // Role badge: always "Студент" or "Преподаватель" (Item 3)
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

// Official Google Dark Account Chooser (Item 2 & Screenshot media_1790931713335.png)
function renderGoogleAuthView() {
    const listContainer = document.getElementById('google-accounts-chooser-list');
    if (!listContainer) return;

    // Merge KNOWN_GOOGLE_ACCOUNTS with any newly registered accounts in appState
    const accountsMap = new Map();
    KNOWN_GOOGLE_ACCOUNTS.forEach(a => accountsMap.set(a.email.toLowerCase(), a));
    (appState.accounts || []).forEach(a => {
        if (a.email) {
            accountsMap.set(a.email.toLowerCase(), {
                name: a.name,
                email: a.email,
                avatar: a.avatar || a.name.slice(0, 2).toUpperCase(),
                bg: a.bg || 'from-blue-600 to-indigo-600',
                photoUrl: a.photoUrl || '',
                role: a.role || 'student'
            });
        }
    });

    const accountsList = Array.from(accountsMap.values());

    listContainer.innerHTML = accountsList.map(acc => `
        <div onclick="selectGoogleAccount('${acc.email}', '${acc.name}', '${acc.role || 'student'}', '${acc.photoUrl || ''}')" class="p-3.5 px-4 rounded-2xl hover:bg-[#2d2e31] cursor-pointer flex items-center space-x-3.5 transition group border-b border-[#3c4043] last:border-0">
            ${acc.photoUrl 
                ? `<img src="${acc.photoUrl}" class="w-9 h-9 rounded-full object-cover shrink-0 shadow-sm">` 
                : `<div class="w-9 h-9 rounded-full bg-gradient-to-tr ${acc.bg || 'from-blue-600 to-indigo-600'} text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">${acc.avatar || 'Г'}</div>`
            }
            <div class="truncate flex-1">
                <p class="text-sm font-medium text-[#e8eaed] group-hover:text-white truncate">${acc.name}</p>
                <p class="text-xs text-[#9aa0a6] truncate">${acc.email}</p>
            </div>
            <i class="fa-solid fa-chevron-right text-xs text-[#9aa0a6] opacity-0 group-hover:opacity-100 transition-opacity"></i>
        </div>
    `).join('');
}

window.selectGoogleAccount = async function(email, name, role = 'student', photoUrl = '') {
    email = email.trim().toLowerCase();
    name = name.trim();

    // Check if account already exists in appState
    let acc = (appState.accounts || []).find(a => a.email && a.email.toLowerCase() === email);

    if (!acc) {
        // Create in SQLite via server
        const newAcc = {
            id: 'usr_' + Date.now(),
            name,
            email,
            password: '123',
            role: role || 'student',
            avatar: name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || 'ГЛ',
            bg: 'from-blue-600 to-indigo-600',
            photoUrl: photoUrl || '',
            banner: ''
        };

        if (!appState.accounts) appState.accounts = [];
        appState.accounts.push(newAcc);
        appState.activeAccountId = newAcc.id;
        persistState();

        syncUserInterface();
        if (typeof renderAllViews === 'function') renderAllViews();
        window.navigateTo('dashboard');
        triggerToast(`Вход выполнен: ${name}`);

        try {
            await sendServerAction('/api/accounts/register', newAcc);
        } catch (e) {
            console.warn('Account sync note', e);
        }
    } else {
        appState.activeAccountId = acc.id;
        persistState();
        syncUserInterface();
        if (typeof renderAllViews === 'function') renderAllViews();
        window.navigateTo('dashboard');
        triggerToast(`Вход выполнен: ${name}`);
    }
};

window.toggleCustomGoogleInput = function() {
    const box = document.getElementById('google-custom-input-box');
    if (box) box.classList.toggle('hidden');
};

window.submitCustomGoogleAccount = function() {
    const emailInput = document.getElementById('custom-google-email');
    const nameInput = document.getElementById('custom-google-name');
    const roleSelect = document.getElementById('custom-google-role');

    const email = (emailInput ? emailInput.value : '').trim();
    let name = (nameInput ? nameInput.value : '').trim();
    const role = (roleSelect ? roleSelect.value : 'student') || 'student';

    if (!email) {
        triggerToast('Введите адрес электронной почты Google', true);
        return;
    }

    if (!name) {
        name = email.split('@')[0];
    }

    selectGoogleAccount(email, name, role, '');
};

window.openOfficialGoogleSignPage = function() {
    // Direct link to official Google Account Chooser
    window.open('https://accounts.google.com/v3/signin/accountchooser?flowEntry=AccountChooser', '_blank');
};

// Profile settings full view
function initProfileSettingsView() {
    const user = getCurrentUser();
    const nameInput = document.getElementById('profile-settings-name');
    const emailInput = document.getElementById('profile-settings-email');
    const roleSelect = document.getElementById('profile-settings-role');

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (roleSelect) roleSelect.value = user.role || 'student';
}

function openAuthModal(tab = 'login') {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.remove('hidden');
    switchAuthTab(tab);
}

function switchAuthTab(tab) {
    const loginSec = document.getElementById('auth-section-login');
    const regSec = document.getElementById('auth-section-register');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabReg = document.getElementById('auth-tab-register');

    if (tab === 'login') {
        if (loginSec) loginSec.classList.remove('hidden');
        if (regSec) regSec.classList.add('hidden');
        if (tabLogin) tabLogin.className = 'flex-1 py-3 text-xs font-semibold text-google-blue border-b-2 border-google-blue';
        if (tabReg) tabReg.className = 'flex-1 py-3 text-xs font-semibold text-google-gray hover:text-google-text';
    } else {
        if (loginSec) loginSec.classList.add('hidden');
        if (regSec) regSec.classList.remove('hidden');
        if (tabLogin) tabLogin.className = 'flex-1 py-3 text-xs font-semibold text-google-gray hover:text-google-text';
        if (tabReg) tabReg.className = 'flex-1 py-3 text-xs font-semibold text-google-blue border-b-2 border-google-blue';
    }
}
