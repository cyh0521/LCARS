// js/weather.js — WEATHER · 大氣感測站
// 資料來源：Open-Meteo (open-meteo.com) — 免費、免 API key、CORS 友善

/* ============================================================
   WMO 天氣代碼
   ============================================================ */
const WMO = {
  0:  { zh:'晴朗',       emoji:'☀️'  },
  1:  { zh:'大致晴朗',   emoji:'🌤️' },
  2:  { zh:'局部多雲',   emoji:'⛅'  },
  3:  { zh:'陰天',       emoji:'☁️'  },
  45: { zh:'起霧',       emoji:'🌫️' },
  48: { zh:'霧凇',       emoji:'🌫️' },
  51: { zh:'毛毛雨',     emoji:'🌦️' },
  53: { zh:'毛毛雨',     emoji:'🌦️' },
  55: { zh:'大毛毛雨',   emoji:'🌦️' },
  61: { zh:'小雨',       emoji:'🌧️' },
  63: { zh:'中雨',       emoji:'🌧️' },
  65: { zh:'大雨',       emoji:'🌧️' },
  71: { zh:'小雪',       emoji:'🌨️' },
  73: { zh:'中雪',       emoji:'🌨️' },
  75: { zh:'大雪',       emoji:'🌨️' },
  77: { zh:'冰晶',       emoji:'🌨️' },
  80: { zh:'短暫陣雨',   emoji:'🌦️' },
  81: { zh:'陣雨',       emoji:'🌧️' },
  82: { zh:'強陣雨',     emoji:'🌧️' },
  85: { zh:'陣雪',       emoji:'🌨️' },
  86: { zh:'強陣雪',     emoji:'🌨️' },
  95: { zh:'雷雨',       emoji:'⛈️'  },
  96: { zh:'雷雨夾冰雹', emoji:'⛈️'  },
  99: { zh:'強雷雨',     emoji:'⛈️'  },
};
function wmoInfo(code) { return WMO[code] ?? { zh:'未知', emoji:'🌡️' }; }

/* ============================================================
   縣市 + 鄉鎮座標
   ============================================================ */
