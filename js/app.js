// Google Classroom - Application Router, Navigation & Initialization

function updateTheme(isDark) {
    appState.darkMode = Boolean(isDark);
    const html = document.documentElement;
    const themeIcon = document.getElementById('theme-toggle-icon');
    
    if (appState.darkMode) {
        html.classList.add('dark');
        if (themeIcon) themeIcon.textContent = 'light_mode';
    } else {
        html.classList.remove('dark');
        if (themeIcon) themeIcon.textContent = 'dark_mode';
    }
    persistState();
}

function renderAllViews() {
    renderSidebar();
    syncUserInterface();
    if (typeof renderHeaderNotifications === 'function') renderHeaderNotifications();

    if (!appState.currentCourseId) {
        renderDashboard();
    } else {
        const course = (appState.courses || []).find(c => c.id === appState.currentCourseId);
        if (course) {
            renderCurrentCourseView(course);
        }
    }
}

// Client Router
window.navigateTo = function(viewName, param1 = null, param2 = null) {
    const viewSections = {
        dashboard: document.getElementById('view-dashboard'),
        course: document.getElementById('view-course-detail') || document.getElementById('view-course'),
        createAssignment: document.getElementById('view-create-assignment'),
        assignment: document.getElementById('view-assignment-detail') || document.getElementById('view-assignment'),
        todo: document.getElementById('view-todo'),
        calendar: document.getElementById('view-calendar'),
        profileSettings: document.getElementById('view-profile-settings'),
        settings: document.getElementById('view-settings')
    };

    // Close mobile sidebar
    if (window.innerWidth < 1024) {
        toggleSidebar(false);
    }

    // Hide all views
    Object.values(viewSections).forEach(v => {
        if (v) v.classList.add('hidden');
    });

    const breadcrumbs = document.getElementById('header-breadcrumbs');
    const courseTabs = document.getElementById('course-main-tabs');
    const mobileTabs = document.getElementById('mobile-course-tabs');
    const subTitle = document.getElementById('breadcrumb-sub-title');
    const subSep = document.getElementById('breadcrumb-sub-separator');

    if (subTitle) subTitle.classList.add('hidden');
    if (subSep) subSep.classList.add('hidden');

    if (viewName === 'dashboard') {
        appState.currentCourseId = null;
        appState.currentAssignmentId = null;
        if (courseTabs) {
            courseTabs.classList.add('hidden');
            courseTabs.classList.remove('flex');
        }
        if (mobileTabs) {
            mobileTabs.classList.add('hidden');
            mobileTabs.classList.remove('flex');
        }
        if (breadcrumbs) {
            breadcrumbs.classList.add('hidden');
            breadcrumbs.classList.remove('flex');
        }
        if (viewSections.dashboard) viewSections.dashboard.classList.remove('hidden');
        renderDashboard();

    } else if (viewName === 'google-auth') {
        if (typeof triggerGoogleSignIn === 'function') triggerGoogleSignIn();
        return;
    } else if (viewName === 'settings') {
        appState.currentCourseId = null;
        appState.currentAssignmentId = null;
        if (courseTabs) courseTabs.classList.add('hidden');
        if (mobileTabs) mobileTabs.classList.add('hidden');
        if (breadcrumbs) breadcrumbs.classList.add('hidden');
        if (viewSections.settings) {
            viewSections.settings.classList.remove('hidden');
            renderSettingsView();
        }

    } else if (viewName === 'course' && param1) {
        if (isGuestUser()) {
            triggerToast('В гостевом режиме вход на курсы недоступен. Пожалуйста, выполните вход через Google.', true);
            triggerGoogleSignIn();
            return;
        }
        appState.currentCourseId = param1;
        appState.currentAssignmentId = null;
        const course = (appState.courses || []).find(c => c.id === param1);
        if (!course) {
            window.navigateTo('dashboard');
            return;
        }

        const titleEl = document.getElementById('breadcrumb-course-title');
        if (titleEl) titleEl.textContent = course.name;
        if (breadcrumbs) {
            breadcrumbs.classList.remove('hidden');
            breadcrumbs.classList.add('flex');
        }
        if (courseTabs) {
            courseTabs.classList.remove('hidden');
            courseTabs.classList.add('flex');
        }
        if (mobileTabs) {
            mobileTabs.classList.remove('hidden');
            mobileTabs.classList.add('flex');
        }
        if (viewSections.course) viewSections.course.classList.remove('hidden');

        const initialTab = appState.activeCourseTab || 'stream';
        switchCourseTab(initialTab);
        renderCurrentCourseView(course);

    } else if (viewName === 'create-assignment' && param1) {
        if (isGuestUser()) {
            triggerToast('В гостевом режиме создание заданий недоступно.', true);
            triggerGoogleSignIn();
            return;
        }
        appState.currentCourseId = param1;
        appState.currentAssignmentId = null;
        const course = (appState.courses || []).find(c => c.id === param1);
        if (!course) {
            window.navigateTo('dashboard');
            return;
        }

        if (courseTabs) courseTabs.classList.add('hidden');
        if (mobileTabs) mobileTabs.classList.add('hidden');

        document.getElementById('breadcrumb-course-title').textContent = course.name;
        if (subSep) subSep.classList.remove('hidden');
        if (subTitle) {
            subTitle.textContent = 'Создать задание';
            subTitle.classList.remove('hidden');
        }
        if (breadcrumbs) {
            breadcrumbs.classList.remove('hidden');
            breadcrumbs.classList.add('flex');
        }

        if (viewSections.createAssignment) {
            viewSections.createAssignment.classList.remove('hidden');
        }
        initCreateAssignmentView(course);

    } else if (viewName === 'edit-assignment' && param1 && param2) {
        if (isGuestUser()) {
            triggerToast('В гостевом режиме редактирование заданий недоступно.', true);
            triggerGoogleSignIn();
            return;
        }
        appState.currentCourseId = param1;
        appState.currentAssignmentId = param2;
        const course = (appState.courses || []).find(c => c.id === param1);
        const assign = (appState.assignments || []).find(a => a.id === param2);
        if (!course || !assign) {
            window.navigateTo('dashboard');
            return;
        }

        if (courseTabs) courseTabs.classList.add('hidden');
        if (mobileTabs) mobileTabs.classList.add('hidden');

        document.getElementById('breadcrumb-course-title').textContent = course.name;
        if (subSep) subSep.classList.remove('hidden');
        if (subTitle) {
            subTitle.textContent = 'Редактировать задание';
            subTitle.classList.remove('hidden');
        }
        if (breadcrumbs) {
            breadcrumbs.classList.remove('hidden');
            breadcrumbs.classList.add('flex');
        }

        if (viewSections.createAssignment) {
            viewSections.createAssignment.classList.remove('hidden');
        }
        initCreateAssignmentView(course, assign);

    } else if (viewName === 'assignment' && param1 && param2) {
        if (isGuestUser()) {
            triggerToast('В гостевом режиме просмотр заданий недоступен. Пожалуйста, выполните вход через Google.', true);
            triggerGoogleSignIn();
            return;
        }
        appState.currentCourseId = param1;
        appState.currentAssignmentId = param2;
        const course = (appState.courses || []).find(c => c.id === param1);
        const assign = (appState.assignments || []).find(a => a.id === param2);

        if (!course || !assign) {
            window.navigateTo('dashboard');
            return;
        }

        if (courseTabs) courseTabs.classList.add('hidden');
        if (mobileTabs) mobileTabs.classList.add('hidden');

        document.getElementById('breadcrumb-course-title').textContent = course.name;
        if (subSep) subSep.classList.remove('hidden');
        if (subTitle) {
            subTitle.textContent = assign.title;
            subTitle.classList.remove('hidden');
        }
        if (breadcrumbs) {
            breadcrumbs.classList.remove('hidden');
            breadcrumbs.classList.add('flex');
        }

        if (viewSections.assignment) {
            viewSections.assignment.classList.remove('hidden');
            renderFullAssignmentWorkspace(course, assign);
        }

    } else if (viewName === 'todo') {
        if (isGuestUser()) {
            triggerToast('В гостевом режиме список задач недоступен. Пожалуйста, выполните вход через Google.', true);
            triggerGoogleSignIn();
            return;
        }
        appState.currentCourseId = null;
        appState.currentAssignmentId = null;
        if (courseTabs) courseTabs.classList.add('hidden');
        if (mobileTabs) mobileTabs.classList.add('hidden');
        if (breadcrumbs) breadcrumbs.classList.add('hidden');
        if (viewSections.todo) {
            viewSections.todo.classList.remove('hidden');
            if (typeof renderTodoView === 'function') renderTodoView();
        }

    } else if (viewName === 'calendar') {
        if (isGuestUser()) {
            triggerToast('В гостевом режиме календарь недоступен. Пожалуйста, выполните вход через Google.', true);
            triggerGoogleSignIn();
            return;
        }
        appState.currentCourseId = null;
        if (courseTabs) courseTabs.classList.add('hidden');
        if (mobileTabs) mobileTabs.classList.add('hidden');
        if (breadcrumbs) breadcrumbs.classList.add('hidden');
        if (viewSections.calendar) {
            viewSections.calendar.classList.remove('hidden');
            if (typeof renderCalendarView === 'function') renderCalendarView();
        }

    } else if (viewName === 'profile-settings' || viewName === 'profileSettings') {
        appState.currentCourseId = null;
        if (courseTabs) courseTabs.classList.add('hidden');
        if (mobileTabs) mobileTabs.classList.add('hidden');
        if (breadcrumbs) breadcrumbs.classList.add('hidden');
        if (viewSections.profileSettings) {
            viewSections.profileSettings.classList.remove('hidden');
            initProfileSettingsView();
        }
    }

    persistState();
    renderSidebar();
    syncUserInterface();
};

