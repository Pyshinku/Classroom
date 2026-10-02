// Google Classroom - Assignment Management, Full-Page Editor & Submissions Engine

let pendingCreateAttachments = [];
let editingAssignmentId = null;

function renderClassworkTab(course) {
    const list = document.getElementById('classwork-assignments-list');
    if (!list) return;

    const assigns = (appState.assignments || []).filter(a => a.courseId === course.id);
    const user = getCurrentUser();
    const isTeacher = isCourseTeacher(course, user);

    if (assigns.length === 0) {
        list.innerHTML = `
            <div class="p-12 text-center text-google-gray space-y-2">
                <i class="fa-solid fa-clipboard-question text-3xl opacity-40"></i>
                <p class="text-sm font-medium text-gray-800 dark:text-gray-200">В этом курсе пока нет заданий</p>
                ${isTeacher ? `
                    <button onclick="window.navigateTo('create-assignment', '${course.id}')" class="mt-2 px-5 py-2 rounded-2xl bg-google-blue hover:bg-google-blueDark text-white text-xs font-semibold shadow transition">
                        Создать первое задание
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }

    list.innerHTML = assigns.map(a => {
        const sub = a.submissions && a.submissions[user.id];
        const isSubmitted = Boolean(sub && sub.submittedAt);
        const hasGrade = sub && sub.grade !== undefined;

        let statusBadge = '';
        if (isTeacher) {
            const subsCount = Object.keys(a.submissions || {}).length;
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-950 text-google-blue">Сдано: ${subsCount}</span>`;
        } else if (hasGrade) {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-google-green">Оценка: ${sub.grade}/${a.points}</span>`;
        } else if (isSubmitted) {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 dark:bg-purple-950 text-purple-600">Сдано</span>`;
        } else {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-google-gray">Назначено</span>`;
        }

        return `
            <div onclick="window.navigateTo('assignment', '${course.id}', '${a.id}')" class="p-4 sm:p-5 rounded-2xl border border-google-border dark:border-google-darkBorder bg-white dark:bg-google-darkSurface hover:shadow-md transition cursor-pointer flex items-center justify-between group">
                <div class="flex items-center space-x-3.5 truncate">
                    <div class="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-google-blue flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-clipboard-list text-base"></i>
                    </div>
                    <div class="truncate">
                        <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-google-blue dark:group-hover:text-google-blueDarkTheme truncate">${a.title}</h4>
                        <p class="text-xs text-google-gray">${a.deadline ? `Срок: ${a.deadline}` : 'Без срока'}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-3 shrink-0 ml-3">
                    ${statusBadge}
                    ${isTeacher ? `
                        <button onclick="event.stopPropagation(); window.navigateTo('edit-assignment', '${course.id}', '${a.id}')" class="p-2 text-google-gray hover:text-google-blue transition" title="Редактировать">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="event.stopPropagation(); deleteAssignment('${a.id}', '${course.id}')" class="p-2 text-google-gray hover:text-red-500 transition" title="Удалить задание">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Full-Page Workspace for Creating & Editing Assignments (Req 4, Req 5)
function initCreateAssignmentView(course, editAssign = null) {
    if (!course) return;

    const user = getCurrentUser();
    if (!isCourseTeacher(course, user)) {
        triggerToast('Только преподаватель этого курса может создавать или редактировать задания', true);
        window.navigateTo('course', course.id);
        return;
    }

    const btnClose = document.getElementById('btn-close-create-assignment');
    if (btnClose) {
        btnClose.onclick = () => {
            window.navigateTo('course', course.id);
        };
    }

    editingAssignmentId = editAssign ? editAssign.id : null;
    pendingCreateAttachments = editAssign && editAssign.attachments ? [...editAssign.attachments] : [];

    // Header labels
    const heading = document.getElementById('ca-heading-text');
    const subTitle = document.getElementById('ca-course-title-sub');
    const pubBtn = document.getElementById('ca-publish-btn-text');

    if (heading) heading.textContent = editAssign ? 'Редактирование задания' : 'Создание учебного задания';
    if (subTitle) subTitle.textContent = `Курс: ${course.name}`;
    if (pubBtn) pubBtn.textContent = editAssign ? 'Сохранить изменения' : 'Создать задание';

    // Inputs
    const titleInput = document.getElementById('ca-input-title');
    const descInput = document.getElementById('ca-input-desc');
    const pointsInput = document.getElementById('ca-input-points');
    const deadlineInput = document.getElementById('ca-input-deadline');
    const topicInput = document.getElementById('ca-input-topic');

    if (titleInput) titleInput.value = editAssign ? editAssign.title : '';
    if (descInput) descInput.value = editAssign ? (editAssign.description || '') : '';
    if (pointsInput) pointsInput.value = editAssign ? (editAssign.points || 100) : 100;
    if (deadlineInput) deadlineInput.value = editAssign ? (editAssign.deadline || '') : '';
    if (topicInput) topicInput.value = editAssign ? (editAssign.topic || '') : '';

    renderCreateAttachmentCards();

    // Wire action buttons
    const btnLink = document.getElementById('ca-btn-add-link');
    const btnVideo = document.getElementById('ca-btn-add-youtube');
    const inputFile = document.getElementById('ca-input-file');
    const btnSave = document.getElementById('btn-publish-assignment-action');

    if (btnLink) {
        btnLink.onclick = () => {
            const url = prompt('Введите URL ссылки на веб-ресурс:', 'https://');
            if (url) {
                const label = prompt('Название ресурса (кратко):', 'Полезная ссылка') || url;
                pendingCreateAttachments.push({ type: 'link', name: label, url });
                renderCreateAttachmentCards();
            }
        };
    }

    if (btnVideo) {
        btnVideo.onclick = () => {
            const url = prompt('Введите ссылку на видео YouTube:', 'https://youtube.com/watch?v=');
            if (url) {
                const label = prompt('Название видеоурока:', 'Видеоматериал к занятию') || 'Видео YouTube';
                pendingCreateAttachments.push({ type: 'video', name: label, url });
                renderCreateAttachmentCards();
            }
        };
    }

    if (inputFile) {
        inputFile.onchange = async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            let dataUrl = '#';
            if (file.type.startsWith('image/')) {
                try {
                    dataUrl = await compressImage(file, 800, 800, 0.8);
                } catch (_) {
                    dataUrl = '#';
                }
            }
            pendingCreateAttachments.push({
                type: 'file',
                name: file.name,
                url: dataUrl
            });
            renderCreateAttachmentCards();
            inputFile.value = '';
            triggerToast(`Файл "${file.name}" прикреплен!`);
        };
    }

    if (btnSave) {
        btnSave.onclick = saveAssignmentWorkspace;
    }
}

function renderCreateAttachmentCards() {
    const container = document.getElementById('ca-pending-attachments-list');
    if (!container) return;

    if (pendingCreateAttachments.length === 0) {
        container.innerHTML = '<p class="text-xs text-google-gray italic">Материалы еще не прикреплены</p>';
        return;
    }

    container.innerHTML = pendingCreateAttachments.map((att, i) => `
        <div class="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-gray-800 border border-google-border dark:border-google-darkBorder shadow-sm">
            <div class="flex items-center space-x-3 truncate">
                <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-google-blue flex items-center justify-center shrink-0">
                    <i class="fa-solid ${att.type === 'video' ? 'fa-video text-red-500' : (att.type === 'link' ? 'fa-link text-emerald-500' : 'fa-paperclip')}"></i>
                </div>
                <div class="truncate">
                    <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">${att.name}</p>
                    <p class="text-[10px] text-google-gray truncate">${att.url || 'Файл'}</p>
                </div>
            </div>
            <button onclick="pendingCreateAttachments.splice(${i}, 1); renderCreateAttachmentCards();" class="text-google-gray hover:text-red-500 p-1.5 transition">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

let isSavingAssignment = false;
async function saveAssignmentWorkspace() {
    if (isSavingAssignment) return;

    const title = (document.getElementById('ca-input-title').value || '').trim();
    const desc = (document.getElementById('ca-input-desc').value || '').trim();
    const points = Number(document.getElementById('ca-input-points').value) || 100;
    const deadline = document.getElementById('ca-input-deadline').value || 'Без срока';
    const topic = (document.getElementById('ca-input-topic').value || '').trim();

    if (!title) {
        triggerToast('Укажите название задания', true);
        return;
    }

    const courseId = appState.currentCourseId;
    if (!courseId) return;

    const course = (appState.courses || []).find(c => c.id === courseId);
    const user = getCurrentUser();
    if (!course || !isCourseTeacher(course, user)) {
        triggerToast('Недостаточно прав для сохранения задания в этом курсе', true);
        return;
    }

    const btnSave = document.getElementById('btn-publish-assignment-action');
    const pubBtnText = document.getElementById('ca-publish-btn-text');

    try {
        isSavingAssignment = true;
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (pubBtnText) {
            pubBtnText.textContent = editingAssignmentId ? 'Сохранение...' : 'Создание...';
        }

        if (!appState.assignments) appState.assignments = [];

        if (editingAssignmentId) {
            // Edit existing assignment
            const assign = appState.assignments.find(a => a.id === editingAssignmentId);
            if (assign) {
                assign.title = title;
                assign.description = desc;
                assign.points = points;
                assign.deadline = deadline;
                assign.topic = topic;
                assign.attachments = [...pendingCreateAttachments];
            }
            persistState();
            await sendServerAction('/api/assignments/update', {
                id: editingAssignmentId,
                courseId,
                title,
                description: desc,
                points,
                deadline,
                topic,
                attachments: [...pendingCreateAttachments]
            });
            triggerToast('Задание успешно обновлено!');
        } else {
            // Create new assignment
            const newAssign = {
                id: 'as_' + Date.now(),
                courseId,
                title,
                description: desc,
                points,
                deadline,
                topic,
                attachments: [...pendingCreateAttachments],
                submissions: {},
                comments: [],
                privateComments: {}
            };
            appState.assignments.unshift(newAssign);
            persistState();
            await sendServerAction('/api/assignments/create', newAssign);
            triggerToast('Задание успешно опубликовано для студентов!');
        }

        window.navigateTo('course', courseId);
    } finally {
        isSavingAssignment = false;
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (pubBtnText) {
            pubBtnText.textContent = editingAssignmentId ? 'Сохранить изменения' : 'Создать задание';
        }
    }
}

window.deleteAssignment = async function(assignId, courseId) {
    const assign = (appState.assignments || []).find(a => a.id === assignId);
    if (!assign) return;
    const course = (appState.courses || []).find(c => c.id === courseId);
    if (!course || !isCourseTeacher(course)) {
        triggerToast('У вас нет прав для удаления этого задания', true);
        return;
    }
    if (!confirm(`Удалить задание "${assign.title}"?`)) return;

    appState.assignments = (appState.assignments || []).filter(a => a.id !== assignId);
    persistState();
    renderClassworkTab(course);
    if (typeof renderGradesTab === 'function') renderGradesTab(course);
    triggerToast('Задание удалено');
    await sendServerAction('/api/assignments/delete', { id: assignId, courseId });
};

function renderFullAssignmentWorkspace(course, assign) {
    if (!course || !assign) return;

    const user = getCurrentUser();
    const isTeacher = isCourseTeacher(course, user);

    document.getElementById('assign-title').textContent = assign.title;
    document.getElementById('assign-meta-info').textContent = `Автор: ${course.name} • ${assign.deadline ? `Срок сдачи: ${assign.deadline}` : 'Без дедлайна'}`;
    document.getElementById('assign-points-badge').textContent = `${assign.points} баллов`;

    const descEl = document.getElementById('assign-description');
    if (descEl) {
        descEl.textContent = assign.description || 'Инструкции к выполнению отсутствуют.';
    }

    // Attachments
    const attsList = document.getElementById('assign-attachments-list');
    if (attsList) {
        const atts = assign.attachments || [];
        if (atts.length === 0) {
            attsList.innerHTML = '<p class="text-xs text-google-gray italic">Материалы отсутствуют</p>';
        } else {
            attsList.innerHTML = atts.map(att => `
                <a href="${att.url}" target="_blank" class="flex items-center space-x-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-google-border dark:border-google-darkBorder hover:border-google-blue transition group">
                    <div class="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900 text-google-blue dark:text-blue-300 flex items-center justify-center text-xs shrink-0">
                        <i class="fa-solid ${att.type === 'video' ? 'fa-video text-red-500' : (att.type === 'link' ? 'fa-link text-emerald-500' : 'fa-paperclip')}"></i>
                    </div>
                    <div class="truncate">
                        <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 group-hover:text-google-blue dark:group-hover:text-google-blueDarkTheme truncate">${att.name || 'Материал'}</p>
                        <p class="text-[10px] text-google-gray truncate">${att.url}</p>
                    </div>
                </a>
            `).join('');
        }
    }

    // Cards display for student vs teacher
    const studentCard = document.getElementById('assign-student-work-card');
    const teacherCard = document.getElementById('assign-teacher-side-card');

    if (isTeacher) {
        if (studentCard) studentCard.classList.add('hidden');
        if (teacherCard) teacherCard.classList.remove('hidden');

        // Populate teacher stats
        const subs = assign.submissions || {};
        const students = (appState.accounts || []).filter(a => (course.studentIds || []).includes(a.id));
        const submittedCount = Object.values(subs).filter(s => Boolean(s.submittedAt)).length;
        const gradedCount = Object.values(subs).filter(s => s.grade !== undefined && s.grade !== null).length;
        const pendingCount = students.length - submittedCount;

        document.getElementById('teacher-stat-submitted').textContent = submittedCount;
        document.getElementById('teacher-stat-pending').textContent = Math.max(0, pendingCount);
        document.getElementById('teacher-stat-graded').textContent = gradedCount;

        const studentsListEl = document.getElementById('assign-teacher-students-list');
        if (studentsListEl) {
            if (students.length === 0) {
                studentsListEl.innerHTML = '<p class="text-xs text-google-gray py-4 text-center">На этот курс еще не записаны студенты.</p>';
            } else {
                studentsListEl.innerHTML = students.map(st => {
                    const sub = subs[st.id];
                    return `
                        <div class="p-3 rounded-2xl border border-google-border dark:border-google-darkBorder flex items-center justify-between">
                            <div class="flex items-center space-x-2.5 truncate">
                                <span class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 font-bold flex items-center justify-center text-xs shrink-0">${st.avatar || 'С'}</span>
                                <div class="truncate">
                                    <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">${st.name}</p>
                                    <p class="text-[10px] text-google-gray">${sub && sub.submittedAt ? `Сдано: ${sub.submittedAt}` : 'Не сдано'}</p>
                                </div>
                            </div>
                            <input type="number" min="0" max="${assign.points}" value="${sub && sub.grade !== undefined ? sub.grade : ''}" placeholder="Балл" onchange="saveStudentGrade('${assign.id}', '${st.id}', this.value)" class="w-16 px-2 py-1 border border-google-border dark:border-google-darkBorder rounded-xl text-xs font-bold text-center bg-gray-50 dark:bg-gray-800">
                        </div>
                    `;
                }).join('');
            }
        }
    } else {
        if (studentCard) studentCard.classList.remove('hidden');
        if (teacherCard) teacherCard.classList.add('hidden');

        const sub = assign.submissions && assign.submissions[user.id];
        const isSubmitted = Boolean(sub && sub.submittedAt);
        const hasGrade = sub && sub.grade !== undefined;

        const statusBadge = document.getElementById('assign-student-status-badge');
        const submitBtn = document.getElementById('assign-btn-submit-work');
        const unsubmitBtn = document.getElementById('assign-btn-unsubmit-work');

        if (hasGrade) {
            statusBadge.textContent = `Оценено: ${sub.grade}/${assign.points}`;
            statusBadge.className = 'text-xs font-bold text-emerald-600 dark:text-emerald-400';
            if (submitBtn) submitBtn.classList.add('hidden');
            if (unsubmitBtn) unsubmitBtn.classList.remove('hidden');
        } else if (isSubmitted) {
            statusBadge.textContent = 'Сдано';
            statusBadge.className = 'text-xs font-bold text-google-blue dark:text-google-blueDarkTheme';
            if (submitBtn) submitBtn.classList.add('hidden');
            if (unsubmitBtn) unsubmitBtn.classList.remove('hidden');
        } else {
            statusBadge.textContent = 'Назначено';
            statusBadge.className = 'text-xs font-semibold text-google-gray';
            if (submitBtn) submitBtn.classList.remove('hidden');
            if (unsubmitBtn) unsubmitBtn.classList.add('hidden');
        }
    }

    // Public Comments
    renderAssignmentComments(assign);
}

function renderAssignmentComments(assign) {
    const list = document.getElementById('assign-public-comments-list');
    if (!list) return;

    const comms = assign.comments || [];
    if (comms.length === 0) {
        list.innerHTML = '<p class="text-xs text-google-gray italic">Комментариев к заданию пока нет</p>';
        return;
    }

    list.innerHTML = comms.map(c => `
        <div class="flex items-start space-x-2.5 text-xs">
            <span class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-google-blue dark:text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                ${c.authorAvatar || 'С'}
            </span>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-900 dark:text-gray-100">${c.authorName} <span class="font-normal text-[10px] text-google-gray ml-1">${c.date || ''}</span></p>
                <p class="text-gray-700 dark:text-gray-300">${c.text}</p>
            </div>
        </div>
    `).join('');
}

// TODO (Tasks) & Calendar Engine
let currentTodoTab = 'assigned';
const todoExpandedSections = {
    'no-deadline': true,
    'this-week': true,
    'next-week': true,
    'later': false,
    'last-week': true,
    'earlier': true,
    'done-no-deadline': true,
    'done-earlier': true
};

window.switchTodoTab = function(tabKey) {
    currentTodoTab = tabKey;
    ['assigned', 'missing', 'done'].forEach(t => {
        const btn = document.getElementById(`todo-tab-btn-${t}`);
        if (btn) {
            if (t === tabKey) {
                btn.className = 'todo-nav-tab pb-3 text-google-blue border-b-2 border-google-blue font-semibold transition flex items-center space-x-2';
            } else {
                btn.className = 'todo-nav-tab pb-3 text-google-gray hover:text-google-text transition flex items-center space-x-2';
            }
        }
    });
    renderTodoView();
};

window.toggleTodoSection = function(secKey) {
    todoExpandedSections[secKey] = !todoExpandedSections[secKey];
    renderTodoView();
};

function renderTodoView() {
    const container = document.getElementById('todo-groups-container');
    if (!container) return;

    const user = getCurrentUser();
    const myCourses = (appState.courses || []).filter(c => (c.studentIds || []).includes(user.id) || c.teacherId === user.id || (c.coTeacherIds || []).includes(user.id));
    const myCourseIds = myCourses.map(c => c.id);

    // Populate course filter dropdown
    const filterEl = document.getElementById('todo-course-filter');
    if (filterEl) {
        const currentVal = filterEl.value || 'all';
        filterEl.innerHTML = `<option value="all">Все курсы</option>` + myCourses.map(c => `
            <option value="${c.id}" ${currentVal === c.id ? 'selected' : ''}>${c.name}</option>
        `).join('');
    }

    const selectedCourseId = filterEl ? filterEl.value : 'all';
    let assigns = (appState.assignments || []).filter(a => myCourseIds.includes(a.courseId));
    if (selectedCourseId !== 'all') {
        assigns = assigns.filter(a => a.courseId === selectedCourseId);
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let totalAssigned = 0;
    let totalMissing = 0;
    let totalDone = 0;

    assigns.forEach(a => {
        const sub = a.submissions && a.submissions[user.id];
        if (sub) {
            totalDone++;
        } else if (a.deadline && a.deadline !== 'Без срока') {
            const dDate = new Date(a.deadline);
            if (!isNaN(dDate.getTime()) && dDate < now) {
                totalMissing++;
            } else {
                totalAssigned++;
            }
        } else {
            totalAssigned++;
        }
    });

    const badgeAssigned = document.getElementById('todo-badge-assigned');
    const badgeMissing = document.getElementById('todo-badge-missing');
    const badgeDone = document.getElementById('todo-badge-done');
    if (badgeAssigned) badgeAssigned.textContent = totalAssigned;
    if (badgeMissing) badgeMissing.textContent = totalMissing;
    if (badgeDone) badgeDone.textContent = totalDone;

    container.innerHTML = '';

    const renderAccordion = (key, title, items, badgeColorClass = 'text-google-gray') => {
        const isExpanded = todoExpandedSections[key] !== false;
        const count = items.length;

        const section = document.createElement('div');
        section.className = 'border border-google-border dark:border-google-darkBorder rounded-2xl bg-white dark:bg-google-darkSurface overflow-hidden shadow-sm transition';

        const header = document.createElement('div');
        header.className = 'p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 select-none';
        header.onclick = () => window.toggleTodoSection(key);
        header.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="fa-solid fa-chevron-down text-google-gray text-xs transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}"></i>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">${title}</h3>
            </div>
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 ${badgeColorClass}">${count}</span>
        `;
        section.appendChild(header);

        if (isExpanded) {
            const body = document.createElement('div');
            body.className = 'divide-y divide-google-border dark:divide-google-darkBorder border-t border-google-border dark:border-google-darkBorder';

            if (items.length === 0) {
                body.innerHTML = `
                    <div class="p-6 text-center text-xs text-google-gray italic">
                        В этом разделе заданий нет
                    </div>
                `;
            } else {
                items.forEach(item => {
                    const course = (appState.courses || []).find(c => c.id === item.courseId);
                    const row = document.createElement('div');
                    row.className = 'p-4 flex items-center justify-between hover:bg-blue-50/40 dark:hover:bg-gray-800/40 cursor-pointer transition';
                    row.onclick = () => window.navigateTo('assignment', item.courseId, item.id);

                    let rightText = '';
                    if (currentTodoTab === 'assigned') {
                        rightText = item.deadline && item.deadline !== 'Без срока' ? `Срок сдачи: ${item.deadline}` : 'Без срока';
                    } else if (currentTodoTab === 'missing') {
                        rightText = `<span class="text-red-500 font-semibold">Пропущен срок: ${item.deadline}</span>`;
                    } else {
                        const sub = item.submissions && item.submissions[user.id];
                        rightText = sub && sub.grade !== undefined 
                            ? `<span class="text-google-green font-semibold">Оценка: ${sub.grade}/${item.points || 100}</span>` 
                            : `<span class="text-google-green font-medium">Сдано</span>`;
                    }

                    row.innerHTML = `
                        <div class="flex items-center space-x-4 min-w-0 flex-1 mr-4">
                            <div class="w-10 h-10 rounded-full bg-google-blue text-white flex items-center justify-center shrink-0 shadow-sm">
                                <i class="fa-solid fa-clipboard-list text-sm"></i>
                            </div>
                            <div class="truncate">
                                <h4 class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">${item.title}</h4>
                                <p class="text-[11px] text-google-gray truncate">${course ? course.name : 'Курс'}</p>
                            </div>
                        </div>
                        <div class="text-xs text-google-gray shrink-0 text-right">
                            ${rightText}
                        </div>
                    `;
                    body.appendChild(row);
                });
            }
            section.appendChild(body);
        }

        container.appendChild(section);
    };

    if (currentTodoTab === 'assigned') {
        const assignedList = assigns.filter(a => !(a.submissions && a.submissions[user.id]));
        const noDeadline = [];
        const thisWeek = [];
        const nextWeek = [];
        const later = [];
        const weekMs = 7 * 86400000;

        assignedList.forEach(a => {
            if (!a.deadline || a.deadline === 'Без срока') {
                noDeadline.push(a);
            } else {
                const d = new Date(a.deadline);
                if (isNaN(d.getTime())) {
                    noDeadline.push(a);
                } else {
                    const diff = d.getTime() - now.getTime();
                    if (diff < 0) {
                        // missed
                    } else if (diff <= weekMs) {
                        thisWeek.push(a);
                    } else if (diff <= weekMs * 2) {
                        nextWeek.push(a);
                    } else {
                        later.push(a);
                    }
                }
            }
        });

        renderAccordion('no-deadline', 'Без срока сдачи', noDeadline);
        renderAccordion('this-week', 'На этой неделе', thisWeek);
        renderAccordion('next-week', 'Следующая неделя', nextWeek);
        renderAccordion('later', 'Не сейчас', later);

    } else if (currentTodoTab === 'missing') {
        const missingList = assigns.filter(a => {
            if (a.submissions && a.submissions[user.id]) return false;
            if (!a.deadline || a.deadline === 'Без срока') return false;
            const d = new Date(a.deadline);
            return !isNaN(d.getTime()) && d < now;
        });

        const weekMs = 7 * 86400000;
        const lastWeek = [];
        const earlier = [];

        missingList.forEach(a => {
            const d = new Date(a.deadline);
            if (now.getTime() - d.getTime() <= weekMs) {
                lastWeek.push(a);
            } else {
                earlier.push(a);
            }
        });

        renderAccordion('last-week', 'На прошлой неделе', lastWeek, 'text-red-500');
        renderAccordion('earlier', 'Ранее', earlier, 'text-red-500');

    } else if (currentTodoTab === 'done') {
        const doneList = assigns.filter(a => !!(a.submissions && a.submissions[user.id]));
        const doneNoDeadline = doneList.filter(a => !a.deadline || a.deadline === 'Без срока');
        const doneEarlier = doneList.filter(a => a.deadline && a.deadline !== 'Без срока');

        renderAccordion('done-no-deadline', 'Без срока сдачи', doneNoDeadline, 'text-google-green');
        renderAccordion('done-earlier', 'Сдано ранее', doneEarlier, 'text-google-green');
    }
}

function renderCalendarView() {
    const container = document.getElementById('calendar-cards-container');
    if (!container) return;
    container.innerHTML = '';

    const userAssigns = appState.assignments || [];
    if (userAssigns.length === 0) {
        container.innerHTML = '<p class="text-xs text-google-gray col-span-full py-8 text-center bg-white dark:bg-google-darkSurface rounded-3xl border border-google-border dark:border-google-darkBorder p-6">Событий в календаре нет</p>';
        return;
    }

    userAssigns.forEach(a => {
        const course = (appState.courses || []).find(c => c.id === a.courseId);
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-google-darkSurface border border-google-border dark:border-google-darkBorder rounded-3xl p-5 shadow-sm space-y-3 hover:shadow-md transition cursor-pointer';
        card.onclick = () => window.navigateTo('assignment', a.courseId, a.id);

        card.innerHTML = `
            <div class="flex items-center space-x-2 text-google-blue dark:text-google-blueDarkTheme">
                <i class="fa-solid fa-calendar-day"></i>
                <span class="text-xs font-bold font-mono">${a.deadline || 'Текущая неделя'}</span>
            </div>
            <div>
                <h4 class="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug">${a.title}</h4>
                <p class="text-xs text-google-gray mt-1 truncate">${course ? course.name : ''}</p>
            </div>
        `;
        container.appendChild(card);
    });
}
