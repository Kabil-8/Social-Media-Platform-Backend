/* ── State ───────────────────────────────────────────────────────────────── */
const state = {
  token: localStorage.getItem('pulse_token') || null,
  user:  JSON.parse(localStorage.getItem('pulse_user') || 'null'),
  view:  'feed',
};

/* ── API ─────────────────────────────────────────────────────────────────── */
const API = {
  async req(method, path, body) {
    const res = await fetch('/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get:    (p)    => API.req('GET',    p),
  post:   (p, b) => API.req('POST',   p, b),
  patch:  (p, b) => API.req('PATCH',  p, b),
  delete: (p)    => API.req('DELETE', p),
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60e3) return 'just now';
  if (diff < 36e5) return Math.floor(diff / 60e3) + 'm';
  if (diff < 864e5) return Math.floor(diff / 36e5) + 'h';
  return Math.floor(diff / 864e5) + 'd';
}

function setAvatar(el, user) {
  if (!user) return;
  el.textContent = user.avatar || (user.name || 'U')[0].toUpperCase();
  el.style.background = user.color || '#7c3aed';
}

function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function showView(name) {
  qsa('.view').forEach(v => v.classList.add('hidden'));
  qsa('.nav-item').forEach(b => b.classList.remove('active'));
  qs('#view-' + name).classList.remove('hidden');
  qs(`.nav-item[data-view="${name}"]`)?.classList.add('active');
  state.view = name;
  if (name === 'feed') loadFeed();
  if (name === 'explore') loadExplore();
  if (name === 'profile') loadMyProfile();
}

/* ── Auth ────────────────────────────────────────────────────────────────── */
function saveAuth(token, user) {
  state.token = token;
  state.user  = user;
  localStorage.setItem('pulse_token', token);
  localStorage.setItem('pulse_user',  JSON.stringify(user));
}
function clearAuth() {
  state.token = null; state.user = null;
  localStorage.removeItem('pulse_token');
  localStorage.removeItem('pulse_user');
}

qs('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const username = qs('#login-username').value.trim();
  const password = qs('#login-password').value;
  try {
    const { token, user } = await API.post('/auth/login', { username, password });
    saveAuth(token, user);
    initApp();
  } catch (err) { qs('#login-error').textContent = err.message; }
});

qs('#register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = qs('#reg-name').value.trim();
  const username = qs('#reg-username').value.trim();
  const password = qs('#reg-password').value;
  try {
    const { token, user } = await API.post('/auth/register', { name, username, password });
    saveAuth(token, user);
    initApp();
  } catch (err) { qs('#register-error').textContent = err.message; }
});

qs('#logout-btn').addEventListener('click', async () => {
  try { await API.post('/auth/logout'); } catch (_) {}
  clearAuth();
  showAuthScreen();
});

// Auth tabs
qsa('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    qsa('.tab-btn').forEach(b => b.classList.remove('active'));
    qsa('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    qs('#' + btn.dataset.tab + '-form').classList.add('active');
  });
});

/* ── App Init ────────────────────────────────────────────────────────────── */
function showAuthScreen() {
  qs('#auth-screen').classList.remove('hidden');
  qs('#main-screen').classList.add('hidden');
}

function initApp() {
  qs('#auth-screen').classList.add('hidden');
  qs('#main-screen').classList.remove('hidden');

  // Set sidebar user
  setAvatar(qs('#sidebar-avatar'), state.user);
  qs('#sidebar-avatar').style.width  = '34px';
  qs('#sidebar-avatar').style.height = '34px';
  qs('#sidebar-avatar').style.fontSize = '12px';
  qs('#sidebar-name').textContent   = state.user.name;
  qs('#sidebar-handle').textContent = '@' + state.user.username;

  // Set compose avatar
  setAvatar(qs('#compose-avatar'), state.user);

  showView('feed');
  loadSuggestions();
}

