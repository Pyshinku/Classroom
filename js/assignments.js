// Google Classroom - Assignment Management, Full-Page Editor & Submissions Engine

let pendingCreateAttachments = [];
let editingAssignmentId = null;

function renderClassworkTab(course) {
    const list = document.getElementById('classwork-cards-list') || document.getElementById('classwork-assignments-list');
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
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            for (const file of files) {
                const att = await readFileAsAttachment(file);
                pendingCreateAttachments.push(att);
            }
            renderCreateAttachmentCards();
            inputFile.value = '';
            triggerToast(files.length === 1 ? `Файл "${files[0].name}" прикреплен!` : `Прикреплено файлов: ${files.length}`);
        };
    }

    if (btnSave) {
        btnSave.onclick = saveAssignmentWorkspace;
    }
}

async function readFileAsAttachment(file) {
    let dataUrl = '';
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
    if (isImage) {
        try {
            if (typeof compressImage === 'function') {
                dataUrl = await compressImage(file, 1200, 1200, 0.85);
            }
        } catch (_) {}
    }
    if (!dataUrl || dataUrl === '#') {
        dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result || '#');
            reader.onerror = () => resolve('#');
            reader.readAsDataURL(file);
        });
    }

    let type = 'file';
    if (isImage) type = 'image';
    else if (file.type.includes('pdf') || /\.pdf$/i.test(file.name)) type = 'pdf';
    else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(file.name)) type = 'video';

    return {
        type,
        name: file.name,
        url: dataUrl
    };
}

