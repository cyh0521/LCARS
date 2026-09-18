# LCARS 專案接手紀錄

更新日期：2026-09-18。依現有原始碼進行靜態分析；尚未進行瀏覽器視覺驗證、遠端 API 連線測試或資料寫入測試。功能「已有實作」不代表已完成端到端驗收。

## 專案基線

- 開發規則以 AGENTS.md 為準：維持 UI 與操作流程、最小必要修改；不得自行提交、同步或切換 Git 分支。
- 分析起始 HEAD：3f98ea1（同步測試，新增一張影集海報）。起始工作目錄只有未追蹤的 AGENTS.md，應保留。
- 原先沒有 PROJECT_CONTEXT.md、HANDOFF.md、TODO.md。
- 原生 HTML/CSS/JavaScript 靜態單頁網站；沒有 package.json、框架、建置流程、測試套件或 Apps Script 後端原始碼。
- index.html 約 5,620 行，包含全部 CSS、SVG sprite、六個主頁面及腳本載入。js/ 有 11 個傳統腳本，並非 ES modules。
- images/posters/{series,films,books}/：以資料 ID 命名的封面與缺圖 fallback。_versions/：歷史 ZIP，不能當成目前執行程式或任意移除。

## 介面與模組

| 主區域 | 檔案 | 已有實作 |
| --- | --- | --- |
| MAIN | index.html、js/core.js | 日期、時鐘、台北天氣摘要、運行時間、分類捷徑、Captain's Log、計算機／計時器等工具 |
| WORKSPACE / PROJECT | js/project.js | Project → Milestone → Task 三層資料、看板、優先順序、期限、模板、可調整側欄寬度 |
| WORKSPACE / ATTENDANCE | js/attendance.js | 年度額度、特休／補休／事假／病假／加班／假日、時間軸、月份紀錄與表單 |
| FINANCE | js/finance.js | 股票／基金／匯率、自訂投資分頁、持倉、資產配置圖與 treemap |
| SCORES | js/scores.js | MLB 比分、金鶯隊預設焦點、指定焦點賽事、逐局資訊與排名、30 秒自動更新 |
| LIBRARY | js/library.js、js/films.js、js/reading.js | 影集／季／集觀看紀錄、電影與重看、閱讀進度、評分、搜尋與篩選 |
| OBSERVATORY | js/weather.js、js/space.js | 台灣縣市／行政區預報、日照資訊、NASA APOD、可拖曳縮放的行星軌道與 Voyager 顯示 |
| 全站便箋 | js/notes.js | 卡片、排序、配色、提醒；另提供共用 prompt、confirm、overlay |

LIBRARY 的 COLLECTION 是明確的 COMING SOON 佔位。MAIN 的新增捷徑也尚未完成保存流程：部分只有 href="#"，第一個只顯示原生 prompt。

## 設計語言與響應式

- 深色底、LCARS 彎肘框架、膠囊按鈕、分區色帶、SVG 圖示、掃描線與暈影；應沿用既有視覺語言。
- 桌面 .console 為 220px / 彈性主欄 / 200px 三欄，上方共用頁首；右欄便箋跨頁保留。
- 900px 以下主框架改為 header → sidebar → main → rightbar 單欄，導覽換行；其他元件另有 600、700、800、900px 斷點。
- 主色以 --lcars-* CSS 變數管理，現有三組主題 PICARD、PICARD-COOL、TNG；預設 PICARD-COOL。註解提到四組但與實際數量不符。
- 字體使用 Google Fonts Antonio、JetBrains Mono、Oxanium；中文有系統字體 fallback。
- core.js 的 I18N 與 data-i18n* 處理中英文；動態產生的字串需另外考慮重新渲染，部分內容仍直接使用中文。

## 執行流程與相依關係

index.html 底部載入順序：finance → scores → notes → library → films → reading → attendance → project → weather → space → astronomy-engine 2.1.19 CDN → core。

- core.js 是啟動與協調中心：語言、主題、頁面切換、頁首動作、快取、音效、計時器，以及各模組初始化／資料抓取。
- switchPage() 依 .page[data-page] 與 .tab-btn[data-tab] 切換 hidden／active；沒有 URL 路由。
- 次級分頁分別由 setWsSubtab()、setLibSubtab()、setObsSubtab()、setFinanceTab() 控制。
- 事件混用 HTML inline onclick、動態 onclick 與 addEventListener。函式、DOM ID 或 class 改名必須搜尋所有呼叫點。
- 所有腳本共用全域環境。業務檔案依賴 core 的 t()、beep()、cacheGet()/cacheSet()；執行時機與載入順序不能任意調換。
- scores.js 的 escapeHtml()/escapeAttr() 被媒體模組使用；notes.js 的 openOverlay()/closeOverlay()/lcarsPrompt()/lcarsConfirm() 被多個模組使用。
- project.js 再次宣告全域 closeOverlay()，加入淡出後轉呼叫 notes.js 保存的 window._overlayClose。這是現有相依關係，不能把任一版本當作無用重複函式直接刪除。
- attendance 使用 proj-modal-* 等樣式，影集／電影／閱讀共用 lib-* 樣式；修改單一模組也須檢查共用 CSS。
- 啟動時抓取金融、比分、排名與首頁天氣；部分頁面按造訪延遲抓取。比分計時器未依當前主頁停止。

