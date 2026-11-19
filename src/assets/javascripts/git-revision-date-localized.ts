/*
 * Copyright (c) 2025-2026 Zensical and contributors
 *
 * SPDX-License-Identifier: MIT
 * Third-party contributions licensed under DCO
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

(() => {
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000], ["month", 2592000], ["week", 604800],
    ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]
  ]

  function update(): void {
    for (const element of document.querySelectorAll(".git-revision-date-localized-plugin .timeago")) {
      const seconds = (Date.parse(element.getAttribute("datetime") || "") - Date.now()) / 1000
      if (!Number.isFinite(seconds)) continue
      let formatter: Intl.RelativeTimeFormat
      try {
        formatter = new Intl.RelativeTimeFormat((element.getAttribute("locale") || "en").replaceAll("_", "-"))
      } catch {
        formatter = new Intl.RelativeTimeFormat("en")
      }
      const [unit, size] = units.find(([, size]) => Math.abs(seconds) >= size) || units[units.length - 1]
      element.textContent = formatter.format(Math.round(seconds / size), unit)
    }
  }

  update()
  if (typeof document$ !== "undefined") document$.subscribe(update)
  setInterval(update, 60000)
})()
