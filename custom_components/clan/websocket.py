"""Websocket commands, admin only since the map lists accounts and tokens."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .collect import async_collect
from .const import DOMAIN
from .graph import build


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_graph)
    websocket_api.async_register_command(hass, ws_snapshot)


@websocket_api.websocket_command({vol.Required("type"): "clan/graph"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_graph(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    snapshot = await async_collect(hass)
    # a few hundred ms on large instances
    result = await hass.async_add_executor_job(build, snapshot)
    memory = result.pop("memory")
    data = hass.data[DOMAIN]
    if memory != data["memory"]:
        data["memory"] = memory
        data["save"]()
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): "clan/snapshot"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_snapshot(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Raw snapshot, to reproduce issues without the instance."""
    connection.send_result(msg["id"], await async_collect(hass))
