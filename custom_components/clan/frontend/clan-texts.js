// Interface texts. A language missing a key falls back to English.

export const TEXTS = {
  en: {
    title: "Clan",
    tab_map: "Map",
    tab_people: "By person",
    tab_issues: "Findings",
    refresh: "Refresh",
    search: "Search",
    fit: "Fit to screen",
    legend: "Legend",
    loading: "Reading Home Assistant…",
    load_failed: "The map could not be read",
    admin_only: "This panel is for administrators.",
    nothing: "Nothing to show with these filters.",
    close: "Close",
    open: "Open",
    show_on_map: "Show on the map",
    isolate: "Isolate",
    isolate_title: "Show only its branch: the accounts above it and what it leads to",
    unisolate: "Show everything",
    hide_branch: "Hide",
    hide_title: "Hide it, with whatever only hangs from it",
    unhide: "Show again",
    isolated: "Isolated",
    masked: "Hidden",
    show_all: "Show all",
    type_user: "Users",
    type_person: "People",
    type_device: "Devices",
    type_tracker: "Trackers",
    type_notify: "Notifications",
    type_ui: "Home Assistant",
    type_routine: "Automations",
    show_system: "System accounts",
    show_disabled: "Disabled automations",
    show_dormant: "Dormant",
    show_dormant_title: "Bring out what no longer serves: old phones, accounts nobody uses, and what only reaches them",
    flag_dormant: "Dormant",
    at_least: "more than {x}",
    one_user: "User",
    one_person: "Person",
    one_device: "Device",
    one_tracker: "Tracker",
    one_notify: "Notification",
    one_ui: "Home Assistant",
    one_routine: "Automation",
    kind_automation: "Automation",
    kind_script: "Script",
    kind_alert: "Alert",
    flag_owner: "Owner",
    flag_admin: "Administrator",
    flag_user: "User",
    flag_read_only: "Read only",
    flag_system: "System",
    flag_inactive: "Inactive",
    flag_local_only: "Local network only",
    flag_mfa: "Two-factor",
    flag_disabled: "Disabled",
    flag_missing: "Missing",
    flag_app: "Companion app",
    flag_no_push: "No push",
    edge_account: "signs in as",
    edge_registered: "app signed in by",
    edge_tracks: "followed by",
    edge_notifies: "notifies",
    edge_includes: "reaches",
    edge_calls: "runs",
    edge_watches: "uses the presence of",
    edge_mentions: "names the user",
    edge_answers: "runs, from a notification button",
    edge_reads: "uses a sensor of",
    edge_source: "current source",
    usernames: "Username",
    providers: "Sign-in",
    provider_homeassistant: "Password",
    provider_trusted_networks: "Trusted networks",
    provider_command_line: "Command line",
    groups: "Group",
    last_seen: "Last activity",
    sessions: "Open sessions",
    tokens: "Long-lived tokens",
    token_created: "created",
    person: "Person",
    account: "Account",
    no_account: "No user account",
    no_person: "No person",
    state: "State",
    source: "Location from",
    trackers: "Trackers",
    devices: "Devices",
    registered_by: "App signed in by",
    model: "Model",
    os: "System",
    app_version: "App",
    push: "Push notifications",
    yes: "yes",
    no: "no",
    area: "Area",
    services: "Notify actions",
    notify_entities: "Notify entities",
    followed_by: "Followed by",
    notified_by: "Notified by",
    presence_used_by: "Presence used by",
    buttons_run: "Runs from a notification button",
    sensors_used_by: "Sensors used by",
    run_from: "Run from a notification button on",
    reads_sensors: "Uses sensors of",
    reaches: "Reaches",
    used_by: "Used by",
    runs: "Runs",
    run_by: "Run by",
    targets: "Targets",
    names_users: "Names the users",
    last_triggered: "Last triggered",
    never: "never",
    enabled: "Enabled",
    service: "Action",
    platform: "Integration",
    kind_app_all: "Every phone with the companion app",
    kind_group: "Notification group",
    kind_legacy: "Notification service",
    kind_target: "Notification service",
    kind_service: "Integration action",
    kind_missing: "Does not exist",
    kind_computed: "Worked out when it runs: the map cannot tell whom it reaches",
    health: "Clan can no longer read part of Home Assistant {version}: {what}. The map may be incomplete.",
    health_report: "Report it",
    health_notify_services: "the notification services of integrations",
    health_notify_owner: "which integration each notification service belongs to",
    health_mobile_app_targets: "the notification service of each phone",
    health_notify_groups: "the members of notification groups",
    health_automation_entities: "the automations",
    health_script_entities: "the scripts",
    health_alert_entities: "the alerts",
    health_automation_config: "what the automations do",
    health_script_config: "what the scripts do",
    health_alert_notifiers: "whom the alerts notify",
    ui_text: "Persistent notifications, shown to every user in the sidebar.",
    home: "Home",
    not_home: "Away",
    unknown: "Unknown",
    findings: "Findings",
    no_findings: "Nothing to report.",
    sev_error: "Errors",
    sev_warn: "Warnings",
    sev_info: "For information",
    via: "via",
    all_phones: "every phone",
    people_title: "People and accounts",
    system_accounts: "System accounts",
    persons_without_account: "People without an account",
    other_receivers: "Other notification destinations",
    unowned_devices: "Devices of nobody",
    nobody_notified: "No automation notifies this person's devices.",
    edit: "Edit",
    open_person: "People settings",
    open_device: "Device page",
    open_app: "In Mobile App",
    ago_now: "just now",
    since_start: "nothing since Home Assistant started",
    issue: {
      missing_service: "Calls {service}, which does not exist.",
      missing_tracker: "Follows {entity_id}, which does not exist.",
      group_member_missing: "The group includes {service}, which does not exist.",
      person_user_missing: "Linked to a user account that no longer exists.",
      app_user_missing: "Registered by a user account that no longer exists.",
      stale_app: "The app has not reported for {age}. An old registration can be deleted.",
      stale_app_start: "The app has not reported since Home Assistant started ({age}).",
      stale_app_never: "The app never reported.",
      stale_app_since: "The app has not reported for at least {age}.",
      dead_app: "Probably abandoned: {quiet}, and its app has not updated its registration for {age}{version}.",
      quiet_start: "nothing received since Home Assistant started",
      quiet_age: "nothing received for {age}",
      quiet_never: "nothing ever received",
      quiet_since: "nothing received for at least {age}",
      version: " (version {version})",
      dormant_user: "No sign-in for {age}: an unused account?",
      dormant_user_never:
        "Never signed in, neither in the interface nor in the app. A service account (MQTT for instance) never does.",
      dead_person: "Followed only by abandoned or vanished devices: its presence no longer means anything.",
      dead_group: "Every member is abandoned or gone.",
      dead_routine: "Only reaches abandoned or vanished devices and accounts.",
      duplicate_app: "Registered {count} times under the same name: the old registrations can go.",
      no_push: "{service} cannot reach {device}: push notifications are off on that device.",
      notify_all_apps: "Reaches every phone with the companion app ({count}), whoever it belongs to.",
      unused_app: "No person follows this device and no automation notifies it.",
      foreign_tracker: "Follows {device}, whose app is signed in as {user}.",
      person_no_user: "This person cannot sign in.",
      person_no_tracker: "No tracker: this person's presence is never known.",
      user_no_person: "Account without a person: not followed, not counted at home.",
      admin_no_mfa: "Administrator reachable from outside, without two-factor authentication.",
    },
  },
  fr: {
    title: "Clan",
    tab_map: "Carte",
    tab_people: "Par personne",
    tab_issues: "Constats",
    refresh: "Actualiser",
    search: "Rechercher",
    fit: "Ajuster à l'écran",
    legend: "Légende",
    loading: "Lecture de Home Assistant…",
    load_failed: "La carte n'a pas pu être lue",
    admin_only: "Ce panneau est réservé aux administrateurs.",
    nothing: "Rien à montrer avec ces filtres.",
    close: "Fermer",
    open: "Ouvrir",
    show_on_map: "Voir sur la carte",
    isolate: "Isoler",
    isolate_title: "N'afficher que sa branche : les comptes au-dessus et ce à quoi il mène",
    unisolate: "Tout afficher",
    hide_branch: "Masquer",
    hide_title: "Le masquer, avec tout ce qui ne dépend que de lui",
    unhide: "Réafficher",
    isolated: "Isolé",
    masked: "Masqués",
    show_all: "Tout afficher",
    type_user: "Utilisateurs",
    type_person: "Personnes",
    type_device: "Appareils",
    type_tracker: "Traceurs",
    type_notify: "Notifications",
    type_ui: "Home Assistant",
    type_routine: "Automatisations",
    show_system: "Comptes système",
    show_disabled: "Automatisations désactivées",
    show_dormant: "En sommeil",
    show_dormant_title:
      "Mettre en avant ce qui ne sert plus : vieux téléphones, comptes que personne n'utilise, et ce qui ne joint plus qu'eux",
    flag_dormant: "En sommeil",
    at_least: "plus de {x}",
    one_user: "Utilisateur",
    one_person: "Personne",
    one_device: "Appareil",
    one_tracker: "Traceur",
    one_notify: "Notification",
    one_ui: "Home Assistant",
    one_routine: "Automatisation",
    kind_automation: "Automatisation",
    kind_script: "Script",
    kind_alert: "Alerte",
    flag_owner: "Propriétaire",
    flag_admin: "Administrateur",
    flag_user: "Utilisateur",
    flag_read_only: "Lecture seule",
    flag_system: "Système",
    flag_inactive: "Inactif",
    flag_local_only: "Réseau local seulement",
    flag_mfa: "Double authentification",
    flag_disabled: "Désactivé",
    flag_missing: "Introuvable",
    flag_app: "Application compagnon",
    flag_no_push: "Sans push",
    edge_account: "se connecte en tant que",
    edge_registered: "appli connectée par",
    edge_tracks: "suivi par",
    edge_notifies: "notifie",
    edge_includes: "atteint",
    edge_calls: "lance",
    edge_watches: "utilise la présence de",
    edge_mentions: "nomme l'utilisateur",
    edge_answers: "lance, par un bouton de notification",
    edge_reads: "utilise un capteur de",
    edge_source: "source actuelle",
    usernames: "Identifiant",
    providers: "Connexion",
    provider_homeassistant: "Mot de passe",
    provider_trusted_networks: "Réseaux de confiance",
    provider_command_line: "Ligne de commande",
    groups: "Groupe",
    last_seen: "Dernière activité",
    sessions: "Sessions ouvertes",
    tokens: "Jetons longue durée",
    token_created: "créé",
    person: "Personne",
    account: "Compte",
    no_account: "Aucun compte utilisateur",
    no_person: "Aucune personne",
    state: "État",
    source: "Position donnée par",
    trackers: "Traceurs",
    devices: "Appareils",
    registered_by: "Appli connectée par",
    model: "Modèle",
    os: "Système",
    app_version: "Appli",
    push: "Notifications push",
    yes: "oui",
    no: "non",
    area: "Pièce",
    services: "Actions de notification",
    notify_entities: "Entités de notification",
    followed_by: "Suivi par",
    notified_by: "Notifié par",
    presence_used_by: "Présence utilisée par",
    buttons_run: "Lance par un bouton de notification",
    sensors_used_by: "Capteurs utilisés par",
    run_from: "Lancée par un bouton de notification sur",
    reads_sensors: "Utilise des capteurs de",
    reaches: "Atteint",
    used_by: "Utilisé par",
    runs: "Lance",
    run_by: "Lancé par",
    targets: "Cibles",
    names_users: "Nomme les utilisateurs",
    last_triggered: "Dernier déclenchement",
    never: "jamais",
    enabled: "Active",
    service: "Action",
    platform: "Intégration",
    kind_app_all: "Tous les téléphones qui ont l'application compagnon",
    kind_group: "Groupe de notification",
    kind_legacy: "Service de notification",
    kind_target: "Service de notification",
    kind_service: "Action d'une intégration",
    kind_missing: "N'existe pas",
    kind_computed: "Calculé au moment de l'envoi : la carte ne peut pas savoir qui il atteint",
    health: "Clan ne sait plus lire une partie de Home Assistant {version} : {what}. La carte peut être incomplète.",
    health_report: "Le signaler",
    health_notify_services: "les services de notification des intégrations",
    health_notify_owner: "l'intégration à laquelle appartient chaque service de notification",
    health_mobile_app_targets: "le service de notification de chaque téléphone",
    health_notify_groups: "les membres des groupes de notification",
    health_automation_entities: "les automatisations",
    health_script_entities: "les scripts",
    health_alert_entities: "les alertes",
    health_automation_config: "ce que font les automatisations",
    health_script_config: "ce que font les scripts",
    health_alert_notifiers: "qui les alertes notifient",
    ui_text: "Notifications persistantes, visibles par tous les utilisateurs dans la barre latérale.",
    home: "À la maison",
    not_home: "Absent",
    unknown: "Inconnu",
    findings: "Constats",
    no_findings: "Rien à signaler.",
    sev_error: "Erreurs",
    sev_warn: "Avertissements",
    sev_info: "Pour information",
    via: "par",
    all_phones: "tous les téléphones",
    people_title: "Personnes et comptes",
    system_accounts: "Comptes système",
    persons_without_account: "Personnes sans compte",
    other_receivers: "Autres destinations de notification",
    unowned_devices: "Appareils de personne",
    nobody_notified: "Aucune automatisation ne notifie les appareils de cette personne.",
    edit: "Modifier",
    open_person: "Réglages des personnes",
    open_device: "Page de l'appareil",
    open_app: "Dans Application mobile",
    ago_now: "à l'instant",
    since_start: "rien depuis le démarrage de Home Assistant",
    issue: {
      missing_service: "Appelle {service}, qui n'existe pas.",
      missing_tracker: "Suit {entity_id}, qui n'existe pas.",
      group_member_missing: "Le groupe contient {service}, qui n'existe pas.",
      person_user_missing: "Reliée à un compte utilisateur qui n'existe plus.",
      app_user_missing: "Enregistré par un compte utilisateur qui n'existe plus.",
      stale_app: "L'appli ne s'est pas manifestée depuis {age}. Un ancien enregistrement peut être supprimé.",
      stale_app_start: "L'appli ne s'est pas manifestée depuis le démarrage de Home Assistant ({age}).",
      stale_app_never: "L'appli ne s'est jamais manifestée.",
      stale_app_since: "L'appli ne s'est pas manifestée depuis au moins {age}.",
      dead_app:
        "Probablement abandonné : {quiet}, et son appli n'a plus mis à jour son inscription depuis {age}{version}.",
      quiet_start: "rien reçu depuis le démarrage de Home Assistant",
      quiet_age: "rien reçu depuis {age}",
      quiet_never: "jamais rien reçu",
      quiet_since: "rien reçu depuis au moins {age}",
      version: " (version {version})",
      dormant_user: "Aucune connexion depuis {age} : compte inutilisé ?",
      dormant_user_never:
        "Jamais connecté, ni par l'interface ni par l'appli. Un compte de service (MQTT par exemple) ne se connecte jamais.",
      dead_person: "Suivie uniquement par des appareils abandonnés ou disparus : sa présence ne veut plus rien dire.",
      dead_group: "Tous ses membres sont abandonnés ou disparus.",
      dead_routine: "Ne joint plus que des appareils ou des comptes abandonnés ou disparus.",
      duplicate_app: "Enregistré {count} fois sous le même nom : les anciens enregistrements peuvent partir.",
      no_push: "{service} ne peut pas joindre {device} : les notifications push y sont coupées.",
      notify_all_apps: "Atteint tous les téléphones qui ont l'application compagnon ({count}), à qui qu'ils soient.",
      unused_app: "Aucune personne ne suit cet appareil et aucune automatisation ne le notifie.",
      foreign_tracker: "Suit {device}, dont l'appli est connectée en tant que {user}.",
      person_no_user: "Cette personne ne peut pas se connecter.",
      person_no_tracker: "Aucun traceur : la présence de cette personne n'est jamais connue.",
      user_no_person: "Compte sans personne : ni suivi, ni compté à la maison.",
      admin_no_mfa: "Administrateur joignable de l'extérieur, sans double authentification.",
    },
  },
};