// Nav
qsa('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// Explore empty state button
qs('#feed-empty button').addEventListener('click', () => showView('explore'));

/* ── Post Rendering ──────────────────────────────────────────────────────── */
function createPostEl(post) {
  const tpl = qs('#post-tpl').content.cloneNode(true);
  const el  = tpl.querySelector('article');

  const avatar = qs('.post-avatar', el);
  setAvatar(avatar, post.user);
  avatar.dataset.username = post.user.username;
  avatar.addEventListener('click', () => loadUserProfile(post.user.username));

  qs('.post-author', el).textContent        = post.user.name;
  qs('.post-author', el).dataset.username   = post.user.username;
  qs('.post-handle', el).textContent        = '@' + post.user.username;
  qs('.post-time', el).textContent          = timeAgo(post.createdAt);
  qs('.post-body', el).textContent          = post.content;
  qs('.like-count', el).textContent         = post.likes;
  qs('.comment-count', el).textContent      = post.comments.length;

  // Author click → profile
  qs('.post-author', el).addEventListener('click', () => loadUserProfile(post.user.username));

  // Delete button
  const delBtn = qs('.post-delete', el);
  if (state.user && post.user.id === state.user.id) {
    delBtn.classList.remove('hidden');
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      await API.delete('/posts/' + post.id);
      el.remove();
    });
  }

  // Like
  const likeBtn = qs('.like-btn', el);
  if (post.liked) { likeBtn.classList.add('liked'); qs('.like-icon', likeBtn).textContent = '♥'; }
  likeBtn.addEventListener('click', async () => {
    const res = await API.post('/posts/' + post.id + '/like');
    likeBtn.classList.toggle('liked', res.liked);
    qs('.like-icon', likeBtn).textContent = res.liked ? '♥' : '♡';
    const cur = parseInt(qs('.like-count', el).textContent);
    qs('.like-count', el).textContent = res.liked ? cur + 1 : cur - 1;
  });

  // Comments toggle
  const commSection = qs('.comments-section', el);
  qs('.comment-toggle-btn', el).addEventListener('click', () => {
    commSection.classList.toggle('hidden');
  });

  // Render existing comments
  renderComments(post.comments, qs('.comments-list', el));

  // New comment
  const commInput  = qs('.comment-input', el);
  const commSubmit = qs('.comment-submit', el);
  const miniAvatar = qs('.mini-compose-avatar', el);
  setAvatar(miniAvatar, state.user);
  Object.assign(miniAvatar.style, { width:'28px', height:'28px', fontSize:'10px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', color:'#fff', flexShrink:'0' });

  commSubmit.addEventListener('click', async () => {
    const content = commInput.value.trim();
    if (!content) return;
    const comment = await API.post('/posts/' + post.id + '/comments', { content });
    commInput.value = '';
    renderComments([comment], qs('.comments-list', el), true);
    const cur2 = parseInt(qs('.comment-count', el).textContent);
    qs('.comment-count', el).textContent = cur2 + 1;
  });

  commInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') commSubmit.click();
  });

  return el;
}

