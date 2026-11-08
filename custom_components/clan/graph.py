"""Nodes, links and findings of the map, built from a plain snapshot of Home Assistant.

Nothing here imports Home Assistant: the logic runs in tests on recorded data.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
import json
import re
from typing import Any

STALE_AFTER = timedelta(days=7)
# restored states carry the start time, not the time the device last reported
SETTLE = timedelta(minutes=10)
# a silent app whose registration is older than this is abandoned; an account idle this long is unused
DORMANT_AFTER = timedelta(days=90)
# entries last modified before HA recorded modified_at hold the epoch; they are older than this
DATED_FROM = datetime(2024, 11, 6, tzinfo=UTC)

SILENT = {"unknown", "unavailable"}
ACTION_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
PERSON_RE = re.compile(r"\bperson\.[a-z0-9_]+")
TRACKER_RE = re.compile(r"\bdevice_tracker\.[a-z0-9_]+")
HEX_RE = re.compile(r"\b[0-9a-f]{32}\b")
UI_NODE = "ui:persistent"
UI_ACTIONS = {"persistent_notification.create", "notify.persistent_notification"}
# notify actions that are not a target
NOTIFY_BUILTIN = {"send_message", "persistent_notification"}
# node for notify actions whose service is a template
COMPUTED_NODE = "notify:computed"
# messaging actions outside notify.*; the integration is the target node
MESSAGING_ACTIONS = {"mastodon.post"}

TYPE_ORDER = {"user": 0, "person": 1, "device": 2, "tracker": 3, "notify": 4, "ui": 5, "routine": 6}
SEVERITY_ORDER = {"error": 0, "warn": 1, "info": 2}


def _time(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()] if "{{" not in value else [value]
    if isinstance(value, list):
        return [v for v in value if isinstance(v, str)]
    return []


def device_kind(*texts: str | None) -> str:
    text = " ".join(t for t in texts if t).lower()
    if re.search(r"\bwatch\b|\bsm-r\d", text):
        return "watch"
    if re.search(r"\bipad\b|\btablet\b|\bgalaxy tab\b|\btab [as]\d*\b", text):
        return "tablet"
    if re.search(r"\btv\b|\btelevision\b|\bshield\b|\bmibox\b|\bchromecast\b", text):
        return "tv"
    if re.search(r"\blaptop\b|\bmacbook\b|\bdesktop\b|\bwindows\b", text):
        return "computer"
    if re.search(r"phone|pixel|galaxy|redmi|xiaomi|realme|oneplus|android|\bios\b|\bsm-[a-z]", text):
        return "phone"
    return "device"


def tracker_kind(platform: str | None, source_type: str | None) -> str:
    if platform in ("tile", "bluetooth_le_tracker", "private_ble_device") or source_type in (
        "bluetooth",
        "bluetooth_le",
    ):
        return "tag"
    if source_type == "router" or platform in ("ping", "nmap_tracker", "unifi", "fritz", "synology_router"):
        return "network"
    return "tracker"


def action_calls(config: Any) -> Iterator[dict[str, Any]]:
    """Yield every action call in a config, nested ones included."""
    stack = [config]
    while stack:
        item = stack.pop()
        if isinstance(item, dict):
            action = item.get("action", item.get("service"))
            if isinstance(action, str) and (ACTION_RE.match(action) or ("{{" in action and "." in action)):
                yield item
            stack.extend(reversed(list(item.values())))
        elif isinstance(item, list):
            stack.extend(reversed(item))


def call_targets(call: dict[str, Any], key: str) -> list[str]:
    found: list[str] = []
    for holder in (call, call.get("target"), call.get("data")):
        if isinstance(holder, dict):
            found += _strings(holder.get(key))
    return found


class Builder:
    def __init__(self, snapshot: dict[str, Any]) -> None:
        self.snap = snapshot
        self.now = _time(snapshot["now"])
        self.started = _time(snapshot.get("started"))
        self.users = {u["id"]: u for u in snapshot.get("users", [])}
        self.persons = {p["entity_id"]: p for p in snapshot.get("persons", [])}
        self.entities: dict[str, dict] = snapshot.get("entities", {})
        self.devices: dict[str, dict] = snapshot.get("devices", {})
        self.apps = {a["entry_id"]: a for a in snapshot.get("apps", [])}
        self.app_by_device = {a["device_id"]: a for a in self.apps.values() if a.get("device_id")}
        self.notify: dict[str, dict] = snapshot.get("notify", {})
        self.services = set(snapshot.get("services", []))
        # device memory from earlier runs: {"seen": {device: time}, "quiet": {device: time}}
        memory = snapshot.get("memory") or {}
        self.memory = {key: dict(memory.get(key) or {}) for key in ("seen", "quiet")}
        self.nodes: dict[str, dict] = {}
        self.edges: dict[tuple[str, str, str], dict] = {}
        self.issues: list[dict] = []
        self.by_device: dict[str, list[str]] = {}
        for entity_id, entity in self.entities.items():
            if entity.get("device_id"):
                self.by_device.setdefault(entity["device_id"], []).append(entity_id)

    # building blocks

    def add(self, node_id: str, node_type: str, name: str, **fields: Any) -> dict:
        node = self.nodes.get(node_id)
        if node is None:
            node = self.nodes[node_id] = {"id": node_id, "type": node_type, "name": name, "flags": [], "info": {}}
        node.update(fields)
        return node

    def link(self, source: str, target: str, kind: str, label: str | None = None, **extra: Any) -> dict:
        edge = self.edges.get((source, target, kind))
        if edge is None:
            edge = self.edges[(source, target, kind)] = {"from": source, "to": target, "type": kind, "labels": []}
        if label and label not in edge["labels"]:
            edge["labels"].append(label)
        edge.update(extra)
        return edge

    def issue(self, severity: str, code: str, node: str, **params: Any) -> None:
        self.issues.append({"severity": severity, "code": code, "node": node, "params": params})

    def silent(self, last: str | None) -> bool:
        """True when the device only has restored states since the start."""
        return self.started is not None and (last is None or _time(last) < self.started + SETTLE)

    def age(self, value: str | None) -> timedelta | None:
        moment = _time(value)
        return self.now - moment if moment and self.now else None

    # nodes

    def device_node(self, device_id: str) -> str:
        node_id = f"device:{device_id}"
        if node_id in self.nodes:
            return node_id
        dev = self.devices.get(device_id, {})
        app = self.app_by_device.get(device_id)
        name = dev.get("name_by_user") or dev.get("name") or (app or {}).get("name") or device_id
        entities = self.by_device.get(device_id, [])
        info = {
            "device_id": device_id,
            "manufacturer": dev.get("manufacturer"),
            "model": dev.get("model"),
            "sw_version": dev.get("sw_version"),
            "area": dev.get("area"),
            "last_seen": dev.get("last_seen"),
            "silent": self.silent(dev.get("last_seen")),
            "trackers": sorted(e for e in entities if e.startswith("device_tracker.")),
            "notify": sorted(e for e in entities if e.startswith("notify.")),
            "services": [],
        }
        kind = device_kind(name, dev.get("model"), dev.get("manufacturer"), (app or {}).get("os"))
        node = self.add(node_id, "device", name, kind=kind, info=info)
        if dev.get("disabled"):
            node["flags"].append("disabled")
        if app:
            node["flags"].append("app")
            info["services"] = sorted(
                f"notify.{name}"
                for name, spec in self.notify.items()
                if spec.get("kind") == "app" and spec.get("entry_id") == app["entry_id"]
            )
            info["app"] = {
                "entry_id": app["entry_id"],
                "title": app.get("name"),
                "version": app.get("app_version"),
                "os": " ".join(x for x in (app.get("os"), app.get("os_version")) if x) or None,
                "push": app.get("push", False),
                "user": app.get("user_id"),
            }
            if not app.get("push"):
                node["flags"].append("no_push")
        return node_id

    def anchor(self, entity_id: str) -> str:
        """Node for an entity: its device if it has one."""
        entity = self.entities.get(entity_id)
        if entity and entity.get("device_id") in self.devices:
            return self.device_node(entity["device_id"])
        node_id = f"entity:{entity_id}"
        if node_id not in self.nodes:
            entity = entity or {}
            kind = tracker_kind(entity.get("platform"), entity.get("source_type"))
            self.add(
                node_id,
                "tracker" if entity_id.startswith("device_tracker.") else "notify",
                entity.get("name") or entity_id,
                kind=kind,
                info={
                    "entity_id": entity_id,
                    "platform": entity.get("platform"),
                    "state": entity.get("state"),
                    "last_seen": entity.get("last_seen"),
                },
            )
            if not self.entities.get(entity_id):
                self.nodes[node_id]["flags"].append("missing")
        return node_id

    def users_and_persons(self) -> None:
        for user in self.users.values():
            flags = [
                flag
                for flag, on in (
                    ("owner", user.get("is_owner")),
                    ("admin", user.get("is_admin")),
                    ("system", user.get("system_generated")),
                    ("inactive", not user.get("is_active", True)),
                    ("local_only", user.get("local_only")),
                    ("mfa", user.get("mfa")),
                    ("tokens", user.get("tokens")),
                )
                if on
            ]
            info = {
                key: user.get(key)
                for key in ("usernames", "providers", "groups", "mfa", "tokens", "sessions", "last_seen")
            }
            self.add(f"user:{user['id']}", "user", user.get("name") or user["id"], flags=flags, info=info)

        for person in self.persons.values():
            node_id = f"person:{person['entity_id']}"
            self.add(
                node_id,
                "person",
                person.get("name") or person["entity_id"],
                info={
                    "entity_id": person["entity_id"],
                    "state": person.get("state"),
                    "source": person.get("source"),
                    "picture": person.get("picture"),
                    "trackers": person.get("trackers", []),
                },
            )
            user_id = person.get("user_id")
            if user_id and user_id in self.users:
                self.link(f"user:{user_id}", node_id, "account")
            elif user_id:
                self.issue("error", "person_user_missing", node_id)
            else:
                self.issue("info", "person_no_user", node_id)
            if not person.get("trackers"):
                self.issue("info", "person_no_tracker", node_id)
            for tracker in person.get("trackers", []):
                target = self.anchor(tracker)
                self.link(node_id, target, "tracks", tracker, main=tracker == person.get("source") or None)
                if "missing" in self.nodes[target]["flags"]:
                    self.issue("error", "missing_tracker", node_id, entity_id=tracker)

        linked = {p.get("user_id") for p in self.persons.values()}
        for user in self.users.values():
            if user.get("system_generated") or not user.get("is_active", True) or user["id"] in linked:
                continue
            self.issue("info", "user_no_person", f"user:{user['id']}")

    def user_checks(self) -> None:
        for user in self.users.values():
            node_id = f"user:{user['id']}"
            if (
                user.get("is_admin")
                and not user.get("system_generated")
                and user.get("is_active", True)
                and not user.get("local_only")
                and not user.get("mfa")
                and self.snap.get("remote")
                and "homeassistant" in (user.get("providers") or [])
            ):
                self.issue("info", "admin_no_mfa", node_id)
            # accounts with a long-lived token may be used through the API
            last = _time(user.get("last_seen"))
            if (
                not user.get("system_generated")
                and user.get("is_active", True)
                and not user.get("tokens")
                and (last is None or self.now - last > DORMANT_AFTER)
            ):
                self.nodes[node_id]["flags"].append("dormant")
                self.issue("info", "dormant_user", node_id, last=user.get("last_seen"))

    def mobile_apps(self) -> None:
        seen: dict[tuple[str, str], list[str]] = {}
        for app in self.apps.values():
            device_id = app.get("device_id")
            if not device_id:
                continue
            node_id = self.device_node(device_id)
            user_id = app.get("user_id")
            if user_id in self.users:
                self.link(f"user:{user_id}", node_id, "registered")
            elif user_id:
                self.issue("error", "app_user_missing", node_id)
            name = (app.get("name") or "").strip().lower()
            seen.setdefault((name, (self.devices.get(device_id) or {}).get("model") or ""), []).append(node_id)

            updated = _time(app.get("updated"))
            at_least = updated is not None and updated.year < 2000
            if at_least:
                updated = DATED_FROM
            old = updated is not None and self.now - updated > DORMANT_AFTER
            quiet = self.hush(device_id, old)
            if quiet is None:
                continue
            if old:
                # silent, and the app has not been updated for months
                node = self.nodes[node_id]
                node["flags"].append("dormant")
                node["info"]["dormant"] = {"updated": updated.isoformat(), "at_least": at_least}
                self.issue(
                    "warn",
                    "dead_app",
                    node_id,
                    updated=updated.isoformat(),
                    at_least=at_least,
                    version=app.get("app_version"),
                    **quiet,
                )
            else:
                self.issue("warn", "stale_app", node_id, **quiet)
        self.memory = {
            key: {d: when for d, when in known.items() if d in self.app_by_device} for key, known in self.memory.items()
        }

        for nodes in seen.values():
            if len(nodes) > 1:
                for node_id in nodes:
                    self.issue("warn", "duplicate_app", node_id, count=len(nodes))

    def hush(self, device_id: str, old_app: bool) -> dict[str, Any] | None:
        """Silence details of a device, or None while it reports.

        Restored states only carry the start time, so the last real report and the start of the silence
        are kept in memory across restarts.
        """
        seen = self.memory["seen"]
        quiet = self.memory["quiet"]
        last = self.devices.get(device_id, {}).get("last_seen")
        if last is not None and (self.started is None or _time(last) >= self.started + SETTLE):
            seen[device_id] = last
            quiet.pop(device_id, None)
            return {"last": last} if self.now - _time(last) > STALE_AFTER else None
        known = seen.get(device_id)
        if last is None and known is None:
            return {"never": True}
        # shorter wait for apps not updated for months
        wait = timedelta(minutes=15) if old_app else timedelta(hours=1)
        if not (
            device_id in quiet
            or (self.started is not None and self.now - self.started > wait)
            or (known is not None and self.now - _time(known) > STALE_AFTER)
        ):
            return None
        since = quiet.setdefault(device_id, (self.started or self.now).isoformat())
        return {"last": known, "quiet": since, "since_start": self.started is not None and _time(since) >= self.started}

    # notifications

    def notify_target(self, service: str) -> tuple[str, bool]:
        """Node reached by notify.<service>, and whether the service exists."""
        spec = self.notify.get(service)
        if spec is None:
            node_id = f"notify:notify.{service}"
            self.add(node_id, "notify", f"notify.{service}", kind="missing", info={"service": f"notify.{service}"})
            if "missing" not in self.nodes[node_id]["flags"]:
                self.nodes[node_id]["flags"].append("missing")
            return node_id, False
        kind = spec.get("kind")
        if kind == "app" and spec.get("entry_id") in self.apps:
            app = self.apps[spec["entry_id"]]
            if app.get("device_id"):
                node_id = self.device_node(app["device_id"])
                services = self.nodes[node_id]["info"]["services"]
                if f"notify.{service}" not in services:
                    services.append(f"notify.{service}")
                return node_id, True
        node_id = f"notify:notify.{service}"
        if node_id in self.nodes:
            return node_id, True
        self.add(
            node_id,
            "notify",
            f"notify.{service}",
            kind=kind or "legacy",
            info={"service": f"notify.{service}", "platform": spec.get("platform")},
        )
        if kind == "app_all":
            reached = 0
            for app in self.apps.values():
                if app.get("push") and app.get("device_id"):
                    self.link(node_id, self.device_node(app["device_id"]), "includes")
                    reached += 1
            self.issue("info", "notify_all_apps", node_id, count=reached)
        elif kind == "group":
            for member in spec.get("members", []):
                target, ok = self.notify_target(member.removeprefix("notify."))
                self.link(node_id, target, "includes", f"notify.{member.removeprefix('notify.')}")
                if not ok:
                    self.issue("error", "group_member_missing", node_id, service=f"notify.{member}")
        return node_id, True

    def notify_entity(self, entity_id: str) -> tuple[str, bool]:
        entity = self.entities.get(entity_id)
        if entity is None:
            node_id = self.anchor(entity_id)
            return node_id, False
        members = entity.get("members")
        if members:
            node_id = f"notify:{entity_id}"
            if node_id not in self.nodes:
                self.add(
                    node_id,
                    "notify",
                    entity.get("name") or entity_id,
                    kind="group",
                    info={"entity_id": entity_id, "platform": entity.get("platform")},
                )
                for member in members:
                    target, _ok = self.notify_entity(member)
                    self.link(node_id, target, "includes", member)
            return node_id, True
        return self.anchor(entity_id), True

    def ui_node(self) -> str:
        return self.add(UI_NODE, "ui", "Home Assistant", kind="ui")["id"]

    # automations, scripts and alerts

    def routines(self) -> None:
        found: dict[str, dict] = {}
        tracker_nodes = {
            tracker: self.anchor(tracker)
            for person in self.persons.values()
            for tracker in person.get("trackers", [])
            if tracker in self.entities
        }
        for entity_id, entity in self.entities.items():
            if (
                entity_id.startswith("device_tracker.")
                and entity.get("platform") == "mobile_app"
                and entity.get("device_id") in self.devices
            ):
                tracker_nodes.setdefault(entity_id, self.device_node(entity["device_id"]))

        for routine in self.snap.get("routines", []):
            rid = f"routine:{routine['entity_id']}"
            enabled = routine.get("enabled", True)
            links: list[tuple[str, str, str | None, bool]] = []  # target, kind, label, broken
            calls: set[str] = set()
            for call in action_calls(routine.get("config")):
                links += self.call_links(call, calls)
            for notifier in routine.get("notifiers") or []:
                target, ok = self.notify_target(notifier.removeprefix("notify."))
                links.append((target, "notifies", f"notify.{notifier.removeprefix('notify.')}", not ok))
            text = json.dumps(routine.get("config") or {}, ensure_ascii=False)
            for person in sorted(set(PERSON_RE.findall(text))):
                if person in self.persons:
                    links.append((f"person:{person}", "watches", person, False))
            for tracker in sorted(set(TRACKER_RE.findall(text))):
                if tracker in tracker_nodes:
                    links.append((tracker_nodes[tracker], "watches", tracker, False))
            for user_id in sorted(set(HEX_RE.findall(text))):
                if user_id in self.users:
                    links.append((f"user:{user_id}", "mentions", None, False))
            found[rid] = {"routine": routine, "links": links, "calls": calls, "enabled": enabled}

        relevant = {rid for rid, r in found.items() if r["links"]}
        grew = True
        while grew:
            grew = False
            for rid, r in found.items():
                if rid not in relevant and {f"routine:{c}" for c in r["calls"]} & relevant:
                    relevant.add(rid)
                    grew = True

        for rid in sorted(relevant):
            r = found[rid]
            routine = r["routine"]
            info = {
                "entity_id": routine["entity_id"],
                "kind": routine.get("kind"),
                "enabled": r["enabled"],
                "last_triggered": routine.get("last_triggered"),
                "path": routine.get("path"),
            }
            node = self.add(
                rid, "routine", routine.get("name") or routine["entity_id"], kind=routine.get("kind"), info=info
            )
            if not r["enabled"]:
                node["flags"].append("disabled")
            for target, kind, label, broken in r["links"]:
                self.link(rid, target, kind, label, off=not r["enabled"] or None, broken=broken or None)
                if broken:
                    self.issue("error" if r["enabled"] else "info", "missing_service", rid, service=label)
                elif kind == "notifies" and "no_push" in self.nodes[target]["flags"]:
                    self.issue("warn", "no_push", rid, service=label, device=self.nodes[target]["name"])
            for called in sorted(r["calls"]):
                if f"routine:{called}" in relevant:
                    self.link(rid, f"routine:{called}", "calls", called, off=not r["enabled"] or None)

    def call_links(self, call: dict[str, Any], calls: set[str]) -> list[tuple[str, str, str | None, bool]]:
        action = call.get("action", call.get("service"))
        if "{{" in action:
            # templated service: link to the computed node
            if "notify" in action.split("{{", 1)[0]:
                return [(self.computed_node(), "notifies", action, False)]
            return []
        domain, service = action.split(".", 1)
        if action in UI_ACTIONS:
            return [(self.ui_node(), "notifies", action, False)]
        if domain == "script":
            if service in ("turn_on", "toggle"):
                calls.update(t for t in call_targets(call, "entity_id") if t.startswith("script."))
            elif service not in ("turn_off", "reload"):
                calls.add(action)
            return []
        if domain == "notify" and service == "send_message":
            out = []
            for entity_id in call_targets(call, "entity_id"):
                if "{{" in entity_id:
                    continue
                target, ok = self.notify_entity(entity_id)
                out.append((target, "notifies", f"{action} {entity_id}", not ok))
            return out
        if domain == "notify" and service not in NOTIFY_BUILTIN:
            target, ok = self.notify_target(service)
            return [(target, "notifies", action, not ok)]
        if domain != "notify" and "notify" in service:
            exists = action in self.services
            out = []
            for device_id in call_targets(call, "device_id"):
                ids = HEX_RE.findall(device_id) if "{{" in device_id else [device_id]
                out += [(self.device_node(d), "notifies", action, not exists) for d in ids if d in self.devices]
            for entity_id in call_targets(call, "entity_id"):
                if "{{" not in entity_id and entity_id in self.entities:
                    out.append((self.anchor(entity_id), "notifies", action, not exists))
            if not out:
                node_id = f"notify:{action}"
                self.add(node_id, "notify", action, kind="service" if exists else "missing", info={"service": action})
                if not exists and "missing" not in self.nodes[node_id]["flags"]:
                    self.nodes[node_id]["flags"].append("missing")
                out.append((node_id, "notifies", action, not exists))
            return out
        if (
            (domain == "telegram_bot" and service.startswith("send_"))
            or service == "send_message"
            or (action in MESSAGING_ACTIONS)
        ):
            exists = action in self.services
            return [(self.messaging_node(domain, exists), "notifies", action, not exists)]
        return []

    def computed_node(self) -> str:
        self.add(COMPUTED_NODE, "notify", "notify.{{ ... }}", kind="computed", info={"service": "notify.{{ ... }}"})
        return COMPUTED_NODE

    def messaging_node(self, domain: str, exists: bool) -> str:
        """One node per messaging integration, missing until one of its actions exists."""
        node_id = f"notify:{domain}"
        fresh = node_id not in self.nodes
        node = self.add(node_id, "notify", domain, info={"service": domain})
        flags = node["flags"]
        if exists:
            node["kind"] = "service"
            if "missing" in flags:
                flags.remove("missing")
        elif fresh:
            node["kind"] = "missing"
            flags.append("missing")
        return node_id

    def leftovers(self) -> None:
        """App devices nobody follows and nothing notifies."""
        used = {
            target for (_source, target, kind) in self.edges if kind in ("tracks", "notifies", "includes", "watches")
        }
        for app in self.apps.values():
            node_id = f"device:{app.get('device_id')}"
            if node_id not in self.nodes:
                continue
            if node_id not in used:
                self.issue("info", "unused_app", node_id)
        for (source, target, kind), _edge in self.edges.items():
            if kind != "tracks" or not target.startswith("device:"):
                continue
            app = self.app_by_device.get(target.removeprefix("device:"))
            person = self.persons.get(source.removeprefix("person:"))
            if app and person and app.get("user_id") and person.get("user_id") and app["user_id"] != person["user_id"]:
                owner = self.users.get(app["user_id"], {}).get("name")
                self.issue("info", "foreign_tracker", source, device=self.nodes[target]["name"], user=owner)

    def dormancy(self) -> None:
        """Mark persons, groups and routines whose links all lead to dormant or missing nodes."""

        def dormant(node_id: str) -> bool:
            return "dormant" in self.nodes[node_id]["flags"]

        def dead(node_id: str) -> bool:
            return dormant(node_id) or "missing" in self.nodes[node_id]["flags"]

        outgoing: dict[str, list[tuple[str, str]]] = {}
        for source, target, kind in self.edges:
            outgoing.setdefault(source, []).append((target, kind))

        def serves_nothing(node_id: str, kinds: tuple[str, ...]) -> bool:
            # all missing is already reported as an error
            reached = [target for target, kind in outgoing.get(node_id, []) if kind in kinds]
            return bool(reached) and all(dead(t) for t in reached) and any(dormant(t) for t in reached)

        def mark(node_id: str, severity: str, code: str) -> None:
            self.nodes[node_id]["flags"].append("dormant")
            self.issue(severity, code, node_id)

        for node_id, node in list(self.nodes.items()):
            if node["type"] == "person" and serves_nothing(node_id, ("tracks",)):
                mark(node_id, "warn", "dead_person")
            elif (
                node["type"] == "notify"
                and node.get("kind") in ("group", "app_all")
                and serves_nothing(node_id, ("includes",))
            ):
                mark(node_id, "info", "dead_group")
        grew = True
        while grew:
            grew = False
            for node_id, node in self.nodes.items():
                if node["type"] != "routine" or "disabled" in node["flags"] or dormant(node_id):
                    continue
                if serves_nothing(node_id, ("notifies", "watches", "mentions", "calls")):
                    mark(node_id, "info", "dead_routine")
                    grew = True

    def build(self) -> dict[str, Any]:
        self.users_and_persons()
        self.user_checks()
        self.mobile_apps()
        self.routines()
        for service in sorted(self.notify):
            spec = self.notify[service]
            if spec.get("kind") in ("legacy", "group", "target") or (spec.get("kind") == "app_all"):
                self.notify_target(service)
        self.leftovers()
        self.dormancy()

        worst: dict[str, int] = {}
        for issue in self.issues:
            rank = SEVERITY_ORDER[issue["severity"]]
            worst[issue["node"]] = min(rank, worst.get(issue["node"], 9))
        for node in self.nodes.values():
            rank = worst.get(node["id"], 9)
            node["status"] = "error" if rank == 0 else "warn" if rank == 1 else "ok"

        nodes = sorted(self.nodes.values(), key=lambda n: (TYPE_ORDER[n["type"]], n["name"].lower()))
        issues = sorted(self.issues, key=lambda i: (SEVERITY_ORDER[i["severity"]], i["code"], i["node"]))
        stats: dict[str, int] = {}
        for node in nodes:
            stats[node["type"]] = stats.get(node["type"], 0) + 1
        return {
            "nodes": nodes,
            "edges": list(self.edges.values()),
            "issues": issues,
            "stats": stats,
            "now": self.snap["now"],
            "started": self.snap.get("started"),
            "version": self.snap.get("version"),
            "health": self.snap.get("health") or [],
            "memory": self.memory,
        }


def build(snapshot: dict[str, Any]) -> dict[str, Any]:
    return Builder(snapshot).build()
