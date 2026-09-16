LCARS 圖片資料夾說明
====================

images/
├── posters/
│   ├── series/   影集封面  → 檔名用 series_id，例如 3.jpg
│   ├── films/    電影封面  → 檔名用 film_id，例如 7.jpg
│   └── books/    書籍封面  → 檔名用 book_id，例如 12.jpg
└── README.txt

命名規則
--------
- 檔名 = 對應資料的 ID（從 Google Sheets 的 id 欄位取得）
- 副檔名支援 .jpg / .jpeg / .png / .webp
- 建議尺寸：寬 300px，高 450px（2:3 比例）
- 若無圖片，卡片會自動顯示佔位符圖示

更新方式
--------
將圖片放入對應資料夾後，重新整理網頁即可自動顯示。
