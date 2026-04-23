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

import {
  Observable,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
  tap
} from "rxjs"

import { Component } from "../../_"

import { watchScript, watchStyles } from "~/browser"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * GLightbox
 */
export interface GLightbox {}

/* ----------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

/**
 * GLightbox instance observable
 */
let glightbox$: Observable<any>

/* ----------------------------------------------------------------------------
 * Helper functions
 * ------------------------------------------------------------------------- */

/**
 * Fetch GLightbox script and styles
 *
 * @returns GLightbox assets observable
 */
function fetchAssets(): Observable<void> {
  return typeof GLightbox === "undefined" || GLightbox instanceof Element
    ? forkJoin([
        watchScript("https://unpkg.com/glightbox@3/dist/js/glightbox.min.js"),
        watchStyles("https://unpkg.com/glightbox@3/dist/css/glightbox.min.css")
      ]).
        pipe(map(() => undefined))
    : of(undefined)
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Mount GLightbox
 *
 * @param els - Elements to add to the lightbox
 *
 * @returns GLightbox component observable
 */
export function mountGLightbox(
  els: HTMLAnchorElement[]
): Observable<Component<GLightbox>> {
  glightbox$ ||= fetchAssets()
    .pipe(
      map(() => new GLightbox({
        touchNavigation: true,
        loop: false,
        zoomable: true,
        draggable: true,
        openEffect: "zoom",
        closeEffect: "zoom",
        slideEffect: "slide",

        // Prevent accidental interactions and console warning
        onOpen: () => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        },

        // Override with custom settings if available
        ...typeof GLightboxOptions !== "undefined"
          ? GLightboxOptions
          : {},
      })),
      shareReplay(1)
    )

  // Add elements to lightbox
  glightbox$.pipe(
    tap(gallery => gallery.setElements(els))
  )

  // Create and return component
  return glightbox$
    .pipe(
      switchMap(() => els.map(el => ({ ref: el })))
    )
}
