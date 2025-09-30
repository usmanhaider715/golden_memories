document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  const res = await fetch('/auth/signup', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (result.message) {
    window.location = '/?signup=pending';
  } else {
    alert(result.error || 'Signup failed');
  }
});

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  const res = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (result.success) window.location = '/dashboard';
  else alert('Login failed');
});

const currentUserPromise = fetch('/auth/user', { credentials: 'same-origin' })
  .then(r => r.ok ? r.json() : null)
  .catch(() => null);

const renderAlbums = (albums, container) => {
  container.innerHTML = '';
  if (albums.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center">No albums found.</p>';
    return;
  }
  albums.forEach(album => {
    const div = document.createElement('div');
    div.className = 'album bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow';
    const locked = album.has_password && !(window.__me && (window.__me.role === 'admin' || window.__me.id === album.user_id));
    const mediaBlock = album.cover_url
      ? (album.cover_type === 'image' ? `<img src="${album.cover_url}" alt="${album.title}" class="w-full h-48 object-cover ${locked ? 'blur-sm' : ''}">`
        : `<video src="${album.cover_url}" ${locked ? '' : 'controls'} class="w-full h-48 object-cover ${locked ? 'blur-sm' : ''}"></video>`)
      : `<div class="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">No media</div>`;
    div.innerHTML = `
      <div class="relative">${mediaBlock}${locked ? '<div class="absolute inset-0 flex items-center justify-center"><span class="bg-black/50 text-white px-2 py-1 rounded">🔒 Locked</span></div>' : ''}</div>
      <div class="p-4">
        <h3 class="text-lg font-semibold text-gray-800">${album.title}</h3>
        <p class="text-gray-600 mt-1 line-clamp-2">${album.description || 'No description'}</p>
        <div class="mt-2 text-sm text-gray-500 flex items-center justify-between">
          <span>${new Date(album.upload_date).toLocaleDateString()}</span>
          <span>${album.media_count || 0} item(s)</span>
        </div>
        <div class="mt-3">
          <button data-action="open" data-album="${album.id}" class="px-3 py-1 bg-gray-900 hover:bg-black text-white rounded text-sm">${locked ? 'Unlock' : 'Open'}</button>
        </div>
        <div class="mt-3 flex gap-2 hidden" data-actions>
          <button data-action="list" data-album="${album.id}" class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Manage Media</button>
          <button data-action="edit" data-album="${album.id}" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">Edit</button>
          <button data-action="delete" data-album="${album.id}" class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">Delete</button>
        </div>
        <div class="mt-3 hidden" data-media-list></div>
      </div>
    `;
    div.querySelector('[data-action="open"]').addEventListener('click', async () => {
      if (!locked) { window.location.href = `/album/${album.id}`; return; }
      const pwd = prompt('Enter album password');
      if (pwd == null) return;
      const r = await fetch(`/search/album/${album.id}/access`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ password: pwd }) });
      if (r.ok) window.location.href = `/album/${album.id}`; else alert('Incorrect password');
    });
    container.appendChild(div);

    // Permission-gated actions
    currentUserPromise.then(me => {
      window.__me = me;
      const actions = div.querySelector('[data-actions]');
      if (!me) return; 
      const canManage = me.role === 'admin' || me.id === album.user_id;
      if (canManage) actions.classList.remove('hidden');
    });

    const mediaList = div.querySelector('[data-media-list]');

    div.querySelector('[data-action="list"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await fetch(`/upload/media/list/${album.id}`, { credentials: 'same-origin' });
      if (!res.ok) { alert('Cannot load media'); return; }
      const media = await res.json();
      mediaList.classList.remove('hidden');
      mediaList.innerHTML = media.map(m => `
        <div class="media-item flex items-center justify-start border rounded p-2 mb-2" data-media-id="${m.id}">
          <button data-delete-media="${m.id}" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs mr-3">Delete</button>
          <div class="flex items-center gap-3">
            ${m.type === 'image' ? `<img src="${m.url}" class="w-16 h-16 object-cover rounded">` : `<video src="${m.url}" class="w-16 h-16 object-cover rounded"></video>`}
            <span class="text-sm text-gray-700">${m.url.split('/').pop()}</span>
          </div>
        </div>
      `).join('');

      // Attach delete handlers
      mediaList.querySelectorAll('[data-delete-media]').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          ev.stopPropagation(); // don't let document click handler immediately close
          if (!confirm('Delete this media?')) return;
          const id = btn.getAttribute('data-delete-media');
          try {
            const r = await fetch(`/upload/media/${id}`, { method: 'DELETE', credentials: 'same-origin' });
            if (r.ok) {
              const wrapper = btn.closest('.media-item');
              if (wrapper) wrapper.remove();
            } else {
              const txt = await r.text();
              alert(`Delete failed: ${txt}`);
            }
          } catch (err) {
            console.error('Delete error:', err);
            alert('Delete failed');
          }
        });
      });

      // Click outside to close behavior
      const closeHandler = (ev) => {
        // If click is inside this album div, do nothing
        if (div.contains(ev.target)) return;
        mediaList.classList.add('hidden');
        document.removeEventListener('click', closeHandler);
      };
      // Remove any previous handler then add (to avoid duplicates)
      document.removeEventListener('click', closeHandler);
      // Use setTimeout to avoid immediately catching the click that opened the list
      setTimeout(() => document.addEventListener('click', closeHandler));
    });

    div.querySelector('[data-action="edit"]').addEventListener('click', async () => {
      const title = prompt('New title', album.title);
      if (title == null) return;
      const description = prompt('New description', album.description || '');
      if (description == null) return;
      const res = await fetch(`/upload/album/${album.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ title, description }) });
      if (res.ok) { alert('Updated'); location.reload(); } else alert('Update failed');
    });

    div.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm('Delete this album and all media?')) return;
      const res = await fetch(`/upload/album/${album.id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (res.ok) { div.remove(); } else alert('Delete failed');
    });
  });
};

