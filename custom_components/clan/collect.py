"""Snapshot of the users, people, devices, notification services and routines of Home Assistant.

Notify services and routine configs only exist as runtime objects, so they are read defensively;
whatever cannot be read is left out.
"""

from __future__ import annotations

from datetime import datetime
import json
import logging
import re
from typing import Any

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN, __version__ as HA_VERSION
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar, device_registry as dr, entity_registry as er
from homeassistant.util import dt as dt_util

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

HEX_RE = re.compile(r"\b[0-9a-f]{32}\b")
ROUTINE_DOMAINS = ("automation", "script", "alert")
# notify actions that belong to no integration
NOTIFY_BUILTIN = {"send_message", "persistent_notification"}


def _iso(value: datetime | str | None) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    return value or None


async def async_collect(hass: HomeAssistant) -> dict[str, Any]:
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    routines = _routines(hass)
    entities = _entities(hass, ent_reg)
    apps = _apps(hass, dev_reg)
    notify = _notify_services(hass)
    health = _health(hass, notify, apps, routines)

    wanted = {e["device_id"] for e in entities.values() if e.get("device_id")}
    wanted |= {a["device_id"] for a in apps if a.get("device_id")}
    for routine in routines:
        wanted |= set(HEX_RE.findall(json.dumps(routine.get("config") or {})))

    return {
        "now": dt_util.utcnow().isoformat(),
        "version": HA_VERSION,
        "health": health,
        "started": _iso(hass.data.get(DOMAIN, {}).get("started")),
        "memory": hass.data.get(DOMAIN, {}).get("memory") or {},
        "remote": _remote(hass),
        "users": await _users(hass),
        "persons": _persons(hass),
        "entities": entities,
        "devices": _devices(hass, dev_reg, ent_reg, wanted),
        "apps": apps,
        "notify": notify,
        "services": sorted(f"{d}.{s}" for d, services in hass.services.async_services().items() for s in services),
        "routines": routines,
    }


def _remote(hass: HomeAssistant) -> bool:
    if hass.config.external_url:
        return True
    try:
        from homeassistant.components.cloud import async_active_subscription

        return "cloud" in hass.config.components and async_active_subscription(hass)
    except Exception:
        return False


async def _users(hass: HomeAssistant) -> list[dict[str, Any]]:
    out = []
    for user in await hass.auth.async_get_users():
        tokens = []
        sessions = 0
        last_seen: datetime | None = None
        for token in user.refresh_tokens.values():
            if token.token_type == "long_lived_access_token":
                # last_used_at of a long-lived token is only set at creation
                tokens.append({"name": token.client_name, "created": _iso(token.created_at)})
            elif token.token_type == "normal":
                # session refresh tokens are used about every 30 minutes
                sessions += 1
                used = token.last_used_at
                if used and (last_seen is None or used > last_seen):
                    last_seen = used
        mfa = await hass.auth.async_get_enabled_mfa(user)
        out.append(
            {
                "id": user.id,
                "name": user.name,
                "is_owner": user.is_owner,
                "is_admin": user.is_admin,
                "is_active": user.is_active,
                "system_generated": user.system_generated,
                "local_only": getattr(user, "local_only", False),
                "groups": [group.id for group in user.groups],
                "usernames": sorted({c.data["username"] for c in user.credentials if c.data.get("username")}),
                "providers": sorted({c.auth_provider_type for c in user.credentials}),
                "mfa": list(mfa.values()),
                "tokens": sorted(tokens, key=lambda t: t["name"] or ""),
                "sessions": sessions,
                "last_seen": _iso(last_seen),
            }
        )
    return out


def _persons(hass: HomeAssistant) -> list[dict[str, Any]]:
    out = []
    for state in hass.states.async_all("person"):
        attrs = state.attributes
        out.append(
            {
                "entity_id": state.entity_id,
                "name": attrs.get("friendly_name") or state.object_id,
                "user_id": attrs.get("user_id"),
                "trackers": list(attrs.get("device_trackers") or []),
                "source": attrs.get("source"),
                "state": state.state,
                "picture": attrs.get("entity_picture"),
            }
        )
    return out