function toggleSidebar(forceState = null) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isDesktop = window.innerWidth >= 1024;

    if (isDesktop) {
        if (forceState !== null) {
            appState.sidebarCollapsed = !forceState;
        } else {
            appState.sidebarCollapsed = !appState.sidebarCollapsed;
        }

        if (appState.sidebarCollapsed) {
            sidebar.classList.remove('w-72');
            sidebar.classList.add('w-20');
            document.querySelectorAll('.sidebar-label').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.replace('justify-start', 'justify-center'));
            const cc = document.getElementById('sidebar-courses-container');
            if (cc) cc.classList.add('hidden');
        } else {
            sidebar.classList.remove('w-20');
            sidebar.classList.add('w-72');
            document.querySelectorAll('.sidebar-label').forEach(el => el.classList.remove('hidden'));
            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.replace('justify-center', 'justify-start'));
            const cc = document.getElementById('sidebar-courses-container');
            if (cc) cc.classList.remove('hidden');
        }
    } else {
        // Mobile drawer
        const isOpen = !sidebar.classList.contains('-translate-x-full');
        const nextState = forceState !== null ? forceState : !isOpen;

        if (nextState) {
            sidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        }
    }

    persistState();
}

// Auto-expand Sidebar on hover when collapsed (Req 9)
function initSidebarHover() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.addEventListener('mouseenter', () => {
        if (appState.sidebarCollapsed && window.innerWidth >= 1024) {
            sidebar.classList.remove('w-20');
            sidebar.classList.add('w-72', 'shadow-2xl', 'z-40');
            document.querySelectorAll('.sidebar-label').forEach(el => el.classList.remove('hidden'));
            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.replace('justify-center', 'justify-start'));
            const cc = document.getElementById('sidebar-courses-container');
            if (cc) cc.classList.remove('hidden');
        }
    });

    sidebar.addEventListener('mouseleave', () => {
        if (appState.sidebarCollapsed && window.innerWidth >= 1024) {
            sidebar.classList.remove('w-72', 'shadow-2xl', 'z-40');
            sidebar.classList.add('w-20');
            document.querySelectorAll('.sidebar-label').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.replace('justify-start', 'justify-center'));
            const cc = document.getElementById('sidebar-courses-container');
            if (cc) cc.classList.add('hidden');
        }
    });
}

