const models = {
  claude: {
    id: 'claude',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    icon: '✦',
    iconClass: 'claude-icon',
    description: 'Thoughtful, articulate, and great at turning a rough idea into a clear plan.',
    subtitle: 'Balanced reasoning',
    reply: 'I’d start by making the shape of the idea visible. Here’s a simple path: define the outcome, name the audience, then choose the smallest useful first step. That gives the work momentum without pretending everything is known yet.'
  },
  openai: {
    id: 'openai',
    name: 'GPT-4.1',
    provider: 'OpenAI',
    icon: '◇',
    iconClass: 'openai-icon',
    description: 'Fast, structured, and strong when you need options you can act on immediately.',
    subtitle: 'Fast & structured',
    reply: 'Here’s a practical way to move forward:\n\n1. Write down the outcome in one sentence.\n2. Pick the audience that matters most.\n3. Run one small test this week.\n\nYou can learn more from a focused first pass than from polishing the whole plan at once.'
  },
  local: {
    id: 'local',
    name: 'Qwen 3 32B',
    provider: 'Local · Ollama',
    icon: '◉',
    iconClass: 'local-icon',
    description: 'Private, practical, and running close to home through your local model setup.',
    subtitle: 'Private · on device',
    reply: 'A good local-first workflow is: keep sensitive context here, ask for a rough draft, and then use a hosted model only when you need a second pass. Start with a compact brief so the model can respond quickly and consistently.'
  }
};

const state = {
  selectedModel: 'claude',
  currentView: 'chat',
  isNewConversation: false,
  connectionState: { claude: true, openai: true, local: true },
  promptIndex: 0
};

const promptDeck = [
  'Turn this rough idea into a crisp one-page product brief.',
  'Help me plan a focused workday around one meaningful outcome.',
  'Review this message and make it clearer without making it colder.',
  'Give me three distinct directions, then recommend the smallest test.'
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHTML(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[character]));
}

function formatText(value) {
  return escapeHTML(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');
}

function modelIcon(model, extraClass = '') {
  return `<span class="mini-model-icon ${model.iconClass} ${extraClass}">${model.icon}</span>`;
}

function renderModelLists() {
  const modelEntries = Object.values(models);
  $('#modelList').innerHTML = modelEntries.map((model) => `
    <button class="model-row ${model.id === state.selectedModel ? 'selected' : ''}" data-model="${model.id}">
      <span class="model-icon ${model.iconClass}">${model.icon}</span>
      <span class="model-copy"><strong>${model.name}</strong><small>${model.provider}</small></span>
      <span class="model-status ${state.connectionState[model.id] ? '' : 'offline'}"></span>
    </button>`).join('');

  $('#modelPickerMenu').innerHTML = modelEntries.map((model) => `
    <button class="picker-option ${model.id === state.selectedModel ? 'selected' : ''}" data-model="${model.id}">
      ${modelIcon(model)}
      <span class="picker-option-copy"><strong>${model.name}</strong><small>${model.subtitle}</small></span>
      <span class="picker-check">${model.id === state.selectedModel ? '✓' : ''}</span>
    </button>`).join('');

  $$('#modelList [data-model], #modelPickerMenu [data-model]').forEach((button) => {
    button.addEventListener('click', () => {
      selectModel(button.dataset.model);
      $('#modelPicker').classList.remove('open');
    });
  });
}

function selectModel(id) {
  if (!models[id]) return;
  state.selectedModel = id;
  const model = models[id];
  $('#pickerModelName').textContent = model.name;
  $('#heroModelName').textContent = model.name;
  $('#heroModelDescription').textContent = model.description;
  $('#heroModelProvider').textContent = model.provider;
  const heroIcon = $('.hero-model-icon');
  heroIcon.className = `hero-model-icon ${model.iconClass}`;
  heroIcon.textContent = model.icon;
  const pickerIcon = $('.model-picker-trigger .mini-model-icon');
  pickerIcon.className = `mini-model-icon ${model.iconClass}`;
  pickerIcon.textContent = model.icon;
  renderModelLists();
  showToast(`${model.name} is ready`);
}

function switchView(view) {
  state.currentView = view;
  const views = { chat: '#chatView', library: '#libraryView', compare: '#compareView' };
  $('#welcomeView').classList.toggle('hidden', view !== 'chat' || !state.isNewConversation);
  $('#chatView').classList.toggle('hidden', view !== 'chat' || state.isNewConversation);
  $('#libraryView').classList.toggle('hidden', view !== 'library');
  $('#compareView').classList.toggle('hidden', view !== 'compare');
  $('#composerWrap').classList.toggle('hidden', view === 'compare');
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  if (view === 'chat' && state.isNewConversation) {
    $('#chatView').classList.remove('hidden');
    $('#welcomeView').classList.add('hidden');
  }
}

function showWelcome() {
  state.isNewConversation = false;
  state.currentView = 'chat';
  $('#welcomeView').classList.remove('hidden');
  $('#chatView').classList.add('hidden');
  $('#libraryView').classList.add('hidden');
  $('#compareView').classList.add('hidden');
  $('#composerWrap').classList.remove('hidden');
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'chat'));
}