def _entities(hass: HomeAssistant, ent_reg: er.EntityRegistry) -> dict[str, dict[str, Any]]:
    """Trackers and notify entities, from the registry and from states (legacy trackers)."""
    out: dict[str, dict[str, Any]] = {}
    for entry in ent_reg.entities.values():
        if entry.domain in ("device_tracker", "notify"):
            out[entry.entity_id] = {
                "platform": entry.platform,
                "device_id": entry.device_id,
                "entry_id": entry.config_entry_id,
                "name": entry.name or entry.original_name,
                "disabled": entry.disabled_by is not None,
            }
    for domain in ("device_tracker", "notify"):
        for state in hass.states.async_all(domain):
            entity = out.setdefault(state.entity_id, {"platform": None, "device_id": None})
            entity["state"] = state.state
            entity["name"] = state.attributes.get("friendly_name") or entity.get("name")
            entity["source_type"] = state.attributes.get("source_type")
            entity["last_seen"] = _iso(getattr(state, "last_reported", state.last_updated))
            members = state.attributes.get("entity_id")
            if domain == "notify" and isinstance(members, list | tuple):
                entity["members"] = list(members)
    return out


def _devices(
    hass: HomeAssistant, dev_reg: dr.DeviceRegistry, ent_reg: er.EntityRegistry, wanted: set[str]
) -> dict[str, dict[str, Any]]:
    areas = ar.async_get(hass)
    out = {}
    for device_id in wanted:
        device = dev_reg.async_get(device_id)
        if device is None:
            continue
        last: datetime | None = None
        for entry in er.async_entries_for_device(ent_reg, device_id, include_disabled_entities=False):
            state = hass.states.get(entry.entity_id)
            if state is None or state.state in (STATE_UNKNOWN, STATE_UNAVAILABLE):
                continue
            seen = getattr(state, "last_reported", state.last_updated)
            if last is None or seen > last:
                last = seen
        area = areas.async_get_area(device.area_id) if device.area_id else None
        out[device_id] = {
            "name": device.name,
            "name_by_user": device.name_by_user,
            "manufacturer": device.manufacturer,
            "model": device.model,
            "sw_version": device.sw_version,
            "area": area.name if area else None,
            "disabled": device.disabled_by is not None,
            "last_seen": _iso(last),
        }
    return out


def _apps(hass: HomeAssistant, dev_reg: dr.DeviceRegistry) -> list[dict[str, Any]]:
    """Companion app registrations. Webhook ids and push tokens stay here."""
    out = []
    for entry in hass.config_entries.async_entries("mobile_app"):
        data = entry.data
        app_data = data.get("app_data") or {}
        devices = dr.async_entries_for_config_entry(dev_reg, entry.entry_id)
        out.append(
            {
                "entry_id": entry.entry_id,
                "name": data.get("device_name") or entry.title,
                "user_id": data.get("user_id"),
                "device_id": devices[0].id if devices else None,
                "app_version": data.get("app_version"),
                "os": data.get("os_name"),
                "os_version": data.get("os_version"),
                "push": ("push_token" in app_data and "push_url" in app_data) or "push_websocket_channel" in app_data,
                "disabled": entry.disabled_by is not None,
                # rewritten when the app updates its registration; unlike states, it survives restarts.
                # Entries last modified before HA recorded this field hold the epoch.
                "updated": _iso(getattr(entry, "modified_at", None)),
            }
        )
    return out