// DOMContentLoaded Startup Initialization
document.addEventListener('DOMContentLoaded', () => {
    updateTheme(appState.darkMode || false);

    const inputServerUrl = document.getElementById('input-custom-server-url');
    if (inputServerUrl) inputServerUrl.value = getApiBase();

    // 1. Sidebar Toggle Buttons & Hover
    const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
    if (btnSidebarToggle) {
        btnSidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();
        });
    }

    const btnSidebarClose = document.getElementById('btn-sidebar-close');
    if (btnSidebarClose) btnSidebarClose.addEventListener('click', () => toggleSidebar(false));

    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));

    initSidebarHover();

    // 2. Navigation items
    const btnBrand = document.getElementById('btn-brand');
    if (btnBrand) btnBrand.onclick = () => window.navigateTo('dashboard');

    const btnBreadcrumbBack = document.getElementById('btn-breadcrumb-back');
    if (btnBreadcrumbBack) btnBreadcrumbBack.onclick = () => window.navigateTo('dashboard');

    const navHome = document.getElementById('nav-btn-home');
    if (navHome) navHome.onclick = () => window.navigateTo('dashboard');

    const navCalendar = document.getElementById('nav-btn-calendar');
    if (navCalendar) navCalendar.onclick = () => window.navigateTo('calendar');

    const navTodo = document.getElementById('nav-btn-todo');
    if (navTodo) navTodo.onclick = () => window.navigateTo('todo');

    const btnSidebarSettings = document.getElementById('btn-sidebar-settings');
    if (btnSidebarSettings) btnSidebarSettings.onclick = () => window.navigateTo('settings');

    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (btnThemeToggle) btnThemeToggle.onclick = () => updateTheme(!appState.darkMode);

    // 3. Header Notification Bell (Item 5)
    initNotificationsPopover();

    // 4. Popovers (Plus menu & Accounts menu)
    const btnPlus = document.getElementById('btn-plus-menu');
    const popPlus = document.getElementById('popover-plus');
    const btnUser = document.getElementById('btn-user-avatar');
    const popUser = document.getElementById('popover-user');
    const popNotifications = document.getElementById('popover-notifications');

    if (btnPlus && popPlus) {
        btnPlus.onclick = (e) => {
            e.stopPropagation();
            if (isGuestUser()) {
                triggerToast('В режиме гостя нельзя создавать курсы. Войдите через Google.', true);
                triggerGoogleSignIn();
                return;
            }
            popPlus.classList.toggle('hidden');
            if (popUser) popUser.classList.add('hidden');
            if (popNotifications) popNotifications.classList.add('hidden');
        };
    }

    if (btnUser && popUser) {
        btnUser.onclick = (e) => {
            e.stopPropagation();
            popUser.classList.toggle('hidden');
            if (popPlus) popPlus.classList.add('hidden');
            if (popNotifications) popNotifications.classList.add('hidden');
        };
    }

    document.addEventListener('click', () => {
        if (popPlus) popPlus.classList.add('hidden');
        if (popUser) popUser.classList.add('hidden');
    });

    // 5. Course Actions: Join & Create
    const btnActionJoin = document.getElementById('btn-action-join-class');
    if (btnActionJoin) {
        btnActionJoin.onclick = () => {
            if (isGuestUser()) {
                triggerToast('В режиме гостя нельзя записываться на курсы. Войдите через Google.', true);
                triggerGoogleSignIn();
                return;
            }
            document.getElementById('modal-join-course').classList.remove('hidden');
        };
    }

    const btnActionCreate = document.getElementById('btn-action-create-class');
    if (btnActionCreate) {
        btnActionCreate.onclick = () => {
            if (isGuestUser()) {
                triggerToast('В режиме гостя нельзя создавать курсы. Войдите через Google.', true);
                triggerGoogleSignIn();
                return;
            }
            document.getElementById('modal-create-course').classList.remove('hidden');
        };
    }

    const btnQuickCreate = document.getElementById('btn-quick-create-course');
    if (btnQuickCreate) {
        btnQuickCreate.onclick = () => {
            if (isGuestUser()) {
                triggerToast('В режиме гостя нельзя создавать курсы. Войдите через Google.', true);
                triggerGoogleSignIn();
                return;
            }
            document.getElementById('modal-create-course').classList.remove('hidden');
        };
    }

    const btnDashCreate = document.getElementById('btn-dash-create');
    if (btnDashCreate) {
        btnDashCreate.onclick = () => {
            if (isGuestUser()) {
                triggerGoogleSignIn();
                return;
            }
            document.getElementById('modal-create-course').classList.remove('hidden');
        };
    }

    const btnDashJoin = document.getElementById('btn-dash-join');
    if (btnDashJoin) {
        btnDashJoin.onclick = () => {
            if (isGuestUser()) {
                triggerGoogleSignIn();
                return;
            }
            document.getElementById('modal-join-course').classList.remove('hidden');
        };
    }

    // Close modals
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.fixed.inset-0.z-50').forEach(m => m.classList.add('hidden'));
        };
    });

    // Tabs indicators inside course view
    document.querySelectorAll('.tab-indicator').forEach(tabBtn => {
        tabBtn.onclick = (e) => {
            const tab = e.currentTarget.dataset.tab;
            if (tab) switchCourseTab(tab);
        };
    });

    // Copy Course Code Button
    const btnCopyCode = document.getElementById('btn-copy-course-code');
    if (btnCopyCode) {
        btnCopyCode.onclick = async () => {
            const codeEl = document.getElementById('hero-banner-code');
            const code = codeEl ? codeEl.textContent : '';
            if (code) {
                try {
                    await navigator.clipboard.writeText(code);
                } catch (_) {}
                triggerToast(`Код курса ${code} скопирован в буфер!`);
            }
        };
    }

    // Course Create Modal Banner Presets & Custom URL
    const courseBannerPresets = document.querySelectorAll('#course-banner-presets .banner-preset-option');
    const customBannerInput = document.getElementById('form-course-custom-banner');

    courseBannerPresets.forEach(opt => {
        opt.onclick = () => {
            selectedBannerImg = opt.dataset.img || '';
            selectedBannerGrad = opt.dataset.grad || 'from-blue-600 to-indigo-700';
            if (customBannerInput) customBannerInput.value = '';
            courseBannerPresets.forEach(o => o.classList.remove('ring-2', 'ring-google-blue', 'scale-105'));
            opt.classList.add('ring-2', 'ring-google-blue', 'scale-105');
        };
    });

    if (customBannerInput) {
        customBannerInput.oninput = () => {
            const val = customBannerInput.value.trim();
            if (val) {
                selectedBannerImg = val;
                courseBannerPresets.forEach(o => o.classList.remove('ring-2', 'ring-google-blue', 'scale-105'));
            }
        };
    }

    // Course Creation Form Submit
    const btnSubmitCourse = document.getElementById('btn-submit-create-course');
    if (btnSubmitCourse) {
        btnSubmitCourse.onclick = async () => {
            if (btnSubmitCourse.disabled) return;

            const name = (document.getElementById('form-course-name').value || '').trim();
            const section = (document.getElementById('form-course-section').value || '').trim();
            const subject = (document.getElementById('form-course-subject').value || '').trim();
            const customUrl = customBannerInput ? customBannerInput.value.trim() : '';

            if (!name) {
                triggerToast('Укажите название курса', true);
                return;
            }

            try {
                btnSubmitCourse.disabled = true;
                btnSubmitCourse.classList.add('opacity-50', 'cursor-not-allowed');

                const user = getCurrentUser();
                const newCourse = {
                    id: 'course_' + Date.now(),
                    name,
                    section: section || 'Основная группа',
                    subject: subject || 'Общий предмет',
                    description: 'Программа и материалы курса.',
                    code: Math.random().toString(36).substring(2, 7).toUpperCase(),
                    banner: customUrl || selectedBannerImg,
                    gradient: selectedBannerGrad || 'from-blue-600 to-indigo-700',
                    teacherId: user.id,
                    teacherEmail: user.email,
                    teacherName: user.name,
                    studentIds: [],
                    coTeacherIds: []
                };

                if (!appState.courses) appState.courses = [];
                appState.courses.unshift(newCourse);
                persistState();

                document.getElementById('modal-create-course').classList.add('hidden');
                document.getElementById('form-course-name').value = '';
                document.getElementById('form-course-section').value = '';
                document.getElementById('form-course-subject').value = '';
                if (customBannerInput) customBannerInput.value = '';

                renderDashboard();
                renderSidebar();
                window.navigateTo('course', newCourse.id);
                triggerToast('Курс успешно создан!');

                await sendServerAction('/api/courses/create', newCourse);
            } finally {
                btnSubmitCourse.disabled = false;
                btnSubmitCourse.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        };
    }

    // Join Course Form Submit
    const btnSubmitJoin = document.getElementById('btn-submit-join-course');
    if (btnSubmitJoin) {
        btnSubmitJoin.onclick = async () => {
            const codeInput = document.getElementById('form-join-code');
            const code = codeInput ? codeInput.value : '';
            document.getElementById('modal-join-course').classList.add('hidden');
            if (codeInput) codeInput.value = '';
            await joinCourseDirectly(code);
        };
    }

    // Auth Modal Handlers
    const tabAuthLogin = document.getElementById('auth-tab-login');
    const tabAuthReg = document.getElementById('auth-tab-register');
    if (tabAuthLogin) tabAuthLogin.onclick = () => switchAuthTab('login');
    if (tabAuthReg) tabAuthReg.onclick = () => switchAuthTab('register');

    const btnSubmitLogin = document.getElementById('btn-submit-login');
    if (btnSubmitLogin) btnSubmitLogin.onclick = submitManualLogin;

    const btnSubmitReg = document.getElementById('btn-submit-register');
    if (btnSubmitReg) btnSubmitReg.onclick = submitManualRegister;

    // Avatar color picker buttons in registration
    document.querySelectorAll('.avatar-color-btn').forEach(btn => {
        btn.onclick = (e) => {
            const grad = e.currentTarget.dataset.grad;
            if (grad) {
                window.selectedRegBg = grad;
                document.querySelectorAll('.avatar-color-btn').forEach(b => b.classList.remove('ring-2', 'ring-offset-2', 'ring-google-blue'));
                e.currentTarget.classList.add('ring-2', 'ring-offset-2', 'ring-google-blue');
            }
        };
    });

    // Handle OAuth callback if redirecting back from official Google
    if (typeof checkOAuthCallback === 'function' && window.location.hash && window.location.hash.includes('access_token=')) {
        checkOAuthCallback().finally(() => {
            syncWithServer(false);
            window.navigateTo('dashboard');
        });
    } else {
        // Initial sync & start in dashboard
        syncWithServer(false);
        window.navigateTo('dashboard');
    }
});
