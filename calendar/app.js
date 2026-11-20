(function () {
  "use strict";

  var MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  var WEEK = ["S", "M", "T", "W", "T", "F", "S"];
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var app = document.getElementById("app");
  var daysEl = document.getElementById("days");
  var ghost = document.getElementById("ghost");
  var ghostNum = document.getElementById("ghostNum");
  var monthLabel = document.getElementById("monthLabel");
  var clockEl = document.getElementById("clock");
  var weekdaysEl = document.getElementById("weekdays");
  var todayBtn = document.getElementById("todayBtn");

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
  function daysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
  }
  function key(d) {
    return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  }

  var today = startOfDay(new Date());
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var anchor = new Date(today);
  var todayKey = key(today);

  /* ---------- weekdays ---------- */

  WEEK.forEach(function (letter) {
    var span = document.createElement("span");
    span.textContent = letter;
    weekdaysEl.appendChild(span);
  });

  /* ---------- day cells ---------- */

  var cells = [];
  for (var i = 0; i < 42; i++) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    var num = document.createElement("span");
    num.className = "num";
    btn.appendChild(num);
    (function (index) {
      btn.addEventListener("click", function () {
        pickDay(index);
      });
    })(i);
    daysEl.appendChild(btn);
    cells.push({ btn: btn, num: num, date: null, stamp: "" });
  }

  /* ---------- render ---------- */

  function render() {
    monthLabel.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();

    var y = view.getFullYear();
    var m = view.getMonth();
    var first = new Date(y, m, 1);
    var start = new Date(y, m, 1 - first.getDay());

    for (var i = 0; i < 42; i++) {
      var c = cells[i];
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      c.date = d;
      var other = d.getMonth() !== m;
      var stamp = key(d) + (other ? "m" : "") + (sameDay(d, today) ? "t" : "");
      if (stamp !== c.stamp) {
        c.stamp = stamp;
        c.num.textContent = d.getDate();
        c.btn.classList.toggle("muted", other);
        c.btn.classList.toggle("is-today", sameDay(d, today));
        c.btn.setAttribute(
          "aria-label",
          d.getFullYear() + " " + MONTHS[d.getMonth()] + " " + d.getDate() +
            (sameDay(d, today) ? " (today)" : "")
        );
      }
      c.btn.tabIndex = other ? -1 : 0;
    }

    setGhost(String(anchor.getDate()));

    var offToday = !sameDay(anchor, today) || view.getMonth() !== today.getMonth() ||
      view.getFullYear() !== today.getFullYear();
    todayBtn.setAttribute("data-show", offToday ? "true" : "false");
    todayBtn.tabIndex = offToday ? 0 : -1;
  }

  var ghostValue = "";
  function setGhost(text) {
    if (text === ghostValue) {
      fitGhost();
      return;
    }
    var had = ghostValue !== "";
    ghostValue = text;
    ghostNum.textContent = text;
    fitGhost();
    if (had && !reduceMotion) {
      ghostNum.animate(
        [
          { opacity: 0, transform: "translateY(3%) scale(0.94)" },
          { opacity: 1, transform: "none" }
        ],
        { duration: 340, easing: "cubic-bezier(0.2, 0.75, 0.2, 1)" }
      );
    }
  }

  function fitGhost() {
    var h = daysEl.clientHeight;
    var w = daysEl.clientWidth;
    if (!h || !w) return;
    var size = h * 0.965;
    ghostNum.style.fontSize = size + "px";
    var textWidth = ghostNum.getBoundingClientRect().width;
    var maxWidth = w * 1.06;
    if (textWidth > maxWidth) {
      ghostNum.style.fontSize = size * (maxWidth / textWidth) + "px";
    }
  }

  /* ---------- navigation ---------- */

  function goToMonth(date, dir) {
    view = new Date(date.getFullYear(), date.getMonth(), 1);
    anchor = new Date(view.getFullYear(), view.getMonth(),
      Math.min(anchor.getDate(), daysInMonth(view.getFullYear(), view.getMonth())));
    render();
    if (!reduceMotion && dir) {
      daysEl.animate(
        [
          { opacity: 0, transform: "translateX(" + dir * 18 + "px)" },
          { opacity: 1, transform: "none" }
        ],
        { duration: 300, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" }
      );
    }
  }

  function shiftMonth(step) {
    goToMonth(new Date(view.getFullYear(), view.getMonth() + step, 1), step);
  }

  function pickDay(index) {
    var d = cells[index].date;
    if (!d) return;
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) {
      view = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    anchor = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    render();
  }

  function goToday() {
    today = startOfDay(new Date());
    todayKey = key(today);
    view = new Date(today.getFullYear(), today.getMonth(), 1);
    anchor = new Date(today);
    render();
    if (!reduceMotion) {
      ghostNum.animate(
        [
          { opacity: 0, transform: "scale(0.9)" },
          { opacity: 1, transform: "none" }
        ],
        { duration: 360, easing: "cubic-bezier(0.2, 0.75, 0.2, 1)" }
      );
    }
  }

  document.getElementById("prev").addEventListener("click", function () {
    shiftMonth(-1);
  });
  document.getElementById("next").addEventListener("click", function () {
    shiftMonth(1);
  });
  todayBtn.addEventListener("click", goToday);

  /* ---------- swipe ---------- */

  var startX = 0, startY = 0, tracking = false;

  app.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  app.addEventListener("pointerup", function (e) {
    if (!tracking) return;
    tracking = false;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      shiftMonth(dx < 0 ? 1 : -1);
    }
  });

  app.addEventListener("pointercancel", function () {
    tracking = false;
  });

  /* ---------- keyboard ---------- */

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowLeft") {
      shiftMonth(-1);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      shiftMonth(1);
      e.preventDefault();
    } else if (e.key === "Home") {
      goToday();
      e.preventDefault();
    }
  });

  /* ---------- clock ---------- */

  var lastClock = "";
  function tick() {
    var now = new Date();
    var text =
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0");
    if (text !== lastClock) {
      lastClock = text;
      clockEl.textContent = text;
      clockEl.setAttribute("datetime", now.toISOString());
    }
    var d = startOfDay(now);
    if (!sameDay(d, today)) {
      today = d;
      todayKey = key(today);
      render();
    }
  }

  /* ---------- layout ---------- */

  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitGhost, 80);
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", function () {
    setTimeout(fitGhost, 220);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize);
  }

  /* ---------- boot ---------- */

  render();
  tick();
  setInterval(tick, 1000);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      fitGhost();
    });
  }
  requestAnimationFrame(fitGhost);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
