(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    activeView: "home",
    selectedDay: TRIP_DATA.days[0].id,
    weather: [],
    weatherLoading: false,
    weatherLoaded: false,
    remindersOn: localStorage.getItem("macau-reminders-on") === "true",
    clockTimer: null,
    toastTimer: null
  };

  let deferredInstallPrompt = null;

  const ICONS = {
    reminder: "🔔",
    flight: "✈️",
    transport: "🚕",
    checkin: "🏨",
    meal: "🍽️",
    sightseeing: "📍",
    health: "🩺",
    dorm: "🛏️",
    school: "🎓"
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    initHashNavigation();
    bindNavigation();
    bindHeader();
    renderFamily();
    renderHome();
    renderItinerary();
    renderWeather();
    renderReminders();
    loadWeather();
    startClock();
    registerServiceWorker();
    initInstallPrompt();
    if (state.remindersOn) {
      requestNotificationPermission().then(scheduleNotifications);
    }
  }

  function bindNavigation() {
    $$(".nav-item").forEach((button) => {
      button.addEventListener("click", () => {
        const view = button.dataset.view;
        setView(view);
      });
    });
  }

  function initHashNavigation() {
    const viewFromHash = getViewFromHash();
    if (viewFromHash) {
      setView(viewFromHash, false);
    }
    window.addEventListener("hashchange", () => {
      const view = getViewFromHash();
      if (view) setView(view, false);
    });
  }

  function getViewFromHash() {
    const value = (window.location.hash || "").replace("#", "");
    return ["home", "itinerary", "weather", "family", "reminders"].includes(value) ? value : null;
  }

  function bindHeader() {
    $("#header-voice").addEventListener("click", speakToday);
  }

  function setView(view, updateHash = true) {
    if (!["home", "itinerary", "weather", "family", "reminders"].includes(view)) return;
    state.activeView = view;
    $$(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    $$(".view").forEach((section) => {
      section.classList.toggle("active", section.id === `${view}-view`);
    });

    if (view === "home") renderHome();
    if (view === "itinerary") renderItinerary();
    if (view === "weather") renderWeather();
    if (view === "family") renderFamily();
    if (view === "reminders") renderReminders();
    if (updateHash && window.location.hash !== `#${view}`) {
      history.replaceState(null, "", `#${view}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderHome() {
    const root = $("#home-view");
    if (!root) return;

    const next = getNextKeyEvent();
    const weatherDays = getWeatherForDays().slice(0, 3);
    const closestDay = getClosestDay();
    const weather = weatherForDate(closestDay.date);

    root.innerHTML = `
      <section class="hero-card">
        <div class="hero-family">
          <img src="${TRIP_DATA.family[0].avatar}" alt="${TRIP_DATA.family[0].nickname}">
          <img src="${TRIP_DATA.family[2].avatar}" alt="${TRIP_DATA.family[2].nickname}">
          <img src="${TRIP_DATA.family[1].avatar}" alt="${TRIP_DATA.family[1].nickname}">
        </div>
        <h2 class="hero-title">${TRIP_DATA.title}</h2>
        <p class="hero-subtitle">${TRIP_DATA.subtitle}</p>
        <div class="pill-row">
          <span class="pill">🗓️ ${TRIP_DATA.dateRange}</span>
          <span class="pill">🎓 澳门城市大学 2026/2027 设计学研究生</span>
          <span class="pill">☔ 八月湿热 · 记得带伞</span>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <p class="section-kicker">Next up</p>
            <h2 class="section-title">下一个重要节点</h2>
          </div>
          <button class="text-button" data-go="reminders">全部提醒 →</button>
        </div>
        ${next ? `
        <div class="card countdown-card">
          <div class="countdown-badge">${ICONS[next.type] || "⏰"}</div>
          <div>
            <p class="countdown-label">${next.date} ${next.time}</p>
            <h3 class="countdown-title">${next.title}</h3>
            <p class="countdown-time" id="countdown-time">${formatCountdown(next.timestamp - Date.now())}</p>
          </div>
        </div>` : `
        <div class="card">行程已结束，愿小鹿在新旅程里闪闪发光。</div>`}
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <p class="section-kicker">Weather</p>
            <h2 class="section-title">行程天气速览</h2>
          </div>
          <button class="text-button" data-go="weather">完整天气 →</button>
        </div>
        <div class="weather-strip">
          ${weatherDays.map((day) => `
            <div class="weather-mini">
              <div class="day">${shortDate(day.date)}</div>
              <div class="icon">${day.icon}</div>
              <div class="temp">${day.max}° / ${day.min}°</div>
              <div class="rain">💧 ${day.precip}%</div>
            </div>`).join("")}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <p class="section-kicker">Today's vibe</p>
            <h2 class="section-title">${closestDay.dayLabel} · ${closestDay.title}</h2>
          </div>
          <button class="text-button" data-go="itinerary">看行程 →</button>
        </div>
        <div class="card">
          <p style="margin:0;color:var(--muted);font-size:14px;">${closestDay.summary}</p>
          <p style="margin:12px 0 0;font-size:12px;color:var(--teal);">${weather ? `${weather.icon} ${weather.text}，${weather.max}°/${weather.min}°，降水概率 ${weather.precip}%` : "天气加载中…"}</p>
        </div>
      </section>

      <section class="section">
        <div class="mini-actions">
          <button class="mini-action" data-action="speak-weather"><span>🔊</span><span>播报天气</span></button>
          <button class="mini-action" data-action="speak-today"><span>🗺️</span><span>播报今日行程</span></button>
          <button class="mini-action" data-action="calendar"><span>📅</span><span>导入日历</span></button>
        </div>
      </section>
    `;

    bindDelegatedButtons(root);
  }

  function bindDelegatedButtons(root) {
    $$("[data-go]", root).forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.go));
    });

    $$("[data-action]", root).forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        if (action === "speak-weather") speakWeather();
        if (action === "speak-today") speakToday();
        if (action === "calendar") downloadCalendar();
      });
    });
  }

  function renderItinerary() {
    const root = $("#itinerary-view");
    if (!root) return;

    const chips = TRIP_DATA.days.map((day) => `
      <button class="day-chip ${day.id === state.selectedDay ? "active" : ""}" data-day="${day.id}">
        ${day.dayLabel} · ${shortDate(day.date)}
      </button>`).join("");

    root.innerHTML = `
      <div class="section-head">
        <div>
          <p class="section-kicker">Itinerary</p>
          <h2 class="section-title">六日行程</h2>
        </div>
        <button class="text-button" data-speak-day="${state.selectedDay}">🔊 播报本日</button>
      </div>
      <div class="chips-scroll">${chips}</div>
      <div id="day-panel" class="day-panel">${renderDay(state.selectedDay)}</div>
    `;

    $$(".day-chip", root).forEach((chip) => {
      chip.addEventListener("click", () => {
        state.selectedDay = chip.dataset.day;
        renderItinerary();
      });
    });

    $$("[data-speak-day]", root).forEach((button) => {
      button.addEventListener("click", () => speakDay(state.selectedDay));
    });
  }

  function renderDay(dayId) {
    const day = TRIP_DATA.days.find((item) => item.id === dayId);
    if (!day) return "";

    const events = day.events.map((event) => `
      <div class="event" data-type="${event.type}">
        <div class="event-card">
          <div class="event-top">
            <span class="event-time">${event.time}</span>
            <div>
              <h3 class="event-title">${ICONS[event.type] || "•"} ${event.title}</h3>
            </div>
          </div>
          <p class="event-desc">${event.desc}</p>
          ${event.detail ? `<span class="event-detail">${event.detail}</span>` : ""}
        </div>
      </div>`).join("");

    return `
      <div class="card day-hero">
        <div class="day-hero-top">
          <p class="day-date">${day.date} · ${day.weekday}</p>
          <p class="day-theme">${day.theme}</p>
        </div>
        <h3 class="day-title">${day.dayLabel} · ${day.title}</h3>
        <p class="day-summary">${day.summary}</p>
        <p class="weather-note">${weatherNoteForDate(day.date)}</p>
      </div>
      <div class="card">
        <div class="timeline">${events}</div>
      </div>
      <div class="info-block">
        <h3>🚕 交通方式</h3>
        <ul class="info-list">${day.transport.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div class="info-block">
        <h3>🍜 餐饮安排</h3>
        <ul class="info-list">${day.dining.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div class="info-block">
        <h3>💡 当日贴士</h3>
        <ul class="info-list">${day.tips.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
    `;
  }

  function renderWeather() {
    const root = $("#weather-view");
    if (!root) return;

    const days = getWeatherForDays();
    const loading = state.weatherLoading ? "正在获取实时天气…" : "";
    const cards = days.map((day) => `
      <div class="weather-day">
        <div class="weather-day-main">
          <div class="weather-icon">${day.icon}</div>
          <div>
            <h3 class="weather-title">${shortDate(day.date)} · ${day.text}</h3>
            <p class="weather-sub">${weekdayForDate(day.date)} · ${day.summary}</p>
          </div>
          <div class="weather-temp">${day.max}°<small> / ${day.min}°</small></div>
        </div>
        <div class="weather-meta">
          <div class="weather-meta-item"><span>降水概率</span><strong>${day.precip}%</strong></div>
          <div class="weather-meta-item"><span>最大风速</span><strong>${day.wind} km/h</strong></div>
          <div class="weather-meta-item"><span>天气</span><strong>${day.text}</strong></div>
        </div>
        <p class="weather-advice">${day.advice}</p>
      </div>`).join("");

    root.innerHTML = `
      <div class="section-head">
        <div>
          <p class="section-kicker">Weather</p>
          <h2 class="section-title">澳门天气预报</h2>
        </div>
        <button class="text-button" id="refresh-weather">🔄 刷新</button>
      </div>
      <p class="section-kicker" style="margin:0 2px 12px;">数据来源：Open-Meteo · 位置：澳门（氹仔/路环）</p>
      <div class="mini-actions" style="margin-bottom:14px;">
        <button class="mini-action" id="speak-weather-button"><span>🔊</span><span>播报全部天气</span></button>
        <button class="mini-action" id="speak-today-weather"><span>📅</span><span>播报今天</span></button>
      </div>
      ${loading ? `<div class="empty-state">${loading}</div>` : ""}
      ${cards}
      <p style="color:var(--muted);font-size:11px;text-align:center;">天气信息可能随时更新，出发前请以澳门地球物理气象局/航司通知为准。</p>
    `;

    $("#refresh-weather").addEventListener("click", loadWeather);
    $("#speak-weather-button").addEventListener("click", speakWeather);
    $("#speak-today-weather").addEventListener("click", speakClosestWeather);
  }

  function renderFamily() {
    const root = $("#family-view");
    if (!root) return;

    root.innerHTML = `
      <div class="section-head">
        <div>
          <p class="section-kicker">Our little family</p>
          <h2 class="section-title">一家三口</h2>
        </div>
      </div>
      <div class="family-grid">
        ${TRIP_DATA.family.map((member) => `
          <div class="family-card">
            <img class="family-avatar" src="${member.avatar}" alt="${member.nickname}">
            <div>
              <h3 class="family-nickname">${member.emoji} ${member.nickname}</h3>
              <p class="family-role">${member.realRole}</p>
              <p class="family-personality">${member.personality}</p>
            </div>
          </div>`).join("")}
      </div>
      <div class="info-block checklist-card">
        <h2>🧳 出发前清单</h2>
        <ul class="checklist">${TRIP_DATA.checklist.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
    `;
  }

  function renderReminders() {
    const root = $("#reminders-view");
    if (!root) return;

    const items = TRIP_DATA.keyEvents.slice().sort((a, b) => {
      return toTimestamp(a.date, a.time) - toTimestamp(b.date, b.time);
    }).map((event) => {
      const date = new Date(`${event.date}T${event.time}:00+08:00`);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      return `
        <div class="reminder-item">
          <div class="reminder-date">
            <strong>${day}</strong>
            <span>${month}月</span>
          </div>
          <div class="reminder-text">
            <h3>${ICONS[event.type] || "⏰"} ${event.title}</h3>
            <p>${event.desc}</p>
          </div>
          <div class="reminder-time">${event.time}</div>
        </div>`;
    }).join("");

    root.innerHTML = `
      <div class="section-head">
        <div>
          <p class="section-kicker">Important moments</p>
          <h2 class="section-title">重要时间节点</h2>
        </div>
      </div>

      <div class="reminder-control">
        <div class="reminder-toggle">
          <div>
            <h2>浏览器提醒</h2>
            <p>开启后，若 App 保持打开，会在节点前弹出提醒；建议同时导入系统日历，离开页面也能收到。</p>
          </div>
          <button class="switch ${state.remindersOn ? "on" : ""}" id="reminder-switch" aria-label="浏览器提醒开关"></button>
        </div>
        <div class="reminder-list">${items}</div>
        <div class="action-row">
          <button class="primary-button" id="download-ics">📅 生成并下载日历提醒</button>
          <button class="secondary-button" id="speak-reminders">🔊 播报重要节点</button>
        </div>
        <p style="color:var(--muted);font-size:12px;">下载 .ics 后，在 iPhone/Android/Outlook 中打开即可自动加入系统日历并设置提前提醒。</p>
      </div>
    `;

    $("#reminder-switch").addEventListener("click", toggleReminders);
    $("#download-ics").addEventListener("click", downloadCalendar);
    $("#speak-reminders").addEventListener("click", speakReminders);
  }

  async function loadWeather() {
    state.weatherLoading = true;
    if (state.activeView === "weather") renderWeather();

    try {
      const start = "2026-08-19";
      const end = "2026-08-24";
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${TRIP_DATA.lat}&longitude=${TRIP_DATA.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FMacau&start_date=${start}&end_date=${end}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("weather request failed");
      const json = await response.json();
      const daily = json.daily;
      if (!daily || !Array.isArray(daily.time)) throw new Error("bad weather response");

      state.weather = daily.time.map((date, index) => {
        const wmo = daily.weather_code[index];
        const weather = WMO_MAP[wmo] || { icon: "🌡️", text: "天气更新中" };
        return {
          date,
          code: wmo,
          icon: weather.icon,
          text: weather.text,
          max: Math.round(daily.temperature_2m_max[index]),
          min: Math.round(daily.temperature_2m_min[index]),
          precip: Math.round(daily.precipitation_probability_max[index] || 0),
          wind: Math.round(daily.wind_speed_10m_max[index] || 0),
          summary: buildWeatherSummary(weather.text, daily.precipitation_probability_max[index])
        };
      });
      state.weatherLoaded = true;
    } catch (error) {
      state.weather = WEATHER_FALLBACK.map((item) => ({
        ...item,
        icon: (WMO_MAP[item.code] || {}).icon || "🌤️",
        text: (WMO_MAP[item.code] || {}).text || item.summary,
        summary: item.summary,
        advice: weatherAdvice(item)
      }));
      state.weatherLoaded = false;
      showToast("实时天气获取失败，已使用示例天气数据");
    }

    state.weatherLoading = false;
    if (state.activeView === "weather") renderWeather();
    if (state.activeView === "home") renderHome();
  }

  function getWeatherForDays() {
    const base = state.weather.length ? state.weather : WEATHER_FALLBACK.map((item) => ({
      ...item,
      icon: (WMO_MAP[item.code] || {}).icon || "🌤️",
      text: (WMO_MAP[item.code] || {}).text || item.summary,
      summary: item.summary,
      advice: weatherAdvice(item)
    }));

    return TRIP_DATA.days.map((day) => {
      const match = base.find((item) => item.date === day.date);
      return match ? { ...match, advice: weatherAdvice(match) } : {
        date: day.date,
        icon: "🌤️",
        text: "天气更新中",
        max: "—",
        min: "—",
        precip: "—",
        wind: "—",
        summary: "实时数据加载中",
        advice: "出发前请查看最新天气。"
      };
    });
  }

  function weatherForDate(date) {
    return getWeatherForDays().find((day) => day.date === date);
  }

  function weatherNoteForDate(date) {
    const weather = weatherForDate(date);
    if (!weather) return "☂️ 八月澳门湿热、阵雨概率高，带伞、补水、穿透气鞋。";
    return `${weather.icon} ${shortDate(date)}：${weather.text}，${weather.max}°/${weather.min}°，降水概率 ${weather.precip}%。${weather.advice}`;
  }

  function weatherAdvice(weather) {
    const precip = Number(weather.precip);
    const max = Number(weather.max);
    let advice = "";
    if (precip >= 60) advice = "降雨概率高，优先安排室内景点，随身带伞。";
    else if (precip >= 40) advice = "可能有阵雨，室外行程建议带伞并预留弹性。";
    else advice = "降水概率适中，适合步行，仍建议带一把轻便伞。";
    if (max >= 32) advice += " 天气炎热，注意补水和防晒。";
    return advice;
  }

  function buildWeatherSummary(text, precip) {
    if (precip >= 60) return `有雨，降水概率 ${Math.round(precip)}%`;
    if (precip >= 40) return `偶有阵雨，降水概率 ${Math.round(precip)}%`;
    return `${text}，天气相对平稳`;
  }

  function startClock() {
    updateClock();
    state.clockTimer = window.setInterval(updateClock, 30000);
  }

  function updateClock() {
    const element = $("#countdown-time");
    if (!element) return;
    const next = getNextKeyEvent();
    if (!next) {
      element.textContent = "行程已结束";
      return;
    }
    element.textContent = formatCountdown(next.timestamp - Date.now());
  }

  function getNextKeyEvent() {
    const now = Date.now();
    return TRIP_DATA.keyEvents
      .map((event) => ({ ...event, timestamp: toTimestamp(event.date, event.time) }))
      .filter((event) => event.timestamp > now)
      .sort((a, b) => a.timestamp - b.timestamp)[0] || null;
  }

  function getClosestDay() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const exact = TRIP_DATA.days.find((day) => day.date === today);
    if (exact) return exact;
    const future = TRIP_DATA.days.find((day) => day.date > today);
    return future || TRIP_DATA.days[TRIP_DATA.days.length - 1];
  }

  function toTimestamp(date, time) {
    return new Date(`${date}T${time}:00+08:00`).getTime();
  }

  function shortDate(dateString) {
    const parts = dateString.split("-");
    return `${Number(parts[1])}/${Number(parts[2])}`;
  }

  function weekdayForDate(dateString) {
    const day = TRIP_DATA.days.find((item) => item.date === dateString);
    return day ? day.weekday : "";
  }

  function formatCountdown(ms) {
    if (ms <= 0) return "已到时间";
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `还有 ${days} 天 ${hours} 小时 ${minutes} 分`;
    if (hours > 0) return `还有 ${hours} 小时 ${minutes} 分`;
    return `还有 ${minutes} 分钟`;
  }

  async function toggleReminders() {
    const button = $("#reminder-switch");
    if (!button) return;

    if (!state.remindersOn) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        showToast("请在浏览器设置中允许通知，才能使用提醒");
        return;
      }
      state.remindersOn = true;
      localStorage.setItem("macau-reminders-on", "true");
      scheduleNotifications();
      showToast("浏览器提醒已开启，建议再导入系统日历");
    } else {
      state.remindersOn = false;
      localStorage.setItem("macau-reminders-on", "false");
      showToast("浏览器提醒已关闭");
    }
    renderReminders();
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      showToast("当前浏览器不支持系统通知");
      return false;
    }
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      return false;
    }
  }

  function scheduleNotifications() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    TRIP_DATA.keyEvents.forEach((event) => {
      const eventTime = toTimestamp(event.date, event.time);
      const notifyAt = eventTime - (event.leadMinutes || 30) * 60000;
      const delay = notifyAt - Date.now();
      if (delay <= 0 || delay > 7 * 24 * 60 * 60 * 1000) return;
      window.setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification(`⏰ ${event.title}`, {
            body: `${event.date} ${event.time} · ${event.desc}`,
            tag: event.id
          });
        }
      }, delay);
    });
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      showToast("当前浏览器不支持语音播报");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    utterance.pitch = 1;
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang && item.lang.toLowerCase().startsWith("zh"));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
    showToast("正在播报…");
  }

  function speakWeather() {
    const days = getWeatherForDays();
    const text = `小鹿的澳门入学记，行程天气预报。${days.map((day) => {
      return `${shortDate(day.date)}${weekdayForDate(day.date)}，${day.text}，最高${day.max}度，最低${day.min}度，降水概率百分之${day.precip}。`;
    }).join("")} 澳门八月湿热，记得带伞、补水和防晒。`;
    speakText(text);
  }

  function speakClosestWeather() {
    const day = getClosestDay();
    const weather = weatherForDate(day.date);
    if (!weather) return;
    const text = `${day.dayLabel}，${shortDate(day.date)}，${weather.text}，最高${weather.max}度，最低${weather.min}度，降水概率百分之${weather.precip}。${weather.advice}`;
    speakText(text);
  }

  function speakToday() {
    const day = getClosestDay();
    const weather = weatherForDate(day.date);
    const events = day.events.slice(0, 8).map((event) => `${event.time}，${event.title}`).join("；");
    const text = `今天是${day.date}，${day.weekday}。${day.title}。${weather ? `${weather.text}，最高${weather.max}度，最低${weather.min}度，降水概率百分之${weather.precip}。` : ""}主要安排：${events}。`;
    speakText(text);
  }

  function speakDay(dayId) {
    const day = TRIP_DATA.days.find((item) => item.id === dayId);
    if (!day) return;
    const events = day.events.map((event) => `${event.time}，${event.title}`).join("；");
    const text = `${day.dayLabel}，${day.date}，${day.weekday}。${day.title}。${day.summary} 主要安排：${events}`;
    speakText(text);
  }

  function speakReminders() {
    const items = TRIP_DATA.keyEvents.slice().sort((a, b) => toTimestamp(a.date, a.time) - toTimestamp(b.date, b.time));
    const text = `重要时间节点。${items.map((item) => `${item.date}，${item.time}，${item.title}`).join("。")}`;
    speakText(text);
  }

  function downloadCalendar() {
    const ics = buildCalendar();
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "小鹿澳门入学记-重要节点.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("已生成 .ics 日历文件，请打开并导入");
  }

  function buildCalendar() {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Codex//Macau Family Trip//ZH-CN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];

    TRIP_DATA.keyEvents.forEach((event, index) => {
      const start = formatIcsDate(event.date, event.time);
      const now = formatIcsNow();
      lines.push(
        "BEGIN:VEVENT",
        `UID:macau-family-${event.id}@codex.local`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `SUMMARY:${escapeIcs(`${event.title}`)}`,
        `DESCRIPTION:${escapeIcs(event.desc)}`,
        `LOCATION:${escapeIcs(event.location || "")}`,
        "BEGIN:VALARM",
        `TRIGGER:-PT${event.leadMinutes || 30}M`,
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcs(`提醒：${event.title}`)}`,
        "END:VALARM",
        "END:VEVENT"
      );
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function formatIcsDate(date, time) {
    const dateObj = new Date(`${date}T${time}:00+08:00`);
    return dateObj.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function formatIcsNow() {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function escapeIcs(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    if (state.toastTimer) window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function initInstallPrompt() {
    const banner = $("#install-banner");
    const action = $("#install-banner-action");
    const close = $("#install-banner-close");
    const title = $("#install-banner-title");
    const text = $("#install-banner-text");
    if (!banner || !action || !close || !title || !text) return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone) {
      banner.hidden = true;
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      if (isIOS) return;
      title.textContent = "把行程装到手机桌面";
      text.textContent = "独立打开、离线可用，和桌面端一样清爽。";
      banner.hidden = false;
    });

    if (isIOS) {
      title.textContent = "iPhone 添加到主屏幕";
      text.textContent = "点下方分享按钮，选择“添加到主屏幕”。";
      banner.hidden = false;
      action.hidden = true;
    } else {
      action.addEventListener("click", async () => {
        if (!deferredInstallPrompt) {
          showToast("请在浏览器菜单中选择“安装应用/添加到主屏幕”");
          return;
        }
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        banner.hidden = true;
      });
    }

    close.addEventListener("click", () => {
      banner.hidden = true;
    });

    window.addEventListener("appinstalled", () => {
      banner.hidden = true;
      showToast("已安装，可从主屏幕打开");
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // 本地直接打开文件时可能无法注册，忽略。
      });
    });
  }
})();
