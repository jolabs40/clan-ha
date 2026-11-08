"""Clan: a map of the users, people, devices and notifications of a Home Assistant instance."""

from __future__ import annotations

from datetime import UTC, datetime
import os
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CoreState, HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration
from homeassistant.util import dt as dt_util

from . import websocket
from .const import DOMAIN, PANEL_ELEMENT, PANEL_URL, STATIC_URL

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

FRONTEND_DIR = Path(__file__).parent / "frontend"


def _frontend_version(version: str) -> str:
    """Cache-busting suffix for the panel URL."""
    newest = max((f.stat().st_mtime for f in FRONTEND_DIR.glob("*.js")), default=0)
    return f"{version}-{int(newest)}"


def _process_start() -> datetime | None:
    """When Home Assistant's process started, read from /proc (Linux only)."""
    try:
        with open("/proc/self/stat", encoding="ascii") as stat:
            ticks = int(stat.read().rsplit(")", 1)[1].split()[19])
        with open("/proc/stat", encoding="ascii") as stat:
            boot = next(int(line.split()[1]) for line in stat if line.startswith("btime"))
        return datetime.fromtimestamp(boot + ticks / os.sysconf("SC_CLK_TCK"), UTC)
    except (OSError, ValueError, IndexError, StopIteration, AttributeError):
        return None


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    # restored states carry the start time; a device is judged silent from it
    started = await hass.async_add_executor_job(_process_start)
    if started is None and hass.state is not CoreState.running:
        started = dt_util.utcnow()
    # last real report and start of silence of each device, kept across restarts
    store: Store[dict] = Store(hass, 1, f"{DOMAIN}.memory")
    memory = await store.async_load() or {}
    hass.data[DOMAIN] = {"started": started, "static": False, "store": store, "memory": memory}
    websocket.async_register(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data[DOMAIN]
    if not data["static"]:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), cache_headers=False)]
        )
        data["static"] = True
    integration = await async_get_integration(hass, DOMAIN)
    version = await hass.async_add_executor_job(_frontend_version, str(integration.version))
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title="Clan",
        sidebar_icon="mdi:account-network",
        module_url=f"{STATIC_URL}/clan-panel.js?v={version}",
        config={"version": version},
        require_admin=True,
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, PANEL_URL)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Delete the stored device memory with the integration."""
    data = hass.data.get(DOMAIN) or {}
    data["memory"] = {}
    store = data.get("store") or Store(hass, 1, f"{DOMAIN}.memory")
    await store.async_remove()