function renderComments(comments, container, append = false) {
  if (!append) container.innerHTML = '';
  comments.forEach(c => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.commentId = c.id;
    div.innerHTML = `
      <div class="comment-avatar"></div>
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-author" data-username="${c.user?.username}">${c.user?.name || 'Unknown'}</span>
          <span class="comment-time">${timeAgo(c.createdAt)}</span>
          ${state.user && c.userId === state.user.id ? `<button class="comment-del">✕</button>` : ''}
        </div>
        <div class="comment-text">${escHtml(c.content)}</div>
      </div>`;
    setAvatar(div.querySelector('.comment-avatar'), c.user);
    Object.assign(div.querySelector('.comment-avatar').style, {
      width:'28px',height:'28px',fontSize:'10px',borderRadius:'50%',flexShrink:'0',
      display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',color:'#fff',cursor:'pointer'
    });
    div.querySelector('.comment-author')?.addEventListener('click', () => loadUserProfile(c.user?.username));
    div.querySelector('.comment-avatar')?.addEventListener('click', () => loadUserProfile(c.user?.username));
    div.querySelector('.comment-del')?.addEventListener('click', async () => {
      await API.delete('/comments/' + c.id);
      div.remove();
    });
    container.appendChild(div);
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Feed ────────────────────────────────────────────────────────────────── */
async function loadFeed() {
  const container = qs('#feed-posts');
  container.innerHTML = '';
  try {
    const posts = await API.get('/feed');
    if (posts.length === 0) {
      qs('#feed-empty').classList.remove('hidden');
    } else {
      qs('#feed-empty').classList.add('hidden');
      posts.forEach(p => container.appendChild(createPostEl(p)));
    }
  } catch (e) { console.error(e); }
}

// Compose
const composeText = qs('#compose-text');
const charCount   = qs('#char-count');
const MAX_CHARS   = 280;

composeText.addEventListener('input', () => {
  const rem = MAX_CHARS - composeText.value.length;
  charCount.textContent = rem;
  charCount.className = 'char-count' + (rem < 20 ? (rem < 0 ? ' over' : ' warn') : '');
  composeText.style.height = 'auto';
  composeText.style.height = composeText.scrollHeight + 'px';
});

qs('#compose-submit').addEventListener('click', async () => {
  const content = composeText.value.trim();
  if (!content || content.length > MAX_CHARS) return;
  const post = await API.post('/posts', { content });
  composeText.value = '';
  charCount.textContent = MAX_CHARS;
  const container = qs('#feed-posts');
  container.insertBefore(createPostEl(post), container.firstChild);
  qs('#feed-empty').classList.add('hidden');
});

/* ── Explore ─────────────────────────────────────────────────────────────── */
async function loadExplore(query = '') {
  // Users
  const userGrid = qs('#explore-users');
  userGrid.innerHTML = '';
  const users = await API.get('/users' + (query ? '?q=' + encodeURIComponent(query) : ''));
  users.filter(u => u.id !== state.user?.id).forEach(u => {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `
      <div class="avatar lg"></div>
      <div class="user-card-name">${escHtml(u.name)}</div>
      <div class="user-card-handle">@${u.username}</div>
      <div class="user-card-bio">${escHtml(u.bio || '')}</div>
      <div class="user-card-stats">
        <div><strong>${u.followers}</strong>Followers</div>
        <div><strong>${u.following}</strong>Following</div>
        <div><strong>${u.postCount}</strong>Posts</div>
      </div>
      <button class="btn-primary follow-toggle ${u.isFollowing ? 'following' : ''}" data-id="${u.id}">
        ${u.isFollowing ? 'Following' : 'Follow'}
      </button>`;
    setAvatar(card.querySelector('.avatar'), u);
    card.querySelector('.avatar').addEventListener('click', () => loadUserProfile(u.username));
    card.querySelector('.user-card-name').addEventListener('click', () => loadUserProfile(u.username));
    card.querySelector('.follow-toggle').addEventListener('click', async e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const res = await API.post('/users/' + u.id + '/follow');
      u.isFollowing = res.following;
      btn.textContent = u.isFollowing ? 'Following' : 'Follow';
      btn.classList.toggle('following', u.isFollowing);
      u.followers += u.isFollowing ? 1 : -1;
      card.querySelector('.user-card-stats strong').textContent = u.followers;
    });
    userGrid.appendChild(card);
  });

  // All posts
  const postList = qs('#explore-posts');
  postList.innerHTML = '';
  const posts = await API.get('/posts');
  posts.forEach(p => postList.appendChild(createPostEl(p)));
}

let searchTimeout;
qs('#search-input').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadExplore(e.target.value), 300);
});

/* ── Suggestions ─────────────────────────────────────────────────────────── */
async function loadSuggestions() {
  const users = await API.get('/users');
  const list  = qs('#suggestions-list');
  list.innerHTML = '';
  users.filter(u => u.id !== state.user?.id && !u.isFollowing)
    .slice(0, 5)
    .forEach(u => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `
        <div class="mini-avatar"></div>
        <div class="suggestion-info">
          <div class="suggestion-name">${escHtml(u.name)}</div>
          <div class="suggestion-handle">@${u.username}</div>
        </div>
        <button class="suggestion-follow ${u.isFollowing ? 'following' : ''}" data-id="${u.id}">
          ${u.isFollowing ? '✓' : '+ Follow'}
        </button>`;
      setAvatar(item.querySelector('.mini-avatar'), u);
      item.querySelector('.suggestion-info').addEventListener('click', () => loadUserProfile(u.username));
      item.querySelector('.mini-avatar').addEventListener('click', () => loadUserProfile(u.username));
      item.querySelector('.suggestion-follow').addEventListener('click', async e => {
        const btn = e.currentTarget;
        const res = await API.post('/users/' + u.id + '/follow');
        u.isFollowing = res.following;
        btn.textContent = u.isFollowing ? '✓' : '+ Follow';
        btn.classList.toggle('following', u.isFollowing);
      });
      list.appendChild(item);
    });
}

