if (isInIframe()) {
  try {
    parseWebsite(window.location.href)
  } catch (ex) {
    console.error(ex)
  }
}

const query = new URLSearchParams(window.location.search)

if (isInIframe() && query.get("isInCascaWidget")) {
  window.addEventListener("message", function (event) {
    const { type } = event.data || {}
    if (type !== "casca/set-css") return
    const customCSS = event.data.payload
    writeStyles(customCSS)
  })
}

if (isInIframe() && query.get("isInCascaIframe")) {
  try {
    writeStyles(`
      img, video, iframe, embed, object, audio {
        display: none !important;
      }
    `)
  } catch (e) {
    console.error(e)
  }
  let wasActivated = false
  window.addEventListener("message", function (event) {
    const { selector, iframeId, type } = event.data || {}
    if (type !== "casca/scraper-init" || wasActivated) return
    wasActivated = true
    const interval = setInterval(() => {
      const elements = document.querySelectorAll(selector)
      if (!elements.length) {
        console.log("Scrapper: No elements found")
        return
      }
      clearInterval(interval)
      const data = []
      elements.forEach((element) => {
        const links = []
        const anchors = [...element.querySelectorAll("a")]
        if (element.tagName === "A") anchors.push(element)
        anchors.forEach((anchor) => {
          links.push({
            href: new URL(anchor.href, window.location.href).href,
            innerText: anchor.innerText,
          })
        })
        data.push({
          innerText: element.innerText,
          links,
        })
      })
      window.parent.postMessage(
        {
          type: "casca/scraper-data",
          payload: data,
          iframeId,
        },
        "*"
      )
    }, 3000)

    setTimeout(() => {
      clearInterval(interval)
    }, 10000)
  })
}

function parseWebsite(url) {
  const { hostname } = new URL(url)

  switch (hostname) {
    case "www.instagram.com": {
      // iphone
      window.navigator.userAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko)"
      setTimeout(() => {
        const reloadPageButton = document.querySelector('[role="main"] a')
        reloadPageButton?.click()
      }, 50)
      break
    }
    default:
  }
}

function writeStyles(str) {
  const style = document.createElement("style")
  style.dataset.casca = "true"
  style.innerHTML = str
  document.head.appendChild(style)
}

function isInIframe() {
  try {
    return window.self !== window.top
  } catch (e) {
    return true
  }
}
