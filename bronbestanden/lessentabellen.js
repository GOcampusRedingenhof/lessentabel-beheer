/**
 * Dynamische Lessentabellen - Versie 2.1
 * Applicatie voor het tonen van lessentabellen bij GO Campus Redingenhof.
 * @copyright 2025 GO Campus Redingenhof
 */

const LessentabellenApp = {
  // Versie en configuratie
  version: '2.1.0',
  
  config: {
    csvUrl: "https://raw.githubusercontent.com/GOcampusRedingenhof/lessenrooster/refs/heads/main/lessentabellen_tabel.csv",
    cacheExpiry: 1000 * 60 * 60, // 1 uur cache
    domainColors: {
      "stem": {
        base: "#0A7254", // Verbeterd contrast
        mid: "#48A787",
        light1: "#F5FDFB",
        hover: "#E4F5F0"
      },
      "topsport": {
        base: "#0A6180", // Verbeterd contrast
        mid: "#1B88AE",
        light1: "#F5FBFE",
        hover: "#E4F3F7"
      },
      "eerste-graad": {
        base: "#D14213",
        mid: "#F3764A",
        light1: "#FEF8F5",
        hover: "#FAEDE7"
      },
      "maatschappij-welzijn": {
        base: "#C4387A", // Verbeterd contrast
        mid: "#E399BB",
        light1: "#FDF6F9",
        hover: "#F9EAF2"
      },
      "economie-organisatie": {
        base: "#1A2F6E", // Verbeterd contrast
        mid: "#2D54AE", 
        light1: "#F6F8FD",
        hover: "#EAF0F9"
      },
      "schakeljaar": {
        base: "#18306F", // Verbeterd contrast
        mid: "#2F56B0",
        light1: "#F6F8FD",
        hover: "#EAF0F9"
      },
      "okan": {
        base: "#C68212",
        mid: "#E5A021",
        light1: "#FEF9F2",
        hover: "#FCF1E2"
      }
    }
  },
  
  // Data en state
  data: {
    csvData: null,
    lastFetch: null,
    currentRichting: null,
    domainDisplayNames: {},
    isLoading: true,
    hasError: false,
    errorMessage: '',
    isMobile: false
  },
  
  // DOM elementen
  elements: {
    container: null,
    slidein: null,
    overlay: null,
    tableContainer: null,
    topbar: null
  },
  
  // Initialisatie
  init: function(skipElementCreation) {
    console.log(`Lessentabellen v${this.version} initializing...`);
    
    // Detecteer mobiel
    this.data.isMobile = window.innerWidth <= 768;
    
    // Alleen DOM elementen aanmaken als dat nodig is
    if (!skipElementCreation) {
      this.createRequiredElements();
    }
    
    this.cacheElements();
    this.setupEventListeners();
    this.loadData();
    
    // Verbeterde detectie van tophoogte met meerdere pogingen
    this.setDynamicTop();
    setTimeout(() => this.setDynamicTop(), 500);
    setTimeout(() => this.setDynamicTop(), 1500);
  },
  
  // DOM elementen creëren indien nodig
  createRequiredElements: function() {
    // We gaan er vanuit dat de basisstructuur al in de HTML staat
    console.log("Checking if elements exist...");
    
    // Als main container niet bestaat, maak deze aan
    if (!document.getElementById('lessentabellen-container')) {
      console.log("Creating main container");
      const mainContainer = document.createElement('div');
      mainContainer.id = 'lessentabellen-container';
      mainContainer.className = 'lessentabellen-root';
      document.body.appendChild(mainContainer);
      
      // Voeg interne elementen toe
      mainContainer.innerHTML = `
        <div id="domains-container"></div>
        <div id="overlay"></div>
        <div class="lessentabellen-wrapper" id="slidein" tabindex="-1">
          <button class="close-btn" aria-label="Sluiten">×</button>
          <h2 id="opleiding-titel">Lessentabel</h2>
          <p id="opleiding-beschrijving"></p>
          <div class="action-buttons">
            <a id="brochure-link" href="#" target="_blank">Brochure</a>
            <button id="print-button">Afdrukken</button>
          </div>
          <div id="lessentabel-container"></div>
          <div id="footnotes"></div>
          <img class="logo-print" src="https://images.squarespace-cdn.com/content/v1/670992d66064015802d7e5dc/5425e461-06b0-4530-9969-4068d5a5dfdc/Scherm%C2%ADafbeelding+2024-12-03+om+09.38.12.jpg?format=1500w" alt="Redingenhof logo" />
          <div class="datum">Afgedrukt op: <span id="datum-print"></span></div>
          <div class="quote">SAMEN VER!</div>
        </div>
      `;
    }
  },
  
  // DOM elementen cachen
  cacheElements: function() {
    this.elements.container = document.getElementById("domains-container");
    this.elements.slidein = document.getElementById("slidein");
    this.elements.overlay = document.getElementById("overlay");
    this.elements.tableContainer = document.getElementById("lessentabel-container");
    this.elements.topbar = document.getElementById("custom-topbar");
    
    // Event listeners voor knoppen
    const printButton = document.getElementById("print-button");
    if (printButton) {
      printButton.addEventListener('click', function() {
        window.print();
      });
    }
    
    const closeButton = document.querySelector(".close-btn");
    if (closeButton) {
      closeButton.addEventListener('click', this.closeSlidein.bind(this));
    }
  },
  
  // Event listeners
  setupEventListeners: function() {
    // Window resize en scroll events
    window.addEventListener("resize", () => {
      this.data.isMobile = window.innerWidth <= 768;
      this.setDynamicTop();
    });
    
    window.addEventListener("scroll", () => this.setDynamicTop());
    
    // Toetsenbord navigatie
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.elements.slidein?.classList.contains('open')) {
        this.closeSlidein();
      }
    });
    
    // URL hash changes
    window.addEventListener('hashchange', () => this.checkUrlHash());
  },
  
  // Data laden
  async loadData: function() {
    try {
      this.showLoading();
      
      const cached = this.getCachedData();
      if (cached) {
        this.data.csvData = cached.data;
        this.data.lastFetch = cached.timestamp;
        this.buildGrid();
        return;
      }
      
      const response = await fetch(this.config.csvUrl);
      if (!response.ok) {
        throw new Error(`CSV kon niet worden geladen (${response.status})`);
      }
      
      const csv = await response.text();
      const parsedData = this.parseCSV(csv);
      this.data.csvData = parsedData;
      this.data.lastFetch = Date.now();
      this.saveToCache(parsedData);
      this.buildGrid();
      
      // Controleer URL hash na data laden
      setTimeout(() => this.checkUrlHash(), 500);
      
    } catch (error) {
      console.error("Data laden mislukt:", error);
      this.handleError(error.message);
    } finally {
      this.hideLoading();
    }
  },
  
  // Toon laadindicator
  showLoading: function() {
    this.data.isLoading = true;
    if (this.elements.container) {
      this.elements.container.innerHTML = '<div class="loader-spinner"></div>';
    }
  },
  
  // Verberg laadindicator
  hideLoading: function() {
    this.data.isLoading = false;
    const spinner = this.elements.container?.querySelector('.loader-spinner');
    if (spinner) spinner.remove();
  },
  
  // Toon foutmelding
  handleError: function(message) {
    this.data.hasError = true;
    this.data.errorMessage = message;
    if (this.elements.container) {
      this.elements.container.innerHTML = `
        <div class="error-message">
          <h3>Er is een probleem opgetreden</h3>
          <p>${message}</p>
          <button onclick="LessentabellenApp.loadData()">Opnieuw proberen</button>
        </div>
      `;
    }
  },
  
  // Cache data ophalen
  getCachedData: function() {
    try {
      const cached = localStorage.getItem('lessentabellen_cache');
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > this.config.cacheExpiry) {
        localStorage.removeItem('lessentabellen_cache');
        return null;
      }
      
      return { data, timestamp };
    } catch (e) {
      console.warn('Cache lezen mislukt:', e);
      return null;
    }
  },
  
