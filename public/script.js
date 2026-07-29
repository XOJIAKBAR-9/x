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
  let isAdmin = sessionStorage.getItem('isAdmin') === 'true';

  function updateAdminUI() {
    const navWrite = document.getElementById('navWrite');
    if (navWrite) {
      navWrite.style.display = isAdmin ? 'inline-block' : 'none';
    }
    const toggle = document.getElementById('adminToggle');
    if (toggle) {
      toggle.textContent = isAdmin ? 'Exit Admin Mode' : 'Admin Mode';
    }
  }

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
      <article class="card" id="card-${p.slug}" onclick="openPost('${p.slug}')">
        <div class="stamp">
          <span class="day">${formatDay(p.date)}</span>
          <span>${formatMonthYear(p.date)}</span>
        </div>
        <div class="body">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.excerpt)}</p>
          <div class="meta-tags">${p.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>
          ${isAdmin ? `
          <div class="card-actions">
            <button onclick="editPost('${p.slug}', event)">Edit</button>
            <button class="btn-delete" onclick="deletePost('${p.slug}', event)">Delete</button>
          </div>
          <div class="inline-edit-form" id="edit-form-${p.slug}" onclick="event.stopPropagation()">
            <input type="text" id="edit-title-${p.slug}" value="${escapeHtmlAttr(p.title)}" placeholder="Title">
            <input type="text" id="edit-tags-${p.slug}" value="${escapeHtmlAttr(p.tags.join(', '))}" placeholder="Tags (comma separated)">
            <textarea id="edit-content-${p.slug}" placeholder="Entry">${escapeHtml(p.content.join('\n\n'))}</textarea>
            <div class="edit-actions">
              <button class="btn-cancel" onclick="cancelEdit('${p.slug}', event)">Cancel</button>
              <button class="btn-save" onclick="updatePost('${p.slug}', event)">Save</button>
            </div>
          </div>
          ` : ''}
        </div>
      </article>
    `).join('');
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeHtmlAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function editPost(slug, event) {
    event.stopPropagation();
    document.getElementById(`edit-form-${slug}`).classList.add('active');
  }

  function cancelEdit(slug, event) {
    event.stopPropagation();
    document.getElementById(`edit-form-${slug}`).classList.remove('active');
  }

  async function updatePost(slug, event) {
    event.stopPropagation();
    const title = document.getElementById(`edit-title-${slug}`).value.trim();
    const tagsRaw = document.getElementById(`edit-tags-${slug}`).value.trim();
    const body = document.getElementById(`edit-content-${slug}`).value.trim();

    if (!title || !body) {
      alert('Title and content are required.');
      return;
    }

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : ['untagged'];
    const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
      const res = await fetch(`/api/posts/${slug}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('adminPassword') || ''
        },
        body: JSON.stringify({ title, tags, content: paragraphs.length ? paragraphs : [body] })
      });
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      const updatedPost = await res.json();
      
      const index = posts.findIndex(p => p.slug === slug);
      if (index !== -1) {
        posts[index] = updatedPost;
      }
      
      renderTagFilters();
      renderCatalog();
    } catch (err) {
      console.error('Failed to update:', err);
      alert('Could not update this entry.');
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  async function deletePost(slug, event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const res = await fetch(`/api/posts/${slug}`, { 
        method: 'DELETE',
        headers: {
          'x-admin-password': sessionStorage.getItem('adminPassword') || ''
        }
      });
      if (!res.ok && res.status !== 404) throw new Error('Request failed: ' + res.status);
      
      posts = posts.filter(p => p.slug !== slug);
      
      renderTagFilters();
      renderCatalog();
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Could not delete this entry.');
    }
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
      <div class="comments-section" id="commentsSection"></div>
    `;
    switchView('post', true);
    window.scrollTo({top:0, behavior:'instant'});
    loadComments(slug);
  }

  async function loadComments(slug) {
    const section = document.getElementById('commentsSection');
    section.innerHTML = '<div class="empty-state">Loading comments…</div>';
    try {
      const res = await fetch(`/api/posts/${slug}/comments`);
      if(!res.ok) throw new Error('Failed to load');
      const comments = await res.json();
      renderComments(slug, comments);
    } catch (err) {
      console.error(err);
      section.innerHTML = '<div class="empty-state">Could not load comments.</div>';
    }
  }

  function renderComments(slug, comments) {
    const section = document.getElementById('commentsSection');
    
    // Group replies
    const topLevel = comments.filter(c => !c.parent_id);
    const replies = comments.filter(c => c.parent_id);
    
    let html = '<h3>Comments</h3>';
    
    if (topLevel.length === 0) {
      html += '<p class="no-comments">No comments yet. Be the first to share your thoughts.</p>';
    } else {
      html += '<div class="comment-list">';
      topLevel.forEach(c => {
        html += renderSingleComment(c, slug);
        const childReplies = replies.filter(r => r.parent_id === c.id);
        if (childReplies.length > 0) {
          html += '<div class="replies-list">';
          childReplies.forEach(r => {
            html += renderSingleComment(r, slug, true);
          });
          html += '</div>';
        }
      });
      html += '</div>';
    }
    
    html += `
      <div class="add-comment-box">
        <textarea id="new-comment-body" placeholder="Add a comment..."></textarea>
        <button onclick="submitComment('${slug}', null)">Post</button>
      </div>
    `;
    
    section.innerHTML = html;
  }

  function renderSingleComment(c, slug, isReply = false) {
    const d = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const authorBadge = c.is_author ? '<span class="author-badge">Author</span>' : '';
    const avatar = c.is_author ? '<div class="avatar author-avatar">A</div>' : '<div class="avatar"></div>';
    
    return `
      <div class="comment ${isReply ? 'reply' : ''}" id="comment-${c.id}">
        ${avatar}
        <div class="comment-body-wrap">
          <div class="comment-meta">
            <span class="comment-author">${c.is_author ? 'Author' : 'Anonymous'}</span>
            ${authorBadge}
            <span class="comment-date">${d}</span>
          </div>
          <div class="comment-text">${escapeHtml(c.body)}</div>
          ${!isReply && isAdmin ? `<button class="reply-btn" onclick="showReplyForm(${c.id})">Reply</button>` : ''}
          <div class="reply-form" id="reply-form-${c.id}" style="display:none;">
            <textarea id="reply-body-${c.id}" placeholder="Write a reply..."></textarea>
            <div class="reply-actions">
               <button onclick="hideReplyForm(${c.id})">Cancel</button>
               <button onclick="submitComment('${slug}', ${c.id})">Post</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.showReplyForm = (id) => {
    document.getElementById(`reply-form-${id}`).style.display = 'block';
  };
  window.hideReplyForm = (id) => {
    document.getElementById(`reply-form-${id}`).style.display = 'none';
  };

  window.submitComment = async (slug, parentId) => {
    const bodyId = parentId ? `reply-body-${parentId}` : 'new-comment-body';
    const bodyInput = document.getElementById(bodyId);
    const body = bodyInput.value.trim();
    if (!body) return;
    
    try {
      const payload = { body, parent_id: parentId };
      if (isAdmin) {
        payload.secret_key = sessionStorage.getItem('adminPassword');
      }
      
      const res = await fetch(`/api/posts/${slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to post comment');
      
      bodyInput.value = '';
      loadComments(slug); // reload comments
    } catch (err) {
      console.error(err);
      alert('Could not post comment.');
    }
  };

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
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('adminPassword') || ''
        },
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
  updateAdminUI();
  document.getElementById('year').textContent = new Date().getFullYear();
  loadPosts();

  const toggle = document.getElementById('adminToggle');
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      if (isAdmin) {
        isAdmin = false;
        sessionStorage.removeItem('isAdmin');
        sessionStorage.removeItem('adminPassword');
        updateAdminUI();
        renderCatalog();
        const activePost = document.querySelector('#view-post.active');
        if (activePost) location.reload();
      } else {
        const pwd = prompt('Enter admin password:');
        if (pwd) {
          fetch('/api/verify-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
          }).then(res => {
            if (res.ok) {
              isAdmin = true;
              sessionStorage.setItem('isAdmin', 'true');
              sessionStorage.setItem('adminPassword', pwd);
              updateAdminUI();
              renderCatalog();
              const activePost = document.querySelector('#view-post.active');
              if (activePost) location.reload();
            } else {
              alert('Incorrect password');
            }
          }).catch(err => {
            console.error(err);
            alert('Could not verify password');
          });
        }
      }
    });
  }