window.openAttachmentResource = function(url, name) {
    if (!url || url === '#') {
        triggerToast('Файл недоступен', true);
        return;
    }
    if (url.startsWith('data:image/')) {
        const w = window.open('');
        if (w) {
            w.document.write(`<html><head><title>${name || 'Изображение'}</title><style>body{margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;}img{max-width:95vw;max-height:95vh;object-fit:contain;border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.5);}</style></head><body><img src="${url}"></body></html>`);
            return;
        }
    }
    if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = name || 'file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};

function renderCreateAttachmentCards() {
    const container = document.getElementById('ca-pending-attachments-list');
    if (!container) return;

    if (pendingCreateAttachments.length === 0) {
        container.innerHTML = '<p class="text-xs text-google-gray italic">Материалы еще не прикреплены</p>';
        return;
    }

    container.innerHTML = pendingCreateAttachments.map((att, i) => {
        let iconHtml = '<i class="fa-solid fa-paperclip text-google-blue"></i>';
        if (att.type === 'video') iconHtml = '<i class="fa-solid fa-video text-red-500"></i>';
        else if (att.type === 'link') iconHtml = '<i class="fa-solid fa-link text-emerald-500"></i>';
        else if (att.type === 'pdf') iconHtml = '<i class="fa-solid fa-file-pdf text-red-600"></i>';
        else if (att.type === 'image' || (att.url && att.url.startsWith('data:image/'))) {
            iconHtml = att.url && att.url.startsWith('data:image/')
                ? `<img src="${att.url}" class="w-full h-full object-cover">`
                : '<i class="fa-solid fa-image text-purple-500"></i>';
        }

        return `
        <div class="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-gray-800 border border-google-border dark:border-google-darkBorder shadow-sm">
            <div class="flex items-center space-x-3 truncate flex-1 min-w-0 mr-2">
                <div class="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center shrink-0 overflow-hidden text-sm">
                    ${iconHtml}
                </div>
                <div class="truncate flex-1 min-w-0">
                    <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">${att.name}</p>
                    <p class="text-[10px] text-google-gray truncate">${att.url && att.url.startsWith('data:') ? 'Файл прикреплен' : (att.url || 'Материал')}</p>
                </div>
            </div>
            <div class="flex items-center space-x-1 shrink-0">
                <button type="button" onclick="openAttachmentResource('${att.url}', '${att.name.replace(/'/g, "\\'")}')" class="text-google-gray hover:text-google-blue p-1.5 transition" title="Открыть / Просмотреть">
                    <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                </button>
                <button type="button" onclick="pendingCreateAttachments.splice(${i}, 1); renderCreateAttachmentCards();" class="text-google-gray hover:text-red-500 p-1.5 transition" title="Удалить">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
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
                assign.instructions = desc;
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
                instructions: desc,
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
                instructions: desc,
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

window.saveStudentGrade = async function(assignId, studentId, gradeVal) {
    const assign = (appState.assignments || []).find(a => a.id === assignId);
    if (!assign) return;
    if (!assign.submissions) assign.submissions = {};
    if (!assign.submissions[studentId]) {
        assign.submissions[studentId] = {
            submittedAt: null,
            attachments: []
        };
    }
    const num = gradeVal === '' ? null : Number(gradeVal);
    assign.submissions[studentId].grade = num;
    persistState();
    triggerToast('Оценка сохранена');
    await sendServerAction('/api/assignments/grade', {
        assignmentId: assignId,
        studentId,
        grade: num
    });
};

let studentPendingAttachments = [];

function renderSubmittedAttachmentsHtml(sub) {
    const atts = (sub && sub.attachments) || [];
    let html = `
        <div class="space-y-2">
            <p class="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center space-x-1.5">
                <i class="fa-solid fa-circle-check"></i>
                <span>Сдано: ${sub.submittedAt || ''}</span>
            </p>
    `;
    if (atts.length > 0) {
        html += `<div class="space-y-1.5 pt-1">`;
        atts.forEach(att => {
            const isImage = att.type === 'image' || (att.url && (att.url.startsWith('data:image/') || att.url.match(/\.(jpeg|jpg|gif|png|webp)/i)));
            const isPdf = att.type === 'pdf' || (att.url && (att.url.includes('application/pdf') || att.url.match(/\.pdf/i)));
            const isVideo = att.type === 'video';
            const isLink = att.type === 'link';

            let iconHtml = '<i class="fa-solid fa-paperclip text-google-blue"></i>';
            if (isVideo) iconHtml = '<i class="fa-brands fa-youtube text-red-500"></i>';
            else if (isLink) iconHtml = '<i class="fa-solid fa-link text-emerald-500"></i>';
            else if (isPdf) iconHtml = '<i class="fa-solid fa-file-pdf text-red-600"></i>';
            else if (isImage && att.url && att.url.startsWith('data:image/')) {
                iconHtml = `<img src="${att.url}" class="w-6 h-6 rounded object-cover">`;
            } else if (isImage) {
                iconHtml = '<i class="fa-solid fa-image text-purple-500"></i>';
            }

            const safeName = (att.name || 'Вложение').replace(/'/g, "\\'");
            html += `
            <div onclick="openAttachmentResource('${att.url}', '${safeName}')" class="flex items-center space-x-2.5 p-2 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800/80 cursor-pointer hover:border-google-blue dark:hover:border-google-blueDarkTheme transition group shadow-2xs">
                <div class="w-6 h-6 rounded flex items-center justify-center shrink-0 overflow-hidden text-xs">
                    ${iconHtml}
                </div>
                <span class="text-xs font-medium truncate flex-1 text-gray-800 dark:text-gray-200 group-hover:text-google-blue dark:group-hover:text-google-blueDarkTheme">${att.name || 'Прикрепленный файл'}</span>
                <i class="fa-solid fa-arrow-up-right-from-square text-[10px] text-google-gray group-hover:text-google-blue"></i>
            </div>
            `;
        });
        html += `</div>`;
    }
    html += `</div>`;
    return html;
}

function renderStudentPendingAttachments() {
    const container = document.getElementById('student-pending-attachments');
    if (!container) return;

    if (studentPendingAttachments.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = studentPendingAttachments.map((att, i) => {
        let iconHtml = '<i class="fa-solid fa-paperclip text-google-blue"></i>';
        if (att.type === 'video') iconHtml = '<i class="fa-solid fa-video text-red-500"></i>';
        else if (att.type === 'link') iconHtml = '<i class="fa-solid fa-link text-emerald-500"></i>';
        else if (att.type === 'pdf') iconHtml = '<i class="fa-solid fa-file-pdf text-red-600"></i>';
        else if (att.type === 'image' || (att.url && att.url.startsWith('data:image/'))) {
            iconHtml = att.url && att.url.startsWith('data:image/')
                ? `<img src="${att.url}" class="w-full h-full object-cover">`
                : '<i class="fa-solid fa-image text-purple-500"></i>';
        }

        const safeName = (att.name || 'Вложение').replace(/'/g, "\\'");
        const isDataUrl = Boolean(att.url && att.url.startsWith('data:'));

        return `
        <div class="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/90 border border-google-border dark:border-google-darkBorder shadow-2xs">
            <div class="flex items-center space-x-2.5 truncate flex-1 min-w-0 mr-2 cursor-pointer" onclick="openAttachmentResource('${att.url}', '${safeName}')">
                <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0 overflow-hidden text-xs">
                    ${iconHtml}
                </div>
                <div class="truncate flex-1 min-w-0">
                    <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">${att.name}</p>
                    <p class="text-[10px] text-google-gray truncate">${isDataUrl ? 'Прикрепленный файл' : (att.url || 'Ссылка')}</p>
                </div>
            </div>
            <button type="button" onclick="studentPendingAttachments.splice(${i}, 1); renderStudentPendingAttachments();" class="text-google-gray hover:text-red-500 p-1.5 transition shrink-0" title="Удалить файл">
                <i class="fa-solid fa-xmark text-xs"></i>
            </button>
        </div>
        `;
    }).join('');
}

function initStudentWorkControls(course, assign) {
    const user = getCurrentUser();
    const btnAdd = document.getElementById('btn-student-add-attachment');
    const dropdown = document.getElementById('dropdown-student-add-attachment');
    const pickFileBtn = document.getElementById('btn-student-pick-file');
    const pickLinkBtn = document.getElementById('btn-student-pick-link');
    const fileInput = document.getElementById('input-student-file-upload');
    const btnSubmit = document.getElementById('assign-btn-submit-work');
    const btnUnsubmit = document.getElementById('assign-btn-unsubmit-work');

    // Dropdown toggle
    if (btnAdd && dropdown) {
        btnAdd.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        };
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target) && e.target !== btnAdd) {
                dropdown.classList.add('hidden');
            }
        };
        document.removeEventListener('click', closeDropdown);
        document.addEventListener('click', closeDropdown);
    }

    // Attach File
    if (pickFileBtn && fileInput) {
        pickFileBtn.onclick = () => {
            if (dropdown) dropdown.classList.add('hidden');
            fileInput.click();
        };
    }

    if (fileInput) {
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            for (const file of files) {
                const att = await readFileAsAttachment(file);
                studentPendingAttachments.push(att);
            }
            fileInput.value = '';
            renderStudentPendingAttachments();
            triggerToast(files.length === 1 ? `Файл "${files[0].name}" прикреплен к работе` : `Прикреплено файлов: ${files.length}`);
        };
    }

    // Attach Link
    if (pickLinkBtn) {
        pickLinkBtn.onclick = () => {
            if (dropdown) dropdown.classList.add('hidden');
            const url = prompt('Введите ссылку (URL) на вашу работу:', 'https://');
            if (url) {
                const label = prompt('Название или краткое описание ссылки:', 'Моя выполненная работа') || url;
                studentPendingAttachments.push({
                    type: 'link',
                    name: label,
                    url
                });
                renderStudentPendingAttachments();
                triggerToast('Ссылка прикреплена к работе');
            }
        };
    }

    // Submit work
    if (btnSubmit) {
        btnSubmit.onclick = async () => {
            if (studentPendingAttachments.length === 0) {
                if (!confirm('Вы не прикрепили файлы к работе. Сдать задание без вложений?')) {
                    return;
                }
            }
            if (!assign.submissions) assign.submissions = {};
            const nowStr = new Date().toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            assign.submissions[user.id] = {
                submittedAt: nowStr,
                attachments: [...studentPendingAttachments],
                grade: assign.submissions[user.id] ? assign.submissions[user.id].grade : null
            };
            studentPendingAttachments = [];
            persistState();
            triggerToast('Работа успешно сдана!');

            await sendServerAction('/api/assignments/submit', {
                assignmentId: assign.id,
                userId: user.id,
                submittedAt: nowStr,
                attachments: assign.submissions[user.id].attachments
            });

            renderFullAssignmentWorkspace(course, assign);
        };
    }

    // Unsubmit work
    if (btnUnsubmit) {
        btnUnsubmit.onclick = async () => {
            if (!confirm('Отменить отправку задания? Вы сможете изменить прикрепленные файлы и сдать работу заново.')) {
                return;
            }
            const existingSub = assign.submissions && assign.submissions[user.id];
            if (existingSub) {
                studentPendingAttachments = [...(existingSub.attachments || [])];
                existingSub.submittedAt = null;
            }
            persistState();
            triggerToast('Отправка работы отменена');

            await sendServerAction('/api/assignments/unsubmit', {
                assignmentId: assign.id,
                userId: user.id
            });

            renderFullAssignmentWorkspace(course, assign);
        };
    }

    renderStudentPendingAttachments();
}

function renderFullAssignmentWorkspace(course, assign) {
    if (!course || !assign) return;

    const user = getCurrentUser();
    const isTeacher = isCourseTeacher(course, user);

    // Back Button
    const backBtn = document.getElementById('btn-back-to-course-classwork');
    if (backBtn) {
        backBtn.onclick = () => {
            window.navigateTo('course', course.id);
            if (typeof switchCourseTab === 'function') switchCourseTab('classwork');
        };
    }

    const courseBadge = document.getElementById('assign-full-course-badge');
    if (courseBadge) courseBadge.textContent = course.name;

    // Assignment Main Details
    const titleEl = document.getElementById('assign-full-title');
    if (titleEl) titleEl.textContent = assign.title || 'Без названия';

    const authorEl = document.getElementById('assign-full-author');
    if (authorEl) {
        authorEl.textContent = `Автор: ${course.teacherName || course.name || 'Преподаватель'}`;
    }

    const deadlineEl = document.getElementById('assign-full-deadline');
    if (deadlineEl) {
        deadlineEl.textContent = assign.deadline && assign.deadline !== 'Без срока'
            ? `Срок сдачи: ${assign.deadline}`
            : 'Срок сдачи: Без срока';
    }

    const pointsEl = document.getElementById('assign-full-points');
    if (pointsEl) {
        pointsEl.textContent = `${assign.points || 100} баллов`;
    }

    // Edit button (for teacher only)
    const editBtn = document.getElementById('btn-edit-current-assignment');
    if (editBtn) {
        editBtn.classList.toggle('hidden', !isTeacher);
        if (isTeacher) {
            editBtn.onclick = () => window.navigateTo('edit-assignment', course.id, assign.id);
        }
    }

    // Description / Instructions
    const descEl = document.getElementById('assign-full-description');
    if (descEl) {
        descEl.textContent = assign.description || assign.instructions || 'Инструкция к выполнению не указана.';
    }

    // Attachments / Materials by Teacher
    const matBox = document.getElementById('assign-full-materials-box');
    const matList = document.getElementById('assign-full-materials-list');
    const atts = assign.attachments || [];
    if (matBox && matList) {
        if (atts.length > 0) {
            matBox.classList.remove('hidden');
            matList.innerHTML = atts.map(att => {
                const isImage = att.type === 'image' || (att.url && (att.url.startsWith('data:image/') || att.url.match(/\.(jpeg|jpg|gif|png|webp)/i)));
                const isPdf = att.type === 'pdf' || (att.url && (att.url.includes('application/pdf') || att.url.match(/\.pdf/i)));
                const isVideo = att.type === 'video';
                const isLink = att.type === 'link';

                let iconHtml = '<i class="fa-solid fa-paperclip text-google-blue"></i>';
                if (isVideo) iconHtml = '<i class="fa-brands fa-youtube text-red-500 text-lg"></i>';
                else if (isLink) iconHtml = '<i class="fa-solid fa-link text-emerald-500"></i>';
                else if (isPdf) iconHtml = '<i class="fa-solid fa-file-pdf text-red-600 text-lg"></i>';
                else if (isImage && att.url && att.url.startsWith('data:image/')) {
                    iconHtml = `<img src="${att.url}" class="w-full h-full object-cover">`;
                } else if (isImage) {
                    iconHtml = '<i class="fa-solid fa-image text-purple-500"></i>';
                }

                const safeName = (att.name || 'Материал').replace(/'/g, "\\'");
                const isDataUrl = Boolean(att.url && att.url.startsWith('data:'));

                return `
                <div onclick="openAttachmentResource('${att.url}', '${safeName}')" class="flex items-center space-x-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-google-border dark:border-google-darkBorder hover:border-google-blue dark:hover:border-google-blueDarkTheme hover:shadow-sm transition group cursor-pointer shadow-xs">
                    <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-sm shrink-0 overflow-hidden shadow-2xs">
                        ${iconHtml}
                    </div>
                    <div class="truncate flex-1 min-w-0">
                        <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 group-hover:text-google-blue dark:group-hover:text-google-blueDarkTheme truncate">${att.name || 'Прикрепленный материал'}</p>
                        <p class="text-[10px] text-google-gray truncate">${isDataUrl ? 'Нажмите для просмотра / скачивания' : (att.url || 'Материал')}</p>
                    </div>
                    <i class="fa-solid ${isDataUrl ? 'fa-download' : 'fa-arrow-up-right-from-square'} text-xs text-google-gray group-hover:text-google-blue shrink-0"></i>
                </div>
                `;
            }).join('');
        } else {
            matBox.classList.add('hidden');
            matList.innerHTML = '';
        }
    }

    // Role-based Cards Separation: Student Work Card vs Teacher Grading Card
    const studentCard = document.getElementById('assign-student-side-card');
    const teacherCard = document.getElementById('assign-teacher-side-card');

    if (isTeacher) {
        if (studentCard) studentCard.classList.add('hidden');
        if (teacherCard) teacherCard.classList.remove('hidden');

        // Populate teacher stats
        const subs = assign.submissions || {};
        const students = (appState.accounts || []).filter(a => (course.studentIds || []).includes(a.id));
        const submittedCount = Object.values(subs).filter(s => Boolean(s.submittedAt)).length;
        const gradedCount = Object.values(subs).filter(s => s.grade !== undefined && s.grade !== null && s.grade !== '').length;
        const pendingCount = students.length - submittedCount;

        const statSub = document.getElementById('teacher-stat-submitted');
        const statPen = document.getElementById('teacher-stat-pending');
        const statGrd = document.getElementById('teacher-stat-graded');
        if (statSub) statSub.textContent = submittedCount;
        if (statPen) statPen.textContent = Math.max(0, pendingCount);
        if (statGrd) statGrd.textContent = gradedCount;

        const studentsListEl = document.getElementById('assign-teacher-students-list');
        if (studentsListEl) {
            if (students.length === 0) {
                studentsListEl.innerHTML = '<p class="text-xs text-google-gray py-4 text-center">На этот курс еще не записаны студенты.</p>';
            } else {
                studentsListEl.innerHTML = students.map(st => {
                    const sub = subs[st.id];
                    const isSub = Boolean(sub && sub.submittedAt);
                    const gradeVal = sub && sub.grade !== undefined && sub.grade !== null ? sub.grade : '';
                    const studentAtts = (sub && sub.attachments) || [];
                    const attsHtml = studentAtts.length > 0 ? `
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${studentAtts.map(a => {
                                const safeName = (a.name || 'Файл').replace(/'/g, "\\'");
                                return `<button type="button" onclick="openAttachmentResource('${a.url}', '${safeName}')" class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-[10px] text-google-blue dark:text-blue-300 hover:underline max-w-[150px] truncate"><i class="fa-solid fa-paperclip text-[9px]"></i><span class="truncate">${a.name}</span></button>`;
                            }).join('')}
                        </div>
                    ` : '';

                    return `
                        <div class="p-3 rounded-2xl border border-google-border dark:border-google-darkBorder flex items-center justify-between space-x-2 bg-gray-50/50 dark:bg-gray-800/40">
                            <div class="flex items-center space-x-2.5 truncate flex-1 min-w-0">
                                <span class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 font-bold flex items-center justify-center text-xs shrink-0">${st.avatar || 'С'}</span>
                                <div class="truncate flex-1 min-w-0">
                                    <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">${st.name}</p>
                                    <p class="text-[10px] ${isSub ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-google-gray'}">${isSub ? `Сдано: ${sub.submittedAt}` : 'Не сдано'}</p>
                                    ${attsHtml}
                                </div>
                            </div>
                            <div class="flex items-center space-x-1.5 shrink-0">
                                <button type="button" onclick="openTeacherPrivateChat('${assign.id}', '${st.id}', '${st.name.replace(/'/g, "\\'")}')" class="p-2 rounded-xl border border-google-border dark:border-google-darkBorder hover:bg-blue-50 dark:hover:bg-blue-950/60 text-google-blue transition" title="Личные комментарии с этим студентом">
                                    <i class="fa-solid fa-comment-dots text-xs"></i>
                                </button>
                                <input type="number" min="0" max="${assign.points || 100}" value="${gradeVal}" placeholder="Балл" onchange="saveStudentGrade('${assign.id}', '${st.id}', this.value)" class="w-16 px-2 py-1 border border-google-border dark:border-google-darkBorder rounded-xl text-xs font-bold text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-google-blue">
                            </div>
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
        const hasGrade = sub && sub.grade !== undefined && sub.grade !== null && sub.grade !== '';

        const statusBadge = document.getElementById('assign-student-status-badge');
        const formBox = document.getElementById('assign-student-form');
        const submittedBox = document.getElementById('assign-student-submitted-box');
        const submittedText = document.getElementById('assign-student-submitted-text');
        const submittedGradeBox = document.getElementById('assign-student-submitted-grade-box');

        if (hasGrade) {
            if (statusBadge) {
                statusBadge.textContent = `Оценка: ${sub.grade}/${assign.points || 100}`;
                statusBadge.className = 'text-xs font-bold text-emerald-600 dark:text-emerald-400';
            }
            if (formBox) formBox.classList.add('hidden');
            if (submittedBox) submittedBox.classList.remove('hidden');
            if (submittedText) submittedText.innerHTML = renderSubmittedAttachmentsHtml(sub);
            if (submittedGradeBox) submittedGradeBox.textContent = `Ваш результат: ${sub.grade} из ${assign.points || 100} баллов`;
        } else if (isSubmitted) {
            if (statusBadge) {
                statusBadge.textContent = 'Сдано';
                statusBadge.className = 'text-xs font-bold text-google-blue dark:text-google-blueDarkTheme';
            }
            if (formBox) formBox.classList.add('hidden');
            if (submittedBox) submittedBox.classList.remove('hidden');
            if (submittedText) submittedText.innerHTML = renderSubmittedAttachmentsHtml(sub);
            if (submittedGradeBox) submittedGradeBox.textContent = 'Ожидает проверки преподавателем';
        } else {
            if (statusBadge) {
                statusBadge.textContent = 'Назначено';
                statusBadge.className = 'text-xs font-semibold text-google-gray';
            }
            if (formBox) formBox.classList.remove('hidden');
            if (submittedBox) submittedBox.classList.add('hidden');
        }

        initStudentWorkControls(course, assign);
        initStudentPrivateComments(course, assign);
    }

    // Public Comments
    initAssignmentPublicComments(course, assign);
}

function renderAssignmentPublicComments(assign) {
    const list = document.getElementById('assign-full-comments-list');
    if (!list) return;

    const comms = assign.comments || [];
    if (comms.length === 0) {
        list.innerHTML = '<p class="text-xs text-google-gray italic py-2">Комментариев курса по этому заданию пока нет</p>';
        return;
    }

    list.innerHTML = comms.map(c => {
        const authorAcc = (appState.accounts || []).find(a => a.name === c.authorName);
        const photo = c.photoUrl || authorAcc?.photoUrl;
        const avatarLetter = c.authorAvatar || authorAcc?.avatar || (c.authorName ? c.authorName[0] : 'П');
        const avatarHtml = photo
            ? `<img src="${photo}" class="w-7 h-7 rounded-full object-cover shrink-0 shadow-xs">`
            : `<span class="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/60 text-google-blue dark:text-blue-300 font-bold flex items-center justify-center text-[11px] shrink-0">${avatarLetter}</span>`;

        return `
        <div class="flex items-start space-x-3 text-xs p-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
            ${avatarHtml}
            <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                    <p class="font-bold text-gray-900 dark:text-gray-100 truncate">${escapeHtml(c.authorName || 'Пользователь')}</p>
                    <span class="text-[10px] text-google-gray shrink-0">${escapeHtml(c.date || '')}</span>
                </div>
                <p class="text-gray-800 dark:text-gray-200 mt-0.5 leading-relaxed whitespace-pre-line">${escapeHtml(c.text || '')}</p>
            </div>
        </div>
        `;
    }).join('');
    list.scrollTop = list.scrollHeight;
}

function initAssignmentPublicComments(course, assign) {
    const input = document.getElementById('input-assign-public-comment');
    const sendBtn = document.getElementById('btn-send-assign-public-comment');

    const handleSend = async () => {
        if (!input) return;
        const textVal = (input.value || '').trim();
        if (!textVal) return;

        const user = getCurrentUser();
        const dateStr = new Date().toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const newComment = {
            id: 'c_' + Date.now(),
            authorId: user.id,
            authorName: user.name,
            authorAvatar: user.avatar || user.name[0],
            photoUrl: user.photoUrl || null,
            bg: user.bg || null,
            date: dateStr,
            text: textVal
        };

        if (!assign.comments) assign.comments = [];
        assign.comments.push(newComment);
        persistState();
        input.value = '';
        renderAssignmentPublicComments(assign);
        triggerToast('Комментарий курса добавлен');

        await sendServerAction('/api/assignments/comment', {
            assignmentId: assign.id,
            courseId: course.id,
            authorName: user.name,
            authorAvatar: user.avatar || user.name[0],
            text: textVal,
            date: dateStr
        });
    };

    if (sendBtn) sendBtn.onclick = handleSend;
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
            }
        };
    }

    renderAssignmentPublicComments(assign);
}