function openConversation(title = 'New conversation') {
  state.isNewConversation = true;
  $('#chatTitle').textContent = title;
  switchView('chat');
}

function addMessage(role, content, isTyping = false) {
  const message = document.createElement('article');
  message.className = `message ${role}`;
  if (isTyping) {
    message.innerHTML = `<div class="message-avatar">${models[state.selectedModel].icon}</div><div class="message-body"><p class="message-meta">${models[state.selectedModel].name}</p><div class="message-text"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  } else if (role === 'user') {
    message.innerHTML = `<div class="message-body"><p class="message-meta">You · just now</p><p class="message-text">${formatText(content)}</p></div><div class="message-avatar">US</div>`;
  } else {
    message.innerHTML = `<div class="message-avatar">${models[state.selectedModel].icon}</div><div class="message-body"><p class="message-meta">${models[state.selectedModel].name} · just now</p><p class="message-text">${formatText(content)}</p></div>`;
  }
  $('#messageList').appendChild(message);
  message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return message;
}

function sendMessage(rawText) {
  const text = rawText.trim();
  if (!text) {
    showToast('Write a message first');
    $('#messageInput').focus();
    return;
  }
  if (!state.isNewConversation) openConversation('New conversation');
  const input = $('#messageInput');
  input.value = '';
  resizeTextarea(input);
  addMessage('user', text);
  const typingMessage = addMessage('assistant', '', true);
  window.setTimeout(() => {
    typingMessage.remove();
    addMessage('assistant', models[state.selectedModel].reply);
  }, 720);
}

function loadRecentChat(chatId) {
  state.isNewConversation = true;
  $('#messageList').innerHTML = '';
  const chatData = {
    'launch-plan': {
      title: 'Launch plan for the studio',
      messages: [
        ['user', 'I want to launch the studio without making a huge production out of it. What should I focus on first?'],
        ['assistant', 'Keep the first launch small enough to learn from. I’d focus on three things: a clear promise, one proof point that makes the promise believable, and a simple way for the right people to say “I’m interested.”\n\nThe goal of the first week is not to look finished. It is to find out whether the idea creates a pull.']
      ]
    },
    'landing-page': {
      title: 'Landing page feedback',
      messages: [
        ['user', 'Can you help me make this landing page feel less generic?'],
        ['assistant', 'Start with the sentence only your studio could say. Replace broad claims with a specific point of view, then let the proof do some of the selling. A little constraint will make the page feel more like a person and less like a template.']
      ]
    },
    'sql-review': {
      title: 'Review this SQL query',
      messages: [
        ['user', 'I need a second set of eyes on a query that joins three large tables.'],
        ['assistant', 'Share the query and the table sizes if you can. I’ll look for accidental row multiplication, filters that happen too late, and indexes that can make the planner’s job easier.']
      ]
    }
  };
  const chat = chatData[chatId] || chatData['launch-plan'];
  $('#chatTitle').textContent = chat.title;
  switchView('chat');
  chat.messages.forEach(([role, content]) => addMessage(role, content));
  $$('.recent-chat').forEach((item) => item.classList.toggle('selected', item.dataset.chat === chatId));
}

function renderConnections() {
  const connectionData = [
    { id: 'claude', name: 'Anthropic', detail: 'Claude models via API', symbol: '✦', iconClass: 'claude-icon' },
    { id: 'openai', name: 'OpenAI', detail: 'GPT models via API', symbol: '◇', iconClass: 'openai-icon' },
    { id: 'local', name: 'Local models', detail: 'Ollama · localhost', symbol: '◉', iconClass: 'local-icon' }
  ];
  $('#connectionList').innerHTML = connectionData.map((connection) => `
    <div class="connection-row">
      <span class="model-icon ${connection.iconClass}">${connection.symbol}</span>
      <span class="connection-copy"><strong>${connection.name}</strong><small>${connection.detail}</small></span>
      <button class="connection-toggle ${state.connectionState[connection.id] ? 'on' : ''}" data-connection="${connection.id}" aria-label="Toggle ${connection.name}"></button>
    </div>`).join('');
  $$('#connectionList [data-connection]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.connection;
    state.connectionState[id] = !state.connectionState[id];
    renderConnections();
    renderModelLists();
    showToast(state.connectionState[id] ? `${models[id].provider} connected` : `${models[id].provider} paused`);
  }));
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }

function resizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}

function runComparison() {
  const prompt = $('#comparePrompt').value.trim();
  if (!prompt) {
    showToast('Add a question to compare');
    $('#comparePrompt').focus();
    return;
  }
  const results = [models.claude, models.openai].map((model, index) => `
    <article class="comparison-card">
      <p class="comparison-label">${model.provider} · ${model.name}</p>
      <h3>${index === 0 ? 'The thoughtful route' : 'The practical route'}</h3>
      <p>${formatText(index === 0 ? 'I would begin by clarifying what success feels like for the person using this. Once the desired change is clear, the right first step becomes much easier to choose.' : 'Break the request into a small test with a visible result. Define the input, the expected outcome, and the shortest path to feedback. Then iterate from what you learn.')}</p>
    </article>`).join('');
  $('#comparisonResults').innerHTML = results;
  showToast('Comparison ready');
}

function init() {
  renderModelLists();
  renderConnections();

  $$('.nav-item').forEach((item) => item.addEventListener('click', (event) => {
    event.preventDefault();
    if (item.dataset.view === 'chat' && !state.isNewConversation) showWelcome();
    else switchView(item.dataset.view);
  }));

  $('#newChatButton').addEventListener('click', () => {
    state.isNewConversation = true;
    $('#chatTitle').textContent = 'New conversation';
    $('#messageList').innerHTML = '';
    $$('.recent-chat').forEach((item) => item.classList.remove('selected'));
    switchView('chat');
    $('#messageInput').focus();
  });
  $$('.recent-chat').forEach((item) => item.addEventListener('click', () => loadRecentChat(item.dataset.chat)));
  $$('.starter-card, .library-card').forEach((card) => card.addEventListener('click', () => {
    $('#messageInput').value = card.dataset.prompt;
    resizeTextarea($('#messageInput'));
    openConversation('New conversation');
    $('#messageInput').focus();
  }));

  $('#sendButton').addEventListener('click', () => sendMessage($('#messageInput').value));
  $('#messageInput').addEventListener('input', (event) => resizeTextarea(event.target));
  $('#messageInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(event.target.value);
    }
  });
  $('#modelPickerTrigger').addEventListener('click', () => $('#modelPicker').classList.toggle('open'));
  $('#heroModelMenu').addEventListener('click', () => $('#modelPicker').classList.toggle('open'));
  $('#shufflePrompts').addEventListener('click', () => {
    state.promptIndex = (state.promptIndex + 1) % promptDeck.length;
    $('#messageInput').value = promptDeck[state.promptIndex];
    resizeTextarea($('#messageInput'));
    showToast('A fresh direction is waiting below');
  });

  $('#settingsButton').addEventListener('click', () => openModal('#settingsModal'));
  $('#manageModelsButton').addEventListener('click', () => openModal('#settingsModal'));
  $('#privacyButton').addEventListener('click', () => openModal('#privacyModal'));
  $$('.close-modal').forEach((button) => button.addEventListener('click', () => closeModal(`#${button.dataset.closeModal}`)));
  $$('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal(`#${backdrop.id}`);
  }));
  $('#searchButton').addEventListener('click', () => showToast('Search is ready for your conversation history'));
  $('#connectionButton').addEventListener('click', () => openModal('#settingsModal'));
  $('#profileButton').addEventListener('click', () => showToast('Personal workspace · free to explore'));
  $('#shareButton').addEventListener('click', () => showToast('Share link copied to clipboard'));
  $('#chatMoreButton').addEventListener('click', () => showToast('Conversation actions coming next'));
  $('#attachButton').addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.txt,.md,.doc,.docx,.csv,.png,.jpg';
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) showToast(`${fileInput.files[0].name} attached for this demo`);
    });
    fileInput.click();
  });
  $('#compareButton').addEventListener('click', runComparison);

  $('#menuButton').addEventListener('click', () => $('.sidebar').classList.add('open'));
  $('#sidebarClose').addEventListener('click', () => $('.sidebar').classList.remove('open'));
  $$('.nav-item, .recent-chat').forEach((item) => item.addEventListener('click', () => $('.sidebar').classList.remove('open')));
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#modelPicker')) $('#modelPicker').classList.remove('open');
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      $('#messageInput').focus();
    }
    if (event.key === 'Escape') {
      $$('.modal-backdrop').forEach((modal) => modal.classList.add('hidden'));
      $('#modelPicker').classList.remove('open');
      $('.sidebar').classList.remove('open');
    }
  });
}

init();
