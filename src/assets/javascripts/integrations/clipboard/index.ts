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

import ClipboardJS from "clipboard"
import {
  Observable,
  Subject,
  fromEvent,
  map,
  tap
} from "rxjs"

import { translation } from "~/_"
import { getElement } from "~/browser"

/* ----------------------------------------------------------------------------
 * Helper types
 * ------------------------------------------------------------------------- */

/**
 * Setup options
 */
interface SetupOptions {
  alert$: Subject<string>              // Alert subject
}

/* ----------------------------------------------------------------------------
 * Helper functions
 * ------------------------------------------------------------------------- */

/**
 * Extract text to copy
 *
 * @param el - HTML element
 *
 * @returns Extracted text
 */
function extract(el: HTMLElement): string {
  el.setAttribute("data-md-copying", "")
  const copy = el.closest("[data-copy]")
  const text = copy
    ? copy.getAttribute("data-copy")!
    : el.innerText
  el.removeAttribute("data-md-copying")
  return text.trimEnd()
}

/**
 * The page's Markdown export is fetched and copied as plain text.
 *
 * @param url - Markdown URL
 *
 * @returns Completion of the clipboard write
 */
async function copyMarkdown(url: URL): Promise<void> {
  if (!navigator.clipboard)
    throw new Error("Clipboard access is unavailable")

  const text = fetch(url).then(response => {
    if (!response.ok || response.headers.get("Content-Type")?.includes("text/html"))
      throw new Error("The Markdown export could not be loaded")
    return response.text()
  })

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    const data = text.then(value => new Blob([value], { type: "text/plain" }))

    // Clipboard access is started during the click, before the fetch completes.
    await Promise.all([
      data,
      navigator.clipboard.write([new ClipboardItem({ "text/plain": data })])
    ])
  } else {
    await navigator.clipboard.writeText(await text)
  }
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Set up Clipboard.js integration
 *
 * @param options - Options
 */
export function setupClipboardJS(
  { alert$ }: SetupOptions
): void {
  if (ClipboardJS.isSupported()) {
    new Observable<ClipboardJS.Event>(subscriber => {
      new ClipboardJS("[data-clipboard-target], [data-clipboard-text]", {
        text: el => (
          el.getAttribute("data-clipboard-text")! ||
          extract(getElement(
            el.getAttribute("data-clipboard-target")!
          ))
        )
      })
        .on("success", ev => subscriber.next(ev))
    })
      .pipe(
        tap(ev => {
          const trigger = ev.trigger as HTMLElement
          trigger.focus()
        }),
        map(() => translation("clipboard.copied"))
      )
        .subscribe(alert$)
  }

  // Clicks are delegated so buttons added by instant navigation are handled.
  fromEvent<MouseEvent>(document.body, "click")
    .subscribe(async ev => {
      if (!(ev.target instanceof Element))
        return

      const el = ev.target.closest<HTMLButtonElement>("button[data-md-copy-url]")
      if (!el || el.disabled)
        return

      el.disabled = true
      el.setAttribute("aria-busy", "true")
      try {
        const url = new URL(el.getAttribute("data-md-copy-url")!, document.baseURI)
        await copyMarkdown(url)
        if (el.isConnected)
          alert$.next(translation("clipboard.copied"))
      } catch {
        if (el.isConnected)
          alert$.next(translation("clipboard.error"))
      } finally {
        el.disabled = false
        el.removeAttribute("aria-busy")
      }
    })
}
