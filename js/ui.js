/**
 * Investigation — UI rendering
 */
(function (global) {
  "use strict";

  const Engine = global.InvestigationEngine;

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function linkifyValue(state, value, onLinkClick) {
    const text = escapeHtml(value || "");
    const ids = Object.keys(state.entities).filter(function (id) {
      const e = state.entities[id];
      return e.visible && value && value.indexOf(e.name) >= 0;
    });
    let html = text;
    ids.forEach(function (id) {
      const e = state.entities[id];
      if (!e.name || e.name.length < 2) return;
      const pattern = new RegExp("\\b" + e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi");
      html = html.replace(pattern, function (match) {
        return (
          '<a href="#" class="entity-link" data-link-id="' +
          id +
          '">' +
          match +
          "</a>"
        );
      });
    });
    return html;
  }

  function pinIconMarkup() {
    return '<img class="pin-icon" src="images/pin.png" alt="" width="22" height="22">';
  }

  function renderEntityCard(state, entity, options) {
    const opts = options || {};
    const listView = opts.listView === true;
    const pinned = state.pins.indexOf(entity.id) >= 0;
    const unread = entity.unread ? " unread" : "";
    const nameRefCls =
      entity.type === "NameReference" && !entity.resolvedTo
        ? " name-ref-unresolved"
        : "";
    const lockDim =
      opts.personLock && Engine.isPerson(entity) && !opts.canCombine
        ? ' style="opacity:0.35;pointer-events:none"'
        : "";

    const action = listView ? null : Engine.primaryAction(state, entity);
    let actionBtn = "";
    if (!listView) {
      if (action === "attribute") {
        actionBtn =
          '<button type="button" class="btn-text primary" data-action="attribute">Attribute</button>';
      } else if (action === "inspect") {
        actionBtn =
          '<button type="button" class="btn-text primary" data-action="inspect">Inspect</button>';
      } else if (action === "interview") {
        actionBtn =
          '<button type="button" class="btn-text primary" data-action="interview">Interview</button>';
      } else if (action === "search") {
        actionBtn =
          '<button type="button" class="btn-text primary" data-action="search">Search</button>';
      }
    }

    const resources =
      !listView && (entity.compatibleResources || []).length > 0
        ? '<button type="button" class="btn-text" data-action="apply-resource">Apply resource</button>'
        : "";

    const resolvedLink =
      entity.type === "NameReference" && entity.resolvedTo
        ? state.entities[entity.resolvedTo]
        : null;
    const displayName =
      entity.type === "NameReference" && resolvedLink
        ? entity.name + " → " + resolvedLink.name
        : entity.name;

    const subtype =
      entity.subtype
        ? '<span class="entity-type">' + escapeHtml(entity.subtype) + "</span>"
        : "";

    return (
      '<article class="entity-card' +
      unread +
      nameRefCls +
      '" data-entity-id="' +
      entity.id +
      '"' +
      lockDim +
      ">" +
      '<button type="button" class="pin-btn' +
      (pinned ? " active" : "") +
      '" data-pin="' +
      entity.id +
      '" aria-label="' +
      (pinned ? "Unpin" : "Pin") +
      '">' +
      pinIconMarkup() +
      "</button>" +
      '<div class="entity-meta">' +
      '<span class="entity-id">' +
      escapeHtml(entity.id) +
      "</span>" +
      '<span class="entity-type">' +
      escapeHtml(entity.type) +
      "</span>" +
      subtype +
      "</div>" +
      "<h3 class=\"entity-name\">" +
      escapeHtml(displayName) +
      "</h3>" +
      '<p class="entity-value">' +
      linkifyValue(state, entity.value) +
      "</p>" +
      (!listView && entity.links && entity.links.length
        ? '<p class="entity-value" style="font-size:0.7rem;color:var(--muted)">Links: ' +
          entity.links
            .filter(function (lid) {
              const le = state.entities[lid];
              return le && le.visible;
            })
            .map(function (lid) {
              const le = state.entities[lid];
              return (
                '<a href="#" class="entity-link" data-link-id="' +
                lid +
                '">' +
                escapeHtml(le.name || lid) +
                "</a>"
              );
            })
            .join(", ") +
          "</p>"
        : "") +
      (actionBtn || resources || opts.combineMode
        ? '<div class="entity-actions">' +
          actionBtn +
          resources +
          (opts.combineMode
            ? '<button type="button" class="btn-text" data-action="load-slot">Add to combine</button>'
            : "") +
          "</div>"
        : "") +
      "</article>"
    );
  }

  function renderTab(state, tab, container, options) {
    const opts = options || {};
    let entities;
    if (tab === "pinned") {
      entities = state.pins
        .map(function (id) {
          return state.entities[id];
        })
        .filter(function (e) {
          return e && e.visible;
        });
    } else {
      entities = Engine.listVisible(state, function (e) {
        return Engine.resolveTab(state, e) === tab;
      });
    }

    if (!entities.length) {
      container.innerHTML =
        '<p class="empty-tab">' +
        (tab === "pinned" ? "Pin entities from any tab to work here." : "No entries.") +
        "</p>";
      return;
    }

    const personLock = Engine.personLockActive(state, state.combineSlots);
    container.innerHTML =
      '<div class="entity-list">' +
      entities
        .map(function (e) {
          const canCombine = Engine.canSelectForCombine(
            state,
            e.id,
            state.combineSlots
          );
          return renderEntityCard(state, e, {
            personLock: personLock,
            canCombine: canCombine,
            combineMode: opts.combinePicker,
            listView: !opts.combinePicker,
          });
        })
        .join("") +
      "</div>";
  }

  function updateBadges(state) {
    ["pinned", "evidence", "people", "locations"].forEach(function (tab) {
      const badge = document.querySelector('[data-badge="' + tab + '"]');
      if (!badge) return;
      const count =
        tab === "pinned"
          ? Engine.pinnedUnread(state)
          : Engine.unreadCountForTab(state, tab);
      badge.textContent = count > 0 ? (count > 99 ? "99+" : String(count)) : "";
      badge.classList.toggle("visible", count > 0);
    });
  }

  function renderResourcesCatalogue(resources, container) {
    const byCategory = {};
    resources.forEach(function (r) {
      if (!byCategory[r.category]) byCategory[r.category] = [];
      byCategory[r.category].push(r);
    });
    let html = "";
    Object.keys(byCategory)
      .sort()
      .forEach(function (cat) {
        html += '<section class="resource-category"><h3>' + escapeHtml(cat) + "</h3>";
        byCategory[cat].forEach(function (r) {
          html +=
            '<div class="resource-item">' +
            '<div class="res-name">' +
            escapeHtml(r.name) +
            " (" +
            escapeHtml(r.id) +
            ")</div>" +
            '<div class="res-desc">' +
            escapeHtml(r.description) +
            "</div>" +
            '<div class="res-cost">Time: ' +
            r.timeCost +
            " · Budget: £" +
            r.budgetCost +
            "</div></div>";
        });
        html += "</section>";
      });
    container.innerHTML = html;
  }

  function renderApplyResourceList(state, entity, resources, container) {
    const compatible = resources.filter(function (r) {
      return (r.compatibleTypes || []).indexOf(entity.type) >= 0;
    });
    if (!compatible.length) {
      container.innerHTML = '<p class="empty-tab">No compatible resources.</p>';
      return;
    }
    container.innerHTML = compatible
      .map(function (r) {
        const action = state.resourceActions.find(function (a) {
          return a.resourceId === r.id && a.entityId === entity.id;
        });
        const used = action && state.usedResourceActions[action.id];
        return (
          '<button type="button" class="menu-item" data-resource-id="' +
          r.id +
          '"' +
          (used ? " disabled style=\"opacity:0.4\"" : "") +
          ">" +
          escapeHtml(r.name) +
          "<br><span style=\"font-size:0.7rem;color:var(--muted)\">" +
          escapeHtml(r.description) +
          "</span></button>"
        );
      })
      .join("");
  }

  function updateCombineSlots(state) {
    const slotA = document.getElementById("slot-a");
    const slotB = document.getElementById("slot-b");
    const btn = document.getElementById("btn-combine-run");
    ["a", "b"].forEach(function (key) {
      const el = key === "a" ? slotA : slotB;
      const id = state.combineSlots[key];
      const content = el.querySelector(".slot-content");
      if (id) {
        const e = state.entities[id];
        el.classList.add("filled");
        content.textContent = e ? e.id + " — " + e.name : id;
      } else {
        el.classList.remove("filled");
        content.textContent = "Tap entity to load";
      }
    });
    btn.disabled = !(state.combineSlots.a && state.combineSlots.b);
  }

  global.InvestigationUI = {
    escapeHtml: escapeHtml,
    renderEntityCard: renderEntityCard,
    renderTab: renderTab,
    updateBadges: updateBadges,
    renderResourcesCatalogue: renderResourcesCatalogue,
    renderApplyResourceList: renderApplyResourceList,
    updateCombineSlots: updateCombineSlots,
    linkifyValue: linkifyValue,
  };
})(window);
