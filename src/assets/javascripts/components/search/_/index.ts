/*
 * Copyright (c) 2025 Zensical and contributors
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

import {
  NEVER,
  Observable,
  ObservableInput,
  from,
  fromEvent,
  skip,
} from "rxjs"


import { Component } from "../../_"
// @ts-ignore
import { mount, open, setup } from "../client"
import css from "../client/index.css"
import { SearchIndex } from "../schema"
import { configuration } from "~/_"
import { h } from "~/utilities"
import { getElement, watchToggle } from "~/browser"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Search
 */
export interface Search {}

/* ----------------------------------------------------------------------------
 * Helper types
 * ------------------------------------------------------------------------- */

/**
 * Mount options
 */
interface MountOptions {
  index$: ObservableInput<SearchIndex> // Search index observable
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Mount search
 *
 * This function sets up the search functionality, including the underlying
 * web worker and all keyboard bindings.
 *
 * @param el - Search element
 * @param options - Options
 *
 * @returns Search component observable
 */
export function mountSearch(
  el: HTMLElement, { index$ }: MountOptions
): Observable<Component<Search>> {
  const config = configuration()

  // Create host to attach the search to
  const host = document.createElement("div")
  document.body.appendChild(host)

  // Adjust styles of host
  host.style.position = "fixed"
  host.style.height = "100%"
  host.style.top = "0"
  host.style.zIndex = "4";

  // Create a shadow root and inject search
  const shadow = host.attachShadow({ mode: "closed" })
  shadow.appendChild(h("style", {}, css.toString()))

  // Setup search worker
  try {
    setup(config.search, {
      highlight: config.features.includes("search.highlight")
    })
    from(index$)
      .subscribe(index => {
        // Adjust base URLs of items
        for (const item of index.items) {
          item.location = new URL(item.location, config.base).toString()
        }
        mount(index, shadow)
      })

    // Open search
    fromEvent(el, "click").subscribe(() => {
      open()
    })

    // Open search on mobile
    watchToggle("search")
      .pipe(skip(1))
      .subscribe(() => open())
  } catch {
    // Search could not be initialized - we're likely offline, and the offline
    // plugin has not been included, so we just hide the search
    el.hidden = true

    // Also hide search button in mobile view
    let button = getElement("label[for=__search]")
    button.hidden = true
  }

  // Return nothing
  return NEVER
}