const loadAlbums = async (url, container) => {
  console.log('Fetching albums from:', url);
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const albums = await res.json();
  console.log('Received albums:', albums);
  renderAlbums(albums, container);
};

if (window.location.pathname === '/dashboard') {
  loadAlbums('/search?q=', document.getElementById('albums')).catch(err => console.error('Dashboard load error:', err));
  setupNotifications();
}

if (window.location.pathname === '/profile') {
  fetch('/auth/user', { credentials: 'same-origin' })
    .then(res => {
      if (!res.ok) throw new Error('Unauthorized');
      return res.json();
    })
    .then(user => {
      document.getElementById('usernameHeading').textContent = `${user.username}'s Profile`;
      // Show Admin Panel button for admin users
      if (user.role === 'admin') {
        document.getElementById('adminPanelBtn').classList.remove('hidden');
      }
    })
    .catch(err => {
      console.error('Error fetching username:', err);
      window.location = '/';
    });
  loadAlbums('/search?user=true', document.getElementById('albums')).catch(err => console.error('Profile load error:', err));
  setupNotifications();
}

document.getElementById('searchBar')?.addEventListener('input', async (e) => {
  const query = e.target.value;
  const isProfile = window.location.pathname === '/profile';
  const url = isProfile ? `/search?user=true&q=${query}` : `/search?q=${query}`;
  loadAlbums(url, document.getElementById('albums')).catch(err => console.error('Search error:', err));
});

document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const metadata = {
    title: formData.get('title'),
    description: formData.get('description'),
    is_public: window.location.pathname === '/admin-panel',
    album_password: formData.get('album_password') || undefined
  };
  const albumRes = await fetch('/upload/album', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  });
  const { albumId } = await albumRes.json();
  const files = formData.getAll('file');
  for (let file of files) {
    const fd = new FormData();
    fd.append('file', file);
    await fetch(`/upload/media/${albumId}`, { method: 'POST', credentials: 'same-origin', body: fd });
  }
  alert('Uploaded');
  const isProfile = window.location.pathname === '/profile';
  loadAlbums(isProfile ? '/search?user=true' : '/search?q=', document.getElementById('albums')).catch(err => console.error('Upload refresh error:', err));
});

