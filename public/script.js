// ---------------------------------------------------------------
  // POSTS DATA — loaded from the API (backed by Postgres) on init.
  // See db/schema.sql for the table definition and seed data.
  // ---------------------------------------------------------------
  let posts = [];

  async function loadPosts(){
    const catalog = document.getElementById('catalog');
    catalog.innerHTML = '<div class="empty-state">Loading entries…</div>';
    try {
      const res = await fetch('/api/posts');
      if(!res.ok) throw new Error('Request failed: ' + res.status);
      posts = await res.json();
    } catch (err) {
      console.error('Failed to load posts:', err);
      catalog.innerHTML = '<div class="empty-state">Couldn\'t reach the database. Check that Postgres is running and .env is configured, then refresh.</div>';
      posts = [];
      return;
    }
    renderTagFilters();
    renderCatalog();
  }

  const rotatingPhrases = [
    'currently thinking about slow mornings',
    'rereading old drafts I never published',
    'wondering if the question matters more than the answer',
    'writing something I might delete tomorrow'
  ];

  // ---------------------------------------------------------------
  // App state & rendering
  // ---------------------------------------------------------------
  let activeTag = null;
  let searchTerm = '';

  function allTags(){
    const t = new Set();
    posts.forEach(p => p.tags.forEach(tag => t.add(tag)));
    return Array.from(t);
  }

  function formatDay(dateStr){
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { day: '2-digit' });
  }
  function formatMonthYear(dateStr){
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  function formatFull(dateStr){
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function renderTagFilters(){
    const wrap = document.getElementById('tagFilters');
    wrap.innerHTML = '';
    allTags().forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip' + (activeTag === tag ? ' active' : '');
      chip.textContent = tag;
      chip.onclick = () => {
        activeTag = activeTag === tag ? null : tag;
        renderTagFilters();
        renderCatalog();
      };
      wrap.appendChild(chip);
    });
  }

  function renderCatalog(){
    const catalog = document.getElementById('catalog');
    const term = searchTerm.trim().toLowerCase();
    const filtered = posts
      .slice()
      .sort((a,b) => new Date(b.date) - new Date(a.date))
      .filter(p => {
        const matchesTag = !activeTag || p.tags.includes(activeTag);
        const matchesSearch = !term ||
          p.title.toLowerCase().includes(term) ||
          p.excerpt.toLowerCase().includes(term) ||
          p.tags.some(t => t.toLowerCase().includes(term));
        return matchesTag && matchesSearch;
      });

    if(filtered.length === 0){
      catalog.innerHTML = '<div class="empty-state">Nothing here yet — try a different search or tag.</div>';
      return;
    }

    catalog.innerHTML = filtered.map(p => `
      <article class="card" onclick="openPost('${p.slug}')">
        <div class="stamp">
          <span class="day">${formatDay(p.date)}</span>
          <span>${formatMonthYear(p.date)}</span>
        </div>
        <div class="body">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.excerpt)}</p>
          <div class="meta-tags">${p.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>
        </div>
      </article>
    `).join('');
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function openPost(slug){
    const post = posts.find(p => p.slug === slug);
    if(!post) return;
    const detail = document.getElementById('postDetail');
    detail.innerHTML = `
      <div class="back-link" onclick="switchView('home')">&larr; back to all entries</div>
      <div class="p-kicker">${formatFull(post.date)}</div>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="p-tags">${post.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>
      <div class="post-content">${post.content.map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>
    `;
    switchView('post', true);
    window.scrollTo({top:0, behavior:'instant'});
  }

  function switchView(name, skipNav){
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    if(!skipNav){
      document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
      const link = document.querySelector(`nav a[data-view="${name}"]`);
      if(link) link.classList.add('active');
      window.scrollTo({top:0, behavior:'instant'});
    }
    document.getElementById('nav').classList.remove('open');
  }

  // ---------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------
  document.querySelectorAll('nav a[data-view]').forEach(link => {
    link.addEventListener('click', () => switchView(link.dataset.view));
  });

  document.getElementById('navToggle').addEventListener('click', () => {
    document.getElementById('nav').classList.toggle('open');
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderCatalog();
  });

  document.getElementById('publishBtn').addEventListener('click', async () => {
    const title = document.getElementById('wTitle').value.trim();
    const tagsRaw = document.getElementById('wTags').value.trim();
    const body = document.getElementById('wBody').value.trim();

    if(!title || !body){
      alert('Give your entry a title and something to say.');
      return;
    }

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : ['untagged'];
    const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    const btn = document.getElementById('publishBtn');
    btn.disabled = true;
    btn.textContent = 'Publishing…';

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, tags, content: paragraphs.length ? paragraphs : [body] })
      });
      if(!res.ok) throw new Error('Request failed: ' + res.status);
      const newPost = await res.json();

      posts.push(newPost);
      document.getElementById('wTitle').value = '';
      document.getElementById('wTags').value = '';
      document.getElementById('wBody').value = '';

      renderTagFilters();
      renderCatalog();
      switchView('home');
      setTimeout(() => openPost(newPost.slug), 50);
    } catch (err) {
      console.error('Failed to publish:', err);
      alert('Could not save this entry to the database. Check that the server and Postgres are running.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Publish entry';
    }
  });

  // rotating hero line
  let rIndex = 0;
  setInterval(() => {
    rIndex = (rIndex + 1) % rotatingPhrases.length;
    document.getElementById('rotatingText').textContent = rotatingPhrases[rIndex];
  }, 3200);

  // init
  document.getElementById('year').textContent = new Date().getFullYear();
  loadPosts();