const CITY_COORDS = {
  '臺北市': { lat:25.0478, lon:121.5319, districts:{
    '中正區':{lat:25.0435,lon:121.5198},'大同區':{lat:25.0632,lon:121.5128},
    '中山區':{lat:25.0627,lon:121.5328},'松山區':{lat:25.0503,lon:121.5773},
    '大安區':{lat:25.0262,lon:121.5436},'萬華區':{lat:25.0336,lon:121.4995},
    '信義區':{lat:25.0330,lon:121.5654},'士林區':{lat:25.0931,lon:121.5232},
    '北投區':{lat:25.1318,lon:121.5003},'內湖區':{lat:25.0837,lon:121.5871},
    '南港區':{lat:25.0541,lon:121.6070},'文山區':{lat:24.9976,lon:121.5712},
  }},
  '新北市': { lat:25.0169, lon:121.4627, districts:{
    '板橋區':{lat:25.0127,lon:121.4652},'三重區':{lat:25.0640,lon:121.4867},
    '中和區':{lat:24.9970,lon:121.4947},'永和區':{lat:25.0126,lon:121.5169},
    '新莊區':{lat:25.0367,lon:121.4404},'新店區':{lat:24.9694,lon:121.5375},
    '樹林區':{lat:24.9884,lon:121.4115},'鶯歌區':{lat:24.9545,lon:121.3470},
    '三峽區':{lat:24.9328,lon:121.3713},'淡水區':{lat:25.1689,lon:121.4480},
    '汐止區':{lat:25.0669,lon:121.6610},'瑞芳區':{lat:25.1079,lon:121.8025},
    '土城區':{lat:24.9729,lon:121.4389},'蘆洲區':{lat:25.0860,lon:121.4763},
    '五股區':{lat:25.0784,lon:121.4358},'泰山區':{lat:25.0583,lon:121.4254},
    '林口區':{lat:25.0784,lon:121.3876},'深坑區':{lat:24.9931,lon:121.6139},
    '石碇區':{lat:24.9916,lon:121.6604},'坪林區':{lat:24.9327,lon:121.7094},
    '三芝區':{lat:25.2571,lon:121.5027},'石門區':{lat:25.2949,lon:121.5695},
    '八里區':{lat:25.1473,lon:121.3967},'平溪區':{lat:25.0233,lon:121.7382},
    '雙溪區':{lat:25.0344,lon:121.8686},'貢寮區':{lat:25.0285,lon:121.9133},
    '金山區':{lat:25.2241,lon:121.6377},'萬里區':{lat:25.1770,lon:121.6836},
    '烏來區':{lat:24.8680,lon:121.5513},
  }},
  '桃園市': { lat:24.9937, lon:121.3009, districts:{
    '桃園區':{lat:24.9937,lon:121.3009},'中壢區':{lat:24.9658,lon:121.2246},
    '大溪區':{lat:24.8831,lon:121.2886},'楊梅區':{lat:24.9132,lon:121.1421},
    '蘆竹區':{lat:25.0601,lon:121.3003},'大園區':{lat:25.0541,lon:121.2213},
    '龜山區':{lat:25.0356,lon:121.3480},'八德區':{lat:24.9459,lon:121.2841},
    '龍潭區':{lat:24.8627,lon:121.2227},'平鎮區':{lat:24.9432,lon:121.2163},
    '新屋區':{lat:24.9728,lon:121.0821},'觀音區':{lat:25.0228,lon:121.0954},
    '復興區':{lat:24.7913,lon:121.3564},
  }},
  '臺中市': { lat:24.1477, lon:120.6736, districts:{
    '中區':{lat:24.1378,lon:120.6849},'東區':{lat:24.1461,lon:120.7037},
    '南區':{lat:24.1188,lon:120.6801},'西區':{lat:24.1470,lon:120.6594},
    '北區':{lat:24.1591,lon:120.6849},'北屯區':{lat:24.1810,lon:120.7135},
    '西屯區':{lat:24.1613,lon:120.6208},'南屯區':{lat:24.1181,lon:120.6398},
    '太平區':{lat:24.1289,lon:120.7462},'大里區':{lat:24.1054,lon:120.6835},
    '霧峰區':{lat:24.0569,lon:120.7214},'烏日區':{lat:24.0879,lon:120.6511},
    '豐原區':{lat:24.2539,lon:120.7196},'后里區':{lat:24.3225,lon:120.7019},
    '石岡區':{lat:24.2783,lon:120.7731},'東勢區':{lat:24.2578,lon:120.8229},
    '和平區':{lat:24.3610,lon:121.0618},'新社區':{lat:24.2306,lon:120.8072},
    '潭子區':{lat:24.2152,lon:120.7284},'大雅區':{lat:24.2164,lon:120.6509},
    '神岡區':{lat:24.2527,lon:120.6550},'大肚區':{lat:24.1564,lon:120.5451},
    '沙鹿區':{lat:24.2022,lon:120.5631},'龍井區':{lat:24.1691,lon:120.5474},
    '梧棲區':{lat:24.2522,lon:120.5200},'清水區':{lat:24.2680,lon:120.5624},
    '大甲區':{lat:24.3493,lon:120.6217},'外埔區':{lat:24.3215,lon:120.6532},
    '大安區':{lat:24.3889,lon:120.6148},
  }},
  '臺南市': { lat:22.9999, lon:120.2269, districts:{
    '中西區':{lat:22.9913,lon:120.2024},'東區':{lat:22.9960,lon:120.2280},
    '南區':{lat:22.9686,lon:120.2011},'北區':{lat:23.0192,lon:120.2137},
    '安平區':{lat:23.0028,lon:120.1607},'安南區':{lat:23.0564,lon:120.1860},
    '永康區':{lat:23.0354,lon:120.2619},'歸仁區':{lat:22.9391,lon:120.2815},
    '新化區':{lat:23.0373,lon:120.3118},'左鎮區':{lat:23.0022,lon:120.3581},
    '玉井區':{lat:23.1228,lon:120.4538},'楠西區':{lat:23.1688,lon:120.4380},
    '南化區':{lat:23.0680,lon:120.4693},'仁德區':{lat:22.9389,lon:120.2225},
    '關廟區':{lat:22.9222,lon:120.3199},'龍崎區':{lat:22.9043,lon:120.3625},
    '官田區':{lat:23.1256,lon:120.2756},'麻豆區':{lat:23.1798,lon:120.2358},
    '佳里區':{lat:23.1670,lon:120.1716},'西港區':{lat:23.1220,lon:120.1771},
    '七股區':{lat:23.1344,lon:120.0951},'將軍區':{lat:23.1941,lon:120.1068},
    '學甲區':{lat:23.2283,lon:120.1650},'北門區':{lat:23.2631,lon:120.1102},
    '新營區':{lat:23.3025,lon:120.3098},'後壁區':{lat:23.3603,lon:120.3473},
    '白河區':{lat:23.3537,lon:120.4231},'東山區':{lat:23.2641,lon:120.4361},
    '六甲區':{lat:23.2151,lon:120.3332},'下營區':{lat:23.2332,lon:120.2584},
    '柳營區':{lat:23.2666,lon:120.3252},'鹽水區':{lat:23.3136,lon:120.2706},
    '善化區':{lat:23.1447,lon:120.2930},'大內區':{lat:23.0740,lon:120.3590},
    '山上區':{lat:23.0762,lon:120.2988},'新市區':{lat:23.0669,lon:120.2559},
    '安定區':{lat:23.0729,lon:120.2113},
  }},
  '高雄市': { lat:22.6273, lon:120.3014, districts:{
    '楠梓區':{lat:22.7346,lon:120.3269},'左營區':{lat:22.6917,lon:120.2951},
    '鼓山區':{lat:22.6570,lon:120.2918},'三民區':{lat:22.6472,lon:120.3050},
    '鹽埕區':{lat:22.6252,lon:120.2840},'前金區':{lat:22.6313,lon:120.2976},
    '苓雅區':{lat:22.6223,lon:120.3161},'前鎮區':{lat:22.5926,lon:120.3146},
    '旗津區':{lat:22.6100,lon:120.2753},'小港區':{lat:22.5639,lon:120.3418},
    '鳳山區':{lat:22.6263,lon:120.3571},'林園區':{lat:22.5030,lon:120.4007},
    '大寮區':{lat:22.5978,lon:120.4048},'大樹區':{lat:22.6853,lon:120.4305},
    '大社區':{lat:22.7309,lon:120.3568},'仁武區':{lat:22.7008,lon:120.3538},
    '鳥松區':{lat:22.6571,lon:120.3810},'岡山區':{lat:22.7967,lon:120.2932},
    '橋頭區':{lat:22.7509,lon:120.3113},'燕巢區':{lat:22.7874,lon:120.3734},
    '田寮區':{lat:22.8795,lon:120.3732},'阿蓮區':{lat:22.8763,lon:120.3096},
    '路竹區':{lat:22.8563,lon:120.2604},'湖內區':{lat:22.9036,lon:120.2072},
    '茄萣區':{lat:22.9161,lon:120.1812},'永安區':{lat:22.8378,lon:120.2332},
    '彌陀區':{lat:22.7848,lon:120.2477},'梓官區':{lat:22.7526,lon:120.2611},
    '旗山區':{lat:22.8876,lon:120.4821},'美濃區':{lat:22.8982,lon:120.5421},
    '六龜區':{lat:23.0017,lon:120.6316},'甲仙區':{lat:23.0836,lon:120.5839},
    '杉林區':{lat:23.0190,lon:120.5287},'內門區':{lat:22.9752,lon:120.4566},
    '茂林區':{lat:22.9220,lon:120.6669},'桃源區':{lat:23.1604,lon:120.7431},
    '那瑪夏區':{lat:23.2309,lon:120.6949},
  }},
  '基隆市': { lat:25.1276, lon:121.7392, districts:{
    '仁愛區':{lat:25.1286,lon:121.7412},'信義區':{lat:25.1367,lon:121.7550},
    '中正區':{lat:25.1205,lon:121.7472},'中山區':{lat:25.1335,lon:121.7310},
    '安樂區':{lat:25.1325,lon:121.7087},'暖暖區':{lat:25.1074,lon:121.7597},
    '七堵區':{lat:25.1008,lon:121.6878},
  }},
  '新竹市': { lat:24.8138, lon:120.9675, districts:{
    '東區':{lat:24.8099,lon:120.9873},'北區':{lat:24.8384,lon:120.9645},
    '香山區':{lat:24.7784,lon:120.9347},
  }},
  '嘉義市': { lat:23.4801, lon:120.4491, districts:{
    '東區':{lat:23.4820,lon:120.4583},'西區':{lat:23.4790,lon:120.4399},
  }},
  '新竹縣': { lat:24.8388, lon:121.0177, districts:{
    '竹北市':{lat:24.8427,lon:121.0153},'竹東鎮':{lat:24.7363,lon:121.0929},
    '新埔鎮':{lat:24.8338,lon:121.0731},'關西鎮':{lat:24.7939,lon:121.1713},
    '湖口鄉':{lat:24.9037,lon:121.0519},'新豐鄉':{lat:24.9331,lon:121.0166},
    '芎林鄉':{lat:24.7667,lon:121.0604},'橫山鄉':{lat:24.7316,lon:121.1250},
    '北埔鄉':{lat:24.6990,lon:121.0616},'寶山鄉':{lat:24.7644,lon:120.9966},
    '峨眉鄉':{lat:24.6879,lon:121.0173},'尖石鄉':{lat:24.6803,lon:121.2208},
    '五峰鄉':{lat:24.6408,lon:121.0850},
  }},
  '苗栗縣': { lat:24.5602, lon:120.8214, districts:{
    '苗栗市':{lat:24.5602,lon:120.8214},'頭份市':{lat:24.6905,lon:120.8771},
    '竹南鎮':{lat:24.6853,lon:120.8621},'後龍鎮':{lat:24.6235,lon:120.7872},
    '通霄鎮':{lat:24.4865,lon:120.6923},'苑裡鎮':{lat:24.4371,lon:120.6499},
    '造橋鄉':{lat:24.6255,lon:120.8428},'頭屋鄉':{lat:24.5883,lon:120.8697},
    '公館鄉':{lat:24.5131,lon:120.8361},'大湖鄉':{lat:24.4178,lon:120.8618},
    '泰安鄉':{lat:24.4172,lon:121.0117},'銅鑼鄉':{lat:24.4864,lon:120.7910},
    '三義鄉':{lat:24.3885,lon:120.7622},'西湖鄉':{lat:24.4658,lon:120.7434},
    '三灣鄉':{lat:24.6460,lon:120.9282},'南庄鄉':{lat:24.6042,lon:121.0143},
    '獅潭鄉':{lat:24.5501,lon:120.9463},'卓蘭鎮':{lat:24.3238,lon:120.8234},
  }},
  '彰化縣': { lat:24.0795, lon:120.5366, districts:{
    '彰化市':{lat:24.0795,lon:120.5366},'鹿港鎮':{lat:24.0480,lon:120.4342},
    '和美鎮':{lat:24.1117,lon:120.5050},'線西鄉':{lat:24.1467,lon:120.4705},
    '伸港鄉':{lat:24.1499,lon:120.4963},'福興鄉':{lat:23.9990,lon:120.4695},
    '秀水鄉':{lat:24.0498,lon:120.5283},'花壇鄉':{lat:24.0386,lon:120.5602},
    '芬園鄉':{lat:24.0066,lon:120.5842},'員林市':{lat:23.9582,lon:120.5742},
    '溪湖鎮':{lat:23.9636,lon:120.4725},'田中鎮':{lat:23.8736,lon:120.5758},
    '大村鄉':{lat:23.9870,lon:120.5546},'埔鹽鄉':{lat:24.0020,lon:120.4965},
    '埔心鄉':{lat:23.9643,lon:120.5411},'永靖鄉':{lat:23.9395,lon:120.5397},
    '社頭鄉':{lat:23.9157,lon:120.5764},'二水鄉':{lat:23.8244,lon:120.6124},
    '北斗鎮':{lat:23.8706,lon:120.5283},'二林鎮':{lat:23.9100,lon:120.3948},
    '田尾鄉':{lat:23.9020,lon:120.5193},'埤頭鄉':{lat:23.8844,lon:120.4891},
    '芳苑鄉':{lat:23.9577,lon:120.3584},'大城鄉':{lat:23.8584,lon:120.3695},
    '竹塘鄉':{lat:23.9158,lon:120.4510},'溪州鄉':{lat:23.8499,lon:120.5052},
  }},
  '南投縣': { lat:23.9122, lon:120.6834, districts:{
    '南投市':{lat:23.9122,lon:120.6834},'草屯鎮':{lat:23.9732,lon:120.7395},
    '竹山鎮':{lat:23.7581,lon:120.6629},'集集鎮':{lat:23.8285,lon:120.7845},
    '名間鄉':{lat:23.8731,lon:120.6843},'鹿谷鄉':{lat:23.7551,lon:120.7625},
    '中寮鄉':{lat:23.8792,lon:120.7547},'魚池鄉':{lat:23.8670,lon:120.9237},
    '國姓鄉':{lat:24.0394,lon:120.8622},'水里鄉':{lat:23.8138,lon:120.8462},
    '信義鄉':{lat:23.6884,lon:120.8535},'仁愛鄉':{lat:24.1046,lon:121.1497},
    '埔里鎮':{lat:23.9609,lon:120.9718},
  }},
  '雲林縣': { lat:23.7092, lon:120.5440, districts:{
    '斗六市':{lat:23.7092,lon:120.5440},'斗南鎮':{lat:23.6785,lon:120.4827},
    '虎尾鎮':{lat:23.7069,lon:120.4301},'西螺鎮':{lat:23.7993,lon:120.4640},
    '土庫鎮':{lat:23.6769,lon:120.3897},'北港鎮':{lat:23.5687,lon:120.3006},
    '古坑鄉':{lat:23.6380,lon:120.5900},'大埤鄉':{lat:23.6594,lon:120.4628},
    '莿桐鄉':{lat:23.7459,lon:120.5027},'林內鄉':{lat:23.7629,lon:120.5999},
    '二崙鄉':{lat:23.7769,lon:120.4249},'崙背鄉':{lat:23.7616,lon:120.3725},
    '麥寮鄉':{lat:23.7635,lon:120.2700},'東勢鄉':{lat:23.6910,lon:120.2806},
    '褒忠鄉':{lat:23.6873,lon:120.3342},'臺西鄉':{lat:23.6879,lon:120.2027},
    '元長鄉':{lat:23.6430,lon:120.3095},'四湖鄉':{lat:23.6480,lon:120.2269},
    '口湖鄉':{lat:23.5851,lon:120.1846},'水林鄉':{lat:23.5633,lon:120.2508},
  }},
  '嘉義縣': { lat:23.4801, lon:120.4491, districts:{
    '太保市':{lat:23.4518,lon:120.2555},'朴子市':{lat:23.4626,lon:120.2440},
    '布袋鎮':{lat:23.3763,lon:120.1731},'大林鎮':{lat:23.5949,lon:120.4774},
    '民雄鄉':{lat:23.5528,lon:120.4215},'溪口鄉':{lat:23.5778,lon:120.3693},
    '新港鄉':{lat:23.5508,lon:120.3469},'六腳鄉':{lat:23.4932,lon:120.3063},
    '東石鄉':{lat:23.4557,lon:120.1510},'義竹鄉':{lat:23.3966,lon:120.2590},
    '鹿草鄉':{lat:23.4462,lon:120.3243},'水上鄉':{lat:23.4115,lon:120.3048},
    '中埔鄉':{lat:23.4476,lon:120.4869},'竹崎鄉':{lat:23.5319,lon:120.5420},
    '梅山鄉':{lat:23.5723,lon:120.5541},'番路鄉':{lat:23.4924,lon:120.5434},
    '大埔鄉':{lat:23.2980,lon:120.5779},'阿里山鄉':{lat:23.5063,lon:120.8036},
  }},
  '屏東縣': { lat:22.6714, lon:120.4878, districts:{
    '屏東市':{lat:22.6714,lon:120.4878},'潮州鎮':{lat:22.5510,lon:120.5434},
    '東港鎮':{lat:22.4638,lon:120.4535},'恆春鎮':{lat:22.0033,lon:120.7452},
    '萬丹鄉':{lat:22.5987,lon:120.4842},'長治鄉':{lat:22.6877,lon:120.5268},
    '麟洛鄉':{lat:22.6556,lon:120.5217},'九如鄉':{lat:22.7237,lon:120.5058},
    '里港鄉':{lat:22.7582,lon:120.5150},'鹽埔鄉':{lat:22.7378,lon:120.5717},
    '高樹鄉':{lat:22.7905,lon:120.5840},'萬巒鄉':{lat:22.5983,lon:120.5422},
    '內埔鄉':{lat:22.6127,lon:120.5647},'竹田鄉':{lat:22.5746,lon:120.5200},
    '新埤鄉':{lat:22.5268,lon:120.5365},'枋寮鄉':{lat:22.3577,lon:120.6059},
    '新園鄉':{lat:22.5293,lon:120.4447},'崁頂鄉':{lat:22.5462,lon:120.4675},
    '林邊鄉':{lat:22.4308,lon:120.5122},'南州鄉':{lat:22.4943,lon:120.5074},
    '佳冬鄉':{lat:22.4229,lon:120.5534},'琉球鄉':{lat:22.3394,lon:120.3837},
    '車城鄉':{lat:22.0765,lon:120.6965},'滿州鄉':{lat:21.9870,lon:120.7474},
    '枋山鄉':{lat:22.2622,lon:120.6430},'三地門鄉':{lat:22.7336,lon:120.6461},
    '霧台鄉':{lat:22.6997,lon:120.7216},'瑪家鄉':{lat:22.6704,lon:120.6342},
    '泰武鄉':{lat:22.5835,lon:120.6389},'來義鄉':{lat:22.5102,lon:120.6491},
    '春日鄉':{lat:22.3488,lon:120.6534},'獅子鄉':{lat:22.2231,lon:120.6924},
    '牡丹鄉':{lat:22.1064,lon:120.7490},
  }},
  '宜蘭縣': { lat:24.7573, lon:121.7533, districts:{
    '宜蘭市':{lat:24.7573,lon:121.7533},'羅東鎮':{lat:24.6774,lon:121.7694},
    '蘇澳鎮':{lat:24.5974,lon:121.8527},'頭城鎮':{lat:24.8523,lon:121.8217},
    '礁溪鄉':{lat:24.8218,lon:121.7741},'壯圍鄉':{lat:24.7576,lon:121.8133},
    '員山鄉':{lat:24.7536,lon:121.6950},'冬山鄉':{lat:24.6559,lon:121.7869},
    '五結鄉':{lat:24.7042,lon:121.8016},'三星鄉':{lat:24.6671,lon:121.6497},
    '大同鄉':{lat:24.6248,lon:121.5537},'南澳鄉':{lat:24.4498,lon:121.7881},
  }},
  '花蓮縣': { lat:23.9871, lon:121.6015, districts:{
    '花蓮市':{lat:23.9871,lon:121.6015},'鳳林鎮':{lat:23.7468,lon:121.4636},
    '玉里鎮':{lat:23.3357,lon:121.3083},'新城鄉':{lat:24.1308,lon:121.6566},
    '吉安鄉':{lat:23.9659,lon:121.5836},'壽豐鄉':{lat:23.8648,lon:121.5322},
    '光復鄉':{lat:23.6592,lon:121.4189},'豐濱鄉':{lat:23.5695,lon:121.4774},
    '瑞穗鄉':{lat:23.5006,lon:121.3620},'富里鄉':{lat:23.1953,lon:121.2621},
    '秀林鄉':{lat:24.1452,lon:121.5050},'萬榮鄉':{lat:23.6998,lon:121.3720},
    '卓溪鄉':{lat:23.3963,lon:121.2231},
  }},
  '臺東縣': { lat:22.7583, lon:121.1444, districts:{
    '臺東市':{lat:22.7583,lon:121.1444},'成功鎮':{lat:23.1003,lon:121.3795},
    '關山鎮':{lat:23.0508,lon:121.1681},'卑南鄉':{lat:22.7166,lon:121.1078},
    '鹿野鄉':{lat:22.9165,lon:121.1584},'池上鄉':{lat:23.1098,lon:121.2185},
    '東河鄉':{lat:22.9517,lon:121.3068},'長濱鄉':{lat:23.3326,lon:121.4463},
    '太麻里鄉':{lat:22.6104,lon:121.0254},'大武鄉':{lat:22.3526,lon:120.9032},
    '綠島鄉':{lat:22.6694,lon:121.4932},'海端鄉':{lat:23.1057,lon:121.0594},
    '延平鄉':{lat:22.9074,lon:121.0649},'金峰鄉':{lat:22.5259,lon:120.9682},
    '達仁鄉':{lat:22.2829,lon:120.8803},'蘭嶼鄉':{lat:22.0478,lon:121.5495},
  }},
  '澎湖縣': { lat:23.5711, lon:119.5793, districts:{
    '馬公市':{lat:23.5658,lon:119.5673},'湖西鄉':{lat:23.6039,lon:119.6373},
    '白沙鄉':{lat:23.6733,lon:119.5956},'西嶼鄉':{lat:23.6198,lon:119.4850},
    '望安鄉':{lat:23.3629,lon:119.5044},'七美鄉':{lat:23.2122,lon:119.4171},
  }},
  '金門縣': { lat:24.4307, lon:118.3184, districts:{
    '金城鎮':{lat:24.4307,lon:118.3184},'金湖鎮':{lat:24.4493,lon:118.3767},
    '金沙鎮':{lat:24.4992,lon:118.4212},'金寧鄉':{lat:24.4615,lon:118.2922},
    '烈嶼鄉':{lat:24.4356,lon:118.2350},'烏坵鄉':{lat:24.9884,lon:119.4600},
  }},
  '連江縣': { lat:26.1600, lon:119.9390, districts:{
    '南竿鄉':{lat:26.1600,lon:119.9390},'北竿鄉':{lat:26.2274,lon:120.0047},
    '莒光鄉':{lat:25.9669,lon:120.0127},'東引鄉':{lat:26.3680,lon:120.4964},
  }},
};