def _notify_services(hass: HomeAssistant) -> dict[str, dict[str, Any]]:
    """What each notify.<service> stands for: one phone, every phone, a group, another integration."""
    platforms: dict[int, str] = {}
    for platform, services in (hass.data.get("notify_services") or {}).items():
        for service in services:
            platforms[id(service)] = platform

    entry_by_webhook = {
        entry.data.get("webhook_id"): entry.entry_id for entry in hass.config_entries.async_entries("mobile_app")
    }
    out: dict[str, dict[str, Any]] = {}
    for name, service in hass.services.async_services_for_domain("notify").items():
        handler = getattr(getattr(service, "job", None), "target", None)
        owner = getattr(handler, "__self__", None)
        platform = platforms.get(id(owner)) if owner is not None else None
        if platform is None:
            continue  # send_message, persistent_notification and other built-in actions
        targets = getattr(owner, "registered_targets", None) or {}
        if name in targets:
            if platform == "mobile_app":
                out[name] = {"kind": "app", "platform": platform, "entry_id": entry_by_webhook.get(targets[name])}
            else:
                out[name] = {"kind": "target", "platform": platform}
        elif platform == "group":
            members = [m.get("action") or m.get("service") for m in getattr(owner, "entities", []) or []]
            out[name] = {"kind": "group", "platform": platform, "members": [m for m in members if m]}
        elif platform == "mobile_app":
            out[name] = {"kind": "app_all", "platform": platform}
        else:
            out[name] = {"kind": "legacy", "platform": platform}
    return out


def _routines(hass: HomeAssistant) -> list[dict[str, Any]]:
    out = []
    for domain in ROUTINE_DOMAINS:
        # 2025.1 has no hass.data["alert"]; entity_components holds every component
        component = (hass.data.get("entity_components") or {}).get(domain) or hass.data.get(domain)
        for entity in list(getattr(component, "entities", None) or []):
            state = hass.states.get(entity.entity_id)
            routine: dict[str, Any] = {
                "entity_id": entity.entity_id,
                "kind": domain,
                "name": (state.attributes.get("friendly_name") if state else None) or entity.name,
                "enabled": state is None or state.state != "off" or domain != "automation",
                "last_triggered": _iso(state.attributes.get("last_triggered")) if state else None,
            }
            if domain == "alert":
                notifiers = getattr(entity, "_notifiers", None)
                routine["notifiers"] = list(notifiers) if notifiers is not None else None
            else:
                config = getattr(entity, "raw_config", None)
                routine["config"] = _plain(config)
                if domain == "automation" and isinstance(config, dict) and config.get("id"):
                    routine["path"] = f"/config/automation/edit/{config['id']}"
                elif domain == "script":
                    routine["path"] = f"/config/script/edit/{entity.entity_id.split('.', 1)[1]}"
            out.append(routine)
    return out


def _health(
    hass: HomeAssistant, notify: dict[str, dict[str, Any]], apps: list[dict[str, Any]], routines: list[dict[str, Any]]
) -> list[str]:
    """Internal structures read above that came back empty while their data exists.

    They are not public API and can change in a release. Each one found missing is reported to the
    panel and logged once.
    """
    missing = []
    legacy = [name for name in hass.services.async_services_for_domain("notify") if name not in NOTIFY_BUILTIN]
    if legacy and not isinstance(hass.data.get("notify_services"), dict):
        missing.append("notify_services")
    elif legacy and not notify:
        missing.append("notify_owner")
    if any(app["push"] and not app["disabled"] for app in apps) and not any(
        spec["kind"] == "app" for spec in notify.values()
    ):
        missing.append("mobile_app_targets")
    if any(spec["kind"] == "group" and not spec["members"] for spec in notify.values()):
        missing.append("notify_groups")
    for domain in ROUTINE_DOMAINS:
        found = [r for r in routines if r["kind"] == domain]
        if hass.states.async_entity_ids(domain) and not found:
            missing.append(f"{domain}_entities")
        elif domain != "alert" and found and all(r.get("config") is None for r in found):
            missing.append(f"{domain}_config")
        elif domain == "alert" and found and all(r.get("notifiers") is None for r in found):
            missing.append("alert_notifiers")
    known = hass.data.setdefault(DOMAIN, {}).setdefault("warned", set())
    for code in missing:
        if code not in known:
            known.add(code)
            _LOGGER.warning(
                "Home Assistant %s no longer exposes what Clan reads for %s: the map may be incomplete",
                HA_VERSION,
                code,
            )
    return missing


def _plain(value: Any) -> Any:
    """Convert a config to JSON-compatible data; templates and YAML nodes become strings."""
    try:
        return json.loads(json.dumps(value, default=str))
    except (TypeError, ValueError):
        _LOGGER.debug("Config left out of the map: %r", value)
        return None