if (window.location.pathname === '/admin-panel') {
  // Load signup requests
  fetch('/admin/requests', { credentials: 'same-origin' })
    .then(res => res.json())
    .then(requests => {
      const container = document.getElementById('requests');
      container.innerHTML = '';
      if (requests.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No pending requests.</p>';
        return;
      }
      requests.forEach(req => {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 rounded p-3 border';
        div.innerHTML = `
          <p class="text-gray-800 font-medium">${req.username}</p>
          <p class="text-gray-600 text-sm">${req.email}</p>
          <div class="mt-2 space-x-2">
            <button onclick="approve(${req.id})" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">Approve</button>
            <button onclick="reject(${req.id})" class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">Reject</button>
          </div>
        `;
        container.appendChild(div);
      });
    });

  // Load users
  fetch('/admin/users', { credentials: 'same-origin' })
    .then(res => res.json())
    .then(users => {
      const container = document.getElementById('usersList');
      container.innerHTML = '';
      if (users.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No users found.</p>';
        return;
      }
      users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 rounded p-3 border';
        div.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <p class="text-gray-800 font-medium">${user.username}</p>
              <p class="text-gray-600 text-sm">${user.email}</p>
              <p class="text-xs text-gray-500">${user.role} • ${user.approved ? 'Approved' : 'Pending'}</p>
            </div>
            <button onclick="deleteUser(${user.id}, '${user.username}')" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600">Delete</button>
          </div>
        `;
        container.appendChild(div);
      });
    });
}

async function approve(id) {
  await fetch(`/admin/approve/${id}`, { method: 'POST', credentials: 'same-origin' });
  window.location.reload();
}

async function reject(id) {
  await fetch(`/admin/reject/${id}`, { method: 'POST', credentials: 'same-origin' });
  window.location.reload();
}

async function deleteUser(id, username) {
  if (!confirm(`Are you sure you want to delete user "${username}"? This will permanently delete all their albums and media files.`)) {
    return;
  }
  
  try {
    const res = await fetch(`/admin/users/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) {
      alert('User deleted successfully');
      window.location.reload();
    } else {
      const error = await res.text();
      alert(`Failed to delete user: ${error}`);
    }
  } catch (err) {
    alert('Failed to delete user');
  }
}

// Modal gallery with like/unlike
let modalEl;
function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'fixed inset-0 bg-black/70 hidden items-center justify-center z-50';
  modalEl.innerHTML = `
    <div class="bg-white w-full max-w-3xl rounded-lg overflow-hidden">
      <div class="flex justify-between items-center p-3 border-b">
        <h3 id="gm-modal-title" class="font-semibold text-gray-800"></h3>
        <button id="gm-modal-close" class="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      <div id="gm-modal-content" class="p-3">
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) hideModal(); });
  modalEl.querySelector('#gm-modal-close').addEventListener('click', hideModal);
  return modalEl;
}

function showModal(title, html) {
  const m = ensureModal();
  m.querySelector('#gm-modal-title').textContent = title;
  m.querySelector('#gm-modal-content').innerHTML = html;
  m.classList.remove('hidden');
  m.classList.add('flex');
}
function hideModal() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  modalEl.classList.remove('flex');
}

function openMediaModal(payload) {
  const { album, media } = payload;
  if (!media || media.length === 0) {
    showModal(album.title, '<div class="text-center text-gray-500">No media in this album yet.</div>');
    return;
  }
  const html = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${media.map(m => `
        <div class="border rounded p-2">
          <div class="aspect-video bg-gray-100 flex items-center justify-center">
            ${m.type === 'image' ? `<img src="${m.url}" class="w-full h-full object-contain">` : `<video src="${m.url}" controls class="w-full h-full object-contain"></video>`}
          </div>
          <div class="mt-2 flex items-center justify-between">
            <button data-like="${m.id}" class="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-sm">Like</button>
            <button data-unlike="${m.id}" class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">Unlike</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  showModal(album.title, html);
  modalEl.querySelectorAll('[data-like]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-like');
      const res = await fetch(`/search/media/${id}/like`, { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) alert('Failed to like');
    });
  });
  modalEl.querySelectorAll('[data-unlike]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-unlike');
      const res = await fetch(`/search/media/${id}/unlike`, { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) alert('Failed to unlike');
    });
  });
}

// Notifications functionality
function setupNotifications() {
  const btn = document.getElementById('notificationsBtn');
  const dropdown = document.getElementById('notificationsDropdown');
  const badge = document.getElementById('notificationBadge');
  const list = document.getElementById('notificationsList');
  
  if (!btn || !dropdown || !badge || !list) return;

  // Load notifications
  async function loadNotifications() {
    try {
      const res = await fetch('/search/notifications', { credentials: 'same-origin' });
      if (!res.ok) return;
      
      const notifications = await res.json();
      
      if (notifications.length > 0) {
        badge.textContent = notifications.length;
        badge.classList.remove('hidden');
        list.innerHTML = notifications.map(n => `
          <div class="p-3 border-b hover:bg-gray-50">
            <p class="text-sm text-gray-800">${n.message}</p>
            <p class="text-xs text-gray-500 mt-1">${new Date(n.created_at).toLocaleString()}</p>
          </div>
        `).join('');
      } else {
        badge.classList.add('hidden');
        list.innerHTML = '<div class="p-3 text-gray-500 text-center">No notifications</div>';
      }
      // Mark as read after loading
      if (notifications.length > 0) {
        fetch('/search/notifications/read', { method: 'POST', credentials: 'same-origin' }).then(()=>{
          badge.classList.add('hidden');
        });
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  }

  // Toggle dropdown
  btn.addEventListener('click', () => {
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
      loadNotifications();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Load notifications on page load
  loadNotifications();
}