/* ============================================================
   STATE
   ============================================================ */
const WX_CACHE_KEY = 'lcars_wx_om_v3';
const WX_CACHE_TTL = 10 * 60 * 1000;

let wxCity     = '新北市';
let wxDistrict = '板橋區';
let wxData     = null;
let wxLoading  = false;
let wxSunTimer = null;

try {
  const c = localStorage.getItem('lcars_wx_city');
  const d = localStorage.getItem('lcars_wx_district');
  if (c && CITY_COORDS[c]) wxCity = c;
  if (d) wxDistrict = d;
} catch(e) {}

/* ============================================================
   FETCH
   ============================================================ */
function wxGetCoords() {
  const city = CITY_COORDS[wxCity];
  if (!city) return { lat:25.01, lon:121.46 };
  // 永遠使用鄉鎮座標；若未選（理應不會發生）才 fallback 縣市
  if (wxDistrict && city.districts?.[wxDistrict]) return city.districts[wxDistrict];
  const first = Object.values(city.districts ?? {})[0];
  return first ?? { lat:city.lat, lon:city.lon };
}

async function fetchWeatherPage() {
  // If already loading, wait briefly and retry (handles rapid city switches)
  if (wxLoading) {
    wxLoading = false; // force reset
  }
  wxLoading = true;
  const loadEl = document.getElementById('wx-loading');
  const errEl  = document.getElementById('wx-error');
  if (loadEl) loadEl.hidden = false;
  if (errEl)  errEl.hidden  = true;

  const { lat, lon } = wxGetCoords();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,uv_index&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset&timezone=Asia%2FTaipei&forecast_days=7`;

  try {
    const res  = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    wxData = { city:wxCity, district:wxDistrict, data, ts:Date.now() };
    try { localStorage.setItem(WX_CACHE_KEY, JSON.stringify(wxData)); } catch(e) {}
    renderWeatherAll();
  } catch(err) {
    console.warn('[wx]', err);
    if (errEl) { errEl.hidden = false; errEl.textContent = '⚠ ' + err.message; }
  } finally {
    wxLoading = false;
    if (loadEl) loadEl.hidden = true;
  }
}

function wxLoadCache() {
  try {
    const raw = localStorage.getItem(WX_CACHE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || (Date.now() - d.ts) > WX_CACHE_TTL) return false;
    if (d.city !== wxCity || d.district !== wxDistrict) return false;
    wxData = d;
    return true;
  } catch(e) { return false; }
}

/* ============================================================
   RENDER
   ============================================================ */
function renderWeatherAll() {
  if (!wxData?.data) return;
  const { data } = wxData;

  // 同步選擇器
  const sel  = document.getElementById('wx-city-select');
  const dsel = document.getElementById('wx-district-select');
  if (sel)  sel.value  = wxCity;
  if (dsel) dsel.value = wxDistrict;

  // 更新時間戳
  const tsEl = document.getElementById('wx-timestamp');
  if (tsEl) tsEl.textContent = new Date(wxData.ts)
    .toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', hour12:false});

  renderCurrentCards(data.current);
  renderHourlyStrip(data.hourly);
  renderDailyForecast(data.daily);
  renderSunArc(data.daily);
}

/* ---- 頂部四格即時資料 ---- */
function renderCurrentCards(cur) {
  if (!cur) return;
  const info  = wmoInfo(cur.weather_code);
  const temp  = cur.temperature_2m?.toFixed(1) ?? '—';
  const feel  = cur.apparent_temperature?.toFixed(1) ?? '—';
  const humid = cur.relative_humidity_2m ?? '—';
  const pres  = cur.surface_pressure?.toFixed(0) ?? '—';
  const ws    = cur.wind_speed_10m?.toFixed(1) ?? '—';
  const wd    = degToDir(cur.wind_direction_10m);
  const uv    = cur.uv_index ?? null;
  const { uvLabel, uvCls } = uvInfo(uv);

  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const addCls = (id, c) => {
    const e = document.getElementById(id); if (!e) return;
    e.className = e.className.replace(/\buv-\S+/g,'').trim();
    if (c) e.classList.add(c);
  };

  set('wx-val-temp',    temp + '°C');
  set('wx-val-feel',    '體感 ' + feel + '°C');
  set('wx-val-icon',    info.emoji);
  set('wx-val-desc',    info.zh);
  set('wx-val-wind',    ws + ' m/s');
  set('wx-val-wd',      wd);
  set('wx-val-humid',   humid + '%');   // 只輸出一個 %，HTML 中不再重複
  set('wx-val-pres',    pres + ' hPa'); // 顯示在濕度卡的 sub
  set('wx-val-uv',      uv != null ? uv.toFixed(1) : '—');
  set('wx-val-uvlabel', uvLabel);
  addCls('wx-val-uv',      uvCls);
  addCls('wx-val-uvlabel', uvCls);

  // UV 卡片邊框
  const uvCard = document.getElementById('wx-card-uv');
  if (uvCard) {
    uvCard.style.borderColor = '';
    uvCard.className = 'info-card gold';
    if (uv != null) {
      if      (uv > 10) uvCard.style.borderColor = '#cc44cc';
      else if (uv > 7)  uvCard.style.borderColor = 'var(--lcars-rust)';
      else if (uv > 5)  uvCard.className = 'info-card amber';
    }
  }
}

/* ---- 逐小時 ---- */
function renderHourlyStrip(hourly) {
  const el = document.getElementById('wx-hourly');
  if (!el || !hourly) return;
  const now   = new Date();
  const times = hourly.time ?? [];
  let si = times.findIndex(t => new Date(t) >= now);
  if (si < 0) si = 0;
  el.innerHTML = times.slice(si, si + 13).map((t, i) => {
    const dt   = new Date(t);
    const info = wmoInfo(hourly.weather_code?.[si+i] ?? 0);
    const tmp  = hourly.temperature_2m?.[si+i];
    const pop  = hourly.precipitation_probability?.[si+i] ?? 0;
    const isNow = i === 0;
    return `<div class="wx-hr-card${isNow?' now':''}">
      <div class="wx-hr-time">${isNow?'現在':dt.getHours()+':00'}</div>
      <div class="wx-hr-icon">${info.emoji}</div>
      <div class="wx-hr-temp">${tmp?.toFixed(0)??'—'}°</div>
      <div class="wx-hr-pop">💧${pop}%</div>
    </div>`;
  }).join('');
}

/* ---- 七天預報（卡片磚塊版）---- */
function renderDailyForecast(daily) {
  const el = document.getElementById('wx-daily');
  if (!el || !daily) return;
  const today  = new Date().toDateString();
  const allHi  = (daily.temperature_2m_max ?? []).map(Number);
  const allLo  = (daily.temperature_2m_min ?? []).map(Number);
  const rMax   = Math.max(...allHi);
  const rMin   = Math.min(...allLo);
  const rSpan  = rMax - rMin || 1;

  el.innerHTML = (daily.time ?? []).map((ds, i) => {
    const d    = new Date(ds + 'T12:00');
    const info = wmoInfo(daily.weather_code?.[i] ?? 0);
    const hi   = allHi[i]?.toFixed(0) ?? '—';
    const lo   = allLo[i]?.toFixed(0) ?? '—';
    const pop  = daily.precipitation_probability_max?.[i] ?? 0;
    const uv   = daily.uv_index_max?.[i];
    const { uvLabel, uvCls } = uvInfo(uv);
    const isTd = d.toDateString() === today;
    const wd   = isTd ? '今天' : d.toLocaleDateString('zh-TW',{weekday:'short'});
    const md   = d.toLocaleDateString('zh-TW',{month:'numeric',day:'numeric'});
    // 溫度長條
    const bL   = ((allLo[i]-rMin)/rSpan*100).toFixed(1);
    const bW   = Math.max(((allHi[i]-allLo[i])/rSpan*100), 8).toFixed(1);

    return `<div class="wx-day-card${isTd?' today':''}">
      <div class="wx-dc-top">
        <div class="wx-dc-day${isTd?' today-wd':''}">${wd}</div>
        <div class="wx-dc-date">${md}</div>
      </div>
      <div class="wx-dc-icon">${info.emoji}</div>
      <div class="wx-dc-desc">${info.zh}</div>
      <div class="wx-dc-bar-wrap">
        <span class="wx-dc-bar-lo">${lo}°</span>
        <div class="wx-dc-bar-track">
          <div class="wx-dc-bar-fill" style="left:${bL}%;width:${bW}%"></div>
        </div>
        <span class="wx-dc-bar-hi">${hi}°</span>
      </div>
      <div class="wx-dc-pop">💧${pop}%</div>
      ${uv!=null?`<div class="wx-dc-uv ${uvCls}">${uvLabel}</div>`:''}
    </div>`;
  }).join('');
}

/* ---- 日出日落 Canvas ---- */
function renderSunArc(daily) {
  const canvas = document.getElementById('wx-sun-arc');
  if (!canvas || !daily) return;
  const sr = daily.sunrise?.[0], ss = daily.sunset?.[0];
  if (!sr || !ss) return;

  // DPR-aware：讓 canvas 實際像素 = CSS 尺寸 × devicePixelRatio，消除光暈
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.offsetWidth  || 200;
  const cssH = canvas.offsetHeight || 140;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);          // 之後所有座標用 CSS px 即可
  const W = cssW, H = cssH;     // 邏輯尺寸

  ctx.clearRect(0, 0, W, H);

  const now  = new Date();
  const srT  = new Date(sr), ssT = new Date(ss);
  const dayMin = (ssT - srT) / 60000;
  const nowMin = (now - srT) / 60000;
  const prog   = Math.max(0, Math.min(1, nowMin / dayMin));
  const isDay  = now >= srT && now <= ssT;

  const BOTTOM = H - 22;   // 地平線 y 座標
  const cx = W / 2;
  const cy = BOTTOM;
  const r  = W / 2 - 22;  // 縮小半徑，讓弧頂離頂端留更多空間

  // ── 未走過的軌道（細，低透明）
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0, false);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── 已走過的軌跡（漸層：藍→橙）
  if (isDay && prog > 0) {
    const endAngle = Math.PI * (1 + prog);
    const grad = ctx.createLinearGradient(cx - r, 0, cx + r * Math.cos(Math.PI - prog * Math.PI), 0);
    grad.addColorStop(0, 'rgba(100,160,255,0.5)');
    grad.addColorStop(1, 'rgba(255,160,60,0.8)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, endAngle, false);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ── 地平線
  ctx.beginPath();
  ctx.moveTo(cx - r - 10, cy);
  ctx.lineTo(cx + r + 10, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── 太陽位置
  const sx = cx + r * Math.cos(Math.PI - prog * Math.PI);
  const sy = cy - r * Math.sin(prog * Math.PI);
  const sunR = isDay ? 8 : 5;

  if (isDay) {
    // 光圈 — 薄環，不用模糊發光
    ctx.beginPath();
    ctx.arc(sx, sy, sunR + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,200,80,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 太陽本體
    ctx.beginPath();
    ctx.arc(sx, sy, sunR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc840';
    ctx.fill();
  } else {
    // 月亮
    ctx.beginPath();
    ctx.arc(sx, sy, sunR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180,195,230,0.7)';
    ctx.fill();
  }

  // ── 當前時間標籤：膠囊樣式，含秒數，弧頂往下 58px
  if (isDay) {
    const hhmm = now.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', hour12:false});
    const ss   = now.getSeconds().toString().padStart(2, '0');
    ctx.save();

    const lx     = Math.round(cx);
    const arcTop = BOTTOM - r;
    const ly     = Math.round(arcTop + 58);  // 弧頂往下 58px

    // 測量兩段文字寬度
    ctx.font = 'bold 14px Antonio, sans-serif';
    const twMain = Math.ceil(ctx.measureText(hhmm).width);
    ctx.font = 'bold 11px Antonio, sans-serif';
    const twSec  = Math.ceil(ctx.measureText(':' + ss).width);
    const totalW = twMain + twSec;

    const pad = 7, capsH = 20, capsR = 10;
    const capsX = lx - Math.ceil(totalW / 2) - pad;
    const capsY = ly - capsH;
    const capsW = totalW + pad * 2;

    // 膠囊背景
    ctx.fillStyle = 'rgba(6,16,28,0.88)';
    ctx.beginPath();
    ctx.roundRect(capsX, capsY, capsW, capsH, capsR);
    ctx.fill();

    // 膠囊邊框
    ctx.strokeStyle = 'rgba(255,200,80,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(capsX, capsY, capsW, capsH, capsR);
    ctx.stroke();

    // HH:MM（大）
    const textBaseY = ly - 3;
    ctx.font = 'bold 14px Antonio, sans-serif';
    ctx.fillStyle = '#ffd860';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(hhmm, lx - Math.ceil(totalW / 2), textBaseY);

    // :SS（小，較暗）
    ctx.font = 'bold 11px Antonio, sans-serif';
    ctx.fillStyle = 'rgba(255,210,80,0.6)';
    ctx.fillText(':' + ss, lx - Math.ceil(totalW / 2) + twMain, textBaseY);

    ctx.restore();
  }

  // ── 地平線下方：日出/日落 時間條
  const fmt = t => new Date(t).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', hour12:false});
  const LABEL_Y = Math.round(H - 5);
  ctx.save();
  ctx.font = 'bold 13px Antonio, sans-serif';

  // 日出
  ctx.fillStyle = '#7aaee8';
  ctx.textAlign = 'left';
  ctx.fillText(fmt(sr), 4, LABEL_Y);

  // 日落
  ctx.fillStyle = '#ff9966';
  ctx.textAlign = 'right';
  ctx.fillText(fmt(ss), W - 4, LABEL_Y);

  // 中間：日照時長
  const hrs = ((ssT - srT) / 3600000).toFixed(1);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'center';
  ctx.fillText(hrs + 'h', Math.round(cx), LABEL_Y);
  ctx.restore();
}

/* ============================================================
   UTILITY
   ============================================================ */
function degToDir(deg) {
  if (deg == null) return '—';
  const d=['北','北北東','東北','東北東','東','東南東','東南','南南東',
            '南','南南西','西南','西南西','西','西北西','西北','北北西'];
  return d[Math.round(deg/22.5)%16];
}
function uvInfo(n) {
  if (n==null||isNaN(n)) return {uvLabel:'—',    uvCls:''};
  if (n<=2)  return {uvLabel:'低量級', uvCls:'uv-low'};
  if (n<=5)  return {uvLabel:'中量級', uvCls:'uv-mid'};
  if (n<=7)  return {uvLabel:'高量級', uvCls:'uv-high'};
  if (n<=10) return {uvLabel:'過量級', uvCls:'uv-vhigh'};
  return           {uvLabel:'危險級', uvCls:'uv-extreme'};
}

/* ============================================================
   城市 / 鄉鎮選擇
   ============================================================ */
function wxChangeCity(val) {
  if (!CITY_COORDS[val]) return;
  wxCity = val;
  // 自動選第一個鄉鎮，禁止停留在縣市層級
  const firstDistrict = Object.keys(CITY_COORDS[val]?.districts ?? {})[0] ?? '';
  wxDistrict = firstDistrict;
  try { localStorage.setItem('lcars_wx_city', val);             } catch(e) {}
  try { localStorage.setItem('lcars_wx_district', wxDistrict);  } catch(e) {}
  try { localStorage.removeItem(WX_CACHE_KEY);                  } catch(e) {}
  wxData = null;
  wxPopulateDistricts();
  fetchWeatherPage();
  if (typeof beep==='function') beep(540);
}
function wxChangeDistrict(val) {
  wxDistrict = val;
  try { localStorage.setItem('lcars_wx_district', val); } catch(e) {}
  try { localStorage.removeItem(WX_CACHE_KEY);          } catch(e) {}
  wxData = null;
  fetchWeatherPage();
  if (typeof beep==='function') beep(520);
}
function wxPopulateDistricts() {
  const sel = document.getElementById('wx-district-select');
  if (!sel) return;
  const keys = Object.keys(CITY_COORDS[wxCity]?.districts ?? {});
  if (!keys.length) { sel.innerHTML='<option value="">—</option>'; sel.disabled=true; return; }
  // 若目前 wxDistrict 不在清單內，自動選第一個
  if (!wxDistrict || !keys.includes(wxDistrict)) {
    wxDistrict = keys[0];
    try { localStorage.setItem('lcars_wx_district', wxDistrict); } catch(e) {}
  }
  sel.disabled  = false;
  sel.innerHTML = keys.map(k=>`<option value="${k}"${k===wxDistrict?' selected':''}>${k}</option>`).join('');
}
window.wxChangeCity     = wxChangeCity;
window.wxChangeDistrict = wxChangeDistrict;

/* ============================================================
   INIT
   ============================================================ */
function initWeather() {
  const sel = document.getElementById('wx-city-select');
  if (sel && !sel.options.length) {
    sel.innerHTML = Object.keys(CITY_COORDS)
      .map(k=>`<option value="${k}"${k===wxCity?' selected':''}>${k}</option>`).join('');
  }
  wxPopulateDistricts();
  if (wxLoadCache()) renderWeatherAll();
  fetchWeatherPage();
  clearInterval(wxSunTimer);
  wxSunTimer = setInterval(()=>{ if (wxData?.data?.daily) renderSunArc(wxData.data.daily); }, 1000); // 每秒更新秒數
}
window.initWeather      = initWeather;
window.fetchWeatherPage = fetchWeatherPage;
