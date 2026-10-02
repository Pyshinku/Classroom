// Google Classroom - Notifications & Settings Engine

function triggerToast(text, isError = false) {
    const toast = document.getElementById('app-toast');
    const toastText = document.getElementById('toast-text');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastText) return;

    toastText.textContent = text;
    if (toastIcon) {
        if (isError) {
            toastIcon.textContent = 'error';
            toastIcon.className = 'material-symbols-outlined text-red-500 text-lg';
        } else {
            toastIcon.textContent = 'check_circle';
            toastIcon.className = 'material-symbols-outlined text-green-400 dark:text-green-500 text-lg';
        }
    }

    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
    }, 3000);
}

function renderHeaderNotifications() {
    const listEl = document.getElementById('header-notifications-list');
    const badgeEl = document.getElementById('header-notifications-badge');
    if (!listEl) return;

    // Collect notifications from active courses and assignments
    const user = getCurrentUser();
    const isGuest = isGuestUser();
    let notifications = appState.inAppNotifications || [];

    if (isGuest) {
        listEl.innerHTML = `
            <div class="py-8 text-center text-google-gray space-y-2">
                <i class="fa-regular fa-bell-slash text-3xl opacity-40"></i>
                <p class="text-xs">В гостевом режиме уведомления отключены</p>
                <button type="button" onclick="window.navigateTo('google-auth')" class="text-xs text-google-blue font-semibold hover:underline">Войти через Google</button>
            </div>
        `;
        if (badgeEl) badgeEl.classList.add('hidden');
        return;
    }

    // Auto-generate notifications if empty from recent assignments
    if (notifications.length === 0 && appState.assignments && appState.assignments.length > 0) {
        notifications = appState.assignments.slice(0, 5).map((a, idx) => {
            const course = appState.courses.find(c => c.id === a.courseId);
            return {
                id: 'notif_' + a.id,
                title: 'Новое задание опубликовано',
                text: `${course ? course.name : 'Курс'}: ${a.title}`,
                time: a.deadline ? `Срок: ${a.deadline}` : 'Недавно',
                read: idx > 0,
                type: 'assignment',
                courseId: a.courseId,
                assignmentId: a.id
            };
        });
        appState.inAppNotifications = notifications;
    }

    const unreadCount = notifications.filter(n => !n.read).length;
    if (badgeEl) {
        badgeEl.classList.toggle('hidden', unreadCount === 0);
    }

    if (notifications.length === 0) {
        listEl.innerHTML = `
            <div class="py-8 text-center text-google-gray space-y-2">
                <i class="fa-regular fa-bell text-3xl opacity-40"></i>
                <p class="text-xs">У вас нет новых уведомлений</p>
                <p class="text-[11px] text-google-gray opacity-70">Здесь будут отображаться новые задания, оценки и объявления</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = notifications.map((n, i) => `
        <div onclick="clickHeaderNotification(${i})" class="p-2.5 rounded-2xl border border-google-border dark:border-google-darkBorder flex items-start space-x-3 cursor-pointer transition ${n.read ? 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50' : 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900'}">
            <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-google-blue dark:text-blue-300 flex items-center justify-center shrink-0 text-xs">
                <i class="fa-solid ${n.type === 'assignment' ? 'fa-clipboard-list' : (n.type === 'grade' ? 'fa-award' : 'fa-comment')}"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                    <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">${n.title}</p>
                    ${!n.read ? '<span class="w-2 h-2 rounded-full bg-google-blue shrink-0 ml-1"></span>' : ''}
                </div>
                <p class="text-[11px] text-gray-600 dark:text-gray-300 truncate">${n.text}</p>
                <p class="text-[10px] text-google-gray mt-0.5">${n.time}</p>
            </div>
        </div>
    `).join('');
}

window.clickHeaderNotification = function(idx) {
    if (!appState.inAppNotifications || !appState.inAppNotifications[idx]) return;
    const notif = appState.inAppNotifications[idx];
    notif.read = true;
    persistState();
    renderHeaderNotifications();

    const pop = document.getElementById('popover-notifications');
    if (pop) pop.classList.add('hidden');

    if (notif.assignmentId && notif.courseId) {
        window.navigateTo('assignment', notif.courseId, notif.assignmentId);
    } else if (notif.courseId) {
        window.navigateTo('course', notif.courseId);
    }
};

window.markAllNotificationsRead = function() {
    if (!appState.inAppNotifications) return;
    appState.inAppNotifications.forEach(n => n.read = true);
    persistState();
    renderHeaderNotifications();
    triggerToast('Все уведомления отмечены как прочитанные');
};

function initNotificationsPopover() {
    const btn = document.getElementById('btn-header-notifications');
    const pop = document.getElementById('popover-notifications');
    if (!btn || !pop) return;

    btn.onclick = (e) => {
        e.stopPropagation();
        pop.classList.toggle('hidden');
        const popPlus = document.getElementById('popover-plus');
        const popUser = document.getElementById('popover-user');
        if (popPlus) popPlus.classList.add('hidden');
        if (popUser) popUser.classList.add('hidden');
        renderHeaderNotifications();
    };

    document.addEventListener('click', (e) => {
        if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            pop.classList.add('hidden');
        }
    });
}

// Google Classroom Settings Page
function renderSettingsView() {
    const user = getCurrentUser();
    const isGuest = isGuestUser();
    const settings = appState.userSettings || DEFAULT_STATE.userSettings;

    // Profile Card in Settings
    const avatarBox = document.getElementById('settings-profile-avatar-box');
    const nameEl = document.getElementById('settings-profile-name');
    const emailEl = document.getElementById('settings-profile-email');
    const roleBadge = document.getElementById('settings-profile-role-badge');

    if (avatarBox) {
        if (isGuest) {
            avatarBox.className = 'w-16 h-16 rounded-full text-white text-2xl font-bold flex items-center justify-center shadow-lg ring-4 ring-gray-200 dark:ring-gray-700 bg-gray-500';
            avatarBox.innerHTML = '<i class="fa-regular fa-user"></i>';
        } else if (user.photoUrl) {
            avatarBox.className = 'w-16 h-16 rounded-full text-white text-2xl font-bold flex items-center justify-center shadow-lg ring-4 ring-blue-100 dark:ring-blue-900/40 overflow-hidden bg-gray-200 dark:bg-gray-700';
            avatarBox.innerHTML = `<img src="${user.photoUrl}" class="w-full h-full object-cover">`;
        } else {
            avatarBox.className = `w-16 h-16 rounded-full text-white text-2xl font-bold flex items-center justify-center shadow-lg ring-4 ring-blue-100 dark:ring-blue-900/40 bg-gradient-to-tr ${user.bg || 'from-blue-600 to-indigo-600'}`;
            avatarBox.innerHTML = user.avatar || 'П';
        }
    }

    if (nameEl) nameEl.textContent = isGuest ? 'Гостевой режим' : user.name;
    if (emailEl) emailEl.textContent = isGuest ? 'Вход в аккаунт не выполнен' : user.email;
    if (roleBadge) {
        if (isGuest) {
            roleBadge.textContent = 'Гость';
            roleBadge.className = 'inline-block mt-1.5 px-3 py-0.5 text-xs font-semibold rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
        } else {
            const isTeacher = user.role === 'teacher';
            roleBadge.textContent = isTeacher ? 'Преподаватель' : 'Студент';
            roleBadge.className = isTeacher 
                ? 'inline-block mt-1.5 px-3 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950 text-google-blue dark:text-blue-300'
                : 'inline-block mt-1.5 px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950 text-google-green dark:text-emerald-300';
        }
    }

    // Set checkboxes
    const setCb = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(val);
    };

    setCb('setting-notify-master', settings.master);
    setCb('setting-notify-comments-post', settings.commentsPost);
    setCb('setting-notify-comments-mention', settings.commentsMention);
    setCb('setting-notify-comments-private', settings.commentsPrivate);
    setCb('setting-notify-student-assignments', settings.studentAssignments);
    setCb('setting-notify-student-grades', settings.studentGrades);
    setCb('setting-notify-student-reminders', settings.studentReminders);
    setCb('setting-notify-teacher-submissions', settings.teacherSubmissions);
    setCb('setting-notify-teacher-late', settings.teacherLate);
    setCb('setting-notify-teacher-invite', settings.teacherInvite);

    // Render course-specific toggles
    const courseListEl = document.getElementById('settings-courses-notifications-list');
    if (courseListEl) {
        if (!appState.courses || appState.courses.length === 0) {
            courseListEl.innerHTML = '<p class="text-xs text-google-gray py-2 italic">Курсы еще не добавлены</p>';
        } else {
            courseListEl.innerHTML = appState.courses.map(c => {
                const isEnabled = settings.courseSpecific && settings.courseSpecific[c.id] !== undefined 
                    ? settings.courseSpecific[c.id] 
                    : true;
                return `
                    <div class="flex items-center justify-between py-2 border-b border-google-border dark:border-google-darkBorder last:border-0">
                        <div class="flex items-center space-x-3 truncate">
                            <span class="w-8 h-8 rounded-xl bg-gradient-to-tr ${c.gradient || 'from-blue-600 to-indigo-700'} text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                                ${getCourseBadgeLetters(c.name)}
                            </span>
                            <div class="truncate">
                                <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">${c.name}</p>
                                <p class="text-[10px] text-google-gray">${c.section || 'Основной раздел'}</p>
                            </div>
                        </div>
                        <input type="checkbox" onchange="toggleCourseNotification('${c.id}', this.checked)" class="w-4 h-4 text-google-blue rounded focus:ring-google-blue dark:bg-gray-800 dark:border-gray-600 cursor-pointer" ${isEnabled ? 'checked' : ''}>
                    </div>
                `;
            }).join('');
        }
    }
}

window.toggleNotificationSetting = function(key, val) {
    if (!appState.userSettings) appState.userSettings = Object.assign({}, DEFAULT_STATE.userSettings);
    appState.userSettings[key] = val;
    persistState();
    triggerToast('Настройки уведомлений обновлены');
};

window.toggleCourseNotification = function(courseId, val) {
    if (!appState.userSettings) appState.userSettings = Object.assign({}, DEFAULT_STATE.userSettings);
    if (!appState.userSettings.courseSpecific) appState.userSettings.courseSpecific = {};
    appState.userSettings.courseSpecific[courseId] = val;
    persistState();
    triggerToast('Настройки курса обновлены');
};