// Data naar cache schrijven
  saveToCache: function(data) {
    try {
      localStorage.removeItem('lessentabellen_cache'); // Verwijder oude cache
      const cache = {
        data: data,
        timestamp: Date.now()
      };
      localStorage.setItem('lessentabellen_cache', JSON.stringify(cache));
    } catch (e) {
      console.warn('Cache opslaan mislukt:', e);
    }
  },
  
  // CSV parsen
  parseCSV: function(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(";").map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(";").map(v => v.trim());
      return headers.reduce((obj, key, i) => {
        obj[key] = values[i] || '';
        return obj;
      }, {});
    });
  },
  
  // Normaliseer domeinnaam
  normalizeDomainName: function(rawDomain) {
    let d = rawDomain.toLowerCase().trim();
    d = d.replace(/[\s&]+/g, "-");
    
    if (d.includes("sport") && d.includes("topsport")) {
      return "topsport";
    }
    
    if (d === "economie-en-organisatie") {
      return "economie-organisatie";
    }
    
    return d;
  },
  
  // Slugify tekst voor URL
  slugify: function(text) {
    return text.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[\/]/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  },
  
  // Stel dynamische top positie in
  setDynamicTop: function() {
    if (!this.elements.slidein) return;
    
    // Voor mobiel, gebruik bottom positionering
    if (this.data.isMobile) {
      this.elements.slidein.style.top = "auto";
      this.elements.slidein.style.bottom = "0";
      this.elements.slidein.style.height = "85%";
      return;
    }
    
    // Desktop versie - zoek headers en topbars
    const header = document.querySelector('.Header--top') || 
                   document.querySelector("header") || 
                   document.body;
    
    const topbar = document.getElementById('custom-topbar') || 
                  document.querySelector('.announcement-bar-wrapper');
    
    let totalHeight = 0;
    
    // Bereken header hoogte als deze zichtbaar is
    if (header) {
      const headerRect = header.getBoundingClientRect();
      const headerStyle = window.getComputedStyle(header);
      
      if (headerStyle.position === 'fixed' || headerStyle.position === 'sticky') {
        totalHeight += headerRect.height;
      }
    }
    
    // Voeg topbar hoogte toe als deze zichtbaar is
    if (topbar) {
      const topbarStyle = window.getComputedStyle(topbar);
      if (topbarStyle.display !== 'none' && 
          (topbarStyle.position === 'fixed' || topbarStyle.position === 'sticky')) {
        totalHeight += topbar.getBoundingClientRect().height;
      }
    }
    
    // Voeg veiligheidsmarge toe
    totalHeight = Math.max(totalHeight, 60);
    
    // Pas slidein positie aan
    this.elements.slidein.style.top = totalHeight + "px";
    this.elements.slidein.style.height = `calc(100% - ${totalHeight}px)`;
    document.documentElement.style.setProperty('--dynamic-top', `${totalHeight}px`);
  },
  
  // Bouw grid
  buildGrid: function() {
    if (!this.elements.container || !this.data.csvData) return;
    
    const structuur = this.organizeData();
    this.elements.container.innerHTML = "";
    
    if (Object.keys(structuur).length === 0) {
      this.elements.container.innerHTML = `
        <div class="not-found-message">
          <p>Geen lessentabellen gevonden.</p>
        </div>
      `;
      return;
    }
    
    for (const [normDomainKey, graden] of Object.entries(structuur)) {
      const block = document.createElement("div");
      block.className = "domain-block";
      block.dataset.domain = normDomainKey;
      
      const colors = this.config.domainColors[normDomainKey];
      if (colors) {
        block.style.setProperty("--domain-base", colors.base);
        block.style.setProperty("--domain-mid", colors.mid);
        block.style.setProperty("--domain-light1", colors.light1);
        block.style.setProperty("--domain-light2", colors.light1);
        block.style.setProperty("--domain-hover", colors.hover);
      }
      
      block.innerHTML = `<h2>${this.data.domainDisplayNames[normDomainKey]}</h2>`;
      
      ["TWEEDE GRAAD", "DERDE GRAAD"].forEach(graadKey => {
        const finaliteiten = graden[graadKey];
        if (!finaliteiten) return;
        
        const graadContainer = document.createElement("div");
        graadContainer.className = "graad-container";
        graadContainer.innerHTML = `<h3>${graadKey}</h3>`;
        
        for (const [finaliteit, richtingen] of Object.entries(finaliteiten)) {
          const finBlok = document.createElement("div");
          finBlok.className = "finaliteit-blok";
          finBlok.innerHTML = `<h4>${finaliteit}</h4>`;
          
          const ul = document.createElement("ul");
          richtingen.forEach(richting => {
            const linkSlug = this.slugify(richting);
            const li = document.createElement("li");
            li.innerHTML = `<a href="#${graadKey.toLowerCase()}-${linkSlug}" 
              data-graad="${graadKey}" 
              data-slug="${linkSlug}" 
              data-domain="${normDomainKey}">${richting}</a>`;
              
            li.querySelector('a').addEventListener('click', (e) => {
              e.preventDefault();
              this.openSlidein(graadKey, linkSlug, normDomainKey);
            });
            
            ul.appendChild(li);
          });
          
          finBlok.appendChild(ul);
          graadContainer.appendChild(finBlok);
        }
        
        block.appendChild(graadContainer);
      });
      
      this.elements.container.appendChild(block);
    }
  },
  
  // Organiseer data in structuur
  organizeData: function() {
    if (!this.data.csvData) return {};
    
    const structuur = {};
    const seen = new Set();
    this.data.domainDisplayNames = {};
    
    this.data.csvData.forEach(r => {
      const rawDomain = r.domein?.trim() || "";
      if (!rawDomain) return;
      
      const normDomain = this.normalizeDomainName(rawDomain);
      if (!this.data.domainDisplayNames[normDomain]) {
        this.data.domainDisplayNames[normDomain] = rawDomain.toUpperCase();
      }
      
      const graadLabel = r.graad?.trim() || "";
      let graad = "";
      
      if (graadLabel.toLowerCase().includes("2de")) {
        graad = "TWEEDE GRAAD";
      } else if (graadLabel.toLowerCase().includes("3de")) {
        graad = "DERDE GRAAD";
      }
      
      const finaliteit = r.finaliteit?.trim() || "";
      const richting = r.titel?.trim() || "";
      
      if (!normDomain || !graad || !finaliteit || !richting) return;
      
      const key = `${normDomain}|${graad}|${finaliteit}|${richting}`;
      if (seen.has(key)) return;
      seen.add(key);
      
      if (!structuur[normDomain]) {
        structuur[normDomain] = {};
      }
      
      if (!structuur[normDomain][graad]) {
        structuur[normDomain][graad] = {};
      }
      
      if (!structuur[normDomain][graad][finaliteit]) {
        structuur[normDomain][graad][finaliteit] = [];
      }
      
      structuur[normDomain][graad][finaliteit].push(richting);
    });
    
    return structuur;
  },
  
  // Open slidein panel
  openSlidein: function(graad, slug, normDomainKey) {
    if (!this.elements.slidein || !this.elements.overlay) return;
    
    // Reset eventuele eerdere stijlen
    this.elements.slidein.removeAttribute('style');
    
    // Stel de correct layout in op basis van dynamic top
    this.setDynamicTop();
    
    const colors = this.config.domainColors[normDomainKey];
    if (colors) {
      this.elements.slidein.style.setProperty("--domain-base", colors.base);
      this.elements.slidein.style.setProperty("--domain-mid", colors.mid);
      this.elements.slidein.style.setProperty("--domain-light1", colors.light1);
      this.elements.slidein.style.setProperty("--domain-light2", colors.light1);
      this.elements.slidein.style.setProperty("--hover-row", colors.hover);
      this.elements.slidein.style.background = colors.light1;
      
      const titelElement = document.getElementById("opleiding-titel");
      if (titelElement) {
        titelElement.style.color = colors.base;
      }
    }
    
    this.elements.slidein.classList.add("open");
    this.elements.overlay.classList.add("show");
    
    const datum = new Date().toLocaleDateString("nl-BE", {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    document.getElementById("datum-print").innerText = datum;
    
    const filteredData = this.filterDataByGraadAndSlug(graad, slug);
    const richtingData = filteredData[0] || {};
    
    const titelElement = document.getElementById("opleiding-titel");
    const beschrijvingElement = document.getElementById("opleiding-beschrijving");
    
    if (titelElement) {
      titelElement.innerText = richtingData.titel || "Onbekend";
    }
    
    if (beschrijvingElement) {
      beschrijvingElement.innerText = richtingData.beschrijving || "";
    }
    
    const brochureLink = document.getElementById("brochure-link");
    if (brochureLink) {
      if (richtingData.brochure) {
        brochureLink.href = richtingData.brochure;
        brochureLink.style.display = "inline-flex";
      } else {
        brochureLink.style.display = "none";
      }
    }
    
    this.buildLessonTable(filteredData);
    document.body.style.overflow = "hidden";
    
    setTimeout(() => {
      this.elements.slidein.focus();
      const urlSlug = `${graad.toLowerCase().replace(/\s+/g, '-')}-${slug}`;
      history.pushState(
        { graad, slug, domain: normDomainKey },
        '', 
        `#${urlSlug}`
      );
    }, 100);
    
    this.data.currentRichting = { graad, slug, domain: normDomainKey };
  },
  
  // Filter data op graad en slug
  filterDataByGraadAndSlug: function(graad, slug) {
    if (!this.data.csvData) return [];
    
    return this.data.csvData.filter(r => {
      const rGraad = r.graad?.toLowerCase() || "";
      
      if (graad === "TWEEDE GRAAD" && rGraad.includes("2de")) {
        return this.slugify(r.titel) === slug;
      }
      
      if (graad === "DERDE GRAAD" && rGraad.includes("3de")) {
        return this.slugify(r.titel) === slug;
      }
      
      return false;
    });
  },
  
  // Sluit slidein panel
  closeSlidein: function() {
    if (!this.elements.slidein || !this.elements.overlay) return;
    
    this.elements.slidein.classList.remove("open");
    this.elements.overlay.classList.remove("show");
    document.body.style.overflow = "";
    history.pushState({}, '', location.pathname);
    this.data.currentRichting = null;
  },
  
  // Bouw lessentabel
  buildLessonTable: function(filteredData) {
    if (!this.elements.tableContainer) return;
    
    if (!filteredData || filteredData.length === 0) {
      this.elements.tableContainer.innerHTML = `
        <div class="error-message">
          <p>Geen lessentabel beschikbaar voor deze richting.</p>
        </div>`;
      document.getElementById("footnotes").innerHTML = "";
      return;
    }
    
    const klassen = [...new Set(filteredData.map(r => r.code))];
    const vakken = [...new Set(filteredData.map(r => r.label))];
    
    let tableHTML = `
      <table role="grid" aria-label="Lessentabel">
        <thead>
          <tr>
            <th scope="col">VAK</th>
            ${klassen.map(k => `<th scope="col">${k}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
    `;
    
    vakken.forEach(vak => {
      tableHTML += `<tr>`;
      tableHTML += `<td>${vak}</td>`;
      
      klassen.forEach(klas => {
        const cel = filteredData.find(r => r.code === klas && r.label === vak);
        tableHTML += `<td>${cel?.uren || ""}</td>`;
      });
      
      tableHTML += `</tr>`;
    });
    
    const showStageRow = klassen.some(klas =>
      filteredData.find(r => (
        r.code === klas && 
        r.stage_weken && 
        r.stage_weken.trim() !== "" && 
        r.stage_weken !== "0"
      ))
    );
    
    if (showStageRow) {
      tableHTML += `
        <tr class="stage-row">
          <td>Stage weken</td>
          ${klassen.map(klas => {
            const stageInfo = filteredData.find(r => r.code === klas)?.stage_weken || "";
            return `<td>${stageInfo}</td>`;
          }).join("")}
        </tr>
      `;
    }
    
    tableHTML += `</tbody></table>`;
    this.elements.tableContainer.innerHTML = tableHTML;
    
    const footnotesElement = document.getElementById("footnotes");
    if (footnotesElement) {
      const uniqueFootnotes = [...new Set(
        filteredData
          .map(r => (r.voetnoten || "").trim())
          .filter(v => v !== "")
      )];
      
      if (uniqueFootnotes.length > 0) {
        footnotesElement.innerHTML = `
          <p class="footnotes">${uniqueFootnotes.join(" &middot; ")}</p>
        `;
      } else {
        footnotesElement.innerHTML = "";
      }
    }
  },
  
  // Controleer URL hash
  checkUrlHash: function() {
    const hash = window.location.hash;
    if (!hash || hash === '#') return;
    
    const match = hash.substring(1).match(/^(tweede-graad|derde-graad)-(.+)$/);
    if (!match) return;
    
    const [, graadSlug, richtingSlug] = match;
    const graad = graadSlug === 'tweede-graad' ? 'TWEEDE GRAAD' : 'DERDE GRAAD';
    
    const richtingData = this.data.csvData?.find(r => {
      const rGraad = r.graad?.toLowerCase() || "";
      const isCorrectGraad = (
        (graad === "TWEEDE GRAAD" && rGraad.includes("2de")) ||
        (graad === "DERDE GRAAD" && rGraad.includes("3de"))
      );
      return isCorrectGraad && this.slugify(r.titel) === richtingSlug;
    });
    
    if (richtingData) {
      const normDomain = this.normalizeDomainName(richtingData.domein);
      this.openSlidein(graad, richtingSlug, normDomain);
    }
  }
};

// Initialisatie
document.addEventListener('DOMContentLoaded', function() {
  console.log("Document geladen, lessentabellen initialiseren...");
  LessentabellenApp.init(true);
});

// Globale beschikbaarheid
window.LessentabellenApp = LessentabellenApp;
