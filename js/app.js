/**
 * Investigation prototype — app bootstrap
 */
(function () {
  "use strict";

  const Engine = window.InvestigationEngine;
  const UI = window.InvestigationUI;

  let state = null;
  let resources = [];
  let casesList = [];
  let caseFilter = "active";
  let combineOpen = false;
  let activeTab = "pinned";
  let attributeTargetId = null;
  let applyResourceEntityId = null;

  function $(sel) {
    return document.querySelector(sel);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(function (s) {
      s.classList.toggle("active", s.id === id);
    });
  }

  function openOverlay(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("open");
      el.setAttribute("aria-hidden", "false");
    }
  }

  function closeOverlay(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("open");
      el.setAttribute("aria-hidden", "true");
    }
  }

  function setActiveTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".nav-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-nav") === tab);
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.getAttribute("data-tab") === tab);
    });
    refreshDossier();
  }

  function refreshDossier() {
    if (!state) return;
    ["pinned", "evidence", "people", "locations"].forEach(function (tab) {
      const panel = document.getElementById("tab-" + tab);
      if (panel) {
        UI.renderTab(state, tab, panel, { combinePicker: combineOpen });
      }
    });
    UI.updateBadges(state);
    bindEntityHandlers();
  }

  function bindEntityHandlers() {
    document.querySelectorAll(".entity-card").forEach(function (card) {
      const id = card.getAttribute("data-entity-id");
      if (!id) return;

      const pinBtn = card.querySelector("[data-pin]");
      if (pinBtn) {
        pinBtn.onclick = function (ev) {
          ev.stopPropagation();
          togglePin(id);
        };
      }

      card.querySelectorAll("[data-action]").forEach(function (btn) {
        btn.onclick = function (ev) {
          ev.stopPropagation();
          const action = btn.getAttribute("data-action");
          handleCardAction(id, action);
        };
      });

      card.querySelectorAll(".entity-link").forEach(function (link) {
        link.onclick = function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          const linkId = link.getAttribute("data-link-id");
          openEntityDetail(linkId);
        };
      });

      card.onclick = function () {
        if (combineOpen) {
          if (Engine.canSelectForCombine(state, id, state.combineSlots)) {
            loadCombineSlot(id);
          }
        } else {
          openEntityDetail(id);
        }
      };
    });
  }

  function togglePin(id) {
    const idx = state.pins.indexOf(id);
    if (idx >= 0) state.pins.splice(idx, 1);
    else state.pins.push(id);
    refreshDossier();
  }

  function handleCardAction(entityId, action) {
    const entity = Engine.getEntity(state, entityId);
    if (!entity) return;

    if (action === "load-slot") {
      loadCombineSlot(entityId);
      return;
    }
    if (action === "attribute") {
      openAttributePicker(entityId);
      return;
    }
    if (action === "apply-resource") {
      openApplyResource(entityId);
      return;
    }
    if (action === "inspect" || action === "interview" || action === "search") {
      Engine.runPrimaryAction(state, entityId);
      refreshDossier();
      openEntityDetail(entityId);
      return;
    }
  }

  function loadCombineSlot(entityId) {
    if (!Engine.canSelectForCombine(state, entityId, state.combineSlots)) return;
    if (!state.combineSlots.a) state.combineSlots.a = entityId;
    else if (!state.combineSlots.b && state.combineSlots.a !== entityId) {
      state.combineSlots.b = entityId;
    } else if (state.combineSlots.a === entityId || state.combineSlots.b === entityId) {
      return;
    }
    UI.updateCombineSlots(state);
    refreshDossier();
  }

  function clearCombineSlots() {
    state.combineSlots = { a: null, b: null };
    document.getElementById("combine-result").textContent = "—";
    document.getElementById("combine-result").classList.remove("has-result");
    UI.updateCombineSlots(state);
    refreshDossier();
  }

  function runCombine() {
    const a = state.combineSlots.a;
    const b = state.combineSlots.b;
    const resultEl = document.getElementById("combine-result");
    if (!a || !b) return;

    const out = Engine.combine(state, a, b);
    if (!out.match) {
      resultEl.textContent = "";
      resultEl.classList.remove("has-result");
      return;
    }
    if (out.result && out.resultEntity) {
      resultEl.textContent = out.resultEntity.name;
      resultEl.classList.add("has-result");
    } else {
      resultEl.textContent = "";
      resultEl.classList.remove("has-result");
    }
    refreshDossier();
    UI.updateBadges(state);
  }

  function openEntityDetail(entityId) {
    const e = Engine.getEntity(state, entityId);
    if (!e || !e.visible) return;
    Engine.markViewed(state, entityId);
    document.getElementById("detail-title").textContent = e.name;
    const body = document.getElementById("detail-body");
    body.innerHTML = UI.renderEntityCard(state, e, {});
    const innerCard = body.querySelector(".entity-card");
    if (innerCard) {
      innerCard.querySelectorAll("[data-action]").forEach(function (btn) {
        btn.onclick = function (ev) {
          ev.stopPropagation();
          closeOverlay("overlay-detail");
          handleCardAction(entityId, btn.getAttribute("data-action"));
        };
      });
      innerCard.querySelector(".pin-btn").onclick = function () {
        togglePin(entityId);
        openEntityDetail(entityId);
      };
    }
    openOverlay("overlay-detail");
    refreshDossier();
  }

  function openAttributePicker(nameRefId) {
    attributeTargetId = nameRefId;
    const ref = Engine.getEntity(state, nameRefId);
    document.getElementById("attribute-context").textContent =
      'Link "' + ref.name + '" to a person record:';
    const picker = document.getElementById("attribute-picker");
    const people = Engine.listVisible(state, function (e) {
      return e.type === "Person";
    });
    picker.innerHTML = people
      .map(function (p) {
        return (
          '<button type="button" class="person-option" data-person-id="' +
          p.id +
          '">' +
          UI.escapeHtml(p.name) +
          " (" +
          p.id +
          ")</button>"
        );
      })
      .join("");
    picker.querySelectorAll(".person-option").forEach(function (btn) {
      btn.onclick = function () {
        Engine.attributeName(state, nameRefId, btn.getAttribute("data-person-id"));
        closeOverlay("overlay-attribute");
        refreshDossier();
      };
    });
    openOverlay("overlay-attribute");
  }

  function openApplyResource(entityId) {
    applyResourceEntityId = entityId;
    const e = Engine.getEntity(state, entityId);
    document.getElementById("apply-resource-context").textContent =
      "Apply to: " + e.name + " (" + e.id + ")";
    UI.renderApplyResourceList(state, e, resources, document.getElementById("apply-resource-list"));
    document.getElementById("apply-resource-list").querySelectorAll("[data-resource-id]").forEach(function (btn) {
      btn.onclick = function () {
        const resId = btn.getAttribute("data-resource-id");
        const out = Engine.applyResource(state, resId, entityId);
        closeOverlay("overlay-apply-resource");
        if (out.match && out.resultEntity) {
          refreshDossier();
        } else {
          refreshDossier();
        }
      };
    });
    openOverlay("overlay-apply-resource");
  }

  function startCase(caseData) {
    state = Engine.cloneState(caseData);
    const meta = casesList.find(function (c) {
      return c.id === caseData.caseId;
    });
    document.getElementById("case-ref").textContent =
      (meta && meta.ref) || caseData.caseRef || "—";
    document.getElementById("case-title").textContent = caseData.caseName;
    combineOpen = false;
    showScreen("screen-case");
    setActiveTab("pinned");
  }

  function caseMatchesFilter(c, filter) {
    if (filter === "closed") return c.status === "closed";
    if (filter === "active") return c.status === "active";
    if (filter === "open") return c.status === "active" || c.status === "open";
    return false;
  }

  function countCasesForFilter(filter) {
    return casesList.filter(function (c) {
      return caseMatchesFilter(c, filter);
    }).length;
  }

  function statLabel(key, n) {
    if (n === 1) {
      if (key === "Locations") return "Location";
      if (key === "People") return "Person";
    }
    return key;
  }

  function renderCaseStatsHtml(stats) {
    if (!stats) return "";
    return (
      '<div class="case-card-stats">' +
      ["Locations", "Evidence", "People"]
        .filter(function (key) {
          return stats[key] != null;
        })
        .map(function (key) {
          const n = stats[key];
          return (
            '<div class="case-stat">' +
            '<span class="case-stat-label">' +
            UI.escapeHtml(statLabel(key, n)) +
            "</span>" +
            '<span class="case-stat-value">' +
            n +
            "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderCasesList() {
    const container = document.getElementById("cases-list");
    const filtered = casesList.filter(function (c) {
      return caseMatchesFilter(c, caseFilter);
    });
    if (!filtered.length) {
      container.innerHTML = '<p class="empty-tab">No cases in this category.</p>';
      return;
    }
    container.innerHTML = filtered
      .map(function (c) {
        const statusClass = c.status === "closed" ? " inactive" : "";
        const locked = !c.playable ? " case-card-locked" : "";
        return (
          '<button type="button" class="case-card' +
          locked +
          '" data-case-id="' +
          c.id +
          '"' +
          (c.playable ? "" : " disabled") +
          ">" +
          '<div class="case-card-folder"><span class="case-card-ref">' +
          UI.escapeHtml(c.ref) +
          "</span></div>" +
          '<div class="case-card-body">' +
          '<div class="case-card-main">' +
          '<div class="case-card-status' +
          statusClass +
          '"><span class="dot"></span> ' +
          c.status.toUpperCase() +
          "</div>" +
          '<h2 class="case-card-title">' +
          UI.escapeHtml(c.title) +
          "</h2>" +
          '<p class="case-card-category">' +
          UI.escapeHtml(c.category) +
          "</p>" +
          renderCaseStatsHtml(c.stats) +
          "</div>" +
          "</div></button>"
        );
      })
      .join("");

    container.querySelectorAll(".case-card:not(:disabled)").forEach(function (btn) {
      btn.onclick = function () {
        const id = btn.getAttribute("data-case-id");
        if (id === "case1") {
          startCase(getCaseData());
        }
      };
    });
  }

  function formatCaseCount(n) {
    return n === 1 ? "1 case" : n + " cases";
  }

  function updateCaseTabCounts() {
    ["active", "open", "closed"].forEach(function (status) {
      const n = countCasesForFilter(status);
      const el = document.getElementById("count-" + status);
      if (el) el.textContent = formatCaseCount(n);
    });
  }

  function openResourcesCatalogue() {
    UI.renderResourcesCatalogue(resources, document.getElementById("resources-catalogue"));
    openOverlay("overlay-resources");
  }

  function getCaseData() {
    if (!window.CASE1_DATA) throw new Error("Case data not loaded");
    return window.CASE1_DATA;
  }

  function renderLandingVersion() {
    const el = document.getElementById("landing-version");
    const version = window.APP_DATA && window.APP_DATA.version;
    if (el && version) {
      el.textContent = "v" + version;
    }
  }

  function loadAllData() {
    if (!window.APP_DATA || !window.CASE1_DATA || !window.RESOURCES_DATA || !window.CASES_LIST_DATA) {
      throw new Error("Data scripts missing");
    }
    renderLandingVersion();
    resources = window.RESOURCES_DATA.resources || [];
    casesList = window.CASES_LIST_DATA.cases || [];
    window.__caseData = window.CASE1_DATA;
    updateCaseTabCounts();
    renderCasesList();
    return window.CASE1_DATA;
  }

  function wireEvents() {
    document.getElementById("btn-start-investigating").onclick = function () {
      showScreen("screen-cases");
      renderCasesList();
    };

    document.getElementById("btn-back-cases").onclick = function () {
      combineOpen = false;
      showScreen("screen-cases");
    };

    document.getElementById("btn-resources-case").onclick = openResourcesCatalogue;

    document.querySelectorAll(".case-tab").forEach(function (tab) {
      tab.onclick = function () {
        document.querySelectorAll(".case-tab").forEach(function (t) {
          t.classList.toggle("active", t === tab);
        });
        caseFilter = tab.getAttribute("data-case-filter");
        renderCasesList();
      };
    });

    document.querySelectorAll(".nav-tab").forEach(function (btn) {
      btn.onclick = function () {
        setActiveTab(btn.getAttribute("data-nav"));
      };
    });

    document.getElementById("btn-combine-fab").onclick = function () {
      combineOpen = true;
      openOverlay("overlay-combine");
      UI.updateCombineSlots(state);
      refreshDossier();
    };

    document.getElementById("btn-combine-close").onclick = function () {
      combineOpen = false;
      closeOverlay("overlay-combine");
      refreshDossier();
    };

    document.getElementById("btn-combine-clear").onclick = clearCombineSlots;
    document.getElementById("btn-combine-run").onclick = runCombine;

    document.getElementById("slot-a").onclick = function () {
      state.slotTarget = "a";
    };
    document.getElementById("slot-b").onclick = function () {
      state.slotTarget = "b";
    };

    document.getElementById("btn-resources-close").onclick = function () {
      closeOverlay("overlay-resources");
    };
    document.getElementById("btn-apply-resource-close").onclick = function () {
      closeOverlay("overlay-apply-resource");
    };
    document.getElementById("btn-detail-close").onclick = function () {
      closeOverlay("overlay-detail");
    };
    document.getElementById("btn-attribute-close").onclick = function () {
      closeOverlay("overlay-attribute");
    };

    document.getElementById("overlay-combine").onclick = function (ev) {
      if (ev.target.id === "overlay-combine") {
        combineOpen = false;
        closeOverlay("overlay-combine");
        refreshDossier();
      }
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      loadAllData();
    } catch (err) {
      console.error(err);
    }
    wireEvents();
  });
})();
