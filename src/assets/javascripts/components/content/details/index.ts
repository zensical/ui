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
  Subject,
  defer,
  filter,
  finalize,
  map,
  tap
} from "rxjs"

import { Component } from "../../_"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Details
 */
export interface Details {
  action: "open" | "close"             // Details state
}

/* ----------------------------------------------------------------------------
 * Helper types
 * ------------------------------------------------------------------------- */

/**
 * Watch options
 */
interface WatchOptions {
  print$: Observable<boolean>          // Media print observable
}

/**
 * Mount options
 */
interface MountOptions {
  print$: Observable<boolean>          // Media print observable
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Watch details
 *
 * @param el - Details element
 * @param options - Options
 *
 * @returns Details observable
 */
export function watchDetails(
  el: HTMLDetailsElement, { print$ }: WatchOptions
): Observable<Details> {
  let open = true
  return print$.pipe(
    filter(active => active || !open),
    tap(() => open = el.open),
    map(active => ({
      action: active ? "open" : "close"
    }) as Details)
  )
}

/**
 * Mount details
 *
 * This function ensures that `details` tags are opened prior to printing, so
 * the whole content of the page is visible.
 *
 * @param el - Details element
 * @param options - Options
 *
 * @returns Details component observable
 */
export function mountDetails(
  el: HTMLDetailsElement, options: MountOptions
): Observable<Component<Details>> {
  return defer(() => {
    const push$ = new Subject<Details>()
    push$.subscribe(({ action }) => {
      el.toggleAttribute("open", action === "open")
    })

    // Create and return component
    return watchDetails(el, options)
      .pipe(
        tap(state => push$.next(state)),
        finalize(() => push$.complete()),
        map(state => ({ ref: el, ...state }))
      )
  })
}
