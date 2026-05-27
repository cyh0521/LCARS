// js/scores.js — MLB Scores + Standings via ESPN API

  /* ============================================================
     MLB SCORES — ESPN's CORS-friendly internal API
     ============================================================ */
  // ESPN uses team abbreviations. Orioles = BAL.
  const ORIOLES_ABBR = 'BAL';
  const SCORES_CACHE_KEY    = 'lcars_scores_cache';
  const ENRICH_CACHE_KEY    = 'lcars_enrich_cache';
  const STANDINGS_CACHE_KEY = 'lcars_standings_cache';

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

    // All games list — live games first, then pre, then post
    const allContainer = document.getElementById('scores-all');
    allContainer.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'game-list';
    const sortedEvents = [...events].sort((a, b) => {
      const stateOrder = { in: 0, pre: 1, post: 2 };
      const sa = stateOrder[a.status?.type?.state] ?? 1;
      const sb = stateOrder[b.status?.type?.state] ?? 1;
      if (sa !== sb) return sa - sb;
      // Within same state, sort by scheduled time
      return new Date(a.date) - new Date(b.date);
    });
    sortedEvents.forEach(ev => {
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
    const stateType  = espnEvent.status?.type?.state || comp.status?.type?.state;
    const statusName = espnEvent.status?.type?.name || '';
    const detail     = espnEvent.status?.type?.shortDetail || espnEvent.status?.type?.detail || '';
    const isCompleted = espnEvent.status?.type?.completed === true;
    const isPostponed = ['STATUS_POSTPONED','STATUS_CANCELED','STATUS_CANCELLED','STATUS_FORFEIT'].includes(statusName);
    const isSuspended = statusName === 'STATUS_SUSPENDED';
    const isTrueFinal = stateType === 'post' && isCompleted && !isPostponed && !isSuspended;

    // Build a short status label for the linescore header team-col
    let statusLabel = '';
    if (stateType === 'in') {
      const sit = buildSituationData(espnEvent);
      statusLabel = sit ? (sit.isTop ? 'TOP' : 'BOT') + ' ' + sit.period : detail;
    } else if (isTrueFinal)  { statusLabel = t('scoreFinal'); }
    else if (isSuspended)    { statusLabel = (detail || 'SUSPENDED').toUpperCase(); }
    else if (isPostponed)    { statusLabel = (detail || 'POSTPONED').toUpperCase(); }
    else {
      // Pre-game: show scheduled time
      const dt = new Date(espnEvent.date);
      statusLabel = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const sit = (stateType === 'in') ? buildSituationData(espnEvent) : null;
    const lineHtml = renderEspnLinescore(away, home, sit, stateType, statusLabel);
    const situationHtml = (stateType === 'in') ? renderEspnSituationBar(espnEvent) : '';
    const pitcherHtml = renderEspnPitcherCards(comp, stateType);

    if (!lineHtml && !pitcherHtml) return '';

    // ESPN link — top-right of linescore
    const espnUrl = `https://www.espn.com/mlb/game/_/gameId/${espnEvent.id}`;
    const espnLink = `<a class="pin-btn score-link-btn ls-espn-link"
       href="${espnUrl}" target="_blank" rel="noopener"
       onclick="event.stopPropagation();"
       title="${escapeAttr(t('openOnEspn'))}"
       aria-label="${escapeAttr(t('openOnEspn'))}">
      <svg class="icon icon-sm"><use href="#i-external"/></svg>
    </a>`;

    const linescoreWrapped = `<div class="ls-wrapper">${espnLink}${lineHtml}</div>`;
    return [linescoreWrapped, situationHtml, pitcherHtml].filter(Boolean).join('');
  }

  /* Extract situation data for live games */
  function buildSituationData(espnEvent) {
    const comp   = espnEvent.competitions?.[0];
    const sit    = comp?.situation;
    const status = espnEvent.status || {};
    const period = status.period || 0;
    if (!period) return null;
    const isTop = sit?.isTopHalf ?? (status.type?.shortDetail?.toLowerCase().includes('top'));
    const batter  = sit?.batter?.athlete;
    const pitcher = sit?.pitcher?.athlete;
    return {
      period,
      isTop:    !!isTop,
      outs:     sit?.outs     ?? '?',
      onFirst:  !!(sit?.onFirst),
      onSecond: !!(sit?.onSecond),
      onThird:  !!(sit?.onThird),
      balls:    sit?.balls   ?? null,
      strikes:  sit?.strikes ?? null,
      batter:   batter  ? (batter.shortName  || batter.displayName  || '') : '',
      pitcher:  pitcher ? (pitcher.shortName || pitcher.displayName || '') : '',
    };
  }

  /* Build the linescore table from ESPN competitor.linescores arrays */
  function renderEspnLinescore(away, home, sit, stateType, statusLabel) {
    const awayLine = away?.linescores || [];
    const homeLine = home?.linescores || [];
    if (!awayLine.length && !homeLine.length) return '';

    const numInnings = Math.max(9, awayLine.length, homeLine.length);

    let colgroup = '<colgroup><col class="team-col-spec">';
    for (let i = 0; i < numInnings; i++) colgroup += '<col class="inning-col-spec">';
    colgroup += '<col class="rhe-col-spec"><col class="rhe-col-spec"><col class="rhe-col-spec"></colgroup>';

    const isLive = stateType === 'in';
    let headerStatusHtml = '';
    if (statusLabel) {
      headerStatusHtml = isLive
        ? `<span class="ls-live-dot"></span><span class="ls-live-detail">${escapeHtml(statusLabel)}</span>`
        : `<span class="ls-status-detail">${escapeHtml(statusLabel)}</span>`;
    }

    let header = `<tr><th class="team-col">${headerStatusHtml}</th>`;
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

  /* Live situation bar: bases, outs, count + due-up batters */
  function renderEspnSituationBar(espnEvent) {
    const comp = espnEvent.competitions?.[0];
    const sit  = comp?.situation;
    const status = espnEvent.status || {};
    const period = status.period || 0;
    if (!sit || !period) return '';

    const outs    = sit.outs ?? '?';
    const onFirst = !!(sit.onFirst);
    const onSecond= !!(sit.onSecond);
    const onThird = !!(sit.onThird);
    const balls   = sit.balls   ?? null;
    const strikes = sit.strikes ?? null;

    // Bases diamond SVG
    const bs = 11, pitch = 12;
    const lit = 'var(--lcars-gold)', dim = 'rgba(255,255,255,0.2)';
    const svgW = 42, svgH = 34;
    const cx = svgW / 2, cy = svgH / 2 + 1;
    const bases = [
      { x: cx,         y: cy - pitch, filled: onSecond },
      { x: cx + pitch, y: cy,         filled: onFirst  },
      { x: cx - pitch, y: cy,         filled: onThird  },
    ];
    const half = bs / 2;
    const rects = bases.map(b =>
      `<rect x="${b.x-half}" y="${b.y-half}" width="${bs}" height="${bs}"
             fill="${b.filled ? lit : 'none'}" stroke="${b.filled ? lit : dim}"
             stroke-width="1.5" transform="rotate(45 ${b.x} ${b.y})"/>`
    ).join('');
    const diamondSvg = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" overflow="visible">${rects}</svg>`;

    // Count label
    const countHtml = (balls !== null && strikes !== null)
      ? `<span class="ls-sit-count">${balls}-${strikes}</span>` : '';

    // Helper: make a player card
    const makeCard = (label, sitPlayer) => {
      if (!sitPlayer) return '';
      const ath   = sitPlayer.athlete || {};
      const name  = ath.shortName || ath.displayName || '';
      if (!name) return '';
      const photo = ath.headshot?.href || getEspnHeadshot(ath.id);

      // Build stat line: use statistics if available, else fix up summary
      let statLine = '';
      const statsArr = sitPlayer.statistics || [];
      if (statsArr.length) {
        statLine = statsArr
          .map(s => {
            const val  = s.displayValue ?? '';
            const abbr = (s.abbreviation || s.name || '').trim();
            if (!abbr || val === '-') return '';
            return val ? `${val} ${abbr}` : `1 ${abbr}`;
          })
          .filter(Boolean)
          .join(', ');
      }
      if (!statLine) {
        // Fix ESPN summary: insert '1' before standalone abbreviations
        // e.g. "0-4, K" → "0-4, 1 K", "2-4, 2B, K" → "2-4, 2B, 1 K"
        statLine = (sitPlayer.summary || '')
          .replace(/(,\s*)([A-Z]+)(?=[,\s]|$)/g, '$11 $2');
      }

      const photoHtml = photo
        ? `<img class="due-up-photo" src="${escapeAttr(photo)}" alt="${escapeAttr(name)}" loading="lazy" onerror="this.style.display='none'">`
        : `<span class="due-up-photo placeholder"></span>`;
      return `<div class="due-up-card">
        ${photoHtml}
        <div class="due-up-info">
          <span class="due-up-order">${escapeHtml(label)}</span>
          <span class="due-up-name">${escapeHtml(name)}</span>
          ${statLine ? `<span class="due-up-stats">${escapeHtml(statLine)}</span>` : ''}
        </div>
      </div>`;
    };

    // Prefer batter/pitcher (most stable), fall back to dueUp
    const playerCards = [];
    const pitCard = makeCard('P',  sit.pitcher);
    const batCard = makeCard('AB', sit.batter);
    if (pitCard) playerCards.push(pitCard);
    if (batCard) playerCards.push(batCard);

    if (!playerCards.length) {
      (sit.dueUp || []).slice(0, 3).forEach(d => {
        const c = makeCard(
          d.battingOrder ? `DUE UP (${d.battingOrder})` : 'DUE UP',
          d
        );
        if (c) playerCards.push(c);
      });
    }

    const dueUpHtml = playerCards.length
      ? `<div class="ls-due-up-row">${playerCards.join('')}</div>` : '';

    return `<div class="ls-situation-bar">
      <div class="ls-sit-summary">
        ${diamondSvg}
        <div class="ls-sit-meta">
          <span class="ls-sit-outs-big">${outs} <span class="ls-sit-outs-label">OUT${outs !== 1 ? 'S' : ''}</span></span>
          ${countHtml}
        </div>
      </div>
      ${dueUpHtml}
    </div>`;
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
    // Featured card: status shown in linescore header, only need link button.
    // Non-featured small cards: show full status row.
    const statusHtml = featured
      ? (linkBtnHtml ? `<div class="game-status-row game-status-row--link">${linkBtnHtml}</div>` : '')
      : `<div class="game-status-row">
           <div class="${stateType === 'in' ? 'game-status live' : 'game-status'}">${statusInner}</div>
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


  /* ============================================================
     MLB STANDINGS — ESPN standings API
     Six divisions, with W / L / PCT / GB / STRK columns
     ============================================================ */

  const DIVISIONS_ORDER = [
    'AL East', 'AL Central', 'AL West',
    'NL East', 'NL Central', 'NL West'
  ];

  async function fetchStandings() {
    // Render from cache first
    const cached = cacheGet(STANDINGS_CACHE_KEY);
    if (cached?.records) {
      renderStandings(cached.records);
      updateStandingsTimestamp(cached.timestamp);
    }

    const url = 'https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings';
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const records = parseStandingsData(data);
      if (!records.length) throw new Error('No standings records parsed');

      const timestamp = Date.now();
      cacheSet(STANDINGS_CACHE_KEY, { records, timestamp });
      renderStandings(records);
      updateStandingsTimestamp(timestamp);
    } catch (err) {
      console.warn('[LCARS] Standings fetch failed:', err);
      if (!cacheGet(STANDINGS_CACHE_KEY)) {
        const el = document.getElementById('standings-container');
        if (el) el.innerHTML = `<div class="empty-state"><p>${t('standingsError')}</p></div>`;
      }
    }
  }
  window.fetchStandings = fetchStandings;

  // ESPN standings API only groups by AL/NL — no division sub-grouping.
  // We map each team to its division using a static lookup (MLB divisions are stable).
  const TEAM_DIVISION_MAP = {
    BAL:'AL East', BOS:'AL East', NYY:'AL East', TB:'AL East', TBR:'AL East', TOR:'AL East',
    CWS:'AL Central', CHW:'AL Central', CLE:'AL Central', DET:'AL Central',
    KC:'AL Central',  KCR:'AL Central', MIN:'AL Central',
    HOU:'AL West',  LAA:'AL West', ANA:'AL West', OAK:'AL West', ATH:'AL West', SEA:'AL West', TEX:'AL West',
    ATL:'NL East',  MIA:'NL East', NYM:'NL East', PHI:'NL East', WAS:'NL East', WSH:'NL East',
    CHC:'NL Central', CIN:'NL Central', MIL:'NL Central', PIT:'NL Central', STL:'NL Central',
    ARI:'NL West',  COL:'NL West', LAD:'NL West', SD:'NL West', SDP:'NL West',
    SF:'NL West',   SFG:'NL West',
  };

  function parseStandingsData(data) {
    // Flatten all entries from AL + NL groups
    const allEntries = [];
    (data?.children || []).forEach(league => {
      (league?.standings?.entries || []).forEach(e => allEntries.push(e));
    });
    if (!allEntries.length) return [];

    // Bucket each team into its division
    const divMap = {};
    DIVISIONS_ORDER.forEach(d => { divMap[d] = []; });

    allEntries.forEach(entry => {
      const team  = entry.team || {};
      const abbr  = team.abbreviation || '';
      const div   = TEAM_DIVISION_MAP[abbr];
      if (!div) return;

      const stats   = entry.stats || [];
      const getStat = (...keys) => {
        for (const k of keys) {
          const s = stats.find(s => s.abbreviation === k);
          if (s) return s.displayValue ?? (s.value != null ? String(s.value) : null);
        }
        return '–';
      };

      divMap[div].push({
        abbr,
        name: team.shortDisplayName || team.name || '?',
        logo: team.logos?.[0]?.href || null,
        w:    getStat('W'),
        l:    getStat('L'),
        pct:  getStat('PCT'),
        gb:   getStat('GB'),
        strk: getStat('STRK'),
        seed: parseInt(getStat('SEED') || '99', 10),
      });
    });

    return DIVISIONS_ORDER
      .map(div => ({
        div,
        teams: (divMap[div] || []).sort((a, b) => a.seed - b.seed),
      }))
      .filter(r => r.teams.length > 0);
  }

  function updateStandingsTimestamp(ts) {
    const el = document.getElementById('standings-updated');
    if (!el) return;
    if (!ts) { el.textContent = ''; return; }
    const date = new Date(ts);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.textContent = ' · ' + t('updatedAt') + ' ' + time;
  }

  function renderStandings(records) {
    const container = document.getElementById('standings-container');
    if (!container) return;
    if (!records || !records.length) {
      container.innerHTML = `<div class="empty-state"><p>${t('standingsError')}</p></div>`;
      return;
    }

    // Sort divisions by canonical order (AL East, AL Central, AL West, NL East…)
    const sorted = [...records].sort((a, b) => {
      const ia = DIVISIONS_ORDER.findIndex(d => a.div.includes(d) || d.includes(a.div));
      const ib = DIVISIONS_ORDER.findIndex(d => b.div.includes(d) || d.includes(b.div));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'standings-grid';

    sorted.forEach(({ div, teams }) => {
      const section = document.createElement('div');
      section.className = 'standings-division';
      const rows = teams.map((tm, idx) => {
        const cls = [
          idx === 0 ? 'st-leader' : '',
          tm.abbr === ORIOLES_ABBR ? 'st-highlight' : ''
        ].filter(Boolean).join(' ');
        return `
          <tr class="${cls}">
            <td class="st-team-col">
              ${tm.logo ? `<img class="st-logo" src="${escapeAttr(tm.logo)}" alt="${escapeAttr(tm.abbr)}" loading="lazy">` : ''}
              <span class="st-abbr-fallback">${escapeHtml(tm.abbr)}</span>
            </td>
            <td>${escapeHtml(String(tm.w))}</td>
            <td>${escapeHtml(String(tm.l))}</td>
            <td class="st-pct">${escapeHtml(String(tm.pct))}</td>
            <td>${escapeHtml(String(tm.gb))}</td>
            <td class="st-strk">${escapeHtml(String(tm.strk))}</td>
          </tr>`;
      }).join('');
      section.innerHTML = `
        <div class="standings-div-title">${escapeHtml(div.toUpperCase())}</div>
        <table class="standings-table">
          <thead>
            <tr>
              <th class="st-team-col"></th>
              <th>W</th><th>L</th><th>PCT</th><th>GB</th>
              <th>${t('standingsStrk')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
      grid.appendChild(section);
    });

    container.appendChild(grid);
  }

