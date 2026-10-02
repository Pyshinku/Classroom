// Google Classroom - Courses, Streams, Members & Gradebook Engine

function getCourseBadgeLetters(name) {
    if (!name) return 'КР';
    const words = name.trim().split(/[\s,.:;_\-]+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return 'КР';
}

function isCourseTeacher(course, user = null) {
    user = user || getCurrentUser();
    if (!user || user.role === 'guest') return false;
    if (!course) return user.role === 'teacher';
    const isOwner = Boolean(
        (course.teacherId && course.teacherId === user.id) ||
        (course.teacherEmail && user.email && course.teacherEmail.toLowerCase() === user.email.toLowerCase()) ||
        (Array.isArray(course.coTeacherIds) && course.coTeacherIds.includes(user.id))
    );
    if (isOwner) return true;
    if (!course.teacherId && !course.teacherEmail && user.role === 'teacher') {
        return true;
    }
    return false;
}

function switchCourseTab(tabKey) {
    const course = (appState.courses || []).find(c => c.id === appState.currentCourseId);
    const user = getCurrentUser();
    if (tabKey === 'grades' && !isCourseTeacher(course, user)) {
        tabKey = 'stream';
    }

    appState.activeCourseTab = tabKey;

    document.querySelectorAll('.tab-indicator').forEach(btn => {
        if (btn.dataset.tab === tabKey) {
            btn.classList.add('active');
            btn.classList.remove('text-google-gray', 'dark:text-gray-400');
        } else {
            btn.classList.remove('active');
            btn.classList.add('text-google-gray', 'dark:text-gray-400');
        }
    });

    const tabMap = {
        stream: document.getElementById('tab-course-stream'),
        classwork: document.getElementById('tab-course-classwork'),
        people: document.getElementById('tab-course-people'),
        grades: document.getElementById('tab-course-grades')
    };

    Object.keys(tabMap).forEach(key => {
        if (tabMap[key]) {
            tabMap[key].classList.toggle('hidden', key !== tabKey);
        }
    });

    if (appState.currentCourseId) {
        const course = (appState.courses || []).find(c => c.id === appState.currentCourseId);
        if (course) {
            if (tabKey === 'stream') renderStreamTab(course);
            else if (tabKey === 'classwork' && typeof renderClassworkTab === 'function') renderClassworkTab(course);
            else if (tabKey === 'people') renderPeopleTab(course);
            else if (tabKey === 'grades') renderGradesTab(course);
        }
    }

    persistState();
}

function renderSidebar() {
    const user = getCurrentUser();
    const isGuest = isGuestUser();

    const teachingCourses = (appState.courses || []).filter(c => !c.isArchived && isCourseTeacher(c, user));
    const enrolledCourses = (appState.courses || []).filter(c => !c.isArchived && (c.studentIds || []).includes(user.id));

    const teachingSec = document.getElementById('sidebar-section-teaching');
    const enrolledSec = document.getElementById('sidebar-section-enrolled');

    if (teachingSec) teachingSec.classList.toggle('hidden', isGuest || (teachingCourses.length === 0 && user.role !== 'teacher'));
    if (enrolledSec) enrolledSec.classList.toggle('hidden', isGuest || (enrolledCourses.length === 0 && user.role === 'teacher'));

    const renderCourseItem = (c) => `
        <div onclick="window.navigateTo('course', '${c.id}')" class="sidebar-item w-full flex items-center justify-start space-x-3.5 px-3.5 py-2.5 rounded-2xl cursor-pointer text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition group select-none ${appState.currentCourseId === c.id ? 'bg-blue-50 dark:bg-blue-950/40 text-google-blue dark:text-google-blueDarkTheme font-medium' : ''}">
            <div class="sidebar-course-badge w-8 h-8 rounded-full bg-gradient-to-tr ${c.gradient || 'from-blue-600 to-indigo-700'} text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                ${getCourseBadgeLetters(c.name)}
            </div>
            <div class="sidebar-label truncate flex-1 min-w-0">
                <p class="text-xs font-medium truncate group-hover:text-google-blue dark:group-hover:text-google-blueDarkTheme">${c.name}</p>
                <p class="text-[10px] text-google-gray truncate">${c.section || 'Основная группа'}</p>
            </div>
        </div>
    `;

    const teachingList = document.getElementById('sidebar-teaching-courses');
    const enrolledList = document.getElementById('sidebar-enrolled-courses');

    if (teachingList) teachingList.innerHTML = teachingCourses.map(renderCourseItem).join('');
    if (enrolledList) enrolledList.innerHTML = enrolledCourses.map(renderCourseItem).join('');
    if (typeof syncDevBetaUI === 'function') syncDevBetaUI();
}

function renderDashboard() {
    const user = getCurrentUser();
    const isGuest = isGuestUser();
    const searchInput = document.getElementById('input-global-search');
    const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

    let allCourses = (appState.courses || []).filter(c => !c.isArchived);
    if (searchQuery) {
        allCourses = allCourses.filter(c => (c.name || '').toLowerCase().includes(searchQuery) || (c.code || '').toLowerCase().includes(searchQuery) || (c.subject || '').toLowerCase().includes(searchQuery));
    }

    const container = document.getElementById('courses-grid') || document.getElementById('dashboard-courses-grid');
    const badgeEl = document.getElementById('dashboard-courses-badge');
    if (!container) return;

    // 1. ANIMATED SKELETON LOADING (While initial sync from backend is in progress and local courses are empty)
    if (window.isInitialCoursesLoading && (!allCourses || allCourses.length === 0)) {
        if (badgeEl) badgeEl.textContent = '...';
        container.innerHTML = Array(4).fill(0).map(() => `
            <div class="animate-pulse bg-white dark:bg-google-darkSurface border border-google-border dark:border-google-darkBorder rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between select-none">
                <div>
                    <!-- Banner Skeleton -->
                    <div class="h-32 bg-gray-200 dark:bg-gray-800 p-5 flex flex-col justify-between">
                        <div class="flex items-start justify-between">
                            <div class="w-16 h-5 rounded-full bg-gray-300 dark:bg-gray-700"></div>
                            <div class="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="w-3/4 h-5 rounded-md bg-gray-300 dark:bg-gray-700"></div>
                            <div class="w-1/2 h-3.5 rounded-md bg-gray-300 dark:bg-gray-700"></div>
                        </div>
                    </div>
                    <!-- Body Skeleton -->
                    <div class="p-5 space-y-3">
                        <div class="flex items-center justify-between">
                            <div class="w-24 h-3.5 rounded bg-gray-200 dark:bg-gray-800"></div>
                            <div class="w-20 h-3.5 rounded bg-gray-200 dark:bg-gray-800"></div>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="w-20 h-3.5 rounded bg-gray-200 dark:bg-gray-800"></div>
                            <div class="w-12 h-3.5 rounded bg-gray-200 dark:bg-gray-800"></div>
                        </div>
                    </div>
                </div>
                <!-- Footer Skeleton -->
                <div class="px-5 py-3.5 bg-gray-50 dark:bg-gray-800/60 border-t border-google-border dark:border-google-darkBorder flex items-center justify-between">
                    <div class="w-14 h-5 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                    <div class="w-16 h-5 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                </div>
            </div>
        `).join('');
        return;
    }

    if (badgeEl) badgeEl.textContent = allCourses.length;

    if (allCourses.length === 0) {
        if (isGuest) {
            container.innerHTML = `
                <div class="col-span-full py-14 text-center space-y-4 bg-white dark:bg-google-darkSurface rounded-3xl border border-google-border dark:border-google-darkBorder p-8 shadow-sm">
                    <div class="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-google-blue dark:text-google-blueDarkTheme flex items-center justify-center mx-auto shadow-inner">
                        <i class="fa-solid fa-graduation-cap text-3xl"></i>
                    </div>
                    <div class="space-y-1.5 max-w-md mx-auto">
                        <h3 class="font-bold text-gray-800 dark:text-gray-200 text-sm">Добро пожаловать в Google Класс!</h3>
                        <p class="text-xs text-google-gray dark:text-gray-400">Вы находитесь в режиме гостя. Чтобы создавать свои курсы или присоединяться к учебным группам, выполните вход через Google вверху страницы.</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="col-span-full py-14 text-center space-y-4 bg-white dark:bg-google-darkSurface rounded-3xl border border-google-border dark:border-google-darkBorder p-8 shadow-sm">
                    <div class="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-google-blue dark:text-google-blueDarkTheme flex items-center justify-center mx-auto shadow-inner">
                        <i class="fa-solid fa-chalkboard-user text-3xl"></i>
                    </div>
                    <div class="space-y-1.5 max-w-md mx-auto">
                        <h3 class="font-bold text-gray-800 dark:text-gray-200 text-sm">У вас пока нет активных курсов</h3>
                        <p class="text-xs text-google-gray dark:text-gray-400">Присоединитесь по коду от преподавателя или создайте свой собственный курс.</p>
                    </div>
                    <div class="pt-2 flex justify-center space-x-3">
                        <button onclick="document.getElementById('modal-join-course').classList.remove('hidden')" class="px-4 py-2 bg-google-blue text-white rounded-xl text-xs font-semibold shadow hover:bg-google-blueDark transition">
                            Присоединиться
                        </button>
                        <button onclick="document.getElementById('modal-create-course').classList.remove('hidden')" class="px-4 py-2 border border-google-border dark:border-google-darkBorder text-xs font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                            Создать курс
                        </button>
                    </div>
                </div>
            `;
        }
        return;
    }

    container.innerHTML = allCourses.map(course => {
        const teacher = (appState.accounts || []).find(a => a.id === course.teacherId) || { name: 'Преподаватель курса' };
        const isMember = (course.studentIds || []).includes(user.id) || isCourseTeacher(course, user);
        const canArchive = isCourseTeacher(course, user);

        return `
            <div onclick="if(isGuestUser()){ triggerToast('В гостевом режиме вход на курсы недоступен. Пожалуйста, выполните вход через Google.', true); triggerGoogleSignIn(); return; } if(!${isMember}){ window.joinCourseDirectly('${course.code}'); } else { window.navigateTo('course', '${course.id}'); }" class="group bg-white dark:bg-google-darkSurface border border-google-border dark:border-google-darkBorder rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer hover:-translate-y-1">
                <div>
                    <!-- Header Banner -->
                    ${course.banner ? `
                        <div class="h-32 relative p-5 flex flex-col justify-between overflow-hidden bg-cover bg-center" style="background-image: url('${course.banner}');">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 z-0"></div>
                    ` : `
                        <div class="h-32 bg-gradient-to-tr ${course.gradient || 'from-blue-600 to-indigo-700'} relative p-5 flex flex-col justify-between overflow-hidden">
                    `}
                        <div class="relative z-10 flex items-start justify-between">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 backdrop-blur-md text-white border border-white/30 tracking-wider">
                                ${course.code}
                            </span>
                            <span class="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold flex items-center justify-center border border-white/30 shadow-sm">
                                ${getCourseBadgeLetters(course.name)}
                            </span>
                        </div>
                        <div class="relative z-10">
                            <h3 class="text-base font-bold text-white tracking-tight line-clamp-1 group-hover:underline">${escapeHtml(course.name)}</h3>
                            <p class="text-xs text-white/80 line-clamp-1 mt-0.5">${escapeHtml(course.section || 'Основной раздел')}</p>
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div class="p-5 space-y-3 text-xs text-google-gray">
                        <div class="flex items-center justify-between">
                            <span class="flex items-center space-x-1.5">
                                <i class="fa-solid fa-chalkboard-user text-[11px] text-google-blue"></i>
                                <span>Преподаватель:</span>
                            </span>
                            <span class="font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[130px]">${escapeHtml(teacher.name)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="flex items-center space-x-1.5">
                                <i class="fa-solid fa-users text-[11px] text-purple-500"></i>
                                <span>Студентов:</span>
                            </span>
                            <span class="font-semibold text-gray-800 dark:text-gray-100">${(course.studentIds || []).length} чел.</span>
                        </div>
                    </div>
                </div>

                <!-- Card Footer -->
                <div class="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-t border-google-border dark:border-google-darkBorder flex items-center justify-between text-xs text-google-gray">
                    <span class="font-mono text-[11px] font-bold bg-white dark:bg-gray-700 px-2.5 py-0.5 rounded-lg border border-google-border dark:border-google-darkBorder tracking-wider">
                        ${course.code}
                    </span>
                    <div class="flex items-center space-x-2">
                        ${!isMember && !isGuest ? `
                            <button onclick="event.stopPropagation(); window.joinCourseDirectly('${course.code}')" title="Записаться на курс" class="px-2.5 py-1 rounded-lg bg-google-blue hover:bg-google-blueDark text-white font-medium text-[11px] shadow-sm transition flex items-center space-x-1">
                                <i class="fa-solid fa-plus text-[10px]"></i>
                                <span>Записаться</span>
                            </button>
                        ` : ''}
                        ${canArchive ? `
                            <button onclick="event.stopPropagation(); window.quickArchiveCourse('${course.id}')" title="Архивировать курс" class="p-1.5 px-2.5 rounded-lg text-google-gray hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs transition flex items-center space-x-1">
                                <i class="fa-solid fa-box-archive text-[11px]"></i>
                                <span class="hidden sm:inline text-[11px]">В архив</span>
                            </button>
                        ` : ''}
                        <div class="flex items-center space-x-1.5 text-google-blue font-medium text-xs group-hover:translate-x-0.5 transition-transform">
                            <span>${isMember ? 'Перейти' : 'Обзор'}</span>
                            <i class="fa-solid fa-arrow-right text-xs"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderCurrentCourseView(course) {
    if (!course) return;

    const user = getCurrentUser();
    const isTeacher = isCourseTeacher(course, user);
    const isMember = (course.studentIds || []).includes(user.id) || isTeacher;

    // Hero banner container
    const heroBanner = document.getElementById('course-hero-banner');
    if (heroBanner) {
        if (course.banner) {
            heroBanner.style.backgroundImage = `url('${course.banner}')`;
            heroBanner.style.backgroundSize = 'cover';
            heroBanner.style.backgroundPosition = 'center';
        } else {
            heroBanner.style.backgroundImage = '';
            heroBanner.className = `rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden transition-all duration-300 min-h-[220px] flex flex-col justify-between bg-gradient-to-tr ${course.gradient || 'from-blue-600 to-indigo-700'}`;
        }
    }

    const titleEl = document.getElementById('hero-banner-title');
    if (titleEl) titleEl.textContent = course.name || 'Курс';

    const subBadge = document.getElementById('hero-banner-subject-badge');
    if (subBadge) {
        subBadge.textContent = course.subject || 'Учебный предмет';
        subBadge.classList.toggle('hidden', !course.subject);
    }

    const subTitleEl = document.getElementById('hero-banner-subtitle');
    if (subTitleEl) subTitleEl.textContent = course.section || 'Основной раздел';

    const teacher = (appState.accounts || []).find(a => a.id === course.teacherId || (a.email && a.email.toLowerCase() === (course.teacherEmail || '').toLowerCase())) || { name: course.teacherName || 'Преподаватель' };
    const authorTextEl = document.getElementById('hero-banner-author-text');
    if (authorTextEl) authorTextEl.textContent = `Преподаватель: ${teacher.name}`;

    // Course Code block
    if (!course.code) {
        course.code = Math.random().toString(36).substring(2, 7).toUpperCase();
        persistState();
    }
    const codeEl = document.getElementById('hero-banner-code');
    if (codeEl) codeEl.textContent = course.code;

    // Permissions: Settings button
    const settingsBtn = document.getElementById('btn-open-course-settings');
    if (settingsBtn) {
        settingsBtn.classList.toggle('hidden', !isTeacher);
        settingsBtn.onclick = () => openCourseSettingsModal(course);
    }

    // Course Archived Warning Banner
    const archivedBanner = document.getElementById('course-archived-banner');
    const restoreBtnContainer = document.getElementById('course-archived-restore-btn-container');
    if (archivedBanner) {
        archivedBanner.classList.toggle('hidden', !course.isArchived);
        if (restoreBtnContainer) {
            if (course.isArchived && isTeacher) {
                restoreBtnContainer.innerHTML = `
                    <button onclick="window.restoreCourse('${course.id}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow transition flex items-center space-x-1.5">
                        <i class="fa-solid fa-rotate-left text-xs"></i>
                        <span>Восстановить курс</span>
                    </button>
                `;
            } else {
                restoreBtnContainer.innerHTML = '';
            }
        }
    }

    // Course Preview Banner (for users who are not yet members of this course)
    const previewBanner = document.getElementById('course-preview-banner');
    const previewJoinBtnContainer = document.getElementById('course-preview-join-btn-container');
    if (previewBanner) {
        previewBanner.classList.toggle('hidden', isMember || Boolean(course.isArchived));
        if (previewJoinBtnContainer) {
            if (!isMember && !course.isArchived) {
                previewJoinBtnContainer.innerHTML = `
                    <button onclick="window.joinCourseDirectly('${course.code}')" class="px-4 py-2 bg-google-blue hover:bg-google-blueDark text-white rounded-xl text-xs font-semibold shadow transition flex items-center space-x-2">
                        <i class="fa-solid fa-plus text-xs"></i>
                        <span>Записаться на курс</span>
                    </button>
                `;
            } else {
                previewJoinBtnContainer.innerHTML = '';
            }
        }
    }

    // Teacher vs Student Tab controls
    const gradesTab = document.getElementById('tab-btn-grades');
    const gradesMobileTab = document.getElementById('tab-btn-grades-mobile');
    const createAssignBtn = document.getElementById('btn-trigger-create-assignment');

    if (gradesTab) gradesTab.classList.toggle('hidden', !isTeacher);
    if (gradesMobileTab) gradesMobileTab.classList.toggle('hidden', !isTeacher);
    if (createAssignBtn) {
        createAssignBtn.classList.toggle('hidden', !isTeacher || Boolean(course.isArchived));
        createAssignBtn.onclick = () => {
            if (course.isArchived) {
                triggerToast('Курс заархивирован: создание заданий заблокировано', true);
                return;
            }
            window.navigateTo('create-assignment', course.id);
        };
    }

    // Left sidebar meta cards
    const metaSubject = document.getElementById('course-meta-subject');
    const metaTeacher = document.getElementById('course-meta-teacher');
    const metaStudents = document.getElementById('course-meta-students');

    if (metaSubject) {
        metaSubject.innerHTML = `<span>Предмет: <strong>${course.subject || 'Общий курс'}</strong></span>`;
    }
    if (metaTeacher) {
        metaTeacher.innerHTML = `<i class="fa-solid fa-chalkboard-user text-google-green"></i> <span>Преподаватель: <strong>${teacher.name}</strong></span>`;
    }
    if (metaStudents) {
        metaStudents.innerHTML = `<i class="fa-solid fa-users text-purple-500"></i> <span>Записано студентов: <strong>${(course.studentIds || []).length}</strong></span>`;
    }

    initAnnouncementBox(course);
    renderStreamDeadlines(course);
    renderStreamTab(course);
    if (typeof renderClassworkTab === 'function') renderClassworkTab(course);
    renderPeopleTab(course);
    if (isTeacher) renderGradesTab(course);
}

function renderStreamDeadlines(course) {
    const container = document.getElementById('stream-deadlines-container');
    if (!container) return;

    if (!course) {
        container.innerHTML = '<p class="text-google-gray italic">Курс не найден</p>';
        return;
    }

    const user = getCurrentUser();
    const isTeacher = isCourseTeacher(course, user);
    const assigns = (appState.assignments || []).filter(a => a.courseId === course.id);

    if (assigns.length === 0) {
        container.innerHTML = `
            <div class="py-2 space-y-1">
                <p class="text-google-gray dark:text-gray-400">В этом курсе пока нет заданий</p>
            </div>
        `;
        return;
    }

    if (isTeacher) {
        // Teacher view: show assignments needing attention/grading
        const pendingGrading = assigns.filter(a => {
            const subs = a.submissions || {};
            const unGraded = Object.values(subs).filter(s => s && s.submittedAt && s.grade === undefined);
            return unGraded.length > 0;
        });

        if (pendingGrading.length === 0) {
            container.innerHTML = `
                <div class="py-1.5 space-y-1 text-google-gray dark:text-gray-400">
                    <p class="text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1.5">
                        <i class="fa-solid fa-circle-check text-xs"></i>
                        <span>Все работы проверены</span>
                    </p>
                    <p class="text-[11px]">Нет ожидающих оценки работ</p>
                </div>
            `;
            return;
        }

        container.innerHTML = pendingGrading.slice(0, 4).map(a => {
            const subs = a.submissions || {};
            const count = Object.values(subs).filter(s => s && s.submittedAt && s.grade === undefined).length;
            return `
                <div onclick="window.navigateTo('assignment', '${course.id}', '${a.id}')" class="p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border border-google-border dark:border-google-darkBorder transition group">
                    <p class="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-google-blue dark:group-hover:text-google-blueDarkTheme truncate">${escapeHtml(a.title)}</p>
                    <p class="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Ожидают оценки: ${count} чел.</p>
                </div>
            `;
        }).join('');
        return;
    }

    // Student view: show pending / unsubmitted assignments sorted by deadline
    const unsubmitted = assigns.filter(a => {
        const sub = a.submissions && a.submissions[user.id];
        return !sub || !sub.submittedAt;
    });

    if (unsubmitted.length === 0) {
        container.innerHTML = `
            <div class="py-1.5 space-y-1 text-google-gray dark:text-gray-400">
                <p class="text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1.5">
                    <i class="fa-solid fa-circle-check text-xs"></i>
                    <span>Все задания сданы!</span>
                </p>
                <p class="text-[11px]">На ближайшее время несделанных заданий нет.</p>
            </div>
        `;
        return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Sort: earliest deadline first, missing first
    unsubmitted.sort((a, b) => {
        if (!a.deadline || a.deadline === 'Без срока') return 1;
        if (!b.deadline || b.deadline === 'Без срока') return -1;
        return a.deadline.localeCompare(b.deadline);
    });

    container.innerHTML = unsubmitted.slice(0, 4).map(a => {
        let deadlineLabel = 'Без срока сдачи';
        let badgeColor = 'text-google-gray';

        if (a.deadline && a.deadline !== 'Без срока') {
            const dDate = new Date(a.deadline + 'T23:59:59');
            if (!isNaN(dDate.getTime())) {
                const diffDays = Math.ceil((dDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (dDate < now) {
                    deadlineLabel = `Просрочено: ${a.deadline}`;
                    badgeColor = 'text-red-500 font-semibold';
                } else if (diffDays <= 1) {
                    deadlineLabel = `Сдать сегодня: ${a.deadline}`;
                    badgeColor = 'text-amber-600 dark:text-amber-400 font-semibold';
                } else if (diffDays <= 2) {
                    deadlineLabel = `Сдать завтра: ${a.deadline}`;
                    badgeColor = 'text-blue-600 dark:text-blue-400 font-medium';
                } else {
                    deadlineLabel = `Срок: ${a.deadline}`;
                    badgeColor = 'text-google-gray dark:text-gray-400';
                }
            } else {
                deadlineLabel = `Срок: ${a.deadline}`;
            }
        }

        return `
            <div onclick="window.navigateTo('assignment', '${course.id}', '${a.id}')" class="p-2.5 rounded-xl hover:bg-blue-50/50 dark:hover:bg-gray-800 cursor-pointer border border-google-border dark:border-google-darkBorder transition group">
                <p class="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-google-blue dark:group-hover:text-google-blueDarkTheme truncate">${escapeHtml(a.title)}</p>
                <p class="text-[11px] ${badgeColor} mt-0.5 truncate">${deadlineLabel}</p>
            </div>
        `;
    }).join('');
}

function openCourseSettingsModal(course) {
    if (!course) return;
    const modal = document.getElementById('modal-course-settings');
    if (!modal) return;

    window.editingCourseSettings = {
        id: course.id,
        name: course.name || '',
        section: course.section || '',
        subject: course.subject || '',
        description: course.description || '',
        banner: course.banner || '',
        gradient: course.gradient || 'from-blue-600 to-indigo-700'
    };

    const nameInput = document.getElementById('input-course-settings-name');
    const sectionInput = document.getElementById('input-course-settings-section');
    const subjectInput = document.getElementById('input-course-settings-subject');
    const descInput = document.getElementById('input-course-settings-desc');
    const bannerUrlInput = document.getElementById('input-course-settings-banner-url');
    const bannerFileInput = document.getElementById('input-course-settings-banner-file');

    if (nameInput) nameInput.value = window.editingCourseSettings.name;
    if (sectionInput) sectionInput.value = window.editingCourseSettings.section;
    if (subjectInput) subjectInput.value = window.editingCourseSettings.subject;
    if (descInput) descInput.value = window.editingCourseSettings.description;
    if (bannerUrlInput) {
        bannerUrlInput.value = (window.editingCourseSettings.banner && !window.editingCourseSettings.banner.startsWith('data:')) ? window.editingCourseSettings.banner : '';
    }

    // Preset click listeners
    const presetOptions = document.querySelectorAll('#course-settings-banner-presets .course-settings-preset-option');
    presetOptions.forEach(opt => {
        const img = opt.dataset.img || '';
        const grad = opt.dataset.grad || '';
        if (img === window.editingCourseSettings.banner) {
            opt.classList.add('border-google-blue', 'scale-105');
            opt.classList.remove('border-transparent');
        } else {
            opt.classList.remove('border-google-blue', 'scale-105');
            opt.classList.add('border-transparent');
        }

        opt.onclick = () => {
            window.editingCourseSettings.banner = img;
            window.editingCourseSettings.gradient = grad;
            if (bannerUrlInput) bannerUrlInput.value = '';
            presetOptions.forEach(o => {
                o.classList.remove('border-google-blue', 'scale-105');
                o.classList.add('border-transparent');
            });
            opt.classList.add('border-google-blue', 'scale-105');
            opt.classList.remove('border-transparent');
        };
    });

    if (bannerUrlInput) {
        bannerUrlInput.oninput = () => {
            window.editingCourseSettings.banner = bannerUrlInput.value.trim();
            presetOptions.forEach(o => {
                o.classList.remove('border-google-blue', 'scale-105');
                o.classList.add('border-transparent');
            });
        };
    }

    if (bannerFileInput) {
        bannerFileInput.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    window.editingCourseSettings.banner = event.target.result;
                    if (bannerUrlInput) bannerUrlInput.value = '';
                    presetOptions.forEach(o => {
                        o.classList.remove('border-google-blue', 'scale-105');
                        o.classList.add('border-transparent');
                    });
                    triggerToast('Обложка курса выбрана');
                };
                reader.readAsDataURL(file);
            }
        };
    }

    // Save button
    const btnSave = document.getElementById('btn-save-course-settings');
    if (btnSave) {
        btnSave.onclick = async () => {
            const updatedName = nameInput ? nameInput.value.trim() : '';
            if (!updatedName) {
                triggerToast('Название курса не может быть пустым', true);
                return;
            }

            const cIdx = (appState.courses || []).findIndex(c => c.id === course.id);
            if (cIdx === -1) return;

            const updatedCourse = appState.courses[cIdx];
            updatedCourse.name = updatedName;
            updatedCourse.section = sectionInput ? sectionInput.value.trim() : '';
            updatedCourse.subject = subjectInput ? subjectInput.value.trim() : '';
            updatedCourse.description = descInput ? descInput.value.trim() : '';
            if (window.editingCourseSettings.banner) {
                updatedCourse.banner = window.editingCourseSettings.banner;
            }
            if (window.editingCourseSettings.gradient) {
                updatedCourse.gradient = window.editingCourseSettings.gradient;
            }

            persistState();
            modal.classList.add('hidden');
            renderCurrentCourseView(updatedCourse);
            renderSidebar();
            renderDashboard();
            triggerToast('Курс успешно обновлен!');

            await sendServerAction('/api/courses/update', updatedCourse);
        };
    }

    // Archive button for creator/teacher
    const btnArchive = document.getElementById('btn-archive-current-course');
    const archiveBox = document.getElementById('course-settings-archive-box');
    const isTeacher = isCourseTeacher(course, getCurrentUser());
    if (archiveBox) archiveBox.classList.toggle('hidden', !isTeacher);
    if (btnArchive) {
        btnArchive.onclick = async () => {
            modal.classList.add('hidden');
            await window.quickArchiveCourse(course.id);
        };
    }

    // Delete button
    const btnDelete = document.getElementById('btn-delete-current-course');
    if (btnDelete) {
        btnDelete.onclick = async () => {
            if (!confirm(`Вы действительно хотите удалить курс "${course.name}"? Это действие необратимо.`)) {
                return;
            }

            appState.courses = (appState.courses || []).filter(c => c.id !== course.id);
            appState.assignments = (appState.assignments || []).filter(a => a.courseId !== course.id);
            appState.announcements = (appState.announcements || []).filter(a => a.courseId !== course.id);

            persistState();
            modal.classList.add('hidden');
            triggerToast(`Курс "${course.name}" удален`);
            renderSidebar();
            renderDashboard();
            window.navigateTo('dashboard');

            await sendServerAction('/api/courses/delete', { id: course.id });
        };
    }

    modal.classList.remove('hidden');
}

let pendingAnnouncementAttachments = [];

function initAnnouncementBox(course) {
    const user = getCurrentUser();
    const isTeacher = isCourseTeacher(course, user);
    const box = document.getElementById('announcement-collapsed')?.parentElement;
    if (!box) return;

    if (!isTeacher || Boolean(course.isArchived)) {
        box.classList.add('hidden');
        return;
    }
    box.classList.remove('hidden');

    const col = document.getElementById('announcement-collapsed');
    const exp = document.getElementById('announcement-expanded');
    const avatarEl = document.getElementById('announcement-user-avatar');
    const bodyInput = document.getElementById('input-announcement-body');
    const previewEl = document.getElementById('announcement-attachments-preview');

    if (avatarEl) {
        if (user.photoUrl) {
            avatarEl.innerHTML = `<img src="${user.photoUrl}" class="w-full h-full object-cover">`;
            avatarEl.className = 'w-10 h-10 rounded-full overflow-hidden shadow-sm shrink-0 bg-gray-200 dark:bg-gray-700';
        } else {
            avatarEl.textContent = user.avatar || 'ИС';
            avatarEl.className = `w-10 h-10 rounded-full bg-gradient-to-tr ${user.bg || 'from-blue-600 to-indigo-600'} text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0`;
        }
    }

    const isTyping = bodyInput && (bodyInput.value.trim() || document.activeElement === bodyInput || (exp && !exp.classList.contains('hidden')));
    if (!isTyping) {
        pendingAnnouncementAttachments = [];
        if (bodyInput) bodyInput.value = '';
        if (previewEl) previewEl.innerHTML = '';
        if (col) col.classList.remove('hidden');
        if (exp) exp.classList.add('hidden');
    }

    if (col) {
        col.onclick = () => {
            col.classList.add('hidden');
            if (exp) exp.classList.remove('hidden');
            if (bodyInput) bodyInput.focus();
        };
    }

    const btnCancel = document.getElementById('btn-announcement-cancel');
    if (btnCancel) {
        btnCancel.onclick = () => {
            if (col) col.classList.remove('hidden');
            if (exp) exp.classList.add('hidden');
            if (bodyInput) bodyInput.value = '';
            pendingAnnouncementAttachments = [];
            if (previewEl) previewEl.innerHTML = '';
        };
    }

    const renderAnnAttachments = () => {
        if (!previewEl) return;
        previewEl.innerHTML = pendingAnnouncementAttachments.map((att, idx) => `
            <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950 text-xs text-google-blue font-medium border border-blue-200 dark:border-blue-800">
                <i class="fa-solid ${att.type === 'video' ? 'fa-video text-red-500' : (att.type === 'file' ? 'fa-paperclip' : 'fa-link text-emerald-500')}"></i>
                <span class="max-w-[150px] truncate">${att.name || att.label}</span>
                <button type="button" onclick="pendingAnnouncementAttachments.splice(${idx}, 1); renderAnnAttachments();" class="ml-1 hover:text-red-500">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </span>
        `).join('');
    };
    window.renderAnnAttachments = renderAnnAttachments;

    const btnLink = document.getElementById('btn-attach-link');
    if (btnLink) {
        btnLink.onclick = () => {
            const url = prompt('Введите URL ссылки:', 'https://');
            if (url) {
                const label = prompt('Название ссылки:', 'Полезный материал') || url;
                pendingAnnouncementAttachments.push({ type: 'link', label, name: label, url });
                renderAnnAttachments();
            }
        };
    }

    const btnVideo = document.getElementById('btn-attach-video');
    if (btnVideo) {
        btnVideo.onclick = () => {
            const url = prompt('Ссылка на YouTube:', 'https://youtube.com/watch?v=');
            if (url) {
                const label = prompt('Название видео:', 'Видеоматериал') || 'YouTube видео';
                pendingAnnouncementAttachments.push({ type: 'video', label, name: label, url });
                renderAnnAttachments();
            }
        };
    }

    const inputFile = document.getElementById('input-announcement-file');
    const btnFile = document.getElementById('btn-attach-file');
    if (btnFile && inputFile) {
        btnFile.onclick = () => inputFile.click();
        inputFile.onchange = async (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                let fileUrl = '#';
                if (typeof readFileAsAttachment === 'function') {
                    const att = await readFileAsAttachment(file);
                    fileUrl = att.url;
                } else {
                    fileUrl = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onload = ev => resolve(ev.target.result || '#');
                        reader.onerror = () => resolve('#');
                        reader.readAsDataURL(file);
                    });
                }
                pendingAnnouncementAttachments.push({ type: 'file', label: file.name, name: file.name, url: fileUrl });
                renderAnnAttachments();
                inputFile.value = '';
            }
        };
    }

    const btnPublish = document.getElementById('btn-announcement-publish');
    if (btnPublish) {
        btnPublish.onclick = async () => {
            const text = bodyInput ? bodyInput.value.trim() : '';
            if (!text && pendingAnnouncementAttachments.length === 0) {
                triggerToast('Введите текст записи или прикрепите файл', true);
                return;
            }

            if (btnPublish.disabled) return;
            btnPublish.disabled = true;

            const newAnn = {
                id: 'ann_' + Date.now(),
                courseId: course.id,
                authorId: user.id,
                authorName: user.name,
                authorAvatar: user.avatar,
                authorPhoto: user.photoUrl || '',
                authorBg: user.bg || 'from-blue-600 to-indigo-600',
                date: 'Сегодня',
                body: text,
                attachments: [...pendingAnnouncementAttachments],
                comments: []
            };

            if (!appState.announcements) appState.announcements = [];
            appState.announcements.unshift(newAnn);
            persistState();

            if (col) col.classList.remove('hidden');
            if (exp) exp.classList.add('hidden');
            if (bodyInput) bodyInput.value = '';
            pendingAnnouncementAttachments = [];
            if (previewEl) previewEl.innerHTML = '';

            renderStreamTab(course);
            triggerToast('Запись опубликована в ленте!');

            try {
                await sendServerAction('/api/announcements/create', newAnn);
            } finally {
                btnPublish.disabled = false;
            }
        };
    }
}

function renderStreamTab(course) {
    const list = document.getElementById('stream-feed-list') || document.getElementById('stream-posts-list');
    if (!list) return;

    const anns = (appState.announcements || []).filter(a => a.courseId === course.id);
    if (anns.length === 0) {
        list.innerHTML = `
            <div class="p-8 text-center text-xs text-google-gray bg-white dark:bg-google-darkSurface border border-google-border dark:border-google-darkBorder rounded-3xl space-y-1">
                <i class="fa-solid fa-bullhorn text-2xl text-google-blue opacity-50 mb-2"></i>
                <p class="font-medium text-gray-800 dark:text-gray-200">В ленте пока нет объявлений</p>
                <p>Здесь будут появляться новости и материалы вашего курса</p>
            </div>
        `;
        return;
    }

    list.innerHTML = anns.map(a => {
        const attsHtml = (a.attachments || []).map(att => {
            const isDataUrl = att.url && att.url.startsWith('data:');
            const safeName = (att.label || att.name || 'Материал').replace(/'/g, "\\'");
            return `
            <div onclick="openAttachmentResource('${att.url}', '${safeName}')" class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs text-google-blue dark:text-google-blueDarkTheme hover:underline border border-google-border dark:border-google-darkBorder cursor-pointer transition">
                <i class="fa-solid ${att.type === 'video' ? 'fa-video text-red-500' : (att.type === 'file' ? 'fa-paperclip text-google-blue' : 'fa-link text-emerald-500')}"></i>
                <span class="truncate max-w-[200px]">${att.label || att.name || 'Материал'}</span>
            </div>
            `;
        }).join('');

        const commentsHtml = (a.comments || []).map(c => {
            const cAuthor = (appState.accounts || []).find(acc => acc.name === c.authorName) || {};
            const cPhoto = c.authorPhoto || cAuthor.photoUrl;
            const cAvatarHtml = cPhoto
                ? `<img src="${cPhoto}" class="w-6 h-6 rounded-full object-cover shrink-0">`
                : `<div class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-google-blue dark:text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0">${c.authorAvatar || 'С'}</div>`;

            return `
            <div class="flex items-start space-x-2.5 text-xs pt-2">
                ${cAvatarHtml}
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-gray-900 dark:text-gray-100">${c.authorName} <span class="font-normal text-[10px] text-google-gray ml-1">${c.date || ''}</span></p>
                    <p class="text-gray-700 dark:text-gray-300">${c.text}</p>
                </div>
            </div>
            `;
        }).join('');

        const author = (appState.accounts || []).find(acc => acc.id === a.authorId || acc.name === a.authorName) || {};
        const photo = a.authorPhoto || author.photoUrl;
        const avatarElHtml = photo
            ? `<img src="${photo}" class="w-10 h-10 rounded-full object-cover shadow-sm shrink-0">`
            : `<div class="w-10 h-10 rounded-full bg-gradient-to-tr ${a.authorBg || author.bg || 'from-blue-600 to-indigo-600'} text-white font-bold flex items-center justify-center text-xs shadow-sm shrink-0">${a.authorAvatar || author.avatar || 'П'}</div>`;

        return `
            <div class="bg-white dark:bg-google-darkSurface border border-google-border dark:border-google-darkBorder rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div class="flex items-center space-x-3">
                    ${avatarElHtml}
                    <div>
                        <p class="text-xs font-bold text-gray-900 dark:text-gray-100">${a.authorName}</p>
                        <p class="text-[10px] text-google-gray">${a.date || 'Только что'}</p>
                    </div>
                </div>

                <div class="text-xs text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                    ${a.body}
                </div>

                ${attsHtml ? `<div class="flex flex-wrap gap-2 pt-1">${attsHtml}</div>` : ''}

                <!-- Comments Section -->
                <div class="border-t border-google-border dark:border-google-darkBorder pt-3 space-y-2">
                    ${commentsHtml}
                    ${course.isArchived ? `
                        <div class="text-[11px] text-google-gray italic py-1.5 flex items-center space-x-1.5">
                            <i class="fa-solid fa-lock text-[10px]"></i>
                            <span>Курс заархивирован: комментарии к записи отключены</span>
                        </div>
                    ` : `
                        <div class="flex items-center space-x-2 pt-2">
                            <input id="ann-comm-input-${a.id}" type="text" placeholder="Добавьте комментарий к записи..." class="flex-1 px-3.5 py-2 rounded-xl border border-google-border dark:border-google-darkBorder bg-gray-50 dark:bg-gray-800 text-xs focus:ring-2 focus:ring-google-blue focus:outline-none">
                            <button onclick="sendAnnouncementComment('${a.id}')" class="px-3.5 py-2 rounded-xl bg-google-blue hover:bg-google-blueDark text-white text-xs font-semibold shadow transition">
                                Отправить
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

window.sendAnnouncementComment = async function(annId) {
    const currentCourse = (appState.courses || []).find(c => c.id === appState.currentCourseId);
    if (currentCourse && currentCourse.isArchived) {
        triggerToast('Курс заархивирован: добавление комментариев заблокировано', true);
        return;
    }

    const input = document.getElementById(`ann-comm-input-${annId}`);
    if (!input || !input.value.trim()) return;

    const user = getCurrentUser();
    const text = input.value.trim();
    input.value = '';

    const newComment = {
        id: 'comm_' + Date.now(),
        announcementId: annId,
        authorName: user.name,
        authorAvatar: user.avatar,
        authorPhoto: user.photoUrl || '',
        text,
        date: 'Только что'
    };

    const ann = (appState.announcements || []).find(a => a.id === annId);
    if (ann) {
        if (!ann.comments) ann.comments = [];
        ann.comments.push(newComment);
        persistState();
        renderStreamTab(appState.courses.find(c => c.id === appState.currentCourseId));

        if (typeof dispatchNotification === 'function') {
            dispatchNotification({
                type: 'comment_post',
                courseId: ann.courseId,
                targetUserId: ann.authorId,
                title: 'Новый комментарий к записи в ленте',
                text: `${user.name}: "${text.length > 40 ? text.substring(0, 40) + '...' : text}"`
            });
        }
    }

    await sendServerAction('/api/announcements/comment', newComment);
};

function renderPeopleTab(course) {
    const teacher = (appState.accounts || []).find(a => a.id === course.teacherId || (a.email && a.email.toLowerCase() === (course.teacherEmail || '').toLowerCase())) || { name: course.teacherName || 'Преподаватель курса', email: course.teacherEmail || '' };
    const coTeacherIds = course.coTeacherIds || [];
    const coTeachers = (appState.accounts || []).filter(a => coTeacherIds.includes(a.id));

    const teachersListEl = document.getElementById('people-teachers-list');
    if (teachersListEl) {
        teachersListEl.innerHTML = [teacher, ...coTeachers].map(t => {
            const avatarHtml = t.photoUrl
                ? `<img src="${t.photoUrl}" class="w-10 h-10 rounded-full object-cover shadow shrink-0">`
                : `<span class="w-10 h-10 rounded-full bg-gradient-to-tr ${t.bg || 'from-blue-600 to-indigo-600'} text-white font-bold flex items-center justify-center text-xs shadow shrink-0">${t.avatar || 'П'}</span>`;
            return `
            <div class="py-3 flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    ${avatarHtml}
                    <div>
                        <p class="text-xs font-semibold text-gray-900 dark:text-gray-100">${t.name}</p>
                        <p class="text-[10px] text-google-gray">${t.email || ''}</p>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    // Students list
    const students = (appState.accounts || []).filter(a => (course.studentIds || []).includes(a.id));
    const countEl = document.getElementById('people-students-count');
    const studentsListEl = document.getElementById('people-students-list');

    if (countEl) countEl.textContent = `${students.length} студентов`;

    if (studentsListEl) {
        if (students.length === 0) {
            studentsListEl.innerHTML = `
                <div class="py-8 text-center text-xs text-google-gray space-y-1">
                    <p>На данный курс еще не записан ни один студент.</p>
                    <p class="font-mono text-google-blue font-bold">Код курса: ${course.code}</p>
                </div>
            `;
        } else {
            studentsListEl.innerHTML = students.map(s => {
                const sAvatarHtml = s.photoUrl
                    ? `<img src="${s.photoUrl}" class="w-10 h-10 rounded-full object-cover shadow shrink-0">`
                    : `<span class="w-10 h-10 rounded-full bg-gradient-to-tr ${s.bg || 'from-emerald-500 to-teal-600'} text-white font-bold flex items-center justify-center text-xs shadow shrink-0">${s.avatar || 'С'}</span>`;
                return `
                <div class="py-3 flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        ${sAvatarHtml}
                        <div>
                            <p class="text-xs font-semibold text-gray-900 dark:text-gray-100">${s.name}</p>
                            <p class="text-[10px] text-google-gray">${s.email || ''}</p>
                        </div>
                    </div>
                    ${isCourseTeacher(course) ? `
                        <button onclick="excludeStudentFromCourse('${course.id}', '${s.id}')" class="text-xs text-red-500 hover:text-red-700 hover:underline">
                            Исключить
                        </button>
                    ` : ''}
                </div>
                `;
            }).join('');
        }
    }
}

window.excludeStudentFromCourse = async function(courseId, studentId) {
    const course = (appState.courses || []).find(c => c.id === courseId);
    if (!course) return;
    const student = (appState.accounts || []).find(a => a.id === studentId) || { name: 'Студент' };
    if (!confirm(`Исключить студента "${student.name}" из курса?`)) return;

    course.studentIds = (course.studentIds || []).filter(id => id !== studentId);
    persistState();
    await sendServerAction('/api/courses/remove-student', { courseId, studentId });
    renderPeopleTab(course);
    triggerToast(`Студент ${student.name} исключен из курса`);
};

function renderGradesTab(course) {
    const headerRow = document.getElementById('grades-assignments-headers-row') || document.getElementById('grades-assignments-headers');
    const tableBody = document.getElementById('grades-table-body');
    const badgeStats = document.getElementById('grades-stats-badge');

    const assigns = (appState.assignments || []).filter(a => a.courseId === course.id);
    const students = (appState.accounts || []).filter(a => (course.studentIds || []).includes(a.id));

    if (badgeStats) badgeStats.textContent = `Заданий: ${assigns.length} • Студентов: ${students.length}`;

    if (headerRow) {
        // If headerRow is the <tr> itself
        if (headerRow.tagName === 'TR') {
            const studentTh = `
                <th class="p-3.5 w-64 min-w-[240px] max-w-[260px] sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)]">
                    Студент
                </th>
            `;
            const assignThs = assigns.map(a => `
                <th class="p-3 text-center border-l border-google-border dark:border-google-darkBorder w-36 min-w-[144px] max-w-[160px] bg-gray-50 dark:bg-gray-800" title="${escapeHtml(a.title)}">
                    <div class="truncate font-semibold text-gray-800 dark:text-gray-200 text-xs">${escapeHtml(a.title)}</div>
                    <span class="text-[10px] text-google-gray font-normal block mt-0.5">из ${a.points || 100} б.</span>
                </th>
            `).join('');
            headerRow.innerHTML = studentTh + assignThs;
        } else {
            // Fallback if headerRow is the element inside tr
            headerRow.innerHTML = assigns.map(a => `
                <th class="p-3 text-center border-l border-google-border dark:border-google-darkBorder w-36 min-w-[144px] max-w-[160px] bg-gray-50 dark:bg-gray-800" title="${escapeHtml(a.title)}">
                    <div class="truncate font-semibold text-gray-800 dark:text-gray-200 text-xs">${escapeHtml(a.title)}</div>
                    <span class="text-[10px] text-google-gray font-normal block mt-0.5">из ${a.points || 100} б.</span>
                </th>
            `).join('');
        }
    }

    if (tableBody) {
        if (students.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="${assigns.length + 1}" class="p-8 text-center text-xs text-google-gray">Нет зарегистрированных студентов для оценивания</td></tr>`;
            return;
        }

        tableBody.innerHTML = students.map(st => {
            const cells = assigns.map(a => {
                const submission = a.submissions && a.submissions[st.id];
                const gradeVal = submission && submission.grade !== undefined && submission.grade !== null ? submission.grade : '';
                const isSub = Boolean(submission && submission.submittedAt);
                return `
                    <td class="p-2.5 text-center border-l border-google-border dark:border-google-darkBorder w-36 min-w-[144px] max-w-[160px]">
                        <div class="flex flex-col items-center justify-center space-y-1">
                            <input type="number" value="${gradeVal}" min="0" max="${a.points || 100}" placeholder="—" ${course.isArchived ? 'disabled' : ''} onchange="saveStudentGrade('${a.id}', '${st.id}', this.value)" class="w-16 text-center py-1 rounded-xl border border-google-border dark:border-google-darkBorder bg-gray-50 dark:bg-gray-800/80 text-xs font-bold focus:ring-2 focus:ring-google-blue ${course.isArchived ? 'opacity-60 cursor-not-allowed' : ''}">
                            <span class="text-[10px] ${isSub ? 'text-google-green font-medium' : 'text-google-gray'}">${isSub ? 'Сдано' : 'Не сдано'}</span>
                        </div>
                    </td>
                `;
            }).join('');

            return `
                <tr class="border-b border-google-border dark:border-google-darkBorder hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition">
                    <td class="p-3.5 text-xs font-semibold text-gray-900 dark:text-gray-100 sticky left-0 z-10 bg-white dark:bg-google-darkSurface shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)] w-64 min-w-[240px] max-w-[260px]">
                        <div class="flex items-center space-x-2.5 truncate">
                            <span class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0">
                                ${st.avatar || 'С'}
                            </span>
                            <div class="truncate">
                                <p class="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">${escapeHtml(st.name)}</p>
                                <p class="text-[10px] text-google-gray truncate font-normal">${escapeHtml(st.email || 'Студент')}</p>
                            </div>
                        </div>
                    </td>
                    ${cells}
                </tr>
            `;
        }).join('');
    }
}

window.joinCourseDirectly = async function(code) {
    code = (code || '').trim().toUpperCase();
    if (!code) {
        triggerToast('Введите код курса', true);
        return;
    }

    if (isGuestUser()) {
        triggerToast('В режиме гостя нельзя присоединяться к курсам. Войдите через Google.', true);
        triggerGoogleSignIn();
        return;
    }

    const user = getCurrentUser();
    const course = (appState.courses || []).find(c => c.code === code);
    if (!course) {
        triggerToast('Курс с таким кодом не найден', true);
        return;
    }

    if (!course.studentIds) course.studentIds = [];
    if (course.studentIds.includes(user.id)) {
        window.navigateTo('course', course.id);
        return;
    }

    course.studentIds.push(user.id);
    persistState();
    
    try {
        await sendServerAction('/api/courses/join', { 
            code, 
            studentId: user.id, 
            userId: user.id 
        });
    } catch (e) {
        console.warn('joinCourseDirectly sync warning', e);
    }

    renderSidebar();
    renderDashboard();
    window.navigateTo('course', course.id);
    triggerToast(`Вы успешно записались на курс "${course.name}"!`);
};

// ----------------- ARCHIVED COURSES ENGINE (STAGE 3) -----------------

window.quickArchiveCourse = async function(courseId) {
    const user = getCurrentUser();
    const course = (appState.courses || []).find(c => c.id === courseId);
    if (!course) return;

    if (!isCourseTeacher(course, user)) {
        triggerToast('Только преподаватель или создатель курса может архивировать его', true);
        return;
    }

    if (!confirm(`Архивировать курс «${course.name}»?\n\nПреподаватели и учащиеся больше не смогут вносить изменения. Курс будет перемещен в раздел «Архив курсов».`)) {
        return;
    }

    course.isArchived = true;
    persistState();
    renderSidebar();
    renderDashboard();
    if (appState.currentCourseId === courseId) {
        window.navigateTo('dashboard');
    }
    triggerToast(`Курс «${course.name}» перемещен в архив`);

    await sendServerAction('/api/courses/update', course);
};

window.restoreCourse = async function(courseId) {
    const user = getCurrentUser();
    const course = (appState.courses || []).find(c => c.id === courseId);
    if (!course) return;

    if (!isCourseTeacher(course, user)) {
        triggerToast('Только создатель или преподаватель может восстановить курс', true);
        return;
    }

    course.isArchived = false;
    persistState();
    renderSidebar();
    renderDashboard();
    if (typeof window.renderArchivedCoursesView === 'function') {
        window.renderArchivedCoursesView();
    }
    triggerToast(`Курс «${course.name}» успешно восстановлен`);

    await sendServerAction('/api/courses/update', course);
};

window.deleteArchivedCourse = async function(courseId) {
    const user = getCurrentUser();
    const course = (appState.courses || []).find(c => c.id === courseId);
    if (!course) return;

    if (!isCourseTeacher(course, user)) {
        triggerToast('Только создатель курса может окончательно удалить его', true);
        return;
    }

    if (!confirm(`Окончательно удалить курс «${course.name}»?\n\nВсе задания, материалы, оценки и комментарии будут безвозвратно удалены. Это действие нельзя отменить.`)) {
        return;
    }

    appState.courses = (appState.courses || []).filter(c => c.id !== course.id);
    appState.assignments = (appState.assignments || []).filter(a => a.courseId !== course.id);
    appState.announcements = (appState.announcements || []).filter(a => a.courseId !== course.id);

    persistState();
    renderSidebar();
    renderDashboard();
    if (typeof window.renderArchivedCoursesView === 'function') {
        window.renderArchivedCoursesView();
    }
    triggerToast(`Курс «${course.name}» окончательно удален`);

    await sendServerAction('/api/courses/delete', { id: course.id });
};

window.renderArchivedCoursesView = function() {
    const container = document.getElementById('archived-courses-grid');
    const countBadge = document.getElementById('archived-courses-count-badge');
    if (!container) return;

    const user = getCurrentUser();

    const archivedCourses = (appState.courses || []).filter(c => {
        if (!c.isArchived) return false;
        return isCourseTeacher(c, user) || (c.studentIds || []).includes(user.id);
    });

    if (countBadge) countBadge.textContent = archivedCourses.length;

    if (archivedCourses.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-16 text-center space-y-4 bg-white dark:bg-google-darkSurface rounded-3xl border border-google-border dark:border-google-darkBorder p-8 shadow-sm">
                <div class="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                    <i class="fa-solid fa-box-archive text-3xl"></i>
                </div>
                <div class="space-y-1.5 max-w-md mx-auto">
                    <h3 class="font-bold text-gray-800 dark:text-gray-200 text-sm">В архиве пока ничего нет</h3>
                    <p class="text-xs text-google-gray dark:text-gray-400">Когда вы архивируете завершенные учебные курсы, они будут бережно храниться здесь.</p>
                </div>
                <div class="pt-2">
                    <button onclick="window.navigateTo('dashboard')" class="px-4 py-2 bg-google-blue text-white rounded-xl text-xs font-semibold shadow hover:bg-google-blueDark transition">
                        Вернуться к курсам
                    </button>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = archivedCourses.map(course => {
        const teacher = (appState.accounts || []).find(a => a.id === course.teacherId) || { name: 'Преподаватель курса' };
        const canManage = isCourseTeacher(course, user);

        return `
            <div class="bg-white dark:bg-google-darkSurface border border-google-border dark:border-google-darkBorder rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between relative group opacity-95 hover:opacity-100 transition">
                <div>
                    <!-- Banner -->
                    <div class="h-28 relative p-4 flex flex-col justify-between overflow-hidden ${course.banner ? 'bg-cover bg-center' : 'bg-gradient-to-tr ' + (course.gradient || 'from-gray-600 to-slate-700')}" style="${course.banner ? `background-image: url('${course.banner}');` : ''}">
                        <div class="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-0"></div>
                        <div class="relative z-10 flex items-start justify-between">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/80 text-white shadow-xs tracking-wider flex items-center space-x-1">
                                <i class="fa-solid fa-box-archive text-[9px]"></i>
                                <span>В архиве</span>
                            </span>
                            <span class="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold flex items-center justify-center border border-white/30">
                                ${getCourseBadgeLetters(course.name)}
                            </span>
                        </div>
                        <div class="relative z-10">
                            <h3 class="text-base font-bold text-white tracking-tight line-clamp-1">${escapeHtml(course.name)}</h3>
                            <p class="text-xs text-white/80 line-clamp-1 mt-0.5">${escapeHtml(course.section || 'Основной раздел')}</p>
                        </div>
                    </div>

                    <!-- Body -->
                    <div class="p-4 space-y-2.5 text-xs text-google-gray">
                        <div class="flex items-center justify-between">
                            <span class="flex items-center space-x-1.5">
                                <i class="fa-solid fa-chalkboard-user text-[11px] text-google-blue"></i>
                                <span>Преподаватель:</span>
                            </span>
                            <span class="font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[130px]">${escapeHtml(teacher.name)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="flex items-center space-x-1.5">
                                <i class="fa-solid fa-users text-[11px] text-purple-500"></i>
                                <span>Студентов:</span>
                            </span>
                            <span class="font-semibold text-gray-800 dark:text-gray-100">${(course.studentIds || []).length} чел.</span>
                        </div>
                    </div>
                </div>

                <!-- Footer Controls -->
                <div class="p-3.5 bg-gray-50 dark:bg-gray-800/60 border-t border-google-border dark:border-google-darkBorder flex items-center justify-between text-xs">
                    ${canManage ? `
                        <div class="flex items-center space-x-2 w-full justify-between">
                            <button onclick="window.restoreCourse('${course.id}')" class="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5" title="Восстановить курс в активные">
                                <i class="fa-solid fa-rotate-left text-xs"></i>
                                <span>Восстановить</span>
                            </button>
                            <button onclick="window.deleteArchivedCourse('${course.id}')" class="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5" title="Окончательно удалить курс">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                                <span>Удалить</span>
                            </button>
                        </div>
                    ` : `
                        <span class="text-[11px] text-google-gray italic">Курс архивирован преподавателем</span>
                    `}
                </div>
            </div>
        `;
    }).join('');
};
