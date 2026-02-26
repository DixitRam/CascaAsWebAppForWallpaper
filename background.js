const browserInstance = typeof browser === 'undefined' ? chrome : browser;

const RULES = [
  {
    id: 1,
    condition: {
      resourceTypes: Object.values(browserInstance.declarativeNetRequest.ResourceType),
    },
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        {header: "X-Frame-Options", operation: "remove"},
        {header: "Frame-Options", operation: "remove"},
        {header: "Content-Security-Policy", operation: "remove"},
        {header: "ALLOW-FROM", operation: "set", value: "*"},
      ],
    },
  },
];
const initialPomodoro = {
  actions: [],
  type: 'focus',
  iterations: 0,
}

let pomodoro = initialPomodoro

function savePomodoroData(data) {
  pomodoro = {...pomodoro, ...data}
}
function createRules(sites) {
  if (sites.length === 0) return [];
  return sites.map((site, index) => ({
    id: RULES[0].id + index + 1,
    priority: index + 1,
    condition: {
      urlFilter: site,
      resourceTypes: ["main_frame", "sub_frame"]
    },
    action: {
      type: "block",
    },
  }));
}

function blockSites(sites) {
  const newRules = createRules(sites);
  browserInstance.declarativeNetRequest.getDynamicRules().then((oldRules) => {
    const blockedSitesRules = oldRules.filter((rule) => rule.id !== RULES[0].id);
    browserInstance.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: blockedSitesRules.map((i) => i.id) || [],
      addRules: newRules,
    });
  })
}

let corsGranted = false

browserInstance.runtime.onMessage.addListener((message, sender) => {
  if (sender.origin && !sender.origin.startsWith("chrome-extension://")) return;
  switch (message.type) {
    case "init-user": {
      const { userID } = message.payload;
      if (userID) browserInstance.runtime.setUninstallURL(`https://casca.space/api/uninstall?user=${encodeURIComponent(userID)}`);
      break;
    }
    case "enable-no-cors":
      browserInstance.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: RULES.map((i) => i.id),
        addRules: RULES,
      });
      break;
    case "disable-no-cors":
      browserInstance.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: RULES.map((i) => i.id),
        addRules: [],
      });
      break;
    case "casca/cors-request": {
      browserInstance.declarativeNetRequest.getDynamicRules((rules) => {
        browserInstance.runtime.sendMessage({type: rules.some(r => r.id === RULES[0].id) ? "casca/cors-granted" : "casca/cors-denied" })
      })
      break;
    }
    case "site-blocker/sync-blocked-items": {
      blockSites(message.payload.items)
      break;
    }
    case "casca/cors-granted": {
      if (corsGranted) break;
      corsGranted = true
      browserInstance.scripting?.getRegisteredContentScripts().then((scripts) => {
        const script = {
          id: "casca-content-script",
          matches: ["https://*/*", "http://*/*"],
          allFrames: true,
          js: ["content.js"],
        }
        if (scripts.some((s) => s.id === script.id)) return;
        browserInstance.scripting.registerContentScripts([script])
      })
      break;
    }
    case "notification":
      browserInstance.notifications.create('', message.options);
      break;
    default:
      if (message.type.startsWith('pomodoro/')) pomodoroMessages(message, sender)
  }
});

function createTimer(duration, callback) {
  const { type, iterations, options } = pomodoro;
  let intervalId

  const checkTime = () => {
    if (pomodoro.actions.length === 0 || pomodoro.actions[pomodoro.actions.length - 1].type === 'pause') {
      return;
    }

    const timeLeft = calculateTimeLeft(pomodoro.actions, duration * 60);

    if (timeLeft <= 0) {
      clearInterval(intervalId);
      callback();

      let nextType;
      let nextIterations;

      switch (type) {
        case 'focus':
          nextType = iterations === 3 ? 'longBreak' : 'shortBreak';
          nextIterations = iterations;
          break;
        case 'shortBreak':
          nextType = 'focus';
          nextIterations = iterations === 4 ? 0 : iterations + 1;
          break;
        case 'longBreak':
          nextType = 'focus';
          nextIterations = 0;
          break;
        default:
      }

      if (options.isAutoStart) {
        savePomodoroData({
          iterations: nextIterations,
          type: nextType,
          actions: type === 'longBreak' ? [] : [{type: 'start', value: new Date()}]
        });

        if (type !== 'longBreak') {
          createTimer(Number(options[nextType]), callback);
        }
      } else {
        savePomodoroData({
          actions: [],
          iterations: nextIterations,
          type: nextType
        });
      }
      pomodoro.timerId = null;
      browserInstance.runtime.sendMessage({ type: 'pomodoro/on-data', payload: pomodoro });
    }
  };

  intervalId = setInterval(checkTime, 1000);
}

