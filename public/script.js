let posts = [
  {
    slug: 'slow-mornings',
    title: 'On Slow Mornings',
    date: '2026-07-20',
    tags: ['life', 'habits'],
    excerpt: 'What changed when I stopped rushing the first hour of the day.',
    content: [
      "For years my mornings were a race against the first meeting. I'd wake up already behind, and that feeling followed me until lunch.",
      "A few months ago I started leaving thirty minutes with nothing scheduled. No phone, no plan, just coffee and whatever my mind wanted to do with the quiet.",
      "It didn't fix anything dramatic. But it changed the tone of the day — I stopped starting from behind, and started from somewhere closer to myself."
    ]
  },
  {
    slug: 'unfinished-things',
    title: 'In Praise of Unfinished Things',
    date: '2026-07-11',
    tags: ['creativity'],
    excerpt: 'Not every draft needs to become something. Some are allowed to just exist.',
    content: [
      "I have a folder of essays I never finished. For a long time I thought of it as a graveyard — proof I don't follow through.",
      "Lately I think of it differently. Each one taught me something about what I actually think, even if it never became an argument worth publishing.",
      "Maybe the point of writing isn't always the finished piece. Sometimes it's just the version of your thinking you couldn't have reached any other way."
    ]
  },
  {
    slug: 'small-rooms',
    title: 'Small Rooms, Big Conversations',
    date: '2026-06-29',
    tags: ['people', 'reflection'],
    excerpt: 'The best conversations I remember happened in the least impressive settings.',
    content: [
      "None of my favorite conversations happened somewhere scenic. A cramped kitchen, a car in a parking lot, a hallway outside a party neither of us wanted to be at.",
      "I used to think meaningful conversation needed the right setting. Now I think it just needs two people willing to stop performing for a minute.",
      "The room doesn't do the work. The willingness does."
    ]
  },
  {
    slug: 'question-i-avoid',
    title: 'The Question I Keep Avoiding',
    date: '2026-06-14',
    tags: ['work', 'reflection'],
    excerpt: 'Sometimes the thing you avoid writing about is the thing most worth writing about.',
    content: [
      "There's a question about my work I've rewritten the opening paragraph to five times now, always stopping before the honest part.",
      "I think the avoidance itself is the interesting part — not the answer, but why answering feels so uncomfortable.",
      "So this entry isn't the answer. It's just an honest note that the question exists, and that I'm still circling it."
    ]
  }
];

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

document.getElementById('publishBtn').addEventListener('click', () => {
  const title = document.getElementById('wTitle').value.trim();
  const tagsRaw = document.getElementById('wTags').value.trim();
  const body = document.getElementById('wBody').value.trim();

  if(!title || !body){
    alert('Give your entry a title and something to say.');
    return;
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : ['untagged'];
  const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  posts.push({
    slug,
    title,
    date: new Date().toISOString().slice(0,10),
    tags,
    excerpt: paragraphs[0] ? paragraphs[0].slice(0, 110) + (paragraphs[0].length > 110 ? '…' : '') : '',
    content: paragraphs.length ? paragraphs : [body]
  });

  document.getElementById('wTitle').value = '';
  document.getElementById('wTags').value = '';
  document.getElementById('wBody').value = '';

  renderTagFilters();
  renderCatalog();
  switchView('home');
  setTimeout(() => openPost(slug), 50);
});

// rotating hero line
let rIndex = 0;
setInterval(() => {
  rIndex = (rIndex + 1) % rotatingPhrases.length;
  document.getElementById('rotatingText').textContent = rotatingPhrases[rIndex];
}, 3200);

// init
document.getElementById('year').textContent = new Date().getFullYear();
renderTagFilters();
renderCatalog();