/* ── Profile ─────────────────────────────────────────────────────────────── */
async function loadMyProfile() {
  // Refresh current user from server
  const me = await API.get('/me');
  Object.assign(state.user, me);
  localStorage.setItem('pulse_user', JSON.stringify(state.user));
  renderProfile(me, true);
}

async function loadUserProfile(username) {
  showView('profile');
  const user = await API.get('/users/' + username);
  const isMe = state.user && user.id === state.user.id;
  renderProfile(user, isMe);
}

async function renderProfile(user, isMe) {
  const container = qs('#profile-content');

  const posts = await API.get('/users/' + user.username + '/posts');

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-top">
        <div class="avatar lg" id="profile-avatar"></div>
        <div>
          ${isMe
            ? `<button class="profile-edit" id="edit-profile-btn">Edit Profile</button>`
            : `<button class="btn-primary follow-profile-btn ${user.isFollowing ? '' : ''}" data-id="${user.id}">
                ${user.isFollowing ? 'Following' : 'Follow'}
               </button>`}
        </div>
      </div>
      <div class="profile-name">${escHtml(user.name)}</div>
      <div class="profile-username">@${user.username}</div>
      <div class="profile-bio">${escHtml(user.bio || '')}</div>
      <div class="profile-stats">
        <span><strong>${user.postCount}</strong> Posts</span>
        <span><strong>${user.followers}</strong> Followers</span>
        <span><strong>${user.following}</strong> Following</span>
      </div>
      ${isMe ? `
      <div class="edit-form" id="edit-form">
        <input type="text" id="edit-name" value="${escHtml(user.name)}" placeholder="Display name">
        <textarea id="edit-bio" placeholder="Bio…">${escHtml(user.bio || '')}</textarea>
        <div class="edit-btns">
          <button class="btn-primary" id="save-profile-btn">Save</button>
          <button class="btn-secondary" id="cancel-edit-btn">Cancel</button>
        </div>
      </div>` : ''}
    </div>
    <div id="profile-posts" class="posts-list"></div>`;

  setAvatar(qs('#profile-avatar', container), user);

  // Edit profile toggle
  if (isMe) {
    qs('#edit-profile-btn', container).addEventListener('click', () => {
      qs('#edit-form', container).classList.toggle('open');
    });
    qs('#cancel-edit-btn', container).addEventListener('click', () => {
      qs('#edit-form', container).classList.remove('open');
    });
    qs('#save-profile-btn', container).addEventListener('click', async () => {
      const name = qs('#edit-name', container).value.trim();
      const bio  = qs('#edit-bio', container).value.trim();
      const updated = await API.patch('/me', { name, bio });
      Object.assign(state.user, updated);
      localStorage.setItem('pulse_user', JSON.stringify(state.user));
      qs('#sidebar-name').textContent  = updated.name;
      qs('.profile-name', container).textContent  = updated.name;
      qs('.profile-bio', container).textContent   = updated.bio;
      qs('#edit-form', container).classList.remove('open');
    });
  }

  // Follow button
  const followBtn = qs('.follow-profile-btn', container);
  if (followBtn) {
    followBtn.addEventListener('click', async () => {
      const res = await API.post('/users/' + user.id + '/follow');
      user.isFollowing = res.following;
      followBtn.textContent = user.isFollowing ? 'Following' : 'Follow';
      // Update follower count
      user.followers += user.isFollowing ? 1 : -1;
      qs('.profile-stats', container).innerHTML = `
        <span><strong>${user.postCount}</strong> Posts</span>
        <span><strong>${user.followers}</strong> Followers</span>
        <span><strong>${user.following}</strong> Following</span>`;
    });
  }

  // Posts
  const postList = qs('#profile-posts', container);
  if (posts.length === 0) {
    postList.innerHTML = '<div class="empty-state"><div class="empty-icon">◇</div><h3>No posts yet</h3></div>';
  } else {
    posts.forEach(p => postList.appendChild(createPostEl(p)));
  }
}

/* ── Boot ────────────────────────────────────────────────────────────────── */
if (state.token && state.user) {
  initApp();
} else {
  showAuthScreen();
}
