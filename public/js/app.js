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
  alert(result.message || result.error);
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

const renderAlbums = (albums, container) => {
  container.innerHTML = '';
  if (albums.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center">No albums found.</p>';
    return;
  }
  albums.forEach(album => {
    const div = document.createElement('div');
    div.className = 'album bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow';
    div.innerHTML = `
      <h3 class="text-xl font-semibold text-gray-800">${album.title} (${new Date(album.upload_date).toLocaleDateString()})</h3>
      <p class="text-gray-600 mt-2">${album.description || 'No description'}</p>
      ${album.url ? (album.type === 'image' ? `<img src="${album.url}" alt="${album.title}" class="mt-2 w-full h-48 object-cover rounded">` : `<video src="${album.url}" controls class="mt-2 w-full h-48 object-cover rounded"></video>`) : '<p class="text-red-500">No media available</p>'}
    `;
    container.appendChild(div);
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
}

if (window.location.pathname === '/profile') {
  fetch('/auth/user', { credentials: 'same-origin' })
    .then(res => {
      if (!res.ok) throw new Error('Unauthorized');
      return res.json();
    })
    .then(user => {
      document.getElementById('usernameHeading').textContent = `${user.username}'s Profile`;
    })
    .catch(err => {
      console.error('Error fetching username:', err);
      window.location = '/';
    });
  loadAlbums('/search?user=true', document.getElementById('albums')).catch(err => console.error('Profile load error:', err));
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
    is_public: window.location.pathname === '/admin-panel'
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
        div.className = 'bg-white rounded-lg shadow-md p-4 mb-4 hover:shadow-lg transition-shadow';
        div.innerHTML = `
          <p class="text-gray-800">${req.username} (${req.email})</p>
          <div class="mt-2 space-x-2">
            <button onclick="approve(${req.id})" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">Approve</button>
            <button onclick="reject(${req.id})" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Reject</button>
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