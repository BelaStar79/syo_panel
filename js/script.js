import { company as defaultCompany, plans as defaultPlans, services as defaultServices, statistics, messages as defaultMessages } from "./data.js";

(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = {
    theme: "synthOcean.theme", collapsed: "synthOcean.sidebarCollapsed",
    contacts: "synthOcean.demoContacts", content: "synthOcean.contentDraft", company: "synthOcean.companyDraft"
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  function load(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : clone(fallback); }
    catch { return clone(fallback); }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { toast("Could not save in this browser."); return false; }
  }
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const number = value => Number(value || 0).toLocaleString("en-US");
  const percent = value => `${Number(value) > 0 ? "+" : ""}${Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  const firstCompany = clone(defaultCompany[0] || {});
  const savedCompany = load(STORAGE.company, firstCompany);
  // Migrate older local drafts saved by the previous version of the dashboard.
  let companyData = savedCompany.social_networks ? savedCompany : {
    ...firstCompany,
    name: savedCompany.companyName || firstCompany.name,
    mail: savedCompany.email || firstCompany.mail,
    phone: savedCompany.phone || firstCompany.phone,
    social_networks: (firstCompany.social_networks || []).map(s => ({
      ...s,
      url: s.name === "Instagram" ? (savedCompany.instagram || s.url) : s.name === "Facebook" ? (savedCompany.facebook || s.url) : s.url
    }))
  };
  let content = load(STORAGE.content, { plans: clone(defaultPlans).map(p => ({...p, price: String(p.price), maintenance: String(p.maintenance), features: p.features.join("\n"), published: true })), services: clone(defaultServices) });
  const savedContacts = load(STORAGE.contacts, []);
  // The list and message text always come from data.js; only locally changed statuses are retained.
  let contacts = clone(defaultMessages).map(message => ({
    ...message,
    subject: "Website inquiry",
    dateTime: `${message.date} ${message.time}`,
    status: savedContacts.find(saved => Number(saved.id) === Number(message.id))?.status || message.status
  }));
  let activeContentTab = "planes", draftDirty = false, companyDirty = false;
  let contactsCurrentPage = 1;

async function loadViews() {
  const names = [
    "analytics",
    "contacts",
    "content",
    "company",
    "configuration"
  ];

  const wrap = $(".content-wrap");

  try {
    const fragments = await Promise.all(
      names.map(async name => {
        const response = await fetch(`view/${name}.html`);

        if (!response.ok) {
          throw new Error(`Could not load view/${name}.html`);
        }

        return response.text();
      })
    );

    fragments.forEach(fragment => {
      const template = document.createElement("template");
      template.innerHTML = fragment.trim();

      wrap.insertBefore(
        template.content,
        $(".app-footer", wrap)
      );
    });

  } catch (error) {
    console.error("Error loading views:", error);

    const notice = document.createElement("div");
    notice.className = "notice-banner";
    notice.textContent =
      "Some sections could not be loaded. Check the local server and view files.";

    wrap.prepend(notice);
  }
}

  
function toast(message, type = "confirmation") {
  const alertsToggle = $("#settingAlertsEnabled");
  const confirmationsToggle = $("#settingConfirmationsEnabled");
  const alertsEnabled = alertsToggle
    ? alertsToggle.checked
    : localStorage.getItem("synthOcean.alertsEnabled") !== "false";
  const confirmationsEnabled = confirmationsToggle
    ? confirmationsToggle.checked
    : localStorage.getItem("synthOcean.confirmationsEnabled") !== "false";
  if (type === "alert" && !alertsEnabled) return;
  if (type === "confirmation" && !confirmationsEnabled) return;
  const region = $("#toastRegion");
  if (!region) return;
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  region.append(node);
  window.setTimeout(() => node.remove(), 3200);
}


  function showConfirm(title, message, confirmText, action) {
    const dialog = $("#confirmDialog");
    if (!dialog || typeof dialog.showModal !== "function") { if (window.confirm(`${title}\n\n${message}`)) action?.(); return; }
    $("#dialogTitle").textContent = title; $("#dialogMessage").textContent = message; $("#dialogConfirm").textContent = confirmText || "Confirm";
    $("#dialogConfirm").onclick = event => { event.preventDefault(); dialog.close("confirm"); action?.(); };
    dialog.showModal();
  }
  function navigate(view) {
    const target = $("#view-" + view); if (!target) return;
    $$(".view-section").forEach(section => section.classList.toggle("active", section === target));
    $$(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    const active = $(`.nav-item[data-view="${view}"]`); const label = active?.title || "Dashboard";
    if ($("#breadcrumbCurrent")) $("#breadcrumbCurrent").textContent = label;
    document.title = `${label} · ${companyData.name || "Synth Ocean"}`;
    if (window.location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
    closeMobileMenu(); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openMobileMenu() { $("#sidebar")?.classList.add("mobile-open"); if ($("#mobileScrim")) $("#mobileScrim").hidden = false; }
  function closeMobileMenu() { $("#sidebar")?.classList.remove("mobile-open"); if ($("#mobileScrim")) $("#mobileScrim").hidden = true; }
  function setTheme(theme) {
    const dark = theme === "dark"; document.body.classList.toggle("dark", dark); save(STORAGE.theme, dark ? "dark" : "light");
    const toggle = $("#themeToggle"); if (toggle) { toggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme"); toggle.setAttribute("title", dark ? "Switch to light theme" : "Switch to dark theme"); toggle.setAttribute("aria-pressed", String(dark)); }
    if ($("#settingsTheme")) $("#settingsTheme").textContent = dark ? "Switch to light theme" : "Switch to dark theme";
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = dark ? "#101827" : "#006dff";
  }

  function applyCompanyBranding() {
    const name = companyData.name || "Company";
    const logo = $(".brand-logo"); if (logo && companyData.logo) logo.src = companyData.logo;
    const favicon = $('link[rel="icon"]'); if (favicon && companyData.favicon) favicon.href = companyData.favicon;
    const alt = $(".brand-logo"); if (alt) alt.alt = name;
    const crumb = $(".breadcrumb > span:first-child"); if (crumb) crumb.textContent = name;
    const footer = $(".app-footer"); if (footer) { const brand = footer.querySelector("span:first-child"); if (brand) brand.textContent = `© ${name}`; }
    const companySubtitle = $("#view-company .page-subtitle"); if (companySubtitle) companySubtitle.textContent = `Keep ${name} contact information in one place.`;
  }

  function selectedStats(selector = "#overviewPeriod") { const days = Number($(selector)?.value || 30); return statistics.find(item => item.days === days) || statistics[1] || statistics[0]; }
  
  function trendMarkup(value) {
    const positive = Number(value) >= 0;
    const arrow = positive
      ? `<svg class="trend-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M3 11 11 3M5 3h6v6"></path>
        </svg>`
      : `<svg class="trend-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="m3 5 8 8M5 13h6V7"></path>
        </svg>`;
    return `<span class="trend ${positive ? "positive" : "negative"}">${arrow} ${escapeHtml(percent(value))}</span>`;
  }

  function renderDashboard() {
    const data = selectedStats(); if (!data) return;

    
    // Actualizar la gráfica Website traffic con datos de data.js
    const trafficData = data.traffic_over_time || [];
    const chartArea = $("#view-dashboard .traffic-panel .chart-area");
    const chartLine = $("#view-dashboard .traffic-panel .chart-line");
    const chartLabels = $$("#view-dashboard .traffic-panel .chart-x-labels span");


    if (trafficData.length && chartArea && chartLine) {
      const width = 700;
      const baseline = 220;
      const top = 20;
      const bottom = 185;
      const maxVisits = Math.max(...trafficData.map(item => Number(item.visits) || 0), 1);
      const points = trafficData.map((item, index) => ({
        x: index * width / Math.max(trafficData.length - 1, 1),
        y: bottom - ((Number(item.visits) || 0) / maxVisits) * (bottom - top)
      }));
      const linePath = points
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
        .join(" ");
      chartLine.setAttribute("d", linePath);
      chartArea.setAttribute(
        "d",
        `${linePath} L${width} ${baseline} L0 ${baseline} Z`
      );
      // Mostrar hasta siete etiquetas distribuidas por el período
      const labelCount = Math.min(chartLabels.length, trafficData.length);
      chartLabels.forEach((element, index) => {
        if (index >= labelCount) {
          element.textContent = "";
          return;
        }
        const dataIndex = Math.round(
          index * (trafficData.length - 1) / Math.max(labelCount - 1, 1)
        );
        element.textContent = trafficData[dataIndex].label;
      });
    }


    const cards = $$("#view-dashboard .metric-grid .metric-card");
    const metrics = [
      { value: number(data.current_visits), growth: data.visit_growth_percentage },
      { value: number(data.estimated_visitors), growth: data.visitors_growth_percentage },
      { value: number(data.contacts_received), growth: data.contacts_received_growth_percentage },
      { value: `${Number(data.estimated_conversion).toLocaleString("en-US", {maximumFractionDigits:2})}%`, growth: data.estimated_conversion_percentage }
    ];
    
    cards.forEach((card, i) => {
      if (!metrics[i]) return;
      const value = $(".metric-value", card);
      if (value) value.textContent = metrics[i].value;
      const foot = $(".metric-foot", card);
      if (!foot) return;
      const trend = $(".trend", foot);
      if (!trend) return;
      const growth = Number(metrics[i].growth) || 0;
      const positive = growth >= 0;
      trend.className = `trend ${positive ? "positive" : "negative"}`;
      const arrow = positive
        ? `<svg class="trend-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 11 11 3M5 3h6v6"></path>
          </svg>`
        : `<svg class="trend-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="m3 5 8 8M5 13h6V7"></path>
          </svg>`;
      trend.innerHTML = `${arrow} ${escapeHtml(String(Math.abs(growth)).replace(".", ","))}%`;
    });



    
    if ($("#chartTotal")) {
        $("#chartTotal").textContent = number(data.current_visits);
    }
    const donut = $("#view-dashboard .donut-center strong");
    if (donut) {
        donut.textContent = number(data.current_visits);
    }
    const sourceRows = $$("#view-dashboard .source-row");
    const trafficColors = ["#006dff", "#5a9cff", "#9cc5ff", "#dbe8fa"];
    const trafficTotal = data.traffic.reduce(
        (total, item) => total + Math.max(0, Number(item.quantity) || 0),
        0
    );
    let currentAngle = 0;
    const donutSegments = data.traffic.map((item, i) => {
        const value = Math.max(0, Number(item.quantity) || 0);
        const percentage = trafficTotal > 0
            ? (value / trafficTotal) * 100
            : 0;

        const start = currentAngle;
        currentAngle += percentage;

        return `${trafficColors[i % trafficColors.length]} ${start}% ${currentAngle}%`;
    });
    const donutChart = $("#view-dashboard .donut-chart");
    if (donutChart && donutSegments.length && trafficTotal > 0) {
        donutChart.style.background = `conic-gradient(${donutSegments.join(", ")})`;
    }
    sourceRows.forEach((row, i) => {
        const item = data.traffic[i];
        if (!item || trafficTotal <= 0) {
            row.hidden = true;
            return;
        }
        row.hidden = false;
        const value = Math.max(0, Number(item.quantity) || 0);
        const percentage = (value / trafficTotal) * 100;
        const color = trafficColors[i % trafficColors.length];
        const name = $(".source-name", row);
        if (name) {
            name.innerHTML =
                `<i class="source-color source-${["one", "two", "three", "four"][i % 4]}" style="background:${color}"></i>${escapeHtml(item.name)}`;
        }
        const pct = $("strong", row);
        if (pct) {
            pct.textContent = `${percentage.toLocaleString("en-US", {
                maximumFractionDigits: 1
            })}%`;
        }
        const bar = $(".source-track i", row);
        if (bar) {
            bar.style.width = `${percentage}%`;
            bar.style.background = color;
        }
    });




    const rows = $$("#view-dashboard .pages-panel tbody tr");
    rows.forEach((row, i) => { const page = data.pages[i]; if (!page) { row.hidden = true; return; } row.hidden = false; const cells = row.querySelectorAll("td"); if (cells[0]) { const title = $(".page-title", cells[0]); if (title) title.textContent = page.name; } if (cells[1]) cells[1].textContent = number(page.visits); if (cells[2]) cells[2].innerHTML = trendMarkup(page.variation); });
    const recent = $("#view-dashboard .recent-list"); if (recent) recent.innerHTML = contacts.slice().sort((a,b) => `${b.dateTime || b.date} ${b.time || ""}`.localeCompare(`${a.dateTime || a.date} ${a.time || ""}`)).slice(0,3).map((c,i) => `<div class="recent-item"><div class="contact-avatar ${["avatar-blue","avatar-violet","avatar-orange"][i]}">${escapeHtml((c.name||"?").split(/\s+/).map(p=>p[0]||"").join("").slice(0,2).toUpperCase())}</div><div class="recent-info"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.subject || "Website inquiry")}</span></div><span class="status-tag ${statusClass(c.status)}">${escapeHtml(c.status)}</span><time>${escapeHtml(c.time || (c.dateTime||"").slice(-5))}</time></div>`).join("");
  }
  function statusClass(status) { return status === "New" ? "status-new" : status === "Resolved" ? "status-done" : "status-review"; }

  function renderAnalytics() {
    const data = selectedStats("#analyticsPeriod"); if (!data) return;
    const cards = $$("#view-analytics .metric-card");
    const metrics = [ [number(data.current_visits),data.visit_growth_percentage], [data.average_duration,data.duration_growth_percentage], [number(data.actions),data.action_growth_percentage] ];
    
    cards.forEach((card, i) => {
      if (!metrics[i]) return;
      const value = $(".metric-value", card);
      if (value) value.textContent = metrics[i][0];
      const trend = $(".trend", card);
      if (!trend) return;
      const growth = Number(metrics[i][1]) || 0;
      const positive = growth >= 0;
      trend.className = `trend ${positive ? "positive" : "negative"}`;
      const arrow = positive
        ? `<svg class="trend-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 11 11 3M5 3h6v6"></path>
          </svg>`
        : `<svg class="trend-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="m3 5 8 8M5 13h6V7"></path>
          </svg>`;
      trend.innerHTML = `${arrow} ${escapeHtml(String(Math.abs(growth)).replace(".", ","))}%`;
    });

    const conversions = $$("#view-analytics .conversion-list > div"); const conversionData = [["Form submitted",data.forms_submitted],["Email click",data.click_email],["Phone click",data.click_phone]];
    conversions.forEach((row,i)=>{const item=conversionData[i];if(!item)return;const label=$("span",row);if(label)label.textContent=item[0];const value=$("strong",row);if(value)value.textContent=number(item[1]);const bar=$("i",row);if(bar)bar.style.width=`${Math.max(4,Math.min(100,Number(item[1])/(Math.max(...conversionData.map(x=>Number(x[1])))||1)*100))}%`;});
    const tbody=$("#view-analytics table tbody"); if(tbody) tbody.innerHTML=data.pages.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${number(p.visits)}</td><td>${number(p.visitors)}</td><td>${escapeHtml(p.average_time)}</td><td>${number(p.actions)}</td></tr>`).join("");
    

    // Actualizar la gráfica Traffic over time con datos de data.js
    const trafficData = data.traffic_over_time || [];
    const chart = $("#view-analytics .traffic-panel .large-chart");
    const chartPaths = chart?.querySelectorAll("svg path");
    const chartLabels = $$(".chart-x-labels span", chart);
    if (trafficData.length && chartPaths?.length >= 2) {
      const width = 800;
      const baseline = 260;
      const top = 25;
      const bottom = 220;
      const maxVisits = Math.max(
        ...trafficData.map(item => Number(item.visits) || 0),
        1
      );
      const points = trafficData.map((item, index) => ({
        x: index * width / Math.max(trafficData.length - 1, 1),
        y: bottom - ((Number(item.visits) || 0) / maxVisits) * (bottom - top)
      }));
      const linePath = points
        .map((point, index) =>
          `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
        )
        .join(" ");
      chartPaths[0].setAttribute(
        "d",
        `${linePath} L${width} ${baseline} L0 ${baseline} Z`
      );
      chartPaths[1].setAttribute("d", linePath);
      chartLabels.forEach((element, index) => {
        const dataIndex = Math.round(
          index * (trafficData.length - 1) /
          Math.max(chartLabels.length - 1, 1)
        );
        element.textContent =
          trafficData[dataIndex]?.label || "";
      });
    }


  }

  
  function renderContacts() {
    const table = $("#contactsTable");
    if (!table) return;

    const query = ($("#contactSearch")?.value || "").toLowerCase().trim();
    const filter = $("#contactStatus")?.value || "all";
    const pageSize = Number($("#contactPageSize")?.value) || 10;

    const filtered = contacts.filter(item =>
      [item.name, item.email, item.subject, item.message]
        .join(" ")
        .toLowerCase()
        .includes(query) &&
      (filter === "all" || item.status === filter)
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

    // Keep the current page within the valid range.
    contactsCurrentPage = Math.min(
      Math.max(1, contactsCurrentPage),
      totalPages
    );

    const start = (contactsCurrentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, filtered.length);
    const pageContacts = filtered.slice(start, end);

    table.innerHTML = pageContacts.length
      ? pageContacts.map(item => `
          <tr>
            <td>
              <strong>${escapeHtml(item.name)}</strong><br>
              <span style="color:var(--muted-color)">
                ${escapeHtml(item.email)}
              </span>
            </td>
            <td>
              <span>${escapeHtml(item.subject || "Website inquiry")}</span><br>
              <button class="text-button" data-message="${Number(item.id)}">
                View message
              </button>
            </td>
            <td>${escapeHtml(item.dateTime || `${item.date || ""} ${item.time || ""}`)}</td>
            <td>
              <select
                class="contact-status-select"
                data-status-id="${Number(item.id)}"
                aria-label="Status for ${escapeHtml(item.name)}"
              >
                ${["New", "In review", "Resolved"].map(status =>
                  `<option ${item.status === status ? "selected" : ""}>${status}</option>`
                ).join("")}
              </select>
            </td>
            <td>
              <button class="row-action" data-email="${escapeHtml(item.email)}">
                Compose email
              </button>
            </td>
          </tr>
        `).join("")
      : '<tr><td colspan="5">No contacts found.</td></tr>';

    // Update the contact count.
    if ($("#contactCount")) {
      $("#contactCount").textContent = filtered.length
        ? `${start + 1}–${end} of ${filtered.length} contacts (${contacts.length} total)`
        : `0 of ${contacts.length} contacts`;
    }

    // Update pagination controls.
    const pageInfo = $("#contactPageInfo");
    const prevButton = $("#contactPrevPage");
    const nextButton = $("#contactNextPage");

    if (pageInfo) {
      pageInfo.textContent = `Page ${contactsCurrentPage} of ${totalPages}`;
    }

    if (prevButton) {
      prevButton.disabled = contactsCurrentPage <= 1;
    }

    if (nextButton) {
      nextButton.disabled = contactsCurrentPage >= totalPages;
    }

    // Keep the dashboard's new-contact count updated.
    if ($("#newContactsCount")) {
      $("#newContactsCount").textContent =
        contacts.filter(c => c.status === "New").length;
    }

    // Contact status changes.
    $$("[data-status-id]", table).forEach(select => {
      select.addEventListener("change", () => {
        const item = contacts.find(
          c => Number(c.id) === Number(select.dataset.statusId)
        );

        if (item) {
          item.status = select.value;
          save(STORAGE.contacts, contacts);
          renderContacts();
          renderDashboard();
          toast("Status updated in this browser.");
        }
      });
    });

    // View contact message.
    $$("[data-message]", table).forEach(button => {
      button.addEventListener("click", () => {
        const item = contacts.find(
          c => Number(c.id) === Number(button.dataset.message)
        );

        if (item) {
          showConfirm(
            `Message from ${item.name}`,
            `${item.email}\n\n${item.message}`,
            "Close",
            () => {}
          );
        }
      });
    });

    // Compose email.
    $$("[data-email]", table).forEach(button => {
      button.addEventListener("click", () => {
        window.location.href = `mailto:${button.dataset.email}`;
      });
    });
  }

  function downloadCsv(filename, rows) { const csv=rows.map(row=>row.map(value=>`"${String(value??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url); }

  function markContentDirty() { draftDirty=true; const indicator=$("#draftIndicator");if(indicator){indicator.classList.add("pending");indicator.innerHTML="<i></i> Unsaved changes";}if($("#saveFeedback"))$("#saveFeedback").textContent="There are unsaved changes.";renderContentPreview(); }
  function renderPlansEditor() {
    if(!$("#plansEditor"))return;
    $("#plansEditor").hidden=activeContentTab!=="planes";$("#servicesEditor").hidden=activeContentTab!=="servicios";
    $("#editorTitle").textContent=activeContentTab==="planes"?"Plans & Pricing":"Services";$("#editorDescription").textContent=activeContentTab==="planes"?"Edit plan prices, descriptions, and features.":"Edit the names and descriptions of key services.";
    if(activeContentTab==="planes"){
      
      $("#plansEditor").innerHTML=content.plans.map((p,i)=>`<details class="plan-editor-card" data-plan-index="${i}"><summary class="plan-editor-top"><strong><span class="plan-number">${String(i+1).padStart(2,"0")}</span>${escapeHtml(p.name||"New plan")}</strong><span class="plan-toggle-label"></span></summary><div class="plan-fields"><label class="inline-check"><input type="checkbox" data-plan-field="published" ${p.published!==false?"checked":""}> Include in draft</label><label class="field"><span>Plan name</span><input data-plan-field="name" value="${escapeHtml(p.name)}" required></label><label class="field"><span>Starting price (USD)</span><input data-plan-field="price" type="number" min="0" step="1" value="${escapeHtml(p.price)}" required></label><label class="field"><span>Monthly maintenance (USD)</span><input data-plan-field="maintenance" type="number" min="0" step="1" value="${escapeHtml(p.maintenance)}" required></label><label class="field field-full"><span>Description</span><textarea data-plan-field="description" required>${escapeHtml(p.description)}</textarea></label><label class="field field-full"><span>Features (one per line)</span><textarea class="feature-field" data-plan-field="features">${escapeHtml(p.features)}</textarea></label></div></details>`).join("");

      $$('[data-plan-field]',$("#plansEditor")).forEach(input=>input.addEventListener("input",()=>{const card=input.closest("[data-plan-index]"),i=Number(card.dataset.planIndex),field=input.dataset.planField;content.plans[i][field]=field==="published"?input.checked:input.value;const title=$(".plan-editor-top strong",card);if(title)title.innerHTML=`<span class="plan-number">${String(i+1).padStart(2,"0")}</span>${escapeHtml(content.plans[i].name||"New plan")}`;markContentDirty();}));
    }else{
          
      $("#servicesEditor").innerHTML=content.services.map((s,i)=>`<details class="plan-editor-card" data-service-index="${i}"><summary class="plan-editor-top"><strong><span class="plan-number">${String(i+1).padStart(2,"0")}</span>${escapeHtml(s.name)}</strong><span class="plan-toggle-label"></span></summary><div class="plan-fields"><label class="field field-full"><span>Service name</span><input data-service-field="name" value="${escapeHtml(s.name)}" required></label><label class="field field-full"><span>Description</span><textarea data-service-field="description" required>${escapeHtml(s.description)}</textarea></label></div></details>`).join("");

      
      $$('[data-service-field]',$("#servicesEditor")).forEach(input=>input.addEventListener("input",()=>{
        const card=input.closest("[data-service-index]");
        const i=Number(card.dataset.serviceIndex);
        const field=input.dataset.serviceField;

        content.services[i][field]=input.value;

        const title=$(".plan-editor-top strong",card);
        if(title){
          title.innerHTML=`<span class="plan-number">${String(i+1).padStart(2,"0")}</span>${escapeHtml(content.services[i].name||"New service")}`;
        }

        markContentDirty();
      }));

    }renderContentPreview();
  }
  function renderContentPreview(){const box=$("#contentPreview");if(!box)return;const visible=content.plans.filter(p=>p.published!==false);box.innerHTML=activeContentTab==="planes"?(visible.map(p=>`<article class="preview-plan"><h3>${escapeHtml(p.name)}</h3><div class="preview-price">$${escapeHtml(p.price)} <small>USD · starting price</small></div><p>${escapeHtml(p.description)}</p><ul>${String(p.features||"").split("\n").filter(Boolean).map(f=>`<li>${escapeHtml(f)}</li>`).join("")}</ul><span class="preview-maintenance">$${escapeHtml(p.maintenance)} / month maintenance</span></article>`).join("")||"<p>No plans are visible in this draft.</p>"):content.services.map(s=>`<article class="preview-plan"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description)}</p></article>`).join("");}
  function validateContent(){const root=$("#plansEditor").hidden?$("#servicesEditor"):$("#plansEditor");const invalid=$$('input[required],textarea[required]',root).find(input=>!input.checkValidity());if(invalid){invalid.reportValidity();return false;}return true;}

  function renderCompanyForm() {
    const form=$("#companyForm"), fields=$("#companyFields"); if(!form||!fields)return;
    const socials=companyData.social_networks||[];
    fields.innerHTML=`<label class="field"><span>Company name</span><input name="name" value="${escapeHtml(companyData.name)}" required></label><label class="field"><span>Public email</span><input name="mail" type="email" value="${escapeHtml(companyData.mail)}" required></label><label class="field"><span>Phone</span><input name="phone" type="tel" value="${escapeHtml(companyData.phone)}"></label><label class="field"><span>Logo path</span><input name="logo" value="${escapeHtml(companyData.logo)}"></label><label class="field"><span>Favicon path</span><input name="favicon" value="${escapeHtml(companyData.favicon)}"></label>${socials.map((s,i)=>`<label class="field"><span>${escapeHtml(s.name)} URL</span><input name="social_${i}" type="url" value="${escapeHtml(s.url)}" placeholder="https://…"></label>`).join("")}`;
    form.addEventListener("input",()=>{companyDirty=true;if($("#companyFeedback"))$("#companyFeedback").textContent="There are unsaved changes.";});
    form.addEventListener("submit",event=>{event.preventDefault();if(!form.reportValidity())return;const values=Object.fromEntries(new FormData(form).entries());companyData={...companyData,name:values.name,mail:values.mail,phone:values.phone,logo:values.logo,favicon:values.favicon,social_networks:(companyData.social_networks||[]).map((s,i)=>({...s,url:values[`social_${i}`]||""}))};if(save(STORAGE.company,companyData)){companyDirty=false;applyCompanyBranding();$("#companyFeedback").textContent="Draft saved in this browser.";toast("Company details saved as a draft.");}});
  }

  async function init(){
    try{await loadViews();}catch{return;}
    $$(".nav-item[data-view]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.view)));
    $$('[data-go]').forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.go)));
    $("#sidebarCollapse")?.addEventListener("click",()=>{document.body.classList.toggle("sidebar-collapsed");save(STORAGE.collapsed,document.body.classList.contains("sidebar-collapsed"));});
    if(load(STORAGE.collapsed,false))document.body.classList.add("sidebar-collapsed");
    $("#mobileMenu")?.addEventListener("click",openMobileMenu);$("#mobileScrim")?.addEventListener("click",closeMobileMenu);window.addEventListener("resize",()=>{if(window.innerWidth>700)closeMobileMenu();});
    setTheme(load(STORAGE.theme,"light"));$("#themeToggle")?.addEventListener("click",()=>setTheme(document.body.classList.contains("dark")?"light":"dark"));$("#settingsTheme")?.addEventListener("click",()=>{setTheme(document.body.classList.contains("dark")?"light":"dark");toast("Appearance updated.");});
    
    
    // Settings preferences: load saved values and persist changes
    const alertsToggle = $("#settingAlertsEnabled");
    const confirmationsToggle = $("#settingConfirmationsEnabled");
    if (alertsToggle) {
      alertsToggle.checked =
        localStorage.getItem("synthOcean.alertsEnabled") !== "false";
    }
    if (confirmationsToggle) {
      confirmationsToggle.checked =
        localStorage.getItem("synthOcean.confirmationsEnabled") !== "false";
    }
    
    document.addEventListener("change", event => {
      const toggle = event.target;
      if (toggle.id === "settingAlertsEnabled") {
        localStorage.setItem(
          "synthOcean.alertsEnabled",
          toggle.checked ? "true" : "false"
        );
        console.log("Alerts preference saved:", toggle.checked);
      }
      if (toggle.id === "settingConfirmationsEnabled") {
        localStorage.setItem(
          "synthOcean.confirmationsEnabled",
          toggle.checked ? "true" : "false"
        );
        console.log("Confirmations preference saved:", toggle.checked);
      }
    });



    $("#dismissNotice")?.addEventListener("click",()=>$(".view-section.active .notice-banner")?.remove());
    applyCompanyBranding();renderCompanyForm();
    
    
    $("#contactSearch")?.addEventListener("input", () => {
      contactsCurrentPage = 1;
      renderContacts();
    });
    $("#contactStatus")?.addEventListener("change", () => {
      contactsCurrentPage = 1;
      renderContacts();
    });
    $("#contactPageSize")?.addEventListener("change", () => {
      contactsCurrentPage = 1;
      renderContacts();
    });
    $("#contactPrevPage")?.addEventListener("click", () => {
      if (contactsCurrentPage > 1) {
        contactsCurrentPage--;
        renderContacts();
      }
    });
    $("#contactNextPage")?.addEventListener("click", () => {
      contactsCurrentPage++;
      renderContacts();
    });
    renderContacts();


    $("#exportContacts")?.addEventListener("click",()=>downloadCsv("synth-ocean-contacts-demo.csv",[["Name","Email","Inquiry","Date","Status","Message"],...contacts.map(c=>[c.name,c.email,c.subject,c.dateTime||`${c.date} ${c.time}`,c.status,c.message])]));
    $("#exportAnalytics")?.addEventListener("click",()=>{const d=selectedStats("#analyticsPeriod");downloadCsv("synth-ocean-analytics-demo.csv",[["Page","Visits","Visitors","Average time","Actions"],...d.pages.map(p=>[p.name,p.visits,p.visitors,p.average_time,p.actions])]);});
    $$(".content-tab").forEach(button=>button.addEventListener("click",()=>{activeContentTab=button.dataset.contentTab;$(".content-tab.active")?.classList.remove("active");button.classList.add("active");renderPlansEditor();}));
    $("#saveDraft")?.addEventListener("click",()=>{if(!validateContent())return;if(save(STORAGE.content,content)){draftDirty=false;$("#draftIndicator")?.classList.remove("pending");if($("#draftIndicator"))$("#draftIndicator").innerHTML="<i></i> Draft saved";$("#saveFeedback").textContent="Draft saved in this browser.";toast("Draft saved locally.");}});
    $("#resetContent")?.addEventListener("click",()=>showConfirm("Restore sample data","Current edits will be discarded and the sample plans and services from js/data.js will be restored.","Restore",()=>{content={plans:clone(defaultPlans).map(p=>({...p,price:String(p.price),maintenance:String(p.maintenance),features:p.features.join("\n"),published:true})),services:clone(defaultServices)};draftDirty=true;renderPlansEditor();markContentDirty();toast("Sample data restored. Save the draft to keep these changes.");}));
    $("#publishDraft")?.addEventListener("click",()=>{if(draftDirty){
      toast("Save the draft before requesting publication.", "alert");
      return;}showConfirm("Confirm publishing","The draft is saved in this browser, but this prototype cannot publish changes to the public website. Connect a CMS or API to enable publishing.","Got it",()=>{});});
    $("#publishCompany")?.addEventListener("click",()=>{if(companyDirty){
      toast("Save the details before requesting publication.", "alert");
      return;}showConfirm("Confirm publishing","The details are saved locally but have not been published to the public website. Connect a CMS or backend to enable this feature.","Got it",()=>{});});
    $("#overviewPeriod")?.addEventListener("change",()=>{renderDashboard();toast("Period updated. Data is for demonstration purposes.");});$("#analyticsPeriod")?.addEventListener("change",()=>{renderAnalytics();toast("Period updated. Data is for demonstration purposes.");});
    renderPlansEditor();renderDashboard();renderAnalytics();
    window.addEventListener("beforeunload",event=>{if(draftDirty||companyDirty){event.preventDefault();event.returnValue="";}});
    const requested=window.location.hash.slice(1);navigate(["dashboard","analytics","contacts","content","company","configuration"].includes(requested)?requested:"dashboard");
  }
  init();
})();