function calculateTimeLeft(actions, duration) {
  if (actions.length === 0) return duration
  const timeLeft = actions.reduce((acc, cur, index) => {
    switch (cur.type) {
      case 'start':
      case 'resume': {
        const curDate = new Date(cur.value).getTime()
        const nextDate = actions[index + 1] ? new Date(actions[index + 1].value).getTime() : Date.now()
        return acc + (nextDate - curDate)
      }
      case 'pause':
      default:
        return acc
    }
  }, 0)
  return Math.floor((duration * 1000 - timeLeft) / 1000)
}

function createNotification({options, isChromeNotificationsAllowed}) {
  if (isChromeNotificationsAllowed) {
    browserInstance.notifications.create('', options);
  } else {
    browserInstance.runtime.sendMessage({type: 'pomodoro/casca-notification', payload: {type: pomodoro.type}})
  }
}

const keepAlive = () => setInterval(browserInstance.runtime.getPlatformInfo, 20000);

browserInstance.runtime.onStartup.addListener(keepAlive);


keepAlive();

function pomodoroMessages(message) {
  switch (message.type) {
    case "pomodoro/request-data":
      browserInstance.runtime.sendMessage({ type: 'pomodoro/on-data', payload: pomodoro })
      break;
    case "pomodoro/update-options":
      savePomodoroData({
        options: message.payload,
        notificationOptions: message.payload.notificationOptions,
      })
      browserInstance.runtime.sendMessage({ type: 'pomodoro/on-data', payload: pomodoro })
      break;
    case "pomodoro/start":
      savePomodoroData({
        actions: [{
          type: 'start',
          value: new Date(),
        }],
      })
      const duration = Number(pomodoro.options[pomodoro.type])
      clearTimeout(pomodoro.timerId)
      createTimer(duration, () => createNotification({
        options: pomodoro.notificationOptions[pomodoro.type],
        isChromeNotificationsAllowed: pomodoro.options.isChromeNotificationsAllowed,
      }))
      browserInstance.runtime.sendMessage({ type: 'pomodoro/on-data', payload: pomodoro })
      break;
    case "pomodoro/pause":
      savePomodoroData({
        actions: [...pomodoro.actions, {
          type: 'pause',
          value: new Date()
        }]
      })
      clearTimeout(pomodoro.timerId)
      browserInstance.runtime.sendMessage({ type: 'pomodoro/on-data', payload: pomodoro })
      break;
    case "pomodoro/resume": {
      savePomodoroData({
        actions: [...pomodoro.actions, {
          type: 'resume',
          value: new Date()
        }]
      })
      const duration = Number(pomodoro.options[pomodoro.type])
      browserInstance.runtime.sendMessage({ type: 'pomodoro/on-data', payload: pomodoro })
      clearTimeout(pomodoro.timerId)
      createTimer(duration, () => createNotification({
        options: pomodoro.notificationOptions[pomodoro.type],
        isChromeNotificationsAllowed: pomodoro.options.isChromeNotificationsAllowed,
      }))
      break;
    }
    case "pomodoro/reset": {
      clearTimeout(pomodoro.timerId)
      const options = pomodoro.options
      const notificationOptions = pomodoro.notificationOptions
      pomodoro = {
        ...initialPomodoro,
        options,
        notificationOptions
      }
      browserInstance.runtime.sendMessage({ type: 'pomodoro/on-data', payload: pomodoro })
      break;
    }
    case "pomodoro/change-type": {
      clearTimeout(pomodoro.timerId)
      savePomodoroData({
        actions: [],
        iterations: 0,
        type: message.payload.type
      })
      browserInstance.runtime.sendMessage({ type: 'pomodoro/on-data', payload: pomodoro })
      break;
    }
  }
}

// const res = {
//   '12121': [{}, {}, {}],
//   '34344': [{}, {}, {}],
//   '46566': [{}, {}, {}],
// }
