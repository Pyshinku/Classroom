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
    if (!course) return user.role === 'teacher';
    return user.role === 'teacher' || course.teacherId === user.id || (course.coTeacherIds || []).includes(user.id);
}

function switchCourseTab(tabKey) {
    const user = getCurrentUser();
    if (tabKey === 'grades' && user.role !== 'teacher') {
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

    const teachingCourses = (appState.courses || []).filter(c => isCourseTeacher(c, user));
    const enrolledCourses = (appState.courses || []).filter(c => (c.studentIds || []).includes(user.id));

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
}

function renderDashboard() {
    const user = getCurrentUser();
    const isGuest = isGuestUser();
    const searchInput = document.getElementById('input-global-search');
    const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

    let allCourses = appState.courses || [];
    if (searchQuery) {
        allCourses = allCourses.filter(c => (c.name || '').toLowerCase().includes(searchQuery) || (c.code || '').toLowerCase().includes(searchQuery) || (c.subject || '').toLowerCase().includes(searchQuery));
    }

    const container = document.getElementById('courses-grid') || document.getElementById('dashboard-courses-grid');
    const badgeEl = document.getElementById('dashboard-courses-badge');
    if (!container) return;

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

        return `
            <div onclick="if(isGuestUser()){ triggerToast('В гостевом режиме вход на курсы недоступен. Пожалуйста, выполните вход через Google.', true); triggerGoogleSignIn(); return; } window.navigateTo('course', '${course.id}')" class="group bg-white dark:bg-google-darkSurface border border-google-border dark:border-google-darkBorder rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer hover:-translate-y-1">
                <div>
                    <!-- Header Banner -->
                    <div class="h-32 bg-gradient-to-tr ${course.gradient || 'from-blue-600 to-indigo-700'} relative p-5 flex flex-col justify-between overflow-hidden">
                        ${course.banner ? `<div class="course-card-bg absolute inset-0 opacity-40 mix-blend-overlay" style="background-image: url('${course.banner}');"></div>` : ''}
                        <div class="relative z-10 flex items-start justify-between">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 backdrop-blur-md text-white border border-white/30 tracking-wider">
                                ${course.code}
                            </span>
                            <span class="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold flex items-center justify-center border border-white/30 shadow-sm">
                                ${getCourseBadgeLetters(course.name)}
                            </span>
                        </div>
                        <div class="relative z-10">
                            <h3 class="text-base font-bold text-white tracking-tight line-clamp-1 group-hover:underline">${course.name}</h3>
                            <p class="text-xs text-white/80 line-clamp-1 mt-0.5">${course.section || 'Основной раздел'}</p>
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div class="p-5 space-y-3 text-xs text-google-gray">
                        <div class="flex items-center justify-between">
                            <span class="flex items-center space-x-1.5">
                                <i class="fa-solid fa-chalkboard-user text-[11px] text-google-blue"></i>
                                <span>Преподаватель:</span>
                            </span>
                            <span class="font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[130px]">${teacher.name}</span>
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
                    <div class="flex items-center space-x-1.5 text-google-blue font-medium text-xs group-hover:translate-x-0.5 transition-transform">
                        <span>Перейти</span>
                        <i class="fa-solid fa-arrow-right text-xs"></i>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderCurrentCourseView(course) {
    if (!course) return;

    // Header banner
    const bannerBox = document.getElementById('hero-banner-box');
    const bannerBg = document.getElementById('hero-banner-bg');
    if (bannerBox) {
        bannerBox.className = `w-full rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-md flex flex-col justify-between min-h-[170px] sm:min-h-[200px] text-white bg-gradient-to-tr ${course.gradient || 'from-blue-600 to-indigo-700'}`;
    }
    if (bannerBg) {
        if (course.banner) {
            bannerBg.style.backgroundImage = `url('${course.banner}')`;
            bannerBg.classList.remove('hidden');
        } else {
            bannerBg.classList.add('hidden');
        }
    }

    document.getElementById('hero-banner-title').textContent = course.name;
    document.getElementById('hero-banner-section').textContent = course.section || 'Основной раздел';
    document.getElementById('hero-banner-code').textContent = course.code;

    const teacher = (appState.accounts || []).find(a => a.id === course.teacherId) || { name: 'Преподаватель курса' };
    const metaTeacher = document.getElementById('course-meta-teacher');
    const metaStudents = document.getElementById('course-meta-students');

    if (metaTeacher) {
        metaTeacher.innerHTML = `
            <i class="fa-solid fa-chalkboard-user text-google-green"></i>
            <span>Преподаватель: <strong>${teacher.name}</strong></span>
        `;
    }
    if (metaStudents) {
        metaStudents.innerHTML = `
            <i class="fa-solid fa-users text-purple-500"></i>
            <span>Записано студентов: <strong>${(course.studentIds || []).length}</strong></span>
        `;
    }

    renderStreamTab(course);
    if (typeof renderClassworkTab === 'function') renderClassworkTab(course);
    renderPeopleTab(course);
    renderGradesTab(course);
}

function renderStreamTab(course) {
    const list = document.getElementById('stream-posts-list');
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
        const attsHtml = (a.attachments || []).map(att => `
            <a href="${att.url}" target="_blank" class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs text-google-blue dark:text-google-blueDarkTheme hover:underline border border-google-border dark:border-google-darkBorder">
                <i class="fa-solid ${att.type === 'video' ? 'fa-video text-red-500' : (att.type === 'file' ? 'fa-paperclip text-google-blue' : 'fa-link text-emerald-500')}"></i>
                <span class="truncate max-w-[200px]">${att.label || att.name || 'Материал'}</span>
            </a>
        `).join('');

        const commentsHtml = (a.comments || []).map(c => `
            <div class="flex items-start space-x-2.5 text-xs pt-2">
                <div class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-google-blue dark:text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                    ${c.authorAvatar || 'С'}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-gray-900 dark:text-gray-100">${c.authorName} <span class="font-normal text-[10px] text-google-gray ml-1">${c.date || ''}</span></p>
                    <p class="text-gray-700 dark:text-gray-300">${c.text}</p>
                </div>
            </div>
        `).join('');

        return `
            <div class="bg-white dark:bg-google-darkSurface border border-google-border dark:border-google-darkBorder rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm shrink-0">
                        ${a.authorAvatar || 'П'}
                    </div>
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
                    <div class="flex items-center space-x-2 pt-2">
                        <input id="ann-comm-input-${a.id}" type="text" placeholder="Добавьте комментарий к записи..." class="flex-1 px-3.5 py-2 rounded-xl border border-google-border dark:border-google-darkBorder bg-gray-50 dark:bg-gray-800 text-xs focus:ring-2 focus:ring-google-blue focus:outline-none">
                        <button onclick="sendAnnouncementComment('${a.id}')" class="px-3.5 py-2 rounded-xl bg-google-blue hover:bg-google-blueDark text-white text-xs font-semibold shadow transition">
                            Отправить
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.sendAnnouncementComment = async function(annId) {
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
        text,
        date: 'Только что'
    };

    const ann = (appState.announcements || []).find(a => a.id === annId);
    if (ann) {
        if (!ann.comments) ann.comments = [];
        ann.comments.push(newComment);
        persistState();
        renderStreamTab(appState.courses.find(c => c.id === appState.currentCourseId));
    }

    await sendServerAction('/api/announcements/comment', newComment);
};

function renderPeopleTab(course) {
    const teacher = (appState.accounts || []).find(a => a.id === course.teacherId) || { name: 'Преподаватель курса', email: '' };
    const coTeacherIds = course.coTeacherIds || [];
    const coTeachers = (appState.accounts || []).filter(a => coTeacherIds.includes(a.id));

    const teachersListEl = document.getElementById('people-teachers-list');
    if (teachersListEl) {
        teachersListEl.innerHTML = [teacher, ...coTeachers].map(t => `
            <div class="py-3 flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <span class="w-10 h-10 rounded-full bg-gradient-to-tr ${t.bg || 'from-blue-600 to-indigo-600'} text-white font-bold flex items-center justify-center text-xs shadow">
                        ${t.avatar || 'П'}
                    </span>
                    <div>
                        <p class="text-xs font-semibold text-gray-900 dark:text-gray-100">${t.name}</p>
                        <p class="text-[10px] text-google-gray">${t.email || ''}</p>
                    </div>
                </div>
            </div>
        `).join('');
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
            studentsListEl.innerHTML = students.map(s => `
                <div class="py-3 flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <span class="w-10 h-10 rounded-full bg-gradient-to-tr ${s.bg || 'from-emerald-500 to-teal-600'} text-white font-bold flex items-center justify-center text-xs shadow">
                            ${s.avatar || 'С'}
                        </span>
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
            `).join('');
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
    const headerRow = document.getElementById('grades-assignments-headers');
    const tableBody = document.getElementById('grades-table-body');
    const badgeStats = document.getElementById('grades-stats-badge');

    const assigns = (appState.assignments || []).filter(a => a.courseId === course.id);
    const students = (appState.accounts || []).filter(a => (course.studentIds || []).includes(a.id));

    if (badgeStats) badgeStats.textContent = `Заданий: ${assigns.length} • Студентов: ${students.length}`;

    if (headerRow) {
        headerRow.innerHTML = assigns.map(a => `
            <th class="p-3 text-center border-l border-google-border dark:border-google-darkBorder min-w-[140px]">
                <div class="truncate font-semibold text-gray-800 dark:text-gray-200 text-xs">${a.title}</div>
                <span class="text-[10px] text-google-gray font-normal">из ${a.points} б.</span>
            </th>
        `).join('');
    }

    if (tableBody) {
        if (students.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="${assigns.length + 1}" class="p-8 text-center text-xs text-google-gray">Нет зарегистрированных студентов для оценивания</td></tr>`;
            return;
        }

        tableBody.innerHTML = students.map(st => {
            const cells = assigns.map(a => {
                const submission = a.submissions && a.submissions[st.id];
                const gradeVal = submission && submission.grade !== undefined ? submission.grade : '';
                return `
                    <td class="p-3 text-center border-l border-google-border dark:border-google-darkBorder">
                        <input type="number" value="${gradeVal}" min="0" max="${a.points}" onchange="saveStudentGrade('${a.id}', '${st.id}', this.value)" class="w-16 text-center py-1 rounded-lg border border-google-border dark:border-google-darkBorder bg-gray-50 dark:bg-gray-800 text-xs font-bold focus:ring-2 focus:ring-google-blue">
                    </td>
                `;
            }).join('');

            return `
                <tr class="border-b border-google-border dark:border-google-darkBorder">
                    <td class="p-3 text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                        <span class="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px]">
                            ${st.avatar || 'С'}
                        </span>
                        <span>${st.name}</span>
                    </td>
                    ${cells}
                </tr>
            `;
        }).join('');
    }
}

window.saveStudentGrade = async function(assignId, studentId, grade) {
    const assign = (appState.assignments || []).find(a => a.id === assignId);
    if (!assign) return;
    if (!assign.submissions) assign.submissions = {};
    if (!assign.submissions[studentId]) {
        assign.submissions[studentId] = { answer: '', link: '', attachments: [], submittedAt: 'Без сдачи' };
    }
    assign.submissions[studentId].grade = Number(grade);
    persistState();
    await sendServerAction('/api/assignments/grade', { assignmentId: assignId, studentId, grade: Number(grade) });
    triggerToast('Оценка сохранена');
};

window.joinCourseDirectly = async function(code) {
    code = code.trim().toUpperCase();
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
        triggerToast('Вы уже записаны на этот курс');
        window.navigateTo('course', course.id);
        return;
    }

    course.studentIds.push(user.id);
    persistState();
    await sendServerAction('/api/courses/join', { code, studentId: user.id });
    renderSidebar();
    renderDashboard();
    window.navigateTo('course', course.id);
    triggerToast(`Вы успешно записались на курс "${course.name}"!`);
};
