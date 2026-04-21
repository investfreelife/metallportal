;(function () {
  'use strict'

  var params = (document.currentScript || {}).src || ''
  var tid = new URL(params, location.href).searchParams.get('tid')
  if (!tid) return

  var ENDPOINT = (document.currentScript || {}).src
    ? new URL((document.currentScript || {}).src).origin + '/api/track'
    : '/api/track'

  // ── Session & visitor fingerprint ───────────────────────────────────────
  function uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
  }

  function getVisitorId() {
    try {
      var v = localStorage.getItem('_mp_vid')
      if (!v) { v = uid(); localStorage.setItem('_mp_vid', v) }
      return v
    } catch (e) { return uid() }
  }

  function getSessionId() {
    try {
      var key = '_mp_sid'
      var raw = sessionStorage.getItem(key)
      if (raw) return raw
      var s = uid()
      sessionStorage.setItem(key, s)
      return s
    } catch (e) { return uid() }
  }

  var visitorId = getVisitorId()
  var sessionId = getSessionId()
  var pageStart = Date.now()
  var maxScroll = 0

  // ── Send event ───────────────────────────────────────────────────────────
  function send(type, data) {
    var payload = Object.assign({
      tenant_id: tid,
      visitor_id: visitorId,
      session_id: sessionId,
      type: type,
      url: location.pathname,
      referrer: document.referrer || null,
      utm_source: new URLSearchParams(location.search).get('utm_source'),
      utm_campaign: new URLSearchParams(location.search).get('utm_campaign'),
      utm_medium: new URLSearchParams(location.search).get('utm_medium'),
      device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      ts: Date.now(),
    }, data || {})

    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, JSON.stringify(payload))
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(function () {})
    }
  }

  // ── Scroll depth ─────────────────────────────────────────────────────────
  function onScroll() {
    var scrolled = Math.round(
      ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
    )
    if (scrolled > maxScroll) maxScroll = Math.min(scrolled, 100)
  }
  window.addEventListener('scroll', onScroll, { passive: true })

  // ── Page view ────────────────────────────────────────────────────────────
  send('page_view')

  // ── Page leave: time on page + scroll depth ──────────────────────────────
  function onLeave() {
    send('page_leave', {
      time_spent: Math.round((Date.now() - pageStart) / 1000),
      scroll_depth: maxScroll,
    })
  }
  window.addEventListener('beforeunload', onLeave)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') onLeave()
  })

  // ── Phone / email clicks ─────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]')
    if (!a) return
    var href = a.getAttribute('href') || ''
    if (href.startsWith('tel:')) send('phone_click', { phone: href.replace('tel:', '') })
    if (href.startsWith('mailto:')) send('email_click', { email: href.replace('mailto:', '') })
  })

  // ── File downloads ────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]')
    if (!a) return
    var href = a.getAttribute('href') || ''
    if (/\.(pdf|xlsx?|docx?|zip)$/i.test(href)) {
      send('file_download', { file: href })
    }
  })

  // ── Expose API for custom events ─────────────────────────────────────────
  window.mpTrack = function (type, data) { send(type, data) }

  // ── Flush queue if any ────────────────────────────────────────────────────
  if (window._mpQueue) {
    window._mpQueue.forEach(function (args) { send(args[0], args[1]) })
    delete window._mpQueue
  }
})()
