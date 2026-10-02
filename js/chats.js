// Google Classroom - Telegram Desktop Style Messenger Engine

let selectedCreateChatType = 'group';
let selectedDirectMemberId = null;
let selectedGroupMemberIds = [];
let editingChatInfoId = null;

function formatChatTime(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function getChatDisplayName(chat, user) {
    if (chat.type === 'direct') {
        const otherId = (chat.memberIds || []).find(id => id !== user.id) || (chat.memberIds || [])[0];
        const otherAcc = (appState.accounts || []).find(a => a.id === otherId);
        return otherAcc ? otherAcc.name : (chat.name || 'Личный диалог');
    }
    return chat.name || 'Чат';
}

function getChatDisplayAvatar(chat, user) {
    if (chat.type === 'direct') {
        const otherId = (chat.memberIds || []).find(id => id !== user.id) || (chat.memberIds || [])[0];
        const otherAcc = (appState.accounts || []).find(a => a.id === otherId);
        if (otherAcc) {
            return {
                avatar: otherAcc.avatar || 'П',
                bg: otherAcc.bg || 'from-sky-500 to-blue-600',
                photoUrl: otherAcc.photoUrl || '',
                isOnline: true
            };
        }
    }
    return {
        avatar: chat.avatar || (chat.type === 'channel' ? '📢' : '👥'),
        bg: chat.bg || 'from-sky-500 to-blue-600',
        photoUrl: chat.photoUrl || '',
        isOnline: false
    };
}

function getLastChatMessage(chatId) {
    const msgs = (appState.chatMessages || []).filter(m => m.chatId === chatId);
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
}

function renderChatsList() {
    const listContainer = document.getElementById('chats-dialogs-list');
    if (!listContainer) return;

    const user = getCurrentUser();
    const searchInput = document.getElementById('input-chats-search');
    const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

    // Ensure chats array
    if (!appState.chats) appState.chats = [];

    // Filter by category tab
    let chats = appState.chats.filter(c => {
        if (c.memberIds && c.memberIds.length > 0 && !c.memberIds.includes(user.id)) {
            return false;
        }
        if (currentChatFilter === 'direct') return c.type === 'direct';
        if (currentChatFilter === 'group') return c.type === 'group';
        if (currentChatFilter === 'channel') return c.type === 'channel';
        return true;
    });

    if (searchQuery) {
        chats = chats.filter(c => {
            const name = getChatDisplayName(c, user).toLowerCase();
            return name.includes(searchQuery);
        });
    }

    if (chats.length === 0) {
        listContainer.innerHTML = `
            <div class="p-8 text-center text-google-gray space-y-2">
                <i class="fa-solid fa-comments text-3xl opacity-40"></i>
                <p class="text-xs">Чатов в этом разделе пока нет</p>
                <button type="button" onclick="openCreateChatModal()" class="text-xs text-sky-500 font-semibold hover:underline">Создать чат</button>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = chats.map(c => {
        const isActive = c.id === appState.activeChatId;
        const displayName = getChatDisplayName(c, user);
        const displayAvatar = getChatDisplayAvatar(c, user);
        const lastMsg = getLastChatMessage(c.id);
        const timeStr = lastMsg ? formatChatTime(lastMsg.timestamp) : (c.createdAt ? formatChatTime(c.createdAt) : '');

        let snippet = lastMsg ? lastMsg.text : (c.description || 'Чат создан');

        return `
            <div onclick="openChat('${c.id}')" class="p-3 mx-2 my-1 rounded-2xl flex items-center space-x-3 cursor-pointer transition select-none ${isActive ? 'bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}">
                <div class="relative shrink-0">
                    <div class="w-11 h-11 rounded-full bg-gradient-to-tr ${displayAvatar.bg} text-white font-bold flex items-center justify-center text-sm shadow overflow-hidden">
                        ${displayAvatar.photoUrl ? `<img src="${displayAvatar.photoUrl}" class="w-full h-full object-cover">` : displayAvatar.avatar}
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <p class="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">${displayName}</p>
                        <span class="text-[10px] text-google-gray">${timeStr}</span>
                    </div>
                    <p class="text-[11px] text-google-gray truncate mt-0.5">${snippet}</p>
                </div>
            </div>
        `;
    }).join('');
}

function openChat(chatId) {
    appState.activeChatId = chatId;
    persistState();

    const emptyState = document.getElementById('chats-empty-state');
    const header = document.getElementById('chats-active-header');
    const msgContainer = document.getElementById('chats-messages-container');
    const inputBar = document.getElementById('chats-active-input-bar');

    if (!chatId) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (header) header.classList.add('hidden');
        if (msgContainer) msgContainer.classList.add('hidden');
        if (inputBar) inputBar.classList.add('hidden');
        renderChatsList();
        return;
    }

    const chat = (appState.chats || []).find(c => c.id === chatId);
    if (!chat) {
        openChat(null);
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (header) header.classList.remove('hidden');
    if (msgContainer) msgContainer.classList.remove('hidden');
    if (inputBar) inputBar.classList.remove('hidden');

    const user = getCurrentUser();
    const displayName = getChatDisplayName(chat, user);
    const displayAvatar = getChatDisplayAvatar(chat, user);

    document.getElementById('chat-active-name').textContent = displayName;
    document.getElementById('chat-active-type').textContent = chat.type === 'channel' ? 'Канал' : (chat.type === 'group' ? `${(chat.memberIds || []).length} участников` : 'Личный чат');

    const avatarBox = document.getElementById('chat-active-avatar');
    if (avatarBox) {
        avatarBox.className = `w-10 h-10 rounded-full bg-gradient-to-tr ${displayAvatar.bg} text-white font-bold flex items-center justify-center text-xs shadow overflow-hidden`;
        avatarBox.innerHTML = displayAvatar.photoUrl ? `<img src="${displayAvatar.photoUrl}" class="w-full h-full object-cover">` : displayAvatar.avatar;
    }

    renderActiveChatMessages(chat);
    renderChatsList();
}

function renderActiveChatMessages(chat) {
    const box = document.getElementById('chats-messages-container');
    if (!box) return;

    const user = getCurrentUser();
    const msgs = (appState.chatMessages || []).filter(m => m.chatId === chat.id);

    if (msgs.length === 0) {
        box.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-google-gray space-y-2 opacity-60">
                <i class="fa-regular fa-comment-dots text-4xl"></i>
                <p class="text-xs">Сообщений в этом чате пока нет. Начните диалог первым!</p>
            </div>
        `;
        return;
    }

    box.innerHTML = msgs.map(m => {
        const isMine = m.senderId === user.id;
        const timeStr = formatChatTime(m.timestamp);

        return `
            <div class="flex items-end space-x-2 ${isMine ? 'justify-end' : 'justify-start'}">
                ${!isMine ? `
                    <div onclick="openTelegramUserProfile('${m.senderId}')" class="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 cursor-pointer shadow-sm hover:opacity-90">
                        ${m.senderAvatar || 'С'}
                    </div>
                ` : ''}
                <div class="max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${isMine ? 'bg-sky-500 text-white rounded-br-none' : 'bg-white dark:bg-google-darkCard text-gray-900 dark:text-gray-100 rounded-bl-none border border-google-border dark:border-google-darkBorder'}">
                    ${!isMine && chat.type !== 'direct' ? `<p onclick="openTelegramUserProfile('${m.senderId}')" class="font-bold text-[10px] text-sky-600 dark:text-sky-400 cursor-pointer hover:underline mb-0.5">${m.senderName}</p>` : ''}
                    <p class="whitespace-pre-wrap leading-relaxed">${m.text}</p>
                    <div class="flex justify-end mt-1">
                        <span class="text-[9px] opacity-70">${timeStr}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('input-chat-message');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const user = getCurrentUser();
    const chatId = appState.activeChatId;
    if (!chatId) return;

    input.value = '';

    const newMsg = {
        id: 'msg_' + Date.now(),
        chatId,
        senderId: user.id,
        senderName: user.name,
        senderAvatar: user.avatar,
        senderPhoto: user.photoUrl || '',
        text,
        attachments: [],
        timestamp: Date.now()
    };

    if (!appState.chatMessages) appState.chatMessages = [];
    appState.chatMessages.push(newMsg);
    persistState();

    const chat = (appState.chats || []).find(c => c.id === chatId);
    if (chat) renderActiveChatMessages(chat);
    renderChatsList();

    await sendServerAction('/api/chats/message', newMsg);
}

// Telegram User Profile Modal (Req 10)
window.openTelegramUserProfile = function(userId) {
    const targetUser = (appState.accounts || []).find(a => a.id === userId);
    if (!targetUser) return;

    const modal = document.getElementById('modal-telegram-user-profile');
    if (!modal) return;

    document.getElementById('tg-profile-name').textContent = targetUser.name;
    document.getElementById('tg-profile-email').textContent = targetUser.email || 'Email скрыт';

    const roleBadge = document.getElementById('tg-profile-role-badge');
    if (roleBadge) {
        const isTeacher = targetUser.role === 'teacher';
        roleBadge.textContent = isTeacher ? 'Преподаватель' : 'Студент';
        roleBadge.className = isTeacher 
            ? 'px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-google-blue dark:text-blue-300'
            : 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-google-green dark:text-emerald-300';
    }

    const avatarBox = document.getElementById('tg-profile-avatar-box');
    if (avatarBox) {
        if (targetUser.photoUrl) {
            avatarBox.innerHTML = `<img src="${targetUser.photoUrl}" class="w-full h-full object-cover">`;
        } else {
            avatarBox.className = `w-24 h-24 rounded-full ring-4 ring-white dark:ring-google-darkCard shadow-xl overflow-hidden bg-gradient-to-tr ${targetUser.bg || 'from-sky-500 to-blue-600'} text-white font-bold text-2xl flex items-center justify-center`;
            avatarBox.innerHTML = targetUser.avatar || 'С';
        }
    }

    const btnDirect = document.getElementById('btn-tg-start-direct-chat');
    if (btnDirect) {
        btnDirect.onclick = () => {
            modal.classList.add('hidden');
            startDirectChatWithUser(targetUser.id);
        };
    }

    modal.classList.remove('hidden');
};

window.closeTelegramUserProfile = function() {
    const modal = document.getElementById('modal-telegram-user-profile');
    if (modal) modal.classList.add('hidden');
};

function startDirectChatWithUser(targetUserId) {
    const user = getCurrentUser();
    if (user.id === targetUserId) {
        triggerToast('Нельзя создать диалог с самим собой', true);
        return;
    }

    if (!appState.chats) appState.chats = [];
    let chat = appState.chats.find(c => c.type === 'direct' && (c.memberIds || []).includes(user.id) && (c.memberIds || []).includes(targetUserId));

    if (!chat) {
        const target = (appState.accounts || []).find(a => a.id === targetUserId);
        chat = {
            id: 'chat_' + Date.now(),
            type: 'direct',
            name: target ? target.name : 'Личный чат',
            description: '',
            avatar: target ? target.avatar : '💬',
            bg: target ? target.bg : 'from-sky-500 to-blue-600',
            photoUrl: target ? target.photoUrl : '',
            memberIds: [user.id, targetUserId],
            adminIds: [user.id],
            createdAt: Date.now()
        };
        appState.chats.unshift(chat);
        persistState();
        sendServerAction('/api/chats/create', chat);
    }

    window.navigateTo('chats');
    openChat(chat.id);
}

function openCreateChatModal() {
    const modal = document.getElementById('modal-create-chat');
    if (modal) modal.classList.remove('hidden');
    selectedGroupMemberIds = [];
    selectedDirectMemberId = null;
    renderCreateChatMembersList();
}

function renderCreateChatMembersList() {
    const container = document.getElementById('create-chat-members-list');
    if (!container) return;

    const user = getCurrentUser();
    const otherAccs = (appState.accounts || []).filter(a => a.id !== user.id);

    if (otherAccs.length === 0) {
        container.innerHTML = '<p class="text-xs text-google-gray py-4 text-center">Других пользователей в системе пока нет</p>';
        return;
    }

    container.innerHTML = otherAccs.map(acc => {
        const isSelected = selectedCreateChatType === 'direct' 
            ? selectedDirectMemberId === acc.id 
            : selectedGroupMemberIds.includes(acc.id);

        return `
            <div onclick="toggleChatMemberSelection('${acc.id}')" class="p-2.5 rounded-xl border border-google-border dark:border-google-darkBorder flex items-center justify-between cursor-pointer transition ${isSelected ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700/60'}">
                <div class="flex items-center space-x-2.5 truncate">
                    <span class="w-7 h-7 rounded-full bg-gradient-to-tr ${acc.bg || 'from-sky-500 to-blue-600'} text-white flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                        ${acc.photoUrl ? `<img src="${acc.photoUrl}" class="w-full h-full object-cover">` : (acc.avatar || 'П')}
                    </span>
                    <div class="truncate">
                        <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">${acc.name}</p>
                        <p class="text-[10px] text-google-gray">${acc.role === 'teacher' ? 'Преподаватель' : 'Студент'} • ${acc.email}</p>
                    </div>
                </div>
                <div class="shrink-0 ml-2">
                    <i class="fa-solid ${isSelected ? 'fa-circle-check text-sky-500' : 'fa-circle text-gray-300 dark:text-gray-600'} text-sm"></i>
                </div>
            </div>
        `;
    }).join('');
}

window.toggleChatMemberSelection = function(accId) {
    if (selectedCreateChatType === 'direct') {
        selectedDirectMemberId = accId;
    } else {
        const idx = selectedGroupMemberIds.indexOf(accId);
        if (idx >= 0) {
            selectedGroupMemberIds.splice(idx, 1);
        } else {
            selectedGroupMemberIds.push(accId);
        }
    }
    renderCreateChatMembersList();
};

function initChatsView() {
    // Category filter tabs
    document.querySelectorAll('.chat-tab-btn').forEach(btn => {
        btn.onclick = () => {
            currentChatFilter = btn.dataset.chatFilter || 'all';
            document.querySelectorAll('.chat-tab-btn').forEach(b => {
                const active = b === btn;
                b.classList.toggle('bg-sky-50', active);
                b.classList.toggle('text-sky-600', active);
                b.classList.toggle('dark:bg-sky-950', active);
                b.classList.toggle('dark:text-sky-300', active);
                b.classList.toggle('text-google-gray', !active);
            });
            renderChatsList();
        };
    });

    const searchInput = document.getElementById('input-chats-search');
    if (searchInput) {
        searchInput.oninput = () => renderChatsList();
    }

    const btnOpenCreate = document.getElementById('btn-open-create-chat');
    if (btnOpenCreate) {
        btnOpenCreate.onclick = openCreateChatModal;
    }

    document.querySelectorAll('.create-chat-type-btn').forEach(btn => {
        btn.onclick = () => {
            selectedCreateChatType = btn.dataset.chatType;
            document.querySelectorAll('.create-chat-type-btn').forEach(b => {
                const active = b === btn;
                b.classList.toggle('border-sky-500', active);
                b.classList.toggle('bg-sky-50', active);
                b.classList.toggle('dark:bg-sky-950/60', active);
                b.classList.toggle('text-sky-600', active);
                b.classList.toggle('dark:text-sky-300', active);
                b.classList.toggle('border-google-border', !active);
                b.classList.toggle('dark:border-google-darkBorder', !active);
                b.classList.toggle('text-google-gray', !active);
            });

            const isDirect = selectedCreateChatType === 'direct';
            const isChannel = selectedCreateChatType === 'channel';
            document.getElementById('field-chat-name-box').classList.toggle('hidden', isDirect);
            document.getElementById('field-chat-desc-box').classList.toggle('hidden', isDirect);
            document.getElementById('label-chat-members').textContent = isDirect ? 'Выберите собеседника:' : (isChannel ? 'Добавить подписчиков (необязательно):' : 'Выберите участников группы:');
            renderCreateChatMembersList();
        };
    });

    const btnSubmitCreate = document.getElementById('btn-submit-create-chat');
    if (btnSubmitCreate) {
        btnSubmitCreate.onclick = async () => {
            const user = getCurrentUser();
            let name = document.getElementById('input-create-chat-name').value.trim();
            const desc = document.getElementById('input-create-chat-desc').value.trim();
            let members = [user.id];

            if (selectedCreateChatType === 'direct') {
                if (!selectedDirectMemberId) {
                    triggerToast('Выберите собеседника для диалога', true);
                    return;
                }
                members.push(selectedDirectMemberId);
                const other = (appState.accounts || []).find(a => a.id === selectedDirectMemberId);
                name = other ? other.name : 'Личный чат';
            } else {
                if (!name) {
                    triggerToast('Введите название группы или канала', true);
                    return;
                }
                members = Array.from(new Set([...members, ...selectedGroupMemberIds]));
            }

            const newChat = {
                id: 'chat_' + Date.now(),
                type: selectedCreateChatType,
                name,
                description: desc,
                avatar: selectedCreateChatType === 'channel' ? '📢' : (selectedCreateChatType === 'group' ? '👥' : '💬'),
                bg: 'from-sky-500 to-blue-600',
                photoUrl: '',
                memberIds: members,
                adminIds: [user.id],
                createdAt: Date.now()
            };

            if (!appState.chats) appState.chats = [];
            appState.chats.unshift(newChat);
            appState.activeChatId = newChat.id;
            persistState();

            document.getElementById('modal-create-chat').classList.add('hidden');
            document.getElementById('input-create-chat-name').value = '';
            document.getElementById('input-create-chat-desc').value = '';

            renderChatsList();
            openChat(newChat.id);
            triggerToast('Чат успешно создан!');

            await sendServerAction('/api/chats/create', newChat);
        };
    }

    // Enter to send message
    const msgInput = document.getElementById('input-chat-message');
    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    const sendBtn = document.getElementById('btn-send-chat-msg');
    if (sendBtn) sendBtn.onclick = sendChatMessage;

    // Initial render
    renderChatsList();
    if (appState.activeChatId && (appState.chats || []).some(c => c.id === appState.activeChatId)) {
        openChat(appState.activeChatId);
    } else {
        openChat(null);
    }
}