function getPrivateCommentsForStudent(assign, studentId) {
    if (!assign || !assign.privateComments) return [];
    if (Array.isArray(assign.privateComments)) {
        return assign.privateComments.filter(c => c.studentId === studentId);
    }
    if (typeof assign.privateComments === 'object') {
        return assign.privateComments[studentId] || [];
    }
    return [];
}

function renderStudentPrivateComments(assign, studentId) {
    const list = document.getElementById('assign-private-comments-list');
    if (!list) return;

    const comms = getPrivateCommentsForStudent(assign, studentId);
    if (comms.length === 0) {
        list.innerHTML = '<p class="text-[11px] text-google-gray italic py-1">Личных сообщений пока нет</p>';
        return;
    }

    const currentUser = getCurrentUser() || {};
    const myId = currentUser.id;
    list.innerHTML = comms.map(c => {
        const isMe = (c.authorId && c.authorId === myId) || 
                     (c.authorName && currentUser.name && (c.authorName === currentUser.name || c.authorName.startsWith(currentUser.name)));
        return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} text-xs">
            <div class="max-w-[85%] rounded-2xl p-2.5 ${isMe ? 'bg-google-blue text-white rounded-br-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-xs'} shadow-2xs">
                <p class="text-[10px] font-semibold opacity-80 mb-0.5">${escapeHtml(c.authorName || 'Пользователь')} • ${c.date || ''}</p>
                <p class="leading-relaxed whitespace-pre-line">${escapeHtml(c.text || '')}</p>
            </div>
        </div>
        `;
    }).join('');
    list.scrollTop = list.scrollHeight;
}

function initStudentPrivateComments(course, assign) {
    const user = getCurrentUser();
    const studentId = user.id;
    const input = document.getElementById('input-assign-private-comment');
    const sendBtn = document.getElementById('btn-send-assign-private-comment');

    const handleSendPrivate = async () => {
        if (!input) return;
        const textVal = (input.value || '').trim();
        if (!textVal) return;

        const dateStr = new Date().toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const newComment = {
            id: 'pc_' + Date.now(),
            studentId: studentId,
            authorId: user.id,
            authorName: user.name,
            authorAvatar: user.avatar || user.name[0],
            photoUrl: user.photoUrl || null,
            date: dateStr,
            text: textVal
        };

        if (!assign.privateComments) assign.privateComments = [];
        if (Array.isArray(assign.privateComments)) {
            assign.privateComments.push(newComment);
        } else if (typeof assign.privateComments === 'object') {
            if (!assign.privateComments[studentId]) assign.privateComments[studentId] = [];
            assign.privateComments[studentId].push(newComment);
        }
        persistState();
        input.value = '';
        renderStudentPrivateComments(assign, studentId);
        triggerToast('Личное сообщение отправлено преподавателю');

        await sendServerAction('/api/assignments/private-comment', {
            assignmentId: assign.id,
            studentId,
            authorId: user.id,
            authorName: user.name,
            authorAvatar: user.avatar || user.name[0],
            text: textVal,
            date: dateStr
        });
    };

    if (sendBtn) sendBtn.onclick = handleSendPrivate;
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendPrivate();
            }
        };
    }

    renderStudentPrivateComments(assign, studentId);
}

let currentTeacherChat = {
    assignId: null,
    studentId: null
};

window.openTeacherPrivateChat = function(assignId, studentId, studentName) {
    currentTeacherChat.assignId = assignId;
    currentTeacherChat.studentId = studentId;

    const modal = document.getElementById('modal-teacher-private-chat');
    const titleEl = document.getElementById('teacher-chat-student-name');
    if (titleEl) titleEl.textContent = `Личные комментарии: ${studentName}`;
    if (modal) modal.classList.remove('hidden');

    renderTeacherChatMessages();

    const input = document.getElementById('input-teacher-chat-comment');
    const sendBtn = document.getElementById('btn-send-teacher-chat-comment');

    const handleSendTeacherComment = async () => {
        if (!input) return;
        const textVal = (input.value || '').trim();
        if (!textVal) return;

        const assign = (appState.assignments || []).find(a => a.id === currentTeacherChat.assignId);
        if (!assign) return;

        const user = getCurrentUser();
        const dateStr = new Date().toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const newComment = {
            id: 'pc_' + Date.now(),
            studentId: currentTeacherChat.studentId,
            authorId: user.id,
            authorName: user.name + ' (Преподаватель)',
            authorAvatar: user.avatar || user.name[0],
            photoUrl: user.photoUrl || null,
            date: dateStr,
            text: textVal
        };

        if (!assign.privateComments) assign.privateComments = [];
        if (Array.isArray(assign.privateComments)) {
            assign.privateComments.push(newComment);
        } else if (typeof assign.privateComments === 'object') {
            if (!assign.privateComments[currentTeacherChat.studentId]) assign.privateComments[currentTeacherChat.studentId] = [];
            assign.privateComments[currentTeacherChat.studentId].push(newComment);
        }
        persistState();
        input.value = '';
        renderTeacherChatMessages();
        triggerToast('Ответ отправлен студенту');

        await sendServerAction('/api/assignments/private-comment', {
            assignmentId: assign.id,
            studentId: currentTeacherChat.studentId,
            authorId: user.id,
            authorName: user.name + ' (Преподаватель)',
            authorAvatar: user.avatar || user.name[0],
            text: textVal,
            date: dateStr
        });
    };

    if (sendBtn) sendBtn.onclick = handleSendTeacherComment;
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendTeacherComment();
            }
        };
        input.focus();
    }
};

function renderTeacherChatMessages() {
    const list = document.getElementById('teacher-chat-messages-list');
    if (!list || !currentTeacherChat.assignId || !currentTeacherChat.studentId) return;

    const assign = (appState.assignments || []).find(a => a.id === currentTeacherChat.assignId);
    if (!assign) return;

    const comms = getPrivateCommentsForStudent(assign, currentTeacherChat.studentId);
    if (comms.length === 0) {
        list.innerHTML = '<p class="text-xs text-google-gray italic py-8 text-center">Переписка со студентом пока пуста. Напишите сообщение ниже.</p>';
        return;
    }

    const currentUser = getCurrentUser() || {};
    const myId = currentUser.id;
    list.innerHTML = comms.map(c => {
        const isMe = (c.authorId && c.authorId === myId) || 
                     (c.authorName && currentUser.name && (c.authorName === currentUser.name || c.authorName.startsWith(currentUser.name)));
        return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} text-xs">
            <div class="max-w-[85%] rounded-2xl p-2.5 ${isMe ? 'bg-google-blue text-white rounded-br-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-xs'} shadow-2xs">
                <p class="text-[10px] font-semibold opacity-80 mb-0.5">${escapeHtml(c.authorName || 'Преподаватель')} • ${c.date || ''}</p>
                <p class="leading-relaxed whitespace-pre-line">${escapeHtml(c.text || '')}</p>
            </div>
        </div>
        `;
    }).join('');
    list.scrollTop = list.scrollHeight;
}

// Function called during background sync to refresh visible comments in real time
window.refreshAssignmentCommentsIfOpen = function() {
    if (!appState.currentCourseId || !appState.currentAssignmentId) return;
    const viewAssign = document.getElementById('view-assignment-detail');
    if (!viewAssign || viewAssign.classList.contains('hidden')) return;

    const assign = (appState.assignments || []).find(a => a.id === appState.currentAssignmentId);
    if (!assign) return;

    // Refresh public comments
    renderAssignmentPublicComments(assign);

    // Refresh student private comments if student
    const user = getCurrentUser();
    if (user && user.id) {
        renderStudentPrivateComments(assign, user.id);
    }

    // Refresh teacher chat modal if open
    const teacherModal = document.getElementById('modal-teacher-private-chat');
    if (teacherModal && !teacherModal.classList.contains('hidden')) {
        renderTeacherChatMessages();
    }
};

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