## 資料與儲存

| 資料 | 來源／儲存 |
| --- | --- |
| 便箋 | localStorage，lcars_notes_v1；未見雲端同步 |
| Captain's Log | sessionStorage，lcars_log；可匯出 |
| 語言、主題、主頁、工作區／媒體子分頁 | sessionStorage，lcars_* |
| 專案、出勤 | 各自的 Google Apps Script endpoint；sessionStorage fallback 快取 |
| 影集、電影、書籍 | 共用 Google Apps Script endpoint，分表／action 存取；主要為記憶體快取 |
| 行情、基金、匯率 | Google Sheets Visualization JSONP；sessionStorage 快取 |
| 投資分頁、持倉 | localStorage 與另一個 Apps Script endpoint 同步 |
| 天氣 | Open-Meteo；詳細頁位置與快取使用 localStorage；首頁摘要固定台北座標 |
| MLB | ESPN scoreboard／standings endpoint；sessionStorage 等快取輔助函式 |
| 太空 | NASA APOD（DEMO_KEY、localStorage 快取）、JPL Horizons、Astronomy Engine；Voyager 有靜態 fallback |

Apps Script GET 讀取資料，POST 以 text/plain 傳 JSON，常用 action 指定操作。端點寫在前端檔案中；本 repository 沒有後端程式、表格結構文件或部署／權限設定，因此無法只靠前端確認伺服器驗證與真實資料狀態。

localStorage／sessionStorage 綁定瀏覽器與 origin，Dropbox 或 Git 同步檔案不會同步這些資料；變更啟動方式、hostname 或 port 時需注意。便箋是主要資料而非可隨意清除的快取。

## 優先待驗證事項

以下是靜態分析發現，本次未修改執行程式：

1. **專案初始化未接上**：initProject() 只有定義與 window 匯出，未找到呼叫。函式內的快取預載及 PAGE_ACTIONS.project 註冊未在啟動流程執行；需驗證頁首新增任務按鈕。
2. **工作區子分頁還原不完整**：讀取 lcars_ws_subtab 後未呼叫 setWsSubtab(currentWsSubtab)，HTML 預設仍顯示 PROJECT，狀態與畫面可能不一致。
3. **初始化有重複請求路徑**：initPages()/switchPage() 與 core.js 後續啟動區塊皆可抓取 project／weather；library 初始子分頁也可能與後續 fetchLibrary() 重疊。需以 Network 驗證重複與回應競爭。
4. **共用彈窗生命週期**：同名 closeOverlay()、全域 ESC 處理、各表單自己的 keydown 與 Promise resolve 同時存在。需驗證 ESC、取消、巢狀彈窗、重複關閉與 scroll-lock 計數。
5. **金融同步可靠性**：syncToSheet() 先保存本機再 POST 完整 tabs／holdings，錯誤主要 console.warn；未見版本衝突控制。跨裝置同時編輯與離線保存狀態需要專項驗證。
6. **語言切換**：applyLang() 更新 DOM 標記並重繪金融分頁，但沒有統一重新渲染所有動態模組，需檢查已載入卡片及表單。
7. **資源與註解落差**：index.html 引用的 favicon.ico 不在目錄；靜態 HTML 有重複 i-log ID。core 結尾稱比分手動更新，但 scores.js 已實作 30 秒自動更新。
8. **Voyager 解析**：fetchVoyager() 以整份 result 的第一個小數當成 AU，沒有定位星曆資料欄；距離正確性需用實際 response 驗證，不應先視為可靠即時值。

## 後續工作方式與驗收

- 第一階段先確認目前實際使用入口、Apps Script 原始碼／資料表契約與部署位置，再重現上述初始化問題。
- 沿用現有架構逐項修補，不因檔案較大就搬遷框架或整批拆分 CSS。
- 涉及資料異動時同步檢查讀取、正規化、寫入、快取與 UI 更新；保留既有 ID 和狀態值。
- 桌面及手機驗證六主頁、所有子分頁、重新整理後還原、三主題、中英文、長文字與缺圖。
- 共用 UI 修改驗證：表單開關、ESC／取消／儲存、捲動鎖定、焦點、觸控操作。
- 資料流程驗證：載入／空資料／API 失敗／離線快取、異動後重新載入；寫入測試優先使用可辨識的測試資料與對應環境。
- 本次 11 個 js/*.js 均通過 node --check；靜態 HTML ID 檢查發現 i-log 重複。語法檢查不代表執行與遠端串接正常。
- 本次只新增此接手文件，未修改網站程式、瀏覽器資料或遠端資料，未執行 commit／push／pull。
