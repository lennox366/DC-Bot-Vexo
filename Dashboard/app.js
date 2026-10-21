document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let selectedGuild = null;
    let selectedChannel = null;
    let chatMessages = [];
    let lastMessageId = null;
    let socket = null;

    const botStatus = document.getElementById("botStatus");
    const userProfile = document.getElementById("userProfile");
    const guildList = document.getElementById("guildList");
    const channelList = document.getElementById("channelList");
    const mainNav = document.getElementById("mainNav");
    
    const welcome = document.getElementById("welcome");
    const welcomeMsg = document.getElementById("welcomeMsg");
    const serverPanel = document.getElementById("serverPanel");
    const actionPanel = document.getElementById("actionPanel");
    const serverView = document.getElementById("serverView");
    const membersView = document.getElementById("membersView");
    const chatView = document.getElementById("chatView");

    const tabServerBtn = document.getElementById("tabServerBtn");
    const tabMembersBtn = document.getElementById("tabMembersBtn");

    // Initialize Socket.io connection
    function initSocket() {
        if (socket) socket.disconnect();
        
        socket = io();
        
        socket.on('connect', () => {
            console.log('Socket.io verbunden');
        });
        
        socket.on('newMessage', (data) => {
            if (selectedChannel && data.channelId === selectedChannel.id && !chatView.classList.contains('hidden')) {
                // Add new message to chat
                const container = document.getElementById("chatMessages");
                const msgEl = createMessageElement(data.message);
                container.appendChild(msgEl);
                
                // Auto-scroll to bottom
                container.scrollTop = container.scrollHeight;
                
                // Update chat messages array
                chatMessages.push(data.message);
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Socket.io getrennt');
        });
    }

    async function api(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: { "Content-Type": "application/json", ...(options.headers || {}) }
        });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { throw new Error(`Ungültige Antwort: ${text.substring(0, 100)}`); }
        if (!response.ok) throw new Error(data.error || `HTTP-Fehler ${response.status}`);
        return data;
    }

    async function loadUser() {
        try {
            const res = await api("/api/me");
            if (res.loggedIn) {
                currentUser = res.user;
                renderUserHeader();
                mainNav.classList.remove("hidden");
                welcomeMsg.textContent = "Wähle links einen Discord-Server aus, um dessen Kanäle zu verwalten.";
                
                // Initialize socket connection
                if (!socket) {
                    initSocket();
                }
                
                loadGuilds();
            } else {
                // Für Testing: Server auch ohne Login laden
                userProfile.innerHTML = `<span style="color: #8f96a3;">Demo-Modus (kein Login)</span>`;
                mainNav.classList.remove("hidden");
                welcomeMsg.textContent = "Wähle links einen Discord-Server aus, um dessen Kanäle zu verwalten.";
                
                // Initialize socket connection
                if (!socket) {
                    initSocket();
                }
                
                loadGuilds();
            }
        } catch (err) {
            console.error("User Load Error:", err);
            // Bei Fehler trotzdem Server laden für Testing
            userProfile.innerHTML = `<span style="color: #8f96a3;">Demo-Modus (kein Login)</span>`;
            mainNav.classList.remove("hidden");
            welcomeMsg.textContent = "Wähle links einen Discord-Server aus, um dessen Kanäle zu verwalten.";
            loadGuilds();
        }
    }

    function renderUserHeader() {
        const avatar = currentUser.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
        userProfile.innerHTML = `
            <div class="user-badge">
                <img src="${avatar}" alt="Avatar">
                <div>
                    <div><strong>${escapeHtml(currentUser.username)}</strong> <span class="role-tag role-${currentUser.role}">${currentUser.role}</span></div>
                    <div style="font-size:10px; color:#8f96a3;">${escapeHtml(currentUser.email)}</div>
                </div>
                <a href="/auth/logout" class="logout-link">Abmelden</a>
            </div>
        `;

        if (currentUser.role !== "OWNER" && currentUser.role !== "CO-OWNER") {
            tabMembersBtn.classList.add("hidden");
        } else {
            tabMembersBtn.classList.remove("hidden");
        }
    }

    async function loadBotStatus() {
        try {
            const data = await api("/api/status");
            if (data.online) {
                botStatus.className = "status online";
                botStatus.textContent = "● Bot Online";
            } else {
                botStatus.className = "status offline";
                botStatus.textContent = "● Bot Offline";
            }
        } catch {
            botStatus.className = "status offline";
            botStatus.textContent = "● Offline";
        }
    }

    async function loadGuilds() {
        if (!guildList) return;
        guildList.innerHTML = `<div class="loading">Server werden geladen...</div>`;
        try {
            const guilds = await api("/api/guilds");
            guildList.innerHTML = "";
            if (guilds.length === 0) {
                guildList.innerHTML = `<div class="loading">Keine Server gefunden.</div>`;
                return;
            }
            guilds.forEach(guild => {
                const el = document.createElement("div");
                el.className = "guild";
                const icon = guild.icon ? `<img src="${guild.icon}">` : "🤖";
                el.innerHTML = `<div class="guild-icon">${icon}</div><div><strong>${escapeHtml(guild.name)}</strong><br><small>${guild.memberCount} Mitglieder</small></div>`;
                el.addEventListener("click", () => selectGuild(guild, el));
                guildList.appendChild(el);
            });
        } catch (err) {
            guildList.innerHTML = `<div class="loading">❌ ${escapeHtml(err.message)}</div>`;
        }
    }

    async function selectGuild(guild, element) {
        selectedGuild = guild;
        selectedChannel = null;
        document.querySelectorAll(".guild").forEach(i => i.classList.remove("active"));
        element.classList.add("active");

        welcome.classList.add("hidden");
        serverPanel.classList.remove("hidden");
        actionPanel.classList.add("hidden");

        document.getElementById("selectedGuildName").textContent = guild.name;
        document.getElementById("selectedGuildInfo").textContent = `${guild.memberCount} Mitglieder · ID: ${guild.id}`;

        await loadChannels(guild.id);
        if (!membersView.classList.contains("hidden")) {
            loadMembers();
        }
    }

    async function loadChannels(guildId) {
        channelList.innerHTML = `<div class="loading">Kanäle werden geladen...</div>`;
        try {
            const channels = await api(`/api/guilds/${guildId}/channels`);
            channelList.innerHTML = "";

            const categories = channels.filter(c => c.type === 4);
            const uncategorized = channels.filter(c => c.type !== 4 && !c.parentId);

            // Render Kategorien
            categories.forEach(cat => {
                const catChannels = channels.filter(c => c.parentId === cat.id);
                const catEl = document.createElement("div");
                catEl.className = "category-item";

                const textChans = catChannels.filter(c => c.type === 0);
                const voiceChans = catChannels.filter(c => c.type === 2);

                let channelsHtml = "";
                if (textChans.length > 0) {
                    channelsHtml += `<div style="font-size:11px; color:#8f96a3; margin: 4px 0;">▼ TEXTKANÄLE</div>`;
                    textChans.forEach(c => channelsHtml += `<div class="channel" data-id="${c.id}" data-name="${escapeHtml(c.name)}"># ${escapeHtml(c.name)}</div>`);
                }
                if (voiceChans.length > 0) {
                    channelsHtml += `<div style="font-size:11px; color:#8f96a3; margin: 4px 0;">▼ SPRACHKANÄLE</div>`;
                    voiceChans.forEach(c => channelsHtml += `<div class="channel" data-id="${c.id}" data-name="${escapeHtml(c.name)}">🔊 ${escapeHtml(c.name)}</div>`);
                }

                catEl.innerHTML = `
                    <div class="category-header"><span class="arrow">▶</span> 📁 ${escapeHtml(cat.name)}</div>
                    <div class="category-channels">${channelsHtml || '<small style="color:#8f96a3;">Keine Kanäle</small>'}</div>
                `;

                catEl.querySelector(".category-header").addEventListener("click", () => {
                    catEl.classList.toggle("open");
                });

                channelList.appendChild(catEl);
            });

            // Kanal Klick Event Binden
            document.querySelectorAll(".channel").forEach(chEl => {
                chEl.addEventListener("click", (e) => {
                    e.stopPropagation();
                    selectChannel({ id: chEl.dataset.id, name: chEl.dataset.name }, chEl);
                });
            });

        } catch (err) {
            channelList.innerHTML = `<div class="loading">❌ ${escapeHtml(err.message)}</div>`;
        }
    }

    function selectChannel(channel, element) {
        selectedChannel = channel;
        document.querySelectorAll(".channel").forEach(i => i.classList.remove("active"));
        element.classList.add("active");

        document.getElementById("selectedChannelName").textContent = `#${channel.name}`;
        actionPanel.classList.remove("hidden");
    }

    async function loadMembers() {
        if (!selectedGuild) return;
        const container = document.getElementById("membersContainer");
        container.innerHTML = `<div class="loading">Mitglieder werden geladen...</div>`;

        try {
            const members = await api(`/api/guilds/${selectedGuild.id}/members`);
            container.innerHTML = "";

            members.forEach(m => {
                const card = document.createElement("div");
                card.className = "member-card";
                
                let roleSelectHtml = `<span class="role-tag role-${m.dashboardRole}">${m.dashboardRole}</span>`;
                
                if (currentUser.role === "OWNER") {
                    roleSelectHtml = `
                        <select class="role-select" data-userid="${m.id}">
                            <option value="OWNER" ${m.dashboardRole === 'OWNER' ? 'selected' : ''}>OWNER</option>
                            <option value="CO-OWNER" ${m.dashboardRole === 'CO-OWNER' ? 'selected' : ''}>CO-OWNER</option>
                            <option value="BETA-TESTER" ${m.dashboardRole === 'BETA-TESTER' ? 'selected' : ''}>BETA-TESTER</option>
                            <option value="MEMBER" ${m.dashboardRole === 'MEMBER' ? 'selected' : ''}>MEMBER</option>
                        </select>
                    `;
                }

                card.innerHTML = `
                    <img src="${m.avatar}">
                    <div class="member-info">
                        <h4>${escapeHtml(m.username)}</h4>
                        <p>Global: ${escapeHtml(m.global_name)}</p>
                        <p>ID: ${m.id}</p>
                        <div style="margin-top:6px;">${roleSelectHtml}</div>
                    </div>
                `;

                container.appendChild(card);
            });

            // Rollenänderung durch Owner
            document.querySelectorAll(".role-select").forEach(sel => {
                sel.addEventListener("change", async (e) => {
                    const targetUserId = e.target.dataset.userid;
                    const newRole = e.target.value;
                    try {
                        await api("/api/roles/update", {
                            method: "POST",
                            body: JSON.stringify({ targetUserId, newRole })
                        });
                        alert("Rolle erfolgreich geändert!");
                    } catch (err) {
                        alert(`Fehler: ${err.message}`);
                        loadMembers();
                    }
                });
            });

        } catch (err) {
            container.innerHTML = `<div class="loading">❌ ${escapeHtml(err.message)}</div>`;
        }
    }

    // TAB NAVIGATION
    tabServerBtn.addEventListener("click", () => {
        tabServerBtn.classList.add("active");
        tabMembersBtn.classList.remove("active");
        serverView.classList.remove("hidden");
        membersView.classList.add("hidden");
    });

    tabMembersBtn.addEventListener("click", () => {
        tabMembersBtn.classList.add("active");
        tabServerBtn.classList.remove("active");
        membersView.classList.remove("hidden");
        serverView.classList.add("hidden");
        loadMembers();
    });

    window.showMessageBox = function () {
        document.getElementById("messageBox").classList.remove("hidden");
    };

    document.getElementById("sendMessage")?.addEventListener("click", async () => {
        const input = document.getElementById("messageInput");
        const resEl = document.getElementById("messageResult");
        if (!input.value.trim()) return;

        try {
            await api("/api/send-message", {
                method: "POST",
                body: JSON.stringify({ guildId: selectedGuild.id, channelId: selectedChannel.id, message: input.value })
            });
            resEl.textContent = "✅ Nachricht gesendet!";
            input.value = "";
        } catch (err) {
            resEl.textContent = `❌ ${err.message}`;
        }
    });

    // CHAT VIEW FUNCTIONS
    window.showChatView = function () {
        if (!selectedChannel) {
            alert("Bitte wähle zuerst einen Kanal aus.");
            return;
        }
        
        // Initialize socket if not already connected
        if (!socket) {
            initSocket();
        }
        
        chatView.classList.remove("hidden");
        actionPanel.classList.add("hidden");
        document.getElementById("chatViewTitle").textContent = `💬 #${selectedChannel.name}`;
        document.getElementById("chatChannelInfo").textContent = `Server: ${selectedGuild.name} | Kanal: #${selectedChannel.name}`;
        
        loadChatMessages();
    };

    window.closeChatView = function () {
        chatView.classList.add("hidden");
        actionPanel.classList.remove("hidden");
        chatMessages = [];
        lastMessageId = null;
    };

    async function loadChatMessages(before = null) {
        const container = document.getElementById("chatMessages");
        
        if (!before) {
            container.innerHTML = `<div class="loading">Nachrichten werden geladen...</div>`;
        }

        try {
            let url = `/api/channels/${selectedChannel.id}/messages?limit=50`;
            if (before) {
                url += `&before=${before}`;
            }

            const messages = await api(url);
            
            if (!before) {
                chatMessages = messages;
                container.innerHTML = "";
                
                if (messages.length === 0) {
                    container.innerHTML = `<div style="text-align: center; color: #8f96a3; padding: 20px;">Keine Nachrichten in diesem Kanal.</div>`;
                    return;
                }
                
                // Load more button
                const loadMoreBtn = document.createElement("div");
                loadMoreBtn.className = "load-more-messages";
                loadMoreBtn.textContent = "📜 Ältere Nachrichten laden";
                loadMoreBtn.addEventListener("click", () => {
                    if (chatMessages.length > 0) {
                        loadChatMessages(chatMessages[0].id);
                    }
                });
                container.appendChild(loadMoreBtn);
            } else {
                // Prepend older messages
                chatMessages = [...messages, ...chatMessages];
            }

            // Render messages
            messages.forEach(msg => {
                const msgEl = createMessageElement(msg);
                if (before) {
                    // Insert after load more button
                    container.insertBefore(msgEl, container.children[1]);
                } else {
                    container.appendChild(msgEl);
                }
            });

            // Update last message ID for pagination
            if (messages.length > 0) {
                lastMessageId = messages[messages.length - 1].id;
            }

            // Scroll to bottom if loading initial messages
            if (!before) {
                container.scrollTop = container.scrollHeight;
            }

        } catch (err) {
            if (!before) {
                container.innerHTML = `<div class="loading">❌ ${escapeHtml(err.message)}</div>`;
            } else {
                alert(`Fehler beim Laden älterer Nachrichten: ${err.message}`);
            }
        }
    }

    function createMessageElement(msg) {
        const div = document.createElement("div");
        div.className = `chat-message ${msg.author.isBot ? 'bot-message' : ''}`;
        
        const time = new Date(msg.timestamp);
        const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        
        const botTag = msg.author.isBot ? `<span class="chat-message-bot-tag">BOT</span>` : '';
        
        div.innerHTML = `
            <img src="${msg.author.avatar}" alt="Avatar" class="chat-message-avatar">
            <div class="chat-message-content">
                <div class="chat-message-header">
                    <span class="chat-message-username">${escapeHtml(msg.author.displayName)}</span>
                    ${botTag}
                    <span class="chat-message-timestamp">${timeStr}</span>
                </div>
                <div class="chat-message-text">${formatMessageContent(msg.content)}</div>
            </div>
        `;
        
        return div;
    }

    function formatMessageContent(content) {
        // Basic Discord-like formatting
        let formatted = escapeHtml(content);
        
        // Bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Code
        formatted = formatted.replace(/`(.*?)`/g, '<code style="background: #2f3136; padding: 2px 4px; border-radius: 3px;">$1</code>');
        // Code blocks
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre style="background: #2f3136; padding: 10px; border-radius: 5px; overflow-x: auto;"><code>$1</code></pre>');
        // Links
        formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #5865f2;">$1</a>');
        
        return formatted;
    }

    // Chat input handling
    const chatInput = document.getElementById("chatInput");
    const chatSendButton = document.getElementById("chatSendButton");

    async function sendChatMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        try {
            await api("/api/send-message", {
                method: "POST",
                body: JSON.stringify({ 
                    guildId: selectedGuild.id, 
                    channelId: selectedChannel.id, 
                    message: message 
                })
            });
            
            chatInput.value = "";
            
            // Reload messages to show the sent message
            setTimeout(() => {
                loadChatMessages();
            }, 500);
            
        } catch (err) {
            alert(`Fehler beim Senden: ${err.message}`);
        }
    }

    chatSendButton.addEventListener("click", sendChatMessage);
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendChatMessage();
        }
    });

    loadBotStatus();
    loadUser();
});