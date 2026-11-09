# Clan

[![Open your Home Assistant instance and open this repository in the Marketplace.](https://my.home-assistant.io/badges/marketplace_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=jolabs40&repository=clan-ha&category=integration)
[![Validate](https://github.com/jolabs40/clan-ha/actions/workflows/validate.yml/badge.svg)](https://github.com/jolabs40/clan-ha/actions/workflows/validate.yml)

[Version française](README.fr.md)

A Home Assistant panel that answers, on one screen, who can sign in, who is followed, and who gets notified.

![Clan: a family's map building itself, then Léo's branch from his account to the gate his phone can open](docs/demo.gif)

Clan reads the users, people, companion app registrations, notification services, automations, scripts
and alerts of your instance, and draws the links between them in columns, from accounts to automations:

- users and their role (owner, administrator, user, system account), sign-in methods, two-factor
  authentication, long-lived tokens, and when each user was last active;
- the person each user signs in as, and the trackers that give that person's location;
- the phones, watches and tablets signed in to the companion app, and by which user;
- every automation, script and alert that sends a notification, and the device it reaches, directly, through
  a notification group, or through `notify.notify`, which reaches every phone;
- the automations that use someone's presence, or a sensor of a phone (next alarm, charging, Wi-Fi);
- what a phone can run from a notification button, such as opening the gate from the doorbell
  notification;
- when each phone was last notified, and by which service;
- the dashboards each user can open, and the views kept for other users.

The panel has three views:

- Map: five columns read from left to right, users, people, devices, notifications and automations. On a
  computer, the map builds itself column by column when the panel opens, and again after a refresh. Click a node to light up what it
  leads to, towards the accounts and towards the automations, and to read its details. From there, or from a card of
  the next view, Isolate keeps only that branch on the map, and Hide takes the node off the map
  with whatever only hangs from it: hiding a child's account removes their person and phones, while a
  service that also reaches other phones stays. A person and its account count as one. The choice is
  remembered, and a row above the map shows what is isolated or hidden, with a way back.
  Dormant items are greyed with a dotted ring: a silent phone whose app has not been updated for three
  months, an account with no sign-in for three months, and what only reaches them (a person followed only
  by old phones, an automation that only notifies them). The Dormant button highlights them.
- By person: one card per user with their person, trackers, devices, the automations that notify them,
  their dashboards and their tokens.
- Findings: what deserves a look, such as an automation calling a notification service that no longer
  exists, a phone registered several times, an app silent since Home Assistant started, a phone probably
  abandoned, an account never used, a group member that is gone, or a person nobody can sign in as.

The panel is for administrators only, as it shows accounts and their tokens (never the tokens themselves).
Nothing is changed in Home Assistant: the integration only reads. It keeps one small file of its own,
`.storage/clan.memory`, with the last real report of each phone and since when a quiet one keeps
quiet: after a restart every state carries the start time, and the map would otherwise forget for an hour
which phones are silent. The file goes when the integration is removed.

## Installation

Home Assistant 2025.1 or later (tested on 2025.1.4 and on the current release).

In Settings > Marketplace, search for Clan (or use the button above) and select Install. Then add the
Clan integration from Settings > Devices & services: the panel appears in the sidebar, for administrators.

If it does not show up yet, select Add from link and enter `https://github.com/jolabs40/clan-ha` (this asks
for a GitHub connection).

Before Home Assistant 2026.11, the Marketplace was the HACS integration: search for Clan there, download it
and restart Home Assistant.

Without either, unzip `clan.zip` from the [latest release](https://github.com/jolabs40/clan-ha/releases/latest)
into a `custom_components/clan` folder of your configuration, restart Home Assistant, then add the
integration.

## How the links are found

| Link | Source |
| --- | --- |
| user and person | the person's user account |
| person and trackers | the trackers of the person |
| user and phone | the user who signed in the companion app when it registered |
| automation and phone | `notify.mobile_app_*` actions, `notify.send_message` on notify entities, other integrations' `*.notify` actions with a device target |
| notification group | members of YAML notify groups and of notify entity groups |
| `notify.notify` | every phone that can receive push notifications |
| messaging | `telegram_bot.send_*`, Matrix and other `*.send_message` actions, `mastodon.post`: one node per integration |
| presence | `person.*` and tracker entities named in an automation |
| phone sensor | companion app entities named in an automation (next alarm, battery, Wi-Fi...) |
| notification button | a notification with `actions` and the automation or script waiting for that action (`mobile_app_notification_action` trigger or `wait_for_trigger`) |

Templates are read where a target can be told from them (a device id in a default value, for instance).
A notification whose service is a template (`notify.{{ ... }}`) gets a node of its own, which says that whom it
reaches is only known when it runs.

The last notification of a phone comes from the notification calls Clan sees once installed, kept across
restarts, and from the state of its notify entity. Before that, the panel says since when it is watching.
A view restricted to some users hides it from the others in the interface only: it is not a permission.

## When Home Assistant changes

To find which integration owns a notification service and what automations, scripts and alerts do, Clan
reads a few structures that are internal to Home Assistant. Each time the map is drawn it checks they are
still there. If a release has moved one, a banner at the top of the panel lists what the map can no longer
show, and a warning is logged once.

## Languages

English and French.
