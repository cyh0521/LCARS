// js/core.js — i18n, clock, weather, cache, theme, beep, nav, tools, init
// Part of the LCARS Starbase modular split.

  /* ============================================================
     I18N — Bilingual translation dictionary (EN ⇌ 中文)
     ============================================================ */
  const I18N = {
    en: {
      // Sidebar groups
      grpStations: 'STATIONS',
      grpTools:    'TOOLS',
      // Tabs
      tabMain:    'MAIN',
      tabWorkspace: 'WORKSPACE',
      tabFinance: 'FINANCE',
      tabScores:  'SCORES',
      tabLibrary: 'LIBRARY',
      // Header page titles (used by top header-bar; shorter than sidebar tabs)
      pageMain:    'MAIN',
      pageWorkspace: 'WORKSPACE',
      pageFinance: 'FINANCE',
      pageScores:  'SCORES',
      pageLibrary: 'LIBRARY',
      // Page subtitles & empty state messages
      mainSub:         'OPERATIONS',
      workspaceSub: 'MISSION OPERATIONS',
      projectEmptyMsg: 'This station is reserved and ready. Tell Claude what you want to track here — projects, tasks, milestones, deadlines, or something else entirely.',
      // Project page
      projAllProjects:    'ALL PROJECTS',
      projAddProject:     '+ NEW PROJECT',
      projAddTask:        '+ ADD TASK',
      projAll:            'ALL',
      projStatusPENDING:  'PENDING',
      projStatusACTIVE:   'ACTIVE',
      projStatusCOMPLETE: 'COMPLETE',
      projStatusBLOCKED:  'BLOCKED',
      projSortBy:         'SORT:',
      projSortDue:        'DUE DATE',
      projSortPriority:   'PRIORITY',
      projSortCreated:    'CREATED',
      projColEmpty:       'NO TASKS',
      projEdit:           'EDIT',
      projReopen:         'REOPEN',
      projAddProject:     '+ PROJECT',
      projEditProject:    'EDIT PROJECT',
      projEditTask:       'EDIT TASK',
      projFieldTitle:     'TITLE',
      projFieldTitlePH:   'Task title…',
      projFieldProject:   'PROJECT',
      projFieldStatus:    'STATUS',
      projFieldPriority:  'PRIORITY',
      projFieldDue:       'DUE DATE',
      projFieldTags:      'TAGS',
      projFieldTagsPH:    'tag1, tag2, …',
      projFieldNotes:     'NOTES',
      projFieldNotesPH:   'Additional details…',
      projNoProject:      '(none)',
      projFieldProjectTitlePH: 'Project name…',
      projFieldColor:     'COLOR',
      projSaved:          'TASK SAVED',
      projUpdated:        'TASK UPDATED',
      projDeleted:        'DELETED',
      projSaveFailed:     'SAVE FAILED',
      projOffline:        'OFFLINE — SHOWING CACHED DATA',
      projConfirmDelete:  'Delete this task?',
      projConfirmDeleteTitle:     'DELETE TASK',
      projConfirmDeleteMsTitle:   'DELETE CHAPTER',
      projConfirmDeleteProjTitle: 'DELETE PROJECT',
      projConfirmDeleteProject: 'Delete project and its {n} tasks?',
      projConfirmDeleteProjectEmpty: 'Delete this project?',
      projPriority1: 'LOW',
      projPriority2: 'NORMAL',
      projPriority3: 'HIGH',
      projPriority4: 'CRITICAL',
      projMissionOps:    'MISSION OPS',
      projNoProjects:    'NO PROJECTS — TAP + TO BEGIN',
      projEmptyHint:     'Select a project from the sidebar, or create a new one.',
      projSelectMilestone: 'SELECT A CHAPTER FROM THE SIDEBAR',
      projAddMilestone:  '+ ADD SECTION',
      projEditMilestone: 'EDIT SECTION',
      projFieldMilestoneTitlePH: 'Section name…',
      projConfirmDeleteMs:      'Delete chapter and its {n} tasks?',
      projConfirmDeleteMsEmpty: 'Delete this chapter?',
      projConfirmDeleteProj:    'Delete project and its {n} chapters?',
      projConfirmDeleteProjEmpty: 'Delete this project?',
      projApplyTemplate:   'APPLY TEMPLATE',
      projTemplateHint:    'Select a template to create tasks for this chapter.',
      projApply:           'APPLY',
      projTasks:           'tasks',
      projTemplateApplied: 'TEMPLATE APPLIED',
      projStatus_TODO:        'TODO',
      projStatus_IN_PROGRESS: 'IN PROGRESS',
      projStatus_DONE:        'DONE',
      // Workspace subtabs
      workspaceSubProject:    'PROJECT TRACKER',
      workspaceSubAttendance: 'ATTENDANCE',
      wsTabProject:           'PROJECT',
      wsTabAttendance:        'ATTENDANCE',
      // Attendance
      attAddRecord:    '+ ADD RECORD',
      attLeaveAnnual:  'ANNUAL LEAVE',
      attLeaveComp:    'COMP LEAVE',
      attLeavePersonal:'PERSONAL LEAVE',
      attLeaveSick:    'SICK LEAVE',
      attOvertime:     'OVERTIME',
      attHoliday:      'HOLIDAY',
      attRecord:       'RECORD',
      attRecords:      'RECORDS',
      attUsed:         'USED',
      attQuota:        'QUOTA',
      attBalance:      'BALANCE',
      attRemaining:    'REMAINING',
      attNoRecords:    'NO RECORDS THIS MONTH',
      attAddTitle:     'ADD RECORD',
      attEditTitle:    'EDIT RECORD',
      attFieldDate:    'DATE',
      attFieldType:    'LEAVE TYPE',
      attFieldHours:   'HOURS',
      attFieldNotes:   'NOTES',
      attFieldNotesPH: 'Optional notes…',
      attSetQuota:     'SET QUOTA',
      attSetComp:      'SET COMP BALANCE',
      attSaved:        'RECORD SAVED',
      attUpdated:      'RECORD UPDATED',
      attDeleted:      'RECORD DELETED',
      attSaveFailed:   'SAVE FAILED',
      attOffline:      'OFFLINE — CACHED DATA',
      attConfirmDeleteTitle:'CONFIRM DELETE',
      attConfirmDelete:'Delete this record?',
      attHours:        'h',
      attTimeline:     'TIMELINE',
      attQuotaLabel:   'Annual Leave Quota',
      attCompLabel:    'Comp Leave Balance',
      financeSub:      'MARKET DATA · LIVE FEED',
      scoresSub:       'MLB · GAMES OF THE DAY',
      librarySub:      'SERIES TRACKER',
      // Library — sub-tab labels
      libSubtabSeries:     'SERIES',
      libSubtabFilms:      'FILMS',
      libSubtabReading:    'READING',
      libSubtabCollection: 'COLLECTION',
      // Library — dynamic page-subtitle per sub-tab
      libSubSeries:        'SERIES TRACKER',
      libSubFilms:         'FILM LOG',
      libSubReading:       'READING LOG',
      libSubCollection:    'PERSONAL COLLECTION',
      // Library — dynamic ADD button label per sub-tab
      libAddSeries:        '+ ADD SERIES',
      libAddFilm:          '+ ADD FILM',
      libAddBook:          '+ ADD BOOK',
      libAddItem:          '+ ADD ITEM',
      // Library — coming-soon placeholders
      libComingSoon:       'COMING SOON',
      libCsFilms:          'Film log subsystem reserved for future deployment.',
      libCsReading:        'Reading log subsystem reserved for future deployment.',
      libCsCollection:     'Personal collection subsystem reserved for future deployment.',
      // ── Films ──────────────────────────────────────────────────────────────
      filmFilterAll:        'ALL',
      filmFilterWatched:    'WATCHED',
      filmFilterWant:       'WANT TO WATCH',
      filmFilterRewatching: 'REWATCHING',
      filmStatusWatched:    'WATCHED',
      filmStatusWant:       'WANT',
      filmStatusRewatching: 'REWATCHING',
      filmSearchPH:         'SEARCH…',
      filmEmpty:            'NO FILMS LOGGED',
      filmNoMatch:          'NO MATCHING FILMS',
      filmYearNone:         'UNDATED',
      filmAddTitle:         'ADD FILM',
      filmEditTitle:        'EDIT FILM',
      filmFormTitleOrig:    'Original title',
      filmFormTitleOrigPH:  'Film title…',
      filmFormTitleZh:      'Chinese title',
      filmFormTitleZhPH:    'Chinese title (optional)…',
      filmFormGenre:        'Genre',
      filmFormWatchedDate:  'Watch date',
      filmFormCinemaNote:   'Cinema name (optional)',
      filmFormCinemaNotePH: 'e.g. Vie Show, Muvie',
      filmFormRating:       'Rating',
      filmBtnMarkWatched:   'MARK WATCHED',
      filmBtnEdit:          'EDIT',
      filmBtnLogRewatch:    'LOG REWATCH',
      filmMarkWatchedTitle: 'MARK AS WATCHED',
      filmRewatchTitle:     'LOG REWATCH',
      filmRewatchDate:      'Rewatch date',
      filmRewatchCount:     'Watched {n}×',
      filmRewatchCurrent:   'Rewatch count: {n}',
      filmMin:              'min',
      filmMenuEdit:         'EDIT',
      filmMenuDelete:       'DELETE',
      filmDeleteTitle:      'DELETE FILM',
      filmDeleteBody:       'Remove "{name}" from your film log?',
      // ── Reading ────────────────────────────────────────────────────────────
      bookFilterAll:        'ALL',
      bookFilterReading:    'READING',
      bookFilterWant:       'WANT TO READ',
      bookFilterCompleted:  'COMPLETED',
      bookFilterPaused:     'PAUSED',
      bookFilterDropped:    'DROPPED',
      bookStatusReading:    'READING',
      bookStatusWant:       'WANT',
      bookStatusCompleted:  'COMPLETED',
      bookStatusPaused:     'PAUSED',
      bookStatusDropped:    'DROPPED',
      bookSearchPH:         'SEARCH…',
      bookEmpty:            'NO BOOKS LOGGED',
      bookNoMatch:          'NO MATCHING BOOKS',
      bookYearNone:         'UNDATED',
      bookAddTitle:         'ADD BOOK',
      bookEditTitle:        'EDIT BOOK',
      bookFormTitle:        'Title',
      bookFormTitlePH:      'Book title…',
      bookFormTitleZhPH:    'Chinese title (optional)…',
      bookFormAuthor:       'Author',
      bookFormAuthorPH:     'Author name…',
      bookFormTranslator:   'Translator',
      bookFormTranslatorPH: 'Translator name (optional)…',
      bookFormEdition:      'Edition',
      bookFormPublisher:    'Publisher',
      bookFormPublisherPH: 'e.g. Penguin, 城邦…',
      bookFormEditionPH:    'e.g. 3rd',
      bookFormFormat:       'Format',
      bookFormSource:       'Source',
      bookFormSourcePH:     'e.g. Eslite, Amazon…',
      bookFormPrice:        'Price',
      bookFormPricePH:      'e.g. NT$420',
      bookFormStartDate:    'Start date',
      bookFormFinishDate:   'Finish date',
      bookBtnStartReading:  'START READING',
      bookBtnMarkCompleted: 'MARK COMPLETED',
      bookFinishTitle:      'MARK AS COMPLETED',
      bookFinishDate:       'Finish date',
      bookCardTranslator:   'Trans.',
      bookCardEdition:      'Ed.',
      bookStarted:          'Started:',
      bookFinished:         'Finished:',
      bookNotStarted:       'Not started',
      bookDeleteTitle:      'DELETE BOOK',
      bookDeleteBody:       'Remove "{name}" from your reading log?',
      // Library — general
      libLoading:     'LOADING…',
      libError:       'CONNECTION ERROR',
      libRetry:       'RETRY',
      libEmpty:       'NO SERIES LOGGED',
      libAdd:         '+ ADD SERIES',
      libSave:        'SAVE',
      libCancel:      'CLOSE',
      libClose:       'CLOSE',
      libDelete:      'DELETE',
      libConfirmDel:  'Delete this series?',
      libConfirmDelTitle: 'CONFIRM DELETION',
      libDeleteTitle:     'DELETE SERIES',
      libDeleteBody:      'Delete "{name}" and all its seasons & episodes?',
      libDelSeasonTitle:  'DELETE SEASON',
      libDelSeasonBody:   'Delete "{label}" and all its episode logs? Other seasons will not be touched.',
      libDelSeasonOnlyBody: 'This is the only season of "{name}". Deleting it will also remove the series itself.',
      libMenuEdit:        'EDIT INFO',
      libMenuAddSeason:   '+ ADD SEASON',
      libMenuDelSeason:   'DELETE SEASON',
      libMenuDelete:      'DELETE SERIES',
      // Library — language labels
      libLangChinese:     'Chinese',
      libLangEnglish:     'English',
      libLangJapanese:    'Japanese',
      libLangKorean:      'Korean',
      libLangFrench:      'French',
      libLangGerman:      'German',
      libLangSpanish:     'Spanish',
      libLangOther:       'Other',
      // Legacy keys (kept so old saved data still finds a label)
      libLangWestern:     'English',
      libLangJpKr:        'Japanese / Korean',
      // Library — filters
      libFilterAll:       'ALL',
      libSearchPH:        'SEARCH…',
      libGroupWantToWatch: 'WANT TO WATCH',
      // Month names (used by the month-group headers, e.g. "2026 · MAY")
      mon0:  'JANUARY',  mon1:  'FEBRUARY', mon2:  'MARCH',     mon3:  'APRIL',
      mon4:  'MAY',      mon5:  'JUNE',     mon6:  'JULY',      mon7:  'AUGUST',
      mon8:  'SEPTEMBER', mon9: 'OCTOBER',  mon10: 'NOVEMBER',  mon11: 'DECEMBER',
      libFilterWatching:  'WATCHING',
      libFilterPlanned:   'PLANNED',
      libFilterComplete:  'COMPLETE',
      libFilterPaused:    'PAUSED',
      libFilterDropped:   'DROPPED',
      // Library — card
      libEp:              'EP',
      libOf:              '/',
      libLastSeen:        'Last:',
      libNeverSeen:       'Not started',
      libBtnAdd:          'ADD',
      libBtnPlus1:        '+1',  /* legacy, retained */
      libBtnSetEp:        'SET EP',
      libBtnLog:          'LOG',
      libComplete:        'COMPLETE',
      // Library — forms
      libFormTitleOrig:   'Original title',
      libFormTitleOrigPH: 'Original-language title…',
      libFormTitleZh:     'Chinese title',
      libFormTitleZhPH:   'Chinese title (optional)…',
      libFormLanguage:    'Language',
      libFormPlatform:    'Platform',
      libFormYear:        'Year',
      libFormFirstSeason: '— SEASON 1 —',
      libFormSeasonN:     'SEASON {n}',
      libFormSeasonInfo:  '— SEASON INFO —',
      libFormSeasonNum:   'Season #',
      libOk:              'OK',
      libFormSeasonTitle: 'Season title',
      libFormSeasonTitlePH:'Season subtitle (optional)…',
      libFormTotalEp:     'Total episodes',
      libFormStatus:      'Status',
      libFormNote:        'Notes',
      // Legacy keys (kept for compatibility with any lingering refs)
      libFormTitle:       'Title',
      libFormTitlePH:     'Series title…',
      libFormNotePH:      'Optional note…',
      libFormEpPH:        'Episode number',
      // Library — log modal
      libLogTitle:        'VIEW LOG',
      libLogEmpty:        'No episodes logged yet',
      libLogAddManual:    '+ ADD ENTRY',
      libLogDate:         'Date',
      libLogEp:           'Episode',
      libLogNote:         'Note',
      libLogNotePH:       'Optional…',
      libLogSave:         'ADD',
      libLogDelEntry:     'Delete entry?',
      // Library — episode editor
      libEpAddTitle:      'NEW ENTRY',
      libEpEpisode:       'Episode #',
      libEpDate:          'Date watched',
      libEpTitle:         'Episode title',
      libEpTitlePH:       'Optional title…',
      libEpRating:        'Rating',
      libEpNote:          'Notes / thoughts',
      libEpNotePH:        'What did you think?',
      libEpDelTitle:      'DELETE ENTRY',
      libEpDelBody:       'Delete the log entry for episode {n}?',
      libRatingUnrated:   'Unrated',
      // Page subtitles & empty state messages
      workspaceSub: 'MISSION OPERATIONS',
      projectEmptyMsg: 'This station is reserved and ready. Tell Claude what you want to track here — projects, tasks, milestones, deadlines, or something else entirely.',
      // Project page
      projAllProjects:    'ALL PROJECTS',
      projAddProject:     '+ NEW PROJECT',
      projAddTask:        '+ ADD TASK',
      projAll:            'ALL',
      projStatusPENDING:  'PENDING',
      projStatusACTIVE:   'ACTIVE',
      projStatusCOMPLETE: 'COMPLETE',
      projStatusBLOCKED:  'BLOCKED',
      projSortBy:         'SORT:',
      projSortDue:        'DUE DATE',
      projSortPriority:   'PRIORITY',
      projSortCreated:    'CREATED',
      projColEmpty:       'NO TASKS',
      projEdit:           'EDIT',
      projReopen:         'REOPEN',
      projAddProject:     '+ PROJECT',
      projEditProject:    'EDIT PROJECT',
      projEditTask:       'EDIT TASK',
      projFieldTitle:     'TITLE',
      projFieldTitlePH:   'Task title…',
      projFieldProject:   'PROJECT',
      projFieldStatus:    'STATUS',
      projFieldPriority:  'PRIORITY',
      projFieldDue:       'DUE DATE',
      projFieldTags:      'TAGS',
      projFieldTagsPH:    'tag1, tag2, …',
      projFieldNotes:     'NOTES',
      projFieldNotesPH:   'Additional details…',
      projNoProject:      '(none)',
      projFieldProjectTitlePH: 'Project name…',
      projFieldColor:     'COLOR',
      projSaved:          'TASK SAVED',
      projUpdated:        'TASK UPDATED',
      projDeleted:        'DELETED',
      projSaveFailed:     'SAVE FAILED',
      projOffline:        'OFFLINE — SHOWING CACHED DATA',
      projConfirmDelete:  'Delete this task?',
      projConfirmDeleteTitle:     'DELETE TASK',
      projConfirmDeleteMsTitle:   'DELETE CHAPTER',
      projConfirmDeleteProjTitle: 'DELETE PROJECT',
      projConfirmDeleteProject: 'Delete project and its {n} tasks?',
      projConfirmDeleteProjectEmpty: 'Delete this project?',
      projPriority1: 'LOW',
      projPriority2: 'NORMAL',
      projPriority3: 'HIGH',
      projPriority4: 'CRITICAL',
      projMissionOps:    'MISSION OPS',
      projNoProjects:    'NO PROJECTS — TAP + TO BEGIN',
      projEmptyHint:     'Select a project from the sidebar, or create a new one.',
      projSelectMilestone: 'SELECT A CHAPTER FROM THE SIDEBAR',
      projAddMilestone:  '+ ADD SECTION',
      projEditMilestone: 'EDIT SECTION',
      projFieldMilestoneTitlePH: 'Section name…',
      projConfirmDeleteMs:      'Delete chapter and its {n} tasks?',
      projConfirmDeleteMsEmpty: 'Delete this chapter?',
      projConfirmDeleteProj:    'Delete project and its {n} chapters?',
      projConfirmDeleteProjEmpty: 'Delete this project?',
      projApplyTemplate:   'APPLY TEMPLATE',
      projTemplateHint:    'Select a template to create tasks for this chapter.',
      projApply:           'APPLY',
      projTasks:           'tasks',
      projTemplateApplied: 'TEMPLATE APPLIED',
      projStatus_TODO:        'TODO',
      projStatus_IN_PROGRESS: 'IN PROGRESS',
      projStatus_DONE:        'DONE',
      // Workspace subtabs
      workspaceSubProject:    'PROJECT TRACKER',
      workspaceSubAttendance: 'ATTENDANCE',
      wsTabProject:           'PROJECT',
      wsTabAttendance:        'ATTENDANCE',
      // Attendance
      attAddRecord:    '+ ADD RECORD',
      attLeaveAnnual:  'ANNUAL LEAVE',
      attLeaveComp:    'COMP LEAVE',
      attLeavePersonal:'PERSONAL LEAVE',
      attLeaveSick:    'SICK LEAVE',
      attOvertime:     'OVERTIME',
      attHoliday:      'HOLIDAY',
      attRecord:       'RECORD',
      attRecords:      'RECORDS',
      attUsed:         'USED',
      attQuota:        'QUOTA',
      attBalance:      'BALANCE',
      attRemaining:    'REMAINING',
      attNoRecords:    'NO RECORDS THIS MONTH',
      attAddTitle:     'ADD RECORD',
      attEditTitle:    'EDIT RECORD',
      attFieldDate:    'DATE',
      attFieldType:    'LEAVE TYPE',
      attFieldHours:   'HOURS',
      attFieldNotes:   'NOTES',
      attFieldNotesPH: 'Optional notes…',
      attSetQuota:     'SET QUOTA',
      attSetComp:      'SET COMP BALANCE',
      attSaved:        'RECORD SAVED',
      attUpdated:      'RECORD UPDATED',
      attDeleted:      'RECORD DELETED',
      attSaveFailed:   'SAVE FAILED',
      attOffline:      'OFFLINE — CACHED DATA',
      attConfirmDeleteTitle:'CONFIRM DELETE',
      attConfirmDelete:'Delete this record?',
      attHours:        'h',
      attTimeline:     'TIMELINE',
      attQuotaLabel:   'Annual Leave Quota',
      attCompLabel:    'Comp Leave Balance',
      financeSub:      'MARKET DATA · LIVE FEED',
      scoresSub:       'MLB · GAMES OF THE DAY',
      // Finance
      finTW:        'TW MARKET',
      finUS:        'US MARKET',
      finFund:      'FUND',
      finFx:        'FX RATES',
      finFootnote:  'Data via Google Sheets.',
      finError:     'DATA UNAVAILABLE',
      finOpenDetail:'Open ticker details',
      finTabWatchlist:'WATCHLIST',
      finTabAdd:'Add tab',
      finTabRename:'Rename tab',
      finTabMoveLeft:'Move tab left',
      finTabMoveRight:'Move tab right',
      finTabDelete:'Delete tab',
      finTabNamePrompt:'Name this finance tab',
      finTabRenamePrompt:'Rename this finance tab',
      finTabNewDefault:'NEW TAB',
      finTabDeleteTitle:'DELETE FINANCE TAB',
      finTabDeleteBody:'Delete the finance tab "{name}"?',
      finTabCannotDeleteWatchlist:'WATCHLIST is the primary finance feed and cannot be deleted.',
      finTabEmptyTitle:'MODULE RESERVED',
      finTabEmptyMsg:'Click the edit button to set up your portfolio for this tab.',
      finAddTab:'+ ADD TAB',
      finPortfolioEdit:   'Edit tab',
      finPortfolioTabName:'TAB NAME',
      finPortfolioHoldings:'HOLDINGS',
      finPortfolioShares: 'Shares',
      finPortfolioCost:   'Cost',
      finPortfolioCode:   'Ticker',
      finPortfolioCcy:    'CCY',
      finPortfolioPrice:  'Price',
      finPortfolioValue:  'Value',
      finPortfolioPnl:    'P&L',
      finPortfolioAlloc: 'ALLOC%',
      finPortfolioRet:    'Return',
      finPortfolioTotal:  'TOTAL',
      finPortfolioAlloc:  'ALLOCATION (TWD)',
      finPortfolioNoData: 'Set up holdings to see your portfolio.',
      finPortfolioNoPrices:'Price data unavailable — refresh Watchlist first.',
      finPortfolioSummary: 'SUMMARY',
      finPortfolioTwdVal:  'TWD HOLDINGS',
      finPortfolioUsdVal:  'USD HOLDINGS',
      finPortfolioTotalTwd:'TOTAL (TWD)',
      btnRefresh:   'REFRESH',
      loadingMsg:   'LOADING…',
      updatedAt:    'updated',
      // Scores
      orioles:        'BALTIMORE ORIOLES',
      scoresAll:      'ALL GAMES · TODAY',
      scoresFootnote: 'Data via ESPN.',
      scoresError:    'SCOREBOARD UNAVAILABLE',
      scoresNoGames:  'NO GAMES SCHEDULED TODAY',
      scoresNoOrioles:'ORIOLES HAVE NO GAME TODAY',
      scoreFinal:     'FINAL',
      scoreScheduled: 'SCHEDULED',
      pinToTop:       'Pin this game to the featured panel',
      openOnEspn:     'Open on ESPN',
      standingsTitle: 'STANDINGS',
      standingsError: 'STANDINGS UNAVAILABLE',
      standingsStrk:  'STRK',
      detWin:    'W',
      detLoss:   'L',
      detSave:   'SV',
      detRBI:    'RBI',
      detHR:     'HR',
      detVenue:  'VENUE',
      detProbable: 'PROBABLE',
      detailNoMatch:    'Could not match game to MLB database',
      detailNoData:     'Detail data not available yet',
      detailFetchFail:  'Detail fetch failed (CORS proxy down?)',
      // Header
      sys47: 'SYS 47',  // legacy, no longer rendered
      opsCenter: ':: OPERATIONS CENTER',
      shiftAlpha: 'ALPHA SHIFT',
      shiftBeta:  'BETA SHIFT',
      shiftGamma: 'GAMMA SHIFT',
      healthNominal: 'NOMINAL',
      healthWarning: 'WARNING',
      onlineLbl:  'ONLINE',
      offlineLbl: 'OFFLINE',
      // Sidebar
      navDocking: 'DOCKING',
      navTelemetry: 'TELEMETRY',
      navLog: 'LOG',
      navCompute: 'COMPUTE',
      navChrono: 'CHRONOMETER',
      navAlert: 'RED ALERT',
      navFullscreen: 'FULLSCREEN',
      navExitFs: 'EXIT FS',
      navTheme: 'THEME',
      // Info strip
      stardateLabel: 'DATE',
      localTimeLabel: 'LOCAL TIME',
      sectorTaipei: 'SECTOR 001 · TAIPEI',
      atmosphericLabel: 'ATMOSPHERIC',
      scanning: 'SCANNING…',
      uptimeLabel: 'UPTIME',
      sessionActive: 'SESSION ACTIVE',
      // Docking
      dockingTitle: 'DOCKING BAY ASSIGNMENTS · ACCESS PORTAL',
      bayAlpha: 'BAY ALPHA',     bayAlphaCode: 'DK-A · WORK',
      bayBeta:  'BAY BETA',      bayBetaCode:  'DK-B · COMMS',
      bayGamma: 'BAY GAMMA',     bayGammaCode: 'DK-G · MEDIA',
      bayDelta: 'BAY DELTA',     bayDeltaCode: 'DK-D · RESEARCH',
      linkGithub: 'GITHUB · CODE REPOSITORY',
      linkClaude: 'CLAUDE · LCARS COMPUTER',
      linkGmail: 'SUBSPACE MAIL · GMAIL',
      linkCalendar: 'STELLAR CARTOGRAPHY · CALENDAR',
      linkYoutube: 'HOLODECK FEED · YOUTUBE',
      linkSpotify: 'AUDIO ARCHIVE · SPOTIFY',
      linkWiki: 'MEMORY ALPHA · WIKIPEDIA',
      linkHN: 'FEDERATION NEWS · HN',
      linkAddNew: '+ ASSIGN NEW BERTH',
      // Log
      logTitle: 'PERSONAL LOG · DAILY ENTRY',
      logPlaceholder: "Captain's log, supplemental...",
      btnCommit: 'COMMIT',
      btnExport: 'EXPORT',
      btnClear:  'CLEAR',
      // Auxiliary
      auxTitle: 'AUXILIARY SYSTEMS',
      btnStart: 'START',
      btnPause: 'PAUSE',
      btnReset: 'RESET',
      btnCompute: 'COMPUTE',
      btnChrono:  'CHRONOMETER',
      btnHail:    'VOCAL HAIL',
      btnCounsel: "SHIP'S COUNSEL",
      // Notes
      notesTitle:    'NOTES',
      notesAdd:      '+ ADD',
      notesEmpty:    'NO ENTRIES · TAP +ADD',
      notesPlaceholder: 'Type a note…',
      notesDelete:   'DELETE',
      notesConfirmDel: 'Delete this note?',
      notesConfirmDelTitle: 'CONFIRM DELETION',
      notesConfirmYes: 'DELETE',
      notesConfirmNo:  'CLOSE',
      notesMoreTip:  'More actions',
      notesColorTip: 'Change color',
      notesReminderTip: 'Set reminder',
      notesReminderHead: 'REMIND ME AT',
      notesReminderSet:  'SET',
      notesReminderClear:'CLEAR',
      notesReminderDue:   '',          // SVG bell icon is injected by JS
      notesReminderFired: '✓ NOTIFIED',
      notesAlertTitle:    'REMINDER',
      notesAlertOk:       'ACKNOWLEDGE',
      notesNoText:        '(empty note)',
      // Dynamic strings (used in JS)
      logCommitted: 'LOG ENTRY COMMITTED',
      logSavedSession: 'LOG SAVED (SESSION ONLY)',
      confirmErase: 'Erase log entry?',
      confirmAlert: 'Engage Red Alert?',
      promptUrl: 'Enter URL',
      vocalOffline: 'Vocal subsystem offline.',
      vocalReport: 'All systems nominal. Date ',
      langLabel: 'CH',
      // Weather codes
      w0:'CLEAR SKIES', w1:'MOSTLY CLEAR', w2:'PARTLY CLOUDED', w3:'OVERCAST',
      w45:'FOG · CAUTION', w48:'FREEZING FOG',
      w51:'LIGHT DRIZZLE', w53:'DRIZZLE', w55:'HEAVY DRIZZLE',
      w61:'LIGHT RAIN', w63:'RAIN', w65:'HEAVY RAIN',
      w71:'LIGHT SNOW', w73:'SNOW', w75:'HEAVY SNOW',
      w80:'RAIN SHOWERS', w81:'STRONG SHOWERS', w82:'TORRENTIAL',
      w95:'THUNDERSTORM · ALERT', w96:'STORM W/ HAIL', w99:'SEVERE STORM',
      wUnk:'UNKNOWN PATTERN', wOff:'SENSORS OFFLINE'
    },
    zh: {
      // Sidebar groups
      grpStations: '工作站',
      grpTools:    '工具',
      // Tabs
      tabMain:    'MAIN · 主控',
      tabWorkspace: 'WORKSPACE · 工作區',
      tabFinance: 'FINANCE · 財務',
      tabScores:  'SCORES · 賽事',
      tabLibrary: 'LIBRARY · 收藏',
      // Header page titles (used by top header-bar; shorter than sidebar tabs)
      pageMain:    '主控',
      pageWorkspace: '工作區',
      pageFinance: '財務',
      pageScores:  '賽事',
      pageLibrary: '收藏',
      // Page subtitles & empty state messages
      mainSub:         '主控介面',
      workspaceSub: '任務作戰中心',
      projectEmptyMsg: '此工作站已備妥保留。告訴 Claude 你想在這裡追蹤什麼——專案、任務、里程碑、截止日,或其他完全不同的東西都可以。',
      // Project page
      projAllProjects:    '全部專案',
      projAddProject:     '+ 新專案',
      projAddTask:        '+ 新增任務',
      projAll:            '全部',
      projStatusPENDING:  '待處理',
      projStatusACTIVE:   '進行中',
      projStatusCOMPLETE: '已完成',
      projStatusBLOCKED:  '受阻',
      projSortBy:         '排序:',
      projSortDue:        '截止日',
      projSortPriority:   '優先級',
      projSortCreated:    '建立時間',
      projColEmpty:       '無任務',
      projEdit:           '編輯',
      projReopen:         '重開',
      projEditProject:    '編輯專案',
      projEditTask:       '編輯任務',
      projFieldTitle:     '標題',
      projFieldTitlePH:   '任務名稱…',
      projFieldProject:   '所屬專案',
      projFieldStatus:    '狀態',
      projFieldPriority:  '優先級',
      projFieldDue:       '截止日',
      projFieldTags:      '標籤',
      projFieldTagsPH:    '標籤1, 標籤2, …',
      projFieldNotes:     '備註',
      projFieldNotesPH:   '詳細内容…',
      projNoProject:      '(無)',
      projFieldProjectTitlePH: '專案名稱…',
      projFieldColor:     '顏色',
      projSaved:          '任務已儲存',
      projUpdated:        '任務已更新',
      projDeleted:        '已刪除',
      projSaveFailed:     '儲存失敗',
      projOffline:        '離線—顯示快取資料',
      projConfirmDelete:  '確認刪除此任務？',
      projConfirmDeleteTitle:     '刪除任務',
      projConfirmDeleteMsTitle:   '刪除章節',
      projConfirmDeleteProjTitle: '刪除專案',
      projConfirmDeleteProject: '刪除此專案及其 {n} 個任務？',
      projConfirmDeleteProjectEmpty: '確認刪除此專案？',
      projPriority1: '低',
      projPriority2: '普通',
      projPriority3: '高',
      projPriority4: '緊急',
      projMissionOps:    '任務作戰',
      projNoProjects:    '尚無專案 — 點 + 開始',
      projEmptyHint:     '從左側選擇專案，或建立新專案。',
      projSelectMilestone: '請從左側選擇章節',
      projAddMilestone:  '+ 新增章節',
      projEditMilestone: '編輯章節',
      projFieldMilestoneTitlePH: '章節名稱…',
      projConfirmDeleteMs:      '刪除章節及其 {n} 個任務？',
      projConfirmDeleteMsEmpty: '確認刪除此章節？',
      projConfirmDeleteProj:    '刪除專案及其 {n} 個章節？',
      projConfirmDeleteProjEmpty: '確認刪除此專案？',
      projApplyTemplate:   '套用範本',
      projTemplateHint:    '選擇範本，自動建立此章節的任務清單。',
      projApply:           '套用',
      projTasks:           '項任務',
      projTemplateApplied: '範本已套用',
      projStatus_TODO:        'TODO',
      projStatus_IN_PROGRESS: '進行中',
      projStatus_DONE:        '已完成',
      // Workspace subtabs
      workspaceSubProject:    '專案追蹤',
      workspaceSubAttendance: '考勤紀錄',
      wsTabProject:           '專案',
      wsTabAttendance:        '考勤',
      // Attendance
      attAddRecord:    '+ 新增紀錄',
      attLeaveAnnual:  '特休',
      attLeaveComp:    '補休',
      attLeavePersonal:'事假',
      attLeaveSick:    '病假',
      attOvertime:     '加班',
      attHoliday:      '假日',
      attRecord:       '筆',
      attRecords:      '筆',
      attUsed:         '已用',
      attQuota:        '配額',
      attBalance:      '餘額',
      attRemaining:    '剩餘',
      attNoRecords:    '本月無紀錄',
      attAddTitle:     '新增紀錄',
      attEditTitle:    '編輯紀錄',
      attFieldDate:    '日期',
      attFieldType:    '假別',
      attFieldHours:   '時數',
      attFieldNotes:   '備註',
      attFieldNotesPH: '備註（選填）…',
      attSetQuota:     '設定配額',
      attSetComp:      '調整補休餘額',
      attSaved:        '紀錄已儲存',
      attUpdated:      '紀錄已更新',
      attDeleted:      '紀錄已刪除',
      attSaveFailed:   '儲存失敗',
      attOffline:      '離線—顯示快取資料',
      attConfirmDeleteTitle:'確認刪除',
      attConfirmDelete:'確認刪除此筆紀錄？',
      attHours:        'h',
      attTimeline:     '時間軸',
      attQuotaLabel:   '特休配額',
      attCompLabel:    '補休餘額',
      financeSub:      '市場行情 · 即時資料',
      scoresSub:       'MLB · 今日賽事',
      librarySub:      '追劇紀錄',
      // Library — sub-tab labels
      libSubtabSeries:     '追劇',
      libSubtabFilms:      '電影',
      libSubtabReading:    '閱讀',
      libSubtabCollection: '藏書',
      // Library — dynamic page-subtitle per sub-tab
      libSubSeries:        '追劇紀錄',
      libSubFilms:         '電影紀錄',
      libSubReading:       '閱讀紀錄',
      libSubCollection:    '個人藏書',
      // Library — dynamic ADD button label per sub-tab
      libAddSeries:        '+ 新增劇集',
      libAddFilm:          '+ 新增電影',
      libAddBook:          '+ 新增書籍',
      libAddItem:          '+ 新增藏書',
      // Library — coming-soon placeholders
      libComingSoon:       '即將上線',
      libCsFilms:          '電影紀錄子系統,預留待後續部署。',
      libCsReading:        '閱讀紀錄子系統,預留待後續部署。',
      libCsCollection:     '個人藏書子系統,預留待後續部署。',
      // ── Films（電影）──────────────────────────────────────────────────────
      filmFilterAll:        '全部',
      filmFilterWatched:    '已看',
      filmFilterWant:       '想看',
      filmFilterRewatching: '重看中',
      filmStatusWatched:    '已看',
      filmStatusWant:       '想看',
      filmStatusRewatching: '重看中',
      filmSearchPH:         '搜尋…',
      filmEmpty:            '尚無電影紀錄',
      filmNoMatch:          '沒有符合的電影',
      filmYearNone:         '未標記日期',
      filmAddTitle:         '新增電影',
      filmEditTitle:        '編輯電影',
      filmFormTitleOrig:    '原始片名',
      filmFormTitleOrigPH:  '電影片名…',
      filmFormTitleZh:      '中文片名',
      filmFormTitleZhPH:    '中文片名（選填）…',
      filmFormGenre:        '類型',
      filmFormWatchedDate:  '觀看日期',
      filmFormCinemaNote:   '影廳名稱（選填）',
      filmFormCinemaNotePH: '如：威秀、國賓',
      filmFormRating:       '評分',
      filmBtnMarkWatched:   '標記已看',
      filmBtnEdit:          '編輯',
      filmBtnLogRewatch:    '紀錄重看',
      filmMarkWatchedTitle: '標記為已看',
      filmRewatchTitle:     '紀錄重看',
      filmRewatchDate:      '重看日期',
      filmRewatchCount:     '已看 {n} 次',
      filmRewatchCurrent:   '目前重看次數：{n}',
      filmMin:              '分鐘',
      filmMenuEdit:         '編輯',
      filmMenuDelete:       '刪除',
      filmDeleteTitle:      '刪除電影',
      filmDeleteBody:       '確定要從電影紀錄中移除「{name}」？',
      // ── Reading（閱讀）────────────────────────────────────────────────────
      bookFilterAll:        '全部',
      bookFilterReading:    '閱讀中',
      bookFilterWant:       '想讀',
      bookFilterCompleted:  '已完成',
      bookFilterPaused:     '暫停',
      bookFilterDropped:    '放棄',
      bookStatusReading:    '閱讀中',
      bookStatusWant:       '想讀',
      bookStatusCompleted:  '已完成',
      bookStatusPaused:     '暫停',
      bookStatusDropped:    '放棄',
      bookSearchPH:         '搜尋…',
      bookEmpty:            '尚無閱讀紀錄',
      bookNoMatch:          '沒有符合的書籍',
      bookYearNone:         '未標記日期',
      bookAddTitle:         '新增書籍',
      bookEditTitle:        '編輯書籍',
      bookFormTitle:        '書名',
      bookFormTitlePH:      '書名…',
      bookFormTitleZhPH:    '中文書名（選填）…',
      bookFormAuthor:       '作者',
      bookFormAuthorPH:     '作者姓名…',
      bookFormTranslator:   '譯者',
      bookFormTranslatorPH: '譯者姓名（選填）…',
      bookFormEdition:      '版次',
      bookFormPublisher:    '出版社',
      bookFormPublisherPH: '如：城邦、遠流…',
      bookFormEditionPH:    '例：第三版',
      bookFormFormat:       '形式',
      bookFormSource:       '來源',
      bookFormSourcePH:     '例：誠品、博客來…',
      bookFormPrice:        '價格',
      bookFormPricePH:      '例：NT$420',
      bookFormStartDate:    '開始日期',
      bookFormFinishDate:   '完成日期',
      bookBtnStartReading:  '開始閱讀',
      bookBtnMarkCompleted: '標記完成',
      bookFinishTitle:      '標記為已完成',
      bookFinishDate:       '完成日期',
      bookCardTranslator:   '譯',
      bookCardEdition:      '版次',
      bookStarted:          '開始：',
      bookFinished:         '完成：',
      bookNotStarted:       '尚未開始',
      bookDeleteTitle:      '刪除書籍',
      bookDeleteBody:       '確定要從閱讀紀錄中移除「{name}」？',
      // Library — general
      libLoading:     '載入中…',
      libError:       '連線錯誤',
      libRetry:       '重試',
      libEmpty:       '尚無追劇紀錄',
      libAdd:         '+ 新增',
      libSave:        '儲存',
      libCancel:      '關閉',
      libClose:       '關閉',
      libDelete:      '刪除',
      libConfirmDel:  '刪除這筆追劇紀錄？',
      libConfirmDelTitle: '確認刪除',
      libDeleteTitle:     '刪除劇集',
      libDeleteBody:      '刪除「{name}」及其所有季與每集紀錄?',
      libDelSeasonTitle:  '刪除此季',
      libDelSeasonBody:   '刪除「{label}」及這一季所有觀看紀錄?其他季不受影響。',
      libDelSeasonOnlyBody: '這是「{name}」唯一的一季。刪除後將連同整部劇一起移除。',
      libMenuEdit:        '編輯資訊',
      libMenuAddSeason:   '+ 新增此劇下一季',
      libMenuDelSeason:   '刪除此季',
      libMenuDelete:      '刪除整部劇',
      // Library — language labels
      libLangChinese:     '華語',
      libLangEnglish:     '英語',
      libLangJapanese:    '日語',
      libLangKorean:      '韓語',
      libLangFrench:      '法語',
      libLangGerman:      '德語',
      libLangSpanish:     '西語',
      libLangOther:       '其他',
      // Legacy keys (kept so old saved data still finds a label)
      libLangWestern:     '英語',
      libLangJpKr:        '日語 / 韓語',
      // Library — filters
      libFilterAll:       '全部',
      libSearchPH:        '搜尋劇名…',
      libGroupWantToWatch: '想看清單',
      // Month names (used by the month-group headers, e.g. "2026 · 五月")
      mon0:  '一月',  mon1:  '二月',  mon2:  '三月',  mon3:  '四月',
      mon4:  '五月',  mon5:  '六月',  mon6:  '七月',  mon7:  '八月',
      mon8:  '九月',  mon9:  '十月',  mon10: '十一月', mon11: '十二月',
      libFilterWatching:  '追劇中',
      libFilterPlanned:   '待看',
      libFilterComplete:  '看完',
      libFilterPaused:    '暫停',
      libFilterDropped:   '棄坑',
      // Library — card
      libEp:              'EP',
      libOf:              '/',
      libLastSeen:        '上次:',
      libNeverSeen:       '尚未開始',
      libBtnAdd:          '新增',
      libBtnPlus1:        '+1集',  /* legacy, retained */
      libBtnSetEp:        '設定集數',
      libBtnLog:          '日誌',
      libComplete:        '已看完',
      // Library — forms
      libFormTitleOrig:   '原文劇名',
      libFormTitleOrigPH: '輸入原文劇名…',
      libFormTitleZh:     '中文劇名',
      libFormTitleZhPH:   '中文劇名（選填)…',
      libFormLanguage:    '語言類別',
      libFormPlatform:    '平台',
      libFormYear:        '年份',
      libFormFirstSeason: '— 第 1 季 —',
      libFormSeasonN:     '第 {n} 季',
      libFormSeasonInfo:  '— 劇季資訊 —',
      libFormSeasonNum:   '季號',
      libOk:              '確定',
      libFormSeasonTitle: '季標題',
      libFormSeasonTitlePH:'季副標(選填)…',
      libFormTotalEp:     '本季總集數',
      libFormStatus:      '狀態',
      libFormNote:        '備註',
      // Legacy keys
      libFormTitle:       '劇名',
      libFormTitlePH:     '劇名…',
      libFormNotePH:      '備註(選填)…',
      libFormEpPH:        '集數',
      // Library — log modal
      libLogTitle:        '觀看日誌',
      libLogEmpty:        '本季尚無集數紀錄',
      libLogAddManual:    '+ 新增紀錄',
      libLogDate:         '日期',
      libLogEp:           '集數',
      libLogNote:         '備註',
      libLogNotePH:       '備註(選填)…',
      libLogSave:         '新增',
      libLogDelEntry:     '刪除此筆記錄?',
      // Library — episode editor
      libEpAddTitle:      '新增紀錄',
      libEpEpisode:       '集數',
      libEpDate:          '觀看日期',
      libEpTitle:         '集標題',
      libEpTitlePH:       '集標題(選填)…',
      libEpRating:        '評分',
      libEpNote:          '心得 / 劇情',
      libEpNotePH:        '寫下你的想法…',
      libEpDelTitle:      '刪除紀錄',
      libEpDelBody:       '刪除第 {n} 集的紀錄?',
      libRatingUnrated:   '尚未評分',
      // Finance
      finTW:        '台股',
      finUS:        '美股',
      finFund:      '基金',
      finFx:        '匯率',
      finFootnote:  '資料來源:Google Sheets。',
      finError:     '資料暫時無法取得',
      finOpenDetail:'查閱個股詳細資訊',
      finTabWatchlist:'WATCHLIST',
      finTabAdd:'新增標籤',
      finTabRename:'重新命名標籤',
      finTabMoveLeft:'向左移動標籤',
      finTabMoveRight:'向右移動標籤',
      finTabDelete:'刪除標籤',
      finTabNamePrompt:'命名這個財務標籤',
      finTabRenamePrompt:'重新命名這個財務標籤',
      finTabNewDefault:'新標籤',
      finTabDeleteTitle:'刪除財務標籤',
      finTabDeleteBody:'刪除財務標籤「{name}」?',
      finTabCannotDeleteWatchlist:'WATCHLIST 是主要財務資料頁，不能刪除。',
      finTabEmptyTitle:'模組預留',
      finTabEmptyMsg:'點選編輯按鈕，設定此標籤的持倉內容。',
      finAddTab:'+ 新增標籤',
      finPortfolioEdit:   '編輯標籤',
      finPortfolioTabName:'標籤名稱',
      finPortfolioHoldings:'持倉設定',
      finPortfolioShares: '持有股數',
      finPortfolioCost:   '購入本金',
      finPortfolioCode:   '代號',
      finPortfolioCcy:    '幣別',
      finPortfolioPrice:  '股價',
      finPortfolioValue:  '現值',
      finPortfolioPnl:    '損益',
      finPortfolioAlloc: 'ALLOC%',
      finPortfolioRet:    '報酬率',
      finPortfolioTotal:  '合計',
      finPortfolioAlloc:  '配置比例（台幣）',
      finPortfolioNoData: '請點選編輯按鈕設定持倉。',
      finPortfolioNoPrices:'股價資料不可用，請先在 WATCHLIST 重新整理。',
      finPortfolioSummary: '總覽',
      finPortfolioTwdVal:  '台股現值',
      finPortfolioUsdVal:  '美股現值',
      finPortfolioTotalTwd:'總資產（台幣）',
      btnRefresh:   '重新整理',
      loadingMsg:   '載入中…',
      updatedAt:    '更新於',
      // Scores
      orioles:        '巴爾的摩金鶯',
      scoresAll:      '所有比賽 · 今日',
      scoresFootnote: '資料來源:ESPN。',
      scoresError:    '記分板無法取得',
      scoresNoGames:  '今日無賽程',
      scoresNoOrioles:'金鶯今日無比賽',
      scoreFinal:     '結束',
      scoreScheduled: '預定',
      pinToTop:       '將此比賽置頂顯示',
      openOnEspn:     '在 ESPN 開啟',
      standingsTitle: '戰績排名',
      standingsError: '戰績資料無法取得',
      standingsStrk:  '連勝負',
      detWin:    '勝投',
      detLoss:   '敗投',
      detSave:   '救援',
      detRBI:    '勝利打點',
      detHR:     '全壘打',
      detVenue:  '球場',
      detProbable: '預定先發',
      detailNoMatch:    '無法對應到 MLB 資料庫',
      detailNoData:     '詳細資料尚未提供',
      detailFetchFail:  '詳細資料抓取失敗(CORS 代理離線?)',
      // Header
      sys47: '系統 47',  // legacy, no longer rendered
      opsCenter: ':: 作業指揮中心',
      shiftAlpha: '甲班勤務',
      shiftBeta:  '乙班勤務',
      shiftGamma: '丙班勤務',
      healthNominal: '系統正常',
      healthWarning: '警示',
      onlineLbl:  '已連線',
      offlineLbl: '離線',
      // Sidebar
      navDocking: '碼頭區',
      navTelemetry: '系統遙測',
      navLog: '航行日誌',
      navCompute: '運算終端',
      navChrono: '計時器',
      navAlert: '紅色警戒',
      navFullscreen: '全螢幕',
      navExitFs: '退出全螢幕',
      navTheme: '主題',
      // Info strip
      stardateLabel: '日期',
      localTimeLabel: '當地時間',
      sectorTaipei: '第 001 區段 · 臺北',
      atmosphericLabel: '大氣狀態',
      scanning: '掃描中…',
      uptimeLabel: '連線時長',
      sessionActive: '工作階段啟動中',
      // Docking
      dockingTitle: '碼頭泊位分配 · 入口傳輸',
      bayAlpha: '甲號泊區',  bayAlphaCode: 'DK-A · 工作',
      bayBeta:  '乙號泊區',  bayBetaCode:  'DK-B · 通訊',
      bayGamma: '丙號泊區',  bayGammaCode: 'DK-G · 媒體',
      bayDelta: '丁號泊區',  bayDeltaCode: 'DK-D · 研究',
      linkGithub: 'GITHUB · 程式碼庫',
      linkClaude: 'CLAUDE · LCARS 主電腦',
      linkGmail: '副空間信件 · GMAIL',
      linkCalendar: '星圖製圖 · 行事曆',
      linkYoutube: '全像甲板訊號 · YOUTUBE',
      linkSpotify: '音訊典藏 · SPOTIFY',
      linkWiki: '記憶體 ALPHA · 維基百科',
      linkHN: '聯邦新聞 · HN',
      linkAddNew: '+ 指派新泊位',
      // Log
      logTitle: '個人日誌 · 每日條目',
      logPlaceholder: '艦長日誌，補述...',
      btnCommit: '提交',
      btnExport: '匯出',
      btnClear:  '清除',
      // Auxiliary
      auxTitle: '輔助子系統',
      btnStart: '啟動',
      btnPause: '暫停',
      btnReset: '歸零',
      btnCompute: '運算',
      btnChrono:  '計時',
      btnHail:    '語音廣播',
      btnCounsel: '艦上箴言',
      // Notes
      notesTitle:    '便條',
      notesAdd:      '+ 新增',
      notesEmpty:    '尚無條目 · 點 +新增',
      notesPlaceholder: '輸入便條內容…',
      notesDelete:   '刪除',
      notesConfirmDel: '刪除這則便條？',
      notesConfirmDelTitle: '確認刪除',
      notesConfirmYes: '刪除',
      notesConfirmNo:  '關閉',
      notesMoreTip:  '更多操作',
      notesColorTip: '變更顏色',
      notesReminderTip: '設定提醒',
      notesReminderHead: '提醒時間',
      notesReminderSet:  '設定',
      notesReminderClear:'清除',
      notesReminderDue:   '',
      notesReminderFired: '✓ 已提醒',
      notesAlertTitle:    '提醒',
      notesAlertOk:       '確認',
      notesNoText:        '（空白便條）',
      // Dynamic strings
      logCommitted: '日誌條目已提交',
      logSavedSession: '日誌已儲存（僅本次）',
      confirmErase: '清除日誌條目？',
      confirmAlert: '啟動紅色警戒？',
      promptUrl: '輸入網址',
      vocalOffline: '語音子系統離線。',
      vocalReport: '全系統運作正常。日期 ',
      langLabel: 'EN',
      // Weather
      w0:'晴朗無雲', w1:'大致晴朗', w2:'局部多雲', w3:'陰',
      w45:'起霧 · 注意', w48:'凍霧',
      w51:'毛毛雨', w53:'小雨', w55:'大毛雨',
      w61:'微雨', w63:'下雨', w65:'大雨',
      w71:'小雪', w73:'雪', w75:'大雪',
      w80:'陣雨', w81:'強陣雨', w82:'豪雨',
      w95:'雷雨 · 警示', w96:'夾冰雹風暴', w99:'劇烈風暴',
      wUnk:'未知氣象', wOff:'氣象感測器離線'
    }
  };

  let currentLang = 'en';
  // Restore preference if available
  try {
    const saved = sessionStorage.getItem('lcars_lang');
    if (saved === 'zh' || saved === 'en') currentLang = saved;
  } catch(e) {}

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  }

  function applyLang() {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-Hant' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = t(key);
    });
    // Update lang toggle button to show the OTHER language
    const btn = document.getElementById('langToggle');
    if (btn) btn.textContent = t('langLabel');
    // Refresh weather text in current language
    if (lastWeatherCode !== null) {
      document.getElementById('weather-desc').textContent =
        t('w' + lastWeatherCode) || t('wUnk');
    }
    // Adjust font for Chinese — Antonio doesn't support CJK
    if (currentLang === 'zh') {
      document.body.style.fontFamily =
        '"Antonio", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
    } else {
      document.body.style.fontFamily = '"Antonio", "Helvetica Neue", sans-serif';
    }
    // Finance sub-tabs are rendered dynamically, so refresh their labels too.
    if (typeof renderFinanceTabs === 'function') renderFinanceTabs();
  }

  function toggleLang() {
    currentLang = currentLang === 'en' ? 'zh' : 'en';
    try { sessionStorage.setItem('lcars_lang', currentLang); } catch(e) {}
    applyLang();
    beep(720);
  }

  let lastWeatherCode = null;


  function pad(n) { return n.toString().padStart(2, '0'); }

  function updateClock() {
    const now = new Date();
    document.getElementById('localtime').textContent =
      pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

    // Main date — large display: YYYY.MM.DD (LCARS-style separator)
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    document.getElementById('stardate').textContent = y + '.' + m + '.' + d;

    // Sub line — weekday + month name, locale-aware
    const locale = currentLang === 'zh' ? 'zh-TW' : 'en-US';
    const weekday = now.toLocaleDateString(locale, { weekday: 'long' });
    document.getElementById('earthdate').textContent =
      currentLang === 'zh' ? weekday : weekday.toUpperCase();
  }

  /* ============================================================
     UPTIME
     ============================================================ */
  const sessionStart = Date.now();
  function updateUptime() {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    document.getElementById('uptime').textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  /* ============================================================
     WEATHER (Open-Meteo, no API key)
     ============================================================ */
  async function fetchWeather() {
    try {
      let lat = 25.0330, lon = 121.5654;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
      const res = await fetch(url);
      const data = await res.json();
      const temp = Math.round(data.current.temperature_2m);
      lastWeatherCode = data.current.weather_code;
      document.getElementById('weather-temp').textContent = temp + '°C';
      const key = 'w' + lastWeatherCode;
      document.getElementById('weather-desc').textContent = t(key) || t('wUnk');
    } catch (e) {
      document.getElementById('weather-desc').textContent = t('wOff');
    }
  }

  /* ============================================================
     CACHE HELPERS — sessionStorage-based.
     Pattern: render cached data instantly on page load, then trigger
     a background fetch. New data replaces cached on success.
     ============================================================ */
  function cacheGet(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function cacheSet(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* quota exceeded — silently ignore */ }
  }

  // Persistent cache (survives browser restart) — used for the slow MLB
  // enrichment data so the featured Orioles card shows instantly on every load.
  function persistGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function persistSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) {
      // If localStorage is full, fall back to sessionStorage
      try { sessionStorage.setItem(key, JSON.stringify(value)); } catch(e2) {}
    }
  }

  /* ============================================================
     THEME CYCLE — four LCARS-era palettes
     ============================================================ */
  const THEMES = [
    {
      // 0 — PICARD: deep navy + warm coral (Stargazer / bridge feel)
      name: 'PICARD',
      vars: {
        '--lcars-bg':     '#02050a',
        '--lcars-panel':  '#06101c',
        '--lcars-frame':  '#0a1828',
        '--lcars-text':   '#f5cf7a',
        '--lcars-orange': '#ff9966',
        '--lcars-rust':   '#cc6666',
        '--lcars-blue':   '#7a9bd6',
        '--lcars-violet': '#9977bb',
        '--lcars-gold':   '#d4a23a',
        '--lcars-cream':  '#e8d5a8',
        '--lcars-muted':  '#2a3548'
      }
    },
    {
      // 1 — PICARD-COOL: pure black + slate gray + coral accents
      // (Starfleet HQ / TheLCARS.com Picard Theme aesthetic)
      name: 'PICARD-COOL',
      vars: {
        '--lcars-bg':     '#000000',
        '--lcars-panel':  '#0a0a0a',
        '--lcars-frame':  '#3d4757',
        '--lcars-text':   '#a9b4c2',
        '--lcars-orange': '#e89878',     // coral accent (HELLO color)
        '--lcars-rust':   '#c47a5e',
        '--lcars-blue':   '#6b8caf',     // muted slate blue
        '--lcars-violet': '#7a7a9a',     // dusty cool violet
        '--lcars-gold':   '#9ba6b5',     // cool light slate
        '--lcars-cream':  '#d8dde5',     // off-white slate
        '--lcars-muted':  '#252b35'
      }
    },
    {
      // 2 — TNG classic: pure black + iconic bright orange/peach
      name: 'TNG',
      vars: {
        '--lcars-bg':     '#000000',
        '--lcars-panel':  '#000000',
        '--lcars-frame':  '#1a1a1a',
        '--lcars-text':   '#ff9c00',
        '--lcars-orange': '#ff9c00',
        '--lcars-rust':   '#cc6666',
        '--lcars-blue':   '#9999ff',
        '--lcars-violet': '#cc99cc',
        '--lcars-gold':   '#ffcc66',
        '--lcars-cream':  '#ffcc99',
        '--lcars-muted':  '#333333'
      }
    }
  ];

  let themeIdx = 1;   // default = PICARD-COOL
  // Restore saved theme
  try {
    const saved = parseInt(sessionStorage.getItem('lcars_theme'), 10);
    if (!isNaN(saved) && saved >= 0 && saved < THEMES.length) themeIdx = saved;
  } catch(e) {}

  function applyTheme(idx) {
    const theme = THEMES[idx];
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    // Brief flash on the button to show the new theme name
    const btn = document.querySelector('[data-theme-btn]');
    if (btn) {
      const labelSpan = btn.querySelector('[data-i18n]');
      if (labelSpan) {
        const original = t('navTheme');
        labelSpan.removeAttribute('data-i18n');
        labelSpan.textContent = theme.name;
        setTimeout(() => {
          labelSpan.setAttribute('data-i18n', 'navTheme');
          labelSpan.textContent = original;
        }, 1200);
      }
    }
  }

  function cycleTheme() {
    themeIdx = (themeIdx + 1) % THEMES.length;
    try { sessionStorage.setItem('lcars_theme', themeIdx); } catch(e) {}
    applyTheme(themeIdx);
    beep(540 + themeIdx * 80);
  }

  // Apply saved theme on load (after DOM is ready)
  applyTheme(themeIdx);

  /* ============================================================
     LCARS BEEP (tiny synthesized chirp)
     ============================================================ */
  let audioCtx;
  function beep(freq) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
  }

  // Beep on every nav button click
  document.querySelectorAll('.nav-btn, .bay-link, .tool-btn').forEach(el => {
    el.addEventListener('click', () => beep(540 + Math.random()*200));
  });


  /* ============================================================
     HEADER PILLS — functional status indicators
     ============================================================ */

  // SHIFT PILL — Starfleet three-shift schedule based on local time
  // Alpha 06–14, Beta 14–22, Gamma 22–06
  function refreshShiftPill() {
    const h = new Date().getHours();
    let key;
    if (h >= 6 && h < 14)       key = 'shiftAlpha';
    else if (h >= 14 && h < 22) key = 'shiftBeta';
    else                        key = 'shiftGamma';
    const pill = document.getElementById('shift-pill');
    if (!pill) return;
    pill.setAttribute('data-i18n', key);
    pill.textContent = t(key);
  }

  // ONLINE PILL — true network reachability indicator
  function refreshOnlinePill() {
    const pill = document.getElementById('online-pill');
    if (!pill) return;
    const online = navigator.onLine;
    const labelSpan = pill.querySelector('[data-i18n]');
    if (online) {
      pill.classList.remove('offline', 'blink');
      if (labelSpan) {
        labelSpan.setAttribute('data-i18n', 'onlineLbl');
        labelSpan.textContent = t('onlineLbl');
      }
    } else {
      pill.classList.add('offline', 'blink');
      if (labelSpan) {
        labelSpan.setAttribute('data-i18n', 'offlineLbl');
        labelSpan.textContent = t('offlineLbl');
      }
    }
  }

  function initHeaderPills() {
    refreshShiftPill();
    refreshOnlinePill();
    // Shift only changes at hour boundaries — once a minute is plenty
    setInterval(refreshShiftPill, 60000);
  }

  /* ============================================================
     NAVIGATION
     ============================================================ */
  /* ============================================================
     PAGE TABS — switch between MAIN / PROJECT / FINANCE
     ============================================================ */

  /* Per-page metadata used by the top header-bar (icon, title, subtitle).
     The ADD action is page-specific too: only LIBRARY uses it for now,
     and its handler is wired up later via setPageActionButton(). */
  const PAGE_META = {
    main:    { icon: '#i-ops',      title: 'pageMain',    sub: 'mainSub'    },
    project: { icon: '#i-missions', title: 'pageWorkspace', sub: 'workspaceSub' },
    finance: { icon: '#i-stocks',   title: 'pageFinance', sub: 'financeSub' },
    scores:  { icon: '#i-scores',   title: 'pageScores',  sub: 'scoresSub'  },
    library: { icon: '#i-library',  title: 'pageLibrary', sub: 'libSubSeries' /* overridden by sub-tab */ }
  };

  let currentPage = 'main';
  try {
    const saved = sessionStorage.getItem('lcars_page');
    // Validate saved value against current pages — drop stale ones
    if (['main','project','finance','scores','library'].includes(saved)) currentPage = saved;
  } catch(e) {}

  function switchPage(name) {
    document.querySelectorAll('.page').forEach(s => {
      s.hidden = (s.dataset.page !== name);
    });
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    currentPage = name;
    try { sessionStorage.setItem('lcars_page', name); } catch(e) {}
    beep(540 + (name.length * 30));
    // Scroll the main column to top whenever we change page
    const mainEl = document.querySelector('.main');
    if (mainEl) mainEl.scrollTop = 0;
    // Update top header to reflect this page (icon, title, subtitle)
    updatePageHeader();
    // Show REFRESH button only on pages that have refreshable data
    updateRefreshVisibility();
    // Update page-action button (ADD …) per page
    updatePageActionButton();
    // Lazy-load project data on first visit
    if (name === 'project') {
      if (typeof fetchProject === 'function' &&
          typeof projProjects !== 'undefined' && projProjects.length === 0 &&
          typeof projLoading !== 'undefined' && !projLoading) {
        fetchProject();
      }
      if (typeof fetchAttendance === 'function' &&
          typeof attLoading !== 'undefined' && !attLoading) {
        fetchAttendance();
      }
    }
  }

  /* Sync the top header-bar to the active page's metadata. */
  function updatePageHeader() {
    const meta = PAGE_META[currentPage];
    if (!meta) return;
    // Icon — swap the <use href="..."/> target
    const iconUse = document.querySelector('#pageIcon use');
    if (iconUse) iconUse.setAttribute('href', meta.icon);
    // Title
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
      titleEl.setAttribute('data-i18n', meta.title);
      titleEl.textContent = t(meta.title);
    }
    // Subtitle — for LIBRARY, defer to whichever sub-tab is active
    const subEl = document.getElementById('pageSubtitle');
    if (subEl) {
      let subKey = meta.sub;
      if (currentPage === 'library' && typeof LIB_SUBTABS !== 'undefined') {
        const cfg = LIB_SUBTABS[currentLibSubtab];
        if (cfg) subKey = cfg.sub;
      }
      subEl.setAttribute('data-i18n', subKey);
      subEl.textContent = t(subKey);
    }
  }

  /* The header REFRESH button is contextual — only visible on FINANCE / SCORES */
  const REFRESHABLE_PAGES = { finance: 'fetchStocks', scores: 'fetchScores', project: 'fetchProjectOrAttendance' };
  function fetchProjectOrAttendance() {
    if (currentWsSubtab === 'attendance' && typeof fetchAttendance === 'function') fetchAttendance();
    else if (typeof fetchProject === 'function') fetchProject();
  }
  window.fetchProjectOrAttendance = fetchProjectOrAttendance;

  function updateRefreshVisibility() {
    const btn = document.getElementById('refreshBtn');
    if (!btn) return;
    btn.hidden = !REFRESHABLE_PAGES[currentPage];
  }
  function refreshCurrentPage() {
    const fnName = REFRESHABLE_PAGES[currentPage];
    if (!fnName) return;
    const fn = window[fnName];
    if (typeof fn !== 'function') return;
    const btn = document.getElementById('refreshBtn');
    if (btn) {
      btn.classList.add('spinning');
      setTimeout(() => btn.classList.remove('spinning'), 800);
    }
    beep(720);
    fn();
  }
  // Expose for the inline onclick handler
  window.refreshCurrentPage = refreshCurrentPage;

  /* ----------------------------------------------------------------
     PAGE ACTION BUTTON — the contextual "+ ADD …" / etc. button
     in the top header. Currently used only by LIBRARY, but designed
     to be reusable: each page can register a label key + handler.
     ---------------------------------------------------------------- */
  // page-name → { labelKey, handler() } | null
  const PAGE_ACTIONS = {
    library: () => {
      // Library defers to its current sub-tab — re-use the existing
      // libraryAddBtnClick() which already dispatches per sub-tab.
      const cfg = (typeof LIB_SUBTABS !== 'undefined') && LIB_SUBTABS[currentLibSubtab];
      if (!cfg) return null;
      return { labelKey: cfg.add, handler: cfg.handler };
    }
  };

  function getPageAction() {
    const fn = PAGE_ACTIONS[currentPage];
    if (!fn) return null;
    return fn();
  }

  function updatePageActionButton() {
    const btn = document.getElementById('pageActionBtn');
    if (!btn) return;
    const action = getPageAction();
    if (!action || !action.handler) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.setAttribute('data-i18n', action.labelKey);
    btn.textContent = t(action.labelKey);
  }

  function pageActionBtnClick() {
    const action = getPageAction();
    if (action && action.handler) action.handler();
  }
  window.pageActionBtnClick = pageActionBtnClick;

  function initPages() {
    // Apply initial active tab
    switchPage(currentPage);
  }


  /* ============================================================
     NOTES (in-memory; persistent across reloads needs storage,
     but we use sessionStorage so it's safe)
     ============================================================ */
  const notes = document.getElementById('notes');
  // Try to restore — but only if available (some sandboxes block it)
  try {
    const saved = sessionStorage.getItem('lcars_log');
    if (saved) notes.value = saved;
  } catch(e) {}

  function saveNote() {
    try {
      sessionStorage.setItem('lcars_log', notes.value);
      flash('>>> ' + t('logCommitted') + ' <<<');
    } catch(e) {
      flash('>>> ' + t('logSavedSession') + ' <<<');
    }
    beep(880);
  }
  function exportNote() {
    const blob = new Blob([notes.value], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    a.download = `captains-log-${ts}.txt`;
    a.click();
    beep(880);
  }
  function clearNote() {
    if (confirm(t('confirmErase'))) { notes.value = ''; beep(220); }
  }

  function flash(msg) {
    const orig = notes.placeholder;
    notes.placeholder = msg;
    setTimeout(() => notes.placeholder = t('logPlaceholder'), 1500);
  }

  /* ============================================================
     TOOLS — Calculator + Timer
     ============================================================ */
  function showTool(name) {
    document.getElementById('tools-default').style.display = 'none';
    document.getElementById('calc-tool').classList.add('hidden');
    document.getElementById('timer-tool').classList.add('hidden');
    if (name === 'calc') document.getElementById('calc-tool').classList.remove('hidden');
    if (name === 'timer') document.getElementById('timer-tool').classList.remove('hidden');
    beep(550);
  }

  let calcExpr = '';
  function calcIn(v) {
    if (calcExpr === '0' || document.getElementById('calc-screen').value === 'ERROR') calcExpr = '';
    calcExpr += v;
    document.getElementById('calc-screen').value = calcExpr || '0';
  }
  function calcDel() {
    calcExpr = calcExpr.slice(0, -1);
    document.getElementById('calc-screen').value = calcExpr || '0';
  }
  function calcClr() {
    calcExpr = '';
    document.getElementById('calc-screen').value = '0';
  }
  function calcEq() {
    try {
      // Safer than eval: only allow digits & operators
      if (!/^[0-9+\-*/().\s]+$/.test(calcExpr)) throw 'bad';
      const result = Function('"use strict";return (' + calcExpr + ')')();
      document.getElementById('calc-screen').value = result;
      calcExpr = String(result);
    } catch(e) {
      document.getElementById('calc-screen').value = 'ERROR';
      calcExpr = '';
    }
  }

  // Timer
  let timerSec = 0, timerInt = null;
  function timerStart() {
    if (timerInt) return;
    timerInt = setInterval(() => {
      timerSec++;
      const h = Math.floor(timerSec/3600), m = Math.floor((timerSec%3600)/60), s = timerSec%60;
      document.getElementById('timer-screen').textContent = pad(h)+':'+pad(m)+':'+pad(s);
    }, 1000);
  }
  function timerPause() { clearInterval(timerInt); timerInt = null; }
  function timerReset() { timerPause(); timerSec = 0; document.getElementById('timer-screen').textContent = '00:00:00'; }

  /* ============================================================
     EXTRAS — voice, quotes, alert
     ============================================================ */
  function speakStatus() {
    if (!('speechSynthesis' in window)) return alert(t('vocalOffline'));
    const u = new SpeechSynthesisUtterance(t('vocalReport') + document.getElementById('stardate').textContent);
    u.lang = currentLang === 'zh' ? 'zh-TW' : 'en-US';
    u.rate = 0.9;
    speechSynthesis.speak(u);
    beep(700);
  }

  const quotes = {
    en: [
      "Make it so.  — Picard",
      "Logic is the beginning of wisdom, not the end.  — Spock",
      "There are four lights.  — Picard",
      "Resistance is futile.  — Borg",
      "I'm a doctor, not a magician.  — McCoy",
      "Tea. Earl Grey. Hot.  — Picard",
      "Live long and prosper.  — Spock",
      "It is possible to commit no mistakes and still lose.  — Picard",
      "Highly illogical.  — Spock",
      "The needs of the many outweigh the needs of the few.  — Spock"
    ],
    zh: [
      "就這麼辦。  — 畢凱",
      "邏輯是智慧的開端,而非終點。  — 史巴克",
      "那裡有四盞燈。  — 畢凱",
      "抵抗是徒勞的。  — 博格人",
      "我是醫生,不是魔術師。  — 麥考伊",
      "茶。伯爵茶。熱的。  — 畢凱",
      "生生不息,繁榮昌盛。  — 史巴克",
      "你可以毫無過錯,卻仍然失敗。  — 畢凱",
      "極不合邏輯。  — 史巴克",
      "多數人的需求重於少數人的需求。  — 史巴克"
    ]
  };
  function randomQuote() {
    const list = quotes[currentLang] || quotes.en;
    const q = list[Math.floor(Math.random()*list.length)];
    document.getElementById('quote-out').textContent = '◈  ' + q;
    beep(620);
  }

  /* ============================================================
     INIT
     ============================================================ */
  window.t = t;  // expose for inline handlers
  applyLang();   // apply language first so all labels are correct
  initFinanceTabs();  // finance sub-tabs are user-managed and persistent
  initPages();   // wire tabs and restore last viewed page
  initHeaderPills();  // shift + online pills
  updateClock();
  updateUptime();
  initNotes();
  initLibrary();
  // ── Workspace sub-tabs ───────────────────────────────────────────────────
  const WS_SUBTABS = {
    project:    { sub: 'workspaceSubProject'    },
    attendance: { sub: 'workspaceSubAttendance' },
  };

  let currentWsSubtab = 'project';
  try {
    const saved = sessionStorage.getItem('lcars_ws_subtab');
    if (saved && WS_SUBTABS[saved]) currentWsSubtab = saved;
  } catch(e) {}

  function setWsSubtab(name) {
    if (!WS_SUBTABS[name]) return;
    currentWsSubtab = name;
    try { sessionStorage.setItem('lcars_ws_subtab', name); } catch(e) {}
    document.querySelectorAll('.ws-subtab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-subtab') === name);
    });
    document.querySelectorAll('.ws-subtab-panel').forEach(p => {
      p.hidden = p.getAttribute('data-subtab-panel') !== name;
    });
    // Lazy-load attendance on first switch
    if (name === 'attendance' && typeof fetchAttendance === 'function'
        && typeof attLoading !== 'undefined' && !attLoading
        && attRecords.length === 0) {
      fetchAttendance();
    }
    if (currentPage === 'project' && typeof updatePageHeader === 'function') {
      updatePageHeader();
      updatePageActionButton();
    }
    beep(560);
  }
  window.setWsSubtab = setWsSubtab;

  if (typeof initProject === 'function') initProject();
  if (typeof initAttendance === 'function') initAttendance();
  fetchWeather();
  // If the user's last page was library, kick off the fetch immediately
  if (currentPage === 'library') fetchLibrary();
  // Same for project page
  if (currentPage === 'project' && typeof fetchProject === 'function') fetchProject();
  // Render cached data instantly (if any) so SCORES/FINANCE tabs are
  // never empty. Then quietly fetch fresh data in the background.
  const stocksFromCache = renderStocksFromCache();
  const scoresFromCache = renderScoresFromCache();
  fetchStocks();
  fetchScores();
  fetchStandings();

  setInterval(updateClock, 1000);
  setInterval(updateUptime, 1000);
  setInterval(fetchWeather, 600000);     // weather every 10 min
  // Stocks and scores are manual-refresh only — see REFRESH buttons in
  // the FINANCE and SCORES pages. They show cached data instantly on
  // page load, then update on user request.