export function texts(hass) {
  const lang = (hass?.locale?.language || hass?.language || "en").split("-")[0];
  const own = TEXTS[lang] || {};
  return { ...TEXTS.en, ...own, issue: { ...TEXTS.en.issue, ...(own.issue || {}) }, lang };
}

export function fill(template, params) {
  return template.replace(/\{(\w+)\}/g, (_m, key) => (params?.[key] ?? "").toString());
}

export function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// age of a timestamp, e.g. "3 days"
export function age(iso, now, lang) {
  if (!iso) return "";
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (seconds >= size) {
      const value = Math.floor(seconds / size);
      try {
        return new Intl.NumberFormat(lang, { style: "unit", unit, unitDisplay: "long" }).format(value);
      } catch (_e) {
        return `${value} ${unit}`;
      }
    }
  }
  return "";
}

export function ago(iso, now, lang, T) {
  if (!iso) return T.never;
  const seconds = (new Date(iso).getTime() - now) / 1000;
  if (Math.abs(seconds) < 60) return T.ago_now;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 60) return rtf.format(Math.round(seconds / 86400), "day");
  return new Date(iso).toLocaleDateString(lang, { year: "numeric", month: "short", day: "numeric" });
}

// coarse duration: days, months or years
export function span(iso, now, lang) {
  if (!iso) return "";
  const days = Math.max(0, (now - new Date(iso).getTime()) / 86400000);
  const [value, unit] =
    days < 60
      ? [Math.floor(days), "day"]
      : days < 730
        ? [Math.round(days / 30.44), "month"]
        : [Math.floor(days / 365.25), "year"];
  try {
    return new Intl.NumberFormat(lang, { style: "unit", unit, unitDisplay: "long" }).format(value);
  } catch (_e) {
    return `${value} ${unit}`;
  }
}

export function issueText(T, issue, now) {
  const p = { ...issue.params };
  let key = issue.code;
  // variant of the silence text
  const hush = p.never ? "never" : p.last ? "age" : p.since_start ? "start" : "since";
  const hushAge = age(p.last || p.quiet, now, T.lang);
  if (key === "stale_app") {
    if (hush !== "age") key = `stale_app_${hush}`;
    p.age = hushAge;
  } else if (key === "dead_app") {
    p.quiet = fill(T.issue[`quiet_${hush}`], { age: hushAge });
    p.age = p.at_least ? fill(T.at_least, { x: span(p.updated, now, T.lang) }) : span(p.updated, now, T.lang);
    // drop the build number: "2024.7.3-full (13278)" becomes "2024.7.3-full"
    const version = String(p.version || "").replace(/\s*\(.*\)\s*$/, "");
    p.version = version ? fill(T.issue.version, { version }) : "";
  } else if (key === "dormant_user") {
    if (!p.last) key = "dormant_user_never";
    p.age = span(p.last, now, T.lang);
  }
  return fill(T.issue[key] || key, p);
}
