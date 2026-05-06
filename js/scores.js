// js/scores.js — MLB Scores via ESPN API

  /* ============================================================
     MLB SCORES — ESPN's CORS-friendly internal API
     ============================================================ */
  // ESPN uses team abbreviations. Orioles = BAL.
  const ORIOLES_ABBR = 'BAL';
  const SCORES_CACHE_KEY = 'lcars_scores_cache';
  const ENRICH_CACHE_KEY = 'lcars_enrich_cache';

  /* Render scores from cache instantly. Returns true if cache was used. */
  function renderScoresFromCache() {
    const cached = cacheGet(SCORES_CACHE_KEY);
    if (!cached || !Array.isArray(cached.events)) return false;
    renderScores(cached.events, /* fromCache */ true);
    updateScoresTimestamp(cached.timestamp);
    return true;
  }

  function updateScoresTimestamp(ts) {
    const el = document.getElementById('scores-updated');
    if (!el) return;
    if (!ts) { el.textContent = ''; return; }
    const date = new Date(ts);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.textContent = ' · ' + t('updatedAt') + ' ' + time;
  }

  async function fetchScores() {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const events = data?.events || [];
      const timestamp = Date.now();
      cacheSet(SCORES_CACHE_KEY, { events, timestamp });
      renderScores(events, /* fromCache */ false);
      updateScoresTimestamp(timestamp);
    } catch (err) {
      console.warn('ESPN MLB fetch failed:', err);
      // Only show error state if we have nothing cached
      if (!cacheGet(SCORES_CACHE_KEY)) {
        document.getElementById('orioles-feature').innerHTML =
          `<div class="empty-state"><p>${t('scoresError')}</p></div>`;
        document.getElementById('scores-all').innerHTML =
          `<div class="empty-state"><p>${t('scoresError')}</p></div>`;
      }
    }
  }

  // ID of the user-pinned game (null = use default Orioles selection).
  // Cleared on page reload — featured panel always defaults to Orioles
  // on a fresh visit.
  let featuredEventId = null;
  // Keep last events list around so the pin button can rerender.
  let lastEventsList = [];

  function renderScores(events, fromCache) {
    lastEventsList = events;

    if (!events.length) {
      const noGames = `<div class="empty-state"><p>${t('scoresNoGames')}</p></div>`;
      document.getElementById('orioles-feature').innerHTML = noGames;
      document.getElementById('scores-all').innerHTML = noGames;
      setFeaturedTitle(null);
      return;
    }

    // Pick which game to feature:
    //  1. The user-pinned event if it still exists today
    //  2. Otherwise the Orioles game if scheduled today
    //  3. Otherwise nothing (show empty state)
    let featured = null;
    if (featuredEventId) {
      featured = events.find(ev => String(ev.id) === String(featuredEventId));
    }
    if (!featured) {
      featured = events.find(ev => {
        const comp = ev.competitions?.[0];
        if (!comp) return false;
        return comp.competitors?.some(c => c.team?.abbreviation === ORIOLES_ABBR);
      });
      if (featured) featuredEventId = null;  // reset to default mode
    }

    renderFeaturedGame(featured);

    // All games list
    const allContainer = document.getElementById('scores-all');
    allContainer.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'game-list';
    events.forEach(ev => {
      const isCurrentFeatured = featured && String(ev.id) === String(featured.id);
      list.appendChild(renderGameCard(ev, false, isCurrentFeatured));
    });
    allContainer.appendChild(list);
  }

  /* Render a game into the featured panel and update the title to match */
  function renderFeaturedGame(event) {
    const featContainer = document.getElementById('orioles-feature');
    if (!event) {
      featContainer.innerHTML = `<div class="empty-state"><p>${t('scoresNoOrioles')}</p></div>`;
      setFeaturedTitle(null);
      return;
    }
    featContainer.innerHTML = '';
    const card = renderGameCard(event, true, false);
    featContainer.appendChild(card);
    enrichFeaturedCard(event, card);
    setFeaturedTitle(event);
  }

  /* Update the featured panel's H2 title.
     Default (Orioles or no game): the static i18n string.
     Custom-pinned: "AWAY @ HOME" using team names from the event. */
  function setFeaturedTitle(event) {
    const titleSpan = document.querySelector('#orioles-feature')
      ?.closest('.panel')
      ?.querySelector('.panel-title span[data-i18n], .panel-title span.dynamic-title');
    if (!titleSpan) return;

    // Detect: is this an Orioles game (default) or pinned other?
    const comp = event?.competitions?.[0];
    const competitors = comp?.competitors || [];
    const isOrioles = competitors.some(c => c.team?.abbreviation === ORIOLES_ABBR);
    const isUserPinned = event && featuredEventId && String(event.id) === String(featuredEventId);

    if (!event || (isOrioles && !isUserPinned)) {
      // Default mode — restore i18n binding
      titleSpan.classList.remove('dynamic-title');
      titleSpan.setAttribute('data-i18n', 'orioles');
      titleSpan.textContent = t('orioles');
    } else {
      // Pinned other game — show "AWAY @ HOME" with team names
      const away = competitors.find(c => c.homeAway === 'away') || competitors[0];
      const home = competitors.find(c => c.homeAway === 'home') || competitors[1];
      const awayName = away?.team?.name || away?.team?.abbreviation || '?';
      const homeName = home?.team?.name || home?.team?.abbreviation || '?';
      titleSpan.removeAttribute('data-i18n');
      titleSpan.classList.add('dynamic-title');
      titleSpan.textContent = `${awayName.toUpperCase()} @ ${homeName.toUpperCase()}`;
    }
  }

  /* Pin a game from the all-games list to the featured slot */
  function pinFeaturedEvent(eventId) {
    featuredEventId = String(eventId);
    if (!lastEventsList.length) return;
    renderScores(lastEventsList, true);
    // Scroll to top — try every candidate scroll container so it works
    // regardless of which one the layout actually scrolls.
    const scrollTargets = [
      document.querySelector('.main'),
      document.querySelector('section[data-page="scores"]'),
      document.documentElement,
      document.body,
      window
    ];
    scrollTargets.forEach(el => {
      if (!el) return;
      try {
        if (el === window) el.scrollTo({ top: 0, behavior: 'smooth' });
        else if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'smooth' });
        else el.scrollTop = 0;
      } catch (e) { /* best-effort */ }
    });
    beep(720);
  }
  window.pinFeaturedEvent = pinFeaturedEvent;

  /* ============================================================
     ENRICH FEATURED CARD — uses MLB.com statsapi for reliable
     pitcher decisions and game leaders.

     ESPN gives us the gameId but MLB statsapi uses its own id.
     We have to translate by matching on date + teams.
     ============================================================ */


  /* ============================================================
     FEATURED CARD ENRICHMENT — pure ESPN, synchronous, no proxy.
     Uses data already present in the scoreboard payload.
     ============================================================ */

  // Synchronous: takes the espnEvent (already in memory) and the card element,
  // renders the linescore + pitcher cards directly. No network calls.
  function enrichFeaturedCard(espnEvent, cardEl /* hasCachedUi unused */) {
    try {
      const detailsHtml = renderEspnDetails(espnEvent);
      if (!detailsHtml) return;
      const detailsEl = document.createElement('div');
      detailsEl.className = 'game-details';
      detailsEl.innerHTML = detailsHtml;
      // Replace any placeholder/skeleton/cached details
      const existing = cardEl.querySelector('.game-details');
      if (existing) existing.replaceWith(detailsEl);
      else cardEl.appendChild(detailsEl);
      cardEl.classList.add('has-detail');
    } catch (e) {
      console.warn('[LCARS] enrich render failed:', e);
    }
  }

  /* Render linescore + pitcher cards from an ESPN scoreboard event */
  function renderEspnDetails(espnEvent) {
    const comp = espnEvent.competitions?.[0];
    if (!comp) return '';
    const competitors = comp.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[1];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[0];
    const status = espnEvent.status?.type?.state || comp.status?.type?.state;

    const lineHtml = renderEspnLinescore(away, home);
    const pitcherHtml = renderEspnPitcherCards(comp, status);

    if (!lineHtml && !pitcherHtml) return '';
    return [lineHtml, pitcherHtml].filter(Boolean).join('');
  }

  /* Build the linescore table from ESPN competitor.linescores arrays */
  function renderEspnLinescore(away, home) {
    const awayLine = away?.linescores || [];
    const homeLine = home?.linescores || [];
    if (!awayLine.length && !homeLine.length) return '';

    const numInnings = Math.max(9, awayLine.length, homeLine.length);

    // Build colgroup so columns have consistent widths regardless of
    // team name length. Inning + R/H/E columns are fixed width;
    // team column takes whatever's left.
    let colgroup = '<colgroup><col class="team-col-spec">';
    for (let i = 0; i < numInnings; i++) colgroup += '<col class="inning-col-spec">';
    colgroup += '<col class="rhe-col-spec"><col class="rhe-col-spec"><col class="rhe-col-spec"></colgroup>';

    let header = '<tr><th class="team-col"></th>';
    for (let i = 1; i <= numInnings; i++) header += `<th>${i}</th>`;
    header += '<th class="rhe-col inning-divider">R</th><th class="rhe-col">H</th><th class="rhe-col">E</th></tr>';

    const buildRow = (team, line) => {
      const t_ = team?.team || {};
      const abbr = t_.abbreviation || '';
      const logo = t_.logo || '';
      const teamCell = `
        <td class="team-col">
          <span class="team-col-inner">
            ${logo ? `<img class="ls-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(abbr)}">` : ''}
            <span class="ls-abbr">${escapeHtml(abbr)}</span>
          </span>
        </td>`;
      let inningCells = '';
      for (let i = 0; i < numInnings; i++) {
        const v = line[i];
        const runs = (v == null || v.value == null) ? '-' : v.value;
        inningCells += `<td>${runs}</td>`;
      }
      const r = team?.score ?? '-';
      const stats = team?.statistics || [];
      const findStat = (name) => {
        const s = stats.find(s => s.name === name || s.abbreviation === name);
        return s?.displayValue ?? '-';
      };
      const h = findStat('hits');
      const e = findStat('errors');
      return `<tr>${teamCell}${inningCells}<td class="rhe-col inning-divider">${r}</td><td class="rhe-col">${h}</td><td class="rhe-col">${e}</td></tr>`;
    };

    return `
      <table class="linescore">
        ${colgroup}
        <thead>${header}</thead>
        <tbody>
          ${buildRow(away, awayLine)}
          ${buildRow(home, homeLine)}
        </tbody>
      </table>`;
  }

  /* Pitcher decision cards from ESPN — pre-game shows probables.
     For live/post we lack reliable decision data in scoreboard endpoint,
     so we just skip pitcher cards in those states. */
  function renderEspnPitcherCards(comp, status) {
    const cards = [];

    if (status === 'pre') {
      const competitors = comp.competitors || [];
      competitors.forEach(c => {
        const probables = c.probables || [];
        const starter = probables[0];
        if (!starter) return;
        const ath = starter.athlete || {};
        const name = ath.fullName || ath.displayName || ath.shortName;
        if (!name) return;
        const id = ath.id;
        const teamAbbr = c.team?.abbreviation || '';
        const statsLine = starter.statistics ? statsToLine(starter.statistics) : '';
        cards.push(espnPitcherCardHtml(
          'probable',
          `${t('detProbable')} · ${teamAbbr}`,
          name,
          statsLine,
          '',
          getEspnHeadshot(id)
        ));
      });
    }

    if (!cards.length) return '';
    return `<div class="pitcher-row">${cards.join('')}</div>`;
  }

  function espnPitcherCardHtml(decisionClass, decisionLabel, name, statsLine, record, photoUrl) {
    const photoHtml = photoUrl
      ? `<div class="pitcher-photo"><img src="${escapeAttr(photoUrl)}" alt="${escapeAttr(name)}" loading="lazy" onerror="this.parentElement.classList.add('placeholder');this.remove();"></div>`
      : `<div class="pitcher-photo placeholder">●</div>`;
    return `
      <div class="pitcher-card">
        ${photoHtml}
        <div class="pitcher-info">
          <span class="pitcher-decision ${decisionClass}">${escapeHtml(decisionLabel)}</span>
          <span class="pitcher-name">${escapeHtml(name)}${record ? `<span class="pitcher-record">(${escapeHtml(record)})</span>` : ''}</span>
          <span class="pitcher-stats">${escapeHtml(statsLine)}</span>
        </div>
      </div>`;
  }

  function getEspnHeadshot(athleteId) {
    if (!athleteId) return null;
    return `https://a.espncdn.com/i/headshots/mlb/players/full/${athleteId}.png`;
  }

  function statsToLine(stats) {
    if (!Array.isArray(stats)) return '';
    return stats
      .map(s => `${s.displayValue || ''} ${s.abbreviation || s.name || ''}`.trim())
      .filter(Boolean)
      .join(', ');
  }

  function renderGameCard(event, featured, isCurrentFeatured) {
    const comp = event.competitions?.[0];
    const status = event.status || comp?.status || {};
    const stateType = status.type?.state;        // 'pre' | 'in' | 'post'
    const statusName = status.type?.name || '';  // e.g. STATUS_FINAL, STATUS_POSTPONED
    const isCompleted = status.type?.completed === true;
    const detail = status.type?.shortDetail || status.type?.detail || '';
    const competitors = comp?.competitors || [];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[0];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[1];

    // ESPN groups several "game over" outcomes under state='post':
    //   - real finals (STATUS_FINAL)
    //   - postponed / canceled / forfeit — game never played
    //   - suspended — game started, was halted, has a partial score
    // We need three distinct visual states because they convey different
    // information: a true FINAL, a SUSPENDED game (show partial score),
    // and a POSTPONED game (no meaningful score, fade card).
    const isPostponed = statusName === 'STATUS_POSTPONED'
                     || statusName === 'STATUS_CANCELED'
                     || statusName === 'STATUS_CANCELLED'
                     || statusName === 'STATUS_FORFEIT';
    const isSuspended = statusName === 'STATUS_SUSPENDED';
    const isTrueFinal = stateType === 'post' && isCompleted && !isPostponed && !isSuspended;

    // Card is a div now — clicking the body pins the game.
    // The top-right button is the ESPN external link.
    const card = document.createElement('div');
    card.className = 'game-card';
    if (featured) card.classList.add('featured');
    if (stateType === 'in') card.classList.add('live');
    if (isTrueFinal) card.classList.add('final');
    if (isSuspended) card.classList.add('suspended');
    if (isPostponed) card.classList.add('postponed');
    if (isCurrentFeatured) card.classList.add('is-pinned');

    // Clicking a non-featured card pins it. The featured card itself
    // doesn't pin itself — clicking does nothing meaningful there.
    if (!featured) {
      card.style.cursor = 'pointer';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', t('pinToTop'));
      card.addEventListener('click', () => pinFeaturedEvent(event.id));
      card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          pinFeaturedEvent(event.id);
        }
      });
    }

    const awayScore = parseInt(away?.score || '0', 10);
    const homeScore = parseInt(home?.score || '0', 10);
    // Suspended games started, so they DO have a partial score worth
    // showing. Postponed games never played, so the score column is
    // meaningless and stays hidden.
    const showScore = (stateType === 'in' || isTrueFinal || isSuspended);
    const awayWin = showScore && awayScore > homeScore;
    const homeWin = showScore && homeScore > awayScore;

    // ---- Top status row + ESPN external link button ----
    let statusInner;
    if (stateType === 'in') {
      statusInner = `<span class="live-dot"></span><span>${escapeHtml(detail)}</span>`;
    } else if (isSuspended) {
      // Mid-game halt — surface ESPN's exact label ("Suspended", or
      // sometimes a more specific phrase) so it's clear this isn't a
      // real final.
      statusInner = escapeHtml(detail || 'SUSPENDED').toUpperCase();
    } else if (isPostponed) {
      // Use ESPN's own short label ("Postponed", "Canceled", "Forfeit")
      // rather than translating — it's already short and clear.
      statusInner = escapeHtml(detail || 'POSTPONED').toUpperCase();
    } else if (isTrueFinal) {
      statusInner = t('scoreFinal');
    } else {
      const dt = new Date(event.date);
      const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      statusInner = `${timeStr} · ${t('scoreScheduled')}`;
    }
    // ESPN external-link button — opens game page in a new tab.
    // Stop propagation so clicking it doesn't also pin the card.
    const espnUrl = `https://www.espn.com/mlb/game/_/gameId/${event.id}`;
    const linkBtnHtml = (!featured)
      ? `<a class="pin-btn score-link-btn"
            href="${espnUrl}"
            target="_blank"
            rel="noopener"
            onclick="event.stopPropagation();"
            title="${escapeAttr(t('openOnEspn'))}"
            aria-label="${escapeAttr(t('openOnEspn'))}">
          <svg class="icon icon-sm"><use href="#i-external"/></svg>
        </a>`
      : '';
    const statusClass = stateType === 'in' ? 'game-status live' : 'game-status';
    const statusHtml = `
      <div class="game-status-row">
        <div class="${statusClass}">${statusInner}</div>
        ${linkBtnHtml}
      </div>`;

    // ---- Team rows ----
    card.innerHTML = `
      ${statusHtml}
      <div class="game-teams">
        ${teamRowHtml(away, showScore, awayScore)}
        ${teamRowHtml(home, showScore, homeScore)}
      </div>`;
    return card;
  }

  function teamRowHtml(team, showScore, score) {
    const t_ = team?.team || {};
    // Use team.name for the casual nickname (Orioles, Yankees, Red Sox).
    // Fall back to shortDisplayName, then abbreviation if needed.
    const displayName = t_.name || t_.shortDisplayName || t_.abbreviation || '?';
    const logo = t_.logo;
    const record = team?.records?.[0]?.summary || '';

    const logoHtml = logo
      ? `<img class="game-team-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(displayName)}" loading="lazy">`
      : `<span class="game-team-logo placeholder"></span>`;

    return `
      <div class="game-team">
        ${logoHtml}
        <span class="game-team-abbr">${escapeHtml(displayName)}</span>
        <span class="game-team-record">${escapeHtml(record)}</span>
        <span class="game-score">${showScore ? score : '–'}</span>
      </div>`;
  }

  function escapeAttr(s) {
    return String(s ?? '').replace(/"/g, '&quot;');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }


  function weatherDesc(code) {
    return t('w' + code) || t('wUnk');
  }

