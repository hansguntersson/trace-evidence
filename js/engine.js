/**
 * Investigation — combination & entity engine
 */
(function (global) {
  "use strict";

  const PERSON_TYPES = new Set(["Person"]);

  function cloneState(caseData) {
    const entities = {};
    caseData.entities.forEach(function (e) {
      entities[e.id] = Object.assign({}, e, {
        links: (e.links || []).slice(),
        compatibleResources: (e.compatibleResources || []).slice(),
      });
    });
    return {
      caseId: caseData.caseId,
      caseRef: caseData.caseRef,
      caseName: caseData.caseName,
      entities: entities,
      combinations: caseData.combinations || [],
      resourceActions: caseData.resourceActions || [],
      pins: (caseData.initialPins || []).slice(),
      combineSlots: { a: null, b: null },
      slotTarget: "a",
      viewed: {},
      usedCombinations: {},
      usedResourceActions: {},
    };
  }

  function getEntity(state, id) {
    return state.entities[id] || null;
  }

  function isPerson(entity) {
    return entity && PERSON_TYPES.has(entity.type);
  }

  function isVisible(entity) {
    return entity && entity.visible;
  }

  function resolveTab(state, entity) {
    if (entity.type === "Statement") {
      const personLink = (entity.links || []).find(function (id) {
        const p = state.entities[id];
        return p && p.type === "Person";
      });
      return personLink ? "people" : "evidence";
    }
    if (entity.type === "PersonDetail") return "people";
    return tabForEntity(entity);
  }

  function tabForEntity(entity) {
    if (!entity) return "evidence";
    switch (entity.type) {
      case "Person":
        return "people";
      case "Location":
        return "locations";
      case "PhysicalEvidence":
      case "DigitalEvidence":
      case "Record":
      case "NameReference":
        return "evidence";
      default:
        return "evidence";
    }
  }

  function addBidirectionalLink(state, idA, idB) {
    if (!idA || !idB || idA === idB) return;
    const a = state.entities[idA];
    const b = state.entities[idB];
    if (!a || !b) return;
    if (!a.links.includes(idB)) a.links.push(idB);
    if (!b.links.includes(idA)) b.links.push(idA);
  }

  function revealEntity(state, id) {
    const e = state.entities[id];
    if (!e) return null;
    if (!e.visible) {
      e.visible = true;
      e.unread = true;
    }
    return e;
  }

  function markViewed(state, id) {
    const e = state.entities[id];
    if (!e) return;
    state.viewed[id] = true;
    e.unread = false;
  }

  function pairKey(id1, id2) {
    return [id1, id2].sort().join("|");
  }

  function findCombination(state, id1, id2) {
    const key = pairKey(id1, id2);
    return state.combinations.find(function (c) {
      return pairKey(c.input1, c.input2) === key;
    });
  }

  function findResourceAction(state, resourceId, entityId) {
    return state.resourceActions.find(function (a) {
      return (
        a.resourceId === resourceId &&
        a.entityId === entityId &&
        !state.usedResourceActions[a.id]
      );
    });
  }

  function applyResult(state, resultId) {
    if (!resultId) return null;
    return revealEntity(state, resultId);
  }

  function combine(state, id1, id2) {
    if (!id1 || !id2 || id1 === id2) return { ok: false, reason: "invalid" };
    const rule = findCombination(state, id1, id2);
    if (!rule) return { ok: true, match: false };

    const comboKey = rule.id;
    if (state.usedCombinations[comboKey]) {
      return { ok: true, match: true, alreadyUsed: true, result: null };
    }

    state.usedCombinations[comboKey] = true;
    const resultEntity = applyResult(state, rule.result);
    return {
      ok: true,
      match: true,
      result: rule.result,
      resultEntity: resultEntity,
      note: rule.resultNote,
    };
  }

  function applyResource(state, resourceId, entityId) {
    const action = findResourceAction(state, resourceId, entityId);
    if (!action) return { ok: true, match: false };
    state.usedResourceActions[action.id] = true;
    const resultEntity = applyResult(state, action.result);
    return {
      ok: true,
      match: true,
      result: action.result,
      resultEntity: resultEntity,
    };
  }

  function attributeName(state, nameRefId, personId) {
    const ref = state.entities[nameRefId];
    const person = state.entities[personId];
    if (!ref || ref.type !== "NameReference" || !person || !isPerson(person)) {
      return { ok: false };
    }
    ref.resolvedTo = personId;
    ref.unread = false;
    addBidirectionalLink(state, nameRefId, personId);
    return { ok: true };
  }

  function inspectEntity(state, entityId) {
    const e = state.entities[entityId];
    if (!e) return [];
    return (e.links || [])
      .map(function (id) {
        return state.entities[id];
      })
      .filter(function (linked) {
        return (
          linked &&
          (linked.type === "PersonDetail" || linked.type === "Statement") &&
          linked.visible
        );
      });
  }

  function searchLocation(state, locationId) {
    const loc = state.entities[locationId];
    if (!loc || loc.type !== "Location") return [];
    return (loc.links || [])
      .map(function (id) {
        return state.entities[id];
      })
      .filter(function (e) {
        return e && !e.visible;
      });
  }

  function interviewPerson(state, personId) {
    const person = state.entities[personId];
    if (!person || !isPerson(person)) return [];
    return (person.links || [])
      .map(function (id) {
        return state.entities[id];
      })
      .filter(function (e) {
        return e && e.type === "Statement" && !e.visible;
      });
  }

  function primaryAction(state, entity) {
    if (!entity) return null;
    switch (entity.type) {
      case "Location":
        return "search";
      case "Person":
        return "interview";
      case "PhysicalEvidence":
      case "DigitalEvidence":
      case "Record":
        return "inspect";
      case "NameReference":
        return entity.resolvedTo ? null : "attribute";
      default:
        return null;
    }
  }

  function runPrimaryAction(state, entityId) {
    const e = state.entities[entityId];
    const action = primaryAction(state, e);
    if (!action) return { ok: false };

    if (action === "inspect") {
      const details = inspectEntity(state, entityId);
      details.forEach(function (d) {
        revealEntity(state, d.id);
      });
      return { ok: true, action: "inspect", revealed: details.map(function (d) {
        return d.id;
      }) };
    }
    if (action === "interview") {
      const stmts = interviewPerson(state, entityId);
      stmts.forEach(function (s) {
        revealEntity(state, s.id);
      });
      return { ok: true, action: "interview", revealed: stmts.map(function (s) {
        return s.id;
      }) };
    }
    if (action === "search") {
      const found = searchLocation(state, entityId);
      found.forEach(function (x) {
        revealEntity(state, x.id);
      });
      return { ok: true, action: "search", revealed: found.map(function (x) {
        return x.id;
      }) };
    }
    return { ok: false };
  }

  function listVisible(state, filterFn) {
    return Object.keys(state.entities)
      .map(function (id) {
        return state.entities[id];
      })
      .filter(function (e) {
        return isVisible(e) && (!filterFn || filterFn(e));
      })
      .sort(function (a, b) {
        return a.id.localeCompare(b.id);
      });
  }

  function unreadCountForTab(state, tab) {
    return listVisible(state, function (e) {
      return e.unread && resolveTab(state, e) === tab;
    }).length;
  }

  function pinnedUnread(state) {
    return state.pins.filter(function (id) {
      const e = state.entities[id];
      return e && e.visible && e.unread;
    }).length;
  }

  function canSelectForCombine(state, entityId, slots) {
    const e = state.entities[entityId];
    if (!e || !isVisible(e)) return false;
    const filled = [slots.a, slots.b].filter(Boolean);
    if (filled.indexOf(entityId) >= 0) return true;
    if (slots.a && slots.b) return false;
    const otherId = slots.a || slots.b;
    if (otherId) {
      const other = state.entities[otherId];
      if (other && isPerson(other) && isPerson(e)) return false;
    }
    return true;
  }

  function personLockActive(state, slots) {
    const otherId = slots.a || slots.b;
    if (!otherId) return false;
    return isPerson(state.entities[otherId]);
  }

  global.InvestigationEngine = {
    cloneState: cloneState,
    getEntity: getEntity,
    isPerson: isPerson,
    isVisible: isVisible,
    resolveTab: resolveTab,
    combine: combine,
    applyResource: applyResource,
    attributeName: attributeName,
    runPrimaryAction: runPrimaryAction,
    primaryAction: primaryAction,
    revealEntity: revealEntity,
    markViewed: markViewed,
    listVisible: listVisible,
    unreadCountForTab: unreadCountForTab,
    pinnedUnread: pinnedUnread,
    canSelectForCombine: canSelectForCombine,
    personLockActive: personLockActive,
    addBidirectionalLink: addBidirectionalLink,
  };
})(window);
